# Qdrant 知识切片存储方案研究

日期：2026-08-18

> 文档性质：本文件是**非规范性技术依据**，用于验证已确认的长期商用存储分工在 Qdrant 与腾讯云 COS 官方能力上可行。它不是已经实现的代码事实，也不替代后续 API、表结构、部署和保留策略的规范性设计。

## 已确认的目标分工

长期商用目标同时保留三类可恢复资产：

```text
腾讯云 COS
├── 每个知识版本的不可变原文件 source.<ext>
├── 每个知识版本的不可变解析结果 chunks.jsonl
└── 定期导出的 Qdrant Collection Snapshot

Qdrant
└── 在线 Point：向量 + 可直接检索使用的正文 + 溯源 Payload

PostgreSQL
└── 条目、版本、COS Key、checksum、状态、场景绑定、任务快照和检索审计
    不保存全量 chunk 正文
```

三类资产职责不同，并非相互替代：

- 原文件是用户上传的原始事实源；
- `chunks.jsonl` 是某个不可变知识版本当时经过解析、OCR、ASR、规范化和切片后的可迁移审计资产；
- Qdrant Payload 是实时检索副本，避免外呼命中后再查询 PostgreSQL；
- Qdrant Snapshot 是 Collection 级灾备资产，用于快速恢复 Point、Payload 和索引状态，不替代按知识版本组织的 `chunks.jsonl`。

这套分工在技术上成立。Qdrant Point 原生由向量和可选 Payload 组成，Payload 可保存任意 JSON 信息；官方 RAG 与 Embedding 迁移资料也使用文本 Payload 作为检索内容和重新生成向量的输入。[Qdrant Points](https://qdrant.tech/documentation/manage-data/points/) [Qdrant Payload](https://qdrant.tech/documentation/manage-data/payload/) [Qdrant Embedding Model Migration](https://qdrant.tech/documentation/tutorials-operations/embedding-model-migration/)

## 为什么同时保留原文件、`chunks.jsonl` 和 Snapshot

| 资产 | 解决的问题 | 不能替代什么 |
| --- | --- | --- |
| COS 原文件 | 下载、预览、重新采用新解析器处理、证明用户最初上传内容 | 重新 OCR/ASR 成本高，不能代替已经确认的解析结果 |
| COS `chunks.jsonl` | 按知识版本重建任意向量库、切换 Embedding、复核当时 OCR/ASR 与切片输出 | 不提供低延迟向量检索，也不保存 Qdrant 索引结构 |
| Qdrant Point/Payload | 实时语义检索并一次返回正文、页码或时间点 | 不是独立于 Qdrant 产品格式的版本审计文件 |
| Qdrant Snapshot | 快速恢复整个 Collection 的配置、Point、Payload 和已建索引 | 是 Collection 级快照，不是单个知识版本的可移植业务格式 |
| PostgreSQL 控制/审计 | 管理版本状态、场景绑定、任务冻结范围、处理结果和真实命中证据 | 不承担全量正文和向量检索 |

Qdrant 官方说明 Collection Snapshot 包含 Collection 配置以及全部 Point 和 Payload，可用于归档、复制和误删/损坏恢复；Collection Alias 不包含在 Snapshot 中，恢复后必须按受控配置重新建立。[Qdrant Snapshots](https://qdrant.tech/documentation/operations/snapshots/) [Qdrant Migration and Recovery](https://qdrant.tech/documentation/migration-recovery-options/)

## COS 对象组织

建议的逻辑 Key：

```text
ai-reach/knowledge/<tenantId>/<knowledgeItemId>/<versionId>/source.<ext>
ai-reach/knowledge/<tenantId>/<knowledgeItemId>/<versionId>/chunks.jsonl
ai-reach/qdrant-snapshots/<collectionName>/<snapshotTimestamp>.snapshot
```

对象全部保持私有。数据库只保存 Bucket、Region、Key、大小、MIME、checksum 等信息，不保存永久公开 URL。预览和下载由后端鉴权后签发短期访问地址。

### 原文件上传

1. 后端完成登录、租户、权限和配额校验，创建短期上传会话并预分配知识条目、版本 ID 和不能由前端修改的目标 Key；
2. 后端签发短时、最小权限、限定到该目标 Key 的 STS 临时凭证；
3. 前端使用 `cos-js-sdk-v5` 的高级 `uploadFile` 直传 COS；
4. 大文件由高级接口采用 Multipart Upload，支持并发、暂停和续传；具体简单上传/分块阈值由网络与文件规模实测确定，不在本研究文档固化；
5. 前端报告完成后，后端仍通过 `HeadObject` 等服务端检查确认对象存在、Key、大小和预期信息，再创建 `PROCESSING` 知识版本；上传会话状态不作为知识处理状态展示。

腾讯云官方明确建议 Web 前端直传使用临时密钥，且必须把 action 与 resource 限制在最小权限范围；前端获取临时密钥的接口本身也必须先做业务鉴权。[腾讯云前端直传临时密钥安全指引](https://cloud.tencent.com/document/product/436/40265)

腾讯云 JavaScript 上传实践由服务端生成随机目标路径和相应临时权限，前端再调用 `uploadFile`；JavaScript SDK 的高级接口封装简单上传与分块上传，并支持并发、断点续传、暂停和取消。[腾讯云上传对象实践教程](https://cloud.tencent.com/document/product/436/109014) [腾讯云 JavaScript SDK 上传对象](https://cloud.tencent.com/document/product/436/64960)

预签名 URL 只适合简单上传，不支持 Multipart/断点续传，因此不能单独覆盖当前知识库的大文件上传需求。[腾讯云预签名授权上传](https://cloud.tencent.com/document/product/436/14114) [腾讯云分块上传](https://cloud.tencent.com/document/product/436/14112)

### `chunks.jsonl` 生成

`chunks.jsonl` 由私有 Worker 在解析完成后写入 COS，不由浏览器生成。每行代表一个最终切片，例如：

```json
{"schema_version":1,"knowledge_item_id":"ki_xxx","knowledge_version_id":"kv_xxx","chunk_id":"uuid","retrieval_text":"产品支持私有化部署……","source_type":"pdf","page_number":12,"start_ms":null,"end_ms":null,"content_hash":"sha256:..."}
```

约束：

- 一个知识版本只有一个最终 `chunks.jsonl` Key，成功发布后不可原地覆盖；
- PostgreSQL `knowledge_version` 保存该 Key、文件 SHA-256、行数、解析器/OCR/ASR 版本和切片规则版本；
- 每行 `chunk_id` 必须稳定，`content_hash` 必须与写入 Qdrant 的正文对应；
- Embedding 必须基于这份最终文件中的 `retrieval_text` 生成，不能使用另一份未落盘的临时文本；
- 临时抽帧、临时音频和处理中间文件与正式 `chunks.jsonl` 分开存放并按生命周期清理。

### COS 生命周期

生命周期规则用于清理未完成 Multipart 产生的碎片，以及已经明确可删除的临时派生文件。原文件、正式 `chunks.jsonl` 和有效 Snapshot 不能套用临时文件的自动过期规则；它们的保留期限必须由知识版本与灾备策略决定。

腾讯云官方支持通过 `AbortIncompleteMultipartUpload` 清理超过指定时间仍未完成的上传，并说明未完成分块会占用存储空间和产生费用。[腾讯云生命周期配置元素](https://cloud.tencent.com/document/product/436/17029) [腾讯云删除碎片文件](https://cloud.tencent.com/document/product/436/17313)

## Qdrant 在线数据设计

### Point 与 Payload

```text
id                              确定性 chunk UUID
vector.dense                    语义向量
vector.sparse                   仅采用 sparse/hybrid 时保存
payload.tenant_id
payload.knowledge_item_id
payload.knowledge_version_id
payload.chunk_id
payload.retrieval_text
payload.source_type
payload.source_name
payload.page_number             PDF/Office 可选
payload.start_ms                音视频可选
payload.end_ms                  音视频可选
payload.content_hash
payload.artifact_line_number    对应 chunks.jsonl 行号
```

Qdrant 官方允许 Payload 保存任意可表示为 JSON 的信息，正文和溯源字段放入 Payload 符合其数据模型。[Qdrant Payload](https://qdrant.tech/documentation/manage-data/payload/)

实时外呼只通过 Qdrant 返回 Top K 的 `retrieval_text` 和来源信息，不再同步回查 PostgreSQL 全文。PostgreSQL 只记录本次命中的 Point、知识版本、分数、实际证据文本和回答结果；这是事件审计，不是全量 chunk 正文库。

### 正文落盘与 Payload Index

正文 Payload 采用 Qdrant 的磁盘持久化/冷层能力。当前官方文档以 `payload.memory: cold` 表示不预热大 Payload；磁盘与 Gridstore 无论内存层级如何都会持久化 Payload。实际配置名必须以项目最终固定的 Qdrant 版本为准。[Qdrant Storage](https://qdrant.tech/documentation/manage-data/storage/)

只为检索过滤字段建立 Payload Index：

- `tenant_id`：`keyword`，并标记 `is_tenant=true`；
- `knowledge_version_id`：`keyword`；
- 若运行时实际还会按其他字段过滤，再基于查询证据增加，不为 `retrieval_text` 建普通过滤索引。

Qdrant 官方说明 Payload Index 用于加速对应过滤条件，也会消耗额外内存和磁盘，因此建议只索引真正用于过滤的字段，并尽量在写入数据前创建。[Qdrant Payload Index](https://qdrant.tech/documentation/manage-data/indexing/)

### 多租户隔离

当前设计使用一个共享 Collection，通过 `tenant_id` Payload 分区，并在每次查询中强制过滤：

```text
tenant_id = 当前登录租户
AND knowledge_version_id IN 当前外呼任务冻结的 READY 版本
```

Qdrant 官方指出，为每个租户创建单独 Collection 通常效率不高；对于大量规模相近的小租户，可在共享 Collection 中用租户 Payload 字段分区并建立 `is_tenant=true` 的 Keyword Index。[Qdrant Multitenancy](https://qdrant.tech/documentation/manage-data/multitenancy/)

Payload 过滤不是身份认证。Qdrant 必须部署在私有网络，不直接暴露给浏览器；`tenant_id`、场景和知识版本范围只能从后端可信的登录、任务及通话上下文取得，禁止接受模型或前端自行扩大范围。

## 写入、发布与运行时流程

### 入库与发布

```text
后端创建上传会话并签发受限 STS
  -> 浏览器直传原文件到私有 COS
  -> 后端确认对象后创建 PROCESSING 版本
  -> Worker 解析 / OCR / ASR / 规范化 / 切片
  -> Worker 写不可变 chunks.jsonl 到 COS
  -> 从 chunks.jsonl 生成 Embedding
  -> Qdrant 幂等 upsert vector + retrieval_text + provenance
  -> 核对 chunks 行数、总 hash、Point 数和 Point content_hash
  -> PostgreSQL 将版本标记 READY
```

`chunks.jsonl` 或 Qdrant 任一步失败，当前版本都不能进入 `READY`。更新资料时创建新版本；新版本成功前，旧的 `READY` 版本继续服务。这里不引入分布式事务，使用确定性 Point ID、幂等 upsert 和发布前核对即可。

### 实时检索

```text
客户事实问题
  -> 生成 query embedding
  -> Qdrant 强制 tenant + frozen version 过滤
  -> 返回 Top 3~5 正文、页码/时间点和 score
  -> 注入现有 Qwen 生成回答
  -> PostgreSQL 写入检索证据审计
```

实时链路不读取 `chunks.jsonl`，也不按 `chunk_id` 回查 PostgreSQL 正文。`chunks.jsonl` 的价值在于版本审计和离线重建，不应增加通话时延。

## 备份、恢复与迁移

### Qdrant 灾备

1. 按商用 RPO 确定 Snapshot 周期；
2. 备份任务创建 Collection Snapshot，下载后上传到私有 COS Snapshot 前缀；
3. 记录 Snapshot 对应的 Collection、Embedding 模型、Point 数、checksum 和时间；
4. 定期在隔离环境恢复，并核对 Point 数、Payload hash、租户过滤和抽样检索；
5. 恢复后按受控配置重建 Collection Alias，因为 Alias 不包含在 Collection Snapshot 中。

Qdrant 官方将 Snapshot 定义为包含 Collection 数据与配置的归档，并支持恢复 Collection；需要改变分片数量或迁移数据子集时，则使用 Migration Tool 流式搬运 Point。[Qdrant Snapshots](https://qdrant.tech/documentation/operations/snapshots/) [Qdrant Migration and Recovery](https://qdrant.tech/documentation/migration-recovery-options/)

### 单版本重建或更换 Embedding

```text
读取指定版本 chunks.jsonl
  -> 校验整体 SHA-256 与行数
  -> 重新生成 Embedding
  -> 写入新 Qdrant Collection/Named Vector
  -> 核对 chunk_id + content_hash
  -> 切换受控 Alias/模型配置
```

这一过程无需重新下载并执行 OCR/ASR，也不依赖旧 Qdrant 是否可用。若 `chunks.jsonl` 本身损坏，才从 COS 原文件重新解析。

## 技术可行性结论

已确认设计不存在产品能力上的硬阻塞：

- Qdrant 能在 Point 中持久化向量、正文和溯源 Payload；
- 大正文 Payload 能采用磁盘/冷层存储，租户和版本字段能单独建立 Payload Index；
- 共享 Collection 能使用租户 Payload 分区；
- Snapshot 能保存并恢复 Collection 数据、配置、Point 与 Payload；
- 腾讯 COS 能以私有对象保存原文件、`chunks.jsonl` 和 Qdrant Snapshot；
- STS 最小权限临时凭证与 JavaScript 高级上传能支持浏览器直传和 Multipart；
- 生命周期规则能清理未完成分块和临时处理文件。

仍需在规范性实施方案中确定的不是架构方向，而是：固定 Qdrant/COS SDK 版本、Embedding 模型和维度、上传分块阈值、Snapshot RPO/RTO、正式对象保留期限、单文件与租户配额。

## 验收标准

1. 浏览器只能获得短时、限定 action 与精确目标 Key 的 COS 临时权限，永久密钥不进入浏览器和前端 Bundle；
2. 每个 `READY` 知识版本在 COS 中同时存在原文件和唯一不可变 `chunks.jsonl`，PostgreSQL 保存两者 Key、checksum 和版本信息；
3. `chunks.jsonl` 行数、Qdrant Point 数以及相同 `chunk_id` 的 `content_hash` 一致后，版本才能发布；
4. Qdrant 一次查询返回正文及页码/时间点，不回查 PostgreSQL 全量正文；
5. 跨租户、未冻结版本和非 `READY` 版本均无法被检索；
6. PostgreSQL 不保存全量 chunk 正文，只保存控制数据与真实命中证据审计；
7. 能只用指定版本的 `chunks.jsonl` 在空 Collection 中重建向量，不重新执行 OCR/ASR；
8. Qdrant Snapshot 已复制到私有 COS，并完成一次隔离恢复；恢复后 Point 数、Payload hash、租户过滤和抽样检索一致；
9. 生命周期规则能清理超期未完成 Multipart 与临时派生文件，但不会误删有效原文件、`chunks.jsonl` 或仍在保留期的 Snapshot。

# 知识库技术设计审核：外部事实核验

> 状态：非规范性核验报告
> 日期：2026-08-18
> 范围：只核验审核意见涉及的阿里云文件转写、PostgreSQL 锁与文本检索、腾讯 COS 预签名访问事实。本文不修改正式设计，也不表示相关能力已经实现。

## 1. 核验结论

| 审核意见 | 结论 | 需要修正的边界 |
| --- | --- | --- |
| `qwen-audio-3.0-asr-flash-filetrans` 使用异步提交和轮询 | **确认** | 提交接口只创建任务并返回 `task_id`，业务侧必须轮询查询接口 |
| ASR 结果地址只在 24 小时内有效 | **确认** | 官方还说明超时后无法继续查询任务；不能只保存结果 URL，必须及时取回结果 |
| 必须持久化 `task_id/request_id` | **部分确认** | `task_id` 是恢复轮询所必需；`request_id` 是调用追踪标识，强烈建议保存，但不是查询任务的必需参数 |
| `FOR UPDATE SKIP LOCKED` 不能覆盖长耗时处理的完整生命周期 | **确认** | 它适合短事务领取队列记录；OCR/ASR 不能在持有该行锁的事务中执行，领取后要写入可恢复的租约/尝试状态再提交事务 |
| PostgreSQL FTS 的 parser、dictionary、configuration 会决定检索行为 | **确认** | 抽象写一个 `search_vector` 字段不足以形成可实现合同，必须先锁定建索引和查询所用的具体配置与 SQL |
| `pg_trgm` 可以直接代表已验证的中文检索方案 | **不成立** | 它做字符三元组相似度与模糊匹配，不是中文分词器，也不理解同义改写或语义；只能经真实问题集证明是否够用 |
| “浏览器只访问 API”和“浏览器访问 COS 预签名地址”可以同时成立 | **不成立** | 两者是不同的文件交付路径，正式设计必须选定一种主合同 |

## 2. 阿里云非实时 ASR

### 2.1 调用方式

阿里云当前官方文档明确覆盖 `Qwen-Audio-3.0-ASR-Flash-Filetrans`，示例模型名为：

```text
qwen-audio-3.0-asr-flash-filetrans
```

它不是同步转写接口，而是两步异步流程：

1. 提交请求时携带 `X-DashScope-Async: enable`；
2. 提交响应返回 `PENDING`、`task_id` 和本次调用的 `request_id`；
3. 业务侧使用 `task_id` 调用 `GET /api/v1/tasks/{task_id}`，轮询到终态；
4. 任务包含子任务时，即使整体为 `SUCCEEDED`，仍要检查每个结果的 `subtask_status`。

来源：[阿里云 Qwen-Audio-3.0-ASR-Flash-Filetrans/Fun-ASR 非实时语音识别 HTTP API](https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-http-api)

### 2.2 24 小时窗口

官方说明 `transcription_url` 有效期为 24 小时；超时后既不能继续查询该任务，也不能再通过先前返回的 URL 下载结果。因此：

- `task_id` 必须在提交成功后立即持久化；
- 查询到成功后应立即下载并解析结果，不能把临时 URL 当作长期数据；
- 服务重启后要能根据持久化状态恢复轮询或结果下载；
- 超过结果窗口仍未取回时，应进入可观测的失败状态，不能静默标记完成。

### 2.3 最小持久化字段

下面是根据官方接口合同推导出的本项目最小状态，不是阿里云强制的数据表命名：

```text
provider                    aliyun_dashscope
provider_model              qwen-audio-3.0-asr-flash-filetrans
provider_task_id            恢复轮询所必需
provider_submit_request_id  供应商排障和调用追踪，强烈建议
provider_task_status
provider_subtask_status
provider_error_code / provider_error_message
submitted_at / last_polled_at / provider_end_time
result_fetch_status         PENDING | FETCHED | FAILED
result_fetched_at
```

最简单且更安全的处理是：轮询到成功后立即获取结果并写入本项目的切片事务，不长期保存带签名的 `transcription_url`。如果进程在下载前中断，只要仍在 24 小时窗口内，就使用 `provider_task_id` 重新查询并获取新的结果信息。

`request_id` 的准确边界：官方定义它为“本次调用的唯一标识符”，而查询接口真正要求的路径参数是 `task_id`。因此审核意见中“二者都必须用于状态恢复”过重；应改为“持久化 `task_id`，并保存 `request_id` 用于审计和供应商排障”。

## 3. PostgreSQL Worker 领取

PostgreSQL 官方文档说明：

- `SKIP LOCKED` 会跳过无法立即加锁的记录，可用于多个消费者访问队列型表；
- 行锁保持到事务结束；
- 官方明确不建议应用长时间保持事务打开。

因此审核意见成立：`FOR UPDATE SKIP LOCKED` 可以用于**短事务领取**，但不能在持锁事务里执行 PDF、OCR、外部 ASR 等长任务。推荐合同是：

```text
短事务：SKIP LOCKED 选中任务
  -> 写入 lease_owner、lease_until、attempt_id
  -> 提交事务并释放行锁
事务外：解析、OCR、提交或轮询 ASR
短事务：仅 attempt_id 与租约仍匹配时提交结果
```

租约字段属于本项目的可靠任务设计，并非 PostgreSQL 自带队列语义。来源：[PostgreSQL `SELECT ... SKIP LOCKED`](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE)、[PostgreSQL 显式锁与事务生命周期](https://www.postgresql.org/docs/current/explicit-locking.html)

## 4. PostgreSQL FTS 与 `pg_trgm`

### 4.1 FTS 三个对象的职责

PostgreSQL 官方定义为：

- **parser**：把原始文本拆成 token，并识别 token 类型；内置 parser 为 `pg_catalog.default`；
- **dictionary**：把 token 归一化成 lexeme，也可以过滤停用词；
- **configuration**：选择 parser，并将不同 token 类型映射到有顺序的 dictionary 列表。

`to_tsvector` 和 `to_tsquery` 都依赖具体 configuration。省略 configuration 时会使用 `default_text_search_config`，因此正式实现不应依赖部署环境中的隐式默认值，而应在索引和查询 SQL 中显式使用同一配置。

来源：[PostgreSQL 文本检索控制](https://www.postgresql.org/docs/current/textsearch-controls.html)、[Parser](https://www.postgresql.org/docs/current/textsearch-parsers.html)、[Dictionary](https://www.postgresql.org/docs/current/textsearch-dictionaries.html)、[Configuration](https://www.postgresql.org/docs/current/textsearch-configuration.html)

由此可得：设计里的 `search_vector` 只能表示一个结果列，不能说明中文如何切词、归一化、查询或排名。真实资料实验必须先确定：

- 使用的 configuration；
- 文档与查询的规范化方式；
- 具体查询函数与 AND/OR/短语策略；
- 标题、正文等字段权重；
- 排名函数、阈值和无命中规则；
- GIN/GiST 索引及对应的实际执行计划。

### 4.2 `pg_trgm` 的能力边界

`pg_trgm` 根据连续三个字符组成的 trigram 计算字符串相似度，会忽略非字母数字字符；它支持相似度操作符，以及由 GiST/GIN 加速的 `LIKE`、`ILIKE`、正则等查询。官方把它与全文检索结合使用的典型价值描述为识别拼写错误。

它不提供以下能力：

- 中文词语边界识别；
- 同义词归一化；
- “表达不同但含义相近”的语义召回；
- 针对本项目资料已经调好的相关性阈值。

此外，无法从查询中提取 trigram 的模式会退化为全索引扫描。来源：[PostgreSQL `pg_trgm`](https://www.postgresql.org/docs/current/pgtrgm.html)

所以审核提出“把真实 120 题实验提前为里程碑 0”是合理的。需要先用真实中文资料和客户问法锁定 SQL、索引和阈值，再把字段定义写成最终开发合同；不能把“可安装 `pg_trgm`”等同于“中文检索已满足要求”。

## 5. COS 预签名访问与服务端代理

腾讯 COS 官方文档确认：

- Bucket 默认私有；
- 预签名 URL 把签名放在 URL 中，拿到有效 URL 的用户可以在有效期内下载或预览对应对象；
- 应使用最小权限并将有效期设为完成操作所需的最短时间；
- `Content-Disposition: attachment`，或已签名 GET 中的 `response-content-disposition=attachment`，可要求浏览器下载而不是内联预览。

来源：[腾讯 COS 使用预签名 URL 访问对象](https://cloud.tencent.com/document/product/436/68284)、[腾讯 COS 上传与下载常见问题](https://cloud.tencent.com/document/product/436/30740)

两种路径的准确含义是：

| 路径 | 浏览器实际下载来源 | 权限特点 |
| --- | --- | --- |
| 服务端代理 | AI Call API | 每次请求都可由后端校验租户和权限，但文件流量经过应用服务 |
| 预签名 URL | COS | 后端只负责授权并签发短期地址；签发后，到期前持有该地址者可以直接访问对象 |

因此原设计“浏览器只访问 API”和“后端生成预签名读取地址”必须二选一作为主合同。若当前目标是最少组件、统一鉴权，服务端代理更符合现有表述；若选择预签名 URL，就应明确单对象、短有效期、私有 Bucket、签发前鉴权和不得写入日志。

对于用户上传的 HTML、SVG 等活动内容，建议不做内联预览，统一返回 `Content-Disposition: attachment`；PDF、图片等只按明确白名单开放预览。这里是本项目的安全策略，腾讯 COS 文档提供的是强制下载机制，而不是替应用判断文件是否可信。

## 6. 对正式设计修订的直接结论

本报告只验证外部事实，不直接修改正式设计。基于核验结果，后续修订至少应做到：

1. 把 ASR 写成可恢复的“提交、轮询、及时取回结果”状态机；
2. `task_id` 和结果获取状态列为必需，`request_id` 明确为追踪字段；
3. Worker 使用短事务领取和租约，不在数据库事务内执行外部处理；
4. 将 120 题真实中文检索实验提到数据表和最终 SQL 定稿之前；
5. 正式选定文件下载/预览是服务端代理还是预签名直连；
6. HTML、SVG 等活动内容只下载，不内联预览。

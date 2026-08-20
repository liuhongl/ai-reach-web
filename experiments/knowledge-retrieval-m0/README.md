# AI Call 知识检索里程碑 0 工程探索

状态：**可复现实验已完成，可支持受限范围的最小闭环开发；所有准确率均为探索数据，不是正式业务通过率。**

本目录只包含离线实验脚本和 PostgreSQL SQL，不修改 AI Reach 或 AI Call 业务代码。实验固定使用 PostgreSQL 词法检索。当前 6 份 PPT 是非正式宣传资料，题集为人工整理或合成问题，因此这里只验证可复现性、检索边界和安全退路，不作为开发阻塞或上线验收。

## 复跑

前提：本机已有 Docker，且可使用 `postgres:16.14-alpine`；6 份 PPT 已放入 `outputs/knowledge-retrieval-evaluation-20260818/corpus/`，120 题开发集位于 `outputs/knowledge-retrieval-evaluation-20260818/m0/benchmark.jsonl`。

```bash
python3 experiments/knowledge-retrieval-m0/run.py
shasum -a 256 -c outputs/knowledge-retrieval-evaluation-20260818/m0/manifest.sha256
```

脚本会创建一次性 PostgreSQL 容器，等待正式实例完成初始化，结束时自动删除；不会连接现有业务数据库。解析、切片和数据库加载只使用 Python 标准库、Docker 与镜像内置 `psql`。

独立合成盲测可先只验证冻结输入和合同：

```bash
python3 experiments/knowledge-retrieval-m0/run_validation.py --prepare-only
shasum -a 256 -c outputs/knowledge-retrieval-validation-20260819/m0/manifest.sha256
```

移除 `--prepare-only` 可复跑 PostgreSQL 准确率结果，但该题集已经揭盲，复跑只用于验证可重复性，不能再视为一次新的独立盲测，也不能用于调参。

## 固定输入和合同

- 语料：6 份 PPT、99 页；每个原文件的 SHA-256 在 `m0/corpus-manifest.jsonl`；
- 题集：120 题，其中 90 道 `ANSWER` 题需要检索、12 道 `CLARIFY` 题由固定产品信息判断边界、18 道无资料题由回答层转业务顾问；
- 实验处理口径：6 份 PPT 只作为工程 fixture；有来源项用于核对页面，宣传性效果表达不构成客户保证；无来源项统一为“资料暂未明确，需要业务顾问进一步沟通”；
- 无共同词改写：4 题，定义为原问题与正确来源没有共同二元字符；
- 查询合同：`raw-query+deterministic-canonicalization-v1`，原问题命中固定规则时改为短标准词，否则原样检索；规则不包含答案数值，实际标准词写入逐题结果的 `retrieval_query`；
- 解析器：`pptx-ooxml-stdlib-v1`；切片器：`pptx-slide-semantic-900-1200-v1`；
- 切片：99 个，按幻灯片保持语义和页码；最短 68、最长 861、平均 372.9 字符；
- 数据库：PostgreSQL 16.14，`pg_trgm` 1.6；详细环境见 `m0/results/postgres-environment.json`。

## 2026-08-18 开发集复跑结果

Recall@5 只按 90 道运行时确实需要知识检索的 `ANSWER` 题计算。12 道跨产品 `CLARIFY` 题必须在 Realtime 回答集单独验证，不能用检索召回代替产品边界判断。

| PostgreSQL 词法候选 | Top 5 命中 | Recall@5 | 高风险命中 | 无共同词命中 |
| --- | ---: | ---: | ---: | ---: |
| 确定性标准词 + 加权 n-gram `tsvector` | 90/90 | 100% | 21/21 | 4/4 |
| 原始字符 n-gram 数组相交 | 77/90 | 85.56% | 19/21 | 0/4 |
| 原始加权 n-gram `tsvector` + GIN | 77/90 | 85.56% | 19/21 | 0/4 |
| 清洗查询字符 n-gram | 75/90 | 83.33% | 18/21 | 0/4 |
| `pg_trgm` | 43/90 | 47.78% | 9/21 | 1/4 |

`lexical_v2` 是在本开发集上调出的实验候选，不是生产 SQL，90/90 也不是业务通过率。最终单连接、全量预热、每个场景固定 5 题并重复 2 轮的本机延迟为：

| 冻结切片数 | 样本数 | P50 | P95 |
| ---: | ---: | ---: | ---: |
| 100 | 60 | 53.160 ms | 97.863 ms |
| 500 | 60 | 241.693 ms | 448.783 ms |
| 1,000 | 60 | 497.863 ms | 903.332 ms |
| 2,000 | 60 | 1,188.404 ms | 2,040.799 ms |

当前 6 份 PPT 合计 99 个切片，单份为 12–24 个。500–2,000 档位由脚本循环复制当前切片生成，只作为扩容观察。

## 2026-08-19 目标主机容量复测

[`target-latency.sql`](./target-latency.sql) 在已经部署 Phase J1 知识表和词法函数的 PostgreSQL 上事务内生成 100/500 切片，每档预热 5 次后记录 100 次，输出汇总后整体回滚。它不包含主机、账号或密码；调用方通过标准输入交给目标环境的 `psql`：

```bash
psql "$DATABASE_URL" -X -f experiments/knowledge-retrieval-m0/target-latency.sql
```

118 PostgreSQL 16.14 的单连接、热缓存结果为：

| 冻结切片数 | 样本数 | 平均 | P50 | P95 | 最大 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 100 | 42.841 ms | 42.646 ms | 43.372 ms | 48.476 ms |
| 500 | 100 | 195.603 ms | 195.424 ms | 197.644 ms | 199.262 ms |

测试后已确认 `tenant_id = 'm0-benchmark'` 的切片为 0。该测试不包含并发、冷缓存、Qwen 生成或音频首包；由于现有实验资料已有 99 个切片，当前部署上限改为 500，超过时拒绝创建任务，不静默截断。端到端上线时延仍按设计文档第 16 节单独验收。

[`target-concurrency-latency.sh`](./target-concurrency-latency.sh) 使用同一生产查询，在独立测试租户中临时提交 500 个合成切片，通过 PostgreSQL 自带的 `pgbench` 固定执行 1、5、10 并发；脚本退出时精确删除测试条目、版本和切片。118 实测结果为：

```bash
PGUSER=ai_call PGDATABASE=ai_call \
  experiments/knowledge-retrieval-m0/target-concurrency-latency.sh
```

| 模式 | 并发 | 样本数 | 平均 | P50 | P95 | 最大 | TPS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 未显式预热的首次查询 | 1 | 1 | 200.146 ms | 200.146 ms | 200.146 ms | 200.146 ms | 4.995 |
| 热缓存 | 1 | 100 | 195.940 ms | 195.503 ms | 198.422 ms | 203.502 ms | 5.103 |
| 热缓存 | 5 | 100 | 206.943 ms | 206.266 ms | 211.292 ms | 222.872 ms | 24.038 |
| 热缓存 | 10 | 100 | 255.597 ms | 249.023 ms | 276.079 ms | 283.085 ms | 37.111 |

首次查询只证明“没有执行显式预热”；插入过程可能已经把相关页带入 PostgreSQL 共享缓存，因此不能命名为真正冷缓存。清空共享缓存或操作系统页缓存会影响同机服务，本次没有在 118 共享 PostgreSQL 上执行。脚本结束后已确认测试租户的条目、版本和切片均为 0。

## 2026-08-19 目标主机 PPTX 冒烟

[`target-pptx-ingestion-smoke.py`](./target-pptx-ingestion-smoke.py) 在已配置 COS、PostgreSQL、Knowledge Worker 和隔离解析 Socket 的 API 容器内调用同一上传服务。使用现有 `Sales in 出海获客智能体产品介绍@灵宸智能(1).pptx` 时，真实 COS 上传后约 8 秒进入 `READY`，生成 17 个带第 1～17 页引用的切片；查询“哪些客户更值得跟进”首条命中第 7 页和 `slides/7`。同一文件通过本地 `8079` 登录态页面上传后约 2 秒显示“可用”，详情显示 v1、3.7 MB 和 17 个切片。另一次目标机直连解析使用 DeepLaw 文件生成 27 个连续页码切片，伪装为 PPTX 的非 ZIP 文件被拒绝。

脚本只硬删除本次生成的条目、版本、切片和 COS 原文件；页面 fixture 先按产品合同软删除，再按唯一备注和文件名清理保留数据。执行后页面和相关数据库记录均为 0，API、解析容器和 PostgreSQL 均保持 `healthy`。它验证的是目标机工程链路，不把这些宣传资料当作正式业务真值。

租户、冻结版本和 `READY` 状态检查全部通过。三个经语料逐块验证、没有共同二元字符的控制问题均返回零候选。18 道业务相关但资料无答案的问题可能检索到相关候选，回答层仍必须拒绝承诺并转业务顾问。

同日完成本地 `8079` 登录态下对 118 的只读页面复验。开发代理依赖的 `127.0.0.1:19013` 转发缺失时，健康请求和页面刷新稳定返回 `504`；恢复 `19013 -> 118:19011` 后，同一健康请求返回 `200`。提示词场景列表、通用提示词、历史版本和知识资产列表对应的服务器请求均返回 `200`，页面显示 5 个提示词场景和空知识列表。本次没有保存、上传或外呼；该结果只证明当前部署和鉴权读取链路可用，不增加里程碑 0 的检索质量证据。

## 2026-08-19 独立合成题观察

在 `retrieval.sql`、`run.py`、99 个切片和开发集哈希已经冻结后，生成了另一份 120 题合成题集并一次性执行。题集与开发集没有相同问题，最大二元字符 Jaccard 为 0.3333；它不包含真实客户原话。

| 候选 | Top 5 命中 | Recall@5 | 高风险命中 | 无共同词命中 |
| --- | ---: | ---: | ---: | ---: |
| 冻结 `lexical_v2` | 76/90 | 84.44% | 28/34 | 0/13 |

这些数字不判定开发通过或失败。14 条未命中中，13 条属于问法与正确资料页无共同二元字符，说明固定词法规则对此类表达没有可靠桥梁；`VDOC-011` 暴露固定“业务场景”改写过宽，导致命中错误标准词。该题集只保留为回归证据；审核工作簿见 [`knowledge-retrieval-validation-results.xlsx`](../../outputs/knowledge-retrieval-validation-20260819/knowledge-retrieval-validation-results.xlsx)，逐题原始证据见 [`outputs/knowledge-retrieval-validation-20260819/m0/`](../../outputs/knowledge-retrieval-validation-20260819/m0/)。

## 上线前仍需补充的证据

1. 业务确认后的正式资料，以及覆盖实际上线场景的真实问题或脱敏客户话术；
2. 目标 PostgreSQL 主机的 500 切片 1、5、10 固定并发热缓存复测已完成；真正冷缓存和无检索/有检索通话对照仍需在不影响共享服务的维护窗口或隔离环境完成；
3. PPTX 的生产解析器、切片器和页码引用已经完成目标机验收；其他文件格式只在实际需要时逐一实现和验收。

`run-summary.json` 中的 `milestone_0_status = BLOCKED` 是按旧草案固定阈值生成的原始实验字段，为保持证据可追溯不改写；它不再代表当前开发结论。当前允许按安全回答边界进入最小闭环开发，部署上限为 `max_frozen_chunks_per_task = 500`，正式资料和端到端环境证据在上线前补齐。

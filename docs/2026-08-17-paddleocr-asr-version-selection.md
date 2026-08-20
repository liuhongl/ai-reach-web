# PaddleOCR 与音视频 ASR 版本选型（2026-08-17）

## 结论

1. 当前稳定版分别是 `paddleocr==3.7.0` 与 `paddlepaddle==3.3.1`，但 Linux amd64 CPU、Python 3.12 的保守部署候选应先固定为 `paddleocr==3.7.0` + `paddlepaddle==3.2.2`。原因是官方仓库仍有 `3.3.0/3.3.1` 在该环境触发 oneDNN/PIR `NotImplementedError` 的未关闭报告，而 `3.2.2` 是报告给出的回退版本；这是一项工程规避，不是官方认证组合。[PaddleOCR #18162](https://github.com/PaddlePaddle/PaddleOCR/issues/18162) · [Paddle #77340](https://github.com/PaddlePaddle/Paddle/issues/77340)
2. 新建的知识库音视频入库链路，默认模型改为 `qwen-audio-3.0-asr-flash-filetrans`。它在 Qwen3 FileTrans 的文件时长、大小和时间戳能力基础上，增加热词、Prompt 上下文和说话人分离，更适合产品名、行业术语和多人资料；Qwen3 的情绪识别对知识入库没有必要。现有通话录音离线 ASR 暂不全局切换，先用真实录音完成 A/B 回归。[阿里云 ASR 选型总览](https://help.aliyun.com/zh/model-studio/asr-model/)
3. 如果必须本地 ASR，最小可行中文方案推荐 `funasr==1.4.2` + Paraformer-zh + FSMN-VAD；需要可读段落时再加 CT-PUNC。Paraformer 是 220M 参数的中文/英文模型，支持时间戳和热词，官方明确支持 CPU；它比 Qwen3-ASR + ForcedAligner 更符合“Linux CPU、中文、时间戳、少组件”的约束。[FunASR PyPI](https://pypi.org/project/funasr/) · [FunASR 选型指南](https://github.com/modelscope/FunASR/blob/main/docs/model_selection.md)
4. PaddleOCR 只解决图片/PDF 页面中的文字与结构提取，不是 ASR。音视频转写必须走独立 ASR 链路；不要因为两者都属于知识入库而把运行时或模型混成一个服务。[PaddleOCR 项目说明](https://pypi.org/project/paddleocr/)

## 1. PaddleOCR / PaddlePaddle 固定组合

| 项目 | 截至 2026-08-17 的稳定版 | Python 3.12 / Linux amd64 证据 | 建议 |
| --- | --- | --- | --- |
| PaddleOCR | `3.7.0`，2026-06-11 发布 | `Requires-Python >=3.8`，PyPI 分类器包含 Python 3.12；wheel 为 `py3-none-any` | 固定 `paddleocr==3.7.0` |
| PaddlePaddle CPU | 当前稳定版 `3.3.1`；部署回退候选 `3.2.2` | 两版均有 CPython 3.12 / Linux x86_64 wheel；官方安装指南支持 Python 3.9–3.13、64 位 x86_64 与 Ubuntu 20.04/22.04/24.04 | 当前目标先固定 `paddlepaddle==3.2.2`，实测确认 3.3.x 修复进入正式 wheel 后再升级 |

来源：[PaddleOCR PyPI](https://pypi.org/project/paddleocr/)、[PaddlePaddle PyPI](https://pypi.org/project/paddlepaddle/)、[PaddlePaddle 3.2.2 PyPI](https://pypi.org/project/paddlepaddle/3.2.2/)、[PaddlePaddle 安装指南](https://www.paddlepaddle.org.cn/documentation/docs/en/install/index_en.html)。

推荐安装：

```bash
python -m pip install "paddlepaddle==3.2.2" -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
python -m pip install "paddleocr==3.7.0"
python -c "import paddle; paddle.utils.run_check(); print(paddle.__version__)"
```

### 为什么仍需目标机冒烟测试

- PaddleOCR 3.7 的官方兼容表只要求 PaddlePaddle `>=3.0.0`，因此 `3.2.2` 在声明范围内；但没有一张明确认证 `3.7.0 + 3.2.2 + Python 3.12 + Linux CPU` 的测试矩阵。[PaddleOCR/PaddleX 兼容表](https://www.paddleocr.ai/v3.7.0/en/version3.x/paddleocr_and_paddlex.html)
- 不能直接采用“最新 + 最新”：官方 PaddleOCR 仓库有 `3.7.0 + 3.3.1 + Python 3.12 + Linux CPU` 的未关闭 oneDNN/PIR 报错，PaddlePaddle 仓库的 `3.3.0` 同类问题明确记录 `3.2.2` 可作为 workaround。修复是否已经进入后续正式 wheel 未获一手资料确认。[PaddleOCR #18162](https://github.com/PaddlePaddle/PaddleOCR/issues/18162) · [Paddle #77340](https://github.com/PaddlePaddle/Paddle/issues/77340)
- PaddleOCR 当前快速开始页仍展示 `paddlepaddle==3.2.0`，PaddlePaddle 当前安装页展示 `3.3.0`，说明文档示例与最新 PyPI artifact 并不同步；版本号本身不能代替目标机推理验收。[PaddleOCR 快速开始](https://www.paddleocr.ai/main/en/quick_start.html) · [PaddlePaddle 安装指南](https://www.paddlepaddle.org.cn/documentation/docs/en/install/index_en.html)
- 官方要求 CPU 支持 MKL、系统和 Python 均为 64 位。目标机还要实际验证模型下载、一次中文图片推理、进程峰值内存及冷启动时间。[PaddlePaddle 安装指南](https://www.paddlepaddle.org.cn/documentation/docs/en/install/index_en.html)
- 只做普通 OCR 时不要先装 `paddleocr[all]`；文档解析、信息抽取等可选能力应按实际管线再加，避免无关依赖。[PaddleOCR 安装说明](https://www.paddleocr.ai/main/en/version3.x/installation.html)

## 2. 知识库 ASR：Qwen-Audio 3.0 与 Qwen3 怎么选

结论是：**知识库新链路使用 `qwen-audio-3.0-asr-flash-filetrans`，现有通话录音链路先保留 `qwen3-asr-flash-filetrans`。** 两者都支持最长 12 小时、最大 2 GB 的单个文件和句级毫秒时间戳；新模型增加热词、最多 400 字的 Prompt 上下文与说话人分离，官方也将其列为通用文件转写首选。旧模型的独有优势是情绪识别，但知识 RAG 不消费情绪标签。[模型对比与选型](https://help.aliyun.com/zh/model-studio/asr-model/) · [非实时语音识别指南](https://help.aliyun.com/zh/model-studio/non-realtime-speech-recognition-user-guide)

| 对比项 | `qwen-audio-3.0-asr-flash-filetrans` | `qwen3-asr-flash-filetrans-2025-11-17` |
| --- | --- | --- |
| 热词、业务上下文 | 支持 | 不支持 |
| 说话人分离 | 支持 | 不支持 |
| 情绪识别 | 不支持 | 支持 |
| 知识库适配 | **推荐**：产品名、行业术语、访谈/会议资料 | 可用，但专有名词增强能力不足 |
| 当前模型标识 | 官方目前只列稳定别名，未列可固定快照 | 有固定快照 |

知识库首版建议只使用三项最小配置：`language_hints=["zh"]`；从场景/产品配置生成一小组经过整理的热词；用不超过 400 字的短上下文说明产品和行业。`diarization_enabled` 默认关闭，只有会议、访谈等多人资料才打开；如果打开，切片数据也必须保存 `speaker_id`，否则开启没有意义。[Qwen-Audio 3.0 FileTrans HTTP API](https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-http-api)

建议的入库链路：

```text
上传原文件 -> 私有腾讯云 COS -> 生成限时、外网可读取 URL
          -> 提交 FileTrans，保存 task_id
          -> 回调（优先）或低频轮询
          -> 下载结果 JSON并立即持久化
          -> 按时间戳切片 -> Embedding / 索引
```

必须处理的边界：

- API 只接受公网可访问 URL，不接受本地文件直接上传。知识库使用私有腾讯云 COS，Worker 需要为派生音频生成在任务取件期间有效、且阿里云可访问的短时预签名 GET；必须在当前部署网络实测，不能把“对象已上传”当成“ASR 已可读取”。[调用约束](https://help.aliyun.com/zh/model-studio/non-realtime-speech-recognition-user-guide)
- 单次只处理 1 个 URL；模型不流式返回，任务完成后一次性给结果。结果文件 `transcription_url` 默认只在 24 小时内有效，worker 必须及时下载并存入自己的数据库/对象存储。[异步任务与结果下载](https://help.aliyun.com/zh/model-studio/non-realtime-speech-recognition-user-guide)
- 高并发时官方建议 EventBridge 回调而不是密集轮询；回调必须验签并按 `task_id` 幂等消费。[生产回调建议](https://help.aliyun.com/zh/model-studio/non-realtime-speech-recognition-user-guide)
- 不能只修改模型字符串：Qwen-Audio 3.0 请求使用 `input.file_urls`，结果位于 `output.results[]`；Qwen3 请求使用 `input.file_url`，结果位于 `output.result`。后端要增加独立 provider 分支并做契约测试。[Qwen-Audio 3.0 FileTrans HTTP API](https://help.aliyun.com/zh/model-studio/fun-asr-recorded-speech-recognition-http-api) · [非实时语音识别指南](https://help.aliyun.com/zh/model-studio/non-realtime-speech-recognition-user-guide)
- Qwen-Audio 3.0 当前官方资料只列稳定别名，没有可固定的快照 ID。每次任务必须保存模型名、请求参数、DashScope `request_id` 和处理时间；供应商别名升级后，用固定样本重新回归，不能伪造一个不存在的快照版本。
- 上线前用 20–50 个真实样本 A/B：重点比较产品名/金额/单位/英文缩写召回、人工纠错率、多人区分、耗时、失败率和成本。通过后只切知识库 ASR；通话录音 ASR 是否迁移另行验收。

## 3. 本地 ASR 候选比较

| 候选 | 中文与时间戳 | CPU / GPU | Python 3.12 | 结论 |
| --- | --- | --- | --- | --- |
| FunASR + Paraformer-zh | 中/英，220M；原生 ASR 时间戳，官方选型指南建议中文生产、字符级时间戳或热词场景使用 | 明确支持 `device="cpu"`；GPU 可选。长音频搭配 0.4M FSMN-VAD | FunASR PyPI 分类器包含 3.12 | **首选本地 MVP** |
| FunASR + SenseVoiceSmall | 中/英/日/韩/粤，234M；通过 VAD 管线得到段级时间戳，还支持情感/事件 | 官方把它作为 CPU 和多语种的默认候选 | FunASR 同上 | 多语种优先时的备选；若要字符级时间戳/热词，仍选 Paraformer |
| Qwen3-ASR-0.6B + ForcedAligner-0.6B | ASR 覆盖 52 种语言/方言；时间戳必须再加载 0.6B ForcedAligner，后者单段对齐上限 5 分钟、覆盖 11 种语言 | 官方示例和 Docker 均以 CUDA、BF16、vLLM/Transformers 为主；没有给出可接受的 CPU 吞吐与最低内存 | 官方提供 Python 3.12 环境示例 | 中文复杂语音可作为 GPU 评测项，不是当前 CPU 最小方案 |
| OpenAI Whisper / whisper.cpp | 多语种；支持段级时间戳和可选词级时间戳。`small` 为 244M | OpenAI CLI 可自动落到 CPU；whisper.cpp 明确支持 CPU-only，`small` 官方列出的内存约 852 MB | OpenAI Whisper 项目声明支持 3.12 | 跨语言/低依赖 C++ 备选；中文准确率与 CPU 实时率需用本项目语料实测 |
| PaddleSpeech 1.5.0 | 有中文 ASR 能力 | 1.5.0 主要完成对 Paddle 3.0.0-beta 的适配 | PyPI 仅列 Python 3.8/3.9/3.10 分类器，未声明 3.12 | 不作为本次 Python 3.12 新部署首选 |

来源：[FunASR 1.4.2 与模型清单](https://pypi.org/project/funasr/)、[FunASR 选型指南](https://github.com/modelscope/FunASR/blob/main/docs/model_selection.md)、[Paraformer 官方 ModelScope 模型卡](https://www.modelscope.cn/models/iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch)、[FSMN-VAD 官方模型卡](https://www.modelscope.cn/models/iic/speech_fsmn_vad_zh-cn-16k-common-pytorch/summary)、[Qwen3-ASR 官方仓库](https://github.com/QwenLM/Qwen3-ASR)、[OpenAI Whisper](https://github.com/openai/whisper)、[whisper.cpp](https://github.com/ggml-org/whisper.cpp)、[PaddleSpeech PyPI](https://pypi.org/project/paddlespeech/)、[PaddleSpeech 1.5.0 发布说明](https://github.com/PaddlePaddle/PaddleSpeech/releases/tag/r1.5.0)。

### 推荐的本地固定基线

```text
funasr==1.4.2
ASR:  iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch @ v2.0.4
VAD:  iic/speech_fsmn_vad_zh-cn-16k-common-pytorch @ v2.0.4
PUNC: iic/punc_ct-transformer_zh-cn-common-vocab272727-pytorch @ v2.0.4（需要标点时启用）
device=cpu
```

完整模型 ID 与 `model_revision="v2.0.4"` 组合来自 Paraformer 官方 ModelScope 模型卡；FunASR 1.4.2 于 2026-08-14 发布，修复了带时间戳词与标点边界的字幕分段问题。[Paraformer 模型卡](https://www.modelscope.cn/models/iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch) · [FunASR PyPI](https://pypi.org/project/funasr/)

PyTorch 与 torchaudio 必须从 PyTorch 官方 CPU 安装渠道选择互相匹配的 wheel。当前一手资料没有给出“FunASR 1.4.2 + Python 3.12 + 任意 Linux 发行版”的单一认证 Torch 固定组合，因此不要在未做目标机解析和推理测试前硬写一个通用版本号；冒烟通过后再把实际 wheel 版本与哈希写入部署锁文件。[FunASR 安装要求](https://pypi.org/project/funasr/)

## 4. 仍未知、上线前必须实测

- Paddle：在目标 Linux amd64/Python 3.12 上完成安装、`paddle.utils.run_check()`、一张中文图片的 OCR，以及冷启动/峰值 RSS 测量。
- 云 ASR：验证签名 URL 可达与有效期、回调验签和重复投递、结果 URL 24 小时内落盘、超时/失败重试、文件删除与数据合规策略。
- 模型质量：用 20–50 个真实样本覆盖长短音频、噪声、多人重叠、方言、产品名/人名/金额；同时记录 CER/人工纠错率、时间戳偏差、处理时长、峰值内存和失败率。该样本规模与记录项来自 FunASR 官方选型指南。[FunASR 评测建议](https://github.com/modelscope/FunASR/blob/main/docs/model_selection.md)
- 本地容量：官方资料未给出适用于当前服务器 CPU 型号的确定并发、峰值 RAM 或实时率承诺；Paraformer 模型文件约 889 MB、VAD 约 4 MB，但模型文件大小不等于运行内存。[Paraformer 模型卡](https://www.modelscope.cn/models/iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch) · [FSMN-VAD 模型卡](https://www.modelscope.cn/models/iic/speech_fsmn_vad_zh-cn-16k-common-pytorch/summary)
- 模型产物：本地模型应保留 revision、文件校验和、FunASR/PyTorch/torchaudio 版本及 CPU 型号；Qwen-Audio 3.0 当前只有云端稳定别名，因此应保存完整请求审计并在别名更新后做固定样本回归。

最终建议：先用 `qwen-audio-3.0-asr-flash-filetrans` 完成知识库“上传—异步转写—时间戳切片—索引”的闭环，同时用同一批样本旁路评测本地 Paraformer。只有当数据出域、成本或吞吐指标明确要求自托管时，再把本地方案升为主链；不需要先部署 Qwen3-ASR 的 GPU 栈。

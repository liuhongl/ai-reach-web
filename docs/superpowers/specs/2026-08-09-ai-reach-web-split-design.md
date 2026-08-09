# AI Reach Web 独立项目拆分设计

## 1. 背景与目标

当前 AI Call 前端功能位于 `recov-ai-web-react`，与 Recov 的登录、布局、菜单和通用组件共用同一项目。目标是把 Recov 左侧菜单中的整个 **AI Call** 模块拆为独立前端项目：

- 新仓库：`/Users/liuhongli/Desktop/lingchen/ai-reach-web`
- 正式主域名：`https://reach.lingchen-ai.com`
- `https://www.reach.lingchen-ai.com`：仅跳转到正式主域名
- 现有 AI Call 后端：`ed81/ai-call`
- 用户、租户和权限数据：继续使用现有 RuoYi 体系
- 登录方式：两个前端分别登录，不做 SSO，不共享浏览器会话

拆分完成后，`ai-reach-web` 与 Recov 可以独立开发、构建、发布和回滚。

## 2. 范围

### 2.1 新项目保留的完整模块

以下 13 个菜单入口及其列表、详情、弹窗、深链、状态操作、测试和接口代码全部迁入新项目：

| 菜单 | 路由 | 前端权限 |
| --- | --- | --- |
| 外呼任务 | `/ai-call/tasks` | `ai_call:agent:manage` |
| 通话记录 | `/ai-call/records` | `ai_call:agent:manage` |
| 音色管理 | `/ai-call/voices` | `ai_call:voice:manage` |
| 线路配置 | `/ai-call/lines` | `ai_call:agent:manage` |
| 呼叫规则 | `/ai-call/rules` | `ai_call:agent:manage` |
| 跟进处理 | `/ai-call/follow-ups` | `ai_call:agent:console` |
| 跟进总览 | `/ai-call/follow-up-overview` | `ai_call:agent:manage` |
| 外呼统计 | `/ai-call/statistics` | `ai_call:agent:manage` |
| 坐席工作台 | `/ai-call/agent-workbench` | `ai_call:agent:console` |
| 坐席管理 | `/ai-call/agents` | `ai_call:agent:manage` |
| 转人工记录 | `/ai-call/handoffs` | `ai_call:agent:manage` |
| 通话测试台 | `/ai-call-lab/customer` | `ai_call:lab:use` |
| 提示词配置 | `/ai-call-lab/prompt-config` | `ai_call:prompt:manage` |

外呼任务的创建页 `/ai-call/tasks/create` 和详情页 `/ai-call/tasks/:taskId` 作为“外呼任务”的子路由保留。旧别名 `/agent-workbench` 不迁移。

根路径 `/` 跳转到当前用户第一个有权限访问的 AI Call 页面；没有任何 AI Call 权限时显示 403。

### 2.2 本次不处理的内容

以下 Recov 业务继续保留，不迁移、不删除、不改变行为：

- `src/pages/recov/intelligentOutbound`
- 催收策略中的 `ai_call` 流程节点
- 数据洞察中的 AI 通话反馈和时间线
- Recov 流程轨迹、运行控制及其他业务模块

本次不做 SSO、不迁移后端业务数据、不替换 AI Call 后端、不升级前端主框架版本。

## 3. 项目构造方案

新项目采用“从现有 Recov 提取最小基础壳”的方式，不完整复制 Recov，也不使用最新版脚手架重新实现。

迁移源以 `recov-ai-web-react` 当前磁盘文件为准，包括尚未提交但属于 AI Call 的最新修改。迁移过程不覆盖、不重置、不清理原工作区的未提交内容。

新项目保持迁移时的以下技术基线：

- Umi Max 4
- React 与 TypeScript
- Ant Design 6
- ProComponents 3
- `@microsoft/fetch-event-source`
- `livekit-client`
- npm 与 `package-lock.json`

只迁入 AI Call 实际使用的依赖，不保留 Recov 专用页面、服务和构建配置。

## 4. 前端架构

### 4.1 基础能力

新项目保留并裁剪以下能力：

- `/user/login` 登录页
- RuoYi Token 存取、请求封装、响应解包和 401 处理
- 当前用户信息与权限加载
- 超级管理员动态租户切换
- 用户菜单与退出登录
- AI Call 固定菜单及权限过滤
- 403、404 和运行时错误页面

不迁移 Recov 的工作区菜单、业务通知中心、流程浮层和非 AI Call 全局副作用。AI Call 菜单由新项目固定维护，通过当前用户的权限字符串决定可见性和路由访问。

### 4.2 页面与专用服务

迁移当前 `src/pages/aiCall*`、`src/pages/agentWorkbench` 以及对应的 AI Call 专用 service、领域类型、样式和测试。

通用组件采用最小复制，不建立两个仓库之间的源码依赖。已确认需要的组件包括：

- 列表页基础布局
- 指标图标
- 表格操作收纳
- 删除二次确认

迁移后组件改为新项目内的通用路径，不保留 `@/pages/recov/...` 导入。

## 5. 登录、租户与权限

### 5.1 独立登录

新站通过同源 `/dev-api/auth/login` 调用现有 RuoYi 登录接口。Token 保存在 `reach.lingchen-ai.com` 自己的 LocalStorage 中，因此用户即使已经登录 Recov，进入新站仍需登录一次。

第一阶段沿用现有 Recov 前端使用的 RuoYi `clientId`，不新增 OAuth 客户端、不改变账号和租户数据。后续只有在需要独立客户端审计或独立令牌策略时，才单独立项拆分 `clientId`。

登录后调用现有用户信息接口获取：

- 用户 ID 与显示名称
- 角色
- 权限字符串
- 租户上下文

超级管理员继续通过现有动态租户接口切换租户。普通用户使用登录 Token 中的租户，不显示租户切换控件。

### 5.2 前端权限

菜单按钮和路由按第 2.1 节的权限映射控制。`*:*:*` 继续代表超级权限。直接访问无权限路由时显示 403，不以“隐藏菜单”代替路由校验。

### 5.3 后端权限上线门槛

现状中音色接口已明确校验 `ai_call:voice:manage`，多数其他 AI Call 接口主要校验登录和租户。正式对外上线前，`ed81/ai-call` 必须按调用方补齐服务端权限校验：

- 任务、记录、统计、线路、规则和管理端接口：`ai_call:agent:manage`
- 坐席在线、接管、跟进处理和坐席事件流：`ai_call:agent:console`
- 音色写操作：`ai_call:voice:manage`
- 通话测试台会话操作：`ai_call:lab:use`
- 提示词新增、修改和预览：`ai_call:prompt:manage`
- 任务创建需要读取的提示词和音色列表：允许对应管理权限进行只读访问
- 超级权限 `*:*:*`：允许访问全部 AI Call 接口

所有业务接口继续执行租户隔离。前端权限控制不能替代服务端校验。

## 6. API、SSE、媒体与录音链路

### 6.1 同源代理

浏览器只访问新站同源路径：

| 前缀 | 用途 | 上游 |
| --- | --- | --- |
| `/dev-api` | 登录、用户、租户和权限 | 现有 RuoYi 后端 |
| `/ai-call-agent-api` | AI Call 任务、记录、坐席、Lab 和 SSE | 现有 `ed81/ai-call` |

开发环境端口使用 `8078`，避免影响当前 Recov 的 `8077`。开发代理延续现有路径去前缀规则。

### 6.2 请求与异常处理

同一个 RuoYi Bearer Token 同时发送给两个代理前缀。请求层保留 `clientid`、语言头、重复提交保护、加密登录和统一响应解包。

所有 AI Call 接口，包括通话测试台和提示词接口，都必须通过统一的 RuoYi 请求封装访问并携带 Bearer Token。现有 `ai-call-lab` service 直接使用 Umi `request`、未统一附加 Token 的写法不迁入新项目；迁移时改为使用统一请求封装和 `/ai-call-agent-api` 基础路径。

- 401：停止本站 SSE，清除本站 Token，跳转 `/user/login` 并保存安全的回跳地址
- 403：显示无权限状态，不清除有效登录
- 409：显示后端状态冲突原因，不伪造成功状态
- 5xx 或网络错误：显示可重试错误，不把网络失败当作业务终态
- 异步动作：只提示“已受理”，通过轮询或后续状态确认最终结果

### 6.3 SSE 与轮询

坐席事件流继续使用 `/ai-call-agent-api/ai-call/agent-console/events`。Nginx 对该路径关闭响应缓冲并设置长连接超时。

SSE 断开时保留现有轮询降级；页面隐藏、组件卸载或进入终态后停止无意义轮询。401/403 不进行无限重连。

### 6.4 浏览器通话

LiveKit 地址和短期 Participant Token 继续由 AI Call 后端签发。新站必须使用 HTTPS，才能稳定使用麦克风、WebRTC、通知和音频播放能力。

浏览器不保存 LiveKit 长期密钥，也不在构建产物中写入服务端 Secret。

### 6.5 录音、对话与质检

录音继续使用后端返回的签名播放地址。浏览器不直接访问 MinIO 或对象存储凭证。通话详情保留：

- 录音播放
- 对话文本与说话方展示
- 语义分析及重新分析
- AI 质检评分与人工质检
- 跟进审核和跟进详情
- 转人工记录

签名地址失效时重新请求录音详情，不缓存为永久 URL。

## 7. Recov 移除边界

只有在新项目通过验收后，才从 Recov 移除以下内容：

- AI Call 菜单组及其前端注入逻辑
- 第 2.1 节对应的路由与旧坐席工作台别名
- `src/pages/aiCall*`
- `src/pages/agentWorkbench`
- AI Call 专用 service、样式、Mock 和测试
- 经引用检查确认已无调用方的 `/ai-call-agent-api` 开发代理配置

不删除第 2.2 节列出的 Recov 业务代码。移除前必须重新进行全仓引用扫描，避免误删仍由 Recov 使用的通用组件或接口。

Recov 不保留跳转到新站的旧菜单或兼容页面。

## 8. 实施阶段

### 阶段一：建立独立项目

1. 在空仓库中建立最小 Umi 项目结构并锁定当前依赖版本。
2. 迁入登录、请求、用户、租户和权限基础能力。
3. 建立固定 AI Call 菜单和路由。
4. 迁入 13 个入口及全部子页面、service、样式和测试。
5. 修正 Recov 专用导入，使新项目内部依赖闭合。

### 阶段二：独立验证

1. 运行 TypeScript、单元测试和生产构建。
2. 在 `8078` 启动新站，分别验证两个 API 前缀。
3. 使用不同权限账号验证菜单、路由和按钮。
4. 验证租户切换后的列表刷新与租户隔离。
5. 验证 SSE、录音、对话、质检、跟进和浏览器媒体能力。

验证期间不发起真实客户外呼。任何真实通话验证均需用户另行明确授权。

### 阶段三：部署新站

1. 为 `reach.lingchen-ai.com` 配置独立静态目录和 Nginx server。
2. 配置 `/dev-api` 与 `/ai-call-agent-api` 上游代理。
3. 安装覆盖 `reach.lingchen-ai.com` 和 `www.reach.lingchen-ai.com` 的 HTTPS 证书。
4. 将 `www.reach.lingchen-ai.com` 重定向到 `https://reach.lingchen-ai.com`。
5. 验证 Host、SNI、静态资源、SPA 深链和两个上游接口。

### 阶段四：清理 Recov

1. 冻结新站验收版本。
2. 从 Recov 删除第 7 节明确列出的代码。
3. 运行 Recov 类型检查、相关单元测试和生产构建。
4. 浏览器验证 Recov 其他菜单和第 2.2 节业务仍正常。

## 9. 验收标准

完成必须同时满足：

- 新仓库具有独立 Git 历史、依赖锁文件和构建产物
- 13 个 AI Call 菜单入口均可按权限访问
- 登录、退出、401、403 和安全回跳行为正确
- 普通租户不能读取其他租户数据
- 超级管理员切换租户后，菜单和页面数据同步刷新
- 任务、记录、音色、线路、规则、统计、坐席、跟进和 Lab 页面通过功能验收
- SSE 正常连接，异常时能降级且不会无限重连
- 录音、对话、语义分析和质检链路可用
- 页面刷新和直接访问深链不会返回 Nginx 404
- `reach` 与 `www.reach` 的 HTTPS 行为符合第 8 节约定
- Recov 不再出现 AI Call 菜单和专用路由
- Recov 的 `intelligent-outbound` 等非本次范围业务保持原状
- 前后端权限校验满足第 5.3 节要求

## 10. 回滚

新站与 Recov 独立发布：

- 新站失败：回滚 `ai-reach-web` 静态目录或 Nginx server，不影响 Recov
- Recov 清理失败：回滚 Recov 静态版本，AI Call 新站继续独立运行
- 后端权限改造失败：回滚后端版本，新站不得在服务端权限缺失的状态下正式对外开放

回滚不删除任务、通话、录音、质检或跟进数据。

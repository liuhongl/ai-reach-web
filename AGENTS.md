# AGENTS.md

本文件约束后续在 AI Reach Web 中工作的编码代理。

## 沟通与原则

- 所有回复使用中文，并称呼用户为「[利哥]」。
- 先核对事实再修改；保持外科手术式改动，不顺手重构无关代码。
- 只实现已确认需求，不添加预留架构、重复文档或未使用配置。

## 开始工作前

先执行并确认：

```bash
pwd
git status --short --branch
git worktree list --porcelain
```

- 确认当前目录是 `/Users/liuhongli/Desktop/lingchen/ai-reach-web`，不要误改 Recov 或 AI Call 后端工作区。
- 本地前端端口为 `8078`；验证前确认监听进程确实来自本项目。
- 修改代理或环境配置后必须重启开发服务，不能用旧进程验收新配置。
- 保留用户已有未提交改动；遇到重叠修改时先说明，不得覆盖或清理。

## 项目边界

- 本项目只维护独立 AI Call 前端及必要的 RuoYi 登录、租户、权限、偏好和通知壳层。
- 不迁回 Recov 的其他业务页面，也不为了兼容旧入口保留重复 AI Call 页面。
- `/dev-api` 属于 RuoYi；`/ai-call-agent-api` 属于 AI Call；`/ai-call-oss` 属于对象存储；`/livekit` 属于浏览器音频。不得混用代理前缀。
- RuoYi 通知 SSE 与 `/ai-call-agent-api/ai-call/agent-console/events` 坐席 SSE 是两条独立链路。
- 前端路由权限定义在 `config/routes.ts`；后端仍必须执行权限校验和租户隔离。
- Recov 中与共享用户权限相关的 AI Call 菜单或权限记录不得擅自删除；先验证是否仍被 RuoYi 授权链路使用。

## 安全约束

- 不提交、打印或写入文档：`.env.local`、RSA 值、Client ID 值、Token、Cookie、SSH 凭证及其他生产秘密。
- `UMI_APP_*` 会编译进前端 bundle，不得用于保存真正的服务器端秘密。
- 不得绕过 `scripts/check-build-env.js` 的生产构建检查。
- 未经用户明确授权，禁止发起真实外呼；页面和接口验收不等于获得外呼授权。

## 修改与验证

- 优先复用现有适配器、请求封装、组件和测试模式，不新增无必要依赖或抽象。
- 业务请求统一走现有请求封装；不要直接新增未附加 Token、租户或加密处理的请求。
- 修改路由、菜单、权限或请求时，验证登录态、无权限态、租户隔离及对应后端行为，不能只检查按钮是否显示。
- 修改 SSE、LiveKit、录音或代理时，分别验证连接、鉴权、超时、缓存和反向代理；静态页面 `200` 不能作为链路通过证据。
- 完成前按改动范围运行最小充分验证；影响生产构建时至少运行：

```bash
npm test -- --runInBand
npm run lint
npm run build
```

如因缺少授权生产变量无法构建，必须如实报告，不得填假值后宣称生产构建通过。

## 发布规则

- 发布前核对分支、dirty state、commit/tag、线上 `current` 指向和线上 bundle。
- 使用 `/home/lingchen/web/ai-reach/releases/<commit>-<timestamp>/` 版本目录，并原子切换 `current` 软链接；禁止直接覆盖线上当前目录。
- Nginx 配置以 `deploy/nginx-reach.conf` 为准，修改后必须先 `nginx -t` 再重载。
- 验收 `reach` 主域名、`www` 跳转、HTTPS、登录、租户、权限、通知 SSE、AI Call API、坐席 SSE，并按改动范围验收对象存储和 LiveKit。
- 保留上一个已验证版本用于回滚；线上成功后再清理更早版本。
- 不把历史发布结果当作本次验收证据，每次发布都重新执行当前检查。

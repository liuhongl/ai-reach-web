# AI Reach Web

AI Reach Web 是从 Recov 中拆出的独立 AI Call 前端，生产地址为 <https://reach.lingchen-ai.com>。项目独立构建和发布，但继续复用现有 RuoYi 的登录、用户、租户、权限与通知能力，以及现有 AI Call 后端。

## 系统边界

| 路径 | 用途 | 注意事项 |
| --- | --- | --- |
| `/dev-api/` | RuoYi 登录、用户、租户、权限、通知 | 不属于 AI Call 业务后端 |
| `/dev-api/resource/sse` | RuoYi 通知 SSE | 与坐席事件流相互独立 |
| `/ai-call-agent-api/` | AI Call 任务、记录、坐席及业务 SSE | 生产环境由 Nginx 转发到 AI Call 后端 |
| `/ai-call-oss/` | 录音等对象存储资源 | 发布后需要验证下载链路 |
| `/livekit/` | 浏览器音频与坐席通话 | 依赖 HTTPS、WebSocket 和麦克风权限 |

前端路由及页面权限声明位于 `config/routes.ts`。真正的数据权限和租户隔离必须由后端保证，不能只依赖前端菜单或按钮控制。

## 本地开发

```bash
npm ci
cp .env.example .env.local
npm run dev
```

默认端口是 `8078`。在 `.env.local` 中填写已授权环境的配置；该文件已被 Git 忽略，不得提交真实配置。

默认开发代理：

- RuoYi：`http://localhost:8080`
- AI Call：`http://127.0.0.1:19011`

修改代理配置后必须重启开发服务。验证页面前应先确认 `8078` 实际由本项目启动，并确认两个后端监听正常。

## 生产构建

生产构建前至少执行：

```bash
npm ci
npm test -- --runInBand
npm run lint
npm run build
```

`npm run build` 会先校验以下变量：

- `UMI_APP_ENCRYPT` 必须严格等于 `true`
- `UMI_APP_RSA_PUBLIC_KEY` 非空
- `UMI_APP_RSA_PRIVATE_KEY` 非空
- `UMI_APP_CLIENT_ID` 非空

这些变量必须由受控的 CI 或当前构建进程注入。`prebuild` 是独立 Node 进程，不要假定它会自动读取 `.env.local`。不得通过删除校验、改成默认值或关闭加密来绕过失败。

所有 `UMI_APP_*` 值都会进入浏览器构建产物，不能被当作服务器端秘密；如有必须对用户保密的密钥，应调整后端协议，而不是继续放入前端环境变量。

## 上线流程

1. 确认工作区干净，提交已推送，并记录待发布的 commit/tag。
2. 使用授权生产配置完成测试、Lint、类型检查和构建。
3. 将 `dist/` 上传到 `/home/lingchen/web/ai-reach/releases/<commit>-<timestamp>/`，校验文件完整性。
4. 原子切换 `/home/lingchen/web/ai-reach/current` 软链接到新版本；禁止直接覆盖 `current` 目录。
5. 仅在 Nginx 配置发生变化时更新 `deploy/nginx-reach.conf` 对应配置，并先执行 `nginx -t`。证书续期后可使用 `deploy/reload-nginx-after-renewal.sh` 校验并重载。
6. 保留至少一个已验证的旧版本，完成线上验收后再清理更早版本。

`www.reach.lingchen-ai.com` 只作为别名，HTTP 和 `www` HTTPS 都应跳转到 `https://reach.lingchen-ai.com`。

## 上线验收

- 域名、DNS、HTTPS 证书和 `www` 跳转正常。
- 线上加载的是本次发布的静态 bundle，而不是旧缓存或旧目录。
- 登录、退出、租户切换、用户权限和无权限页面正常。
- AI Call 全部菜单及受保护路由按权限显示。
- 通知中心及 RuoYi SSE 正常。
- 任务、记录、音色、线路、规则、跟进、统计、坐席、转人工、测试台和提示词页面可正常访问对应接口。
- 坐席事件 SSE、录音访问和 LiveKit/WebSocket 链路按本次改动范围验证。
- 未经明确授权，不得用真实客户号码执行外呼验收。

页面返回 `200` 只证明静态站点可访问，不代表登录、权限、API、SSE、音频和存储链路已经通过。

## 回滚

将 `current` 软链接原子切回上一个已验证版本，然后复查首页、登录和关键接口。若本次未修改 Nginx，前端回滚通常不需要重载 Nginx；若同时修改了代理或证书配置，必须同步恢复配置并重新执行 `nginx -t`。

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

### 8079 提示词候选环境

`8079` 用于提示词、知识库等候选功能的人工验证，不使用上面的默认代理。启动时必须显式指定两条后端链路：

| 前端路径 | 目标服务 | 用途 |
| --- | --- | --- |
| `/dev-api/` | `https://reach.lingchen-ai.com/dev-api` | 复用已授权 RuoYi 的登录、租户、用户和权限数据 |
| `/ai-call-agent-api/` | `http://127.0.0.1:19014` | 先移除远端 RuoYi 的 `Authorization`，再转发到本地 `19013` 候选后端 |

```bash
AUTH_ENV_FILE=/absolute/path/to/authorized/.env.local

env \
  PORT=8079 \
  UMI_ENV=dev \
  MOCK=none \
  AI_REACH_E2E=1 \
  UMI_APP_API_TARGET=https://reach.lingchen-ai.com/dev-api \
  UMI_APP_AI_CALL_API_TARGET=http://127.0.0.1:19014 \
  node --env-file="$AUTH_ENV_FILE" ./node_modules/.bin/max dev
```

- 授权配置文件必须包含 `UMI_APP_ENCRYPT`、`UMI_APP_RSA_PUBLIC_KEY`、`UMI_APP_RSA_PRIVATE_KEY`、`UMI_APP_CLIENT_ID`；只配置两个代理目标会导致租户和验证码可加载，但提交登录稳定返回 `403 没有访问权限`。
- 本机 `8080` 的 RuoYi 初始化服务不属于这条候选链路；如果登录页只出现 `XXX有限公司`，说明 `UMI_APP_API_TARGET` 缺失并回退到了本机 `8080`。
- `19014` 是候选环境的鉴权隔离代理：必须删除请求中的 `Authorization` 后再转发到 `19013`。8079 直接连接 `19013` 时，远端 RuoYi Token 会因本地 JWT 签名不一致而使提示词接口返回 `500 invalid_signature`。
- `19013` 必须以 SQLite、stub provider、禁止 SIP 外呼的隔离配置启动；不得用 `19011` 代替。
- `8078/19011` 是另一套本地基线，启动或修复 `8079/19014/19013` 时不要停止或改配它们。
- 租户数量可能变化，验收以接口成功且包含预期租户为准，不把固定数量写成启动条件。

启动后至少验证：

```bash
for port in 8079 19014 19013; do
  lsof -nP -iTCP:"$port" -sTCP:LISTEN
done

curl --fail http://127.0.0.1:8079/dev-api/auth/tenant/list
curl --fail http://127.0.0.1:8079/dev-api/auth/code
curl --fail 'http://127.0.0.1:8079/ai-call-agent-api/ai-call/prompt-profiles?pageSize=1'
```

三个端口都监听且三条请求都返回 `200`，只表示这套隔离候选环境的页面与接口连通。由于 `19014` 会移除鉴权头，这不能证明 AI Call 的权限或租户隔离；权限与租户必须在启用 JWT、保留真实鉴权头的集成环境另行验收。

#### 重复启动故障对照

| 现象 | 根因 | 处理 |
| --- | --- | --- |
| 登录页接口 `504` | `/dev-api/` 的目标服务不可用或代理目标错误 | 先核对 `UMI_APP_API_TARGET`，不要直接启动本机 `8080` 顶替 |
| 登录页只有 `XXX有限公司` | 8079 回退到本机 `8080` 初始化库 | 使用上面的远端 RuoYi 目标重启 8079，不在初始化库补租户 |
| 租户、验证码正常，提交登录提示“没有访问权限” | 启动时未加载 `clientId` 或 RSA 加密配置 | 使用授权配置文件重新启动，不能只传两个代理目标 |
| 提示词页面接口 `504` | `19014` 隔离代理或 `19013` 候选后端未监听 | 先恢复 `19013`，再恢复转发到它的 `19014` |
| 登录后提示词页面接口 `500`，19013 日志出现 `invalid_signature` | 8079 直接连接了 `19013`，或 `19014` 未移除远端 RuoYi Token | 将 `UMI_APP_AI_CALL_API_TARGET` 恢复为 `http://127.0.0.1:19014`，并确认 19014 删除 `Authorization` 后再转发 |
| 参数已经修改但页面仍旧报错 | 8079 仍在运行旧的编译结果 | 停止原 8079 进程后重新启动，再执行三条接口检查 |

固定排查顺序是：确认监听进程及其工作目录 → 核对 `8079 → 19014 → 19013` 链路 → 核对授权配置是否加载 → 验证三条接口 → 最后打开页面。不要把“页面能打开”当成登录和提示词链路已恢复。

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

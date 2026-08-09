# AI Reach Web 独立项目提取实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 从当前 Recov 工作区提取一个可在 `8078` 独立登录、按权限展示 13 个 AI Call 入口、连接现有 RuoYi 与 AI Call 后端并通过测试和生产构建的 `ai-reach-web` 候选版本。

**架构：** 新仓库保留最小 Umi Max 壳、RuoYi 登录/租户/通知能力和完整 AI Call 页面，不复制 Recov 工作区菜单、流程浮层或业务页面。浏览器只访问同源 `/dev-api` 与 `/ai-call-agent-api`；固定菜单和路由都从同一权限表生成，页面与服务在新仓库内闭合。

**技术栈：** Umi Max 4、React 19、TypeScript 6、Ant Design 6、ProComponents 3、Jest 30、`@microsoft/fetch-event-source`、LiveKit Client、npm。

---

## 执行边界

- 源仓库：`/Users/liuhongli/.codex/worktrees/a3cd/recov-ai-web-react`
- 目标仓库：`/Users/liuhongli/Desktop/lingchen/ai-reach-web`
- 迁移源以执行时源仓库磁盘内容为准；不得重置、清理或覆盖源仓库的未提交修改。
- 不得完整复制 Recov 仓库，只机械复制本计划列出的文件和目录。
- 依赖版本沿用源项目当前基线，不升级 Umi、React、Ant Design、ProComponents 或 LiveKit。
- 首版继续通过 `UMI_APP_CLIENT_ID` 使用现有 RuoYi `clientId`，不在源码或构建产物中写死环境值。
- 本计划只完成设计第 8 节“阶段一：建立独立项目”和“阶段二：独立验证”。
- `src/pages/recov/intelligentOutbound`、催收策略 `ai_call` 节点、数据洞察反馈和 Recov 运行控制均不迁入、不修改。
- 生产部署需先只读核验 `81.68.166.109` 的实时 Nginx、证书和上游配置，并获得用户明确部署授权，再编写生产部署计划。
- Recov 删除需等新站完成线上验收，再对源仓库重新做引用扫描并编写独立清理计划。
- 自动化和人工验证均不得发起真实客户外呼；真实通话必须另行获得用户明确授权。

## 目标文件结构

### 项目与配置

- 创建：`package.json`、`package-lock.json`——仅保留独立站实际使用的运行及测试依赖。
- 创建：`tsconfig.json`、`biome.json`、`jest.config.ts`、`tests/setupTests.jsx`——沿用源项目工具版本和测试行为。
- 创建：`postcss.config.js`、`tailwind.config.js`、`src/tailwind.css`、`src/global.tsx`——保留已迁页面实际使用的 Tailwind 工具类。
- 创建：`config/config.ts`、`config/defaultSettings.ts`——最小 Umi、Ant Design Pro 布局配置，开发端口固定为 `8078`。
- 创建：`config/proxy.ts`、`config/proxy.test.ts`——只代理 `/dev-api` 和 `/ai-call-agent-api`。
- 创建：`config/routes.ts`、`config/routes.test.ts`——登录、403/404、13 个入口及任务子路由。
- 创建：`public/brand/lingchen-icon.png`、`public/favicon.ico`——复用现有品牌资源。

### 登录、布局与权限

- 创建：`src/app.tsx`、`src/app.test.tsx`——加载当前用户、恢复动态租户、登录回跳、布局和两个 SSE 挂载点。
- 创建：`src/access.ts`、`src/access.test.ts`——统一路由权限判断。
- 创建：`src/aiCallNavigation.tsx`、`src/aiCallNavigation.test.tsx`——13 个菜单的唯一权限映射及首个可访问路由。
- 创建：`src/pages/index.tsx`、`src/pages/index.test.tsx`——根路径按权限跳转或显示 403。
- 创建：`src/pages/user/login/index.tsx`、`src/pages/user/login/index.test.tsx`——独立登录、验证码、租户和安全回跳。
- 创建：`src/pages/exception/403/index.tsx`、`src/pages/exception/404/index.tsx`——中文异常页。
- 创建：`src/components/UserMenu/index.tsx`、`src/components/UserMenu/index.test.tsx`——退出并清理本站 Token/SSE。
- 创建：`src/components/TenantSwitch/index.tsx`、`src/components/TenantSwitch/index.test.tsx`——仅超级管理员可动态切换租户。

### RuoYi 与通知基础能力

- 迁移：`src/adapters/ruoyi/{crypto,download,dynamicTenant,env,message,params,request,response,sse,token}.ts` 及对应测试——请求、Token、响应、错误、下载和 RuoYi SSE。
- 创建：`src/services/ruoyi/auth.ts`、`src/services/ruoyi/user.ts`、`src/services/ruoyi/tenant-context.ts`——只保留登录、用户查询和动态租户所需接口。
- 迁移：`src/services/ruoyi/message.ts`——通知列表、未读数、单条及全部已读。
- 迁移：`src/components/NotificationCenter`、`src/components/SseBootstrap`、`src/components/SafeHtml`、`src/components/SiderFooterAction` 及其直接依赖。

### AI Call 业务

- 迁移：`src/pages/aiCallLab`、`src/pages/aiCallLines`、`src/pages/aiCallRecords`、`src/pages/aiCallRules`、`src/pages/aiCallStatistics`、`src/pages/aiCallTasks`、`src/pages/aiCallVoices`——AI Call 页面、样式、Mock 和测试。
- 迁移：`src/pages/agentWorkbench`——坐席、跟进、转人工管理页面及测试。
- 迁移：`src/services/ruoyi/agent-console*`、`src/services/ruoyi/ai-call-*`——AI Call 专用请求及测试。
- 创建：`src/components/ListLayout/index.tsx`——从 `RecovListLayout` 提取到独立通用路径。
- 创建：`src/global.less`、`src/global.test.ts`——只提取 AI Call 页面布局、表格和侧栏底部操作实际依赖的全局样式。
- 迁移：`src/components/MetricIcon`、`src/components/TableActions`、`src/components/Permission`、`src/hooks/useDeleteConfirm.ts`、`src/utils/permission.ts`。

## 任务 1：建立最小可测试 Umi 项目

**文件：**
- 创建：`package.json`
- 创建：`package-lock.json`
- 创建：`.gitignore`
- 创建：`.npmrc`
- 创建：`tsconfig.json`
- 创建：`biome.json`
- 创建：`jest.config.ts`
- 创建：`postcss.config.js`
- 创建：`tailwind.config.js`
- 创建：`tests/setupTests.jsx`
- 创建：`config/defaultSettings.ts`
- 创建：`config/config.ts`
- 创建：`src/pages/index.tsx`
- 创建：`src/typings.d.ts`
- 创建：`src/tailwind.css`
- 创建：`src/global.tsx`
- 创建：`src/global.less`
- 创建：`public/brand/lingchen-icon.png`
- 创建：`public/favicon.ico`

- [ ] **步骤 1：记录迁移源现场**

运行：

```bash
source_repo=/Users/liuhongli/.codex/worktrees/a3cd/recov-ai-web-react
target_repo=/Users/liuhongli/Desktop/lingchen/ai-reach-web
git -C "$source_repo" status --short --branch
git -C "$source_repo" rev-parse HEAD
git -C "$target_repo" status --short --branch
```

预期：源仓库仍在 `codex/generic-outbound-task-v1` 且现有未提交 AI Call 文件可见；目标仓库只含已确认的规格和计划。不要修改源仓库状态。

- [ ] **步骤 2：创建精简 `package.json`**

写入：

```json
{
  "name": "ai-reach-web",
  "private": true,
  "scripts": {
    "build": "max build",
    "dev": "cross-env PORT=8078 UMI_ENV=dev MOCK=none max dev",
    "lint": "npm run biome:lint && npm run tsc",
    "biome:lint": "biome lint",
    "test": "jest",
    "tsc": "tsc --noEmit"
  },
  "dependencies": {
    "@ant-design/icons": "^6.2.2",
    "@ant-design/plots": "^2.6.8",
    "@ant-design/pro-components": "^3.1.12-0",
    "@microsoft/fetch-event-source": "^2.0.1",
    "@tailwindcss/postcss": "^4.2.4",
    "antd": "^6.3.7",
    "antd-style": "^4.1.0",
    "clsx": "^2.1.1",
    "crypto-js": "^4.2.0",
    "dayjs": "^1.11.20",
    "express": "^5.2.1",
    "jsencrypt": "^3.5.4",
    "livekit-client": "^2.20.2",
    "react": "^19.2.5",
    "react-dom": "^19.2.5"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.13",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@types/crypto-js": "^4.2.2",
    "@types/express": "^5.0.6",
    "@types/jest": "^30.0.0",
    "@types/node": "^25.6.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@umijs/lint": "^4.6.51",
    "@umijs/max": "^4.6.51",
    "cross-env": "^10.1.0",
    "jest": "^30.4.1",
    "jest-environment-jsdom": "^30.4.1",
    "ts-node": "^10.9.2",
    "tailwindcss": "^4.2.4",
    "typescript": "^6.0.3"
  }
}
```

- [ ] **步骤 3：迁入最小工具配置和品牌资源**

运行机械复制；不要复制源仓库 `.git`、`node_modules`、`dist`、`.umi*` 或其他页面：

```bash
source_repo=/Users/liuhongli/.codex/worktrees/a3cd/recov-ai-web-react
target_repo=/Users/liuhongli/Desktop/lingchen/ai-reach-web
cp "$source_repo/.gitignore" "$source_repo/.npmrc" "$source_repo/tsconfig.json" "$source_repo/biome.json" "$source_repo/jest.config.ts" "$source_repo/postcss.config.js" "$source_repo/tailwind.config.js" "$target_repo/"
mkdir -p "$target_repo/tests" "$target_repo/public/brand" "$target_repo/src"
cp "$source_repo/tests/setupTests.jsx" "$target_repo/tests/setupTests.jsx"
cp "$source_repo/public/brand/lingchen-icon.png" "$target_repo/public/brand/lingchen-icon.png"
cp "$source_repo/public/favicon.ico" "$target_repo/public/favicon.ico"
cp "$source_repo/src/tailwind.css" "$source_repo/src/global.tsx" "$target_repo/src/"
```

然后裁剪 `jest.config.ts` 中未迁移的 Markdown、Mermaid 和 `@utoo/pack` 配置，只保留 Umi alias、JSDOM URL 和 `tests/setupTests.jsx`。

- [ ] **步骤 4：创建最小配置和占位首页**

`config/config.ts` 首次只启用 `model`、`initialState`、`layout`、`request`、`access`、Ant Design 和 `moment2dayjs`，让 Umi 约定式路由加载占位首页；任务 2 再切换为显式 `routes` 和 `proxy`。不得迁入 analytics、OpenAPI、request-record、Recov 环境变量或工作区菜单配置。

创建只包含 `box-sizing`、`body` margin 和基础背景色的 `src/global.less`。`src/pages/index.tsx` 首次只返回：

```tsx
export default function IndexPage() {
  return <div>AI Reach</div>;
}
```

`src/typings.d.ts` 只声明样式/图片模块和当前布局使用的用户字段：

```ts
declare module '*.css';
declare module '*.less';
declare module '*.png';

declare namespace API {
  type CurrentUser = {
    access?: string;
    avatar?: string;
    email?: string;
    name?: string;
    phone?: string;
    userid?: string;
  };
}
```

- [ ] **步骤 5：安装并验证最小项目**

运行：

```bash
npm install
npm run tsc
npm run build
```

预期：生成 `package-lock.json`，TypeScript 退出码为 0，生产构建生成 `dist/`。

- [ ] **步骤 6：提交项目基线**

```bash
git add package.json package-lock.json .gitignore .npmrc tsconfig.json biome.json jest.config.ts postcss.config.js tailwind.config.js tests config src/pages/index.tsx src/typings.d.ts src/tailwind.css src/global.tsx src/global.less public
git commit -m "chore: 建立 AI Reach Web 项目基线"
```

## 任务 2：锁定双代理和固定权限路由

**文件：**
- 创建：`config/proxy.test.ts`
- 创建：`config/proxy.ts`
- 创建：`config/routes.test.ts`
- 创建：`config/routes.ts`
- 创建：`src/aiCallNavigation.test.tsx`
- 创建：`src/aiCallNavigation.tsx`
- 创建：`src/access.test.ts`
- 创建：`src/access.ts`
- 迁移：`src/utils/permission.ts`
- 修改：`src/pages/index.tsx`
- 创建：`src/pages/index.test.tsx`
- 创建：`src/pages/exception/403/index.tsx`
- 创建：`src/pages/exception/404/index.tsx`

- [ ] **步骤 1：为代理写失败测试**

覆盖以下精确断言：

```ts
expect(devProxy['/dev-api']).toMatchObject({
  target: process.env.UMI_APP_API_TARGET || 'http://localhost:8080',
  changeOrigin: true,
  pathRewrite: { '^/dev-api': '' },
});
expect(devProxy['/ai-call-agent-api']).toMatchObject({
  target: process.env.UMI_APP_AI_CALL_API_TARGET || 'http://127.0.0.1:19011',
  changeOrigin: true,
  proxyTimeout: 0,
  timeout: 0,
  pathRewrite: { '^/ai-call-agent-api': '' },
});
expect(devProxy['/admin-api']).toBeUndefined();
expect(devProxy['/voice-api']).toBeUndefined();
expect(devProxy['/ai-call-lab-api']).toBeUndefined();
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npm test -- config/proxy.test.ts --runInBand`

预期：FAIL，原因是 `config/proxy.ts` 尚未导出对应规则。

- [ ] **步骤 3：实现最小双代理**

开发环境只配置 `/dev-api` 与 `/ai-call-agent-api`。AI Call 代理必须保留长连接超时和 `Cache-Control: no-cache`；不得复制 `/admin-api`、`/voice-api` 和 `/ai-call-lab-api`。

- [ ] **步骤 4：为 13 个菜单和路由写失败测试**

在 `src/aiCallNavigation.test.tsx` 中使用以下权限矩阵：

```ts
const expected = [
  ['外呼任务', '/ai-call/tasks', 'ai_call:agent:manage'],
  ['通话记录', '/ai-call/records', 'ai_call:agent:manage'],
  ['音色管理', '/ai-call/voices', 'ai_call:voice:manage'],
  ['线路配置', '/ai-call/lines', 'ai_call:agent:manage'],
  ['呼叫规则', '/ai-call/rules', 'ai_call:agent:manage'],
  ['跟进处理', '/ai-call/follow-ups', 'ai_call:agent:console'],
  ['跟进总览', '/ai-call/follow-up-overview', 'ai_call:agent:manage'],
  ['外呼统计', '/ai-call/statistics', 'ai_call:agent:manage'],
  ['坐席工作台', '/ai-call/agent-workbench', 'ai_call:agent:console'],
  ['坐席管理', '/ai-call/agents', 'ai_call:agent:manage'],
  ['转人工记录', '/ai-call/handoffs', 'ai_call:agent:manage'],
  ['通话测试台', '/ai-call-lab/customer', 'ai_call:lab:use'],
  ['提示词配置', '/ai-call-lab/prompt-config', 'ai_call:prompt:manage'],
] as const;
```

断言普通权限只显示对应项，`*:*:*` 显示全部 13 项，无权限返回空菜单和 `undefined` 首路径；路由表不包含 `/agent-workbench`。

- [ ] **步骤 5：运行菜单和路由测试确认失败**

运行：`npm test -- src/aiCallNavigation.test.tsx config/routes.test.ts --runInBand`

预期：FAIL，原因是固定导航和完整路由尚未创建。

- [ ] **步骤 6：实现唯一导航表与路由表**

先复制权限工具：

```bash
mkdir -p src/utils
cp /Users/liuhongli/.codex/worktrees/a3cd/recov-ai-web-react/src/utils/permission.ts src/utils/permission.ts
```

`src/aiCallNavigation.tsx` 导出 `AI_CALL_NAV_ITEMS`、`buildAiCallMenu(permissions)` 和 `getFirstAiCallPath(permissions)`。菜单可见性复用该权限工具，不得再请求或拼接 RuoYi 工作区菜单。

`config/routes.ts` 包含：

- `/user/login`
- 根路径 `/`
- 13 个已确认入口
- `/ai-call/tasks/create`
- `/ai-call/tasks/:taskId`
- `/403`
- 末尾 `/*` 对应 404

每个受保护路由设置 `access: 'hasRoutePermission'` 和同一导航表中的 `requiredPermission`；深链隐藏菜单但保留访问权限。

- [ ] **步骤 7：实现根路径权限跳转**

`src/pages/index.tsx` 使用 `getFirstAiCallPath(currentUser.permissions)`：有权限时 `history.replace(path)`，没有权限时渲染中文 403。测试分别覆盖单一权限、超级权限和无权限。

- [ ] **步骤 8：运行测试并提交**

```bash
npm test -- config/proxy.test.ts config/routes.test.ts src/aiCallNavigation.test.tsx src/access.test.ts src/pages/index.test.tsx --runInBand
git add config src/aiCallNavigation.tsx src/aiCallNavigation.test.tsx src/access.ts src/access.test.ts src/utils/permission.ts src/pages/index.tsx src/pages/index.test.tsx src/pages/exception
git commit -m "feat: 建立 AI Call 固定导航与路由"
```

预期：定向测试全部 PASS。

## 任务 3：迁入 RuoYi 请求、登录和用户上下文

**文件：**
- 迁移：`src/adapters/ruoyi/{crypto,download,dynamicTenant,env,message,params,request,response,sse,token}.ts`
- 迁移：`src/adapters/ruoyi/{params,request,sse}.test.ts`
- 创建：`src/services/ruoyi/auth.ts`
- 创建：`src/services/ruoyi/user.ts`
- 创建：`src/services/ruoyi/tenant-context.ts`
- 创建：`src/services/ruoyi/auth.test.ts`
- 创建：`src/services/ruoyi/user.test.ts`
- 创建：`src/services/ruoyi/tenant-context.test.ts`
- 迁移：`src/utils/{renderSanitizedHtml,sanitizeHtml}.ts*`
- 创建：`src/app.tsx`
- 创建：`src/app.test.tsx`
- 创建：`src/requestErrorConfig.ts`

- [ ] **步骤 1：机械复制请求适配器及其测试**

```bash
source_repo=/Users/liuhongli/.codex/worktrees/a3cd/recov-ai-web-react
target_repo=/Users/liuhongli/Desktop/lingchen/ai-reach-web
mkdir -p "$target_repo/src/adapters/ruoyi" "$target_repo/src/utils"
for name in crypto download dynamicTenant env message params request response sse token; do cp "$source_repo/src/adapters/ruoyi/$name.ts" "$target_repo/src/adapters/ruoyi/$name.ts"; done
for name in params request sse; do cp "$source_repo/src/adapters/ruoyi/$name.test.ts" "$target_repo/src/adapters/ruoyi/$name.test.ts"; done
cp "$source_repo/src/utils/renderSanitizedHtml.tsx" "$target_repo/src/utils/renderSanitizedHtml.tsx"
cp "$source_repo/src/utils/sanitizeHtml.ts" "$target_repo/src/utils/sanitizeHtml.ts"
cp "$source_repo/src/requestErrorConfig.ts" "$target_repo/src/requestErrorConfig.ts"
```

- [ ] **步骤 2：写登录、用户和动态租户接口失败测试**

断言：

```ts
expect(ruoyiRequest).toHaveBeenCalledWith('/auth/login', expect.objectContaining({ method: 'post' }));
expect(ruoyiRequest).toHaveBeenCalledWith('/system/user/getInfo', expect.objectContaining({ method: 'get' }));
expect(ruoyiRequest).toHaveBeenCalledWith('/system/user/list', expect.objectContaining({ method: 'get' }));
expect(ruoyiRequest).toHaveBeenCalledWith('/system/tenant/dynamic/100001', expect.objectContaining({ method: 'get' }));
```

同时保留源请求适配器测试：登录数据缺少 `clientId` 时使用 `getClientId()`，普通认证请求发送 `clientid` 与 `Authorization: Bearer ...` 请求头。

- [ ] **步骤 3：运行接口测试确认失败**

运行：`npm test -- src/services/ruoyi/auth.test.ts src/services/ruoyi/user.test.ts src/services/ruoyi/tenant-context.test.ts --runInBand`

预期：FAIL，原因是精简 service 尚未实现。

- [ ] **步骤 4：实现精简 service**

从源 `auth.ts` 仅迁入 `login`、`logout`、`getCodeImg`、`getTenantList` 及其类型；从源 `user.ts` 仅迁入 `getInfo`、`listUsers` 及页面实际使用的类型；`tenant-context.ts` 只导出：

```ts
export const switchTenant = (tenantId: string) =>
  ruoyiRequest(`/system/tenant/dynamic/${encodeURIComponent(tenantId)}`, {
    method: 'get',
  });

export const clearTenant = () =>
  ruoyiRequest('/system/tenant/dynamic/clear', { method: 'get' });
```

不得迁入用户、租户、角色或岗位管理页面的增删改接口。

- [ ] **步骤 5：为 `getInitialState` 写失败测试**

覆盖：有 Token 时调用 `/system/user/getInfo` 并映射 `roles`、`permissions`；无 Token 的受保护路由跳转 `/user/login?redirect=...`；登录页不请求用户信息；普通用户清除本地动态租户；超级管理员恢复已保存动态租户。

- [ ] **步骤 6：实现最小 `src/app.tsx`**

只迁入源项目中以下职责：`toCurrentUser`、`getInitialState`、安全登录跳转、`setRuoyiMessage` bridge 和基础 ProLayout。不得迁入工作区菜单、流程通知、浮层、Recov 路由判断、主题设置抽屉或外部网站链接。

- [ ] **步骤 7：运行请求与用户上下文测试**

```bash
npm test -- src/adapters/ruoyi src/services/ruoyi/auth.test.ts src/services/ruoyi/user.test.ts src/services/ruoyi/tenant-context.test.ts src/app.test.tsx --runInBand
npm run tsc
```

预期：全部 PASS，TypeScript 退出码为 0。

- [ ] **步骤 8：提交 RuoYi 基础能力**

```bash
git add src/adapters src/services/ruoyi/auth* src/services/ruoyi/user* src/services/ruoyi/tenant-context* src/utils src/app.tsx src/app.test.tsx src/requestErrorConfig.ts
git commit -m "feat: 接入 RuoYi 登录与用户上下文"
```

## 任务 4：完成独立登录、租户切换与用户菜单

**文件：**
- 迁移并裁剪：`src/pages/user/login/index.tsx`
- 创建：`src/pages/user/login/index.test.tsx`
- 创建：`src/components/UserMenu/index.tsx`
- 创建：`src/components/UserMenu/index.test.tsx`
- 创建：`src/components/TenantSwitch/index.tsx`
- 创建：`src/components/TenantSwitch/index.test.tsx`
- 迁移：`src/components/HeaderDropdown/index.tsx`
- 迁移：`src/components/Footer/index.tsx`
- 修改：`src/app.tsx`

- [ ] **步骤 1：写登录安全回跳失败测试**

覆盖 `redirect` 只允许本站相对路径：

```ts
expect(resolveLoginRedirect('/ai-call/tasks')).toBe('/ai-call/tasks');
expect(resolveLoginRedirect('https://evil.example/path')).toBe('/');
expect(resolveLoginRedirect('//evil.example/path')).toBe('/');
expect(resolveLoginRedirect('/user/login')).toBe('/');
```

同时断言登录成功保存 Token、刷新 `initialState.currentUser` 并跳转到合法地址。

- [ ] **步骤 2：运行登录测试确认失败**

运行：`npm test -- src/pages/user/login/index.test.tsx --runInBand`

预期：FAIL，原因是登录页尚未迁入。

- [ ] **步骤 3：迁入并裁剪登录页**

从源文件复制验证码、租户列表、加密登录和错误展示；删除 `SelectLang`、RuoYi 工作区菜单缓存以及 `@/components` barrel import，改为直接导入 `@/components/Footer`。登录成功只刷新本站用户上下文。

- [ ] **步骤 4：写用户菜单和租户切换失败测试**

断言退出始终依次停止 RuoYi SSE、删除本站 Token、清除动态租户并跳转带安全 `redirect` 的 `/user/login`。断言只有用户 ID 为 `1` 的超级管理员显示租户切换；切换后重新获取用户信息并递增 `tenantSwitchVersion`。

- [ ] **步骤 5：实现最小用户菜单和租户切换**

不得复制源 `AvatarDropdown` 和 `TenantSwitch` 中的工作区菜单逻辑。`TenantSwitch` 只调用 `getTenantList(true)`、`switchTenant`、`clearTenant`，成功后执行：

```ts
const currentUser = await initialState?.fetchUserInfo?.();
setInitialState((state) => ({
  ...state,
  currentUser,
  dynamicTenantId: nextTenantId,
  tenantSwitchVersion: (state?.tenantSwitchVersion || 0) + 1,
}));
```

- [ ] **步骤 6：接入 ProLayout**

`src/app.tsx` 的顶部操作只保留租户切换、通知中心挂载位和用户菜单；标题使用“AI Reach”，Logo 使用 `/brand/lingchen-icon.png`。`onPageChange` 对未登录受保护页面执行安全回跳。

- [ ] **步骤 7：运行测试并提交**

```bash
npm test -- src/pages/user/login/index.test.tsx src/components/UserMenu src/components/TenantSwitch src/app.test.tsx --runInBand
npm run tsc
git add src/pages/user src/components/UserMenu src/components/TenantSwitch src/components/HeaderDropdown src/components/Footer src/app.tsx src/app.test.tsx
git commit -m "feat: 完成独立登录与租户切换"
```

## 任务 5：迁入通知中心和 RuoYi 全局 SSE

**文件：**
- 迁移：`src/services/ruoyi/message.ts`
- 创建：`src/services/ruoyi/message.test.ts`
- 迁移：`src/components/NotificationCenter/index.tsx`
- 创建：`src/components/NotificationCenter/index.test.tsx`
- 迁移：`src/components/SseBootstrap/index.tsx`
- 迁移：`src/components/SafeHtml/index.tsx`
- 迁移：`src/components/SiderFooterAction/index.tsx`
- 修改：`src/app.tsx`

- [ ] **步骤 1：写消息接口失败测试**

断言路径：

```ts
expect(ruoyiRequest).toHaveBeenCalledWith('/resource/message/list', expect.any(Object));
expect(ruoyiRequest).toHaveBeenCalledWith('/resource/message/unread-count', expect.any(Object));
expect(ruoyiRequest).toHaveBeenCalledWith('/resource/message/m-1/read', expect.objectContaining({ method: 'put' }));
expect(ruoyiRequest).toHaveBeenCalledWith('/resource/message/read-all', expect.objectContaining({ method: 'put' }));
```

- [ ] **步骤 2：运行消息测试确认失败**

运行：`npm test -- src/services/ruoyi/message.test.ts src/components/NotificationCenter/index.test.tsx --runInBand`

预期：FAIL，原因是 service 和组件尚未迁入。

- [ ] **步骤 3：迁入通知实现**

复制现有通知中心、SafeHtml、SiderFooterAction、消息 service 和 SseBootstrap。保留以下 SSE 类型过滤：

```ts
new Set([
  'resource.message.changed',
  'sys.message.changed',
  'system.notice.changed',
]);
```

通知 SSE 只触发消息重新加载，不消费 AI Call 坐席事件。

- [ ] **步骤 4：在布局挂载全局 SSE 与通知中心**

登录后挂载一个 `SseBootstrap`；通知组件 `contextKey` 使用 `userid:dynamicTenantId:tenantSwitchVersion`，确保切换租户后清空旧视图并重新加载。

- [ ] **步骤 5：验证两条 SSE 未混用**

运行：

```bash
rg -n "/dev-api/resource/sse" src/adapters/ruoyi/sse.ts
rg -n "/ai-call-agent-api/ai-call/agent-console/events" src/pages/agentWorkbench/hooks/useAgentEvents.ts || true
npm test -- src/adapters/ruoyi/sse.test.ts src/services/ruoyi/message.test.ts src/components/NotificationCenter/index.test.tsx --runInBand
```

预期：RuoYi SSE 测试 PASS；第二条 `rg` 在坐席页面迁入前可以无结果，但不得出现在通知组件中。

- [ ] **步骤 6：提交通知能力**

```bash
git add src/services/ruoyi/message* src/components/NotificationCenter src/components/SseBootstrap src/components/SafeHtml src/components/SiderFooterAction src/app.tsx
git commit -m "feat: 迁入通知中心与全局 SSE"
```

## 任务 6：迁入 AI Call 服务并统一 Lab Token

**文件：**
- 迁移：`src/services/ruoyi/agent-console.ts`、`src/services/ruoyi/agent-console.test.ts`
- 迁移：`src/services/ruoyi/ai-call-browser-session.ts`、对应测试
- 迁移：`src/services/ruoyi/ai-call-runtime-session.ts`、对应测试
- 迁移：`src/services/ruoyi/ai-call-runtime.ts`、对应测试
- 迁移：`src/services/ruoyi/ai-call-voices.ts`、类型及测试
- 迁移并修改：`src/services/ruoyi/ai-call-lab.ts`、对应测试

- [ ] **步骤 1：机械复制 AI Call 专用 service**

```bash
source_repo=/Users/liuhongli/.codex/worktrees/a3cd/recov-ai-web-react
target_repo=/Users/liuhongli/Desktop/lingchen/ai-reach-web
mkdir -p "$target_repo/src/services/ruoyi"
cp "$source_repo/src/services/ruoyi/agent-console.ts" "$source_repo/src/services/ruoyi/agent-console.test.ts" "$target_repo/src/services/ruoyi/"
cp "$source_repo/src/services/ruoyi/ai-call-"* "$target_repo/src/services/ruoyi/"
```

- [ ] **步骤 2：先修改 Lab 测试，锁定统一 Token 请求**

删除对 `@umijs/max request` 的 mock，所有提示词、会话、事件、录音和转人工请求都断言调用 `ruoyiRequest`，例如：

```ts
expect(mockRuoyiRequest).toHaveBeenCalledWith(
  '/ai-call/prompt-profiles',
  expect.objectContaining({
    baseApi: '/ai-call-agent-api',
    method: 'get',
  }),
);
```

- [ ] **步骤 3：运行 Lab service 测试确认失败**

运行：`npm test -- src/services/ruoyi/ai-call-lab.test.ts --runInBand`

预期：FAIL，当前实现仍调用 Umi `request`。

- [ ] **步骤 4：最小修改 Lab service**

将：

```ts
import { request } from '@umijs/max';
```

替换为：

```ts
import { ruoyiRequest } from '@/adapters/ruoyi/request';
```

请求路径改为不含代理前缀的 `/ai-call/...`，每次调用传入：

```ts
{
  baseApi: '/ai-call-agent-api',
  method,
  ...requestOptions,
}
```

保留现有超时、响应解包和 URL 编码，不改变业务字段。

- [ ] **步骤 5：运行全部 AI Call service 测试**

```bash
npm test -- src/services/ruoyi/agent-console.test.ts src/services/ruoyi/ai-call-*.test.ts --runInBand
npm run tsc
```

预期：全部 PASS；`rg -n "from '@umijs/max'" src/services/ruoyi/ai-call-lab.ts` 无结果。

- [ ] **步骤 6：提交 service 层**

```bash
git add src/services/ruoyi/agent-console* src/services/ruoyi/ai-call-*
git commit -m "feat: 迁入 AI Call 服务层"
```

## 任务 7：迁入通用 UI 与完整 AI Call 页面

**文件：**
- 创建：`src/components/ListLayout/index.tsx`
- 迁移：`src/components/MetricIcon/index.tsx`
- 迁移：`src/components/TableActions`
- 迁移：`src/components/Permission`
- 迁移：`src/hooks/useDeleteConfirm.ts`
- 修改：`src/global.less`
- 创建：`src/global.test.ts`
- 迁移：`src/pages/agentWorkbench`
- 迁移：`src/pages/aiCallLab`
- 迁移：`src/pages/aiCallLines`
- 迁移：`src/pages/aiCallRecords`
- 迁移：`src/pages/aiCallRules`
- 迁移：`src/pages/aiCallStatistics`
- 迁移：`src/pages/aiCallTasks`
- 迁移：`src/pages/aiCallVoices`

- [ ] **步骤 1：复制当前磁盘上的页面和测试**

```bash
source_repo=/Users/liuhongli/.codex/worktrees/a3cd/recov-ai-web-react
target_repo=/Users/liuhongli/Desktop/lingchen/ai-reach-web
mkdir -p "$target_repo/src/pages" "$target_repo/src/components" "$target_repo/src/hooks"
for dir in agentWorkbench aiCallLab aiCallLines aiCallRecords aiCallRules aiCallStatistics aiCallTasks aiCallVoices; do cp -R "$source_repo/src/pages/$dir" "$target_repo/src/pages/$dir"; done
cp -R "$source_repo/src/components/TableActions" "$target_repo/src/components/TableActions"
cp -R "$source_repo/src/components/Permission" "$target_repo/src/components/Permission"
cp "$source_repo/src/hooks/useDeleteConfirm.ts" "$target_repo/src/hooks/useDeleteConfirm.ts"
```

预期：包括源仓库当前未提交的 AI Call 修改和新增测试；源仓库内容不发生变化。

- [ ] **步骤 2：先写“无 Recov 依赖”失败检查**

运行：

```bash
if rg -n "@/pages/recov/|@/adapters/ruoyi/menu|FloatingProcessPanel" src; then exit 1; fi
```

预期：FAIL，列出页面对 `RecovListLayout` 和 `MetricIcon` 的引用。

- [ ] **步骤 3：提取通用列表组件**

将源 `src/pages/recov/components/RecovListLayout.tsx` 复制为 `src/components/ListLayout/index.tsx`，重命名导出：

```ts
RecovPage -> Page
RecovListPage -> ListPage
RecovListStack -> ListStack
RecovStatsStrip -> StatsStrip
RecovTableCard -> TableCard
```

将 `MetricIcon.tsx` 放到 `src/components/MetricIcon/index.tsx`。批量修改已迁页面的 import 和 JSX 标识符，不复制 `src/pages/recov` 目录。

从源 `src/global.less` 只提取以下样式到目标 `src/global.less`：页面内容间距、`recov-page-toolbar*`、`recov-list-*`、`recov-stats-strip`、`recov-table-*`、`recov-task-create-*`、`recov-stable-pagination-table` 以及 `SiderFooterAction` 使用的 `recov-sider-footer-action*`。不要迁入 `flow-event-center-tabs`、Recov 工作区主题或业务页面选择器；保留现有 className 可避免页面视觉回归，它们不形成源码依赖。

`src/global.test.ts` 读取目标样式并断言列表容器、固定分页表格、任务创建滚动和侧栏通知操作四组规则存在，同时断言不包含 `flow-event-center-tabs`。

- [ ] **步骤 4：迁入页面内 service、样式、Mock 和测试依赖**

由于整个八个页面目录已复制，确认以下内容均存在：任务创建/详情、记录详情、录音/对话/质检、跟进抽屉、坐席 SSE、LiveKit 客户端、线路/规则/统计 service、全部 `.css` 和 `.test.ts(x)`。

运行：

```bash
for dir in agentWorkbench aiCallLab aiCallLines aiCallRecords aiCallRules aiCallStatistics aiCallTasks aiCallVoices; do test -d "src/pages/$dir"; done
test -f src/pages/aiCallRecords/AnalysisResultDescriptions.tsx
test -f src/pages/aiCallTasks/components/TaskActions.test.tsx
```

- [ ] **步骤 5：修复独立仓库的局部依赖**

只处理实际编译错误：

- `@/pages/recov/components/RecovListLayout` 改为 `@/components/ListLayout`
- `@/pages/recov/components/MetricIcon` 改为 `@/components/MetricIcon`
- 保留 `@/components/TableActions`、`@/hooks/useDeleteConfirm` 和 AI Call service 路径
- 不引入 `src/pages/recov`、工作区菜单、流程浮层或 Recov service

- [ ] **步骤 6：运行页面测试，逐个修复真实失败**

```bash
npm test -- src/pages/aiCallTasks --runInBand
npm test -- src/pages/aiCallRecords --runInBand
npm test -- src/pages/aiCallVoices src/pages/aiCallLines src/pages/aiCallRules src/pages/aiCallStatistics --runInBand
npm test -- src/pages/aiCallLab --runInBand
npm test -- src/pages/agentWorkbench --runInBand
npm test -- src/global.test.ts --runInBand
```

预期：各组全部 PASS。不得为了通过测试删除录音、对话、质检、跟进、转人工或浏览器媒体行为。

- [ ] **步骤 7：运行依赖闭合检查**

```bash
if rg -n "@/pages/recov/|@/adapters/ruoyi/menu|FloatingProcessPanel" src; then exit 1; fi
if find src/pages -mindepth 1 -maxdepth 1 -type d | rg -v '/(agentWorkbench|aiCallLab|aiCallLines|aiCallRecords|aiCallRules|aiCallStatistics|aiCallTasks|aiCallVoices|exception|user)$'; then exit 1; fi
npm run tsc
```

预期：两个依赖检查退出码为 0，TypeScript 退出码为 0。

- [ ] **步骤 8：提交完整页面迁移**

```bash
git add src/components/ListLayout src/components/MetricIcon src/components/TableActions src/components/Permission src/hooks src/pages/agentWorkbench src/pages/aiCallLab src/pages/aiCallLines src/pages/aiCallRecords src/pages/aiCallRules src/pages/aiCallStatistics src/pages/aiCallTasks src/pages/aiCallVoices src/global.less src/global.test.ts
git commit -m "feat: 迁入完整 AI Call 前端模块"
```

## 任务 8：完成布局联动和双 SSE 生命周期

**文件：**
- 修改：`src/app.tsx`
- 修改：`src/app.test.tsx`
- 修改：`src/aiCallNavigation.tsx`
- 修改：`src/components/TenantSwitch/index.tsx`
- 修改：`src/components/NotificationCenter/index.tsx`
- 验证：`src/pages/agentWorkbench/hooks/useAgentEvents.ts`

- [ ] **步骤 1：写布局联动失败测试**

覆盖：

- 登录后菜单按当前权限过滤
- 切换租户后菜单、通知中心和页面子树使用新的 `tenantSwitchVersion`
- RuoYi SSE 由全局 `SseBootstrap` 管理
- 坐席 SSE 只在坐席相关 Hook 中建立
- 401 清 Token 并回登录；403 不清 Token

- [ ] **步骤 2：运行布局测试确认失败**

运行：`npm test -- src/app.test.tsx src/aiCallNavigation.test.tsx src/components/TenantSwitch src/components/NotificationCenter --runInBand`

预期：至少一个租户切换或 SSE 生命周期断言 FAIL。

- [ ] **步骤 3：实现最小联动**

用 `tenantSwitchVersion` 作为页面树和通知中心的 key；菜单始终从 `initialState.currentUser.permissions` 重新生成。不得创建统一 SSE 总线，不得把通知事件转发给坐席 Hook。

- [ ] **步骤 4：验证 URL 与事件流分离**

```bash
rg -n "/dev-api/resource/sse" src/adapters/ruoyi/sse.ts
rg -n "/ai-call-agent-api/ai-call/agent-console/events" src/pages/agentWorkbench/hooks/useAgentEvents.ts
if rg -n "agent-console/events" src/components/NotificationCenter; then exit 1; fi
if rg -n "resource/sse" src/pages/agentWorkbench; then exit 1; fi
```

预期：前两条各命中对应实现，后两条无结果。

- [ ] **步骤 5：运行测试并提交**

```bash
npm test -- src/app.test.tsx src/aiCallNavigation.test.tsx src/components/TenantSwitch src/components/NotificationCenter src/pages/agentWorkbench/hooks/useAgentEvents.test.tsx --runInBand
git add src/app.tsx src/app.test.tsx src/aiCallNavigation.tsx src/components/TenantSwitch src/components/NotificationCenter src/pages/agentWorkbench/hooks/useAgentEvents.ts
git commit -m "feat: 完成权限与实时事件联动"
```

## 任务 9：执行完整自动化验证

**文件：**
- 修改：仅限验证暴露出的直接相关文件

- [ ] **步骤 1：同步 CodeGraph 索引**

在目标仓库初始化或同步 CodeGraph；如果目标仓库没有 CodeGraph 配置，记录该事实并继续使用定向 `rg`，不得复制源仓库 `.codegraph/`。

运行：`codegraph sync`

预期：索引同步成功，或明确输出“目标仓库尚未初始化”。

- [ ] **步骤 2：运行完整单元测试**

运行：`npm test -- --runInBand`

预期：全部测试 PASS，退出码为 0，并记录最终 suites/tests 数量。

- [ ] **步骤 3：运行静态检查**

```bash
npm run tsc
npm run biome:lint
```

预期：两条命令退出码均为 0。

- [ ] **步骤 4：运行生产构建**

运行：`npm run build`

预期：退出码为 0，生成 `dist/index.html` 和带 hash 的静态资源。

- [ ] **步骤 5：扫描构建产物**

```bash
test -f dist/index.html
if rg -n "192\.168\.|localhost:|127\.0\.0\.1:19011|/ai-call-lab-api|recov-ai-web-react" dist; then exit 1; fi
```

预期：入口文件存在，构建产物不包含本地地址、旧 Lab 代理或源仓库名称。

- [ ] **步骤 6：检查 Git 边界并提交验证修复**

```bash
git status --short
git diff --check
```

若验证产生修复，按直接原因提交一次：

```bash
git add src config tests package.json package-lock.json
git commit -m "fix: 收口独立构建兼容性"
```

如果没有修复，不创建空提交。

## 任务 10：在 `8078` 做本地集成验收

**文件：**
- 不修改业务文件；只记录运行证据

- [ ] **步骤 1：核对本地监听和上游**

```bash
lsof -nP -iTCP:8077 -sTCP:LISTEN
lsof -nP -iTCP:8078 -sTCP:LISTEN
lsof -nP -iTCP:8080 -sTCP:LISTEN
lsof -nP -iTCP:19011 -sTCP:LISTEN
```

预期：确认 8077 属于 Recov；启动新站前 8078 未被占用；8080 与 19011 的真实状态被记录。上游未运行时先恢复相应本地服务，不修改代理到其他工作区。

- [ ] **步骤 2：启动独立站**

运行：`npm run dev`

预期：Umi 在 `http://127.0.0.1:8078` 完成 Bundling，8077 不受影响。

- [ ] **步骤 3：验证登录与权限**

在浏览器依次验证：

- 未登录深链跳转本站 `/user/login?redirect=...`
- 登录后回到原深链
- 管理权限、坐席权限、音色权限、Lab 权限和提示词权限账号只显示对应菜单
- 超级权限显示全部 13 项
- 无 AI Call 权限显示 403
- 退出只清理 `8078` 站点会话，不改变 `8077` 当前会话

- [ ] **步骤 4：验证租户与通知**

使用两个不同租户账号验证用户信息、通知列表、未读数量和 AI Call 列表不串租户；超级管理员切换租户后，菜单、通知和当前页面数据重新加载。

- [ ] **步骤 5：验证 AI Call 页面与媒体边界**

逐一打开 13 个菜单及任务创建/详情深链，确认没有 404、空白页或 Recov 组件引用。验证已有录音播放、对话、质检和跟进详情的只读链路；仅验证浏览器麦克风权限和 LiveKit 配置加载，不创建真实客户外呼。

- [ ] **步骤 6：验证双 SSE 与降级**

浏览器 Network 中分别确认：

- `/dev-api/resource/sse`
- `/ai-call-agent-api/ai-call/agent-console/events`（进入坐席工作台时）

离开坐席页面后第二条连接应释放；通知 SSE 保持。模拟断网后不得出现 401/403 无限重连。

- [ ] **步骤 7：形成候选版本检查点**

```bash
git status --short --branch
git log --oneline --decorate -10
```

预期：目标仓库无未提交修改。记录候选提交 SHA、自动化结果和浏览器验收结果；不要推送或部署，除非用户另行明确授权。

## 规格覆盖自检

| 规格要求 | 本计划任务 |
| --- | --- |
| 最小 Umi 项目与锁文件 | 任务 1 |
| 双同源代理和 8078 | 任务 1、2、10 |
| 13 个入口、深链和权限 | 任务 2、7、10 |
| 独立登录、Token、用户和租户 | 任务 3、4、10 |
| 通知中心与 RuoYi SSE | 任务 5、8、10 |
| AI Call service 与统一 Bearer Token | 任务 6 |
| 全部页面、录音、对话、质检、跟进和媒体 | 任务 7、10 |
| TypeScript、测试、Lint、构建 | 任务 9 |
| 不迁移 Recov 工作区与业务页面 | 任务 1、3、7、9 |
| 不发起真实客户外呼 | 执行边界、任务 10 |
| 生产部署 | 本地候选版本验收后编写独立生产部署计划 |
| Recov 清理 | 新站线上验收后编写独立源仓库清理计划 |

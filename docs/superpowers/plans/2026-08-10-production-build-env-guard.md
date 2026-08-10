# AI Reach 生产构建环境校验实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 缺少 RuoYi 登录加密配置时让 `npm run build` 在 Umi 构建前失败，阻止不可登录的静态包进入发布流程。

**架构：** 新增一个无第三方依赖的 Node 校验脚本，检查四项构建环境配置并只报告无效变量名。npm `prebuild` 生命周期自动执行该脚本，测试通过子进程验证真实退出码和输出。

**技术栈：** Node.js、npm scripts、Jest、Umi Max

---

## 文件结构

- 创建 `scripts/check-build-env.js`：生产构建环境变量校验及 CLI 入口。
- 创建 `scripts/check-build-env.test.js`：验证失败和成功退出行为，不读取真实密钥。
- 修改 `package.json`：通过 `prebuild` 在现有 `build` 前自动执行校验。

### 任务 1：实现构建环境校验脚本

**文件：**
- 创建：`scripts/check-build-env.test.js`
- 创建：`scripts/check-build-env.js`

- [ ] **步骤 1：编写失败的 CLI 测试**

创建 `scripts/check-build-env.test.js`：

```js
/** @jest-environment node */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const scriptPath = path.join(__dirname, 'check-build-env.js');
const requiredKeys = [
  'UMI_APP_ENCRYPT',
  'UMI_APP_RSA_PUBLIC_KEY',
  'UMI_APP_RSA_PRIVATE_KEY',
  'UMI_APP_CLIENT_ID',
];

const runCheck = (values = {}) => {
  const env = { ...process.env };
  requiredKeys.forEach((key) => delete env[key]);
  Object.assign(env, values);
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env,
  });
};

describe('production build environment guard', () => {
  it('缺少配置时列出变量名并失败', () => {
    const result = runCheck();

    expect(result.status).toBe(1);
    requiredKeys.forEach((key) => expect(result.stderr).toContain(key));
  });

  it('加密开关不是 true 时失败且不输出配置值', () => {
    const result = runCheck({
      UMI_APP_ENCRYPT: 'false',
      UMI_APP_RSA_PUBLIC_KEY: 'public-value',
      UMI_APP_RSA_PRIVATE_KEY: 'private-value',
      UMI_APP_CLIENT_ID: 'client-value',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('UMI_APP_ENCRYPT');
    expect(result.stderr).not.toContain('public-value');
    expect(result.stderr).not.toContain('private-value');
    expect(result.stderr).not.toContain('client-value');
  });

  it('配置完整时成功且没有错误输出', () => {
    const result = runCheck({
      UMI_APP_ENCRYPT: 'true',
      UMI_APP_RSA_PUBLIC_KEY: 'public-value',
      UMI_APP_RSA_PRIVATE_KEY: 'private-value',
      UMI_APP_CLIENT_ID: 'client-value',
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });
});
```

- [ ] **步骤 2：运行测试并确认红灯**

运行：

```bash
npx jest scripts/check-build-env.test.js --runInBand
```

预期：3 个测试失败；当前缺少 `scripts/check-build-env.js`，实际输出不符合期望行为。

- [ ] **步骤 3：编写最小校验实现**

创建 `scripts/check-build-env.js`：

```js
const requiredNonEmptyKeys = [
  'UMI_APP_RSA_PUBLIC_KEY',
  'UMI_APP_RSA_PRIVATE_KEY',
  'UMI_APP_CLIENT_ID',
];

const findInvalidKeys = (env) => [
  ...(env.UMI_APP_ENCRYPT === 'true' ? [] : ['UMI_APP_ENCRYPT']),
  ...requiredNonEmptyKeys.filter((key) => !env[key]?.trim()),
];

const invalidKeys = findInvalidKeys(process.env);

if (invalidKeys.length > 0) {
  console.error(`生产构建配置无效：${invalidKeys.join(', ')}`);
  process.exitCode = 1;
}
```

- [ ] **步骤 4：运行测试并确认绿灯**

运行：

```bash
npx jest scripts/check-build-env.test.js --runInBand
```

预期：`3 passed`，没有配置值出现在测试输出中。

- [ ] **步骤 5：提交校验脚本和测试**

```bash
git add scripts/check-build-env.js scripts/check-build-env.test.js
git commit -m "fix: validate production build encryption config"
```

### 任务 2：接入构建流程并完成回归验证

**文件：**
- 修改：`package.json:4-12`

- [ ] **步骤 1：添加 prebuild 生命周期**

在 `package.json` 的 `scripts` 中加入：

```json
"prebuild": "node scripts/check-build-env.js"
```

保留现有 `"build": "max build"` 不变。

- [ ] **步骤 2：验证无配置时构建被提前阻止**

运行：

```bash
env -u UMI_APP_ENCRYPT -u UMI_APP_RSA_PUBLIC_KEY -u UMI_APP_RSA_PRIVATE_KEY -u UMI_APP_CLIENT_ID npm run build
```

预期：命令退出码为 1，输出列出四个变量名，且不出现 `Umi v` 或 `Compiling Webpack`。

- [ ] **步骤 3：使用现有安全配置验证完整构建**

运行：

```bash
set -a
source /Users/liuhongli/Desktop/lingchen/recov-ai-web-react/.env.local
set +a
npm run build
```

预期：`prebuild` 通过，Umi 显示 `Compiled successfully`，命令退出码为 0。命令和日志不得打印环境变量值。

- [ ] **步骤 4：运行完整验证**

运行：

```bash
npm test -- --runInBand
npm run lint
git diff --check
```

预期：全部测试通过，Biome 与 TypeScript 检查通过，`git diff --check` 无输出。

- [ ] **步骤 5：提交构建接入**

```bash
git add package.json
git commit -m "build: enforce production environment check"
```

## 完成标准

- `npm run build` 无法再生成缺少登录加密配置的产物；
- 校验日志只包含变量名，不包含密钥或客户端配置值；
- 使用现有安全配置仍可完成生产构建；
- 全量测试、Biome 和 TypeScript 检查通过；
- 不修改或提交 `src/preferences.ts`、`src/preferences.test.ts` 的现有工作区改动。

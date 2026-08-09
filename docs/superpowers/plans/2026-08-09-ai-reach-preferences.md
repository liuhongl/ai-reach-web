# AI Reach 偏好设置实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 AI Reach 增加可持久化的整体风格、主题色、固定顶栏和固定侧边栏设置。

**架构：** 使用一个小型 LocalStorage 适配器负责字段校验和容错；自定义 Ant Design Drawer 只展示四项正式用户配置；Umi initial state 保存当前 ProLayout 设置，修改后立即驱动布局重渲染。

**技术栈：** React 19、Umi Max 4、Ant Design 6、ProLayout、Jest、Testing Library。

---

## 文件结构

- 创建 `src/preferences.ts`：偏好类型、默认值、合法值、读取和保存。
- 创建 `src/preferences.test.ts`：默认值、合法值、逐字段回退和存储异常测试。
- 创建 `src/components/PreferencesDrawer/index.tsx`：四项偏好控件和即时更新。
- 创建 `src/components/PreferencesDrawer/index.test.tsx`：渲染与交互测试。
- 修改 `src/components/UserMenu/index.tsx`：增加“偏好设置”入口。
- 修改 `src/components/UserMenu/index.test.tsx`：验证入口打开抽屉。
- 修改 `src/app.tsx`：初始化持久化设置、挂载抽屉并应用运行时布局。
- 修改 `src/app.test.tsx`：验证持久化设置进入 initial state 和 ProLayout。

### 任务 1：偏好存储

**文件：**
- 创建：`src/preferences.ts`
- 测试：`src/preferences.test.ts`

- [ ] **步骤 1：编写失败的存储测试**

```ts
expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ colorPrimary: '#1677FF' }));
expect(readPreferences()).toMatchObject({ colorPrimary: '#1677FF', appearance: 'light' });
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test -- --runInBand src/preferences.test.ts`

预期：FAIL，模块 `./preferences` 不存在。

- [ ] **步骤 3：实现最小存储适配器**

```ts
export type AiReachPreferences = {
  appearance: 'light' | 'dark-nav';
  colorPrimary: '#722ED1' | '#1677FF' | '#13C2C2' | '#52C41A';
  fixedHeader: boolean;
  fixSiderbar: boolean;
};

export const readPreferences = (): AiReachPreferences => {
  try {
    const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
    return validateEachField(value);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
};

export const writePreferences = (value: AiReachPreferences) => {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value));
  } catch {}
};
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npm test -- --runInBand src/preferences.test.ts`

预期：PASS。

### 任务 2：偏好设置抽屉和用户菜单入口

**文件：**
- 创建：`src/components/PreferencesDrawer/index.tsx`
- 测试：`src/components/PreferencesDrawer/index.test.tsx`
- 修改：`src/components/UserMenu/index.tsx`
- 测试：`src/components/UserMenu/index.test.tsx`

- [ ] **步骤 1：编写失败的入口和控件测试**

```tsx
expect(dropdownProps.menu.items.some((item: any) => item?.key === 'preferences')).toBe(true);
fireEvent.click(screen.getByText('科技蓝'));
expect(mockSetInitialState).toHaveBeenCalled();
expect(localStorage.getItem(PREFERENCES_KEY)).toContain('#1677FF');
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test -- --runInBand src/components/UserMenu/index.test.tsx src/components/PreferencesDrawer/index.test.tsx`

预期：FAIL，菜单入口和抽屉组件不存在。

- [ ] **步骤 3：实现最小 UI**

```tsx
<Drawer title="偏好设置" open={open} onClose={close}>
  <Radio.Group options={appearanceOptions} value={preferences.appearance} />
  <Radio.Group options={colorOptions} value={preferences.colorPrimary} />
  <Switch checked={preferences.fixedHeader} />
  <Switch checked={preferences.fixSiderbar} />
</Drawer>
```

菜单点击 `preferences` 时只设置 `preferencesOpen: true`；修改任一偏好时写入 LocalStorage，并同步更新 `initialState.settings`。

- [ ] **步骤 4：运行测试验证通过**

运行：`npm test -- --runInBand src/components/UserMenu/index.test.tsx src/components/PreferencesDrawer/index.test.tsx`

预期：PASS。

### 任务 3：Umi 运行时接入与完整验证

**文件：**
- 修改：`src/app.tsx`
- 测试：`src/app.test.tsx`

- [ ] **步骤 1：编写失败的运行时测试**

```ts
localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
  appearance: 'dark-nav',
  colorPrimary: '#1677FF',
  fixedHeader: true,
  fixSiderbar: false,
}));
const state = await getInitialState();
expect(state.settings).toMatchObject({
  navTheme: 'dark',
  colorPrimary: '#1677FF',
  fixedHeader: true,
  fixSiderbar: false,
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test -- --runInBand src/app.test.tsx`

预期：FAIL，运行时仍只使用 `defaultSettings`。

- [ ] **步骤 3：接入 initial state 和 ProLayout**

`getInitialState()` 读取偏好并生成 `settings`；`layout()` 合并 `initialState.settings`，在 `childrenRender` 中挂载一个 `PreferencesDrawer`。登录页和未登录跳转分支使用同一偏好生成逻辑。

- [ ] **步骤 4：运行针对性验证**

运行：

```bash
npm test -- --runInBand src/preferences.test.ts src/components/UserMenu/index.test.tsx src/components/PreferencesDrawer/index.test.tsx src/app.test.tsx
npm run tsc
npm run biome:lint
npm run build
```

预期：全部退出码为 0。

- [ ] **步骤 5：提交实现**

```bash
git add src/preferences.ts src/preferences.test.ts src/components/PreferencesDrawer src/components/UserMenu src/app.tsx src/app.test.tsx
git commit -m "feat: 添加 AI Reach 偏好设置"
```

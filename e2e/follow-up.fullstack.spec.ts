import { expect, type Page, type Route, test } from '@playwright/test';

const ok = (route: Route, payload: unknown) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });

const installLoginShell = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('Admin-Token', 'fullstack-e2e-token');
  });

  await page.route('**/dev-api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/system/user/getInfo')) {
      return ok(route, {
        code: 200,
        data: {
          user: { userId: 1, userName: 'e2e-admin', nickName: '测试管理员' },
          roles: ['admin'],
          permissions: ['ai_call:agent:manage', 'ai_call:agent:console'],
        },
      });
    }
    if (pathname.endsWith('/resource/sse')) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: '',
      });
    }
    return ok(route, { code: 200, data: null, rows: [], total: 0 });
  });
};

test('真实前端、代理、后端与 SQLite 完成分类和安排回访闭环', async ({
  page,
}) => {
  const businessRequests: string[] = [];
  const failedResponses: string[] = [];
  let callRequests = 0;

  await installLoginShell(page);
  await page.route('**/ai-call-agent-api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    businessRequests.push(`${method} ${pathname}`);

    if (
      method === 'POST' &&
      /\/(?:sessions|sip-sessions|runtime\/start-call|follow-ups\/[^/]+\/call|follow-up-data\/[^/]+\/call)$/.test(
        pathname,
      )
    ) {
      callRequests += 1;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 500, msg: 'E2E 禁止真实呼叫' }),
      });
    }

    const headers = { ...request.headers() };
    delete headers.authorization;
    return route.continue({ headers });
  });
  page.on('response', (response) => {
    if (
      response.url().includes('/ai-call-agent-api/') &&
      response.status() >= 400
    ) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/ai-call/follow-up-data');
  await expect(page.getByText('科技公司', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '调整分类' }).click();
  const classificationDialog = page.getByRole('dialog', { name: '调整分类' });
  await classificationDialog.getByRole('combobox').click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText('持续跟进', { exact: true })
    .click();
  await classificationDialog
    .getByPlaceholder('说明本次分类判断依据')
    .fill('客户需要内部评估，后续继续沟通。');
  await classificationDialog.getByRole('button', { name: '确认调整' }).click();
  await expect(page.getByText('分类已更新')).toBeVisible();

  await page.getByRole('tab', { name: '持续跟进' }).click();
  await expect(page.getByText('科技公司', { exact: true })).toBeVisible();
  await expect(page.getByText('人工确认')).toBeVisible();

  await page.getByRole('button', { name: '安排回访' }).click();
  const scheduleDialog = page.getByRole('dialog', { name: '安排回访' });
  await scheduleDialog
    .getByPlaceholder('说明本次需要回访的目标或原因')
    .fill('确认客户内部评估结果。');
  const dateInput = scheduleDialog.locator('.ant-picker input');
  await dateInput.fill('2099-01-01 10:00');
  await dateInput.press('Enter');
  await scheduleDialog.getByRole('button', { name: '确认安排' }).click();
  await expect(page.getByText('回访已安排')).toBeVisible();
  await expect(page.getByRole('button', { name: '查看任务' })).toBeVisible();

  await page.reload();
  await page.getByRole('tab', { name: '持续跟进' }).click();
  await expect(page.getByText('科技公司', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看任务' })).toBeVisible();

  expect(businessRequests).toEqual(
    expect.arrayContaining([
      'PUT /ai-call-agent-api/ai-call/follow-up-data/100/classification',
      'POST /ai-call-agent-api/ai-call/follow-up-data/100/schedule',
    ]),
  );
  expect(callRequests).toBe(0);
  expect(failedResponses).toEqual([]);
});

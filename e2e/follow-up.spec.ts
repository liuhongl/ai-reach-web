import { expect, test, type Page, type Route } from '@playwright/test';

type TestState = {
  afterCallRequests: number;
  afterCallSubmitted: boolean;
  callRequests: number;
  classification: 'interested' | 'nurturing' | 'low_value' | 'converted';
  reviewRequests: number;
  reviewed: boolean;
  scheduleRequests: number;
  scheduled: boolean;
  unhandledPaths: string[];
  version: number;
};

const createState = (pendingAfterCall = false): TestState => ({
  afterCallRequests: 0,
  afterCallSubmitted: !pendingAfterCall,
  callRequests: 0,
  classification: 'interested',
  reviewRequests: 0,
  reviewed: false,
  scheduleRequests: 0,
  scheduled: false,
  unhandledPaths: [],
  version: 1,
});

const ok = (route: Route, payload: unknown) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });

const followUpRow = (state: TestState) => ({
  follow_up_data_id: '100',
  tenant_id: 'tenant-a',
  task_id: '200',
  target_id: '300',
  source_call_id: 'call-1',
  customer_name: '科技公司',
  masked_contact: '138****1001',
  task_name: 'SaaS 产品回访',
  classification: state.classification,
  classification_reason: '客户希望进一步了解产品演示。',
  classification_source: state.reviewed ? 'human' : 'ai',
  classification_confidence: state.reviewed ? null : 'low',
  suggest_review: !state.reviewed,
  low_value_reason: null,
  latest_conclusion: '客户希望下周查看产品演示。',
  last_contact_at: '2026-08-15T10:00:00+08:00',
  next_follow_up_at: state.scheduled ? '2099-01-01T10:00:00+08:00' : null,
  active_follow_up_id: state.scheduled ? '900' : null,
  follow_up_task_status: state.scheduled ? 'pending' : null,
  active_follow_up_owner_agent_identity: null,
  active_follow_up_reason: state.scheduled ? '客户要求两天后回访。' : null,
  classification_updated_at: '2026-08-15T10:00:00+08:00',
  classification_updated_by: state.reviewed ? '管理员' : 'AI',
  after_call_result_status: state.afterCallSubmitted ? 'submitted' : 'pending',
  blocking_human_call_id: state.afterCallSubmitted ? null : 'call-1',
  version: state.version,
});

const record = (state: TestState) => ({
  id: '1',
  callId: 'call-1',
  taskId: '200',
  targetId: '300',
  followUpDataId: '100',
  operatorAgentIdentity: state.afterCallSubmitted ? null : 'agent-1',
  afterCallResultStatus: state.afterCallSubmitted ? 'not_applicable' : 'pending',
  afterCallResultType: state.afterCallSubmitted ? null : 'follow_up_data',
  taskName: 'SaaS 产品回访',
  customerName: '科技公司',
  phoneNumber: '138****1001',
  attemptNo: 1,
  callResult: 'connected',
  summary: '客户希望下周查看产品演示。',
  analysisStatus: '2',
  customerIntent: 'positive',
  classificationRequiresReview: !state.reviewed,
  classificationReviewStatus: state.reviewed ? 'reviewed' : 'suggested',
  businessType: 'outbound_task',
  businessId: '200',
  entryType: state.afterCallSubmitted ? 'sip_outbound' : 'sip_callback',
  sceneCode: 'intro_product',
  status: 'completed',
  startedAt: '2026-08-15T09:57:00+08:00',
  answeredAt: '2026-08-15T09:57:05+08:00',
  endedAt: '2026-08-15T10:00:00+08:00',
  durationMs: 175_000,
  endReason: 'agent_completed',
});

const semanticAnalysis = (state: TestState) => ({
  id: '500',
  callId: 'call-1',
  analysisSceneCode: 'ai_call_semantic_analysis',
  analysisStatus: '2',
  analysisResult: {
    classification: state.classification,
    confidence: 'low',
    valid_dialogue: true,
    reason: '客户希望进一步了解产品演示。',
    evidence: ['客户：可以先看看产品演示。'],
    evidence_conflict: false,
  },
  classificationRequiresReview: !state.reviewed,
  classificationReviewStatus: state.reviewed ? 'reviewed' : 'suggested',
  followUpReviewStatus: state.reviewed ? 'confirmed' : null,
  followUpReviewedByName: state.reviewed ? '管理员' : null,
  followUpReviewedAt: state.reviewed ? '2026-08-18T10:00:00+08:00' : null,
  analysisRetryCount: 0,
});

const installApiFixtures = async (page: Page, state: TestState) => {
  await page.addInitScript(() => {
    localStorage.setItem('Admin-Token', 'e2e-token');
  });

  await page.route('**/dev-api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/system/user/getInfo')) {
      return ok(route, {
        code: 200,
        data: {
          user: { userId: 20, userName: 'manager', nickName: '测试管理员' },
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

  await page.route('**/ai-call-agent-api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();

    if (pathname.endsWith('/ai-call/outbound-tasks') && method === 'GET') {
      return ok(route, { code: 200, rows: [], total: 0 });
    }
    if (pathname.endsWith('/ai-call/agent-console/bootstrap') && method === 'GET') {
      return ok(route, {
        code: 200,
        data: {
          profile: {
            agent_identity: 'agent-1',
            display_name: '测试坐席',
            enabled: true,
            scene_codes: ['intro_product'],
          },
          presence: { agent_identity: 'agent-1', status: 'offline' },
          current_handoff: null,
        },
      });
    }
    if (pathname.endsWith('/ai-call/records') && method === 'GET') {
      return ok(route, { code: 200, rows: [record(state)], total: 1 });
    }
    if (pathname.endsWith('/ai-call/records/call-1') && method === 'GET') {
      return ok(route, {
        code: 200,
        data: {
          record: record(state),
          followUpData: {
            id: '100',
            classification: state.classification,
            latestConclusion: '客户希望下周查看产品演示。',
            activeFollowUpId: state.scheduled ? '900' : null,
            activeFollowUpStatus: state.scheduled ? 'pending' : null,
            nextFollowUpAt: state.scheduled
              ? '2099-01-01T10:00:00+08:00'
              : null,
            version: state.version,
          },
          executionConfig: null,
        },
      });
    }
    if (pathname.endsWith('/ai-call/records/call-1/recording')) {
      return ok(route, { code: 200, data: null });
    }
    if (pathname.endsWith('/ai-call/records/call-1/dialogue-segments')) {
      return ok(route, { code: 200, rows: [], total: 0 });
    }
    if (pathname.endsWith('/ai-call/records/call-1/semantic-analysis')) {
      return ok(route, {
        code: 200,
        data: state.afterCallSubmitted ? semanticAnalysis(state) : null,
      });
    }
    if (pathname.endsWith('/ai-call/records/call-1/handoffs')) {
      return ok(route, { code: 200, rows: [], total: 0 });
    }
    if (
      pathname.endsWith('/ai-call/records/call-1/classification-review') &&
      method === 'POST'
    ) {
      state.reviewRequests += 1;
      state.reviewed = true;
      state.version += 1;
      return ok(route, { code: 200, data: semanticAnalysis(state) });
    }
    if (pathname.endsWith('/ai-call/follow-up-data') && method === 'GET') {
      const rows =
        url.searchParams.get('classification') === state.classification
          ? [followUpRow(state)]
          : [];
      return ok(route, { code: 200, rows, total: rows.length });
    }
    if (pathname.endsWith('/ai-call/follow-up-data/100') && method === 'GET') {
      return ok(route, {
        code: 200,
        data: {
          ...followUpRow(state),
          timeline: [
            {
              type: 'call',
              call_id: 'call-1',
              occurred_at: '2026-08-15T10:00:00+08:00',
              entry_type: record(state).entryType,
              status: 'completed',
              duration_ms: 175_000,
              conclusion: '客户希望下周查看产品演示。',
              after_call_result_status: followUpRow(state).after_call_result_status,
            },
          ],
        },
      });
    }
    if (
      pathname.endsWith('/ai-call/follow-up-data/100/schedule') &&
      method === 'POST'
    ) {
      state.scheduleRequests += 1;
      state.scheduled = true;
      state.version += 1;
      return ok(route, {
        code: 200,
        data: { follow_up_data_id: '100', follow_up_id: '900', version: state.version },
      });
    }
    if (
      pathname.endsWith('/ai-call/agent-console/follow-up-data/100/handling-results') &&
      method === 'POST'
    ) {
      state.afterCallRequests += 1;
      state.afterCallSubmitted = true;
      state.version += 1;
      return ok(route, {
        code: 200,
        data: {
          follow_up_data_id: '100',
          classification: state.classification,
          version: state.version,
          follow_up: null,
          handling_result: { id: 'result-1' },
        },
      });
    }
    if (/\/follow-up-data\/[^/]+\/call$/.test(pathname) && method === 'POST') {
      state.callRequests += 1;
      return ok(route, { code: 500, msg: 'E2E 禁止真实外呼' });
    }

    state.unhandledPaths.push(`${method} ${pathname}`);
    return ok(route, { code: 200, data: null, rows: [], total: 0 });
  });
};

test('采纳 AI 分类后在跟进数据中展示人工确认结果', async ({ page }) => {
  const state = createState();
  await installApiFixtures(page, state);

  await page.goto('/ai-call/records');
  await page
    .getByRole('button', { name: '查看详情', exact: true })
    .click();
  const drawer = page.getByRole('dialog', { name: '通话记录详情' });
  await drawer.getByRole('button', { name: '采纳 AI 分类' }).click();
  await expect(page.getByText('分类复核已提交')).toBeVisible();

  await page.goto('/ai-call/follow-up-data');
  await expect(page.getByText('科技公司')).toBeVisible();
  await expect(page.getByText('人工确认')).toBeVisible();
  expect(state.reviewRequests).toBe(1);
  expect(state.scheduleRequests).toBe(0);
  expect(state.callRequests).toBe(0);
  expect(state.unhandledPaths).toEqual([]);
});

test('安排回访只创建一条任务并刷新操作入口', async ({ page }) => {
  const state = createState();
  await installApiFixtures(page, state);

  await page.goto('/ai-call/follow-up-data');
  await page.getByRole('button', { name: '安排回访' }).click();
  const dialog = page.getByRole('dialog', { name: '安排回访' });
  await dialog
    .getByPlaceholder('说明本次需要回访的目标或原因')
    .fill('客户要求两天后回访。');
  const dateInput = dialog.locator('.ant-picker input');
  await dateInput.fill('2099-01-01 10:00');
  await dateInput.press('Enter');
  await dialog.getByRole('button', { name: '确认安排' }).click();

  await expect(page.getByText('回访已安排')).toBeVisible();
  await expect(page.getByRole('button', { name: '查看任务' })).toBeVisible();
  expect(state.scheduleRequests).toBe(1);
  expect(state.callRequests).toBe(0);
  expect(state.unhandledPaths).toEqual([]);
});

test('待提交人工通话可以从通话记录恢复并提交', async ({ page }) => {
  const state = createState(true);
  await installApiFixtures(page, state);

  await page.goto('/ai-call/records');
  await page.getByRole('button', { name: '提交话后结果' }).click();
  const drawer = page.getByRole('dialog', { name: '通话记录详情' });
  await expect(drawer.getByText('待提交话后结果')).toBeVisible();
  await drawer.getByRole('button', { name: '提交话后结果' }).click();

  await expect(page.getByText('话后结果已提交')).toBeVisible();
  await expect(drawer.getByText('待提交话后结果')).not.toBeVisible();
  expect(state.afterCallRequests).toBe(1);
  expect(state.callRequests).toBe(0);
  expect(state.unhandledPaths).toEqual([]);
});

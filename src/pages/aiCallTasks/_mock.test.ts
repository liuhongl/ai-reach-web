import mockRoutes from './_mock';

type MockHandler = (
  req: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    params: Record<string, string>;
    query: Record<string, unknown>;
  },
  res: MockResponse,
) => unknown;

type MockResponse = {
  statusCode: number;
  body?: unknown;
  status: (code: number) => MockResponse;
  json: (body: unknown) => unknown;
};

const createResponse = (): MockResponse => {
  const response: MockResponse = {
    statusCode: 200,
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(body) {
      response.body = body;
      return body;
    },
  };
  return response;
};

const getHandler = (route: string) =>
  (mockRoutes as unknown as Record<string, MockHandler>)[route];

const invoke = (
  route: string,
  params: Record<string, string>,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) => {
  const response = createResponse();
  getHandler(route)({ body, headers, params, query: {} }, response);
  return response;
};

const createScheduledSingleTask = (phoneNumber = '19900001001'): string => {
  const validation = invoke(
    'POST /ai-call-agent-api/ai-call/outbound-validations/single',
    {},
    {
      taskName: 'Linphone Mock 验收任务',
      taskMode: 'single',
      phoneNumber,
      customerName: '验收客户',
      promptProfileId: '1',
      sceneCode: 'intro_geo',
      voice: 'Tina',
      ruleId: 'rule-workday',
      executionMode: 'scheduled',
      scheduledAt: '2026-07-28 10:00:00',
    },
  );
  const validationId = (validation.body as { data: { validationId: string } })
    .data.validationId;
  const created = invoke(
    'POST /ai-call-agent-api/ai-call/outbound-tasks',
    {},
    {
      taskName: 'Linphone Mock 验收任务',
      taskMode: 'single',
      promptProfileId: '1',
      sceneCode: 'intro_geo',
      voice: 'Tina',
      ruleId: 'rule-workday',
      executionMode: 'scheduled',
      scheduledAt: '2026-07-28 10:00:00',
      validationId,
    },
  );
  return (created.body as { data: { taskId: string } }).data.taskId;
};

describe('AI Call task mock', () => {
  it('keeps the validated single target and configuration in task detail', () => {
    const validationResponse = createResponse();
    getHandler('POST /ai-call-agent-api/ai-call/outbound-validations/single')(
      {
        body: {
          taskName: '浏览器验收单号任务',
          taskMode: 'single',
          phoneNumber: '13800138000',
          customerName: '验收客户',
          promptProfileId: '1',
          sceneCode: 'intro_geo',
          voice: 'Tina',
          ruleId: 'rule-workday',
          executionMode: 'scheduled',
          scheduledAt: '2026-07-28 10:00:00',
        },
        params: {},
        query: {},
      },
      validationResponse,
    );

    const validationId = (
      validationResponse.body as {
        data: { validationId: string };
      }
    ).data.validationId;
    const createResponseBody = createResponse();
    getHandler('POST /ai-call-agent-api/ai-call/outbound-tasks')(
      {
        body: {
          taskName: '浏览器验收单号任务',
          taskMode: 'single',
          promptProfileId: '1',
          sceneCode: 'intro_geo',
          voice: 'Tina',
          ruleId: 'rule-workday',
          executionMode: 'scheduled',
          scheduledAt: '2026-07-28 10:00:00',
          validationId,
        },
        params: {},
        query: {},
      },
      createResponseBody,
    );

    const taskId = (
      createResponseBody.body as {
        data: { taskId: string };
      }
    ).data.taskId;
    const detailResponse = createResponse();
    getHandler('GET /ai-call-agent-api/ai-call/outbound-tasks/:taskId')(
      { body: {}, params: { taskId }, query: {} },
      detailResponse,
    );
    const targetsResponse = createResponse();
    getHandler('GET /ai-call-agent-api/ai-call/outbound-tasks/:taskId/targets')(
      { body: {}, params: { taskId }, query: {} },
      targetsResponse,
    );

    expect(detailResponse.body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          promptName: 'GEO 产品介绍',
          sceneCode: 'intro_geo',
          voiceName: 'Tina',
        }),
      }),
    );
    expect(targetsResponse.body).toEqual(
      expect.objectContaining({
        rows: [
          expect.objectContaining({
            phoneNumber: '13800138000',
            customerName: '验收客户',
          }),
        ],
        total: 1,
      }),
    );
  });

  it('creates pageable target rows for a validated batch task', () => {
    const validationResponse = createResponse();
    getHandler('POST /ai-call-agent-api/ai-call/outbound-validations/batch')(
      {
        body: {
          file: { name: '外呼名单.xlsx' },
          request: JSON.stringify({
            taskName: '浏览器验收名单任务',
            taskMode: 'batch',
            promptProfileId: '1',
            sceneCode: 'intro_geo',
            voice: 'Tina',
            ruleId: 'rule-workday',
            executionMode: 'scheduled',
            scheduledAt: '2026-07-28 10:00:00',
          }),
        },
        params: {},
        query: {},
      },
      validationResponse,
    );

    const validationId = (
      validationResponse.body as {
        data: { validationId: string };
      }
    ).data.validationId;
    const createResponseBody = createResponse();
    getHandler('POST /ai-call-agent-api/ai-call/outbound-tasks')(
      {
        body: {
          taskName: '浏览器验收名单任务',
          taskMode: 'batch',
          promptProfileId: '1',
          sceneCode: 'intro_geo',
          voice: 'Tina',
          ruleId: 'rule-workday',
          executionMode: 'scheduled',
          scheduledAt: '2026-07-28 10:00:00',
          validationId,
        },
        params: {},
        query: {},
      },
      createResponseBody,
    );

    const taskId = (
      createResponseBody.body as {
        data: { taskId: string };
      }
    ).data.taskId;
    const firstPageResponse = createResponse();
    getHandler('GET /ai-call-agent-api/ai-call/outbound-tasks/:taskId/targets')(
      {
        body: {},
        params: { taskId },
        query: { pageNum: 1, pageSize: 10 },
      },
      firstPageResponse,
    );
    const secondPageResponse = createResponse();
    getHandler('GET /ai-call-agent-api/ai-call/outbound-tasks/:taskId/targets')(
      {
        body: {},
        params: { taskId },
        query: { pageNum: 2, pageSize: 10 },
      },
      secondPageResponse,
    );

    expect(firstPageResponse.body).toEqual(
      expect.objectContaining({
        rows: expect.arrayContaining([
          expect.objectContaining({
            taskId,
            phoneNumber: expect.stringMatching(/^1\d{10}$/),
          }),
        ]),
        total: 18,
      }),
    );
    expect((secondPageResponse.body as { rows: unknown[] }).rows).toHaveLength(
      8,
    );
  });

  it('exposes direct batch validation retry without a file upload route', () => {
    expect(
      Object.keys(mockRoutes).some(
        (route) => route.includes('/resource/') && route.includes('/upload'),
      ),
    ).toBe(false);

    const systemErrors: Array<{
      validationId: string;
      retryAction: 'REUPLOAD' | 'RETRY_VALIDATION';
    }> = [];
    for (let index = 0; index < 6 && systemErrors.length < 2; index += 1) {
      const validationResponse = createResponse();
      getHandler('POST /ai-call-agent-api/ai-call/outbound-validations/batch')(
        {
          body: {
            file: { name: `外呼名单-${index}.xlsx` },
            request: JSON.stringify({ taskMode: 'batch' }),
          },
          params: {},
          query: {},
        },
        validationResponse,
      );
      const validationId = (
        validationResponse.body as {
          data: { validationId: string };
        }
      ).data.validationId;
      const resultResponse = createResponse();
      const getValidation = getHandler(
        'GET /ai-call-agent-api/ai-call/outbound-validations/:validationId',
      );
      getValidation(
        { body: {}, params: { validationId }, query: {} },
        resultResponse,
      );
      getValidation(
        { body: {}, params: { validationId }, query: {} },
        resultResponse,
      );
      const result = (
        resultResponse.body as {
          data: {
            status: string;
            retryAction?: 'REUPLOAD' | 'RETRY_VALIDATION';
          };
        }
      ).data;
      if (result.status === 'SYSTEM_ERROR' && result.retryAction) {
        systemErrors.push({ validationId, retryAction: result.retryAction });
      }
    }

    expect(systemErrors.map((item) => item.retryAction)).toEqual(
      expect.arrayContaining(['REUPLOAD', 'RETRY_VALIDATION']),
    );
    const retryable = systemErrors.find(
      (item) => item.retryAction === 'RETRY_VALIDATION',
    );
    const reupload = systemErrors.find(
      (item) => item.retryAction === 'REUPLOAD',
    );
    if (!retryable || !reupload) {
      throw new Error('Mock 未生成两类系统错误');
    }

    const retryResponse = createResponse();
    const retryHandler = getHandler(
      'POST /ai-call-agent-api/ai-call/outbound-validations/:validationId/retry',
    );
    retryHandler(
      { body: {}, params: { validationId: retryable.validationId }, query: {} },
      retryResponse,
    );
    expect(retryResponse.body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          validationId: retryable.validationId,
          status: 'VALIDATING',
        }),
      }),
    );

    const rejectedResponse = createResponse();
    retryHandler(
      { body: {}, params: { validationId: reupload.validationId }, query: {} },
      rejectedResponse,
    );
    expect(rejectedResponse.statusCode).toBe(409);
  });

  it('simulates an idempotent AI-only Linphone test lifecycle', () => {
    const taskId = createScheduledSingleTask();
    const capability = invoke(
      'GET /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/capability',
      { taskId },
    );

    expect(capability.body).toEqual(
      expect.objectContaining({
        code: 200,
        data: expect.objectContaining({
          enabled: true,
          eligible: true,
          activeCallId: null,
          canEndActiveCall: false,
        }),
      }),
    );

    const accepted = invoke(
      'POST /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/runs',
      { taskId },
      { scenario: 'ai_only' },
      { 'idempotency-key': 'mock-ai-only-1' },
    );
    const repeated = invoke(
      'POST /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/runs',
      { taskId },
      { scenario: 'ai_only' },
      { 'idempotency-key': 'mock-ai-only-1' },
    );

    expect(accepted.body).toEqual(
      expect.objectContaining({
        code: 200,
        data: expect.objectContaining({
          accepted: true,
          taskId,
          attemptId: expect.stringMatching(/^attempt-test-/),
          callId: expect.stringMatching(/^call-test-/),
        }),
      }),
    );
    expect(repeated.body).toEqual(accepted.body);

    const phases = Array.from({ length: 3 }, () => {
      const status = invoke(
        'GET /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/status',
        { taskId },
      );
      return (status.body as { data: { phase: string } }).data.phase;
    });
    expect(phases).toEqual(['dialing', 'ai_call', 'completed']);
  });

  it('guards the global slot and advances the handoff lifecycle', () => {
    const activeTaskId = createScheduledSingleTask();
    const blockedTaskId = createScheduledSingleTask();
    invoke(
      'POST /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/runs',
      { taskId: activeTaskId },
      { scenario: 'handoff' },
      { 'idempotency-key': 'mock-handoff-1' },
    );

    const activeCapability = invoke(
      'GET /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/capability',
      { taskId: activeTaskId },
    );
    expect(activeCapability.body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          eligible: false,
          activeCallId: expect.stringMatching(/^call-test-/),
          canEndActiveCall: true,
        }),
      }),
    );

    const blockedCapability = invoke(
      'GET /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/capability',
      { taskId: blockedTaskId },
    );
    expect(blockedCapability.body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          eligible: false,
          activeCallId: null,
          canEndActiveCall: false,
          reasons: expect.arrayContaining(['当前已有本机测试通话进行中']),
        }),
      }),
    );

    const phases = Array.from({ length: 5 }, () => {
      const status = invoke(
        'GET /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/status',
        { taskId: activeTaskId },
      );
      return (status.body as { data: { phase: string } }).data.phase;
    });
    expect(phases).toEqual([
      'dialing',
      'ai_call',
      'waiting_handoff',
      'human_call',
      'completed',
    ]);
  });

  it('ends the active mock call immediately', () => {
    const taskId = createScheduledSingleTask();
    invoke(
      'POST /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/runs',
      { taskId },
      { scenario: 'handoff' },
      { 'idempotency-key': 'mock-end-1' },
    );

    const ended = invoke(
      'POST /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/active-call/end',
      { taskId },
      {},
      { 'idempotency-key': 'mock-end-command-1' },
    );
    const status = invoke(
      'GET /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/status',
      { taskId },
    );

    expect(ended.body).toEqual({
      code: 200,
      msg: '结束通话已受理',
      data: { accepted: true },
    });
    expect(status.body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId,
          phase: 'completed',
          targetStatus: 'COMPLETED',
          attemptStatus: 'COMPLETED',
          canEndActiveCall: false,
        }),
      }),
    );
  });
});

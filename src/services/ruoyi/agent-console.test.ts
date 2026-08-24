import { ruoyiRequest } from '@/adapters/ruoyi/request';
import * as agentConsole from './agent-console';

jest.mock('@/adapters/ruoyi/request', () => ({
  ruoyiRequest: jest.fn(),
}));

const mockedRequest = ruoyiRequest as jest.Mock;
const service = agentConsole as unknown as Record<
  string,
  ((...args: unknown[]) => Promise<unknown>) | string
>;

const call = (name: string, ...args: unknown[]) => {
  const operation = service[name];
  if (typeof operation !== 'function') {
    throw new Error(`Missing agent console service operation: ${name}`);
  }
  return operation(...args);
};

describe('agent console service contract', () => {
  beforeEach(() => {
    mockedRequest.mockReset();
    mockedRequest.mockResolvedValue({ code: 200, data: {} });
  });

  it('freezes the backend contract and isolated proxy prefixes', () => {
    expect(service.AGENT_CONSOLE_BACKEND_COMMIT).toBe(
      'f6957be1307a6286473ab1b97824e9b253e0525c',
    );
    expect(service.AGENT_CONSOLE_PROXY_PREFIX).toBe('/ai-call-agent-api');
    expect(service.AGENT_CONSOLE_API_PREFIX).toBe('/ai-call/agent-console');
    expect(service.AGENT_CONSOLE_ADMIN_API_PREFIX).toBe('/ai-call/admin');
  });

  it('maps the workbench lifecycle to the frozen endpoints', async () => {
    await call('getAgentConsoleBootstrap');
    await call('setAgentOnline', {
      consoleSessionId: 'session-1',
      devicePreflightPassed: true,
    });
    await call('pauseAgent', { consoleSessionId: 'session-1' });
    await call('setAgentOffline', { consoleSessionId: 'session-1' });
    await call('heartbeatAgent', { consoleSessionId: 'session-1' });
    await call('getPendingHandoffs', {
      consoleSessionId: 'session-1',
      limit: 100,
    });
    await call('claimHandoff', 'handoff-1', {
      consoleSessionId: 'session-1',
      idempotencyKey: 'claim-1',
    });
    await call('confirmHandoffMediaReady', 'handoff-1', {
      consoleSessionId: 'session-1',
      participantIdentity: 'human-agent-handoff-1',
      idempotencyKey: 'media-1',
    });
    await call('getHandoffReconnectToken', 'handoff-1', {
      consoleSessionId: 'session-1',
      idempotencyKey: 'reconnect-1',
    });
    await call('completeHandoff', 'handoff-1', {
      consoleSessionId: 'session-1',
      idempotencyKey: 'complete-1',
    });
    await call('submitAfterCallWork', 'call-1', {
      handoffId: 'handoff-1',
      dispositionCode: 'resolved',
      needsFollowUp: false,
      idempotencyKey: 'acw-1',
    });

    expect(mockedRequest.mock.calls.map(([url]) => url)).toEqual([
      '/ai-call/agent-console/bootstrap',
      '/ai-call/agent-console/presence/online',
      '/ai-call/agent-console/presence/pause',
      '/ai-call/agent-console/presence/offline',
      '/ai-call/agent-console/presence/heartbeat',
      '/ai-call/agent-console/handoffs/pending',
      '/ai-call/agent-console/handoffs/handoff-1/claim',
      '/ai-call/agent-console/handoffs/handoff-1/media-ready',
      '/ai-call/agent-console/handoffs/handoff-1/reconnect-token',
      '/ai-call/agent-console/handoffs/handoff-1/complete',
      '/ai-call/agent-console/calls/call-1/after-call-work',
    ]);
    expect(mockedRequest.mock.calls.every(([, options]) =>
      options.baseApi === '/ai-call-agent-api',
    )).toBe(true);
    expect(mockedRequest.mock.calls[1][1]).toMatchObject({
      method: 'post',
      data: {
        console_session_id: 'session-1',
        device_preflight_passed: true,
      },
    });
    expect(mockedRequest.mock.calls[5][1]).toMatchObject({
      method: 'get',
      skipErrorHandler: true,
      params: {
        console_session_id: 'session-1',
        limit: 100,
      },
    });
    expect(mockedRequest.mock.calls[0][1]).toMatchObject({
      method: 'get',
      skipErrorHandler: true,
    });
    expect(mockedRequest.mock.calls[1][1]).not.toHaveProperty(
      'skipErrorHandler',
    );
    expect(mockedRequest.mock.calls[6][1]).toMatchObject({
      method: 'post',
      headers: { 'Idempotency-Key': 'claim-1' },
      data: { console_session_id: 'session-1' },
    });
    expect(mockedRequest.mock.calls[7][1]).toMatchObject({
      method: 'post',
      headers: { 'Idempotency-Key': 'media-1' },
      data: {
        console_session_id: 'session-1',
        participant_identity: 'human-agent-handoff-1',
      },
    });
    expect(mockedRequest.mock.calls[10][1]).toMatchObject({
      method: 'put',
      headers: { 'Idempotency-Key': 'acw-1' },
      data: {
        handoff_id: 'handoff-1',
        disposition_code: 'resolved',
        needs_follow_up: false,
      },
    });
  });

  it('maps follow-up ownership and atomic handling results to their endpoints', async () => {
    await call('listAgentFollowUps', {
      status: ['pending'],
      sceneCode: 'intro_geo',
      customerName: '张三',
      createdAtBegin: '2026-08-05T00:00:00.000Z',
      createdAtEnd: '2026-08-05T23:59:59.999Z',
    });
    await call('getAgentFollowUp', 'follow-up-1');
    await call('submitFollowUpHandlingResult', 'follow-up-1', {
      callId: 'call-1',
      contactResult: 'connected',
      remark: '客户确认需求，明天下午继续沟通',
      nextAction: 'continue',
      nextFollowUpAt: '2026-08-06T07:00:00.000Z',
      idempotencyKey: 'handling-result-1',
    });
    await call('claimFollowUp', 'follow-up-1', 'follow-up-claim-1');
    await call('startFollowUpCall', 'follow-up-1', {
      consoleSessionId: 'session-1',
      idempotencyKey: 'follow-up-call-1',
    });
    await call('confirmFollowUpCallConnected', 'follow-up-1', 'call-1', {
      consoleSessionId: 'session-1',
      idempotencyKey: 'follow-up-connected-1',
    });
    await call('endFollowUpCall', 'follow-up-1', 'call-1', {
      consoleSessionId: 'session-1',
      idempotencyKey: 'follow-up-end-1',
    });

    expect(mockedRequest.mock.calls.map(([url]) => url)).toEqual([
      '/ai-call/agent-console/follow-ups',
      '/ai-call/agent-console/follow-ups/follow-up-1',
      '/ai-call/agent-console/follow-ups/follow-up-1/handling-results',
      '/ai-call/agent-console/follow-ups/follow-up-1/claim',
      '/ai-call/agent-console/follow-ups/follow-up-1/call',
      '/ai-call/agent-console/follow-ups/follow-up-1/call/call-1/connected',
      '/ai-call/agent-console/follow-ups/follow-up-1/call/call-1/end',
    ]);
    expect(mockedRequest.mock.calls[0][1]).toMatchObject({
      method: 'get',
      params: {
        status: 'pending',
        sceneCode: 'intro_geo',
        customerName: '张三',
        createdAtBegin: '2026-08-05T00:00:00.000Z',
        createdAtEnd: '2026-08-05T23:59:59.999Z',
      },
    });
    expect(mockedRequest.mock.calls[2][1]).toMatchObject({
      method: 'post',
      headers: { 'Idempotency-Key': 'handling-result-1' },
      data: {
        call_id: 'call-1',
        contact_result: 'connected',
        remark: '客户确认需求，明天下午继续沟通',
        next_action: 'continue',
        next_follow_up_at: '2026-08-06T07:00:00.000Z',
      },
    });
    expect(mockedRequest.mock.calls[2][1]?.data).not.toHaveProperty(
      'contact_channel',
    );
    expect(mockedRequest.mock.calls[4][1]).toMatchObject({
      headers: { 'Idempotency-Key': 'follow-up-call-1' },
      data: { console_session_id: 'session-1' },
    });
    expect(mockedRequest.mock.calls[5][1]).toMatchObject({
      headers: { 'Idempotency-Key': 'follow-up-connected-1' },
      data: { console_session_id: 'session-1' },
    });
    expect(mockedRequest.mock.calls[6][1]).toMatchObject({
      headers: { 'Idempotency-Key': 'follow-up-end-1' },
      data: { console_session_id: 'session-1' },
    });
  });

  it('maps classified after-call results without legacy fields', async () => {
    await call('submitAfterCallWork', 'call-1', {
      handoffId: 'handoff-1',
      classification: 'interested',
      conclusion: '客户希望安排产品演示',
      scheduleFollowUp: false,
      expectedVersion: 2,
      idempotencyKey: 'classified-acw-1',
    });
    await call('submitFollowUpHandlingResult', 'follow-up-1', {
      callId: 'call-2',
      contactResult: 'connected',
      classification: 'converted',
      conclusion: '坐席确认客户已完成转化',
      scheduleFollowUp: false,
      expectedVersion: 3,
      idempotencyKey: 'classified-handling-1',
    });

    expect(mockedRequest.mock.calls[0][1]).toMatchObject({
      headers: { 'Idempotency-Key': 'classified-acw-1' },
      data: {
        handoff_id: 'handoff-1',
        classification: 'interested',
        conclusion: '客户希望安排产品演示',
        schedule_follow_up: false,
        expected_version: 2,
      },
    });
    expect(mockedRequest.mock.calls[0][1]?.data).not.toHaveProperty(
      'disposition_code',
    );
    expect(mockedRequest.mock.calls[1][1]).toMatchObject({
      headers: { 'Idempotency-Key': 'classified-handling-1' },
      data: {
        call_id: 'call-2',
        contact_result: 'connected',
        classification: 'converted',
        conclusion: '坐席确认客户已完成转化',
        schedule_follow_up: false,
        expected_version: 3,
      },
    });
    expect(mockedRequest.mock.calls[1][1]?.data).not.toHaveProperty(
      'next_action',
    );
  });

  it('maps follow-up-data manual calls and after-call results', async () => {
    await call('startFollowUpDataCall', 'data-1', {
      consoleSessionId: 'session-1',
      idempotencyKey: 'data-call-1',
      takeover: true,
      takeoverReason: '负责人已调整，由当前坐席继续处理',
    });
    await call('confirmFollowUpDataCallConnected', 'data-1', 'call-1', {
      consoleSessionId: 'session-1',
      idempotencyKey: 'data-connected-1',
    });
    await call('endFollowUpDataCall', 'data-1', 'call-1', {
      consoleSessionId: 'session-1',
      idempotencyKey: 'data-end-1',
    });
    await call('submitFollowUpDataHandlingResult', 'data-1', {
      callId: 'call-1',
      contactResult: 'connected',
      classification: 'nurturing',
      conclusion: '客户希望下月再沟通',
      scheduleFollowUp: false,
      expectedVersion: 2,
      idempotencyKey: 'data-result-1',
    });

    expect(mockedRequest.mock.calls.map(([url]) => url)).toEqual([
      '/ai-call/agent-console/follow-up-data/data-1/call',
      '/ai-call/agent-console/follow-up-data/data-1/call/call-1/connected',
      '/ai-call/agent-console/follow-up-data/data-1/call/call-1/end',
      '/ai-call/agent-console/follow-up-data/data-1/handling-results',
    ]);
    expect(mockedRequest.mock.calls[0][1]).toMatchObject({
      method: 'post',
      headers: { 'Idempotency-Key': 'data-call-1' },
      data: {
        console_session_id: 'session-1',
        takeover: true,
        takeover_reason: '负责人已调整，由当前坐席继续处理',
      },
    });
    expect(mockedRequest.mock.calls[1][1]).toMatchObject({
      headers: { 'Idempotency-Key': 'data-connected-1' },
      data: { console_session_id: 'session-1' },
    });
    expect(mockedRequest.mock.calls[2][1]).toMatchObject({
      headers: { 'Idempotency-Key': 'data-end-1' },
      data: { console_session_id: 'session-1' },
    });
    expect(mockedRequest.mock.calls[3][1]).toMatchObject({
      headers: { 'Idempotency-Key': 'data-result-1' },
      data: {
        call_id: 'call-1',
        contact_result: 'connected',
        classification: 'nurturing',
        conclusion: '客户希望下月再沟通',
        schedule_follow_up: false,
        expected_version: 2,
      },
    });
  });

  it('loads one handoff full context without expanding the waiting pool payload', async () => {
    await call('getHandoffContext', 'handoff-1', 'session-1');

    expect(mockedRequest).toHaveBeenCalledWith(
      '/ai-call/agent-console/handoffs/handoff-1/context',
      expect.objectContaining({
        baseApi: '/ai-call-agent-api',
        method: 'get',
        skipErrorHandler: true,
        params: { console_session_id: 'session-1' },
      }),
    );
  });

  it('maps administration queries and safe recovery actions', async () => {
    await call('listAdminAgents', { status: 'available' });
    await call('createAdminAgent', {
      userId: '100',
      agentIdentity: 'agent-100',
      enabled: false,
    });
    await call('updateAdminAgent', 'agent-100', { enabled: false });
    await call('updateAdminAgentSceneScopes', 'agent-100', {
      sceneCodes: ['intro_geo'],
    });
    await call('getAdminAgentStatus', 'agent-100');
    await call('releaseStaleAgent', 'agent-100', 'release-1');
    await call('listAdminHandoffs', { status: 'failed' });
    await call('getAdminHandoff', 'handoff-1');
    await call('reconcileAdminHandoff', 'handoff-1', 'reconcile-1');
    await call('listAdminFollowUps', { status: 'pending' });
    await call('getAdminFollowUp', 'follow-up-1');

    expect(mockedRequest.mock.calls.map(([url]) => url)).toEqual([
      '/ai-call/admin/agents',
      '/ai-call/admin/agents',
      '/ai-call/admin/agents/agent-100',
      '/ai-call/admin/agents/agent-100/scene-scopes',
      '/ai-call/admin/agents/agent-100/status',
      '/ai-call/admin/agents/agent-100/release-stale',
      '/ai-call/admin/handoffs',
      '/ai-call/admin/handoffs/handoff-1',
      '/ai-call/admin/handoffs/handoff-1/reconcile',
      '/ai-call/admin/follow-ups',
      '/ai-call/admin/follow-ups/follow-up-1',
    ]);
    expect(mockedRequest.mock.calls[5][1]).toMatchObject({
      method: 'post',
      headers: { 'Idempotency-Key': 'release-1' },
    });
    expect(mockedRequest.mock.calls[8][1]).toMatchObject({
      method: 'post',
      headers: { 'Idempotency-Key': 'reconcile-1' },
      data: {
        confirmed: true,
        reason: '管理员手动重新核对异常转人工状态',
      },
    });
    expect(mockedRequest.mock.calls[1][1]).toMatchObject({
      method: 'post',
      data: {
        user_id: '100',
        agent_identity: 'agent-100',
        enabled: false,
      },
    });
    expect(mockedRequest.mock.calls[3][1]).toMatchObject({
      method: 'put',
      data: { scene_codes: ['intro_geo'] },
    });
    expect(mockedRequest.mock.calls[6][1]).toMatchObject({
      method: 'get',
      timeout: 10_000,
    });
    expect(mockedRequest.mock.calls[9][1]).toMatchObject({
      method: 'get',
      timeout: 10_000,
    });
  });
});

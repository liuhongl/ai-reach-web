import { ruoyiRequest } from '@/adapters/ruoyi/request';
import {
  createAiCallRuntimeEndCall,
  createAiCallRuntimeStartCall,
  createAiCallRuntimeToken,
  getAiCallRuntimeBootstrap,
} from './ai-call-runtime';

jest.mock('@/adapters/ruoyi/request', () => ({
  ruoyiRequest: jest.fn(),
}));

const mockRuoyiRequest = ruoyiRequest as jest.Mock;

describe('AI Call runtime entry service', () => {
  beforeEach(() => {
    mockRuoyiRequest.mockReset();
  });

  it('submits an authenticated owner START_CALL through the agent proxy', async () => {
    const accepted = {
      acceptanceStatus: 'ACCEPTED',
      commandId: '101',
      callId: 'call_101',
      commandSeq: '1',
      commandType: 'START_CALL',
      status: 'PENDING',
    };
    mockRuoyiRequest.mockResolvedValueOnce({ code: 200, data: accepted });

    await expect(
      createAiCallRuntimeStartCall({
        entryType: 'web',
        idempotencyKey: 'start:web:1',
        payload: { businessId: 'biz-1', voice: 'v1' },
        businessId: 'biz-1',
        sceneCode: 'collection',
      }),
    ).resolves.toEqual(accepted);

    expect(mockRuoyiRequest).toHaveBeenCalledWith(
      '/ai-call/runtime/start-call',
      {
        baseApi: '/ai-call-agent-api',
        method: 'post',
        data: {
          entryType: 'web',
          idempotencyKey: 'start:web:1',
          payload: { businessId: 'biz-1', voice: 'v1' },
          businessId: 'biz-1',
          sceneCode: 'collection',
        },
        repeatSubmit: false,
      },
    );
  });

  it('rejects an envelope without persistent start data', async () => {
    mockRuoyiRequest.mockResolvedValueOnce({ code: 200 });

    await expect(
      createAiCallRuntimeStartCall({
        entryType: 'preview',
        idempotencyKey: 'start:preview:1',
        payload: { voice: 'v1' },
      }),
    ).rejects.toThrow('接口响应缺少 data');
  });

  it('reads owner bootstrap readiness without treating it as a token', async () => {
    const bootstrap = {
      callId: 'call_101',
      entryType: 'web',
      phase: 'starting',
      roomName: 'ai-call-call_101',
      participantIdentity: 'agent-call_101',
      runtimeFencingToken: 7,
      agentMediaReadyAt: null,
      terminalRequestedAt: null,
      tokenAvailable: false,
      status: 'preparing',
      resourceCleanupStatus: 'not_started',
      resourceCleanupError: null,
      failureStage: null,
      failureMessage: null,
    };
    mockRuoyiRequest.mockResolvedValueOnce({ code: 200, data: bootstrap });

    const result = await getAiCallRuntimeBootstrap('call_101');

    expect(result).toEqual(bootstrap);
    expect(result.resourceCleanupStatus).toBe('not_started');
    expect(mockRuoyiRequest).toHaveBeenCalledWith(
      '/ai-call/runtime/calls/call_101/bootstrap',
      {
        baseApi: '/ai-call-agent-api',
        method: 'get',
      },
    );
  });

  it('requests a short-lived token only through the owner runtime gate', async () => {
    const token = {
      callId: 'call_101',
      roomName: 'ai-call-call_101',
      livekitUrl: 'wss://livekit.test',
      participantToken: 'signed-token',
      participantIdentity: 'caller-call_101',
      expiresInSeconds: 60,
    };
    mockRuoyiRequest.mockResolvedValueOnce({ code: 200, data: token });

    await expect(createAiCallRuntimeToken('call_101')).resolves.toEqual(token);
    expect(mockRuoyiRequest).toHaveBeenCalledWith(
      '/ai-call/runtime/calls/call_101/token',
      {
        baseApi: '/ai-call-agent-api',
        method: 'post',
        repeatSubmit: false,
      },
    );
  });

  it('submits a retry-safe END_CALL and keeps the real command status', async () => {
    const accepted = {
      acceptanceStatus: 'ACCEPTED',
      callId: 'call_101',
      commandId: '202',
      commandSeq: '2',
      commandStatus: 'PENDING',
    };
    mockRuoyiRequest.mockResolvedValueOnce({ code: 200, data: accepted });

    await expect(
      createAiCallRuntimeEndCall('call_101', {
        dedupeKey: 'call_101:web_client:click-1',
        endReason: 'user_requested',
      }),
    ).resolves.toEqual(accepted);
    expect(mockRuoyiRequest).toHaveBeenCalledWith(
      '/ai-call/runtime/calls/call_101/end',
      {
        baseApi: '/ai-call-agent-api',
        method: 'post',
        data: {
          dedupeKey: 'call_101:web_client:click-1',
          endReason: 'user_requested',
        },
        repeatSubmit: false,
      },
    );
  });
});

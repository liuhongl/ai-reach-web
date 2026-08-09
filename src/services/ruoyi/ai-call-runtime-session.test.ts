import {
  createAiCallRuntimeToken,
  getAiCallRuntimeBootstrap,
} from './ai-call-runtime';
import {
  AiCallRuntimeEndedBeforeReadyError,
  AiCallRuntimeReadyTimeoutError,
  waitForAiCallRuntimeReadyToken,
} from './ai-call-runtime-session';

jest.mock('./ai-call-runtime', () => ({
  createAiCallRuntimeToken: jest.fn(),
  getAiCallRuntimeBootstrap: jest.fn(),
}));

const bootstrapMock = getAiCallRuntimeBootstrap as jest.Mock;
const tokenMock = createAiCallRuntimeToken as jest.Mock;

const starting = {
  callId: 'call-1',
  entryType: 'web',
  phase: 'starting',
  roomName: 'ai-call-call-1',
  runtimeFencingToken: 1,
  tokenAvailable: false,
};

const ready = {
  ...starting,
  phase: 'ready',
  agentMediaReadyAt: '2026-08-01T06:00:00Z',
};

const token = {
  callId: 'call-1',
  roomName: 'ai-call-call-1',
  livekitUrl: 'wss://livekit.test',
  participantToken: 'signed-token',
  participantIdentity: 'caller-call-1',
  expiresInSeconds: 60,
};

describe('AI Call owner runtime readiness orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('polls bootstrap and requests a token only after the ready phase', async () => {
    bootstrapMock
      .mockResolvedValueOnce(starting)
      .mockResolvedValueOnce(starting)
      .mockResolvedValueOnce(ready);
    tokenMock.mockResolvedValueOnce(token);
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      waitForAiCallRuntimeReadyToken('call-1', {
        maxAttempts: 3,
        pollIntervalMs: 0,
        wait,
      }),
    ).resolves.toEqual({ bootstrap: ready, token });

    expect(bootstrapMock).toHaveBeenCalledTimes(3);
    expect(tokenMock).toHaveBeenCalledTimes(1);
    expect(tokenMock).toHaveBeenCalledWith('call-1');
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it.each([
    'ending',
    'terminal',
  ] as const)('stops without signing when bootstrap enters %s', async (phase) => {
    bootstrapMock.mockResolvedValueOnce({ ...starting, phase });

    await expect(
      waitForAiCallRuntimeReadyToken('call-1', {
        maxAttempts: 3,
        pollIntervalMs: 0,
        wait: jest.fn(),
      }),
    ).rejects.toBeInstanceOf(AiCallRuntimeEndedBeforeReadyError);
    expect(tokenMock).not.toHaveBeenCalled();
  });

  it('re-bootstraps after a retryable token gate race', async () => {
    bootstrapMock
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(starting)
      .mockResolvedValueOnce(ready);
    tokenMock
      .mockRejectedValueOnce({
        response: { data: { data: { errorCode: 'CALL_NOT_READY' } } },
      })
      .mockResolvedValueOnce(token);

    await expect(
      waitForAiCallRuntimeReadyToken('call-1', {
        maxAttempts: 3,
        pollIntervalMs: 0,
        wait: jest.fn().mockResolvedValue(undefined),
      }),
    ).resolves.toEqual({ bootstrap: ready, token });

    expect(bootstrapMock).toHaveBeenCalledTimes(3);
    expect(tokenMock).toHaveBeenCalledTimes(2);
  });

  it('fails with a stable timeout instead of polling forever', async () => {
    bootstrapMock.mockResolvedValue(starting);

    await expect(
      waitForAiCallRuntimeReadyToken('call-1', {
        maxAttempts: 2,
        pollIntervalMs: 0,
        wait: jest.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toBeInstanceOf(AiCallRuntimeReadyTimeoutError);
    expect(bootstrapMock).toHaveBeenCalledTimes(2);
    expect(tokenMock).not.toHaveBeenCalled();
  });
});

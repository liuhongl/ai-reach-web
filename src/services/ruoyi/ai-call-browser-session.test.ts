import {
  AiCallBrowserRuntimeStartError,
  createAiCallBrowserSession,
  endAiCallBrowserSession,
  getAiCallBrowserSessionState,
  reportAiCallBrowserSessionEvent,
} from './ai-call-browser-session';
import {
  createAiCallLabSession,
  endAiCallLabSession,
  getAiCallLabSession,
  reportAiCallLabBrowserEvent,
} from './ai-call-lab';
import {
  createAiCallRuntimeEndCall,
  createAiCallRuntimeStartCall,
  getAiCallRuntimeBootstrap,
} from './ai-call-runtime';
import { waitForAiCallRuntimeReadyToken } from './ai-call-runtime-session';

jest.mock('./ai-call-lab', () => ({
  createAiCallLabSession: jest.fn(),
  endAiCallLabSession: jest.fn(),
  getAiCallLabSession: jest.fn(),
  reportAiCallLabBrowserEvent: jest.fn(),
}));

jest.mock('./ai-call-runtime', () => ({
  createAiCallRuntimeEndCall: jest.fn(),
  createAiCallRuntimeStartCall: jest.fn(),
  getAiCallRuntimeBootstrap: jest.fn(),
}));

jest.mock('./ai-call-runtime-session', () => ({
  getAiCallRuntimeErrorCode: jest.requireActual('./ai-call-runtime-session')
    .getAiCallRuntimeErrorCode,
  waitForAiCallRuntimeReadyToken: jest.fn(),
}));

const createLegacyMock = createAiCallLabSession as jest.Mock;
const endLegacyMock = endAiCallLabSession as jest.Mock;
const getLegacyMock = getAiCallLabSession as jest.Mock;
const reportLegacyEventMock = reportAiCallLabBrowserEvent as jest.Mock;
const createRuntimeMock = createAiCallRuntimeStartCall as jest.Mock;
const endRuntimeMock = createAiCallRuntimeEndCall as jest.Mock;
const getRuntimeBootstrapMock = getAiCallRuntimeBootstrap as jest.Mock;
const waitRuntimeMock = waitForAiCallRuntimeReadyToken as jest.Mock;

const request = {
  idempotencyKey: 'web:browser:attempt-1',
  voice: 'Tina',
  sceneCode: 'intro_geo',
  businessId: 'biz-1',
  businessParams: { customerName: '张总' },
};

describe('AI Call browser session entry routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the owner runtime path without creating a legacy session', async () => {
    createRuntimeMock.mockResolvedValueOnce({
      acceptanceStatus: 'ACCEPTED',
      callId: 'call-owner',
      commandId: '101',
      commandSeq: '1',
      commandType: 'START_CALL',
      status: 'PENDING',
    });
    waitRuntimeMock.mockResolvedValueOnce({
      bootstrap: {
        callId: 'call-owner',
        entryType: 'web',
        phase: 'ready',
        roomName: 'ai-call-call-owner',
        runtimeFencingToken: 1,
        tokenAvailable: false,
      },
      token: {
        callId: 'call-owner',
        roomName: 'ai-call-call-owner',
        livekitUrl: 'wss://livekit.test',
        participantToken: 'owner-token',
        participantIdentity: 'caller-call-owner',
        expiresInSeconds: 60,
      },
    });

    await expect(createAiCallBrowserSession(request)).resolves.toEqual({
      runtimeControlMode: 'owner_command_v1',
      callId: 'call-owner',
      roomName: 'ai-call-call-owner',
      livekitUrl: 'wss://livekit.test',
      participantToken: 'owner-token',
      status: 'ready',
    });

    expect(createRuntimeMock).toHaveBeenCalledWith({
      entryType: 'web',
      idempotencyKey: 'web:browser:attempt-1',
      payload: {
        voice: 'Tina',
        sceneCode: 'intro_geo',
        businessId: 'biz-1',
        businessParams: { customerName: '张总' },
      },
      businessId: 'biz-1',
      sceneCode: 'intro_geo',
    });
    expect(waitRuntimeMock).toHaveBeenCalledWith('call-owner');
    expect(createLegacyMock).not.toHaveBeenCalled();
  });

  it('falls back only when the backend explicitly keeps web on legacy', async () => {
    createRuntimeMock.mockRejectedValueOnce({
      response: { data: { data: { errorCode: 'LEGACY_ENTRY_ACTIVE' } } },
    });
    createLegacyMock.mockResolvedValueOnce({
      callId: 'call-legacy',
      roomName: 'ai-call-call-legacy',
      livekitUrl: 'wss://livekit.test',
      participantToken: 'legacy-token',
      status: 'created',
    });

    await expect(createAiCallBrowserSession(request)).resolves.toEqual({
      runtimeControlMode: 'legacy_local',
      callId: 'call-legacy',
      roomName: 'ai-call-call-legacy',
      livekitUrl: 'wss://livekit.test',
      participantToken: 'legacy-token',
      status: 'created',
    });

    expect(createLegacyMock).toHaveBeenCalledWith({
      voice: 'Tina',
      sceneCode: 'intro_geo',
      businessId: 'biz-1',
      businessParams: { customerName: '张总' },
    });
    expect(waitRuntimeMock).not.toHaveBeenCalled();
  });

  it('does not create a legacy duplicate for an unrelated runtime failure', async () => {
    const failure = {
      response: { data: { data: { errorCode: 'OWNER_UNAVAILABLE' } } },
    };
    createRuntimeMock.mockRejectedValueOnce(failure);

    await expect(createAiCallBrowserSession(request)).rejects.toBe(failure);
    expect(createLegacyMock).not.toHaveBeenCalled();
  });

  it('preserves the accepted call id when readiness fails', async () => {
    createRuntimeMock.mockResolvedValueOnce({
      acceptanceStatus: 'ACCEPTED',
      callId: 'call-owner',
      commandId: '101',
      commandSeq: '1',
      commandType: 'START_CALL',
      status: 'PENDING',
    });
    waitRuntimeMock.mockRejectedValueOnce(new Error('bootstrap unavailable'));

    const failure = await createAiCallBrowserSession(request).catch(
      (error) => error,
    );

    expect(failure).toBeInstanceOf(AiCallBrowserRuntimeStartError);
    expect(failure.callId).toBe('call-owner');
    expect(failure.cause).toEqual(new Error('bootstrap unavailable'));
    expect(createLegacyMock).not.toHaveBeenCalled();
  });

  it('routes ending through the session control mode', async () => {
    endRuntimeMock.mockResolvedValueOnce({ acceptanceStatus: 'ACCEPTED' });
    endLegacyMock.mockResolvedValueOnce({ code: 200 });

    await endAiCallBrowserSession(
      {
        runtimeControlMode: 'owner_command_v1',
        callId: 'call-owner',
      },
      'call-owner:web_client:end-1',
    );
    await endAiCallBrowserSession(
      {
        runtimeControlMode: 'legacy_local',
        callId: 'call-legacy',
      },
      'unused-for-legacy',
    );

    expect(endRuntimeMock).toHaveBeenCalledWith('call-owner', {
      dedupeKey: 'call-owner:web_client:end-1',
      endReason: 'user_requested',
    });
    expect(endLegacyMock).toHaveBeenCalledWith('call-legacy');
  });

  it('refreshes owner state from bootstrap without reading the legacy registry', async () => {
    getRuntimeBootstrapMock.mockResolvedValueOnce({
      callId: 'call-owner',
      entryType: 'web',
      phase: 'terminal',
      roomName: 'ai-call-call-owner',
      runtimeFencingToken: 3,
      tokenAvailable: false,
      status: 'failed',
      resourceCleanupStatus: 'attention_required',
      resourceCleanupError: 'Provider query timed out',
      failureStage: 'runtime_start',
      failureMessage: 'START_UNCERTAIN',
    });

    await expect(
      getAiCallBrowserSessionState({
        runtimeControlMode: 'owner_command_v1',
        callId: 'call-owner',
        status: 'starting',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        callId: 'call-owner',
        roomName: 'ai-call-call-owner',
        status: 'failed',
        runtimePhase: 'terminal',
        resourceCleanupStatus: 'attention_required',
        resourceCleanupError: 'Provider query timed out',
        failureStage: 'runtime_start',
        failureMessage: 'START_UNCERTAIN',
      }),
    );
    expect(getRuntimeBootstrapMock).toHaveBeenCalledWith('call-owner');
    expect(getLegacyMock).not.toHaveBeenCalled();
  });

  it('keeps legacy state and browser events on the legacy endpoints only', async () => {
    const legacySession = {
      runtimeControlMode: 'legacy_local' as const,
      callId: 'call-legacy',
      status: 'created',
    };
    getLegacyMock.mockResolvedValueOnce({
      callId: 'call-legacy',
      status: 'connected',
    });
    reportLegacyEventMock.mockResolvedValueOnce({});

    await expect(getAiCallBrowserSessionState(legacySession)).resolves.toEqual({
      ...legacySession,
      status: 'connected',
    });
    await reportAiCallBrowserSessionEvent(legacySession, {
      type: 'browser_ready',
    });

    expect(getLegacyMock).toHaveBeenCalledWith('call-legacy');
    expect(reportLegacyEventMock).toHaveBeenCalledWith('call-legacy', {
      type: 'browser_ready',
    });
    expect(getRuntimeBootstrapMock).not.toHaveBeenCalled();
  });

  it('does not send owner browser events into the legacy local registry', async () => {
    await reportAiCallBrowserSessionEvent(
      {
        runtimeControlMode: 'owner_command_v1',
        callId: 'call-owner',
      },
      { type: 'browser_ready' },
    );

    expect(reportLegacyEventMock).not.toHaveBeenCalled();
  });
});

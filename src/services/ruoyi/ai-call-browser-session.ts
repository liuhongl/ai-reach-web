import {
  type AiCallLabBrowserEvent,
  type AiCallLabCreateSessionRequest,
  type AiCallLabSession,
  createAiCallLabSession,
  endAiCallLabSession,
  getAiCallLabSession,
  reportAiCallLabBrowserEvent,
} from './ai-call-lab';
import {
  type AiCallRuntimeBootstrap,
  type AiCallRuntimeStartAccepted,
  createAiCallRuntimeEndCall,
  createAiCallRuntimeStartCall,
  getAiCallRuntimeBootstrap,
} from './ai-call-runtime';
import {
  getAiCallRuntimeErrorCode,
  waitForAiCallRuntimeReadyToken,
} from './ai-call-runtime-session';

export type AiCallBrowserSessionStartRequest = AiCallLabCreateSessionRequest & {
  idempotencyKey: string;
};

export type AiCallBrowserSession = AiCallLabSession & {
  runtimeControlMode: 'owner_command_v1' | 'legacy_local';
  runtimePhase?: AiCallRuntimeBootstrap['phase'];
  resourceCleanupStatus?: AiCallRuntimeBootstrap['resourceCleanupStatus'];
  resourceCleanupError?: string | null;
  failureStage?: string | null;
  failureMessage?: string | null;
};

export class AiCallBrowserRuntimeStartError extends Error {
  readonly callId: string;
  readonly cause: unknown;

  constructor(callId: string, cause: unknown) {
    super(`AI Call ${callId} runtime start did not reach readiness`);
    this.name = 'AiCallBrowserRuntimeStartError';
    this.callId = callId;
    this.cause = cause;
  }
}

export const createAiCallBrowserSession = async (
  request: AiCallBrowserSessionStartRequest,
): Promise<AiCallBrowserSession> => {
  const { idempotencyKey, ...legacyRequest } = request;
  let accepted: AiCallRuntimeStartAccepted;
  try {
    accepted = await createAiCallRuntimeStartCall({
      entryType: 'web',
      idempotencyKey,
      payload: {
        voice: request.voice || '',
        sceneCode: request.sceneCode || '',
        businessId: request.businessId || '',
        businessParams: request.businessParams || {},
      },
      businessId: request.businessId,
      sceneCode: request.sceneCode,
    });
  } catch (error) {
    if (getAiCallRuntimeErrorCode(error) !== 'LEGACY_ENTRY_ACTIVE') {
      throw error;
    }
    return {
      ...(await createAiCallLabSession(legacyRequest)),
      runtimeControlMode: 'legacy_local',
    };
  }

  try {
    const { token } = await waitForAiCallRuntimeReadyToken(accepted.callId);
    return {
      runtimeControlMode: 'owner_command_v1',
      callId: token.callId,
      roomName: token.roomName,
      livekitUrl: token.livekitUrl,
      participantToken: token.participantToken,
      status: 'ready',
    };
  } catch (error) {
    throw new AiCallBrowserRuntimeStartError(accepted.callId, error);
  }
};

export const endAiCallBrowserSession = async (
  session: Pick<AiCallBrowserSession, 'callId' | 'runtimeControlMode'>,
  dedupeKey: string,
) => {
  if (session.runtimeControlMode === 'owner_command_v1') {
    return createAiCallRuntimeEndCall(session.callId, {
      dedupeKey,
      endReason: 'user_requested',
    });
  }
  return endAiCallLabSession(session.callId);
};

export const getAiCallBrowserSessionState = async (
  session: AiCallBrowserSession,
): Promise<AiCallBrowserSession> => {
  if (session.runtimeControlMode === 'legacy_local') {
    return { ...session, ...(await getAiCallLabSession(session.callId)) };
  }

  const bootstrap = await getAiCallRuntimeBootstrap(session.callId);
  return {
    ...session,
    roomName: bootstrap.roomName,
    status: bootstrap.status,
    runtimePhase: bootstrap.phase,
    resourceCleanupStatus: bootstrap.resourceCleanupStatus,
    resourceCleanupError: bootstrap.resourceCleanupError,
    failureStage: bootstrap.failureStage,
    failureMessage: bootstrap.failureMessage,
  };
};

export const reportAiCallBrowserSessionEvent = async (
  session: Pick<AiCallBrowserSession, 'callId' | 'runtimeControlMode'>,
  event: AiCallLabBrowserEvent,
): Promise<void> => {
  if (session.runtimeControlMode === 'owner_command_v1') return;
  await reportAiCallLabBrowserEvent(session.callId, event);
};

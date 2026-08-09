import { ruoyiRequest } from '@/adapters/ruoyi/request';
import type { RuoyiResponse } from '@/adapters/ruoyi/response';

const AI_CALL_AGENT_BASE_API = '/ai-call-agent-api';
const RUNTIME_START_PATH = '/ai-call/runtime/start-call';
const RUNTIME_BOOTSTRAP_PATH = (callId: string) =>
  `/ai-call/runtime/calls/${encodeURIComponent(callId)}/bootstrap`;
const RUNTIME_TOKEN_PATH = (callId: string) =>
  `/ai-call/runtime/calls/${encodeURIComponent(callId)}/token`;
const RUNTIME_END_PATH = (callId: string) =>
  `/ai-call/runtime/calls/${encodeURIComponent(callId)}/end`;

export type AiCallRuntimeEntry = 'web' | 'preview' | 'direct_sip';

export type AiCallRuntimeStartRequest = {
  entryType: AiCallRuntimeEntry;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  businessType?: string;
  businessId?: string;
  sceneCode?: string;
  promptSourceKey?: string;
  allocationDeadlineAt?: string;
  sensitivePayloadCiphertext?: string;
  payloadKeyVersion?: string;
};

export type AiCallRuntimeStartAccepted = {
  acceptanceStatus: 'ACCEPTED';
  commandId: string;
  callId: string;
  commandSeq: string;
  commandType: 'START_CALL' | string;
  status: string;
};

export type AiCallRuntimeBootstrap = {
  callId: string;
  entryType: AiCallRuntimeEntry | string;
  phase: 'starting' | 'ready' | 'ending' | 'terminal';
  roomName: string;
  participantIdentity?: string | null;
  runtimeFencingToken: number;
  agentMediaReadyAt?: string | null;
  terminalRequestedAt?: string | null;
  tokenAvailable: boolean;
  status: string;
  resourceCleanupStatus:
    | 'not_started'
    | 'reconciling'
    | 'clean'
    | 'attention_required';
  resourceCleanupError: string | null;
  failureStage: string | null;
  failureMessage: string | null;
};

export type AiCallRuntimeToken = {
  callId: string;
  roomName: string;
  livekitUrl: string;
  participantToken: string;
  participantIdentity: string;
  expiresInSeconds: number;
};

export type AiCallRuntimeEndRequest = {
  dedupeKey: string;
  endReason?: string;
};

export type AiCallRuntimeEndAccepted = {
  acceptanceStatus: 'ACCEPTED';
  callId: string;
  commandId: string;
  commandSeq: string;
  commandStatus: string;
};

const unwrapData = <T>(response: RuoyiResponse<T> | T): T => {
  if (!response || typeof response !== 'object' || !('code' in response)) {
    throw new Error('接口响应缺少 code');
  }
  const envelope = response as RuoyiResponse<T>;
  if (envelope.data === undefined) {
    throw new Error('接口响应缺少 data');
  }
  return envelope.data;
};

export const createAiCallRuntimeStartCall = async (
  data: AiCallRuntimeStartRequest,
): Promise<AiCallRuntimeStartAccepted> =>
  unwrapData(
    await ruoyiRequest<AiCallRuntimeStartAccepted>(RUNTIME_START_PATH, {
      baseApi: AI_CALL_AGENT_BASE_API,
      method: 'post',
      data,
      repeatSubmit: false,
    }),
  );

export const getAiCallRuntimeBootstrap = async (
  callId: string,
): Promise<AiCallRuntimeBootstrap> =>
  unwrapData(
    await ruoyiRequest<AiCallRuntimeBootstrap>(RUNTIME_BOOTSTRAP_PATH(callId), {
      baseApi: AI_CALL_AGENT_BASE_API,
      method: 'get',
    }),
  );

export const createAiCallRuntimeToken = async (
  callId: string,
): Promise<AiCallRuntimeToken> =>
  unwrapData(
    await ruoyiRequest<AiCallRuntimeToken>(RUNTIME_TOKEN_PATH(callId), {
      baseApi: AI_CALL_AGENT_BASE_API,
      method: 'post',
      repeatSubmit: false,
    }),
  );

export const createAiCallRuntimeEndCall = async (
  callId: string,
  data: AiCallRuntimeEndRequest,
): Promise<AiCallRuntimeEndAccepted> =>
  unwrapData(
    await ruoyiRequest<AiCallRuntimeEndAccepted>(RUNTIME_END_PATH(callId), {
      baseApi: AI_CALL_AGENT_BASE_API,
      method: 'post',
      data,
      repeatSubmit: false,
    }),
  );

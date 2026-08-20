import {
  ruoyiRequest,
  type RuoyiRequestOptions,
} from '@/adapters/ruoyi/request';
import { listVoiceProfiles } from './ai-call-voices';
import type {
  AiCallVoiceProfile,
  VoiceProfileQuery,
} from './ai-call-voices.types';

const AI_CALL_AGENT_BASE_API = '/ai-call-agent-api';
const AI_CALL_PATH_PREFIX = '/ai-call';
const AI_CALL_LAB_READ_TIMEOUT = 10_000;
const AI_CALL_LAB_ACTION_TIMEOUT = 15_000;

export type AiCallLabResponse<T = unknown> = {
  code?: number;
  msg?: string;
  data?: T;
  rows?: T[];
  total?: number;
};

export type AiCallLabPage<T> = {
  rows: T[];
  total: number;
};

type AiCallLabPageResponse<T> = {
  data?: { rows?: T[]; total?: number } | T[];
  rows?: T[];
  total?: number;
};

export type AiCallLabVoiceProfile = AiCallVoiceProfile;

export type AiCallLabPromptProfile = {
  id?: number | string;
  sceneCode: string;
  name: string;
  providerKey?: 'static_profile' | 'business_query' | string;
  promptText?: string | null;
  openingMessage?: string | null;
  productInfo?: string;
  variables?: AiCallLabPromptVariable[];
  versionNo?: number | null;
  versionCount?: number;
};

export type AiCallLabPromptVariable = {
  key: string;
  label: string;
};

export type AiCallLabPromptVersion = {
  id: number | string;
  profileId: number | string;
  versionNo: number;
  versionName: string;
  creationMethod: 'manual' | 'ai_generated' | 'ai_optimized' | 'restored';
  restoredFromVersionId?: number | string | null;
  createdBy?: number | string | null;
  createdByName?: string | null;
  createdAt: string;
  snapshot?: Omit<AiCallLabPromptProfile, 'id'>;
};

export type AiCallLabPromptProfilePayload = Omit<
  AiCallLabPromptProfile,
  'id'
> & {
  id?: number | string;
  knowledgeVersionSnapshotHash?: string;
};

export type AiCallLabProductInfoSource = {
  claim: string;
  chunkId: string;
  versionId: string;
  versionNo: number;
  sourceFilename: string;
  pageNo?: number | null;
  sectionPath?: string | null;
  startMs?: number | null;
  endMs?: number | null;
  excerpt: string;
};

export type AiCallLabProductInfoConflict = {
  topic: string;
  description: string;
  sourceChunkIds: string[];
};

export type AiCallLabProductInfoSourceDocument = {
  versionId: string;
  versionNo: number;
  sourceFilename: string;
};

export type AiCallLabProductInfoDraft = {
  draftText: string;
  sourceDocuments?: AiCallLabProductInfoSourceDocument[];
  sources: AiCallLabProductInfoSource[];
  conflicts: AiCallLabProductInfoConflict[];
  sourceVersionIds: string[];
  versionSnapshotHash: string;
};

export type AiCallLabPromptComponent = {
  id?: number | string;
  componentKey: string;
  name?: string;
  content?: string;
};

export type AiCallLabPromptCommonConfig = {
  content: string;
  updatedAt?: string | null;
};

export type AiCallLabPromptPreview = {
  instructions: string;
  openingMessage: string;
  promptHash: string;
  openingMessageHash: string;
  promptSourceKey: string;
};

export type AiCallLabCreateSessionRequest = {
  voice?: string;
  sceneCode?: string;
  businessId?: string;
  businessParams?: Record<string, unknown>;
};

export type AiCallLabSession = {
  callId: string;
  roomName?: string;
  token?: string;
  participantToken?: string;
  livekitUrl?: string;
  model?: string;
  status?: string;
  metrics?: Record<string, unknown>;
};

export type AiCallLabBrowserEvent = {
  type: string;
  [key: string]: unknown;
};

export type AiCallLabEvent = {
  eventId?: string;
  eventType?: string;
  type?: string;
  source?: string;
  timestamp?: string;
  eventTime?: string;
};

export type AiCallLabDialogueSegment = {
  speakerType?: string;
  text?: string;
  segmentNo?: number;
  segmentStatus?: string;
  startedAt?: string;
};

export type AiCallLabRecording = {
  status?: string;
  egressId?: string;
  ossId?: string | number;
  playUrl?: string;
  durationMs?: number | string;
  failureMessage?: string;
};

export type AiCallLabHandoff = {
  handoffId?: string | number;
  status?: string;
  requestSource?: string;
  requestReason?: string;
  humanAgentIdentity?: string;
  failureMessage?: string;
};

const buildPath = (path: string) => `${AI_CALL_PATH_PREFIX}${path}`;

const aiCallLabRequest = <T>(
  path: string,
  options: RuoyiRequestOptions,
) =>
  ruoyiRequest(path, {
    baseApi: AI_CALL_AGENT_BASE_API,
    ...options,
  }) as unknown as Promise<T>;

const unwrapAiCallLabResponse = <T>(
  response: AiCallLabResponse<T> | T,
): T => {
  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    (response as AiCallLabResponse<T>).data !== undefined
  ) {
    return (response as AiCallLabResponse<T>).data as T;
  }
  return response as T;
};

export const unwrapAiCallLabPage = <T>(
  response: AiCallLabPageResponse<T>,
): AiCallLabPage<T> => {
  const data = response.data;
  if (data && !Array.isArray(data) && Array.isArray(data.rows)) {
    return {
      rows: data.rows,
      total: Number(data.total) || 0,
    };
  }
  if (Array.isArray(response.rows)) {
    return {
      rows: response.rows as T[],
      total: Number(response.total) || response.rows.length,
    };
  }
  if (Array.isArray(data)) {
    return {
      rows: data,
      total: data.length,
    };
  }
  return { rows: [], total: 0 };
};

export const getAiCallLabVoiceProfiles = (query: VoiceProfileQuery = {}) =>
  listVoiceProfiles({ pageSize: 200, ...query });

export const getAiCallLabPromptProfiles = async () => {
  const response = await aiCallLabRequest<
    AiCallLabPageResponse<AiCallLabPromptProfile>
  >(
    buildPath('/prompt-profiles'),
    {
      method: 'get',
      params: { pageSize: 200 },
      timeout: AI_CALL_LAB_READ_TIMEOUT,
    },
  );
  return unwrapAiCallLabPage<AiCallLabPromptProfile>(response);
};

export const getAiCallLabPromptComponents = async () => {
  const response = await aiCallLabRequest<
    AiCallLabPageResponse<AiCallLabPromptComponent>
  >(buildPath('/prompt-components'), {
    method: 'get',
    timeout: AI_CALL_LAB_READ_TIMEOUT,
  });
  return unwrapAiCallLabPage<AiCallLabPromptComponent>(response);
};

export const getAiCallLabPromptCommonConfig = async () => {
  const response = await aiCallLabRequest<
    AiCallLabResponse<AiCallLabPromptCommonConfig>
  >(buildPath('/prompt-common-config'), {
    method: 'get',
    timeout: AI_CALL_LAB_READ_TIMEOUT,
  });
  return unwrapAiCallLabResponse<AiCallLabPromptCommonConfig>(response);
};

export const saveAiCallLabPromptCommonConfig = async (content: string) => {
  const response = await aiCallLabRequest<
    AiCallLabResponse<AiCallLabPromptCommonConfig>
  >(buildPath('/prompt-common-config'), {
    method: 'put',
    data: { content },
    timeout: AI_CALL_LAB_ACTION_TIMEOUT,
  });
  return unwrapAiCallLabResponse<AiCallLabPromptCommonConfig>(response);
};

export const previewAiCallLabPromptProfile = async (
  profile: Pick<
    AiCallLabPromptProfile,
    'sceneCode' | 'promptText' | 'openingMessage' | 'productInfo' | 'variables'
  >,
) => {
  const response = await aiCallLabRequest<
    AiCallLabResponse<AiCallLabPromptPreview>
  >(buildPath('/prompt-profiles/preview'), {
    method: 'post',
    data: {
      sceneCode: profile.sceneCode,
      promptText: profile.promptText,
      openingMessage: profile.openingMessage,
      productInfo: profile.productInfo,
      businessParams: Object.fromEntries(
        (profile.variables || []).map((variable) => [
          variable.key,
          `[${variable.label}]`,
        ]),
      ),
    },
    timeout: AI_CALL_LAB_ACTION_TIMEOUT,
  });
  return unwrapAiCallLabResponse<AiCallLabPromptPreview>(response);
};

export const getAiCallLabPromptVersions = async (
  profileId: number | string,
) => {
  const response = await aiCallLabRequest<
    AiCallLabPageResponse<AiCallLabPromptVersion>
  >(
    buildPath(
      `/prompt-profiles/${encodeURIComponent(String(profileId))}/versions`,
    ),
    { method: 'get', timeout: AI_CALL_LAB_READ_TIMEOUT },
  );
  return unwrapAiCallLabPage<AiCallLabPromptVersion>(response);
};

export const getAiCallLabPromptVersion = async (
  profileId: number | string,
  versionId: number | string,
) => {
  const response = await aiCallLabRequest<
    AiCallLabResponse<AiCallLabPromptVersion>
  >(
    buildPath(
      `/prompt-profiles/${encodeURIComponent(String(profileId))}/versions/${encodeURIComponent(String(versionId))}`,
    ),
    { method: 'get', timeout: AI_CALL_LAB_READ_TIMEOUT },
  );
  return unwrapAiCallLabResponse<AiCallLabPromptVersion>(response);
};

export const applyAiCallLabPromptVersion = async (
  profileId: number | string,
  versionId: number | string,
) => {
  const response = await aiCallLabRequest<
    AiCallLabResponse<AiCallLabPromptProfile>
  >(
    buildPath(
      `/prompt-profiles/${encodeURIComponent(String(profileId))}/versions/${encodeURIComponent(String(versionId))}/apply`,
    ),
    { method: 'post', timeout: AI_CALL_LAB_ACTION_TIMEOUT },
  );
  return unwrapAiCallLabResponse<AiCallLabPromptProfile>(response);
};

export const updateAiCallLabPromptVersionName = async (
  profileId: number | string,
  versionId: number | string,
  versionName: string,
) => {
  const response = await aiCallLabRequest<
    AiCallLabResponse<AiCallLabPromptVersion>
  >(
    buildPath(
      `/prompt-profiles/${encodeURIComponent(String(profileId))}/versions/${encodeURIComponent(String(versionId))}`,
    ),
    {
      method: 'patch',
      data: { versionName },
      timeout: AI_CALL_LAB_ACTION_TIMEOUT,
    },
  );
  return unwrapAiCallLabResponse<AiCallLabPromptVersion>(response);
};

export const deleteAiCallLabPromptVersion = (
  profileId: number | string,
  versionId: number | string,
) =>
  aiCallLabRequest(
    buildPath(
      `/prompt-profiles/${encodeURIComponent(String(profileId))}/versions/${encodeURIComponent(String(versionId))}`,
    ),
    { method: 'delete', timeout: AI_CALL_LAB_ACTION_TIMEOUT },
  );

export type AiCallLabPromptOptimizeRequest = {
  targetType: 'opening' | 'scenePrompt';
  currentContent: string;
  sceneContext: {
    sceneName: string;
    productInfo: string;
    commonPrompt: string;
    variables: AiCallLabPromptVariable[];
  };
  instruction?: string;
};

export const optimizeAiCallLabPrompt = async (
  data: AiCallLabPromptOptimizeRequest,
) => {
  const response = await aiCallLabRequest<
    AiCallLabResponse<{ candidateContent: string; warnings: string[] }>
  >(buildPath('/prompt-profiles/ai-optimize'), {
    method: 'post',
    data,
    timeout: 30_000,
    skipErrorHandler: true,
  });
  return unwrapAiCallLabResponse(response);
};

export const extractAiCallLabProductInfo = async (
  profileId: number | string,
) => {
  const response = await aiCallLabRequest<
    AiCallLabResponse<AiCallLabProductInfoDraft>
  >(
    buildPath(
      `/prompt-profiles/${encodeURIComponent(String(profileId))}/product-info:extract`,
    ),
    {
      method: 'post',
      timeout: 30_000,
      skipErrorHandler: true,
    },
  );
  return unwrapAiCallLabResponse(response);
};

export const saveAiCallLabPromptProfile = async (
  payload: AiCallLabPromptProfilePayload,
) => {
  const { id, ...data } = payload;
  const path = id
    ? buildPath(`/prompt-profiles/${encodeURIComponent(String(id))}`)
    : buildPath('/prompt-profiles');
  const response = await aiCallLabRequest<
    AiCallLabResponse<AiCallLabPromptProfile>
  >(
    path,
    {
      method: id ? 'put' : 'post',
      data,
      timeout: AI_CALL_LAB_ACTION_TIMEOUT,
      skipErrorHandler: Boolean(data.knowledgeVersionSnapshotHash),
    },
  );
  return unwrapAiCallLabResponse<AiCallLabPromptProfile>(response);
};

export const createAiCallLabSession = async (
  data: AiCallLabCreateSessionRequest,
) => {
  const response = await aiCallLabRequest<AiCallLabResponse<AiCallLabSession>>(
    buildPath('/sessions'),
    {
      method: 'post',
      data,
      timeout: AI_CALL_LAB_ACTION_TIMEOUT,
    },
  );
  return unwrapAiCallLabResponse<AiCallLabSession>(response);
};

export const reportAiCallLabBrowserEvent = (
  callId: string,
  data: AiCallLabBrowserEvent,
) =>
  aiCallLabRequest<AiCallLabResponse>(
    buildPath(`/sessions/${encodeURIComponent(callId)}/browser-events`),
    {
      method: 'post',
      data,
      timeout: AI_CALL_LAB_ACTION_TIMEOUT,
    },
  );

export const getAiCallLabSession = async (callId: string) => {
  const response = await aiCallLabRequest<AiCallLabResponse<AiCallLabSession>>(
    buildPath(`/sessions/${encodeURIComponent(callId)}`),
    { method: 'get', timeout: AI_CALL_LAB_READ_TIMEOUT },
  );
  return unwrapAiCallLabResponse<AiCallLabSession>(response);
};

export const getAiCallLabEvents = async (
  callId: string,
  afterEventId?: string | null,
) => {
  const params: Record<string, unknown> = { limit: 200 };
  if (afterEventId) params.afterEventId = afterEventId;
  const response = await aiCallLabRequest<
    AiCallLabPageResponse<AiCallLabEvent>
  >(
    buildPath(`/sessions/${encodeURIComponent(callId)}/events`),
    {
      method: 'get',
      params,
      timeout: AI_CALL_LAB_READ_TIMEOUT,
    },
  );
  return unwrapAiCallLabPage<AiCallLabEvent>(response);
};

export const getAiCallLabDialoguePreview = async (callId: string) => {
  const response = await aiCallLabRequest<
    AiCallLabPageResponse<AiCallLabDialogueSegment>
  >(buildPath(`/sessions/${encodeURIComponent(callId)}/dialogue-preview`), {
    method: 'get',
    timeout: AI_CALL_LAB_READ_TIMEOUT,
  });
  return unwrapAiCallLabPage<AiCallLabDialogueSegment>(response);
};

export const getAiCallLabRecording = async (callId: string) => {
  const response = await aiCallLabRequest<
    AiCallLabResponse<AiCallLabRecording>
  >(
    buildPath(`/records/${encodeURIComponent(callId)}/recording`),
    { method: 'get', timeout: AI_CALL_LAB_READ_TIMEOUT },
  );
  return unwrapAiCallLabResponse<AiCallLabRecording>(response);
};

export const getAiCallLabHandoff = async (callId: string) => {
  const response = await aiCallLabRequest<
    AiCallLabResponse<AiCallLabHandoff | null>
  >(
    buildPath(`/sessions/${encodeURIComponent(callId)}/handoff`),
    { method: 'get', timeout: AI_CALL_LAB_READ_TIMEOUT },
  );
  return unwrapAiCallLabResponse<AiCallLabHandoff | null>(response);
};

export const endAiCallLabSession = (callId: string) =>
  aiCallLabRequest<AiCallLabResponse>(
    buildPath(`/sessions/${encodeURIComponent(callId)}/end`),
    { method: 'post', timeout: AI_CALL_LAB_ACTION_TIMEOUT },
  );

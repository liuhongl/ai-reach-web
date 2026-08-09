import { ruoyiRequest } from '@/adapters/ruoyi/request';
import type { RuoyiResponse } from '@/adapters/ruoyi/response';
import type {
  AiCallVoiceProfile,
  PageResult,
  VoiceDeletionAccepted,
  VoiceDeletionCheck,
  VoiceAvailabilityStatus,
  VoiceEnrollmentAccepted,
  VoiceEnrollmentPayload,
  VoicePreviewAudio,
  VoiceProfileQuery,
} from './ai-call-voices.types';

const AI_CALL_AGENT_BASE_API = '/ai-call-agent-api';
const VOICES_PATH = '/ai-call/voice-profiles';
const ENROLLMENTS_PATH = '/ai-call/voice-enrollments';
const TENANT_VOICES_PATH = '/ai-call/tenant-voice-profiles';
const PREVIEW_AUDIO_PATH = '/ai-call/voice-preview-audio';

const requestOptions = {
  baseApi: AI_CALL_AGENT_BASE_API,
} as const;

const requireEnvelope = <T>(
  response: RuoyiResponse<T> | T,
): RuoyiResponse<T> => {
  if (!response || typeof response !== 'object' || !('code' in response)) {
    throw new Error('接口响应缺少 code');
  }
  return response as RuoyiResponse<T>;
};

const unwrapData = <T>(response: RuoyiResponse<T> | T): T => {
  const envelope = requireEnvelope(response);
  if (envelope.data === undefined) {
    throw new Error('接口响应缺少 data');
  }
  return envelope.data;
};

const unwrapPage = (
  response: RuoyiResponse<AiCallVoiceProfile> | AiCallVoiceProfile,
): PageResult<AiCallVoiceProfile> => {
  const envelope = requireEnvelope(response);
  if (!Array.isArray(envelope.rows) || typeof envelope.total !== 'number') {
    throw new Error('分页响应缺少 rows 或 total');
  }
  return {
    rows: envelope.rows,
    total: envelope.total,
  };
};

const createEnrollmentFormData = (payload: VoiceEnrollmentPayload) => {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('request', JSON.stringify(payload.request));
  return formData;
};

const profilePath = (profileId: string) =>
  `${TENANT_VOICES_PATH}/${encodeURIComponent(profileId)}`;

export type AiCallVoiceApi = {
  listVoiceProfiles: (
    query: VoiceProfileQuery,
  ) => Promise<PageResult<AiCallVoiceProfile>>;
  createVoiceEnrollment: (
    payload: VoiceEnrollmentPayload,
    idempotencyKey: string,
  ) => Promise<VoiceEnrollmentAccepted>;
  reenrollVoice: (
    profileId: string,
    payload: VoiceEnrollmentPayload,
    idempotencyKey: string,
  ) => Promise<VoiceEnrollmentAccepted>;
  createVoicePreviewAudio: (voice: string) => Promise<VoicePreviewAudio>;
  getVoiceDeletionCheck: (profileId: string) => Promise<VoiceDeletionCheck>;
  deleteTenantVoice: (
    profileId: string,
    idempotencyKey: string,
  ) => Promise<VoiceDeletionAccepted>;
  setTenantVoiceAvailability: (
    profileId: string,
    status: VoiceAvailabilityStatus,
  ) => Promise<AiCallVoiceProfile>;
};

export const listVoiceProfiles: AiCallVoiceApi['listVoiceProfiles'] = async (
  query,
) =>
  unwrapPage(
    await ruoyiRequest<AiCallVoiceProfile>(VOICES_PATH, {
      ...requestOptions,
      method: 'get',
      params: query,
    }),
  );

export const createVoiceEnrollment: AiCallVoiceApi['createVoiceEnrollment'] =
  async (payload, idempotencyKey) =>
    unwrapData(
      await ruoyiRequest<VoiceEnrollmentAccepted>(ENROLLMENTS_PATH, {
        ...requestOptions,
        method: 'post',
        data: createEnrollmentFormData(payload),
        headers: { 'Idempotency-Key': idempotencyKey },
        repeatSubmit: false,
        skipErrorHandler: true,
      }),
    );

export const reenrollVoice: AiCallVoiceApi['reenrollVoice'] = async (
  profileId,
  payload,
  idempotencyKey,
) =>
  unwrapData(
    await ruoyiRequest<VoiceEnrollmentAccepted>(
      `${profilePath(profileId)}/enrollments`,
      {
        ...requestOptions,
        method: 'post',
        data: createEnrollmentFormData(payload),
        headers: { 'Idempotency-Key': idempotencyKey },
        repeatSubmit: false,
        skipErrorHandler: true,
      },
    ),
  );

export const createVoicePreviewAudio: AiCallVoiceApi['createVoicePreviewAudio'] =
  async (voice) =>
    unwrapData(
      await ruoyiRequest<VoicePreviewAudio>(PREVIEW_AUDIO_PATH, {
        ...requestOptions,
        method: 'post',
        data: { voice },
      }),
    );

export const getVoiceDeletionCheck: AiCallVoiceApi['getVoiceDeletionCheck'] =
  async (profileId) =>
    unwrapData(
      await ruoyiRequest<VoiceDeletionCheck>(
        `${profilePath(profileId)}/deletion-check`,
        {
          ...requestOptions,
          method: 'get',
        },
      ),
    );

export const deleteTenantVoice: AiCallVoiceApi['deleteTenantVoice'] = async (
  profileId,
  idempotencyKey,
) =>
  unwrapData(
    await ruoyiRequest<VoiceDeletionAccepted>(profilePath(profileId), {
      ...requestOptions,
      method: 'delete',
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  );

export const setTenantVoiceAvailability: AiCallVoiceApi['setTenantVoiceAvailability'] =
  async (profileId, status) =>
    unwrapData(
      await ruoyiRequest<AiCallVoiceProfile>(`${profilePath(profileId)}/status`, {
        ...requestOptions,
        method: 'patch',
        data: { status },
      }),
    );

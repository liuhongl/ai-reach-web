import { ruoyiRequest } from '@/adapters/ruoyi/request';
import type {
  FollowUpClassification,
  LowValueReason,
} from '@/pages/aiCallFollowUpData/service';

const AI_CALL_AGENT_BASE_API = '/ai-call-agent-api';
const AI_CALL_RECORDS_PREFIX = '/ai-call/records';
const requestOptions = {
  baseApi: AI_CALL_AGENT_BASE_API,
} as const;

type AiCallResponse<T> = {
  data?: T;
  rows?: T[];
  total?: number;
};

export type AiCallRecord = {
  id: string;
  callId: string;
  taskId?: string | null;
  targetId?: string | null;
  followUpDataId?: string | null;
  operatorAgentIdentity?: string | null;
  afterCallResultStatus?: 'not_applicable' | 'pending' | 'submitted';
  afterCallResultType?: 'handoff' | 'follow_up' | 'follow_up_data' | null;
  taskName?: string | null;
  customerName?: string | null;
  phoneNumber?: string | null;
  attemptNo?: number | null;
  callResult?: string | null;
  answerType?: 'human' | 'voicemail' | 'transport' | null;
  aiOutcome?: string | null;
  summary?: string | null;
  analysisStatus?: '0' | '1' | '2' | '3' | '4' | null;
  customerIntent?: 'positive' | 'neutral' | 'negative' | null;
  followUpSuggested?: boolean;
  followUpRequiresReview?: boolean;
  followUpReviewStatus?:
    | 'created'
    | 'dismissed'
    | 'confirmed'
    | 'adjusted'
    | null;
  classificationRequiresReview?: boolean;
  classificationReviewStatus?: 'suggested' | 'reviewed' | null;
  followUpId?: string | null;
  followUpStatus?: 'pending' | 'processing' | 'completed' | 'closed' | null;
  qualityScoreStatus?:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'not_applicable'
    | null;
  qualityScore?: number | null;
  qualityReviewResult?: QualityReviewResult | null;
  qualityReviewReason?: string | null;
  recordingPlayUrl?: string | null;
  businessType?: string | null;
  businessId?: string | null;
  sceneCode?: string | null;
  promptSourceKey?: string | null;
  entryType: string;
  roomName?: string | null;
  participantIdentity?: string | null;
  status: string;
  endReason?: string | null;
  failureStage?: string | null;
  failureMessage?: string | null;
  startedAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationMs?: number | null;
};

export type AiCallRecordEvent = {
  id: string;
  eventId: string;
  callId: string;
  eventType: string;
  source: string;
  eventTime: string;
  payload: Record<string, unknown>;
};

export type AiCallRecordDetail = {
  record: AiCallRecord;
  lastEvent?: AiCallRecordEvent | null;
  afterCallWork?: {
    agentIdentity: string;
    followUpDataId?: string | null;
    dispositionCode?: string | null;
    summary?: string | null;
    needsFollowUp?: boolean | null;
    classification?: 'interested' | 'nurturing' | 'low_value' | null;
    lowValueReason?: string | null;
    nextFollowUpAt?: string | null;
    resultVersion?: number | null;
    submittedAt: string;
  } | null;
  handlingResult?: {
    id: string;
    followUpId?: string | null;
    followUpDataId?: string | null;
    contactResult: string;
    remark: string;
    classification?:
      | 'interested'
      | 'nurturing'
      | 'low_value'
      | 'converted'
      | null;
    lowValueReason?: string | null;
    nextFollowUpAt?: string | null;
    resultVersion?: number | null;
    handledAt: string;
  } | null;
  followUpData?: {
    id: string;
    classification?:
      | 'interested'
      | 'nurturing'
      | 'low_value'
      | 'converted'
      | null;
    lowValueReason?: string | null;
    latestConclusion?: string | null;
    activeFollowUpId?: string | null;
    activeFollowUpStatus?: 'pending' | 'processing' | null;
    nextFollowUpAt?: string | null;
    version: number;
  } | null;
  followUp?: {
    id: string;
    status: string;
    reason: string;
    sourceCallId: string;
    sourceRecord?: AiCallRecord | null;
    callbackRecords?: AiCallRecord[];
  } | null;
  executionConfig?: {
    promptProfileId?: string | null;
    promptName?: string | null;
    sceneCode?: string | null;
    promptText?: string | null;
    openingMessage?: string | null;
    voice?: string | null;
    voiceName?: string | null;
    ruleName?: string | null;
  } | null;
  exceptionHandling?: {
    category: string;
    status: string;
    originalAttemptCount: number;
    retryCount: number;
    maxRetryCount: number;
    lastResult?: string | null;
    createdBy?: string | null;
    createdByName?: string | null;
    startedAt?: string | null;
  } | null;
};

export type AiCallRecordingTrack = {
  id: string;
  trackRole: string;
  participantIdentity: string;
  status: string;
  playUrl?: string | null;
  durationMs?: number | null;
  failureMessage?: string | null;
};

export type AiCallRecording = {
  id: string;
  callId: string;
  status: string;
  playUrl?: string | null;
  durationMs?: number | null;
  failureStage?: string | null;
  failureMessage?: string | null;
  tracks?: AiCallRecordingTrack[];
};

export type AiCallDialogueSegment = {
  id?: string | null;
  callId: string;
  segmentNo: number;
  speakerType: string;
  speakerIdentity?: string | null;
  text: string;
  segmentStatus: string;
  startedAt?: string | null;
};

export type AiCallSemanticAnalysis = {
  id?: string | null;
  callId: string;
  sceneCode?: string | null;
  analysisSceneCode: string;
  analysisStatus: string;
  analysisResult?: Record<string, unknown> | null;
  analysisError?: string | null;
  analysisRetryCount: number;
  followUpRequiresReview?: boolean;
  followUpReviewStatus?:
    | 'created'
    | 'dismissed'
    | 'confirmed'
    | 'adjusted'
    | null;
  classificationRequiresReview?: boolean;
  classificationReviewStatus?: 'suggested' | 'reviewed' | null;
  followUpReviewedBy?: string | null;
  followUpReviewedByName?: string | null;
  followUpReviewedAt?: string | null;
  analysisStartedAt?: string | null;
  analysisFinishedAt?: string | null;
};

export type QualityReviewResult = 'excellent' | 'good' | 'pass' | 'fail';

export type AiCallQualityScore = {
  id: string;
  callId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  score?: number | null;
  reason?: string | null;
  errorMessage?: string | null;
  modelVersion: string;
  retryCount: number;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type AiCallQualityReview = {
  id: string;
  callId: string;
  qualityResult: QualityReviewResult;
  qualityReason?: string | null;
  reviewedBy: string;
  reviewedByName?: string | null;
  reviewedAt: string;
};

export type AiCallQualityDetail = {
  score?: AiCallQualityScore | null;
  review?: AiCallQualityReview | null;
};

export type AiCallQualityReviewRequest = {
  qualityResult: QualityReviewResult;
  qualityReason?: string | null;
};

export type AiCallHandoff = {
  id: string;
  handoffId: string;
  callId: string;
  status: string;
  requestSource?: string | null;
  requestReason?: string | null;
  requestMessage?: string | null;
  humanAgentIdentity?: string | null;
  requestedAt: string;
  acceptedAt?: string | null;
  connectedAt?: string | null;
  endedAt?: string | null;
  failureMessage?: string | null;
};

export type AiCallRecordPage<T> = {
  rows: T[];
  total: number;
};

export type AiCallRecordQuery = {
  callId?: string;
  taskId?: string;
  targetId?: string;
  phoneNumber?: string;
  customerName?: string;
  callResult?: string;
  customerIntent?: 'positive' | 'neutral' | 'negative' | 'pending' | 'failed';
  classificationReviewStatus?: 'suggested' | 'reviewed';
  followUpStatus?:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'closed'
    | 'none';
  afterCallResultStatus?: 'all' | 'pending' | 'submitted' | 'not_applicable';
  businessType?: string;
  businessId?: string;
  status?: string;
  entryType?: string;
  formalOutboundOnly?: boolean;
  startedAtBegin?: string;
  startedAtEnd?: string;
  pageNum?: number;
  pageSize?: number;
};

const unwrapData = <T>(response: AiCallResponse<T> | T): T => {
  if (
    response &&
    typeof response === 'object' &&
    Object.hasOwn(response, 'data')
  ) {
    return (response as AiCallResponse<T>).data as T;
  }
  return response as T;
};

const unwrapPage = <T>(
  response: AiCallResponse<T> | AiCallRecordPage<T>,
): AiCallRecordPage<T> => {
  const payload = (response as { data?: AiCallRecordPage<T> }).data;
  if (payload && Array.isArray(payload.rows)) {
    return { rows: payload.rows, total: Number(payload.total) || 0 };
  }
  const direct = response as AiCallResponse<T>;
  return {
    rows: Array.isArray(direct.rows) ? direct.rows : [],
    total: Number(direct.total) || 0,
  };
};

const recordPath = (callId: string, suffix = '') =>
  `${AI_CALL_RECORDS_PREFIX}/${encodeURIComponent(callId)}${suffix}`;

const compactQuery = (params: AiCallRecordQuery) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );

export const listAiCallRecords = async (params: AiCallRecordQuery) => {
  const response = await ruoyiRequest<AiCallRecord>(AI_CALL_RECORDS_PREFIX, {
    ...requestOptions,
    method: 'get',
    params: compactQuery(params),
  });
  return unwrapPage(response);
};

export const getAiCallRecordDetail = async (callId: string) => {
  const response = await ruoyiRequest<AiCallRecordDetail>(recordPath(callId), {
    ...requestOptions,
    method: 'get',
  });
  return unwrapData(response);
};

export const getAiCallRecordRecording = async (callId: string) => {
  const response = await ruoyiRequest<AiCallRecording | null>(
    recordPath(callId, '/recording'),
    { ...requestOptions, method: 'get' },
  );
  return unwrapData(response);
};

export const getAiCallRecordDialogue = async (callId: string) => {
  const response = await ruoyiRequest<AiCallDialogueSegment>(
    recordPath(callId, '/dialogue-segments'),
    {
      ...requestOptions,
      method: 'get',
      params: { limit: 1000 },
    },
  );
  return unwrapPage(response);
};

export const getAiCallRecordSemanticAnalysis = async (callId: string) => {
  const response = await ruoyiRequest<AiCallSemanticAnalysis | null>(
    recordPath(callId, '/semantic-analysis'),
    {
      ...requestOptions,
      method: 'get',
    },
  );
  return unwrapData(response);
};

export const reviewAiCallRecordClassification = async (
  callId: string,
  input: {
    classification: FollowUpClassification;
    reason: string;
    lowValueReason?: LowValueReason;
    expectedVersion: number;
    idempotencyKey: string;
  },
) => {
  const response = await ruoyiRequest<AiCallSemanticAnalysis>(
    recordPath(callId, '/classification-review'),
    {
      ...requestOptions,
      headers: { 'Idempotency-Key': input.idempotencyKey },
      data: {
        classification: input.classification,
        reason: input.reason,
        low_value_reason: input.lowValueReason,
        expected_version: input.expectedVersion,
      },
      method: 'post',
    },
  );
  return unwrapData(response);
};

export const getAiCallRecordQuality = async (callId: string) => {
  const response = await ruoyiRequest<AiCallQualityDetail>(
    recordPath(callId, '/quality'),
    {
      ...requestOptions,
      method: 'get',
    },
  );
  return unwrapData(response);
};

export const scoreAiCallRecordQuality = async (callId: string) => {
  const response = await ruoyiRequest<AiCallQualityDetail>(
    recordPath(callId, '/quality/score'),
    {
      ...requestOptions,
      method: 'post',
    },
  );
  return unwrapData(response);
};

export const saveAiCallRecordQualityReview = async (
  callId: string,
  body: AiCallQualityReviewRequest,
) => {
  const response = await ruoyiRequest<AiCallQualityReview>(
    recordPath(callId, '/quality-review'),
    {
      ...requestOptions,
      data: body,
      method: 'post',
    },
  );
  return unwrapData(response);
};

export const getAiCallRecordHandoffs = async (callId: string) => {
  const response = await ruoyiRequest<AiCallHandoff>(
    recordPath(callId, '/handoffs'),
    {
      ...requestOptions,
      method: 'get',
    },
  );
  return unwrapPage(response);
};

export const getAiCallRecordEvents = async (callId: string) => {
  const response = await ruoyiRequest<AiCallRecordEvent>(
    recordPath(callId, '/events'),
    {
      ...requestOptions,
      method: 'get',
      params: { limit: 200 },
    },
  );
  return unwrapPage(response);
};

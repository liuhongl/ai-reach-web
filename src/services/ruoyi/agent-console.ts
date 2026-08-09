import {
  ruoyiRequest,
  type RuoyiRequestOptions,
} from '@/adapters/ruoyi/request';

/**
 * Frozen backend contract: ai-call/codex/ai-call-workflow-split.
 * The commit currently implements profiles/auth/scopes; later endpoints follow
 * the authoritative V1 specification at the same commit.
 */
export const AGENT_CONSOLE_BACKEND_COMMIT =
  'f6957be1307a6286473ab1b97824e9b253e0525c';
export const AGENT_CONSOLE_PROXY_PREFIX = '/ai-call-agent-api';
export const AGENT_CONSOLE_API_PREFIX = '/ai-call/agent-console';
export const AGENT_CONSOLE_ADMIN_API_PREFIX = '/ai-call/admin';

export type BigintString = string;
export type SceneCode =
  | 'intro_contract'
  | 'intro_document'
  | 'intro_overseas'
  | 'intro_geo';
export type AgentStatus =
  | 'offline'
  | 'available'
  | 'claiming'
  | 'in_call'
  | 'reconnecting'
  | 'wrap_up_quick'
  | 'paused';
export type HandoffStatus =
  | 'requested'
  | 'accepted'
  | 'connected'
  | 'completed'
  | 'expired'
  | 'canceled'
  | 'failed';
export type FollowUpStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'closed';
export type FollowUpSourceType =
  | 'after_call_work'
  | 'handoff_unanswered'
  | 'ai_post_call';
export type DispositionCode =
  | 'resolved'
  | 'follow_up_required'
  | 'customer_refused'
  | 'invalid_contact'
  | 'other';
export type ClosedReason =
  | 'customer_refused'
  | 'invalid_contact'
  | 'created_by_error'
  | 'no_longer_needed'
  | 'other';
export type ContactChannel =
  | 'system_callback'
  | 'manual_phone'
  | 'wechat'
  | 'email'
  | 'other';
export type AttemptResult =
  | 'connected'
  | 'no_answer'
  | 'busy'
  | 'rejected'
  | 'invalid_contact'
  | 'technical_failure';
export type AgentConsoleErrorCode =
  | 'HANDOFF_ALREADY_CLAIMED'
  | 'HANDOFF_EXPIRED'
  | 'CUSTOMER_NOT_CONNECTED'
  | 'AGENT_NOT_AVAILABLE'
  | 'AGENT_SCOPE_MISMATCH'
  | 'AGENT_ALREADY_IN_CALL'
  | 'AGENT_ACTIVE_CALL_EXISTS'
  | 'STALE_RELEASE_NOT_ALLOWED'
  | 'CONSOLE_SESSION_CONFLICT'
  | 'CLAIM_CONNECT_TIMEOUT'
  | 'AGENT_RECONNECT_TIMEOUT'
  | 'HANDOFF_STATE_CONFLICT'
  | 'MEDIA_NOT_READY'
  | 'FOLLOW_UP_ALREADY_CLAIMED'
  | 'FOLLOW_UP_STATE_CONFLICT';

export type AgentProfileDto = {
  id: BigintString;
  tenant_id: string;
  agent_identity: string;
  user_id: BigintString;
  enabled: boolean;
  scene_codes: SceneCode[];
  user_name?: string;
  nick_name?: string;
};

export type AgentPresenceDto = {
  id?: BigintString;
  agent_identity: string;
  status: AgentStatus;
  active_handoff_id?: BigintString | null;
  active_call_id?: string | null;
  console_session_id?: string | null;
  last_seen_at?: string | null;
  status_updated_at?: string | null;
};

export type AdminAgentDto = AgentProfileDto & {
  presence?: AgentPresenceDto | null;
  runtime_status?: AgentStatus;
  abnormal_occupied?: boolean;
  abnormal_reason?: string | null;
};

export type DialogueTurnDto = {
  id?: BigintString;
  speaker_type: 'customer' | 'ai' | 'human_agent' | 'agent' | string;
  text: string;
  occurred_at?: string;
};

export type PendingItemDto = {
  text: string;
  evidence?: string;
};

export type HandoffDto = {
  id?: BigintString;
  handoff_id: BigintString;
  call_id: string;
  room_name?: string;
  scene_code: SceneCode;
  status: HandoffStatus;
  request_source?: string;
  request_reason?: string;
  request_message?: string;
  masked_customer_name?: string;
  masked_contact?: string;
  business_type?: string | null;
  business_id?: string | null;
  handoff_summary?: string | null;
  pending_items?: PendingItemDto[];
  recent_dialogue?: DialogueTurnDto[];
  requested_at: string;
  accepted_at?: string | null;
  connected_at?: string | null;
  ended_at?: string | null;
  expires_at?: string | null;
  claim_expires_at?: string | null;
  reconnect_expires_at?: string | null;
  human_agent_identity?: string | null;
  end_reason?: string | null;
  failure_stage?: string | null;
  failure_message?: string | null;
};

export type HandoffContextDto = Omit<
  HandoffDto,
  'pending_items' | 'recent_dialogue'
> & {
  dialogue: DialogueTurnDto[];
};

export type AgentConsoleBootstrapDto = {
  profile: AgentProfileDto;
  presence?: AgentPresenceDto;
  current_handoff?: HandoffDto | null;
  pending_handoffs?: HandoffDto[];
};

export type MediaCredentialDto = {
  handoff: HandoffDto;
  livekit_url: string;
  participant_token: string;
  participant_identity: string;
};

export type FollowUpCallbackCredentialDto = {
  call_id: string;
  status: 'accepted';
  livekit_url: string;
  participant_token: string;
  participant_identity: string;
  expires_in_seconds: number;
};

export type AfterCallWorkDto = {
  id: BigintString;
  work_id: BigintString;
  call_id: string;
  handoff_id: BigintString;
  agent_identity: string;
  disposition_code: DispositionCode;
  summary?: string | null;
  needs_follow_up: boolean;
  submitted_at: string;
};

export type FollowUpAttemptDto = {
  id: BigintString;
  follow_up_id: BigintString;
  agent_identity: string;
  contact_channel: ContactChannel;
  attempt_result: AttemptResult;
  related_call_id?: string | null;
  ring_duration_seconds?: number | null;
  error_message?: string | null;
  remark?: string | null;
  contacted_at: string;
  customer_callback_at?: string | null;
};

export type FollowUpNextAction = 'continue' | 'complete' | 'close';

export type FollowUpHandlingResultDto = {
  id: BigintString;
  follow_up_id: BigintString;
  related_call_id?: string | null;
  contact_channel: Exclude<ContactChannel, 'system_callback'>;
  contact_result: AttemptResult;
  remark: string;
  next_action: FollowUpNextAction;
  next_follow_up_at?: string | null;
  closed_reason?: ClosedReason | null;
  agent_identity: string;
  handled_at: string;
};

export type FollowUpRecordDto = {
  id: BigintString;
  call_id: string;
  entry_type: string;
  status: string;
  end_reason?: string | null;
  started_at: string;
  answered_at?: string | null;
  ended_at?: string | null;
  duration_ms?: number | null;
};

export type FollowUpTaskDto = {
  id: BigintString;
  source_type: FollowUpSourceType;
  source_call_id: string;
  source_handoff_id: BigintString | null;
  scene_code: SceneCode;
  business_type?: string | null;
  business_id?: string | null;
  customer_name?: string | null;
  task_name?: string | null;
  masked_contact?: string;
  owner_agent_identity?: string | null;
  status: FollowUpStatus;
  follow_up_reason: string;
  customer_callback_at?: string | null;
  summary?: string | null;
  closed_reason?: ClosedReason | null;
  closed_remark?: string | null;
  attempts?: FollowUpAttemptDto[];
  latest_attempt?: FollowUpAttemptDto | null;
  handling_results?: FollowUpHandlingResultDto[];
  awaiting_handling_result?: boolean;
  pending_handling_call_id?: string | null;
  source_record?: FollowUpRecordDto | null;
  callback_records?: FollowUpRecordDto[];
  created_at: string;
  updated_at?: string;
};

export type PageResult<T> = {
  rows: T[];
  total: number;
  metrics?: Record<string, number>;
};

export type PageQuery = {
  pageNum?: number;
  pageSize?: number;
  [key: string]: unknown;
};

export type FollowUpListQuery = {
  pageNum?: number;
  pageSize?: number;
  ownership?: 'unassigned' | 'mine';
  status?: FollowUpStatus[];
  sceneCode?: SceneCode;
  customerName?: string;
  createdAtBegin?: string;
  createdAtEnd?: string;
};

export type PendingHandoffsQuery = {
  consoleSessionId: string;
  limit?: number;
};

export type PresenceInput = {
  consoleSessionId: string;
};

export type OnlinePresenceInput = PresenceInput & {
  devicePreflightPassed: boolean;
};

export type IdempotentSessionInput = PresenceInput & {
  idempotencyKey: string;
};

export type MediaReadyInput = IdempotentSessionInput & {
  participantIdentity: string;
};

export type AfterCallWorkInput = {
  handoffId: BigintString;
  dispositionCode: DispositionCode;
  needsFollowUp: boolean;
  summary?: string;
  customerCallbackAt?: string;
  idempotencyKey: string;
};

export type FollowUpAttemptInput = {
  contactChannel: ContactChannel;
  attemptResult: AttemptResult;
  relatedCallId?: string;
  ringDurationSeconds?: number;
  errorMessage?: string;
  remark?: string;
  contactedAt?: string;
  customerCallbackAt?: string;
  idempotencyKey: string;
};

export type CloseFollowUpInput = {
  closedReason: ClosedReason;
  closedRemark?: string;
  idempotencyKey: string;
};

export type SubmitFollowUpHandlingResultInput = {
  callId?: string;
  contactChannel?: Exclude<
    ContactChannel,
    'system_callback' | 'manual_phone'
  >;
  contactResult: AttemptResult;
  remark: string;
  nextAction: FollowUpNextAction;
  nextFollowUpAt?: string;
  closedReason?: ClosedReason;
  idempotencyKey: string;
};

export type AdminAgentCreateInput = {
  userId: BigintString;
  agentIdentity: string;
  enabled?: boolean;
};

export type AdminAgentUpdateInput = {
  enabled: boolean;
};

export type AdminAgentSceneScopesInput = {
  sceneCodes: SceneCode[];
};

const agentConsoleRequest = <T>(
  path: string,
  options: RuoyiRequestOptions = {},
) =>
  ruoyiRequest<T>(path, {
    ...options,
    baseApi: AGENT_CONSOLE_PROXY_PREFIX,
  });

const encodeId = (value: string) => encodeURIComponent(value);

const idempotencyHeaders = (key: string) => ({
  'Idempotency-Key': key,
});

const presenceData = ({ consoleSessionId }: PresenceInput) => ({
  console_session_id: consoleSessionId,
});

export const getAgentConsoleBootstrap = () =>
  agentConsoleRequest<AgentConsoleBootstrapDto>(
    `${AGENT_CONSOLE_API_PREFIX}/bootstrap`,
    { method: 'get', skipErrorHandler: true },
  );

export const setAgentOnline = (input: OnlinePresenceInput) =>
  agentConsoleRequest<AgentPresenceDto>(
    `${AGENT_CONSOLE_API_PREFIX}/presence/online`,
    {
      method: 'post',
      data: {
        ...presenceData(input),
        device_preflight_passed: input.devicePreflightPassed,
      },
    },
  );

export const pauseAgent = (input: PresenceInput) =>
  agentConsoleRequest<AgentPresenceDto>(
    `${AGENT_CONSOLE_API_PREFIX}/presence/pause`,
    { method: 'post', data: presenceData(input) },
  );

export const setAgentOffline = (input: PresenceInput) =>
  agentConsoleRequest<AgentPresenceDto>(
    `${AGENT_CONSOLE_API_PREFIX}/presence/offline`,
    { method: 'post', data: presenceData(input) },
  );

export const heartbeatAgent = (input: PresenceInput) =>
  agentConsoleRequest<AgentPresenceDto>(
    `${AGENT_CONSOLE_API_PREFIX}/presence/heartbeat`,
    { method: 'post', data: presenceData(input) },
  );

export const getPendingHandoffs = ({
  consoleSessionId,
  limit = 50,
}: PendingHandoffsQuery) =>
  agentConsoleRequest<PageResult<HandoffDto>>(
    `${AGENT_CONSOLE_API_PREFIX}/handoffs/pending`,
    {
      method: 'get',
      skipErrorHandler: true,
      params: {
        console_session_id: consoleSessionId,
        limit,
      },
    },
  );

export const getHandoffContext = (
  handoffId: BigintString,
  consoleSessionId: string,
) =>
  agentConsoleRequest<HandoffContextDto>(
    `${AGENT_CONSOLE_API_PREFIX}/handoffs/${encodeId(handoffId)}/context`,
    {
      method: 'get',
      skipErrorHandler: true,
      params: {
        console_session_id: consoleSessionId,
      },
    },
  );

export const claimHandoff = (
  handoffId: BigintString,
  input: IdempotentSessionInput,
) =>
  agentConsoleRequest<MediaCredentialDto>(
    `${AGENT_CONSOLE_API_PREFIX}/handoffs/${encodeId(handoffId)}/claim`,
    {
      method: 'post',
      headers: idempotencyHeaders(input.idempotencyKey),
      data: presenceData(input),
    },
  );

export const confirmHandoffMediaReady = (
  handoffId: BigintString,
  input: MediaReadyInput,
) =>
  agentConsoleRequest<HandoffDto>(
    `${AGENT_CONSOLE_API_PREFIX}/handoffs/${encodeId(handoffId)}/media-ready`,
    {
      method: 'post',
      headers: idempotencyHeaders(input.idempotencyKey),
      data: {
        ...presenceData(input),
        participant_identity: input.participantIdentity,
      },
    },
  );

export const getHandoffReconnectToken = (
  handoffId: BigintString,
  input: IdempotentSessionInput,
) =>
  agentConsoleRequest<MediaCredentialDto>(
    `${AGENT_CONSOLE_API_PREFIX}/handoffs/${encodeId(handoffId)}/reconnect-token`,
    {
      method: 'post',
      headers: idempotencyHeaders(input.idempotencyKey),
      data: presenceData(input),
    },
  );

export const completeHandoff = (
  handoffId: BigintString,
  input: IdempotentSessionInput,
) =>
  agentConsoleRequest<HandoffDto>(
    `${AGENT_CONSOLE_API_PREFIX}/handoffs/${encodeId(handoffId)}/complete`,
    {
      method: 'post',
      headers: idempotencyHeaders(input.idempotencyKey),
      data: presenceData(input),
    },
  );

export const submitAfterCallWork = (
  callId: string,
  input: AfterCallWorkInput,
) =>
  agentConsoleRequest<AfterCallWorkDto>(
    `${AGENT_CONSOLE_API_PREFIX}/calls/${encodeId(callId)}/after-call-work`,
    {
      method: 'put',
      headers: idempotencyHeaders(input.idempotencyKey),
      data: {
        handoff_id: input.handoffId,
        disposition_code: input.dispositionCode,
        needs_follow_up: input.needsFollowUp,
        summary: input.summary,
        customer_callback_at: input.customerCallbackAt,
      },
    },
  );

export const listAgentFollowUps = (params: FollowUpListQuery = {}) =>
  agentConsoleRequest<PageResult<FollowUpTaskDto>>(
    `${AGENT_CONSOLE_API_PREFIX}/follow-ups`,
    {
      method: 'get',
      params: {
        ...params,
        status: params.status?.join(','),
      },
    },
  );

export const getAgentFollowUp = (followUpId: BigintString) =>
  agentConsoleRequest<FollowUpTaskDto>(
    `${AGENT_CONSOLE_API_PREFIX}/follow-ups/${encodeId(followUpId)}`,
    { method: 'get' },
  );

export const createFollowUpAttempt = (
  followUpId: BigintString,
  input: FollowUpAttemptInput,
) =>
  agentConsoleRequest<FollowUpAttemptDto>(
    `${AGENT_CONSOLE_API_PREFIX}/follow-ups/${encodeId(followUpId)}/attempts`,
    {
      method: 'post',
      headers: idempotencyHeaders(input.idempotencyKey),
      data: {
        contact_channel: input.contactChannel,
        attempt_result: input.attemptResult,
        related_call_id: input.relatedCallId,
        ring_duration_seconds: input.ringDurationSeconds,
        error_message: input.errorMessage,
        remark: input.remark,
        contacted_at: input.contactedAt,
        customer_callback_at: input.customerCallbackAt,
      },
    },
  );

export const submitFollowUpHandlingResult = (
  followUpId: BigintString,
  input: SubmitFollowUpHandlingResultInput,
) =>
  agentConsoleRequest<FollowUpTaskDto>(
    `${AGENT_CONSOLE_API_PREFIX}/follow-ups/${encodeId(followUpId)}/handling-results`,
    {
      method: 'post',
      headers: idempotencyHeaders(input.idempotencyKey),
      data: {
        call_id: input.callId,
        ...(input.contactChannel
          ? { contact_channel: input.contactChannel }
          : {}),
        contact_result: input.contactResult,
        remark: input.remark,
        next_action: input.nextAction,
        next_follow_up_at: input.nextFollowUpAt,
        closed_reason: input.closedReason,
      },
    },
  );

const followUpAction = <T>(
  followUpId: BigintString,
  action: string,
  idempotencyKey: string,
  data?: Record<string, unknown>,
) =>
  agentConsoleRequest<T>(
    `${AGENT_CONSOLE_API_PREFIX}/follow-ups/${encodeId(followUpId)}/${action}`,
    {
      method: 'post',
      headers: idempotencyHeaders(idempotencyKey),
      data,
    },
  );

export const claimFollowUp = (
  followUpId: BigintString,
  idempotencyKey: string,
) => followUpAction<FollowUpTaskDto>(followUpId, 'claim', idempotencyKey);

export const startFollowUpCall = (
  followUpId: BigintString,
  input: IdempotentSessionInput,
) =>
  agentConsoleRequest<FollowUpCallbackCredentialDto>(
    `${AGENT_CONSOLE_API_PREFIX}/follow-ups/${encodeId(followUpId)}/call`,
    {
      method: 'post',
      headers: idempotencyHeaders(input.idempotencyKey),
      data: presenceData(input),
    },
  );

export const endFollowUpCall = (
  followUpId: BigintString,
  callId: string,
  input: IdempotentSessionInput,
) =>
  agentConsoleRequest<{ call_id: string; status: 'completed'; end_reason: string }>(
    `${AGENT_CONSOLE_API_PREFIX}/follow-ups/${encodeId(followUpId)}/call/${encodeId(callId)}/end`,
    {
      method: 'post',
      headers: idempotencyHeaders(input.idempotencyKey),
      data: presenceData(input),
    },
  );

export const completeFollowUp = (
  followUpId: BigintString,
  idempotencyKey: string,
) => followUpAction<FollowUpTaskDto>(followUpId, 'complete', idempotencyKey);

export const closeFollowUp = (
  followUpId: BigintString,
  input: CloseFollowUpInput,
) =>
  followUpAction<FollowUpTaskDto>(
    followUpId,
    'close',
    input.idempotencyKey,
    {
      closed_reason: input.closedReason,
      closed_remark: input.closedRemark,
    },
  );

export const listAdminAgents = (params: PageQuery = {}) =>
  agentConsoleRequest<PageResult<AdminAgentDto>>(
    `${AGENT_CONSOLE_ADMIN_API_PREFIX}/agents`,
    { method: 'get', params },
  );

export const createAdminAgent = (input: AdminAgentCreateInput) =>
  agentConsoleRequest<AgentProfileDto>(
    `${AGENT_CONSOLE_ADMIN_API_PREFIX}/agents`,
    {
      method: 'post',
      data: {
        user_id: input.userId,
        agent_identity: input.agentIdentity,
        enabled: input.enabled ?? false,
      },
    },
  );

export const updateAdminAgent = (
  agentId: BigintString,
  input: AdminAgentUpdateInput,
) =>
  agentConsoleRequest<AgentProfileDto>(
    `${AGENT_CONSOLE_ADMIN_API_PREFIX}/agents/${encodeId(agentId)}`,
    { method: 'put', data: input },
  );

export const updateAdminAgentSceneScopes = (
  agentId: BigintString,
  input: AdminAgentSceneScopesInput,
) =>
  agentConsoleRequest<{ sceneCodes: SceneCode[] }>(
    `${AGENT_CONSOLE_ADMIN_API_PREFIX}/agents/${encodeId(agentId)}/scene-scopes`,
    { method: 'put', data: { scene_codes: input.sceneCodes } },
  );

export const getAdminAgentStatus = (agentId: BigintString) =>
  agentConsoleRequest<AgentPresenceDto>(
    `${AGENT_CONSOLE_ADMIN_API_PREFIX}/agents/${encodeId(agentId)}/status`,
    { method: 'get' },
  );

export const releaseStaleAgent = (
  agentId: BigintString,
  idempotencyKey: string,
) =>
  agentConsoleRequest<AgentPresenceDto>(
    `${AGENT_CONSOLE_ADMIN_API_PREFIX}/agents/${encodeId(agentId)}/release-stale`,
    { method: 'post', headers: idempotencyHeaders(idempotencyKey) },
  );

export const listAdminHandoffs = (params: PageQuery = {}) =>
  agentConsoleRequest<PageResult<HandoffDto>>(
    `${AGENT_CONSOLE_ADMIN_API_PREFIX}/handoffs`,
    { method: 'get', params, timeout: 10_000 },
  );

export const getAdminHandoff = (handoffId: BigintString) =>
  agentConsoleRequest<HandoffDto>(
    `${AGENT_CONSOLE_ADMIN_API_PREFIX}/handoffs/${encodeId(handoffId)}`,
    { method: 'get', timeout: 10_000 },
  );

export const reconcileAdminHandoff = (
  handoffId: BigintString,
  idempotencyKey: string,
) =>
  agentConsoleRequest<HandoffDto>(
    `${AGENT_CONSOLE_ADMIN_API_PREFIX}/handoffs/${encodeId(handoffId)}/reconcile`,
    { method: 'post', headers: idempotencyHeaders(idempotencyKey) },
  );

export const listAdminFollowUps = (params: PageQuery = {}) =>
  agentConsoleRequest<PageResult<FollowUpTaskDto>>(
    `${AGENT_CONSOLE_ADMIN_API_PREFIX}/follow-ups`,
    { method: 'get', params, timeout: 10_000 },
  );

export const getAdminFollowUp = (followUpId: BigintString) =>
  agentConsoleRequest<FollowUpTaskDto>(
    `${AGENT_CONSOLE_ADMIN_API_PREFIX}/follow-ups/${encodeId(followUpId)}`,
    { method: 'get', timeout: 10_000 },
  );

import { ruoyiRequest } from '@/adapters/ruoyi/request';

const requestOptions = { baseApi: '/ai-call-agent-api' } as const;
const FOLLOW_UP_DATA_PATH = '/ai-call/follow-up-data';

export type FollowUpClassification =
  | 'interested'
  | 'nurturing'
  | 'low_value'
  | 'converted';

export type LowValueReason =
  | 'explicit_rejection'
  | 'no_current_need'
  | 'customer_mismatch'
  | 'non_target_customer'
  | 'invalid_contact'
  | 'other';

export type FollowUpDataRow = {
  follow_up_data_id: string;
  tenant_id: string;
  task_id: string;
  target_id: string;
  source_call_id: string;
  customer_name?: string | null;
  masked_contact?: string | null;
  task_name?: string | null;
  classification: FollowUpClassification;
  classification_reason?: string | null;
  classification_source?: 'ai' | 'human' | 'system' | null;
  classification_confidence?: 'high' | 'medium' | 'low' | null;
  suggest_review: boolean;
  low_value_reason?: LowValueReason | null;
  latest_conclusion?: string | null;
  last_contact_at?: string | null;
  next_follow_up_at?: string | null;
  active_follow_up_id?: string | null;
  follow_up_task_status?: 'pending' | 'processing' | null;
  active_follow_up_owner_agent_identity?: string | null;
  active_follow_up_reason?: string | null;
  classification_updated_at?: string | null;
  classification_updated_by?: string | null;
  after_call_result_status: 'not_applicable' | 'pending' | 'submitted';
  blocking_human_call_id?: string | null;
  version: number;
};

export type FollowUpDataTimelineItem = {
  type: 'call' | 'classification_adjustment';
  call_id?: string | null;
  occurred_at?: string | null;
  entry_type?: string | null;
  status?: string | null;
  end_reason?: string | null;
  duration_ms?: number | null;
  operator_agent_identity?: string | null;
  conclusion?: string | null;
  after_call_result_status?: 'not_applicable' | 'pending' | 'submitted';
  semantic_analysis?: Record<string, unknown> | null;
  next_follow_up_at?: string | null;
  from_classification?: FollowUpClassification | null;
  to_classification?: FollowUpClassification | null;
  operator?: string | null;
};

export type FollowUpDataDetail = FollowUpDataRow & {
  timeline: FollowUpDataTimelineItem[];
};

export type FollowUpDataQuery = {
  classification: FollowUpClassification;
  customerName?: string;
  taskId?: string;
  lastContactAtBegin?: string;
  lastContactAtEnd?: string;
  pageNum: number;
  pageSize: number;
};

type PageResponse<T> = { rows?: T[]; total?: number };
type DataResponse<T> = { data?: T };

const unwrapPage = <T>(response: PageResponse<T>) => ({
  rows: Array.isArray(response.rows) ? response.rows : [],
  total: Number(response.total) || 0,
});

const unwrapData = <T>(response: DataResponse<T> | T): T =>
  response && typeof response === 'object' && 'data' in response
    ? (response.data as T)
    : (response as T);

const dataPath = (followUpDataId: string, suffix = '') =>
  `${FOLLOW_UP_DATA_PATH}/${encodeURIComponent(followUpDataId)}${suffix}`;

export const listFollowUpData = async (params: FollowUpDataQuery) =>
  unwrapPage(
    await ruoyiRequest<FollowUpDataRow>(FOLLOW_UP_DATA_PATH, {
      ...requestOptions,
      method: 'get',
      params,
    }),
  );

export const getFollowUpData = async (followUpDataId: string) =>
  unwrapData(
    await ruoyiRequest<FollowUpDataDetail>(dataPath(followUpDataId), {
      ...requestOptions,
      method: 'get',
    }),
  );

export const adjustFollowUpDataClassification = async (
  followUpDataId: string,
  input: {
    classification: FollowUpClassification;
    reason: string;
    lowValueReason?: LowValueReason;
    expectedVersion: number;
    idempotencyKey: string;
  },
) =>
  unwrapData(
    await ruoyiRequest<{ version: number }>(
      dataPath(followUpDataId, '/classification'),
      {
        ...requestOptions,
        method: 'put',
        headers: { 'Idempotency-Key': input.idempotencyKey },
        data: {
          classification: input.classification,
          reason: input.reason,
          low_value_reason: input.lowValueReason,
          expected_version: input.expectedVersion,
        },
      },
    ),
  );

export const scheduleFollowUpData = async (
  followUpDataId: string,
  input: {
    followUpReason: string;
    nextFollowUpAt: string;
    expectedVersion: number;
    idempotencyKey: string;
  },
) =>
  unwrapData(
    await ruoyiRequest<{ version: number; follow_up_id: string }>(
      dataPath(followUpDataId, '/schedule'),
      {
        ...requestOptions,
        method: 'post',
        headers: { 'Idempotency-Key': input.idempotencyKey },
        data: {
          follow_up_reason: input.followUpReason,
          next_follow_up_at: input.nextFollowUpAt,
          expected_version: input.expectedVersion,
        },
      },
    ),
  );

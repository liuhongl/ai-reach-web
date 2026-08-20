import { ruoyiDownload } from '@/adapters/ruoyi/download';
import { ruoyiRequest } from '@/adapters/ruoyi/request';
import type { RuoyiResponse } from '@/adapters/ruoyi/response';
import type {
  AiCallTask,
  AiCallTaskTarget,
  AiCallTaskTestCapability,
  AiCallTaskTestStatus,
  AnswerMode,
  ExceptionBatch,
  ExceptionCategory,
  ExceptionSummary,
  ExceptionTarget,
  ExecutionMode,
  LinphoneTestScenario,
  TargetStatus,
  TaskMode,
  TaskStatus,
  ValidationIssue,
  ValidationRetryAction,
  ValidationStatus,
} from './domain';

export const AI_CALL_AGENT_BASE_API = '/ai-call-agent-api';

const OUTBOUND_PREFIX = '/ai-call';
const TASKS_PATH = `${OUTBOUND_PREFIX}/outbound-tasks`;
const RUNTIME_CALLS_PATH = `${OUTBOUND_PREFIX}/runtime/calls`;
const SESSIONS_PATH = `${OUTBOUND_PREFIX}/sessions`;
const TASK_TESTS_PATH = `${OUTBOUND_PREFIX}/lab/outbound-task-tests`;
const VALIDATIONS_PATH = `${OUTBOUND_PREFIX}/outbound-validations`;
const EXCEPTIONS_PATH = `${OUTBOUND_PREFIX}/outbound-exceptions`;

export type PageResult<T> = {
  rows: T[];
  total: number;
};

export type AiCallTaskQuery = {
  pageNum: number;
  pageSize: number;
  taskName?: string;
  status?: TaskStatus;
  beginTime?: string;
  endTime?: string;
  sceneCode?: string;
};

export type AiCallTaskTargetQuery = {
  pageNum: number;
  pageSize: number;
  phoneNumber?: string;
  customerName?: string;
  status?: TargetStatus;
};

export type ExceptionTargetQuery = {
  category: ExceptionCategory;
  pageNum: number;
  pageSize: number;
  status?: string;
  keyword?: string;
};

export type ValidationIssueQuery = {
  pageNum: number;
  pageSize: number;
  phoneNumber?: string;
  reason?: string;
};

export type ValidationRequest = {
  taskName: string;
  taskMode: TaskMode;
  answerMode: AnswerMode;
  promptProfileId?: string;
  sceneCode: string;
  voice: string;
  ruleId: string;
  executionMode: ExecutionMode;
  scheduledAt?: string;
};

export type SingleTargetValidationRequest = ValidationRequest & {
  taskMode: 'single';
  phoneNumber?: string;
  customerName?: string;
};

export type BatchTargetValidationRequest = ValidationRequest & {
  taskMode: 'batch';
};

export type CreateBatchValidationPayload = {
  file: File;
  request: BatchTargetValidationRequest;
};

type ValidationResultBase = {
  validationId: string;
  validTargetCount: number;
  issueCount: number;
  issueStats?: Record<string, number>;
  errorMessage?: string | null;
  accepted?: boolean;
};

export type ValidationResult =
  | (ValidationResultBase & {
      status: Exclude<ValidationStatus, 'SYSTEM_ERROR'>;
      retryAction?: never;
    })
  | (ValidationResultBase & {
      status: 'SYSTEM_ERROR';
      retryAction: ValidationRetryAction;
    });

export type CreateAiCallTaskPayload = ValidationRequest;

export type AcceptedCommand = {
  accepted: true;
};

export type AiCallRuntimeBrowserToken = {
  callId: string;
  roomName: string;
  livekitUrl: string;
  participantToken: string;
  participantIdentity: string;
  expiresInSeconds: number;
};

export type AiCallTaskTestAccepted = AcceptedCommand & {
  taskId: string;
  attemptId: string;
  callId: string;
};

export type CreateAiCallTaskResult = AcceptedCommand & {
  taskId: string;
};

export type UpdateAiCallTaskSchedulePayload = {
  taskName: string;
  scheduledAt: string;
};

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

const unwrapPage = <T>(response: RuoyiResponse<T> | T): PageResult<T> => {
  const envelope = requireEnvelope(response);
  if (!Array.isArray(envelope.rows) || typeof envelope.total !== 'number') {
    throw new Error('分页响应缺少 rows 或 total');
  }
  return { rows: envelope.rows, total: envelope.total };
};

const requestOptions = {
  baseApi: AI_CALL_AGENT_BASE_API,
} as const;

export const listAiCallTasks = async (
  params: AiCallTaskQuery,
): Promise<PageResult<AiCallTask>> =>
  unwrapPage(
    await ruoyiRequest<AiCallTask>(TASKS_PATH, {
      ...requestOptions,
      method: 'get',
      params,
    }),
  );

export const getExceptionSummary = async (): Promise<ExceptionSummary> =>
  unwrapData(
    await ruoyiRequest<ExceptionSummary>(`${EXCEPTIONS_PATH}/summary`, {
      ...requestOptions,
      method: 'get',
    }),
  );

export const listExceptionTargets = async (
  params: ExceptionTargetQuery,
): Promise<PageResult<ExceptionTarget>> =>
  unwrapPage(
    await ruoyiRequest<ExceptionTarget>(EXCEPTIONS_PATH, {
      ...requestOptions,
      method: 'get',
      params,
    }),
  );

export const updateExceptionPolicy = async (
  category: ExceptionCategory,
  payload: { intervalDays: number; maxRetryCount: number },
): Promise<void> => {
  await unwrapData(
    await ruoyiRequest(`${EXCEPTIONS_PATH}/${category}/policy`, {
      ...requestOptions,
      method: 'put',
      data: payload,
      repeatSubmit: false,
    }),
  );
};

export const startExceptionBatch = async (
  category: ExceptionCategory,
  idempotencyKey: string,
): Promise<ExceptionBatch> =>
  unwrapData(
    await ruoyiRequest<ExceptionBatch>(
      `${EXCEPTIONS_PATH}/${category}/retry-batches`,
      {
        ...requestOptions,
        method: 'post',
        headers: { 'Idempotency-Key': idempotencyKey },
      },
    ),
  );

export const downloadExceptionTargets = async (
  category: ExceptionCategory,
): Promise<void> => {
  const response = await ruoyiRequest<Blob>(`${EXCEPTIONS_PATH}/export`, {
    ...requestOptions,
    method: 'get',
    params: { category },
    responseType: 'blob',
  });
  const blob = response as Blob;
  if (blob.type === 'application/json') {
    const result = JSON.parse(await blob.text()) as { msg?: string };
    throw new Error(result.msg || '下载文件失败');
  }
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `异常呼叫数据-${category}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const getAiCallTask = async (taskId: string): Promise<AiCallTask> =>
  unwrapData(
    await ruoyiRequest<AiCallTask>(`${TASKS_PATH}/${taskId}`, {
      ...requestOptions,
      method: 'get',
    }),
  );

export const createAiCallTask = async (
  payload: CreateAiCallTaskPayload,
  validationId: string,
  idempotencyKey: string,
): Promise<CreateAiCallTaskResult> =>
  unwrapData(
    await ruoyiRequest<CreateAiCallTaskResult>(TASKS_PATH, {
      ...requestOptions,
      method: 'post',
      headers: { 'Idempotency-Key': idempotencyKey },
      data: { ...payload, validationId },
    }),
  );

export const updateAiCallTaskSchedule = async (
  taskId: string,
  payload: UpdateAiCallTaskSchedulePayload,
  idempotencyKey: string,
): Promise<AcceptedCommand> =>
  unwrapData(
    await ruoyiRequest<AcceptedCommand>(`${TASKS_PATH}/${taskId}/schedule`, {
      ...requestOptions,
      method: 'put',
      headers: { 'Idempotency-Key': idempotencyKey },
      data: payload,
    }),
  );

const runTaskAction = async (
  taskId: string,
  action: 'pause' | 'resume' | 'stop' | 'cancel',
  idempotencyKey: string,
): Promise<AcceptedCommand> =>
  unwrapData(
    await ruoyiRequest<AcceptedCommand>(`${TASKS_PATH}/${taskId}/${action}`, {
      ...requestOptions,
      method: 'post',
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  );

export const pauseAiCallTask = (
  taskId: string,
  idempotencyKey: string,
): Promise<AcceptedCommand> => runTaskAction(taskId, 'pause', idempotencyKey);

export const resumeAiCallTask = (
  taskId: string,
  idempotencyKey: string,
): Promise<AcceptedCommand> => runTaskAction(taskId, 'resume', idempotencyKey);

export const stopAiCallTask = (
  taskId: string,
  idempotencyKey: string,
): Promise<AcceptedCommand> => runTaskAction(taskId, 'stop', idempotencyKey);

export const cancelAiCallTask = (
  taskId: string,
  idempotencyKey: string,
): Promise<AcceptedCommand> => runTaskAction(taskId, 'cancel', idempotencyKey);

export const getAiCallTaskTestCapability = async (
  taskId: string,
): Promise<AiCallTaskTestCapability> =>
  unwrapData(
    await ruoyiRequest<AiCallTaskTestCapability>(
      `${TASK_TESTS_PATH}/${taskId}/capability`,
      {
        baseApi: AI_CALL_AGENT_BASE_API,
        method: 'get',
      },
    ),
  );

export const runAiCallTaskTest = async (
  taskId: string,
  scenario: LinphoneTestScenario,
  idempotencyKey: string,
): Promise<AiCallTaskTestAccepted> =>
  unwrapData(
    await ruoyiRequest<AiCallTaskTestAccepted>(
      `${TASK_TESTS_PATH}/${taskId}/runs`,
      {
        baseApi: AI_CALL_AGENT_BASE_API,
        method: 'post',
        headers: { 'Idempotency-Key': idempotencyKey },
        data: { scenario },
      },
    ),
  );

export const getAiCallTaskTestStatus = async (
  taskId: string,
): Promise<AiCallTaskTestStatus> =>
  unwrapData(
    await ruoyiRequest<AiCallTaskTestStatus>(
      `${TASK_TESTS_PATH}/${taskId}/status`,
      {
        baseApi: AI_CALL_AGENT_BASE_API,
        method: 'get',
      },
    ),
  );

export const endAiCallTaskActiveCall = async (
  taskId: string,
  idempotencyKey: string,
): Promise<AcceptedCommand> =>
  unwrapData(
    await ruoyiRequest<AcceptedCommand>(
      `${TASK_TESTS_PATH}/${taskId}/active-call/end`,
      {
        baseApi: AI_CALL_AGENT_BASE_API,
        method: 'post',
        headers: { 'Idempotency-Key': idempotencyKey },
      },
    ),
  );

export const listAiCallTaskTargets = async (
  taskId: string,
  params: AiCallTaskTargetQuery,
): Promise<PageResult<AiCallTaskTarget>> =>
  unwrapPage(
    await ruoyiRequest<AiCallTaskTarget>(`${TASKS_PATH}/${taskId}/targets`, {
      ...requestOptions,
      method: 'get',
      params,
    }),
  );

export const getAiCallRuntimeBrowserToken = async (
  callId: string,
): Promise<AiCallRuntimeBrowserToken> =>
  unwrapData(
    await ruoyiRequest<AiCallRuntimeBrowserToken>(
      `${RUNTIME_CALLS_PATH}/${encodeURIComponent(callId)}/token`,
      { ...requestOptions, method: 'post' },
    ),
  );

export const reportAiCallTaskBrowserEvent = async (
  callId: string,
  type: string,
): Promise<void> => {
  await unwrapData(
    await ruoyiRequest(
      `${SESSIONS_PATH}/${encodeURIComponent(callId)}/browser-events`,
      {
        ...requestOptions,
        method: 'post',
        data: { type },
      },
    ),
  );
};

export const downloadOutboundTargetTemplate = (
  promptProfileId?: string,
): Promise<void> =>
  ruoyiDownload(
    `${OUTBOUND_PREFIX}/outbound-targets/import-template`,
    promptProfileId ? { promptProfileId } : {},
    '外呼名单导入模板.xlsx',
    requestOptions,
  );

export const validateSingleTarget = async (
  payload: SingleTargetValidationRequest,
): Promise<ValidationResult> =>
  unwrapData(
    await ruoyiRequest<ValidationResult>(`${VALIDATIONS_PATH}/single`, {
      ...requestOptions,
      method: 'post',
      data: payload,
    }),
  );

export const createBatchValidation = async (
  payload: CreateBatchValidationPayload,
): Promise<ValidationResult> => {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('request', JSON.stringify(payload.request));
  return unwrapData(
    await ruoyiRequest<ValidationResult>(`${VALIDATIONS_PATH}/batch`, {
      ...requestOptions,
      method: 'post',
      data: formData,
      headers: { repeatSubmit: false },
    }),
  );
};

export const retryBatchValidation = async (
  validationId: string,
): Promise<ValidationResult> =>
  unwrapData(
    await ruoyiRequest<ValidationResult>(
      `${VALIDATIONS_PATH}/${validationId}/retry`,
      {
        ...requestOptions,
        method: 'post',
      },
    ),
  );

export const getValidationResult = async (
  validationId: string,
): Promise<ValidationResult> =>
  unwrapData(
    await ruoyiRequest<ValidationResult>(
      `${VALIDATIONS_PATH}/${validationId}`,
      {
        ...requestOptions,
        method: 'get',
      },
    ),
  );

export const listValidationIssues = async (
  validationId: string,
  params: ValidationIssueQuery,
): Promise<PageResult<ValidationIssue>> =>
  unwrapPage(
    await ruoyiRequest<ValidationIssue>(
      `${VALIDATIONS_PATH}/${validationId}/issues`,
      {
        ...requestOptions,
        method: 'get',
        params,
      },
    ),
  );

export const downloadValidationIssues = (
  validationId: string,
  params: Record<string, unknown> = {},
): Promise<void> =>
  ruoyiDownload(
    `${VALIDATIONS_PATH}/${validationId}/issues/export`,
    params,
    '外呼名单问题明细.xlsx',
    requestOptions,
  );

export type TaskStatus =
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSING'
  | 'PAUSED'
  | 'STOPPING'
  | 'STOPPED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type TargetStatus =
  | 'PENDING'
  | 'DIALING'
  | 'IN_CALL'
  | 'RETRY_WAIT'
  | 'COMPLETED'
  | 'CANCELLED';

export type LinphoneTestScenario = 'ai_only' | 'handoff';

export type LinphoneTestPhase =
  | 'dialing'
  | 'ai_call'
  | 'waiting_handoff'
  | 'human_call'
  | 'completed'
  | 'failed';

export type AiCallTaskTestCapability = {
  enabled: boolean;
  eligible: boolean;
  reasons: string[];
  availableAgentCount: number;
  activeCallId?: string | null;
  canEndActiveCall: boolean;
};

export type AiCallTaskTestStatus = {
  taskId: string;
  targetId: string;
  attemptId: string;
  callId: string;
  targetStatus: TargetStatus;
  attemptStatus: 'DIALING' | 'IN_CALL' | 'COMPLETED' | 'FAILED';
  callStatus?: string | null;
  handoffStatus?: string | null;
  phase: LinphoneTestPhase;
  elapsedSeconds: number;
  endReason?: string | null;
  errorMessage?: string | null;
  canEndActiveCall: boolean;
};

export type ValidationStatus =
  | 'VALIDATING'
  | 'PASSED'
  | 'FAILED'
  | 'SYSTEM_ERROR';

export type ValidationRetryAction = 'REUPLOAD' | 'RETRY_VALIDATION';

export type TaskMode = 'single' | 'batch';
export type AnswerMode = 'linphone' | 'web';
export type ExecutionMode = 'immediate' | 'scheduled';

export type TaskActionKey =
  | 'editSchedule'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'cancel'
  | 'view';

export type AiCallTaskLineSnapshot = {
  lineId: string;
  lineCode: string;
  lineName: string;
};

export type AiCallTask = {
  taskId: string;
  taskName: string;
  taskMode: TaskMode;
  answerMode?: AnswerMode;
  status: TaskStatus;
  totalTargets: number;
  completedTargets: number;
  connectedTargets: number;
  failedTargets: number;
  failedAttempts?: number;
  attemptDialerTypes?: string[];
  executionMode: ExecutionMode;
  scheduledAt?: string | null;
  nextDispatchAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  promptProfileId?: string | null;
  promptName: string;
  sceneCode: string;
  voice: string;
  voiceName?: string | null;
  ruleId: string;
  ruleName: string;
  ruleSummary: string;
  lineId?: string | null;
  lineName?: string | null;
  lineSnapshot?: AiCallTaskLineSnapshot | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string | null;
};

export type AiCallTaskTarget = {
  targetId: string;
  taskId: string;
  customerName?: string | null;
  phoneNumber?: string | null;
  status: TargetStatus;
  attemptCount: number;
  latestResult?: string | null;
  latestDialerType?: string | null;
  activeCallId?: string | null;
  activeCallStatus?: string | null;
  updatedAt: string;
};

export type ExceptionCategory =
  | 'no_answer'
  | 'rejected'
  | 'early_hangup'
  | 'invalid_number';

export type ExceptionDisplayStatus =
  | 'PENDING'
  | 'WAITING'
  | 'CALLING'
  | 'CONNECTED'
  | 'MAXED'
  | 'UNAVAILABLE'
  | 'STOPPED';

export type ExceptionSummaryCard = {
  category: ExceptionCategory;
  totalCount: number;
  pendingCount: number;
  maxedOutCount: number;
  policy?: {
    category: ExceptionCategory;
    intervalDays: number;
    maxRetryCount: number;
    retryable: boolean;
  } | null;
  activeBatch?: {
    batchId: string;
    targetCount: number;
    completedCount: number;
    startedAt: string;
  } | null;
  canStart: boolean;
  disabledReason?: string | null;
};

export type ExceptionSummary = {
  cards: ExceptionSummaryCard[];
};

export type ExceptionTarget = {
  targetId: string;
  customerName?: string | null;
  phoneNumber?: string | null;
  taskId: string;
  taskName: string;
  category: ExceptionCategory;
  sourceResult: string;
  originalAttemptCount: number;
  retryCount: number;
  maxRetryCount: number;
  status: ExceptionDisplayStatus;
  nextAttemptAt?: string | null;
  lastAttemptAt?: string | null;
  lastResult?: string | null;
  callId?: string | null;
};

export type ExceptionBatch = {
  accepted: true;
  batchId: string;
  category: ExceptionCategory;
  status: 'RUNNING' | 'COMPLETED';
  targetCount: number;
  intervalDays: number;
  maxRetryCount: number;
  startedAt: string;
};

export type ValidationIssue = {
  issueId: string;
  rowNumber: number;
  phoneNumber?: string | null;
  customerName?: string | null;
  reasons: string[];
  duplicateRowNumbers?: number[];
};

const TASK_ACTIONS: Record<TaskStatus, TaskActionKey[]> = {
  SCHEDULED: ['editSchedule', 'cancel', 'view'],
  RUNNING: ['pause', 'stop', 'view'],
  PAUSING: ['view'],
  PAUSED: ['resume', 'stop', 'view'],
  STOPPING: ['view'],
  STOPPED: ['view'],
  COMPLETED: ['view'],
  FAILED: ['view'],
  CANCELLED: ['view'],
};

export const getAllowedTaskActions = (status: TaskStatus): TaskActionKey[] =>
  TASK_ACTIONS[status];

export const isTaskPollingStatus = (status: TaskStatus): boolean =>
  status === 'RUNNING' || status === 'PAUSING' || status === 'STOPPING';

export const shouldPollTask = (
  task: Pick<AiCallTask, 'status' | 'executionMode'>,
): boolean =>
  isTaskPollingStatus(task.status) ||
  (task.status === 'SCHEDULED' && task.executionMode === 'immediate');

export const getTaskProgress = (task: AiCallTask): number =>
  task.totalTargets === 0
    ? 0
    : Math.round((task.completedTargets / task.totalTargets) * 100);

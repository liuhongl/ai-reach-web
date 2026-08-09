import type { Request, Response } from 'express';
import type {
  AiCallTask,
  AiCallTaskTarget,
  LinphoneTestPhase,
  LinphoneTestScenario,
  TaskStatus,
  ValidationIssue,
  ValidationRetryAction,
  ValidationStatus,
} from './domain';
import type { SingleTargetValidationRequest } from './service';

const now = '2026-07-27 10:00:00';

let tasks: AiCallTask[] = [
  {
    taskId: 'task-running',
    taskName: '合同审查客户批量回访',
    taskMode: 'batch',
    status: 'RUNNING',
    totalTargets: 100,
    completedTargets: 35,
    connectedTargets: 18,
    failedTargets: 5,
    executionMode: 'immediate',
    startedAt: '2026-07-27 09:00:00',
    promptProfileId: 'prompt-contract',
    promptName: '合同审查产品介绍',
    sceneCode: 'intro_contract',
    voice: 'Cherry',
    voiceName: 'Cherry',
    ruleId: 'rule-workday',
    ruleName: '工作日规则',
    ruleSummary: '09:00–12:00、14:00–18:00，最多重试 2 次',
    createdByName: '管理员',
    createdAt: '2026-07-27 08:55:00',
    updatedAt: now,
  },
  {
    taskId: 'task-scheduled',
    taskName: '单号码定时回访',
    taskMode: 'single',
    status: 'SCHEDULED',
    totalTargets: 1,
    completedTargets: 0,
    connectedTargets: 0,
    failedTargets: 0,
    executionMode: 'scheduled',
    scheduledAt: '2026-07-28 10:00:00',
    promptProfileId: 'prompt-contract',
    promptName: '合同审查产品介绍',
    sceneCode: 'intro_contract',
    voice: 'Cherry',
    voiceName: 'Cherry',
    ruleId: 'rule-workday',
    ruleName: '工作日规则',
    ruleSummary: '09:00–12:00、14:00–18:00，最多重试 2 次',
    createdByName: '管理员',
    createdAt: '2026-07-27 09:30:00',
    updatedAt: '2026-07-27 09:30:00',
  },
  {
    taskId: 'task-paused',
    taskName: '企业客户通知',
    taskMode: 'batch',
    status: 'PAUSED',
    totalTargets: 50,
    completedTargets: 20,
    connectedTargets: 12,
    failedTargets: 3,
    executionMode: 'immediate',
    startedAt: '2026-07-27 08:00:00',
    promptName: '企业服务通知',
    sceneCode: 'intro_business',
    voice: 'Cherry',
    voiceName: 'Cherry',
    ruleId: 'rule-workday',
    ruleName: '工作日规则',
    ruleSummary: '09:00–12:00、14:00–18:00，最多重试 2 次',
    createdByName: '管理员',
    createdAt: '2026-07-27 07:55:00',
    updatedAt: '2026-07-27 09:20:00',
  },
  {
    taskId: 'task-completed',
    taskName: '历史客户回访',
    taskMode: 'batch',
    status: 'COMPLETED',
    totalTargets: 20,
    completedTargets: 20,
    connectedTargets: 14,
    failedTargets: 4,
    executionMode: 'immediate',
    startedAt: '2026-07-26 15:00:00',
    endedAt: '2026-07-26 16:30:00',
    promptName: '客户回访',
    sceneCode: 'intro_follow_up',
    voice: 'Cherry',
    voiceName: 'Cherry',
    ruleId: 'rule-workday',
    ruleName: '工作日规则',
    ruleSummary: '09:00–12:00、14:00–18:00，最多重试 2 次',
    createdByName: '管理员',
    createdAt: '2026-07-26 14:50:00',
    updatedAt: '2026-07-26 16:30:00',
  },
];

const taskTargets: Record<string, AiCallTaskTarget[]> = {
  'task-running': [
    {
      targetId: 'target-retried',
      taskId: 'task-running',
      customerName: '王先生',
      phoneNumber: '19900001001',
      status: 'COMPLETED',
      attemptCount: 2,
      latestResult: '已接通',
      updatedAt: '2026-07-27 09:20:00',
    },
    {
      targetId: 'target-waiting',
      taskId: 'task-running',
      customerName: '李女士',
      phoneNumber: '19900001002',
      status: 'RETRY_WAIT',
      attemptCount: 1,
      latestResult: '无人接听',
      updatedAt: '2026-07-27 09:50:00',
    },
  ],
  'task-scheduled': [
    {
      targetId: 'target-single',
      taskId: 'task-scheduled',
      customerName: '赵先生',
      phoneNumber: '19900001003',
      status: 'PENDING',
      attemptCount: 0,
      updatedAt: '2026-07-27 09:30:00',
    },
  ],
};

const validationIssues: ValidationIssue[] = [
  {
    issueId: 'issue-phone',
    rowNumber: 2,
    phoneNumber: '12345',
    customerName: '测试客户',
    reasons: ['手机号格式错误'],
  },
  {
    issueId: 'issue-duplicate',
    rowNumber: 5,
    phoneNumber: '19900001001',
    customerName: '重复客户',
    reasons: ['手机号在名单内重复'],
    duplicateRowNumbers: [3, 5],
  },
];

type MockValidation = {
  validationId: string;
  status: ValidationStatus;
  validTargetCount: number;
  issueCount: number;
  issueStats?: Record<string, number>;
  errorMessage?: string | null;
  retryAction?: ValidationRetryAction;
  accepted?: boolean;
  pollCount: number;
  finalStatus: 'PASSED' | 'FAILED' | 'SYSTEM_ERROR';
  finalRetryAction?: ValidationRetryAction;
};

const validations = new Map<string, MockValidation>();
const singleValidations = new Map<string, SingleTargetValidationRequest>();
let validationCount = 0;
let createdTaskCount = 0;
let linphoneTestCount = 0;

type MockLinphoneTest = {
  taskId: string;
  targetId: string;
  attemptId: string;
  callId: string;
  scenario: LinphoneTestScenario;
  idempotencyKey: string;
  startedAt: number;
  phaseIndex: number;
  finished: boolean;
};

let activeLinphoneTest: MockLinphoneTest | undefined;

const aiOnlyPhases = ['dialing', 'ai_call', 'completed'] as const;
const handoffPhases = [
  'dialing',
  'ai_call',
  'waiting_handoff',
  'human_call',
  'completed',
] as const;

const promptNames: Record<string, string> = {
  intro_geo: 'GEO 产品介绍',
  intro_contract: '合同审查产品介绍',
  intro_business: '企业服务通知',
  intro_follow_up: '客户回访',
};

const success = <T>(res: Response, data: T, msg = '操作成功') =>
  res.json({ code: 200, msg, data });

const page = <T>(res: Response, rows: T[], total = rows.length) =>
  res.json({ code: 200, msg: '查询成功', rows, total });

const getPageRange = (req: Request) => {
  const pageNum = Math.max(Number(req.query.pageNum) || 1, 1);
  const pageSize = Math.max(Number(req.query.pageSize) || 20, 1);
  const start = (pageNum - 1) * pageSize;
  return { start, end: start + pageSize };
};

const findTask = (taskId: string) =>
  tasks.find((item) => item.taskId === taskId);

const getLinphonePhases = (
  scenario: LinphoneTestScenario,
): readonly LinphoneTestPhase[] =>
  scenario === 'handoff' ? handoffPhases : aiOnlyPhases;

const getIdempotencyKey = (req: Request): string => {
  const value = req.headers['idempotency-key'];
  return Array.isArray(value) ? value[0] : String(value || '');
};

const getTestEligibilityReasons = (taskId: string): string[] => {
  const task = findTask(taskId);
  const targets = taskTargets[taskId] || [];
  const reasons: string[] = [];

  if (!task) return ['外呼任务不存在'];
  if (task.status !== 'SCHEDULED') reasons.push('任务不是待执行状态');
  if (task.taskMode !== 'single') reasons.push('仅支持单个客户外呼任务');
  if (targets.length !== 1) reasons.push('任务必须且只能包含一个外呼对象');
  if (targets[0]?.status !== 'PENDING') reasons.push('外呼对象不是待拨打状态');
  if (targets[0]?.phoneNumber !== '19900001001') {
    reasons.push('外呼号码不在本机测试白名单');
  }
  if (activeLinphoneTest && !activeLinphoneTest.finished) {
    reasons.push(
      activeLinphoneTest.taskId === taskId
        ? '当前任务已有本机测试通话进行中'
        : '当前已有本机测试通话进行中',
    );
  }
  return reasons;
};

const getTestCapability = (req: Request, res: Response) => {
  const taskId = getRouteParam(req, 'taskId');
  const currentTest = activeLinphoneTest;
  const activeCallId =
    currentTest?.taskId === taskId && !currentTest.finished
      ? currentTest.callId
      : null;
  const reasons = getTestEligibilityReasons(taskId);
  return success(res, {
    enabled: true,
    eligible: reasons.length === 0,
    reasons,
    availableAgentCount: 1,
    activeCallId,
    canEndActiveCall: activeCallId !== null,
  });
};

const startTestRun = (req: Request, res: Response) => {
  const taskId = getRouteParam(req, 'taskId');
  const scenario = req.body.scenario as LinphoneTestScenario;
  const idempotencyKey = getIdempotencyKey(req);
  if (
    activeLinphoneTest?.taskId === taskId &&
    activeLinphoneTest.idempotencyKey === idempotencyKey
  ) {
    return success(
      res,
      {
        accepted: true,
        taskId,
        attemptId: activeLinphoneTest.attemptId,
        callId: activeLinphoneTest.callId,
      },
      '测试拨打已受理',
    );
  }
  if (!idempotencyKey) {
    return res.status(400).json({ code: 400, msg: '缺少 Idempotency-Key' });
  }
  if (scenario !== 'ai_only' && scenario !== 'handoff') {
    return res.status(400).json({ code: 400, msg: '不支持的测试场景' });
  }
  const reasons = getTestEligibilityReasons(taskId);
  if (reasons.length > 0) {
    return res.status(409).json({ code: 409, msg: reasons.join('；') });
  }

  const target = taskTargets[taskId][0];
  linphoneTestCount += 1;
  const suffix = `${Date.now()}-${linphoneTestCount}`;
  activeLinphoneTest = {
    taskId,
    targetId: target.targetId,
    attemptId: `attempt-test-${suffix}`,
    callId: `call-test-${suffix}`,
    scenario,
    idempotencyKey,
    startedAt: Date.now(),
    phaseIndex: 0,
    finished: false,
  };
  return success(
    res,
    {
      accepted: true,
      taskId,
      attemptId: activeLinphoneTest.attemptId,
      callId: activeLinphoneTest.callId,
    },
    '测试拨打已受理',
  );
};

const getTestStatus = (req: Request, res: Response) => {
  const taskId = getRouteParam(req, 'taskId');
  if (!activeLinphoneTest || activeLinphoneTest.taskId !== taskId) {
    return res.status(404).json({ code: 404, msg: '测试通话不存在' });
  }

  const phases = getLinphonePhases(activeLinphoneTest.scenario);
  const phase = phases[activeLinphoneTest.phaseIndex];
  const completed = phase === 'completed';
  const dialing = phase === 'dialing';
  const waitingHandoff = phase === 'waiting_handoff';
  const humanCall = phase === 'human_call';
  const data = {
    taskId,
    targetId: activeLinphoneTest.targetId,
    attemptId: activeLinphoneTest.attemptId,
    callId: activeLinphoneTest.callId,
    targetStatus: completed ? 'COMPLETED' : dialing ? 'DIALING' : 'IN_CALL',
    attemptStatus: completed ? 'COMPLETED' : dialing ? 'DIALING' : 'IN_CALL',
    callStatus: completed ? 'ENDED' : dialing ? 'DIALING' : 'IN_PROGRESS',
    handoffStatus: waitingHandoff
      ? 'WAITING'
      : humanCall
        ? 'ACCEPTED'
        : completed && activeLinphoneTest.scenario === 'handoff'
          ? 'COMPLETED'
          : null,
    phase,
    elapsedSeconds: Math.max(
      Math.floor((Date.now() - activeLinphoneTest.startedAt) / 1000),
      0,
    ),
    endReason: completed ? 'mock_completed' : null,
    errorMessage: null,
    canEndActiveCall: !completed,
  };

  if (completed) {
    activeLinphoneTest.finished = true;
  } else {
    activeLinphoneTest.phaseIndex += 1;
  }
  return success(res, data);
};

const endActiveTestCall = (req: Request, res: Response) => {
  const taskId = getRouteParam(req, 'taskId');
  if (
    !activeLinphoneTest ||
    activeLinphoneTest.taskId !== taskId ||
    activeLinphoneTest.finished
  ) {
    return res.status(409).json({ code: 409, msg: '当前任务没有进行中的通话' });
  }
  activeLinphoneTest.phaseIndex =
    getLinphonePhases(activeLinphoneTest.scenario).length - 1;
  activeLinphoneTest.finished = true;
  return success(res, { accepted: true }, '结束通话已受理');
};

const createBatchTargets = (
  taskId: string,
  count: number,
): AiCallTaskTarget[] =>
  Array.from({ length: count }, (_item, index) => ({
    targetId: `target-${taskId}-${index + 1}`,
    taskId,
    customerName: `名单客户${String(index + 1).padStart(2, '0')}`,
    phoneNumber: `1990000${String(2001 + index).padStart(4, '0')}`,
    status: 'PENDING',
    attemptCount: 0,
    updatedAt: now,
  }));

const getRouteParam = (req: Request, key: string): string => {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : String(value || '');
};

const setTaskStatus = (
  taskId: string,
  status: TaskStatus,
  nextStatus?: TaskStatus,
) => {
  const task = findTask(taskId);
  if (!task) return;
  task.status = status;
  task.updatedAt = now;
  if (nextStatus) {
    setTimeout(() => {
      task.status = nextStatus;
      task.updatedAt = now;
    }, 700);
  }
};

const listTasks = (req: Request, res: Response) => {
  const taskName = String(req.query.taskName || '').trim();
  const status = String(req.query.status || '').trim();
  const filtered = tasks.filter(
    (item) =>
      (!taskName || item.taskName.includes(taskName)) &&
      (!status || item.status === status),
  );
  const { start, end } = getPageRange(req);
  return page(res, filtered.slice(start, end), filtered.length);
};

const getTask = (req: Request, res: Response) => {
  const task = findTask(getRouteParam(req, 'taskId'));
  if (!task) {
    return res.status(404).json({ code: 404, msg: '外呼任务不存在' });
  }
  return success(res, task);
};

const createTask = (req: Request, res: Response) => {
  createdTaskCount += 1;
  const taskId = `task-created-${createdTaskCount}`;
  const body = req.body || {};
  const singleValidation = singleValidations.get(String(body.validationId));
  const task: AiCallTask = {
    taskId,
    taskName: body.taskName,
    taskMode: body.taskMode,
    status: body.executionMode === 'scheduled' ? 'SCHEDULED' : 'RUNNING',
    totalTargets: body.taskMode === 'single' ? 1 : 18,
    completedTargets: 0,
    connectedTargets: 0,
    failedTargets: 0,
    executionMode: body.executionMode,
    scheduledAt: body.scheduledAt,
    promptProfileId: body.promptProfileId,
    promptName: promptNames[body.sceneCode] || body.sceneCode,
    sceneCode: body.sceneCode,
    voice: body.voice,
    voiceName: body.voice,
    ruleId: body.ruleId,
    ruleName: '工作日规则',
    ruleSummary: '09:00–12:00、14:00–18:00，最多重试 2 次',
    createdByName: '管理员',
    createdAt: now,
    updatedAt: now,
  };
  tasks = [task, ...tasks];
  taskTargets[taskId] =
    body.taskMode === 'single'
      ? singleValidation
        ? [
            {
              targetId: `target-${taskId}-1`,
              taskId,
              customerName: singleValidation.customerName,
              phoneNumber: singleValidation.phoneNumber,
              status: 'PENDING',
              attemptCount: 0,
              updatedAt: now,
            },
          ]
        : []
      : createBatchTargets(taskId, task.totalTargets);
  return success(res, { taskId, accepted: true }, '任务创建已受理');
};

const updateSchedule = (req: Request, res: Response) => {
  const task = findTask(getRouteParam(req, 'taskId'));
  if (!task || task.status !== 'SCHEDULED') {
    return res.status(409).json({
      code: 409,
      msg: '仅待执行任务可以修改名称和计划执行时间',
    });
  }
  task.taskName = req.body.taskName;
  task.scheduledAt = req.body.scheduledAt;
  task.updatedAt = now;
  return success(res, { accepted: true }, '修改已受理');
};

const taskAction =
  (status: TaskStatus, nextStatus?: TaskStatus, msg = '操作已受理') =>
  (req: Request, res: Response) => {
    const taskId = getRouteParam(req, 'taskId');
    if (!findTask(taskId)) {
      return res.status(404).json({ code: 404, msg: '外呼任务不存在' });
    }
    setTaskStatus(taskId, status, nextStatus);
    return success(res, { accepted: true }, msg);
  };

const listTargets = (req: Request, res: Response) => {
  const source = taskTargets[getRouteParam(req, 'taskId')] || [];
  const phoneNumber = String(req.query.phoneNumber || '').trim();
  const customerName = String(req.query.customerName || '').trim();
  const status = String(req.query.status || '').trim();
  const filtered = source.filter(
    (item) =>
      (!phoneNumber || item.phoneNumber?.includes(phoneNumber)) &&
      (!customerName || item.customerName?.includes(customerName)) &&
      (!status || item.status === status),
  );
  const { start, end } = getPageRange(req);
  return page(res, filtered.slice(start, end), filtered.length);
};

const validateSingle = (req: Request, res: Response) => {
  const validationId = `validation-single-${Date.now()}`;
  singleValidations.set(
    validationId,
    req.body as SingleTargetValidationRequest,
  );
  return success(res, {
    validationId,
    status: 'PASSED',
    validTargetCount: 1,
    issueCount: 0,
  });
};

const createBatchValidation = (_req: Request, res: Response) => {
  validationCount += 1;
  const validationId = `validation-batch-${validationCount}`;
  const scenario = validationCount % 4;
  const finalStatus =
    scenario === 1 ? 'FAILED' : scenario === 2 ? 'PASSED' : 'SYSTEM_ERROR';
  validations.set(validationId, {
    validationId,
    status: 'VALIDATING',
    validTargetCount: 0,
    issueCount: 0,
    accepted: true,
    pollCount: 0,
    finalStatus,
    finalRetryAction:
      scenario === 3
        ? 'RETRY_VALIDATION'
        : scenario === 0
          ? 'REUPLOAD'
          : undefined,
  });
  return success(res, validations.get(validationId), '名单校验已受理');
};

const retryBatchValidation = (req: Request, res: Response) => {
  const validation = validations.get(getRouteParam(req, 'validationId'));
  if (!validation) {
    return res.status(404).json({ code: 404, msg: '校验结果不存在' });
  }
  if (
    validation.status !== 'SYSTEM_ERROR' ||
    validation.retryAction !== 'RETRY_VALIDATION'
  ) {
    return res.status(409).json({
      code: 409,
      msg: '当前校验状态不允许重试，请重新上传完整名单',
    });
  }
  validation.status = 'VALIDATING';
  validation.pollCount = 0;
  validation.finalStatus = 'PASSED';
  validation.errorMessage = null;
  validation.retryAction = undefined;
  return success(res, validation, '名单校验重试已受理');
};

const getValidation = (req: Request, res: Response) => {
  const validation = validations.get(getRouteParam(req, 'validationId'));
  if (!validation) {
    return res.status(404).json({ code: 404, msg: '校验结果不存在' });
  }
  validation.pollCount += 1;
  if (validation.pollCount >= 2) {
    validation.status = validation.finalStatus;
    validation.validTargetCount = validation.finalStatus === 'PASSED' ? 18 : 0;
    validation.issueCount =
      validation.finalStatus === 'FAILED' ? validationIssues.length : 0;
    validation.issueStats =
      validation.finalStatus === 'FAILED'
        ? { 手机号格式错误: 1, 手机号重复: 1 }
        : {};
    validation.errorMessage =
      validation.finalStatus === 'SYSTEM_ERROR'
        ? validation.finalRetryAction === 'REUPLOAD'
          ? '名单解析失败，请重新上传完整名单'
          : '系统校验服务暂时不可用'
        : null;
    validation.retryAction =
      validation.finalStatus === 'SYSTEM_ERROR'
        ? validation.finalRetryAction
        : undefined;
  }
  return success(res, validation);
};

const listIssues = (req: Request, res: Response) => {
  const phoneNumber = String(req.query.phoneNumber || '').trim();
  const reason = String(req.query.reason || '').trim();
  const filtered = validationIssues.filter(
    (item) =>
      (!phoneNumber || item.phoneNumber?.includes(phoneNumber)) &&
      (!reason ||
        item.reasons.some((itemReason) => itemReason.includes(reason))),
  );
  const { start, end } = getPageRange(req);
  return page(res, filtered.slice(start, end), filtered.length);
};

const TEMPLATE_XLSX_BASE64 =
  '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';

const sendExcel = (res: Response, filename: string) => {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  return res.send(Buffer.from(TEMPLATE_XLSX_BASE64, 'base64'));
};

export default {
  'GET /ai-call-agent-api/ai-call/outbound-tasks': listTasks,
  'GET /ai-call-agent-api/ai-call/outbound-tasks/:taskId': getTask,
  'POST /ai-call-agent-api/ai-call/outbound-tasks': createTask,
  'PUT /ai-call-agent-api/ai-call/outbound-tasks/:taskId/schedule':
    updateSchedule,
  'POST /ai-call-agent-api/ai-call/outbound-tasks/:taskId/pause': taskAction(
    'PAUSING',
    'PAUSED',
    '暂停操作已受理',
  ),
  'POST /ai-call-agent-api/ai-call/outbound-tasks/:taskId/resume': taskAction(
    'RUNNING',
    undefined,
    '恢复操作已受理',
  ),
  'POST /ai-call-agent-api/ai-call/outbound-tasks/:taskId/stop': taskAction(
    'STOPPING',
    'STOPPED',
    '停止操作已受理',
  ),
  'POST /ai-call-agent-api/ai-call/outbound-tasks/:taskId/cancel': taskAction(
    'CANCELLED',
    undefined,
    '取消操作已受理',
  ),
  'GET /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/capability':
    getTestCapability,
  'POST /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/runs':
    startTestRun,
  'GET /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/status':
    getTestStatus,
  'POST /ai-call-agent-api/ai-call/lab/outbound-task-tests/:taskId/active-call/end':
    endActiveTestCall,
  'GET /ai-call-agent-api/ai-call/outbound-tasks/:taskId/targets': listTargets,
  'POST /ai-call-agent-api/ai-call/outbound-targets/import-template': (
    _req: Request,
    res: Response,
  ) => sendExcel(res, '外呼名单导入模板.xlsx'),
  'POST /ai-call-agent-api/ai-call/outbound-validations/single': validateSingle,
  'POST /ai-call-agent-api/ai-call/outbound-validations/batch':
    createBatchValidation,
  'POST /ai-call-agent-api/ai-call/outbound-validations/:validationId/retry':
    retryBatchValidation,
  'GET /ai-call-agent-api/ai-call/outbound-validations/:validationId':
    getValidation,
  'GET /ai-call-agent-api/ai-call/outbound-validations/:validationId/issues':
    listIssues,
  'POST /ai-call-agent-api/ai-call/outbound-validations/:validationId/issues/export':
    (_req: Request, res: Response) => sendExcel(res, '外呼名单问题明细.xlsx'),
};

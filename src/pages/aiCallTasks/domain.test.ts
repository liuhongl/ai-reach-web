import {
  type AiCallTask,
  getAllowedTaskActions,
  getTaskProgress,
  isTaskPollingStatus,
  shouldPollTask,
  type TaskStatus,
} from './domain';

const buildTask = (overrides: Partial<AiCallTask> = {}): AiCallTask => ({
  taskId: 'task-1',
  taskName: '合同审查回访',
  taskMode: 'batch',
  status: 'RUNNING',
  totalTargets: 10,
  completedTargets: 4,
  connectedTargets: 2,
  failedTargets: 1,
  executionMode: 'immediate',
  promptName: '合同审查产品介绍',
  sceneCode: 'intro_contract',
  voice: 'Cherry',
  ruleId: 'rule-1',
  ruleName: '工作日规则',
  ruleSummary: '09:00–18:00，最多重试 2 次',
  createdAt: '2026-07-27 09:00:00',
  updatedAt: '2026-07-27 09:10:00',
  ...overrides,
});

describe('AI Call task domain', () => {
  it.each([
    ['SCHEDULED', ['editSchedule', 'cancel', 'view']],
    ['RUNNING', ['pause', 'stop', 'view']],
    ['PAUSED', ['resume', 'stop', 'view']],
    ['PAUSING', ['view']],
    ['STOPPING', ['view']],
    ['STOPPED', ['view']],
    ['COMPLETED', ['view']],
    ['FAILED', ['view']],
    ['CANCELLED', ['view']],
  ] satisfies Array<
    [TaskStatus, string[]]
  >)('returns allowed actions for %s', (status, actions) => {
    expect(getAllowedTaskActions(status)).toEqual(actions);
  });

  it.each([
    ['RUNNING', true],
    ['PAUSING', true],
    ['STOPPING', true],
    ['SCHEDULED', false],
    ['PAUSED', false],
    ['STOPPED', false],
    ['COMPLETED', false],
    ['FAILED', false],
    ['CANCELLED', false],
  ] satisfies Array<
    [TaskStatus, boolean]
  >)('reports whether %s requires polling', (status, expected) => {
    expect(isTaskPollingStatus(status)).toBe(expected);
  });

  it.each([
    [buildTask({ status: 'SCHEDULED', executionMode: 'immediate' }), true],
    [buildTask({ status: 'SCHEDULED', executionMode: 'scheduled' }), false],
    [buildTask({ status: 'RUNNING', executionMode: 'immediate' }), true],
    [buildTask({ status: 'COMPLETED', executionMode: 'immediate' }), false],
  ])('reports whether task $status in $executionMode mode requires detail polling', (task, expected) => {
    expect(shouldPollTask(task)).toBe(expected);
  });

  it('calculates progress from completed targets', () => {
    expect(getTaskProgress(buildTask())).toBe(40);
    expect(
      getTaskProgress(buildTask({ totalTargets: 3, completedTargets: 2 })),
    ).toBe(67);
  });

  it('returns zero progress when the task has no targets', () => {
    expect(
      getTaskProgress(buildTask({ totalTargets: 0, completedTargets: 0 })),
    ).toBe(0);
  });
});

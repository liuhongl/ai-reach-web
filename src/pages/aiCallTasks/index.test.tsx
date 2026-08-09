import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { history } from '@umijs/max';
import * as React from 'react';
import AiCallTasksPage from './index';
import {
  cancelAiCallTask,
  listAiCallTasks,
  pauseAiCallTask,
  resumeAiCallTask,
  stopAiCallTask,
  updateAiCallTaskSchedule,
} from './service';

jest.mock('@umijs/max', () => ({
  history: { push: jest.fn() },
}));

jest.mock('./service', () => ({
  cancelAiCallTask: jest.fn(),
  listAiCallTasks: jest.fn(),
  pauseAiCallTask: jest.fn(),
  resumeAiCallTask: jest.fn(),
  stopAiCallTask: jest.fn(),
  updateAiCallTaskSchedule: jest.fn(),
}));

jest.mock('@/components/TableActions', () => ({
  __esModule: true,
  default: ({
    actions,
  }: {
    actions: Array<{
      key: string;
      label: string;
      onClick: () => void;
    }>;
  }) => (
    <div>
      {actions.map((action) => (
        <button key={action.key} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

const mockedListTasks = listAiCallTasks as jest.Mock;
const mockedPauseTask = pauseAiCallTask as jest.Mock;
const mockedResumeTask = resumeAiCallTask as jest.Mock;
const mockedStopTask = stopAiCallTask as jest.Mock;
const mockedCancelTask = cancelAiCallTask as jest.Mock;
const mockedUpdateSchedule = updateAiCallTaskSchedule as jest.Mock;

const buildTask = (overrides: Record<string, unknown>) => ({
  taskId: 'task-1',
  taskName: '示例任务',
  taskMode: 'batch',
  status: 'RUNNING',
  totalTargets: 100,
  completedTargets: 30,
  connectedTargets: 15,
  failedTargets: 3,
  executionMode: 'immediate',
  startedAt: '2026-07-27 09:00:00',
  promptName: '客户回访',
  sceneCode: 'intro_follow_up',
  voice: 'Cherry',
  ruleId: 'rule-1',
  ruleName: '工作日规则',
  ruleSummary: '09:00–18:00，最多重试 1 次',
  createdByName: '管理员',
  createdAt: '2026-07-27 08:50:00',
  updatedAt: '2026-07-27 10:00:00',
  ...overrides,
});

const tasks = [
  buildTask({
    taskId: 'running',
    taskName: '运行任务',
    status: 'RUNNING',
  }),
  buildTask({
    taskId: 'paused',
    taskName: '暂停任务',
    status: 'PAUSED',
  }),
  buildTask({
    taskId: 'pausing',
    taskName: '暂停中任务',
    status: 'PAUSING',
  }),
  buildTask({
    taskId: 'stopping',
    taskName: '停止中任务',
    status: 'STOPPING',
  }),
  buildTask({
    taskId: 'stopped',
    taskName: '已停止任务',
    status: 'STOPPED',
  }),
  buildTask({
    taskId: 'completed',
    taskName: '已完成任务',
    status: 'COMPLETED',
  }),
  buildTask({
    taskId: 'failed',
    taskName: '失败任务',
    status: 'FAILED',
    errorMessage: '线路不可用',
  }),
  buildTask({
    taskId: 'cancelled',
    taskName: '已取消任务',
    status: 'CANCELLED',
  }),
  buildTask({
    taskId: 'scheduled',
    taskName: '定时任务',
    status: 'SCHEDULED',
    executionMode: 'scheduled',
    scheduledAt: '2026-07-28 10:00:00',
    startedAt: null,
  }),
];

const getTaskRow = (name: string) => {
  const row = screen.getByText(name).closest('tr');
  if (!(row instanceof HTMLTableRowElement)) {
    throw new Error(`未找到任务行：${name}`);
  }
  return within(row);
};

describe('AI Call task list page', () => {
  beforeEach(() => {
    mockedListTasks.mockReset();
    mockedPauseTask.mockReset();
    mockedResumeTask.mockReset();
    mockedStopTask.mockReset();
    mockedCancelTask.mockReset();
    mockedUpdateSchedule.mockReset();
    mockedListTasks.mockResolvedValue({ rows: tasks, total: tasks.length });
    mockedPauseTask.mockResolvedValue({ accepted: true });
    mockedResumeTask.mockResolvedValue({ accepted: true });
    mockedStopTask.mockResolvedValue({ accepted: true });
    mockedCancelTask.mockResolvedValue({ accepted: true });
    mockedUpdateSchedule.mockResolvedValue({ accepted: true });
  });

  afterEach(cleanup);

  it('uses only the approved filters and maps pagination parameters', async () => {
    render(<AiCallTasksPage />);
    await screen.findByText('运行任务');

    expect(screen.getAllByText('任务名称').length).toBeGreaterThan(0);
    expect(screen.getAllByText('任务状态').length).toBeGreaterThan(0);
    expect(screen.getByText('创建时间')).toBeTruthy();
    expect(screen.queryByText('手机号')).toBeNull();
    expect(screen.queryByText('提示词')).toBeNull();
    expect(mockedListTasks).toHaveBeenCalledWith(
      expect.objectContaining({ pageNum: 1, pageSize: 20 }),
    );
    expect(screen.getByText('线路不可用')).toBeTruthy();
  });

  it('从任务列表进入外呼统计', async () => {
    render(<AiCallTasksPage />);
    await screen.findByText('运行任务');

    fireEvent.click(screen.getByRole('button', { name: /外呼统计/ }));
    expect(history.push).toHaveBeenCalledWith('/ai-call/statistics');
  });

  it('distinguishes Mock workflow results from real SIP connections', async () => {
    mockedListTasks.mockResolvedValue({
      rows: [
        buildTask({
          taskId: 'mock-completed',
          taskName: 'Mock 流程任务',
          status: 'COMPLETED',
          connectedTargets: 12,
          attemptDialerTypes: ['mock'],
        }),
        buildTask({
          taskId: 'sip-completed',
          taskName: 'SIP 外呼任务',
          status: 'COMPLETED',
          connectedTargets: 15,
          attemptDialerTypes: ['sip'],
        }),
      ],
      total: 2,
    });

    render(<AiCallTasksPage />);
    await screen.findByText('Mock 流程任务');

    expect(getTaskRow('Mock 流程任务').getByText('Mock 流程演练')).toBeTruthy();
    expect(getTaskRow('Mock 流程任务').getByText('模拟成功 12')).toBeTruthy();
    expect(getTaskRow('SIP 外呼任务').getByText('SIP 外呼')).toBeTruthy();
    expect(getTaskRow('SIP 外呼任务').getByText('SIP 接通 15')).toBeTruthy();
  });

  it('用中文展示 Owner Runtime 执行方式', async () => {
    mockedListTasks.mockResolvedValue({
      rows: [
        buildTask({
          taskId: 'owner-runtime',
          taskName: 'Owner Runtime 任务',
          attemptDialerTypes: ['owner_runtime'],
        }),
      ],
      total: 1,
    });

    render(<AiCallTasksPage />);
    await screen.findByText('Owner Runtime 任务');

    expect(
      getTaskRow('Owner Runtime 任务').getByText('平台运行时'),
    ).toBeTruthy();
    expect(
      getTaskRow('Owner Runtime 任务').queryByText('OWNER_RUNTIME'),
    ).toBeNull();
  });

  it('Web 失败待重试时显示 Web 结果和下次重试时间', async () => {
    mockedListTasks.mockResolvedValue({
      rows: [
        buildTask({
          taskId: 'web-retry',
          taskName: 'Web 重试任务',
          taskMode: 'single',
          answerMode: 'web',
          attemptDialerTypes: ['owner_runtime'],
          failedAttempts: 1,
          nextDispatchAt: '2026-08-06 13:14:53',
          completedTargets: 0,
          connectedTargets: 0,
          failedTargets: 0,
        }),
      ],
      total: 1,
    });

    render(<AiCallTasksPage />);
    await screen.findByText('Web 重试任务');

    const row = getTaskRow('Web 重试任务');
    expect(row.getByText('Web 接听')).toBeTruthy();
    expect(row.getByText('Web 接听失败 1')).toBeTruthy();
    expect(row.getByText('等待重试')).toBeTruthy();
    expect(row.getByText('下次重试：2026-08-06 13:14:53')).toBeTruthy();
    expect(row.queryByText('SIP 接通 0')).toBeNull();
    expect(row.getByRole('button', { name: '暂停' })).toBeTruthy();
  });

  it('将单客户任务展示为单个客户', async () => {
    mockedListTasks.mockResolvedValue({
      rows: [
        buildTask({
          taskId: 'single-customer',
          taskName: '单客户任务',
          taskMode: 'single',
        }),
      ],
      total: 1,
    });

    render(<AiCallTasksPage />);
    await screen.findByText('单客户任务');

    const row = getTaskRow('单客户任务');
    expect(row.getByText('单个客户')).toBeTruthy();
    expect(row.queryByText('单号码')).toBeNull();
  });

  it('renders actions strictly from the current task status', async () => {
    render(<AiCallTasksPage />);
    await screen.findByText('运行任务');

    expect(
      getTaskRow('运行任务')
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['暂停', '停止', '查看']);
    expect(
      getTaskRow('暂停任务')
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['恢复', '停止', '查看']);
    for (const name of [
      '暂停中任务',
      '停止中任务',
      '已停止任务',
      '已完成任务',
      '失败任务',
      '已取消任务',
    ]) {
      expect(
        getTaskRow(name)
          .getAllByRole('button')
          .map((item) => item.textContent),
      ).toEqual(['查看']);
    }
    expect(
      getTaskRow('定时任务')
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['修改', '取消', '查看']);
  });

  it('confirms a dangerous action and reports only that it was accepted', async () => {
    render(<AiCallTasksPage />);
    await screen.findByText('运行任务');

    fireEvent.click(
      getTaskRow('运行任务').getByRole('button', { name: '暂停' }),
    );
    expect(
      await screen.findByText(
        '确认暂停外呼任务“运行任务”吗？系统将停止发起新的呼叫，正在进行中的通话不受影响。',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /确认暂停/ }));

    await waitFor(() => expect(mockedPauseTask).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText('操作已受理，任务状态将在后台更新'),
    ).toBeTruthy();
    expect(screen.queryByText('任务已暂停')).toBeNull();
  });
});

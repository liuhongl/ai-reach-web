import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import * as React from 'react';
import { getAiCallTask, listAiCallTaskTargets } from '../service';
import AiCallTaskDetailPage from './index';

const mockPush = jest.fn();
const mockLinphoneTaskTest = jest.fn();
const mockWebTaskCallModal = jest.fn();

jest.mock('@umijs/max', () => ({
  history: { push: (...args: unknown[]) => mockPush(...args) },
  useParams: () => ({ taskId: 'task-1' }),
}));

jest.mock('../service', () => ({
  getAiCallTask: jest.fn(),
  listAiCallTaskTargets: jest.fn(),
}));

jest.mock('../components/LinphoneTaskTest', () => ({
  __esModule: true,
  default: (props: {
    task: { taskId: string };
    onTaskChanged: () => Promise<void> | void;
    children?: (content: {
      trigger: unknown;
      activeStatus: unknown;
    }) => unknown;
  }) => {
    mockLinphoneTaskTest(props);
    const trigger = (
      <button type="button" onClick={() => void props.onTaskChanged()}>
        测试拨打入口
      </button>
    );
    const activeStatus = (
      <div data-testid="linphone-active-status">测试拨打中</div>
    );
    return props.children ? (
      props.children({ trigger, activeStatus })
    ) : (
      <>
        {trigger}
        {activeStatus}
      </>
    );
  },
}));

jest.mock('../components/WebTaskCallModal', () => ({
  __esModule: true,
  default: (props: { callId: string; open: boolean }) => {
    mockWebTaskCallModal(props);
    return props.open ? (
      <div data-testid="web-task-call-modal">Web 来电</div>
    ) : null;
  },
}));

const mockedGetTask = getAiCallTask as jest.Mock;
const mockedListTargets = listAiCallTaskTargets as jest.Mock;

describe('AI Call task detail page', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockLinphoneTaskTest.mockReset();
    mockWebTaskCallModal.mockReset();
    mockedGetTask.mockReset();
    mockedListTargets.mockReset();
    mockedGetTask.mockResolvedValue({
      taskId: 'task-1',
      taskName: '批量客户回访',
      taskMode: 'batch',
      answerMode: 'linphone',
      status: 'RUNNING',
      totalTargets: 100,
      completedTargets: 30,
      attemptDialerTypes: ['owner_runtime'],
      connectedTargets: 18,
      failedTargets: 4,
      executionMode: 'immediate',
      startedAt: '2026-07-27 09:00:00',
      promptProfileId: 'prompt-1',
      promptName: '客户回访',
      sceneCode: 'intro_follow_up',
      voice: 'Cherry',
      voiceName: '芊悦',
      ruleId: 'rule-1',
      ruleName: '工作日规则',
      ruleSummary: '09:00–18:00，最多重试 1 次',
      lineId: 'line-1',
      lineName: '任务创建后改名的线路',
      lineSnapshot: {
        lineId: 'line-1',
        lineCode: 'sip-primary',
        lineName: '任务创建时线路',
      },
      createdByName: '管理员',
      createdAt: '2026-07-27 08:50:00',
      updatedAt: '2026-07-27 10:00:00',
    });
    mockedListTargets.mockResolvedValue({
      rows: [
        {
          targetId: 'target-1',
          taskId: 'task-1',
          customerName: '张先生',
          phoneNumber: '19900001001',
          status: 'COMPLETED',
          attemptCount: 2,
          latestResult: 'connected',
          updatedAt: '2026-07-27 09:30:00',
        },
      ],
      total: 1,
    });
  });

  afterEach(cleanup);

  it('shows summary, frozen configuration and a filtered target table without tabs', async () => {
    render(<AiCallTaskDetailPage />);

    expect(await screen.findByText('批量客户回访')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('客户回访')).toBeTruthy();
    expect(screen.queryByText('客户回访 / intro_follow_up')).toBeNull();
    expect(screen.getByText('芊悦')).toBeTruthy();
    expect(screen.queryByText('芊悦 / Cherry')).toBeNull();
    expect(screen.getAllByText('平台运行时')).toHaveLength(1);
    expect(screen.queryByText('owner_runtime')).toBeNull();
    expect(screen.getByText('工作日规则')).toBeTruthy();
    expect(screen.queryByText('执行线路')).toBeNull();
    expect(screen.queryByText('执行类型')).toBeNull();
    expect(screen.queryByText('任务创建后改名的线路')).toBeNull();
    const toolbar = screen.getByTestId('task-detail-toolbar');
    expect(toolbar.classList.contains('flex-wrap')).toBe(true);
    expect(
      within(toolbar).queryByRole('button', { name: '测试拨打入口' }),
    ).toBeNull();
    expect(within(toolbar).queryByTestId('linphone-active-status')).toBeNull();
    expect(screen.queryByTestId('linphone-active-status')).toBeNull();
    const taskConfig = screen.getByTestId('task-config-card');
    expect(taskConfig.style.flex).toBe('0 0 auto');
    expect(taskConfig.classList.contains('recov-toolbar-card')).toBe(true);
    expect(screen.queryByText('手机号')).toBeNull();
    expect(screen.getAllByText('客户名称').length).toBeGreaterThan(0);
    expect(screen.getAllByText('执行状态').length).toBeGreaterThan(0);
    expect(screen.getAllByText('最近呼叫结果').length).toBeGreaterThan(0);
    expect(screen.getByText('客户接听端')).toBeTruthy();
    expect(screen.getByText('电话（SIP 线路）')).toBeTruthy();
    expect(screen.queryByText('Linphone（SIP）')).toBeNull();
    expect(
      screen
        .getAllByRole('columnheader')
        .map((column) => column.textContent)
        .slice(0, 4),
    ).toEqual(['客户名称', '最近呼叫结果', '执行状态', '拨打次数']);
    expect(
      (await screen.findByText('已接通')).closest('.ant-tag'),
    ).toBeTruthy();
    expect(
      (await screen.findByText('已完成')).closest('.ant-tag')?.className,
    ).toContain('ant-tag-success');
    expect(screen.queryByText('执行概览')).toBeNull();
    expect(screen.queryByText('任务事件')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    await waitFor(() =>
      expect(mockedListTargets).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ pageNum: 1, pageSize: 20 }),
      ),
    );
  });

  it('builds task-level and target-level record query strings', async () => {
    render(<AiCallTaskDetailPage />);
    await screen.findByText('张先生');

    fireEvent.click(screen.getByRole('button', { name: '查看全部通话记录' }));
    expect(mockPush).toHaveBeenCalledWith('/ai-call/records?taskId=task-1');

    fireEvent.click(screen.getByRole('button', { name: '查看通话记录' }));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        '/ai-call/records?taskId=task-1&targetId=target-1',
      ),
    );
  });

  it('does not mount the Linphone test entry in the formal task detail', async () => {
    render(<AiCallTaskDetailPage />);
    await screen.findByText('批量客户回访');

    expect(mockLinphoneTaskTest).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '测试拨打入口' })).toBeNull();
    expect(screen.queryByTestId('linphone-active-status')).toBeNull();
  });

  it('opens the Web reception dialog only when the formal call is ready', async () => {
    const task = await mockedGetTask();
    mockedGetTask.mockResolvedValue({
      ...task,
      taskMode: 'single',
      answerMode: 'web',
    });
    mockedListTargets.mockResolvedValue({
      rows: [
        {
          targetId: 'target-web',
          taskId: 'task-1',
          status: 'DIALING',
          attemptCount: 1,
          activeCallId: 'call-web-1',
          activeCallStatus: 'ready',
          updatedAt: '2026-07-27 09:30:00',
        },
      ],
      total: 1,
    });

    render(<AiCallTaskDetailPage />);

    expect(await screen.findByTestId('web-task-call-modal')).toBeTruthy();
    expect(screen.queryByText('浏览器接听')).toBeNull();
    expect(mockWebTaskCallModal).toHaveBeenCalledWith(
      expect.objectContaining({ callId: 'call-web-1', open: true }),
    );
  });

  it('refreshes an immediate task while it is still scheduled', async () => {
    const task = await mockedGetTask();
    mockedGetTask.mockReset();
    mockedGetTask
      .mockResolvedValueOnce({
        ...task,
        status: 'SCHEDULED',
        completedTargets: 0,
      })
      .mockResolvedValue({
        ...task,
        status: 'COMPLETED',
        completedTargets: 100,
      });

    render(<AiCallTaskDetailPage />);

    expect(await screen.findByText('已完成')).toBeTruthy();
    expect(screen.getAllByText('100')).toHaveLength(2);
    await waitFor(() => expect(mockedGetTask).toHaveBeenCalledTimes(2));
  });

  it('uses attempt provenance to distinguish mock success from a real connection', async () => {
    const task = await mockedGetTask();
    mockedGetTask.mockResolvedValue({
      ...task,
      attemptDialerTypes: ['mock'],
      connectedTargets: 1,
    });
    mockedListTargets.mockResolvedValue({
      rows: [
        {
          targetId: 'target-1',
          taskId: 'task-1',
          customerName: '张先生',
          phoneNumber: '19900001001',
          status: 'COMPLETED',
          attemptCount: 1,
          latestResult: 'connected',
          latestDialerType: 'mock',
          updatedAt: '2026-07-27 09:30:00',
        },
      ],
      total: 1,
    });

    render(<AiCallTaskDetailPage />);

    expect(await screen.findByText('模拟成功数')).toBeTruthy();
    expect(screen.getAllByText('模拟执行').length).toBeGreaterThan(0);
    expect(await screen.findByText('模拟执行完成')).toBeTruthy();
    expect(screen.queryByText('已接通')).toBeNull();
  });

  it('shows the planned execution time for a scheduled task', async () => {
    const task = await mockedGetTask();
    mockedGetTask.mockResolvedValue({
      ...task,
      executionMode: 'scheduled',
      scheduledAt: '2026-08-28 20:30:00',
    });

    render(<AiCallTaskDetailPage />);

    expect(await screen.findByText('执行计划')).toBeTruthy();
    expect(screen.getByText('定时执行')).toBeTruthy();
    expect(screen.getByText('计划执行时间')).toBeTruthy();
    expect(screen.getByText('2026-08-28 20:30:00')).toBeTruthy();
  });

  it('does not flatten SIP 480 into generic no answer', async () => {
    mockedListTargets.mockResolvedValue({
      rows: [
        {
          targetId: 'target-1',
          taskId: 'task-1',
          customerName: '张先生',
          phoneNumber: '19900001001',
          status: 'COMPLETED',
          attemptCount: 1,
          latestResult: 'no_answer',
          providerStatusCode: '480',
          providerReason: 'SIP 480 Temporarily Unavailable',
          hangupCause: 'USER_UNAVAILABLE',
          updatedAt: '2026-08-28 20:29:51',
        },
      ],
      total: 1,
    });

    render(<AiCallTaskDetailPage />);

    expect(await screen.findByText('被叫暂时不可用（SIP 480）')).toBeTruthy();
    expect(screen.queryByText('无人接听')).toBeNull();
  });
});

import { act, render, screen, waitFor, within } from '@testing-library/react';
import * as React from 'react';
import { listAiCallTasks } from '@/pages/aiCallTasks/service';
import {
  getAdminFollowUp,
  listAdminFollowUps,
} from '@/services/ruoyi/agent-console';
import FollowUpOverviewPage from './overview';

let mockDeepLinkFollowUpId = 'follow-up-1';
let mockStatisticsSearch = '';
let mockTableQuery: Record<string, unknown> = { current: 1, pageSize: 10 };
let latestProTableProps: Record<string, unknown> = {};

jest.mock('@umijs/max', () => ({
  useSearchParams: () => [
    new URLSearchParams(
      mockStatisticsSearch ||
        (mockDeepLinkFollowUpId
          ? `followUpId=${encodeURIComponent(mockDeepLinkFollowUpId)}`
          : ''),
    ),
  ],
}));

jest.mock('@ant-design/pro-components', () => {
  const React = require('react');
  return {
    PageContainer: ({ children, title }: Record<string, unknown>) =>
      React.createElement(
        'main',
        null,
        React.createElement('h1', null, title),
        children,
      ),
    ProTable: (props: Record<string, unknown>) => {
      const request = props.request as CallableFunction;
      latestProTableProps = props;
      React.useEffect(() => {
        void request(mockTableQuery);
      }, []);
      return React.createElement('div');
    },
  };
});

jest.mock('@/services/ruoyi/agent-console', () => ({
  getAdminFollowUp: jest.fn(),
  listAdminFollowUps: jest.fn(),
}));

jest.mock('@/pages/aiCallTasks/service', () => ({
  listAiCallTasks: jest.fn(),
}));

jest.mock('../_shared', () => ({
  AdminMetricRow: ({
    items,
  }: {
    items: { key: string; label: string; value: number }[];
  }) => {
    const React = require('react');
    return React.createElement(
      'div',
      null,
      items.map((item) =>
        React.createElement(
          'span',
          { key: item.key },
          `${item.label} ${item.value}`,
        ),
      ),
    );
  },
  formatDateTime: (value: string) => value,
  sceneLabels: { intro_geo: 'GEO 获客' },
  sceneValueEnum: {},
  statusColors: {
    pending: 'warning',
    processing: 'processing',
    completed: 'success',
    closed: 'default',
  },
  statusLabels: {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    closed: '已关闭',
  },
  unwrapPage: (value: unknown) => value,
}));

const task = {
  id: 'follow-up-1',
  source_type: 'ai_post_call',
  source_call_id: 'call-1',
  source_handoff_id: null,
  scene_code: 'intro_geo',
  masked_contact: '199****1001',
  follow_up_reason: '客户明确要求稍后联系',
  summary: '客户希望了解价格方案',
  owner_agent_identity: null,
  customer_callback_at: null,
  status: 'pending',
  attempts: [],
  created_at: '2026-07-30T10:00:00+08:00',
};

describe('跟进总览深链', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeepLinkFollowUpId = 'follow-up-1';
    mockStatisticsSearch = '';
    mockTableQuery = { current: 1, pageSize: 10 };
    latestProTableProps = {};
    (listAdminFollowUps as jest.Mock).mockResolvedValue({
      rows: [],
      total: 0,
    });
    (listAiCallTasks as jest.Mock).mockResolvedValue({
      rows: [{ taskId: 'task-1', taskName: '新品回访' }],
      total: 1,
    });
    (getAdminFollowUp as jest.Mock).mockResolvedValue(task);
  });

  it('根据 followUpId 自动打开 AI 话后跟进详情', async () => {
    render(<FollowUpOverviewPage />);

    expect(getAdminFollowUp).toHaveBeenCalledWith('follow-up-1');
    const drawer = await screen.findByRole('dialog', {
      name: '跟进任务详情',
    });
    expect(within(drawer).getByText('AI 话后跟进')).toBeTruthy();
    expect(within(drawer).getByText('关联通话与处理记录')).toBeTruthy();
    expect(within(drawer).queryByText('call-1')).toBeNull();
    expect(within(drawer).queryByText('handoff_id')).toBeNull();
  });

  it('继承外呼统计下钻的待跟进状态和来源通话时间', async () => {
    mockDeepLinkFollowUpId = '';
    mockStatisticsSearch = new URLSearchParams({
      status: 'pending',
      formalOutboundOnly: 'true',
      sourceStartedAtBegin: '2026-07-25T00:00:00+08:00',
      sourceStartedAtEnd: '2026-07-31T16:20:00+08:00',
    }).toString();

    render(<FollowUpOverviewPage />);

    await waitFor(() =>
      expect(listAdminFollowUps).toHaveBeenCalledWith({
        pageNum: 1,
        pageSize: 10,
        status: 'pending',
        formalOutboundOnly: true,
        sourceStartedAtBegin: '2026-07-25T00:00:00+08:00',
        sourceStartedAtEnd: '2026-07-31T16:20:00+08:00',
      }),
    );
    expect(
      (
        latestProTableProps.columns as {
          dataIndex?: string;
          initialValue?: string;
        }[]
      ).find((column) => column.dataIndex === 'status'),
    ).toMatchObject({ initialValue: 'pending' });
  });

  it('支持按所属任务筛选并映射管理端参数', async () => {
    mockDeepLinkFollowUpId = '';
    mockTableQuery = {
      current: 1,
      pageSize: 10,
      source_type: 'after_call_work',
      status: 'completed',
      scene_code: 'intro_geo',
      task_id: 'task-1',
    };

    render(<FollowUpOverviewPage />);

    await waitFor(() =>
      expect(listAdminFollowUps).toHaveBeenCalledWith({
        pageNum: 1,
        pageSize: 10,
        sourceType: 'after_call_work',
        status: 'completed',
        sceneCode: 'intro_geo',
        taskId: 'task-1',
      }),
    );
    const searchableTitles = (
      latestProTableProps.columns as { title: string; hideInSearch?: boolean }[]
    )
      .filter((column) => !column.hideInSearch)
      .map((column) => column.title);
    expect(searchableTitles).toEqual([
      '来源类型',
      '业务场景',
      '所属任务',
      '任务状态',
    ]);
    const taskColumn = (
      latestProTableProps.columns as {
        dataIndex?: string;
        request?: () => Promise<unknown>;
      }[]
    ).find((column) => column.dataIndex === 'task_id');
    await expect(taskColumn?.request?.()).resolves.toEqual([
      { label: '新品回访', value: 'task-1' },
    ]);
    expect(
      (
        latestProTableProps.columns as {
          hideInSearch?: boolean;
          search?: boolean;
        }[]
      )
        .filter((column) => column.hideInSearch)
        .every((column) => column.search === false),
    ).toBe(true);
    expect(
      (
        latestProTableProps.columns as {
          dataIndex?: string;
          valueEnum?: Record<string, { text: string }>;
        }[]
      ).find((column) => column.dataIndex === 'status')?.valueEnum,
    ).toMatchObject({
      completed: { text: '已办结' },
      closed: { text: '已终止' },
    });
  });

  it('默认展开三项筛选', async () => {
    mockDeepLinkFollowUpId = '';

    render(<FollowUpOverviewPage />);

    await waitFor(() => expect(listAdminFollowUps).toHaveBeenCalled());
    expect(latestProTableProps.search).toMatchObject({
      defaultCollapsed: false,
    });
  });

  it('将手动安排来源展示为中文', async () => {
    mockDeepLinkFollowUpId = '';

    render(<FollowUpOverviewPage />);

    await waitFor(() => expect(listAdminFollowUps).toHaveBeenCalled());
    const sourceColumn = (
      latestProTableProps.columns as {
        dataIndex?: string;
        renderText?: (value: string) => string;
      }[]
    ).find((column) => column.dataIndex === 'source_type');
    expect(sourceColumn?.renderText?.('manual_schedule')).toBe('手动安排回访');
  });

  it('只展示当前提交结果对应的跟进指标', async () => {
    mockDeepLinkFollowUpId = '';
    (listAdminFollowUps as jest.Mock).mockResolvedValue({
      rows: [],
      total: 0,
      metrics: {
        pending: 2,
        handoff_unanswered: 3,
        completed: 4,
        closed: 5,
        scheduled: 6,
        overdue: 7,
      },
    });

    render(<FollowUpOverviewPage />);

    expect(await screen.findByText('待处理 2')).toBeTruthy();
    expect(screen.getByText('人工未接回访 3')).toBeTruthy();
    expect(screen.getByText('已办结 4')).toBeTruthy();
    expect(screen.getByText('已终止 5')).toBeTruthy();
    expect(screen.queryByText('客户预约待回访 6')).toBeNull();
    expect(screen.queryByText('预约已逾期 7')).toBeNull();
  });

  it('使用公共详情抽屉展示详情接口返回的关联回拨通话', async () => {
    (getAdminFollowUp as jest.Mock).mockResolvedValue({
      data: {
        task,
        attempts: [],
        callback_records: [
          {
            id: 'record-1',
            call_id: 'callback-call-1',
            status: 'completed',
            end_reason: 'customer_hangup',
          },
        ],
      },
    });

    render(<FollowUpOverviewPage />);

    const drawer = await screen.findByRole('dialog', {
      name: '跟进任务详情',
    });
    expect(within(drawer).getByText('第1次人工回拨')).toBeTruthy();
    expect(within(drawer).getByText('已结束')).toBeTruthy();
    expect(within(drawer).queryByText('callback-call-1')).toBeNull();
  });

  it('深链任务不存在时在详情抽屉展示明确错误', async () => {
    (getAdminFollowUp as jest.Mock).mockRejectedValue(new Error('not found'));

    render(<FollowUpOverviewPage />);

    expect(
      await screen.findByText('跟进任务详情加载失败，请确认任务是否存在或重试'),
    ).toBeTruthy();
  });

  it('快速切换深链时只展示最后一次请求的详情', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    let resolveSecond: (value: unknown) => void = () => undefined;
    (getAdminFollowUp as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const view = render(<FollowUpOverviewPage />);
    mockDeepLinkFollowUpId = 'follow-up-2';
    view.rerender(<FollowUpOverviewPage />);

    await act(async () => {
      resolveSecond({
        ...task,
        id: 'follow-up-2',
        follow_up_reason: '第二条任务',
      });
    });
    expect(await screen.findByText('第二条任务')).toBeTruthy();

    await act(async () => {
      resolveFirst(task);
    });
    expect(screen.getByText('第二条任务')).toBeTruthy();
    expect(screen.queryByText('客户明确要求稍后联系')).toBeNull();
  });
});

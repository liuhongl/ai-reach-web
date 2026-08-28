import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { history } from '@umijs/max';
import * as React from 'react';
import {
  adjustFollowUpDataClassification,
  scheduleFollowUpData,
} from '@/pages/aiCallFollowUpData/service';
import { listAiCallTasks } from '@/pages/aiCallTasks/service';
import {
  submitAfterCallWork,
  submitFollowUpDataHandlingResult,
  submitFollowUpHandlingResult,
} from '@/services/ruoyi/agent-console';
import AiCallRecordsPage from '.';
import {
  getAiCallRecordDetail,
  getAiCallRecordDialogue,
  getAiCallRecordEvents,
  getAiCallRecordHandoffs,
  getAiCallRecordQuality,
  getAiCallRecordRecording,
  getAiCallRecordSemanticAnalysis,
  listAiCallRecords,
  reviewAiCallRecordClassification,
  saveAiCallRecordQualityReview,
  scoreAiCallRecordQuality,
} from './service';

let mockSearchParams = 'taskId=task-1&targetId=target-1';

void React.createElement;

jest.mock('./service', () => ({
  getAiCallRecordDetail: jest.fn(),
  getAiCallRecordDialogue: jest.fn(),
  getAiCallRecordEvents: jest.fn(),
  getAiCallRecordHandoffs: jest.fn(),
  getAiCallRecordQuality: jest.fn(),
  getAiCallRecordRecording: jest.fn(),
  getAiCallRecordSemanticAnalysis: jest.fn(),
  listAiCallRecords: jest.fn(),
  reviewAiCallRecordClassification: jest.fn(),
  saveAiCallRecordQualityReview: jest.fn(),
  scoreAiCallRecordQuality: jest.fn(),
}));

jest.mock('@/pages/aiCallTasks/service', () => ({
  listAiCallTasks: jest.fn(),
}));

jest.mock('@/pages/aiCallFollowUpData/service', () => ({
  adjustFollowUpDataClassification: jest.fn(),
  scheduleFollowUpData: jest.fn(),
}));

jest.mock('@/services/ruoyi/agent-console', () => ({
  listAdminAgents: jest.fn().mockResolvedValue({
    data: {
      rows: [
        {
          agent_identity: 'agent-admin',
          nick_name: '本地联调管理员',
        },
      ],
    },
  }),
  submitAfterCallWork: jest.fn(),
  submitFollowUpDataHandlingResult: jest.fn(),
  submitFollowUpHandlingResult: jest.fn(),
}));

jest.mock('@umijs/max', () => ({
  history: {
    push: jest.fn(),
  },
  useSearchParams: () => [new URLSearchParams(mockSearchParams)],
}));

jest.mock('@ant-design/pro-components', () => {
  const React = require('react');
  return {
    PageContainer: (props: Record<string, unknown>) => {
      const { children, className, title } = props;
      return React.createElement(
        'main',
        { className },
        React.createElement('h1', null, title),
        children,
      );
    },
    ProTable: (props: Record<string, unknown>) => {
      const columns = props.columns as Array<{
        key?: string;
        search?: boolean;
        title?: unknown;
        valueType?: string;
        render?: (value: unknown, row: unknown) => unknown;
        renderText?: (value: unknown, row: unknown) => unknown;
        dataIndex?: string;
        hideInTable?: boolean;
      }>;
      const request = props.request as CallableFunction;
      const [rows, setRows] = React.useState([]);
      React.useEffect(() => {
        void request({ current: 1, pageSize: 10 }).then(
          (result: Record<string, unknown>) => {
            setRows(Array.isArray(result.data) ? result.data : []);
          },
        );
      }, [request]);
      return React.createElement(
        'section',
        null,
        React.createElement(
          'div',
          { 'data-testid': 'search-fields' },
          ...columns
            .filter(
              (column) =>
                column.search !== false && column.valueType !== 'option',
            )
            .map((column) =>
              React.createElement(
                'span',
                { key: String(column.key || column.title) },
                column.title,
              ),
            ),
        ),
        React.createElement(
          'div',
          { 'data-testid': 'table-columns' },
          ...columns
            .filter((column) => !column.hideInTable)
            .map((column) =>
              React.createElement(
                'span',
                { key: String(column.key || column.title) },
                column.title,
              ),
            ),
        ),
        ...rows.map((row: unknown, index: number) =>
          React.createElement(
            'div',
            { key: index },
            ...columns
              .filter(
                (column) =>
                  column.search === false || column.valueType === 'option',
              )
              .map((column) =>
                React.createElement(
                  'div',
                  { key: String(column.key || column.title) },
                  column.render
                    ? column.render(undefined, row)
                    : column.renderText
                      ? column.renderText(
                          column.dataIndex
                            ? (row as Record<string, unknown>)[column.dataIndex]
                            : undefined,
                          row,
                        )
                      : column.dataIndex
                        ? String(
                            (row as Record<string, unknown>)[
                              column.dataIndex
                            ] ?? '',
                          )
                        : null,
                ),
              ),
          ),
        ),
      );
    },
  };
});

const mockRecord = {
  id: '1',
  callId: 'call-1',
  taskId: 'task-1',
  targetId: 'target-1',
  taskName: '新品回访',
  customerName: '张三',
  phoneNumber: '13800138000',
  attemptNo: 2,
  callResult: 'connected',
  aiOutcome: '有兴趣',
  summary: '客户希望明天下午再次联系，并进一步了解产品价格。',
  recordingPlayUrl: 'https://example.com/call-1.mp3',
  businessType: 'outbound_task',
  businessId: 'task-1',
  entryType: 'web',
  sceneCode: 'intro_geo',
  status: 'completed',
  startedAt: '2026-07-27T03:13:09',
  answeredAt: '2026-07-27T03:13:11',
  endedAt: '2026-07-27T03:13:52',
  durationMs: 43000,
  endReason: 'agent_completed',
};

describe('AI Call 通话记录页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAiCallRecordDetail as jest.Mock).mockReset();
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockReset();
    mockSearchParams = 'taskId=task-1&targetId=target-1';
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [mockRecord],
      total: 1,
    });
    (listAiCallTasks as jest.Mock).mockResolvedValue({
      rows: [
        {
          taskId: 'task-1',
          taskName: '新品回访',
        },
      ],
      total: 1,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: {
        promptProfileId: 'prompt-1',
        promptName: '新品回访提示词',
        sceneCode: 'intro_geo',
        voice: 'Cherry',
        voiceName: '芊悦',
        ruleName: '工作日规则',
      },
    });
    (getAiCallRecordRecording as jest.Mock).mockResolvedValue(null);
    (getAiCallRecordDialogue as jest.Mock).mockResolvedValue({
      rows: [],
      total: 0,
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue(null);
    (getAiCallRecordHandoffs as jest.Mock).mockResolvedValue({
      rows: [],
      total: 0,
    });
    (getAiCallRecordEvents as jest.Mock).mockResolvedValue({
      rows: [],
      total: 0,
    });
    (getAiCallRecordQuality as jest.Mock).mockResolvedValue({
      score: null,
      review: null,
    });
    (saveAiCallRecordQualityReview as jest.Mock).mockResolvedValue({
      id: 'review-1',
      callId: 'call-1',
      qualityResult: 'fail',
      qualityReason: 'AI 评分漏掉客户投诉',
      reviewedBy: '1',
      reviewedAt: '2026-08-05T12:00:00+08:00',
    });
    (scoreAiCallRecordQuality as jest.Mock).mockResolvedValue({
      score: {
        id: 'score-1',
        callId: 'call-1',
        status: 'completed',
        score: 86,
        reason: '客户问题回应完整，转人工时机合理。',
        modelVersion: 'quality-v1',
        retryCount: 0,
      },
      review: null,
    });
    (reviewAiCallRecordClassification as jest.Mock).mockResolvedValue({
      classificationReviewStatus: 'reviewed',
    });
    (adjustFollowUpDataClassification as jest.Mock).mockResolvedValue({
      version: 2,
    });
    (scheduleFollowUpData as jest.Mock).mockResolvedValue({
      follow_up_id: 'follow-up-1',
      version: 2,
    });
  });

  it('区分任务关联的 Web 接听与通用浏览器测试记录', async () => {
    const { unmount } = render(<AiCallRecordsPage />);
    expect(await screen.findByText(/Web 接听/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(within(detailDrawer).getByText('Web 接听')).toBeTruthy();

    unmount();
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [{ ...mockRecord, taskId: null, targetId: null }],
      total: 1,
    });
    render(<AiCallRecordsPage />);
    expect(await screen.findByText(/浏览器测试/)).toBeTruthy();
  });

  it('提供业务筛选、复合列，并继承任务与外呼对象上下文', async () => {
    const { container } = render(<AiCallRecordsPage />);

    expect(container.querySelector('.recov-list-page')).toBeTruthy();

    for (const text of [
      '通话记录',
      '所属任务',
      '客户名称',
      '通话来源',
      '呼叫结果',
      '客户意向',
      '分类复核状态',
      '回访任务状态',
      '话后结果',
      '通话时间范围',
      '通话时间',
      '客户信息',
      '任务名称',
      '呼叫情况',
      '通话摘要',
      '客户意向',
      '分类复核',
      '回访任务',
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    await waitFor(() =>
      expect(listAiCallRecords).toHaveBeenCalledWith({
        pageNum: 1,
        pageSize: 10,
        taskId: 'task-1',
        targetId: 'target-1',
      }),
    );
    expect(await screen.findByText('张三')).toBeTruthy();
    expect(screen.getAllByText('新品回访').length).toBeGreaterThan(0);
    expect(screen.getByText(/客户希望明天下午再次联系/)).toBeTruthy();
    const connectedResult = screen.getByText('已接通');
    expect(connectedResult.closest('.ant-tag')).toBeNull();
    expect(
      (connectedResult.closest('.ant-typography') as HTMLElement | null)?.style
        .color,
    ).toBe('rgb(56, 158, 13)');
    const detailButton = await screen.findByRole('button', {
      name: '查看详情',
    });
    expect(detailButton.textContent).toBe('查看详情');

    const searchFields = screen.getByTestId('search-fields');
    const tableColumns = screen.getByTestId('table-columns');
    expect(
      Array.from(tableColumns.children)
        .map((element) => element.textContent)
        .slice(0, 5),
    ).toEqual(['客户信息', '任务名称', '呼叫情况', '通话摘要', '通话时间']);
    expect(
      within(searchFields).queryByText('手机号', { exact: true }),
    ).toBeNull();
    expect(screen.queryByText('task-1', { exact: true })).toBeNull();
    expect(
      within(tableColumns).queryByText('所属任务', { exact: true }),
    ).toBeNull();
    for (const text of [
      '通话时间',
      '客户信息',
      '任务名称',
      '呼叫情况',
      '通话摘要',
    ]) {
      expect(
        within(searchFields).queryByText(text, { exact: true }),
      ).toBeNull();
    }
    expect(within(tableColumns).queryByText('录音')).toBeNull();
  });

  it('在通话记录恢复待提交的转人工话后结果', async () => {
    const pendingRecord = {
      ...mockRecord,
      afterCallResultStatus: 'pending' as const,
      afterCallResultType: 'handoff' as const,
      operatorAgentIdentity: 'agent-1',
    };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [pendingRecord],
      total: 1,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: pendingRecord,
      followUpData: {
        id: 'data-1',
        classification: 'interested',
        latestConclusion: '客户希望了解价格',
        version: 3,
      },
      executionConfig: null,
    });
    (getAiCallRecordHandoffs as jest.Mock).mockResolvedValue({
      rows: [
        {
          handoffId: 'handoff-1',
          callId: 'call-1',
          status: 'completed',
          humanAgentIdentity: 'agent-1',
          requestedAt: '2026-07-27T03:13:09',
        },
      ],
      total: 1,
    });
    (submitAfterCallWork as jest.Mock).mockResolvedValue({ code: 200 });

    render(<AiCallRecordsPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: '提交话后结果' }),
    );

    const drawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(within(drawer).getByText('待提交话后结果')).toBeTruthy();
    fireEvent.click(
      within(drawer).getByRole('button', { name: '提交话后结果' }),
    );

    await waitFor(() =>
      expect(submitAfterCallWork).toHaveBeenCalledWith(
        'call-1',
        expect.objectContaining({
          handoffId: 'handoff-1',
          classification: 'interested',
          conclusion: mockRecord.summary,
          scheduleFollowUp: false,
          expectedVersion: 3,
          idempotencyKey: 'after-call-result:call-1',
        }),
      ),
    );
    expect(submitFollowUpHandlingResult).not.toHaveBeenCalled();
  });

  it('在通话记录提交无回访任务的人工外呼结果', async () => {
    const pendingRecord = {
      ...mockRecord,
      entryType: 'sip_callback',
      followUpDataId: 'data-1',
      afterCallResultStatus: 'pending' as const,
      afterCallResultType: 'follow_up_data' as const,
      operatorAgentIdentity: 'agent-1',
    };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [pendingRecord],
      total: 1,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: pendingRecord,
      followUpData: {
        id: 'data-1',
        classification: 'interested',
        latestConclusion: '客户希望了解价格',
        version: 4,
      },
      executionConfig: null,
    });
    (submitFollowUpDataHandlingResult as jest.Mock).mockResolvedValue({
      code: 200,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: '提交话后结果' }),
    );
    const drawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    fireEvent.click(
      within(drawer).getByRole('button', { name: '提交话后结果' }),
    );

    await waitFor(() =>
      expect(submitFollowUpDataHandlingResult).toHaveBeenCalledWith(
        'data-1',
        expect.objectContaining({
          callId: 'call-1',
          classification: 'interested',
          conclusion: mockRecord.summary,
          scheduleFollowUp: false,
          expectedVersion: 4,
          idempotencyKey: 'follow-up-data-handling:call-1',
        }),
      ),
    );
  });

  it('回拨记录不复用原外呼序号，并在缺少后端时长时不自行推算', async () => {
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [
        {
          ...mockRecord,
          entryType: 'sip_callback',
          attemptNo: 1,
          durationMs: null,
          startedAt: '2026-08-05T23:03:50',
          endedAt: '2026-08-05T23:04:25',
        },
      ],
      total: 1,
    });

    render(<AiCallRecordsPage />);

    await screen.findByText('人工回拨');
    expect(screen.queryByText('35 秒')).toBeNull();
    expect(screen.getByText('138****8000')).toBeTruthy();
    expect(screen.queryByText('13800138000')).toBeNull();
    expect(screen.queryByText('人工回拨 · 第 1 次')).toBeNull();
  });

  it('失败记录展示 SIP 480 中文原因、处理状态与呼叫结果，且不提供人工质检入口', async () => {
    const failedRecord = {
      ...mockRecord,
      entryType: 'sip_outbound',
      status: 'completed',
      callResult: 'no_answer',
      endReason: 'user_unavailable',
      failureMessage:
        'SIP 480 Temporarily Unavailable; hangup_cause=USER_UNAVAILABLE',
      answeredAt: null,
      qualityScoreStatus: 'not_applicable',
      qualityReviewResult: null,
    };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [failedRecord],
      total: 1,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: failedRecord,
      executionConfig: null,
    });

    render(<AiCallRecordsPage />);

    expect(await screen.findByText('无人接听')).toBeTruthy();
    expect(screen.getByText(/原因：被叫暂时不可用（SIP 480）/)).toBeTruthy();
    expect(screen.queryByText('未复核')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(within(detailDrawer).getByText('处理状态')).toBeTruthy();
    expect(within(detailDrawer).getByText('呼叫结果')).toBeTruthy();
    expect(within(detailDrawer).getByText('无人接听')).toBeTruthy();
    expect(
      within(detailDrawer).getByText('被叫暂时不可用（SIP 480）'),
    ).toBeTruthy();
    expect(within(detailDrawer).queryByText('user_unavailable')).toBeNull();
    expect(
      within(detailDrawer).queryByText(/SIP 480 Temporarily Unavailable/),
    ).toBeNull();
  });

  it('未接通的人工回拨展示失败样式且不开放分类与回访操作', async () => {
    const callbackRecord = {
      ...mockRecord,
      entryType: 'sip_callback',
      callResult: 'no_answer',
      status: 'completed',
      answeredAt: null,
      endReason: 'callback_no_answer',
    };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [callbackRecord],
      total: 1,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: callbackRecord,
      executionConfig: null,
      followUpData: {
        id: 'follow-up-data-1',
        classification: 'nurturing',
        version: 1,
      },
    });

    render(<AiCallRecordsPage />);

    expect(await screen.findByText('无人接听')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(
      within(detailDrawer).getByText('无人接听').closest('.ant-tag'),
    ).not.toBeNull();
    expect(within(detailDrawer).getByText('未接通')).toBeTruthy();
    expect(
      within(detailDrawer).getByTestId('customer-follow-up-section').hidden,
    ).toBe(true);
    expect(
      within(detailDrawer).queryByRole('button', { name: '修改分类' }),
    ).toBeNull();
    expect(
      within(detailDrawer).queryByRole('button', { name: '安排回访' }),
    ).toBeNull();
  });

  it('在列表展示 AI 评分和人工质检，并提供复核入口', async () => {
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [
        {
          ...mockRecord,
          entryType: 'sip_outbound',
          qualityScoreStatus: 'completed',
          qualityScore: 86,
          qualityReviewResult: null,
        },
      ],
      total: 1,
    });
    (getAiCallRecordQuality as jest.Mock).mockResolvedValue({
      score: {
        id: 'score-1',
        callId: 'call-1',
        status: 'completed',
        score: 86,
        reason: '客户问题回应完整，转人工时机合理。',
        modelVersion: 'quality-v1',
        retryCount: 0,
      },
      review: null,
    });
    (getAiCallRecordDialogue as jest.Mock).mockResolvedValue({
      rows: [
        {
          id: 'segment-1',
          callId: 'call-1',
          segmentNo: 1,
          speakerType: 'customer',
          text: '价格怎么收费？',
          segmentStatus: 'final',
        },
      ],
      total: 1,
    });
    (getAiCallRecordRecording as jest.Mock).mockResolvedValue({
      id: 'recording-1',
      callId: 'call-1',
      status: 'completed',
      playUrl: 'https://example.com/call-1.mp3',
    });

    render(<AiCallRecordsPage />);

    expect(await screen.findByText('86分')).toBeTruthy();
    expect(screen.getByText('未复核')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '复核' }));

    const drawer = await screen.findByRole('dialog', {
      name: '外呼质检复核',
    });
    expect(
      await within(drawer).findByText('客户问题回应完整，转人工时机合理。'),
    ).toBeTruthy();
    expect(within(drawer).getByText('录音')).toBeTruthy();
    expect(within(drawer).getByText('对话文本')).toBeTruthy();
    expect(within(drawer).getByText('价格怎么收费？')).toBeTruthy();
    for (const description of [
      '明显超出质检标准',
      '整体准确，略有瑕疵',
      '达到基本质检要求',
      '存在明显问题',
    ]) {
      expect(within(drawer).getByText(description)).toBeTruthy();
    }
    expect(getAiCallRecordRecording).toHaveBeenCalledWith('call-1');
    expect(getAiCallRecordDialogue).toHaveBeenCalledWith('call-1');
    expect(
      within(drawer)
        .getByTestId('quality-recording-player')
        .querySelector('audio')
        ?.getAttribute('controlslist'),
    ).toBe('nodownload');
    expect(
      (
        within(drawer).getByRole('button', {
          name: /保\s*存/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    const qualityScoreValue = within(drawer).getByTestId('quality-score-value');
    expect(qualityScoreValue.textContent).toBe('86分');
    fireEvent.click(within(drawer).getByText('不合格'));
    expect(
      (
        within(drawer).getByRole('button', {
          name: /保\s*存/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(
      await within(drawer).findByPlaceholderText('请输入不合格原因'),
      {
        target: { value: 'AI 评分漏掉客户投诉' },
      },
    );
    const saveButton = within(drawer).getByRole('button', {
      name: /保\s*存/,
    }) as HTMLButtonElement;
    await waitFor(() => expect(saveButton.disabled).toBe(false));
    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(saveAiCallRecordQualityReview).toHaveBeenCalledWith('call-1', {
        qualityResult: 'fail',
        qualityReason: 'AI 评分漏掉客户投诉',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '外呼质检复核' })).toBeNull(),
    );
  });

  it('任务关联的 Web 接听展示话后结论和复核入口', async () => {
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [
        {
          ...mockRecord,
          analysisStatus: '2',
          customerIntent: 'neutral',
          followUpId: 'follow-up-1',
          followUpStatus: 'pending',
          qualityScoreStatus: 'pending',
        },
      ],
      total: 1,
    });

    render(<AiCallRecordsPage />);

    expect(await screen.findByText('中性')).toBeTruthy();
    expect(screen.getByText('待处理')).toBeTruthy();
    expect(screen.getByText('待评分')).toBeTruthy();
    expect(screen.getByRole('button', { name: '复核' })).toBeTruthy();
  });

  it('已复核记录在人工质检列显示修改入口', async () => {
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [
        {
          ...mockRecord,
          entryType: 'sip_outbound',
          qualityScoreStatus: 'completed',
          qualityScore: 72,
          qualityReviewResult: 'fail',
          qualityReviewReason: '未确认客户的核心诉求',
        },
      ],
      total: 1,
    });

    render(<AiCallRecordsPage />);

    expect(await screen.findByText('不合格')).toBeTruthy();
    expect(screen.getByText('原因：未确认客户的核心诉求')).toBeTruthy();
    expect(screen.getByRole('button', { name: '修改复核' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '复核' })).toBeNull();
  });

  it('AI 评分未完成时不拉评分详情，可手动触发评分', async () => {
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [
        {
          ...mockRecord,
          entryType: 'sip_outbound',
          qualityScoreStatus: 'pending',
          qualityScore: null,
          qualityReviewResult: null,
        },
      ],
      total: 1,
    });
    (getAiCallRecordQuality as jest.Mock).mockRejectedValue(
      new Error('quality api unavailable'),
    );

    render(<AiCallRecordsPage />);

    fireEvent.click(await screen.findByRole('button', { name: '复核' }));

    const drawer = await screen.findByRole('dialog', {
      name: '外呼质检复核',
    });
    expect(
      await within(drawer).findByText('AI 评分完成后才能复核'),
    ).toBeTruthy();
    expect(within(drawer).queryByText('质检评分加载失败')).toBeNull();
    expect(within(drawer).queryByText('优秀')).toBeNull();
    expect(getAiCallRecordQuality).not.toHaveBeenCalled();
    fireEvent.click(within(drawer).getByRole('button', { name: '立即评分' }));

    expect(await within(drawer).findByText('86分')).toBeTruthy();
    expect(within(drawer).getByText('优秀')).toBeTruthy();
    expect(scoreAiCallRecordQuality).toHaveBeenCalledWith('call-1');
  });

  it('建议复核只确认分类，不创建回访任务', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: null,
      followUpData: {
        id: 'data-1',
        classification: 'interested',
        version: 1,
      },
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock)
      .mockResolvedValueOnce({
        callId: 'call-1',
        analysisSceneCode: 'intro_geo',
        analysisStatus: '2',
        analysisResult: {
          classification: 'interested',
          confidence: 'low',
          valid_dialogue: true,
          reason: '客户询问产品演示',
          evidence: ['客户：可以先看演示'],
          evidence_conflict: true,
        },
        classificationRequiresReview: true,
        classificationReviewStatus: 'suggested',
        analysisRetryCount: 0,
      })
      .mockResolvedValueOnce({
        callId: 'call-1',
        analysisSceneCode: 'intro_geo',
        analysisStatus: '2',
        analysisResult: {
          classification: 'interested',
          confidence: 'low',
          valid_dialogue: true,
          reason: '客户询问产品演示',
          evidence: ['客户：可以先看演示'],
          evidence_conflict: true,
        },
        classificationRequiresReview: false,
        classificationReviewStatus: 'reviewed',
        followUpReviewStatus: 'confirmed',
        followUpReviewedByName: '管理员',
        followUpReviewedAt: '2026-08-17T10:00:00+08:00',
        analysisRetryCount: 0,
      });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });

    expect(
      within(
        within(detailDrawer).getByTestId('customer-follow-up-section'),
      ).getByText('AI 建议分类'),
    ).toBeTruthy();
    expect(within(detailDrawer).getByText('客户询问产品演示')).toBeTruthy();
    expect(within(detailDrawer).getByText('客户：可以先看演示')).toBeTruthy();
    const customerFollowUpSection = within(detailDrawer).getByTestId(
      'customer-follow-up-section',
    );
    expect(
      within(customerFollowUpSection).getByText(
        'AI 分类与当前业务分类一致，但分类依据与对话证据存在冲突，请确认当前分类或修改分类，完成人工复核。',
      ),
    ).toBeTruthy();
    const confidence = within(detailDrawer).getByTestId(
      'classification-confidence',
    );
    expect(confidence.className).toContain('ant-tag-error');
    expect(
      within(detailDrawer).getByText(
        'AI 分类依据与对话证据不一致，需人工确认最终分类。',
      ),
    ).toBeTruthy();
    const confirmButton = within(customerFollowUpSection).getByRole('button', {
      name: '确认当前分类',
    });
    expect(
      within(customerFollowUpSection).queryByRole('button', {
        name: '采纳 AI 分类',
      }),
    ).toBeNull();
    const editButton = within(customerFollowUpSection).getByRole('button', {
      name: '修改分类',
    });
    for (const button of [confirmButton, editButton]) {
      expect(button.className).toContain('ant-btn-color-primary');
      expect(button.className).toContain('ant-btn-variant-outlined');
    }
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(reviewAiCallRecordClassification).toHaveBeenCalledWith(
        'call-1',
        expect.objectContaining({
          classification: 'interested',
          reason: '客户询问产品演示',
          expectedVersion: 1,
        }),
      ),
    );
    expect(scheduleFollowUpData).not.toHaveBeenCalled();
    expect(await within(detailDrawer).findByText(/已确认分类/)).toBeTruthy();
  });

  it('无分类冲突时仍可修改分类', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: null,
      followUpData: {
        id: 'data-1',
        classification: 'nurturing',
        version: 1,
      },
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: {
        classification: 'nurturing',
        confidence: 'high',
        valid_dialogue: true,
        reason: '客户希望以后联系',
        evidence: ['客户：过段时间再说'],
      },
      classificationRequiresReview: false,
      classificationReviewStatus: null,
      analysisRetryCount: 0,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    fireEvent.click(
      within(detailDrawer).getByRole('button', { name: '修改分类' }),
    );

    const modalTitle = await screen.findByText('修改分类', {
      selector: '.ant-modal-title',
    });
    const modal = modalTitle.closest('[role="dialog"]') as HTMLElement;
    expect(within(modal).getByText('客户分类')).toBeTruthy();
    expect(within(modal).getByText('分类原因')).toBeTruthy();
    expect(within(modal).getByDisplayValue('客户希望以后联系')).toBeTruthy();
  });

  it('AI 分析加载失败时不开放安排回访', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: null,
      followUpData: {
        id: 'data-1',
        classification: 'nurturing',
        version: 1,
      },
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockRejectedValue(
      new Error('analysis unavailable'),
    );

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });

    expect(within(detailDrawer).getByText('AI 分析加载失败')).toBeTruthy();
    expect(
      within(detailDrawer).queryByRole('button', { name: '安排回访' }),
    ).toBeNull();
  });

  it('复核后再次修改分类时仍展示当时采纳的 AI 分类', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: null,
      followUpData: {
        id: 'data-1',
        classification: 'nurturing',
        version: 3,
      },
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: {
        classification: 'interested',
        confidence: 'medium',
        valid_dialogue: true,
        reason: '客户同意安排产品演示',
        evidence: ['客户：行'],
      },
      classificationRequiresReview: false,
      classificationReviewStatus: 'reviewed',
      followUpReviewStatus: 'confirmed',
      followUpReviewedByName: '管理员',
      followUpReviewedAt: '2026-08-21T10:36:27+08:00',
      analysisRetryCount: 0,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });

    expect(within(detailDrawer).getByText(/已确认分类：有意向/)).toBeTruthy();
    expect(within(detailDrawer).getByText('持续跟进')).toBeTruthy();
  });

  it('分类冲突时可保留当前分类，复核后才允许安排回访', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: null,
      followUpData: {
        id: 'data-1',
        classification: 'nurturing',
        version: 2,
      },
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock)
      .mockResolvedValueOnce({
        callId: 'call-1',
        analysisSceneCode: 'intro_geo',
        analysisStatus: '2',
        analysisResult: {
          classification: 'low_value',
          low_value_reason: 'non_target_customer',
          confidence: 'high',
          valid_dialogue: false,
          reason: '客户并非目标客户',
          evidence: ['客户：我不是负责人'],
          evidence_conflict: false,
        },
        classificationRequiresReview: true,
        classificationReviewStatus: 'suggested',
        analysisRetryCount: 0,
      })
      .mockResolvedValueOnce({
        callId: 'call-1',
        analysisSceneCode: 'intro_geo',
        analysisStatus: '2',
        analysisResult: {
          classification: 'low_value',
          low_value_reason: 'non_target_customer',
          confidence: 'high',
          valid_dialogue: false,
          reason: '客户并非目标客户',
          evidence: ['客户：我不是负责人'],
          evidence_conflict: false,
        },
        classificationRequiresReview: false,
        classificationReviewStatus: 'reviewed',
        followUpReviewStatus: 'adjusted',
        followUpReviewedByName: '管理员',
        followUpReviewedAt: '2026-08-24T10:30:00+08:00',
        analysisRetryCount: 0,
      });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    fireEvent.click(
      within(detailDrawer).getByRole('button', { name: '保留当前分类' }),
    );

    await waitFor(() =>
      expect(reviewAiCallRecordClassification).toHaveBeenCalledWith(
        'call-1',
        expect.objectContaining({
          classification: 'nurturing',
          reason: '人工复核后保留当前业务分类。',
          expectedVersion: 2,
        }),
      ),
    );
    expect(
      await within(detailDrawer).findByText(/已确认最终分类：持续跟进/),
    ).toBeTruthy();
    expect(
      within(detailDrawer).getByRole('button', { name: '安排回访' }),
    ).toBeTruthy();
  });

  it('分类冲突时采纳低价值后不展示安排回访', async () => {
    (getAiCallRecordDetail as jest.Mock)
      .mockResolvedValueOnce({
        record: mockRecord,
        executionConfig: null,
        followUpData: {
          id: 'data-1',
          classification: 'nurturing',
          version: 2,
        },
      })
      .mockResolvedValueOnce({
        record: mockRecord,
        executionConfig: null,
        followUpData: {
          id: 'data-1',
          classification: 'low_value',
          lowValueReason: 'non_target_customer',
          version: 3,
        },
      });
    (getAiCallRecordSemanticAnalysis as jest.Mock)
      .mockResolvedValueOnce({
        callId: 'call-1',
        analysisSceneCode: 'intro_geo',
        analysisStatus: '2',
        analysisResult: {
          classification: 'low_value',
          low_value_reason: 'non_target_customer',
          confidence: 'high',
          valid_dialogue: true,
          reason: '客户并非目标客户',
          evidence: ['客户：我不是负责人'],
          evidence_conflict: false,
        },
        classificationRequiresReview: true,
        classificationReviewStatus: 'suggested',
        analysisRetryCount: 0,
      })
      .mockResolvedValueOnce({
        callId: 'call-1',
        analysisSceneCode: 'intro_geo',
        analysisStatus: '2',
        analysisResult: {
          classification: 'low_value',
          low_value_reason: 'non_target_customer',
          confidence: 'high',
          valid_dialogue: true,
          reason: '客户并非目标客户',
          evidence: ['客户：我不是负责人'],
          evidence_conflict: false,
        },
        classificationRequiresReview: false,
        classificationReviewStatus: 'reviewed',
        followUpReviewStatus: 'confirmed',
        followUpReviewedByName: '管理员',
        followUpReviewedAt: '2026-08-24T10:35:00+08:00',
        analysisRetryCount: 0,
      });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    fireEvent.click(
      within(detailDrawer).getByRole('button', { name: '采纳 AI 分类' }),
    );

    await waitFor(() =>
      expect(reviewAiCallRecordClassification).toHaveBeenCalledWith(
        'call-1',
        expect.objectContaining({
          classification: 'low_value',
          lowValueReason: 'non_target_customer',
          expectedVersion: 2,
        }),
      ),
    );
    expect(
      await within(detailDrawer).findByText(/已确认分类：低价值/),
    ).toBeTruthy();
    expect(
      within(detailDrawer).queryByRole('button', { name: '安排回访' }),
    ).toBeNull();
  });

  it('已有有效回访任务时展示查看任务，并保留修改分类', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: null,
      followUpData: {
        id: 'data-1',
        classification: 'interested',
        activeFollowUpId: 'follow-up-1',
        activeFollowUpStatus: 'pending',
        version: 1,
      },
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: {
        classification: 'interested',
        confidence: 'high',
        valid_dialogue: true,
        reason: '客户明确希望了解产品',
        evidence: ['客户：请发我产品资料'],
        evidence_conflict: false,
      },
      classificationRequiresReview: false,
      classificationReviewStatus: null,
      analysisRetryCount: 0,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });

    expect(
      within(detailDrawer).getByRole('button', { name: '修改分类' }),
    ).toBeTruthy();
    expect(
      within(detailDrawer).getByRole('button', { name: '查看回访任务' }),
    ).toBeTruthy();
    expect(
      within(detailDrawer).queryByRole('button', { name: '安排回访' }),
    ).toBeNull();
  });

  it('关联跟进已展示同一任务时不重复展示回访任务', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: null,
      followUpData: {
        id: 'data-1',
        classification: 'interested',
        activeFollowUpId: 'follow-up-1',
        activeFollowUpStatus: 'pending',
        version: 1,
      },
      followUp: {
        id: 'follow-up-1',
        status: 'pending',
        reason: '客户要求继续跟进',
      },
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });

    expect(within(detailDrawer).getByText('关联跟进')).toBeTruthy();
    expect(
      within(detailDrawer).getByRole('button', { name: '查看跟进任务' }),
    ).toBeTruthy();
    expect(within(detailDrawer).queryByText('当前回访任务')).toBeNull();
    expect(
      within(detailDrawer).queryByRole('button', { name: '查看回访任务' }),
    ).toBeNull();
    expect(
      within(detailDrawer).getByRole('button', { name: '修改分类' }),
    ).toBeTruthy();
  });

  it('没有 AI 分析时复用现有接口修改分类', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: null,
      followUpData: {
        id: 'data-1',
        classification: 'nurturing',
        latestConclusion: '客户希望下周再联系',
        version: 1,
      },
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    fireEvent.click(
      within(detailDrawer).getByRole('button', { name: '修改分类' }),
    );
    const modalTitle = await screen.findByText('修改分类', {
      selector: '.ant-modal-title',
    });
    const modal = modalTitle.closest('[role="dialog"]') as HTMLElement;
    fireEvent.click(within(modal).getByRole('button', { name: '确认修改' }));

    await waitFor(() =>
      expect(adjustFollowUpDataClassification).toHaveBeenCalledWith(
        'data-1',
        expect.objectContaining({
          classification: 'nurturing',
          reason: '客户希望下周再联系',
          conclusion: '客户希望下周再联系',
          expectedVersion: 1,
        }),
      ),
    );
  });

  it('普通浏览器测试不展示人工跟进确认操作', async () => {
    const browserTestRecord = {
      ...mockRecord,
      taskId: null,
      targetId: null,
      entryType: 'web',
    };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [browserTestRecord],
      total: 1,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: browserTestRecord,
      executionConfig: null,
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: {
        classification: 'interested',
        confidence: 'low',
        valid_dialogue: true,
        reason: '客户询问产品演示',
      },
      classificationRequiresReview: true,
      analysisRetryCount: 0,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });

    expect(
      within(detailDrawer).queryByRole('button', { name: '采纳 AI 分类' }),
    ).toBeNull();
  });

  it('正式外呼列表展示话后状态并为摘要提供完整内容悬浮提示', async () => {
    const summary =
      '客户对智能外呼服务感兴趣，主动提出转人工，并在人工环节询问试用、收费和联系方式，最后同意后续联系。';
    const outboundRecord = {
      ...mockRecord,
      entryType: 'outbound',
      summary: `）。${summary}`,
      analysisStatus: '2',
      customerIntent: 'positive',
      classificationReviewStatus: 'suggested',
    };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [outboundRecord],
      total: 1,
    });

    render(<AiCallRecordsPage />);

    const summaryNode = await screen.findByText(summary);
    await waitFor(() => expect(summaryNode.style.webkitLineClamp).toBe('2'));
    fireEvent.mouseEnter(summaryNode);
    expect((await screen.findByRole('tooltip')).textContent).toBe(summary);
    expect(screen.queryByText(/^）。/)).toBeNull();
    expect(screen.getByText('正向')).toBeTruthy();
    expect(screen.getByText('建议复核')).toBeTruthy();
  });

  it('继承外呼统计下钻的正式来源、结果和右开时间范围', async () => {
    mockSearchParams = new URLSearchParams({
      entryType: 'sip_outbound',
      formalOutboundOnly: 'true',
      callResult: 'connected',
      startedAtBegin: '2026-07-25T00:00:00+08:00',
      startedAtEnd: '2026-07-31T16:20:00+08:00',
    }).toString();

    render(<AiCallRecordsPage />);

    await waitFor(() =>
      expect(listAiCallRecords).toHaveBeenCalledWith({
        pageNum: 1,
        pageSize: 10,
        entryType: 'sip_outbound',
        formalOutboundOnly: true,
        callResult: 'connected',
        startedAtBegin: '2026-07-25T00:00:00+08:00',
        startedAtEnd: '2026-07-31T16:20:00+08:00',
      }),
    );
  });

  it('分层展示客户意向、分类复核和回访任务入口', async () => {
    const suggestedRecord = {
      ...mockRecord,
      callId: 'call-suggested',
      entryType: 'sip_outbound',
      analysisStatus: '2',
      customerIntent: 'positive',
      classificationReviewStatus: 'suggested',
      followUpId: null,
      followUpStatus: null,
    };
    const taskedRecord = {
      ...mockRecord,
      callId: 'call-tasked',
      entryType: 'sip_outbound',
      analysisStatus: '2',
      customerIntent: 'neutral',
      followUpSuggested: true,
      followUpId: 'follow-up-1',
      followUpStatus: 'pending',
    };
    const mockPostCallRecord = {
      ...mockRecord,
      callId: 'call-mock',
      entryType: 'outbound_mock',
      analysisStatus: '2',
      customerIntent: 'positive',
      followUpSuggested: true,
    };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [suggestedRecord, taskedRecord, mockPostCallRecord],
      total: 3,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: suggestedRecord,
      executionConfig: null,
    });

    render(<AiCallRecordsPage />);

    expect(await screen.findByText('正向')).toBeTruthy();
    expect(screen.getByText('中性')).toBeTruthy();
    expect(screen.getByText('建议复核')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /建议复核/ }));
    await waitFor(() =>
      expect(getAiCallRecordDetail).toHaveBeenCalledWith('call-suggested'),
    );

    fireEvent.click(screen.getByRole('button', { name: /待处理/ }));
    expect(history.push).toHaveBeenCalledWith(
      '/ai-call/follow-up-overview?followUpId=follow-up-1',
    );
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(2);
  });

  it('模拟执行记录不会展示成真实电话已接通', async () => {
    const outboundMockRecord = {
      ...mockRecord,
      entryType: 'outbound_mock',
      answeredAt: '2026-07-27T03:13:09',
      endReason: 'connected',
    };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [outboundMockRecord],
      total: 1,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: outboundMockRecord,
      executionConfig: null,
    });

    render(<AiCallRecordsPage />);

    expect(await screen.findByText('模拟执行完成')).toBeTruthy();
    expect(screen.queryByText('已接通')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));

    const drawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(within(drawer).getByText('模拟执行')).toBeTruthy();
    expect(within(drawer).getAllByText('模拟执行完成')).toHaveLength(2);
    expect(within(drawer).getByText('不适用（模拟执行）')).toBeTruthy();
    expect(within(drawer).queryByText('connected')).toBeNull();
  });

  it('模拟失败记录区分忙线、无人接听和呼叫失败', async () => {
    const mockFailureRecords = [
      {
        ...mockRecord,
        id: 'mock-busy',
        callId: 'mock-busy',
        entryType: 'outbound_mock',
        status: 'failed',
        callResult: 'busy',
        endReason: 'busy',
        failureMessage: '模拟拨打结果：busy',
        answeredAt: null,
      },
      {
        ...mockRecord,
        id: 'mock-no-answer',
        callId: 'mock-no-answer',
        entryType: 'outbound_mock',
        status: 'failed',
        callResult: 'no_answer',
        endReason: 'no_answer',
        failureMessage: '模拟拨打结果：no_answer',
        answeredAt: null,
      },
      {
        ...mockRecord,
        id: 'mock-call-failed',
        callId: 'mock-call-failed',
        entryType: 'outbound_mock',
        status: 'failed',
        callResult: 'call_failed',
        endReason: 'call_failed',
        failureMessage: '模拟拨打结果：call_failed',
        answeredAt: null,
      },
    ];
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: mockFailureRecords,
      total: mockFailureRecords.length,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockFailureRecords[0],
      executionConfig: null,
    });

    render(<AiCallRecordsPage />);

    expect(await screen.findByText('模拟：忙线')).toBeTruthy();
    expect(screen.getByText('模拟：无人接听')).toBeTruthy();
    expect(screen.getByText('模拟：呼叫失败')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: '查看详情' })[0]);
    const drawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(within(drawer).getByText('模拟执行失败')).toBeTruthy();
    expect(within(drawer).getByText('模拟：忙线')).toBeTruthy();
  });

  it('未接通时不把空房间录音展示为通话录音', async () => {
    const failedRecord = {
      ...mockRecord,
      entryType: 'sip_outbound',
      callResult: 'call_failed',
      status: 'completed',
      answeredAt: null,
    };
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: failedRecord,
      executionConfig: null,
    });
    (getAiCallRecordRecording as jest.Mock).mockResolvedValue({
      id: 'empty-room-recording',
      callId: 'call-1',
      status: 'completed',
      durationMs: 300078,
      playUrl: 'https://example.com/empty-room.mp3',
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));
    const drawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });

    expect(within(drawer).getByText('未接通，无有效通话录音')).toBeTruthy();
    expect(within(drawer).getByText('呼叫耗时')).toBeTruthy();
    expect(
      within(drawer).getByTestId('recording-player').querySelector('audio'),
    ).toBeNull();
  });

  it('详情使用业务化中文展示分析结果、录音和对话', async () => {
    (getAiCallRecordRecording as jest.Mock).mockResolvedValue({
      id: 'recording-1',
      callId: 'call-1',
      status: 'completed',
      playUrl: 'https://example.com/call-1.mp3',
    });
    (getAiCallRecordDialogue as jest.Mock).mockResolvedValue({
      rows: [
        {
          id: 'segment-0',
          callId: 'call-1',
          segmentNo: 0,
          speakerType: 'ai',
          text: '您好，请问现在方便沟通吗？',
          segmentStatus: 'final',
        },
        {
          id: 'segment-1',
          callId: 'call-1',
          segmentNo: 1,
          speakerType: 'customer',
          text: '我需要人工协助',
          segmentStatus: 'final',
        },
      ],
      total: 1,
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: {
        summary: '客户希望进一步了解产品价格。',
        follow_up: {
          required: true,
          consent: 'explicit',
          preferred_time: '明天下午',
        },
        feedback_type: '负向',
        key_points: ['客户要求转人工', '客户关注产品价格'],
        time_hint: {
          time_text: '明天下午',
          original_texts: ['明天下午再联系'],
        },
        tags: ['价格敏感', '需要跟进'],
        customer_intent: 'positive',
        classification: 'interested',
        reason: '客户明确表达了解产品价格的意向',
        evidence: ['客户：希望进一步了解产品价格'],
        confidence: 'high',
        evidence_conflict: false,
      },
      analysisRetryCount: 0,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    expect(await screen.findByText('call-1')).toBeTruthy();
    expect(screen.getByText('正式外呼任务')).toBeTruthy();
    expect(screen.getByText('录音与对话')).toBeTruthy();
    expect(screen.getByText('我需要人工协助')).toBeTruthy();
    expect(getAiCallRecordRecording).toHaveBeenCalledWith('call-1');
    expect(getAiCallRecordDialogue).toHaveBeenCalledWith('call-1');
    expect(
      screen
        .getByTestId('recording-player')
        .querySelector('audio')
        ?.getAttribute('controlslist'),
    ).toBe('nodownload');
    expect(screen.getAllByText('通话摘要').length).toBeGreaterThan(0);
    expect(screen.getByText('客户态度（AI）')).toBeTruthy();
    expect(screen.queryByText('关键要点')).toBeNull();
    expect(screen.getByText('客户确认联系时间')).toBeTruthy();
    expect(screen.queryByText('联系时间', { exact: true })).toBeNull();
    expect(screen.getByText('分析标签')).toBeTruthy();
    const detailDrawer = screen.getByRole('dialog', {
      name: '通话记录详情',
    });
    const analysisSection = within(detailDrawer).getByTestId(
      'analysis-result-section',
    );
    expect(within(detailDrawer).getByText('客户意向')).toBeTruthy();
    expect(within(analysisSection).getByText('AI 建议分类')).toBeTruthy();
    expect(within(detailDrawer).getByText('分类原因')).toBeTruthy();
    expect(within(detailDrawer).getByText('判断依据')).toBeTruthy();
    expect(within(detailDrawer).getByText('分类置信度')).toBeTruthy();
    expect(
      within(detailDrawer).getByText('客户明确表达了解产品价格的意向'),
    ).toBeTruthy();
    expect(
      within(detailDrawer).getByText('客户：希望进一步了解产品价格'),
    ).toBeTruthy();
    expect(screen.getByText('负向').closest('.ant-tag')).toBeTruthy();
    expect(screen.queryByText('客户要求转人工')).toBeNull();
    expect(screen.getAllByText('明天下午')).toHaveLength(2);
    expect(screen.getByText('价格敏感').closest('.ant-tag')).toBeTruthy();
    expect(screen.getByText('执行配置')).toBeTruthy();
    expect(screen.getByText('新品回访提示词')).toBeTruthy();
    expect(screen.getByText('芊悦')).toBeTruthy();
    expect(screen.queryByText('芊悦（Cherry）')).toBeNull();
    expect(screen.getByText('工作日规则')).toBeTruthy();
    expect(screen.queryByText(/技术事件/)).toBeNull();
    expect(getAiCallRecordEvents).not.toHaveBeenCalled();
  });

  it('客户未确认 AI 提议的联系时间时显示未确认', async () => {
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: {
        summary: '客户询问服务效果。',
        follow_up: {
          required: true,
          consent: 'missing',
          preferred_time: null,
        },
        time_hint: { time_text: '一个小时后' },
      },
      analysisRetryCount: 0,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    const resultLabel = await screen.findByText('结束原因');
    expect(resultLabel.style.color).toBe('rgb(31, 31, 31)');
    expect(screen.getByText('客户确认联系时间').style.color).toBe(
      'rgb(31, 31, 31)',
    );
    expect(
      screen.getByText('客户未确认（检测到时间线索：一个小时后）'),
    ).toBeTruthy();
    expect(screen.getByTestId('recording-player')).toBeTruthy();
  });

  it('空的结构化时间线索只显示客户未确认', async () => {
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: {
        summary: '客户询问服务效果。',
        time_hint: { time_text: '', time_value: '', original_texts: [] },
      },
      analysisRetryCount: 0,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    expect(await screen.findByText('客户未确认')).toBeTruthy();
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
  });

  it('缺少执行快照时使用紧凑且准确的历史数据提示', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: null,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    expect(await screen.findByText('未保存执行配置快照')).toBeTruthy();
    expect(screen.queryByText('暂无执行配置快照')).toBeNull();
  });

  it('详情展示转人工后的完整对话和客户分类判断', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: null,
      followUpData: {
        id: 'data-1',
        classification: 'nurturing',
        latestConclusion: '转人工等待超时，继续跟进',
        version: 1,
      },
    });
    (getAiCallRecordDialogue as jest.Mock).mockResolvedValue({
      rows: [
        {
          id: 'human-1',
          callId: 'call-1',
          segmentNo: 1,
          speakerType: 'human_agent',
          text: '我们可以安排试用。',
          segmentStatus: 'final',
        },
        {
          id: 'customer-1',
          callId: 'call-1',
          segmentNo: 2,
          speakerType: 'customer',
          text: '好的，可以。',
          segmentStatus: 'final',
        },
      ],
      total: 2,
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: {
        summary: '）。客户主动提出转人工，随后对话偏离业务主题。',
        classification: 'low_value',
        low_value_reason: 'non_target_customer',
        valid_dialogue: true,
        follow_up: {
          required: true,
          consent: 'explicit',
          reason: '客户同意后续回访',
          preferred_time: null,
          confidence: 'high',
        },
        reason: '客户未确认后续需求',
        evidence: ['客户：好的，可以。'],
        confidence: 'high',
        evidence_conflict: false,
      },
      classificationRequiresReview: true,
      classificationReviewStatus: 'suggested',
      analysisRetryCount: 0,
    });
    (getAiCallRecordHandoffs as jest.Mock).mockResolvedValue({
      rows: [
        {
          handoffId: 'handoff-1',
          status: 'expired',
          requestReason: 'customer_request',
          humanAgentIdentity: 'agent-admin',
          failureMessage: '当前场景没有在线可接范围坐席',
        },
      ],
      total: 1,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    const customerFollowUpSection = within(detailDrawer).getByTestId(
      'customer-follow-up-section',
    );
    const analysisSection = within(detailDrawer).getByTestId(
      'analysis-result-section',
    );
    const handoffSection = within(detailDrawer).getByTestId(
      'handoff-result-section',
    );
    expect(within(detailDrawer).getByText('我们可以安排试用。')).toBeTruthy();
    expect(within(detailDrawer).getByText('好的，可以。')).toBeTruthy();
    expect(
      within(customerFollowUpSection).getByText('当前业务分类'),
    ).toBeTruthy();
    expect(within(customerFollowUpSection).getByText('持续跟进')).toBeTruthy();
    expect(
      within(customerFollowUpSection).getByText('AI 建议分类'),
    ).toBeTruthy();
    expect(within(customerFollowUpSection).getByText('低价值')).toBeTruthy();
    expect(
      within(customerFollowUpSection).getByText(
        'AI 建议分类与当前业务分类不一致，请在下方保留、采纳或修改分类，完成人工复核。',
      ),
    ).toBeTruthy();
    expect(
      within(customerFollowUpSection).getByRole('button', {
        name: '保留当前分类',
      }),
    ).toBeTruthy();
    expect(
      within(customerFollowUpSection).getByRole('button', {
        name: '采纳 AI 分类',
      }),
    ).toBeTruthy();
    expect(
      within(customerFollowUpSection).getByRole('button', {
        name: '修改分类',
      }),
    ).toBeTruthy();
    expect(
      within(customerFollowUpSection).queryByRole('button', {
        name: '安排回访',
      }),
    ).toBeNull();
    expect(within(analysisSection).getByText('AI 建议分类')).toBeTruthy();
    expect(within(analysisSection).getByText('低价值')).toBeTruthy();
    expect(
      within(analysisSection).getByText(
        '客户主动提出转人工，随后对话偏离业务主题。',
      ),
    ).toBeTruthy();
    expect(within(analysisSection).queryByText(/^）。/)).toBeNull();
    expect(
      within(analysisSection).getByText('客户未确认后续需求'),
    ).toBeTruthy();
    expect(within(analysisSection).getByText('后续跟进建议')).toBeTruthy();
    const followUpSuggestion =
      within(analysisSection).getByTestId('analysis-follow-up');
    expect(within(followUpSuggestion).getByText('需要跟进')).toBeTruthy();
    expect(within(followUpSuggestion).getByText('是')).toBeTruthy();
    expect(within(followUpSuggestion).getByText('客户同意')).toBeTruthy();
    expect(within(followUpSuggestion).getByText('明确同意')).toBeTruthy();
    expect(within(followUpSuggestion).getByText('原因')).toBeTruthy();
    expect(
      within(followUpSuggestion).getByText('客户同意后续回访'),
    ).toBeTruthy();
    expect(within(followUpSuggestion).getByText('期望时间')).toBeTruthy();
    expect(within(followUpSuggestion).getByText('未确认')).toBeTruthy();
    expect(within(followUpSuggestion).getByText('置信度')).toBeTruthy();
    expect(within(followUpSuggestion).getByText('高')).toBeTruthy();
    expect(
      Array.from(
        followUpSuggestion.querySelectorAll('.ant-descriptions-item-label'),
      ).map((label) => label.textContent),
    ).toEqual(['需要跟进', '客户同意', '期望时间', '置信度', '原因']);
    expect(within(analysisSection).getByText('有效业务对话')).toBeTruthy();
    expect(within(analysisSection).getByText('低价值原因')).toBeTruthy();
    expect(within(analysisSection).getByText('非目标客户')).toBeTruthy();
    expect(within(handoffSection).getByText('客户要求转人工')).toBeTruthy();
    expect(within(handoffSection).getByText('等待超时')).toBeTruthy();
    expect(
      await within(handoffSection).findByText('本地联调管理员'),
    ).toBeTruthy();
    expect(
      within(handoffSection).getByText('当前场景没有在线可接范围坐席'),
    ).toBeTruthy();
    expect(within(detailDrawer).queryByText('customer_request')).toBeNull();
  });

  it('将无在线坐席结束原因展示为完整中文业务说明', async () => {
    const record = { ...mockRecord, endReason: 'no_online_agent' };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [record],
      total: 1,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record,
      executionConfig: null,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(
      within(detailDrawer).getByText('无在线坐席，转人工失败后结束'),
    ).toBeTruthy();
    expect(within(detailDrawer).queryByText('no_online_agent')).toBeNull();
  });

  it('详情将外呼记录关键枚举和分区间距展示为业务化中文', async () => {
    const outboundRecord = {
      ...mockRecord,
      entryType: 'outbound',
      businessType: 'outbound_attempt',
      endReason: 'handoff_timeout',
    };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [outboundRecord],
      total: 1,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: outboundRecord,
      executionConfig: null,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(within(detailDrawer).getByText('外呼')).toBeTruthy();
    expect(within(detailDrawer).getByText('外呼通话')).toBeTruthy();
    expect(within(detailDrawer).getByText('转人工等待超时')).toBeTruthy();
    expect(
      within(detailDrawer).getByTestId('call-detail-sections').style.gap,
    ).toBe('32px');
    expect(within(detailDrawer).queryByText('outbound')).toBeNull();
    expect(within(detailDrawer).queryByText('outbound_attempt')).toBeNull();
    expect(within(detailDrawer).queryByText('handoff_timeout')).toBeNull();
  });

  it('将 SIP 参与方离开转换为中文结束结果', async () => {
    const record = {
      ...mockRecord,
      endReason: 'sip_participant_left',
    };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [record],
      total: 1,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record,
      executionConfig: null,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(
      within(detailDrawer).getByText('通话已结束（挂断方未确认）'),
    ).toBeTruthy();
    expect(within(detailDrawer).queryByText('sip_participant_left')).toBeNull();
  });

  it('详情将浏览器断开和业务场景展示为中文，并区分分析标签样式', async () => {
    const record = {
      ...mockRecord,
      endReason: 'browser_disconnect',
      sceneCode: 'intro_geo',
    };
    (listAiCallRecords as jest.Mock).mockResolvedValue({
      rows: [record],
      total: 1,
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record,
      executionConfig: {
        promptProfileId: 'prompt-1',
        promptName: '新品回访提示词',
        sceneCode: 'intro_geo',
        voice: 'Cherry',
        voiceName: '芊悦',
        ruleName: '工作日规则',
      },
      exceptionHandling: {
        category: 'no_answer',
        status: 'WAITING',
        originalAttemptCount: 2,
        retryCount: 1,
        maxRetryCount: 3,
        lastResult: 'busy',
      },
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: { tags: ['试用意向初显', '低互动意愿'] },
      analysisRetryCount: 0,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(within(detailDrawer).getByText('浏览器连接断开')).toBeTruthy();
    expect(within(detailDrawer).getAllByText('GEO 产品介绍')).toHaveLength(2);
    expect(within(detailDrawer).queryByText('browser_disconnect')).toBeNull();
    expect(within(detailDrawer).queryByText('intro_geo')).toBeNull();
    expect(within(detailDrawer).getByText('异常处理状态')).toBeTruthy();
    expect(within(detailDrawer).getByText('等待执行')).toBeTruthy();
    expect(within(detailDrawer).getByText('异常重呼进度')).toBeTruthy();
    expect(within(detailDrawer).getByText('1/3')).toBeTruthy();
    expect(within(detailDrawer).getByText('忙线')).toBeTruthy();
    expect(
      within(detailDrawer).getByText('试用意向初显').closest('.ant-tag')
        ?.className,
    ).toContain('ant-tag-green');
    expect(
      within(detailDrawer).getByText('低互动意愿').closest('.ant-tag')
        ?.className,
    ).toContain('ant-tag-orange');
  });

  it('有通话摘要时不重复展示关键要点', async () => {
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: {
        summary:
          '客户对智能客服方案表示感兴趣，并在人工环节询问了产品能力和收费方式，最后接受了试用安排并留下联系方式。',
        key_points: [
          '询问 CU 能力',
          '关注收费方式',
          '接受试用安排',
          '留下联系方式',
        ],
        classification: 'interested',
        reason: '客户接受试用安排并同意后续联系',
        evidence: ['接受试用安排', '留下联系方式'],
        confidence: 'medium',
        evidence_conflict: false,
      },
      analysisRetryCount: 0,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    const analysisSection = within(detailDrawer).getByTestId(
      'analysis-result-section',
    );
    const summary = within(detailDrawer).getByTestId('analysis-summary');
    expect(summary).toBeTruthy();
    expect(summary.textContent).toContain('留下联系方式');
    expect(within(detailDrawer).queryByText('询问 CU 能力')).toBeNull();
    expect(within(detailDrawer).queryByText('关注收费方式')).toBeNull();
    expect(within(detailDrawer).getAllByText('接受试用安排')).toHaveLength(1);
    expect(within(detailDrawer).getAllByText('留下联系方式')).toHaveLength(1);
    expect(within(detailDrawer).queryByText('其余 1 条')).toBeNull();
    expect(
      within(analysisSection).getByText('有意向').closest('.ant-tag'),
    ).toBeTruthy();
  });

  it('没有通话摘要时使用关键要点兜底', async () => {
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: { key_points: ['客户询问产品价格'] },
      analysisRetryCount: 0,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    const drawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(within(drawer).getByText('关键要点')).toBeTruthy();
    expect(within(drawer).getByText('客户询问产品价格')).toBeTruthy();
  });

  it('坐席话后处置不替换客户分类、AI 分析和转人工结果', async () => {
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: mockRecord,
      executionConfig: null,
      followUpData: {
        id: 'data-1',
        classification: 'nurturing',
        activeFollowUpId: '342941293734035456',
        activeFollowUpStatus: 'pending',
        version: 1,
      },
      afterCallWork: {
        agentIdentity: 'agent-admin',
        classification: 'nurturing',
        summary: '安排产品顾问继续跟进试用方案',
        needsFollowUp: true,
        submittedAt: '2026-08-04T08:06:15Z',
      },
      followUp: {
        id: '342941293734035456',
        status: 'pending',
        reason: '人工通话后续跟进',
      },
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: {
        classification: 'nurturing',
        reason: '客户有初步兴趣，但未约定下一步',
      },
      analysisRetryCount: 0,
    });

    render(<AiCallRecordsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '查看详情' }));

    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(
      within(detailDrawer).getByTestId('customer-follow-up-section'),
    ).toBeTruthy();
    expect(
      within(detailDrawer).getByTestId('analysis-result-section'),
    ).toBeTruthy();
    expect(
      within(detailDrawer).getByTestId('handoff-result-section'),
    ).toBeTruthy();
    expect(within(detailDrawer).getByText('坐席最终处置')).toBeTruthy();
    expect(within(detailDrawer).getAllByText('持续跟进')).not.toHaveLength(0);
    expect(
      within(detailDrawer).getByText('安排产品顾问继续跟进试用方案'),
    ).toBeTruthy();
    expect(within(detailDrawer).getByText('待处理')).toBeTruthy();
    expect(within(detailDrawer).getByText('人工通话后续跟进')).toBeTruthy();
    expect(
      within(detailDrawer).getByText('客户有初步兴趣，但未约定下一步'),
    ).toBeTruthy();
    expect(
      await within(detailDrawer).findByText('本地联调管理员'),
    ).toBeTruthy();
    expect(within(detailDrawer).queryByText('AI 分析与转人工')).toBeNull();
    expect(within(detailDrawer).queryByText('无需跟进')).toBeNull();

    fireEvent.click(within(detailDrawer).getByText('查看跟进任务'));
    expect(history.push).toHaveBeenCalledWith(
      '/ai-call/follow-up-overview?followUpId=342941293734035456',
    );
  });

  it('从通话记录打开详情时只展示所属跟进任务', async () => {
    mockSearchParams = 'callId=call-callback-1';
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: {
        ...mockRecord,
        callId: 'call-callback-1',
        entryType: 'sip_callback',
      },
      executionConfig: null,
      followUp: {
        id: 'follow-up-1',
        status: 'processing',
        reason: '客户要求人工进一步介绍',
        sourceCallId: 'call-original-1',
        sourceRecord: {
          ...mockRecord,
          callId: 'call-original-1',
          entryType: 'owner_runtime',
        },
        callbackRecords: [
          {
            ...mockRecord,
            id: '2',
            callId: 'call-callback-1',
            entryType: 'sip_callback',
          },
        ],
      },
    });

    render(<AiCallRecordsPage />);

    const detailDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(getAiCallRecordDetail).toHaveBeenCalledWith('call-callback-1');
    expect(within(detailDrawer).getByText('关联跟进')).toBeTruthy();
    expect(
      within(detailDrawer).getByText('客户要求人工进一步介绍'),
    ).toBeTruthy();
    expect(within(detailDrawer).queryByText('原始通话')).toBeNull();
    expect(within(detailDrawer).queryByText('历次回拨')).toBeNull();
    expect(
      within(detailDrawer).getByTestId('customer-follow-up-section').hidden,
    ).toBe(true);
    expect(
      within(detailDrawer).getByTestId('analysis-result-section').hidden,
    ).toBe(true);
    expect(
      within(detailDrawer).getByTestId('handoff-result-section').hidden,
    ).toBe(true);
  });

  it('从跟进次要入口进入时只筛选单条记录且不自动展开详情', async () => {
    mockSearchParams = 'callId=call-1&view=list';

    render(<AiCallRecordsPage />);

    await waitFor(() =>
      expect(listAiCallRecords).toHaveBeenCalledWith(
        expect.objectContaining({ callId: 'call-1' }),
      ),
    );
    expect(getAiCallRecordDetail).not.toHaveBeenCalled();
  });
});

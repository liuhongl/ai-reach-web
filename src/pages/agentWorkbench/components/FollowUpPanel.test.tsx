import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import dayjs from 'dayjs';
import * as React from 'react';
import {
  getAiCallRecordDetail,
  getAiCallRecordDialogue,
  getAiCallRecordHandoffs,
  getAiCallRecordRecording,
  getAiCallRecordSemanticAnalysis,
} from '@/pages/aiCallRecords/service';
import FollowUpPanel, { isFutureFollowUpTime } from './FollowUpPanel';

jest.mock('@/pages/aiCallRecords/service', () => ({
  getAiCallRecordDetail: jest.fn(),
  getAiCallRecordDialogue: jest.fn(),
  getAiCallRecordHandoffs: jest.fn(),
  getAiCallRecordRecording: jest.fn(),
  getAiCallRecordSemanticAnalysis: jest.fn(),
}));

const unanswered = {
  id: '1',
  source_type: 'handoff_unanswered' as const,
  source_call_id: 'call-1',
  source_handoff_id: 'handoff-1',
  scene_code: 'intro_geo' as const,
  customer_name: '张三',
  task_name: 'GEO 产品回访',
  masked_contact: '138****0000',
  owner_agent_identity: null,
  status: 'pending' as const,
  follow_up_reason: '等待超时未接入人工',
  customer_callback_at: null,
  created_at: '2026-07-22T08:00:00Z',
};

const createServices = () => ({
  list: jest
    .fn()
    .mockResolvedValue({ code: 200, data: { rows: [unanswered], total: 1 } }),
  claim: jest.fn().mockResolvedValue({
    code: 200,
    data: { ...unanswered, owner_agent_identity: 'agent-1' },
  }),
  call: jest.fn().mockResolvedValue({
    code: 200,
    data: {
      call_id: 'callback-1',
      status: 'accepted',
      livekit_url: 'wss://livekit.example.com',
      participant_token: 'callback-token',
      participant_identity: 'human-callback-callback-1',
      expires_in_seconds: 60,
    },
  }),
  detail: jest.fn().mockResolvedValue({ code: 200, data: unanswered }),
  submitResult: jest.fn().mockResolvedValue({ code: 200 }),
});

describe('FollowUpPanel', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('将任务队列 Tab 放在独立的视觉切换条中', async () => {
    const services = createServices();
    render(<FollowUpPanel services={services} />);

    await screen.findAllByText('138****0000');
    expect(
      screen.getByRole('tablist').closest('.agent-follow-up-scope-tabs'),
    ).toBeTruthy();
  });

  it('展示待认领和我的跟进的实时数量', async () => {
    const services = createServices();
    services.list.mockImplementation((params) => {
      if (params?.pageSize === 1 && params.ownership === 'unassigned') {
        return Promise.resolve({ code: 200, data: { rows: [], total: 3 } });
      }
      if (params?.pageSize === 1 && params.ownership === 'mine') {
        return Promise.resolve({ code: 200, data: { rows: [], total: 6 } });
      }
      return Promise.resolve({
        code: 200,
        data: { rows: [unanswered], total: 3 },
      });
    });

    render(<FollowUpPanel services={services} />);

    expect(await screen.findByText('3', { exact: true })).toBeTruthy();
    expect(screen.getByText('6', { exact: true })).toBeTruthy();
    expect(services.list).toHaveBeenCalledWith({
      pageNum: 1,
      pageSize: 1,
      ownership: 'unassigned',
      status: ['pending'],
    });
    expect(services.list).toHaveBeenCalledWith({
      pageNum: 1,
      pageSize: 1,
      ownership: 'mine',
    });
  });

  it('atomically claims an unanswered callback only once', async () => {
    const services = createServices();
    render(<FollowUpPanel services={services} />);
    expect(await screen.findByText('138****0000')).toBeTruthy();
    const claim = screen.getByRole('button', { name: '认领回访' });
    fireEvent.click(claim);
    fireEvent.click(claim);
    await waitFor(() => expect(services.claim).toHaveBeenCalledTimes(1));
  });

  it('keeps the unassigned queue focused on claimable work', async () => {
    const services = createServices();
    render(<FollowUpPanel services={services} />);

    expect(await screen.findByText('138****0000')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '客户' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '所属任务' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '创建时间' })).toBeTruthy();
    expect(screen.getByLabelText('客户姓名')).toBeTruthy();
    expect(screen.queryByLabelText('业务场景')).toBeNull();
    expect(screen.queryByLabelText('回访状态')).toBeNull();
    expect(screen.queryByLabelText('回访来源')).toBeNull();
    expect(
      screen.queryByRole('columnheader', { name: '最近联系结果' }),
    ).toBeNull();
    expect(screen.queryByRole('columnheader', { name: '回访状态' })).toBeNull();
    expect(screen.getByRole('button', { name: /查\s*询/ })).toBeTruthy();
    expect(services.list).toHaveBeenCalledWith(
      expect.objectContaining({
        ownership: 'unassigned',
        pageNum: 1,
        pageSize: 10,
      }),
    );

    const callsBeforeSearch = services.list.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }));
    await waitFor(() =>
      expect(services.list.mock.calls.length).toBeGreaterThan(
        callsBeforeSearch,
      ),
    );
    expect(services.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['pending'], pageSize: 10 }),
    );

    fireEvent.click(screen.getByRole('button', { name: '认领回访' }));
    expect(
      await screen.findByText('回访任务认领成功，负责人已固定为当前坐席'),
    ).toBeTruthy();
    expect(
      document.querySelector('.agent-follow-up-panel > .ant-alert'),
    ).toBeNull();
  });

  it('claims a callback when HTTP does not provide randomUUID', async () => {
    const services = createServices();
    const originalRandomUUID = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    });

    try {
      render(<FollowUpPanel services={services} />);
      fireEvent.click(await screen.findByRole('button', { name: '认领回访' }));

      await waitFor(() =>
        expect(services.claim).toHaveBeenCalledWith(
          unanswered.id,
          expect.stringMatching(/^follow-up-/),
        ),
      );
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        configurable: true,
        value: originalRandomUUID,
      });
    }
  });

  it('shows a clear message when claiming a callback fails', async () => {
    const services = createServices();
    services.claim.mockRejectedValue(new Error('claim failed'));
    render(<FollowUpPanel services={services} />);

    fireEvent.click(await screen.findByRole('button', { name: '认领回访' }));

    expect(
      await screen.findByText('回访任务认领失败，请刷新后重试'),
    ).toBeTruthy();
  });

  it('shows accepted instead of connected after a callback request', async () => {
    const services = createServices();
    const onCallAccepted = jest.fn();
    services.list.mockResolvedValue({
      code: 200,
      data: {
        rows: [{ ...unanswered, owner_agent_identity: 'agent-1' }],
        total: 1,
      },
    });
    render(
      <FollowUpPanel
        services={services}
        callbackEnabled
        consoleSessionId="session-1"
        onCallAccepted={onCallAccepted}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));
    expect(await screen.findByText('138****0000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /呼叫客户/ }));
    expect(
      await screen.findByText('回拨任务已受理，等待最终通话状态'),
    ).toBeTruthy();
    expect(services.call).toHaveBeenCalledWith(
      unanswered.id,
      expect.objectContaining({ consoleSessionId: 'session-1' }),
    );
    expect(onCallAccepted).toHaveBeenCalledWith(
      expect.objectContaining({ call_id: 'callback-1' }),
      expect.objectContaining({ id: unanswered.id }),
    );
  });

  it('brings an offline agent online before calling the customer', async () => {
    const services = createServices();
    const onPrepareCallback = jest.fn().mockResolvedValue(true);
    services.list.mockResolvedValue({
      code: 200,
      data: {
        rows: [{ ...unanswered, owner_agent_identity: 'agent-1' }],
        total: 1,
      },
    });
    render(
      <FollowUpPanel
        agentStatus="offline"
        callbackEnabled
        consoleSessionId="session-1"
        onPrepareCallback={onPrepareCallback}
        services={services}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));
    const callbackButton = await screen.findByRole('button', {
      name: /上线并呼叫/,
    });
    expect(callbackButton.querySelector('.anticon-phone')).toBeNull();
    fireEvent.click(callbackButton);

    await waitFor(() => expect(onPrepareCallback).toHaveBeenCalledTimes(1));
    expect(services.call).toHaveBeenCalledWith(
      unanswered.id,
      expect.objectContaining({ consoleSessionId: 'session-1' }),
    );
  });

  it('renews an available agent lease before calling the customer', async () => {
    const services = createServices();
    const onPrepareCallback = jest.fn().mockResolvedValue(true);
    services.list.mockResolvedValue({
      code: 200,
      data: {
        rows: [{ ...unanswered, owner_agent_identity: 'agent-1' }],
        total: 1,
      },
    });
    render(
      <FollowUpPanel
        agentStatus="available"
        callbackEnabled
        consoleSessionId="session-1"
        onPrepareCallback={onPrepareCallback}
        services={services}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));
    fireEvent.click(await screen.findByRole('button', { name: /呼叫客户/ }));

    await waitFor(() => expect(onPrepareCallback).toHaveBeenCalledTimes(1));
    expect(onPrepareCallback.mock.invocationCallOrder[0]).toBeLessThan(
      services.call.mock.invocationCallOrder[0],
    );
  });

  it('opens the callback handling result with the canonical call result', async () => {
    const services = createServices();
    const task = {
      ...unanswered,
      owner_agent_identity: 'agent-1',
      status: 'processing' as const,
    };
    services.detail.mockResolvedValue({
      code: 200,
      data: {
        ...task,
        attempts: [
          {
            id: 'attempt-1',
            follow_up_id: task.id,
            agent_identity: 'agent-1',
            contact_channel: 'manual_phone',
            attempt_result: 'no_answer',
            related_call_id: 'callback-1',
            contacted_at: '2026-07-22T09:01:05Z',
          },
        ],
      },
    });
    const onHandlingTaskOpened = jest.fn();

    render(
      <FollowUpPanel
        handlingTaskToOpen={{ task, callId: 'callback-1' }}
        onHandlingTaskOpened={onHandlingTaskOpened}
        services={services}
      />,
    );

    expect(
      await screen.findByRole('dialog', { name: '提交处理结果' }),
    ).toBeTruthy();
    expect(services.detail).toHaveBeenCalledWith(task.id);
    expect(screen.getByText('无人接听')).toBeTruthy();
    expect(
      (screen.getByLabelText('处理备注') as HTMLTextAreaElement).value,
    ).toBe('本次回拨未接通');
    expect(
      screen.getByLabelText('联系结果').closest('.ant-select')?.className,
    ).toContain('ant-select-disabled');
    expect(onHandlingTaskOpened).toHaveBeenCalledTimes(1);
  });

  it('does not guess a callback result while the canonical attempt is missing', async () => {
    const services = createServices();
    const task = {
      ...unanswered,
      owner_agent_identity: 'agent-1',
      status: 'processing' as const,
    };
    services.detail.mockResolvedValue({ code: 200, data: task });

    render(
      <FollowUpPanel
        handlingTaskToOpen={{ task, callId: 'callback-1' }}
        services={services}
      />,
    );

    expect(
      await screen.findByText('本次回拨结果尚未生成，请刷新后重试'),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: '提交处理结果' })).toBeNull();
  });

  it('keeps system callback hidden until the real callback capability is enabled', async () => {
    const services = createServices();
    services.list.mockResolvedValue({
      code: 200,
      data: {
        rows: [{ ...unanswered, owner_agent_identity: 'agent-1' }],
        total: 1,
      },
    });

    render(<FollowUpPanel services={services} />);
    await screen.findAllByText('138****0000');
    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));
    expect(await screen.findByText('138****0000')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /呼叫客户/ })).toBeNull();
  });

  it('separates unassigned work from tasks owned by the current agent', async () => {
    const services = createServices();
    const mine = {
      ...unanswered,
      id: '2',
      masked_contact: '139****0000',
      owner_agent_identity: 'agent-1',
      status: 'processing' as const,
    };
    services.list.mockImplementation(async (params) => ({
      code: 200,
      data: {
        rows: params?.ownership === 'mine' ? [mine] : [unanswered],
        total: 1,
      },
    }));

    render(<FollowUpPanel services={services} />);
    expect(await screen.findByText('138****0000')).toBeTruthy();
    expect(screen.queryByText('139****0000')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));
    expect(await screen.findByText('139****0000')).toBeTruthy();
    expect(screen.queryByText('138****0000')).toBeNull();
  });

  it('does not offer a handling result while the agent is in a callback', async () => {
    const services = createServices();
    services.list.mockResolvedValue({
      code: 200,
      data: {
        rows: [
          {
            ...unanswered,
            owner_agent_identity: 'agent-1',
            status: 'processing',
          },
        ],
        total: 1,
      },
    });

    render(<FollowUpPanel agentStatus="in_call" services={services} />);
    await screen.findAllByText('138****0000');
    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));
    expect(await screen.findByText('张三')).toBeTruthy();
    expect(screen.getByText('GEO 产品回访')).toBeTruthy();
    expect(screen.getByText('处理中')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '提交处理结果' })).toBeNull();
    expect(screen.queryByRole('button', { name: '登记联系结果' })).toBeNull();
    expect(screen.queryByRole('button', { name: '完成任务' })).toBeNull();
    expect(screen.queryByRole('button', { name: '关闭任务' })).toBeNull();
  });

  it('offers a handling result for a processing non-phone follow-up', async () => {
    const services = createServices();
    services.list.mockResolvedValue({
      code: 200,
      data: {
        rows: [
          {
            ...unanswered,
            source_type: 'ai_post_call',
            owner_agent_identity: 'agent-1',
            status: 'processing',
          },
        ],
        total: 1,
      },
    });

    render(<FollowUpPanel agentStatus="available" services={services} />);
    await screen.findAllByText('138****0000');
    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));

    expect(
      await screen.findByRole('button', { name: '提交处理结果' }),
    ).toBeTruthy();
  });

  it('shows the status filter and terminal tasks in my follow-ups', async () => {
    const services = createServices();
    services.list.mockImplementation(async (params) => ({
      code: 200,
      data:
        params?.ownership === 'mine'
          ? {
              rows: [
                {
                  ...unanswered,
                  owner_agent_identity: 'agent-1',
                  status: 'completed',
                },
                {
                  ...unanswered,
                  id: '2',
                  owner_agent_identity: 'agent-1',
                  status: 'closed',
                },
              ],
              total: 2,
            }
          : { rows: [unanswered], total: 1 },
    }));

    render(<FollowUpPanel services={services} />);
    await screen.findByText('138****0000');
    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));

    expect(await screen.findByText('已办结')).toBeTruthy();
    expect(screen.getByText('已终止')).toBeTruthy();
    expect(screen.getByLabelText('回访状态')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /呼叫客户/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '提交处理结果' })).toBeNull();
    expect(services.list).toHaveBeenCalledWith(
      expect.objectContaining({ ownership: 'mine', status: undefined }),
    );
  });

  it('uses a task table and opens the selected task details', async () => {
    const services = createServices();
    render(<FollowUpPanel services={services} />);

    expect(await screen.findByRole('table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '客户' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '操作' })).toBeTruthy();

    expect(await screen.findByText('138****0000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    const drawer = await screen.findByRole('dialog', {
      name: '跟进任务详情',
    });
    expect(within(drawer).getByText('等待超时未接入人工')).toBeTruthy();
    expect(within(drawer).getByText('未约定回访时间')).toBeTruthy();
  });

  it('shows one related timeline and a human callback detail in the same drawer', async () => {
    const services = createServices();
    services.list.mockResolvedValue({
      code: 200,
      data: {
        rows: [{ ...unanswered, owner_agent_identity: 'agent-1' }],
        total: 1,
      },
    });
    services.detail.mockResolvedValue({
      code: 200,
      data: {
        ...unanswered,
        owner_agent_identity: 'agent-1',
        source_record: {
          id: 'record-1',
          call_id: 'call-1',
          entry_type: 'owner_runtime',
          status: 'completed',
          started_at: '2026-07-22T08:00:00Z',
        },
        callback_records: [
          {
            id: 'record-2',
            call_id: 'callback-1',
            entry_type: 'sip_callback',
            status: 'completed',
            started_at: '2026-07-22T09:00:00Z',
            duration_ms: 65000,
          },
        ],
        attempts: [
          {
            id: 'attempt-1',
            follow_up_id: '1',
            agent_identity: 'agent-1',
            contact_channel: 'manual_phone',
            attempt_result: 'connected',
            related_call_id: 'callback-1',
            contacted_at: '2026-07-22T09:01:05Z',
          },
        ],
        handling_results: [
          {
            id: 'handling-0',
            follow_up_id: '1',
            contact_channel: 'wechat',
            contact_result: 'connected',
            remark: '微信联系备注',
            next_action: 'continue',
            next_follow_up_at: '2026-07-22T09:00:00Z',
            agent_identity: 'agent-1',
            handled_at: '2026-07-22T08:30:00Z',
          },
          {
            id: 'handling-1',
            follow_up_id: '1',
            related_call_id: 'callback-1',
            contact_channel: 'manual_phone',
            contact_result: 'connected',
            remark: '客户说明天下午再联系',
            next_action: 'continue',
            next_follow_up_at: '2026-07-23T07:00:00Z',
            agent_identity: 'agent-1',
            handled_at: '2026-07-22T09:02:00Z',
          },
        ],
      },
    });
    (getAiCallRecordDetail as jest.Mock).mockResolvedValue({
      record: {
        id: 'record-2',
        callId: 'callback-1',
        entryType: 'sip_callback',
        status: 'completed',
        endReason: 'agent_completed',
        startedAt: '2026-07-22T09:00:00Z',
        answeredAt: '2026-07-22T09:00:02Z',
        endedAt: '2026-07-22T09:01:05Z',
        durationMs: 65000,
      },
    });
    (getAiCallRecordRecording as jest.Mock).mockResolvedValue({
      id: 'recording-1',
      callId: 'callback-1',
      status: 'completed',
      playUrl: 'https://example.com/call-1.mp3',
    });
    (getAiCallRecordDialogue as jest.Mock).mockResolvedValue({
      rows: [
        {
          callId: 'callback-1',
          segmentNo: 1,
          speakerType: 'human_agent',
          text: '您好，我是本次回访坐席。',
          segmentStatus: 'final',
        },
        {
          callId: 'callback-1',
          segmentNo: 2,
          speakerType: 'customer',
          text: '请明天下午再联系。',
          segmentStatus: 'final',
        },
      ],
      total: 1,
    });
    (getAiCallRecordSemanticAnalysis as jest.Mock).mockResolvedValue({
      callId: 'call-1',
      analysisSceneCode: 'intro_geo',
      analysisStatus: '2',
      analysisResult: { summary: '客户关注价格' },
      analysisRetryCount: 0,
    });
    (getAiCallRecordHandoffs as jest.Mock).mockResolvedValue({
      rows: [
        {
          id: 'handoff-row-1',
          handoffId: 'handoff-1',
          callId: 'call-1',
          status: 'connected',
          requestReason: 'customer_request',
          requestedAt: '2026-07-22T08:00:30Z',
        },
      ],
      total: 1,
    });

    render(<FollowUpPanel services={services} />);
    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));
    expect(await screen.findByText('138****0000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));

    const drawer = await screen.findByRole('dialog', {
      name: '跟进任务详情',
    });
    expect(services.detail).toHaveBeenCalledWith('1');
    expect(await within(drawer).findByText('关联通话与处理记录')).toBeTruthy();
    expect(within(drawer).getByText('原始通话')).toBeTruthy();
    expect(
      within(drawer).getByRole('button', { name: '查看原始通话详情' }),
    ).toBeTruthy();
    expect(within(drawer).getByText('第1次人工回拨')).toBeTruthy();
    expect(within(drawer).getByText(/客户说明天下午再联系/)).toBeTruthy();
    expect(within(drawer).getAllByText(/处理时间：2026-/)).toHaveLength(1);
    expect(within(drawer).getAllByText(/下次跟进：2026-/)).toHaveLength(2);
    expect(within(drawer).queryByText('任务摘要')).toBeNull();
    expect(within(drawer).getByText('跟进原因').style.color).toBe(
      'rgb(31, 31, 31)',
    );
    const original = within(drawer).getByText('原始通话');
    const wechat = within(drawer).getByText(/微信联系备注/);
    const callback = within(drawer).getByText('第1次人工回拨');
    expect(
      original.compareDocumentPosition(wechat) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      wechat.compareDocumentPosition(callback) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(
      within(drawer).getByRole('button', { name: '查看本次通话详情' }),
    );

    const callDrawer = await screen.findByRole('dialog', {
      name: '回拨通话详情',
    });
    expect(getAiCallRecordDetail).toHaveBeenCalledWith('callback-1');
    expect(within(callDrawer).getByText('关联通话与处理记录')).toBeTruthy();
    expect(within(callDrawer).getByText('原始通话')).toBeTruthy();
    expect(within(callDrawer).getByText('第1次人工回拨')).toBeTruthy();
    expect(within(callDrawer).getByText('当前回拨')).toBeTruthy();
    expect(
      await within(callDrawer).findByText('您好，我是本次回访坐席。'),
    ).toBeTruthy();
    expect(within(callDrawer).getByText('请明天下午再联系。')).toBeTruthy();
    expect(
      within(callDrawer).getByTestId('dialogue-scroll-region'),
    ).toBeTruthy();
    expect(within(callDrawer).queryByText('AI 分析')).toBeNull();
    expect(within(callDrawer).queryByText('转人工记录')).toBeNull();
    expect(
      within(callDrawer)
        .getByText('请明天下午再联系。')
        .closest('.ai-call-dialogue-bubble--customer'),
    ).toBeTruthy();

    fireEvent.click(
      within(callDrawer).getByRole('button', { name: '返回跟进任务详情' }),
    );
    expect(
      await screen.findByRole('dialog', { name: '跟进任务详情' }),
    ).toBeTruthy();

    fireEvent.click(
      within(drawer).getByRole('button', { name: '查看原始通话详情' }),
    );
    const sourceCallDrawer = await screen.findByRole('dialog', {
      name: '通话记录详情',
    });
    expect(getAiCallRecordDetail).toHaveBeenCalledWith('call-1');
    expect(await within(sourceCallDrawer).findByText('基本信息')).toBeTruthy();
    fireEvent.click(
      within(sourceCallDrawer).getByRole('button', {
        name: '返回跟进任务详情',
      }),
    );
    expect(
      await screen.findByRole('dialog', { name: '跟进任务详情' }),
    ).toBeTruthy();
  });

  it('submits a connected result and completes the task atomically', async () => {
    const services = createServices();
    services.list.mockResolvedValue({
      code: 200,
      data: {
        rows: [{ ...unanswered, owner_agent_identity: 'agent-1' }],
        total: 1,
      },
    });

    render(<FollowUpPanel services={services} />);
    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));
    expect(await screen.findByText('138****0000')).toBeTruthy();
    fireEvent.click(
      await screen.findByRole('button', { name: '提交处理结果' }),
    );
    fireEvent.change(screen.getByLabelText('处理备注'), {
      target: { value: '客户问题已处理完成' },
    });
    fireEvent.mouseDown(screen.getByLabelText('下一步'));
    fireEvent.click(await screen.findByText('办结任务'));
    fireEvent.click(screen.getByRole('button', { name: '提交结果' }));

    await waitFor(() =>
      expect(services.submitResult).toHaveBeenCalledWith(
        unanswered.id,
        expect.objectContaining({
          contactResult: 'connected',
          remark: '客户问题已处理完成',
          nextAction: 'complete',
        }),
      ),
    );
  });

  it('requires a technical failure reason and the next follow-up time', async () => {
    const services = createServices();
    services.list.mockResolvedValue({
      code: 200,
      data: {
        rows: [
          {
            ...unanswered,
            owner_agent_identity: 'agent-1',
            pending_handling_call_id: 'callback-1',
            awaiting_handling_result: true,
          },
        ],
        total: 1,
      },
    });
    services.detail.mockResolvedValue({
      code: 200,
      data: {
        ...unanswered,
        owner_agent_identity: 'agent-1',
        attempts: [
          {
            id: 'attempt-1',
            follow_up_id: unanswered.id,
            agent_identity: 'agent-1',
            contact_channel: 'manual_phone',
            attempt_result: 'technical_failure',
            related_call_id: 'callback-1',
            contacted_at: '2026-07-22T09:01:05Z',
          },
        ],
      },
    });

    render(<FollowUpPanel services={services} />);
    await screen.findByText('138****0000');
    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));
    fireEvent.click(
      await screen.findByRole('button', { name: '提交处理结果' }),
    );
    await screen.findByRole('dialog', { name: '提交处理结果' });
    fireEvent.click(screen.getByRole('button', { name: '提交结果' }));
    expect(await screen.findByText('请补充技术失败原因')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('处理备注'), {
      target: { value: '本次回拨技术失败：本地网络中断' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交结果' }));
    expect(await screen.findByText('请选择下次跟进时间')).toBeTruthy();

    const followUpAt = screen.getByLabelText('下次跟进时间');
    fireEvent.change(followUpAt, {
      target: { value: dayjs().add(1, 'day').format('YYYY-MM-DD HH:mm') },
    });
    fireEvent.keyDown(followUpAt, { key: 'Enter', code: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: '提交结果' }));

    await waitFor(() =>
      expect(services.submitResult).toHaveBeenCalledWith(
        unanswered.id,
        expect.objectContaining({
          contactResult: 'technical_failure',
          nextAction: 'continue',
        }),
      ),
    );
  });

  it('only accepts a next follow-up time after now', () => {
    const now = dayjs('2026-08-06T12:00:00');

    expect(isFutureFollowUpTime('2026-08-06T12:00', now)).toBe(false);
    expect(isFutureFollowUpTime('2026-08-06T11:59', now)).toBe(false);
    expect(isFutureFollowUpTime('2026-08-06T12:01', now)).toBe(true);
  });

  it('keeps no-answer tasks in follow-up and requires an explicit next time', async () => {
    const services = createServices();
    services.list.mockResolvedValue({
      code: 200,
      data: {
        rows: [{ ...unanswered, owner_agent_identity: 'agent-1' }],
        total: 1,
      },
    });
    render(<FollowUpPanel services={services} />);
    await screen.findByText('138****0000');
    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));
    expect(await screen.findByText('未约定回访时间')).toBeTruthy();
    expect(screen.queryByText('30 分钟后')).toBeNull();
    expect(screen.queryByText('2 小时后')).toBeNull();

    fireEvent.click(
      await screen.findByRole('button', { name: '提交处理结果' }),
    );
    fireEvent.mouseDown(screen.getByLabelText('联系结果'));
    fireEvent.click(await screen.findByText('无人接听'));
    fireEvent.change(screen.getByLabelText('处理备注'), {
      target: { value: '本次回拨未接通' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交结果' }));
    expect(await screen.findByText('请选择下次跟进时间')).toBeTruthy();
    const followUpAt = screen.getByLabelText('下次跟进时间');
    fireEvent.change(followUpAt, {
      target: { value: dayjs().add(1, 'day').format('YYYY-MM-DD HH:mm') },
    });
    fireEvent.keyDown(followUpAt, { key: 'Enter', code: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: '提交结果' }));
    await waitFor(() =>
      expect(services.submitResult).toHaveBeenCalledWith(
        unanswered.id,
        expect.objectContaining({
          contactResult: 'no_answer',
          nextAction: 'continue',
        }),
      ),
    );
  });

  it('requires a close reason and makes terminal tasks read-only', async () => {
    const services = createServices();
    services.list.mockResolvedValue({
      code: 200,
      data: {
        rows: [{ ...unanswered, owner_agent_identity: 'agent-1' }],
        total: 1,
      },
    });
    render(<FollowUpPanel services={services} />);
    await screen.findByText('138****0000');
    fireEvent.click(screen.getByRole('tab', { name: /我的跟进/ }));
    fireEvent.click(
      await screen.findByRole('button', { name: '提交处理结果' }),
    );
    fireEvent.mouseDown(screen.getByLabelText('联系结果'));
    fireEvent.click(await screen.findByText('客户拒接'));
    fireEvent.change(screen.getByLabelText('处理备注'), {
      target: { value: '客户明确表示不再需要联系' },
    });
    fireEvent.mouseDown(screen.getByLabelText('下一步'));
    fireEvent.click(await screen.findByText('终止跟进'));
    fireEvent.click(screen.getByRole('button', { name: '提交结果' }));
    expect(await screen.findByText('请选择终止原因')).toBeTruthy();
    fireEvent.mouseDown(screen.getByLabelText('终止原因'));
    fireEvent.click(await screen.findByText('客户明确拒绝'));
    fireEvent.click(screen.getByRole('button', { name: '提交结果' }));
    await waitFor(() =>
      expect(services.submitResult).toHaveBeenCalledWith(
        unanswered.id,
        expect.objectContaining({
          nextAction: 'close',
          closedReason: 'customer_refused',
        }),
      ),
    );
  });
});

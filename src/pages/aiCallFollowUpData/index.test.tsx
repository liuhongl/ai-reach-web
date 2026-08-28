import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import * as React from 'react';
import { listAiCallTasks } from '@/pages/aiCallTasks/service';
import { startFollowUpDataCall } from '@/services/ruoyi/agent-console';
import FollowUpDataPage from './index';
import {
  adjustFollowUpDataClassification,
  getFollowUpData,
  listFollowUpData,
} from './service';

jest.mock('@/pages/aiCallTasks/service', () => ({
  listAiCallTasks: jest.fn(),
}));
jest.mock('@/components/Permission', () => ({
  PermissionButton: ({
    children,
    onClick,
  }: {
    children: string;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));
jest.mock('@/pages/agentWorkbench/hooks/useAgentPresence', () => ({
  useAgentPresence: () => ({
    phase: 'ready',
    status: 'available',
    profile: { agent_identity: 'agent-1', enabled: true },
    consoleSessionId: 'session-1',
    errorMessage: '',
    bootstrap: jest.fn(),
    goOnline: jest.fn().mockResolvedValue(true),
  }),
}));
jest.mock('@/pages/agentWorkbench/hooks/useFollowUpCallback', () => ({
  useFollowUpCallback: () => ({
    phase: 'idle',
    connectionStage: 'idle',
    microphoneEnabled: true,
    remoteAudioReady: false,
    networkQuality: 'unknown',
    errorMessage: '',
    toggleMicrophone: jest.fn(),
    switchAudioInput: jest.fn(),
    endCall: jest.fn(),
  }),
}));
jest.mock('@/pages/agentWorkbench/components/CurrentCallPanel', () => ({
  __esModule: true,
  default: () => <div>人工外呼通话面板</div>,
}));
jest.mock('@/pages/agentWorkbench/components/AgentName', () => ({
  __esModule: true,
  default: ({ identity }: { identity: string }) => <span>{identity}</span>,
}));
jest.mock('@/services/ruoyi/agent-console', () => ({
  endFollowUpDataCall: jest.fn(),
  startFollowUpDataCall: jest.fn(),
}));
jest.mock('./service', () => ({
  adjustFollowUpDataClassification: jest.fn(),
  getFollowUpData: jest.fn(),
  listFollowUpData: jest.fn(),
  scheduleFollowUpData: jest.fn(),
}));
jest.mock('@/pages/aiCallRecords/CallRecordDetailContent', () => ({
  __esModule: true,
  default: ({ callId }: { callId: string }) => <div>通话详情 {callId}</div>,
}));

const row = {
  follow_up_data_id: '100',
  tenant_id: 'tenant-a',
  task_id: '200',
  target_id: '300',
  source_call_id: 'call-1',
  customer_name: '科技公司',
  masked_contact: '138****1001',
  task_name: 'SaaS 产品回访',
  classification: 'interested',
  classification_reason: '客户要求安排产品演示',
  classification_source: 'ai',
  classification_confidence: 'high',
  suggest_review: false,
  latest_conclusion: '客户希望下周查看产品演示',
  last_contact_at: '2026-08-15T10:00:00+08:00',
  next_follow_up_at: null,
  active_follow_up_id: null,
  follow_up_task_status: null,
  active_follow_up_owner_agent_identity: null,
  active_follow_up_reason: null,
  classification_updated_at: '2026-08-15T10:00:00+08:00',
  classification_updated_by: null,
  after_call_result_status: 'not_applicable',
  blocking_human_call_id: null,
  version: 1,
};

const findDialogByTitle = async (title: string) => {
  const titleNode = await screen.findByText(title, {
    selector: '.ant-drawer-title, .ant-modal-title',
  });
  return titleNode.closest('[role="dialog"]') as HTMLElement;
};

describe('跟进数据页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listAiCallTasks as jest.Mock).mockResolvedValue({ rows: [], total: 0 });
    (listFollowUpData as jest.Mock).mockResolvedValue({
      rows: [row],
      total: 1,
    });
    (getFollowUpData as jest.Mock).mockResolvedValue({
      ...row,
      timeline: [
        {
          type: 'call',
          call_id: 'call-1',
          occurred_at: '2026-08-15T10:00:00+08:00',
          entry_type: 'sip',
          status: 'completed',
          duration_ms: 65_000,
          conclusion: '客户希望下周查看产品演示',
          after_call_result_status: 'not_applicable',
        },
      ],
    });
    (adjustFollowUpDataClassification as jest.Mock).mockResolvedValue({
      version: 2,
    });
  });

  it('默认查询有意向并支持四类切换和详情时间线', async () => {
    const { container } = render(<FollowUpDataPage />);

    expect(container.querySelector('.recov-list-page')).toBeTruthy();

    await waitFor(() =>
      expect(listFollowUpData).toHaveBeenCalledWith(
        expect.objectContaining({ classification: 'interested' }),
      ),
    );
    const searchLabels = Array.from(
      document.querySelectorAll('.ant-form-item-label'),
    ).map((item) => item.textContent);
    expect(searchLabels).toContain('客户姓名');
    expect(searchLabels).not.toContain('分类可信度');
    expect(searchLabels).not.toContain('计划跟进时间');
    expect(
      await screen.findByRole('columnheader', { name: '计划回访时间' }),
    ).toBeTruthy();
    for (const label of ['有意向', '持续跟进', '低价值', '已转化']) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    }
    const activeTab = screen.getByRole('tab', { name: '有意向' });
    expect(activeTab.closest('.agent-follow-up-scope-tabs')).toBeTruthy();
    expect(activeTab.closest('.recov-toolbar-card')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: '持续跟进' }));
    await waitFor(() =>
      expect(listFollowUpData).toHaveBeenCalledWith(
        expect.objectContaining({ classification: 'nurturing' }),
      ),
    );

    fireEvent.click(await screen.findByRole('button', { name: '详情' }));
    expect(getFollowUpData).toHaveBeenCalledWith('100');
    const drawer = await findDialogByTitle('客户跟进档案详情');
    expect(within(drawer).getByText('客户要求安排产品演示')).toBeTruthy();
    fireEvent.click(
      within(drawer).getByRole('button', { name: '查看本次通话详情' }),
    );
    expect(await screen.findByText('通话详情 call-1')).toBeTruthy();
  });

  it('存在回访任务时展示明确的任务入口', async () => {
    (listFollowUpData as jest.Mock).mockResolvedValue({
      rows: [{ ...row, active_follow_up_id: 'follow-up-1' }],
      total: 1,
    });

    render(<FollowUpDataPage />);

    expect(
      await screen.findByRole('button', { name: '查看回访任务' }),
    ).toBeTruthy();
  });

  it('未接通的人工回访显示结果和呼叫耗时且无需提交话后结果', async () => {
    (getFollowUpData as jest.Mock).mockResolvedValue({
      ...row,
      timeline: [
        {
          type: 'call',
          call_id: 'call-no-answer',
          occurred_at: '2026-08-27T14:11:10+08:00',
          entry_type: 'sip_callback',
          status: 'completed',
          end_reason: 'callback_no_answer',
          duration_ms: 9_000,
          operator_agent_identity: 'agent-admin',
          after_call_result_status: 'not_applicable',
        },
      ],
    });

    render(<FollowUpDataPage />);
    fireEvent.click(await screen.findByRole('button', { name: '详情' }));
    const drawer = await findDialogByTitle('客户跟进档案详情');

    expect(within(drawer).getByText('未接通')).toBeTruthy();
    expect(within(drawer).getByText(/呼叫耗时 0分9秒/)).toBeTruthy();
    expect(within(drawer).queryByText('待提交话后结果')).toBeNull();
  });

  it('提供调整分类和安排后续回访表单', async () => {
    render(<FollowUpDataPage />);

    fireEvent.click(await screen.findByRole('button', { name: '调整分类' }));
    const classificationDialog = await findDialogByTitle('调整分类');
    expect(within(classificationDialog).getByText('客户分类')).toBeTruthy();
    expect(
      within(classificationDialog).getByDisplayValue('客户要求安排产品演示'),
    ).toBeTruthy();
    expect(
      within(classificationDialog).getByDisplayValue(
        '客户希望下周查看产品演示',
      ),
    ).toBeTruthy();
    fireEvent.click(
      within(classificationDialog).getByRole('button', { name: 'Close' }),
    );

    fireEvent.click(screen.getByRole('button', { name: '安排后续回访' }));
    const scheduleDialog = await findDialogByTitle('安排后续回访');
    expect(within(scheduleDialog).getByText('本次回访原因')).toBeTruthy();
    expect(within(scheduleDialog).getByText('计划回访时间')).toBeTruthy();
  });

  it('待人工复核时标记状态并禁止安排后续回访', async () => {
    (listFollowUpData as jest.Mock).mockResolvedValue({
      rows: [{ ...row, suggest_review: true }],
      total: 1,
    });

    render(<FollowUpDataPage />);

    expect(await screen.findByText('待人工复核')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '安排后续回访' })).toBeNull();
    expect(screen.getByRole('button', { name: '立即人工外呼' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '调整分类' })).toBeTruthy();
  });

  it('调整分类时同时提交人工修正后的沟通结论', async () => {
    render(<FollowUpDataPage />);

    fireEvent.click(await screen.findByRole('button', { name: '调整分类' }));
    const dialog = await findDialogByTitle('调整分类');
    fireEvent.change(within(dialog).getByLabelText('沟通结论'), {
      target: { value: '客户关注指标，但尚未接受产品演示。' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '确认调整' }));

    await waitFor(() =>
      expect(adjustFollowUpDataClassification).toHaveBeenCalledWith(
        '100',
        expect.objectContaining({
          conclusion: '客户关注指标，但尚未接受产品演示。',
        }),
      ),
    );
  });

  it('从跟进数据确认客户上下文后发起人工外呼', async () => {
    (startFollowUpDataCall as jest.Mock).mockResolvedValue({
      data: {
        call_id: 'call-manual-1',
        follow_up_id: null,
        status: 'accepted',
        livekit_url: 'wss://livekit.example.com',
        participant_token: 'token',
        participant_identity: 'agent-call-manual-1',
        expires_in_seconds: 60,
      },
    });
    render(<FollowUpDataPage />);

    fireEvent.click(
      await screen.findByRole('button', { name: '立即人工外呼' }),
    );
    const dialog = await findDialogByTitle('确认立即人工外呼');
    expect(within(dialog).getByText('有意向')).toBeTruthy();
    expect(within(dialog).getByText(row.latest_conclusion)).toBeTruthy();
    expect(within(dialog).getByText('建议沟通重点')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '发起外呼' }));

    await waitFor(() =>
      expect(startFollowUpDataCall).toHaveBeenCalledWith('100', {
        consoleSessionId: 'session-1',
        idempotencyKey: expect.any(String),
        takeover: false,
        takeoverReason: undefined,
      }),
    );
    expect(await screen.findByText('人工外呼通话面板')).toBeTruthy();
  });
});

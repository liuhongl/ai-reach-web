import fs from 'node:fs';
import path from 'node:path';
import { act, cleanup, render, screen } from '@testing-library/react';
import * as React from 'react';
import AgentWorkbenchPage from './index';

const mockUseAgentPresence = jest.fn();
const mockUseAgentEvents = jest.fn();
const mockUseAgentCall = jest.fn();
const mockGetPendingHandoffs = jest.fn();

jest.mock('./hooks/useAgentPresence', () => ({
  useAgentPresence: () => mockUseAgentPresence(),
}));

jest.mock('./hooks/useAgentEvents', () => ({
  useAgentEvents: (...args: unknown[]) => mockUseAgentEvents(...args),
}));

jest.mock('./hooks/useAgentCall', () => ({
  useAgentCall: (...args: unknown[]) => mockUseAgentCall(...args),
}));

jest.mock('./components/FollowUpPanel', () => () => (
  <div>人工跟进测试替身</div>
));

jest.mock('@/services/ruoyi/agent-console', () => ({
  getPendingHandoffs: (...args: unknown[]) => mockGetPendingHandoffs(...args),
}));

const basePresence = {
  phase: 'ready',
  status: 'offline',
  profile: {
    scene_codes: ['intro_geo'],
  },
  blockReason: '',
  errorMessage: '',
  deviceResult: {
    checks: {
      microphone: 'idle',
      inputLevel: 'idle',
      audioPlayback: 'idle',
      browser: 'idle',
      network: 'idle',
    },
  },
  goOnline: jest.fn(),
  pause: jest.fn(),
  goOffline: jest.fn(),
};

describe('AgentWorkbenchPage presence shell', () => {
  const styles = fs.readFileSync(path.join(__dirname, 'index.css'), 'utf8');

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockUseAgentCall.mockReturnValue({
      phase: 'idle',
      microphoneEnabled: true,
      remoteAudioReady: false,
      networkQuality: 'unknown',
      errorMessage: '',
      toggleMicrophone: jest.fn(),
      switchAudioInput: jest.fn(),
      endCall: jest.fn(),
    });
    mockUseAgentEvents.mockReturnValue({
      transport: 'sse',
      unreadCount: 0,
      clearUnread: jest.fn(),
      requestNotificationPermission: jest.fn(),
    });
    mockGetPendingHandoffs.mockResolvedValue({
      code: 200,
      data: { rows: [], total: 0 },
    });
  });

  it('shows actionable guidance when the account has no profile', () => {
    mockUseAgentPresence.mockReturnValue({
      ...basePresence,
      phase: 'blocked',
      blockReason: 'unregistered',
      profile: undefined,
    });

    render(<AgentWorkbenchPage />);

    expect(screen.getByText('坐席工作台')).toBeTruthy();
    expect(
      screen.getByText(
        '当前账号尚未开通坐席功能，请联系管理员创建坐席档案并配置业务场景。',
      ),
    ).toBeTruthy();
  });

  it('offers pause and offline actions only for an available agent', () => {
    mockUseAgentPresence.mockReturnValue({
      ...basePresence,
      status: 'available',
    });

    render(<AgentWorkbenchPage />);

    expect(screen.getByRole('button', { name: '暂停接听' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '下线' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '上线接听' })).toBeNull();
  });

  it('keeps only the essential device checks beside the online action', () => {
    mockUseAgentPresence.mockReturnValue({
      ...basePresence,
      consoleSessionId: 'session-1',
    });

    render(<AgentWorkbenchPage />);

    expect(screen.getByRole('button', { name: '上线接听' })).toBeTruthy();
    expect(screen.getByText('麦克风')).toBeTruthy();
    expect(screen.getByText('音频播放')).toBeTruthy();
    expect(screen.getByText('网络')).toBeTruthy();
    expect(screen.queryByText('接听环境')).toBeNull();
    expect(screen.queryByText('输入电平')).toBeNull();
    expect(screen.queryByText('浏览器')).toBeNull();
  });

  it('uses the viewport workbench layout for an available agent', () => {
    mockUseAgentPresence.mockReturnValue({
      ...basePresence,
      status: 'available',
    });

    const view = render(<AgentWorkbenchPage />);

    expect(
      view.container.querySelector('.agent-workbench-viewport'),
    ).toBeTruthy();
  });

  it('constrains the nested PageContainer wrappers so card content can scroll', () => {
    expect(styles).toMatch(
      /\.agent-workbench-viewport > \.ant-pro-grid-content,[\s\S]*?> \.ant-pro-grid-content-children[\s\S]*?\{[\s\S]*?height: 100%;[\s\S]*?min-height: 0;[\s\S]*?\}/,
    );
    expect(styles).toMatch(
      /> \.ant-pro-page-container-children-container[\s\S]*?\{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;[\s\S]*?height: 100%;[\s\S]*?min-height: 0;[\s\S]*?\}/,
    );
    expect(styles).toMatch(
      /\.agent-workbench-context-card \{[\s\S]*?width: 100%;[\s\S]*?max-width: none;[\s\S]*?\}/,
    );
    expect(styles).toContain('minmax(440px, 1.2fr)');
  });

  it('centers active call controls horizontally without using the empty-state layout', () => {
    mockUseAgentPresence.mockReturnValue({
      ...basePresence,
      status: 'in_call',
      consoleSessionId: 'session-1',
    });
    mockUseAgentCall.mockReturnValue({
      phase: 'connected',
      connectionStage: 'connected',
      microphoneEnabled: true,
      remoteAudioReady: true,
      networkQuality: 'good',
      errorMessage: '',
      toggleMicrophone: jest.fn(),
      switchAudioInput: jest.fn(),
      endCall: jest.fn(),
    });

    const view = render(<AgentWorkbenchPage />);

    expect(
      view.container.querySelector('.agent-workbench-current-content'),
    ).toBeTruthy();
  });

  it('does not query the public waiting pool while the agent is offline', async () => {
    mockUseAgentPresence.mockReturnValue({
      ...basePresence,
      consoleSessionId: 'session-1',
    });

    render(<AgentWorkbenchPage />);

    expect(await screen.findByText('暂无待接通话')).toBeTruthy();
    expect(mockGetPendingHandoffs).not.toHaveBeenCalled();
  });

  it('fills each empty state across its card content', async () => {
    mockUseAgentPresence.mockReturnValue({
      ...basePresence,
      consoleSessionId: 'session-1',
    });

    render(<AgentWorkbenchPage />);

    for (const description of [
      '暂无待接通话',
      '上线后开始接听转人工请求',
      '转人工请求到达后显示业务上下文',
    ]) {
      expect(
        (await screen.findByText(description)).closest(
          '.agent-workbench-empty-state',
        ),
      ).toBeTruthy();
    }
  });

  it('loads the public waiting pool from the agent console service', async () => {
    mockUseAgentPresence.mockReturnValue({
      ...basePresence,
      status: 'available',
      consoleSessionId: 'session-1',
    });
    mockGetPendingHandoffs.mockResolvedValueOnce({
      code: 200,
      data: {
        rows: [
          {
            handoff_id: 'handoff-1',
            call_id: 'call-1',
            scene_code: 'intro_geo',
            status: 'requested',
            masked_customer_name: '张**',
            masked_contact: '138****0000',
            request_message: '请帮我转人工',
            requested_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
    });

    render(<AgentWorkbenchPage />);

    expect(await screen.findAllByText('张** · 138****0000')).toHaveLength(2);
    expect(mockGetPendingHandoffs).toHaveBeenCalledTimes(1);
    expect(mockGetPendingHandoffs).toHaveBeenCalledWith({
      consoleSessionId: 'session-1',
      limit: 100,
    });
  });

  it('refreshes the waiting pool silently for event-loss recovery', async () => {
    mockUseAgentPresence.mockReturnValue({
      ...basePresence,
      status: 'available',
      consoleSessionId: 'session-1',
    });
    const view = render(<AgentWorkbenchPage />);
    await act(async () => Promise.resolve());

    const eventOptions = mockUseAgentEvents.mock.calls.at(-1)?.[0];
    expect(typeof eventOptions.pollRefresh).toBe('function');

    let resolvePoll: (value: unknown) => void = () => undefined;
    mockGetPendingHandoffs.mockImplementationOnce(
      () =>
        new Promise<unknown>((resolve) => {
          resolvePoll = resolve;
        }),
    );
    act(() => {
      void eventOptions.pollRefresh();
    });

    expect(view.container.querySelector('.ant-spin-spinning')).toBeNull();

    await act(async () => {
      resolvePoll({ code: 200, data: { rows: [], total: 0 } });
    });
  });

  it('keeps the call wrap-up callback stable across renders', () => {
    mockUseAgentPresence.mockReturnValue({
      ...basePresence,
      status: 'available',
      consoleSessionId: 'session-1',
    });

    const { rerender } = render(<AgentWorkbenchPage />);
    const firstOptions = mockUseAgentCall.mock.calls[0][0];

    rerender(<AgentWorkbenchPage />);
    const latestOptions = mockUseAgentCall.mock.calls.at(-1)?.[0];

    expect(latestOptions.onWrapUp).toBe(firstOptions.onWrapUp);
  });

  it('keeps asynchronous follow-up work outside the real-time console', () => {
    mockUseAgentPresence.mockReturnValue({
      ...basePresence,
      status: 'available',
      consoleSessionId: 'session-1',
    });

    render(<AgentWorkbenchPage />);

    expect(screen.getByText('待接通话')).toBeTruthy();
    expect(screen.getByText('正在等待系统分配转人工请求')).toBeTruthy();
    expect(screen.getByText('转人工请求到达后显示业务上下文')).toBeTruthy();
    expect(screen.queryByText('人工跟进')).toBeNull();
    expect(screen.queryByText('人工跟进测试替身')).toBeNull();
  });

  it('keeps refreshing the waiting pool while the agent is in a call', async () => {
    const availablePresence = {
      ...basePresence,
      status: 'available',
      consoleSessionId: 'session-1',
    };
    mockUseAgentPresence.mockReturnValue(availablePresence);
    mockGetPendingHandoffs.mockResolvedValueOnce({
      code: 200,
      data: {
        rows: [
          {
            handoff_id: 'handoff-queue-snapshot',
            call_id: 'call-queue-snapshot',
            scene_code: 'intro_geo',
            status: 'requested',
            masked_customer_name: '李**',
            masked_contact: '139****0000',
            request_message: '客户等待人工服务',
            requested_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
    });
    mockGetPendingHandoffs.mockResolvedValueOnce({
      code: 200,
      data: {
        rows: [
          {
            handoff_id: 'handoff-new-during-call',
            call_id: 'call-new-during-call',
            scene_code: 'intro_geo',
            status: 'requested',
            masked_customer_name: '王**',
            masked_contact: '137****0000',
            request_message: '通话中到达的新请求',
            requested_at: new Date().toISOString(),
          },
        ],
        total: 1,
      },
    });

    const view = render(<AgentWorkbenchPage />);
    expect(await screen.findAllByText('李** · 139****0000')).toHaveLength(2);

    mockUseAgentPresence.mockReturnValue({
      ...availablePresence,
      status: 'in_call',
    });
    view.rerender(<AgentWorkbenchPage />);
    await act(async () => Promise.resolve());

    expect(await screen.findAllByText('王** · 137****0000')).toHaveLength(2);
    expect(screen.queryByText('李** · 139****0000')).toBeNull();
    expect(screen.getByText('通话中，暂不可接管')).toBeTruthy();
    expect(mockGetPendingHandoffs).toHaveBeenCalledTimes(2);
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { getAgentFollowUp } from '@/services/ruoyi/agent-console';
import FollowUpProcessingPage from './processing';

const mockUseAgentPresence = jest.fn();

const mockCallback = {
  call_id: 'callback-1',
  status: 'accepted' as const,
  livekit_url: 'wss://livekit.example.com',
  participant_token: 'token',
  participant_identity: 'agent-callback-1',
  expires_in_seconds: 60,
};

const mockTask = {
  id: 'follow-up-1',
  source_type: 'handoff_unanswered' as const,
  source_call_id: 'call-1',
  source_handoff_id: null,
  scene_code: 'intro_geo' as const,
  status: 'processing' as const,
  follow_up_reason: '客户需要回访',
  created_at: '2026-08-06T00:00:00Z',
};

jest.mock('@ant-design/pro-components', () => {
  const React = require('react');
  return {
    PageContainer: ({ children }: { children: unknown }) =>
      React.createElement('main', null, children),
  };
});

jest.mock('antd', () => ({
  Modal: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: any;
  }) => (open ? <section aria-label={title}>{children}</section> : null),
  message: {
    useMessage: () => [
      { success: jest.fn(), warning: jest.fn(), error: jest.fn() },
      null,
    ],
  },
}));

jest.mock('@/services/ruoyi/agent-console', () => ({
  getAgentFollowUp: jest.fn(),
}));

jest.mock('../../hooks/useAgentPresence', () => ({
  useAgentPresence: (...args: unknown[]) => mockUseAgentPresence(...args),
}));

jest.mock('../../hooks/useFollowUpCallback', () => ({
  useFollowUpCallback: () => ({
    phase: 'ended',
    endCall: jest.fn(),
    toggleMicrophone: jest.fn(),
    switchAudioInput: jest.fn(),
  }),
}));

jest.mock('../../components/CurrentCallPanel', () => () => <div>回拨中</div>);

jest.mock('../../components/FollowUpPanel', () => ({
  __esModule: true,
  default: ({
    onCallAccepted,
    handlingTaskToOpen,
  }: {
    onCallAccepted: (
      callback: typeof mockCallback,
      task: typeof mockTask,
    ) => void;
    handlingTaskToOpen?: { callId: string };
  }) => {
    const React = require('react');
    React.useEffect(
      () => onCallAccepted(mockCallback, mockTask),
      [onCallAccepted],
    );
    return (
      <div data-testid="handling-state">
        {handlingTaskToOpen?.callId || '-'}
      </div>
    );
  },
}));

describe('FollowUpProcessingPage', () => {
  beforeEach(() => {
    mockUseAgentPresence.mockReturnValue({
      status: 'available',
      consoleSessionId: 'session-1',
      bootstrap: jest.fn(),
      goOnline: jest.fn(),
    });
  });

  it('only switches from a remotely ended callback after its handling result is persisted', async () => {
    (getAgentFollowUp as jest.Mock).mockResolvedValue({
      data: { ...mockTask, pending_handling_call_id: mockCallback.call_id },
    });

    render(<FollowUpProcessingPage />);

    await waitFor(() =>
      expect(screen.getByTestId('handling-state').textContent).toBe(
        mockCallback.call_id,
      ),
    );
    expect(screen.queryByLabelText('回拨通话')).toBeNull();
    expect(getAgentFollowUp).toHaveBeenCalledWith(mockTask.id);
    expect(mockUseAgentPresence).toHaveBeenCalledWith({
      suppressExistingSessionMessage: true,
    });
  });
});

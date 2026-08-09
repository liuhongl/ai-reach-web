import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import * as React from 'react';
import AgentWorkbenchPage from './index';

const mockBootstrap = jest.fn();
const mockUseAgentPresence = jest.fn();
const mockUseAgentEvents = jest.fn();
const mockUseAgentCall = jest.fn();

const mockCredential = {
  handoff: {
    handoff_id: 'handoff-stale',
    call_id: 'call-stale',
    scene_code: 'intro_geo',
    status: 'completed',
    requested_at: '2026-07-31T01:00:00Z',
  },
  livekit_url: 'ws://livekit.test',
  participant_token: 'seat-token',
  participant_identity: 'human-agent-handoff-stale',
};

let mockPresence = {
  phase: 'ready',
  status: 'wrap_up_quick',
  profile: {
    enabled: true,
    scene_codes: ['intro_geo'],
  },
  presence: {
    agent_identity: 'agent-admin',
    status: 'wrap_up_quick',
    active_handoff_id: 'handoff-stale' as string | null,
    active_call_id: 'call-stale' as string | null,
  },
  currentHandoff: undefined as typeof mockCredential.handoff | undefined,
  blockReason: '',
  errorMessage: '',
  serviceRecovering: false,
  consoleSessionId: 'session-1',
  deviceResult: {
    checks: {
      microphone: 'passed',
      inputLevel: 'passed',
      audioPlayback: 'passed',
      browser: 'passed',
      network: 'passed',
    },
  },
  bootstrap: mockBootstrap,
  retryBootstrap: mockBootstrap,
  goOnline: jest.fn(),
  pause: jest.fn(),
  goOffline: jest.fn(),
};

jest.mock('./hooks/useAgentPresence', () => ({
  useAgentPresence: () => mockUseAgentPresence(),
}));

jest.mock('./hooks/useAgentEvents', () => ({
  useAgentEvents: (...args: unknown[]) => mockUseAgentEvents(...args),
}));

jest.mock('./hooks/useAgentCall', () => ({
  useAgentCall: (...args: unknown[]) => mockUseAgentCall(...args),
}));

jest.mock('./hooks/useHandoffContext', () => ({
  useHandoffContext: () => ({
    context: undefined,
    loading: false,
    errorMessage: '',
    retry: jest.fn(),
  }),
}));

jest.mock('./components/WaitingPool', () => ({
  __esModule: true,
  default: (props: { onClaimed?: (credential: unknown) => void }) => (
    <button type="button" onClick={() => props.onClaimed?.(mockCredential)}>
      模拟接管
    </button>
  ),
}));

jest.mock('./components/QuickWrapUp', () => ({
  __esModule: true,
  default: () => <div>旧通话话后面板</div>,
}));

jest.mock('@/services/ruoyi/agent-console', () => ({
  getPendingHandoffs: jest.fn().mockResolvedValue({
    code: 200,
    data: { rows: [], total: 0 },
  }),
}));

describe('AgentWorkbenchPage server reconciliation', () => {
  beforeEach(() => {
    mockBootstrap.mockReset();
    mockPresence = {
      ...mockPresence,
      status: 'wrap_up_quick',
      presence: {
        agent_identity: 'agent-admin',
        status: 'wrap_up_quick',
        active_handoff_id: 'handoff-stale',
        active_call_id: 'call-stale',
      },
      currentHandoff: undefined,
    };
    mockUseAgentPresence.mockImplementation(() => mockPresence);
    mockUseAgentEvents.mockReturnValue({
      transport: 'sse',
      unreadCount: 0,
      clearUnread: jest.fn(),
      requestNotificationPermission: jest.fn(),
    });
    mockUseAgentCall.mockImplementation(
      (options: { credential?: unknown }) => ({
        phase: options.credential ? 'wrap_up_quick' : 'idle',
        connectionStage: 'idle',
        microphoneEnabled: true,
        remoteAudioReady: false,
        networkQuality: 'unknown',
        errorMessage: '',
        toggleMicrophone: jest.fn(),
        switchAudioInput: jest.fn(),
        endCall: jest.fn(),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('refreshes server presence when a console event arrives', async () => {
    render(<AgentWorkbenchPage />);
    const eventOptions = mockUseAgentEvents.mock.calls.at(-1)?.[0] as {
      refresh: () => Promise<void>;
    };

    await act(async () => eventOptions.refresh());

    expect(mockBootstrap).toHaveBeenCalledTimes(1);
  });

  it('restores the quick wrap-up form from the server after refresh', () => {
    mockPresence = {
      ...mockPresence,
      currentHandoff: mockCredential.handoff,
    };

    render(<AgentWorkbenchPage />);

    expect(screen.getByText('旧通话话后面板')).toBeTruthy();
  });

  it('drops stale local wrap-up state after the server releases the agent', () => {
    const view = render(<AgentWorkbenchPage />);
    fireEvent.click(screen.getByRole('button', { name: '模拟接管' }));
    expect(screen.getByText('旧通话话后面板')).toBeTruthy();

    mockPresence = {
      ...mockPresence,
      status: 'offline',
      presence: {
        agent_identity: 'agent-admin',
        status: 'offline',
        active_handoff_id: null,
        active_call_id: null,
      },
    };
    view.rerender(<AgentWorkbenchPage />);

    expect(screen.getByRole('button', { name: '上线接听' })).toBeTruthy();
    expect(screen.queryByText('旧通话话后面板')).toBeNull();
  });
});

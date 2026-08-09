import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as React from 'react';
import {
  type DevicePreflightResult,
  getOrCreateConsoleSessionId,
  type UseAgentPresenceOptions,
  useAgentPresence,
} from './useAgentPresence';

const profile = {
  id: '101',
  tenant_id: 'tenant-1',
  agent_identity: 'agent-101',
  user_id: '1001',
  enabled: true,
  scene_codes: ['intro_geo'] as const,
};

const presence = (status: string) => ({
  agent_identity: 'agent-101',
  status,
  console_session_id: 'session-1',
});

const successPreflight: DevicePreflightResult = {
  ok: true,
  checks: {
    microphone: 'passed',
    inputLevel: 'passed',
    audioPlayback: 'passed',
    browser: 'passed',
    network: 'passed',
  },
};

const createServices = () => ({
  bootstrap: jest.fn().mockResolvedValue({
    code: 200,
    data: { profile, presence: presence('offline') },
  }),
  online: jest.fn().mockResolvedValue({
    code: 200,
    data: presence('available'),
  }),
  pause: jest.fn().mockResolvedValue({
    code: 200,
    data: presence('paused'),
  }),
  offline: jest.fn().mockResolvedValue({
    code: 200,
    data: presence('offline'),
  }),
  heartbeat: jest.fn().mockResolvedValue({
    code: 200,
    data: presence('available'),
  }),
});

const PresenceHarness = ({
  options,
  children,
}: {
  options: UseAgentPresenceOptions;
  children?: React.ReactNode;
}) => {
  const agent = useAgentPresence(options);

  return (
    <div>
      <div data-testid="phase">{agent.phase}</div>
      <div data-testid="status">{agent.status}</div>
      <div data-testid="block-reason">{agent.blockReason}</div>
      <div data-testid="error">{agent.errorMessage}</div>
      <div data-testid="service-recovering">
        {agent.serviceRecovering ? 'yes' : 'no'}
      </div>
      <div data-testid="session-id">{agent.consoleSessionId}</div>
      <div data-testid="current-handoff">
        {agent.currentHandoff?.handoff_id || ''}
      </div>
      <button type="button" onClick={() => void agent.goOnline()}>
        上线
      </button>
      <button type="button" onClick={() => void agent.pause()}>
        暂停
      </button>
      <button type="button" onClick={() => void agent.goOffline()}>
        下线
      </button>
      <button type="button" onClick={() => void agent.retryBootstrap()}>
        重新连接
      </button>
      {children}
    </div>
  );
};

describe('useAgentPresence', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.useRealTimers();
    sessionStorage.clear();
  });

  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => 'session-1'),
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('blocks an account that has no agent profile', async () => {
    const services = createServices();
    services.bootstrap.mockRejectedValueOnce(
      new Error('当前账号未开通坐席功能'),
    );

    render(
      <PresenceHarness options={{ services, devicePreflight: jest.fn() }} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('phase').textContent).toBe('blocked');
    });
    expect(screen.getByTestId('block-reason').textContent).toBe('unregistered');
  });

  it('keeps a disabled profile blocked by server state', async () => {
    const services = createServices();
    services.bootstrap.mockResolvedValueOnce({
      code: 200,
      data: { profile: { ...profile, enabled: false } },
    });

    render(
      <PresenceHarness options={{ services, devicePreflight: jest.fn() }} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('block-reason').textContent).toBe('disabled');
    });
    expect(services.online).not.toHaveBeenCalled();
  });

  it('does not go online when the microphone preflight is denied', async () => {
    const services = createServices();
    const devicePreflight = jest.fn().mockResolvedValue({
      ok: false,
      checks: {
        ...successPreflight.checks,
        microphone: 'failed',
      },
      message: '麦克风权限被拒绝，请允许后重新上线',
    });

    render(<PresenceHarness options={{ services, devicePreflight }} />);
    await screen.findByText('offline');
    fireEvent.click(screen.getByRole('button', { name: '上线' }));

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe(
        '麦克风权限被拒绝，请允许后重新上线',
      );
    });
    expect(services.online).not.toHaveBeenCalled();
  });

  it('uses server responses for online, pause and offline transitions', async () => {
    const services = createServices();
    render(
      <PresenceHarness
        options={{
          services,
          devicePreflight: jest.fn().mockResolvedValue(successPreflight),
        }}
      />,
    );

    await screen.findByText('offline');
    fireEvent.click(screen.getByRole('button', { name: '上线' }));
    expect(await screen.findByText('available')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '暂停' }));
    expect(await screen.findByText('paused')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '下线' }));
    expect(await screen.findByText('offline')).toBeTruthy();

    expect(services.online).toHaveBeenCalledWith({
      consoleSessionId: 'session-1',
      devicePreflightPassed: true,
    });
  });

  it('stores one console session id per browser tab', async () => {
    const services = createServices();
    const options = { services, devicePreflight: jest.fn() };
    const first = render(<PresenceHarness options={options} />);

    expect((await screen.findByTestId('session-id')).textContent).toBe(
      'session-1',
    );
    await screen.findByText('offline');
    first.unmount();
    render(<PresenceHarness options={options} />);

    expect(screen.getByTestId('session-id').textContent).toBe('session-1');
    await screen.findByText('offline');
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it('creates a console session id when Web Crypto is unavailable', () => {
    const crypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });

    try {
      const sessionId = getOrCreateConsoleSessionId();

      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: crypto,
      });
    }
  });

  it('restores the current handoff from bootstrap after a page refresh', async () => {
    const services = createServices();
    services.bootstrap.mockResolvedValueOnce({
      code: 200,
      data: {
        profile,
        presence: {
          ...presence('wrap_up_quick'),
          active_handoff_id: 'handoff-wrap-up',
          active_call_id: 'call-wrap-up',
        },
        current_handoff: {
          handoff_id: 'handoff-wrap-up',
          call_id: 'call-wrap-up',
          scene_code: 'intro_geo',
          status: 'completed',
          requested_at: '2026-07-31T01:00:00Z',
        },
      },
    });

    render(
      <PresenceHarness options={{ services, devicePreflight: jest.fn() }} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-handoff').textContent).toBe(
        'handoff-wrap-up',
      );
    });
  });

  it('keeps this tab offline when another console session owns the agent', async () => {
    jest.useFakeTimers();
    const services = createServices();
    services.bootstrap.mockResolvedValueOnce({
      code: 200,
      data: {
        profile,
        presence: {
          ...presence('available'),
          console_session_id: 'session-2',
        },
      },
    });

    render(
      <PresenceHarness
        options={{
          services,
          devicePreflight: jest.fn(),
          heartbeatIntervalMs: 1_000,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('offline');
    });
    expect(screen.getByTestId('error').textContent).toBe(
      '当前坐席已在其他页面上线；如确认原页面已关闭，请重新点击上线接听。',
    );

    await act(async () => {
      jest.advanceTimersByTime(2_000);
      await Promise.resolve();
    });
    expect(services.heartbeat).not.toHaveBeenCalled();
  });

  it('defers the existing-session message until a follow-up callback requests online', async () => {
    const services = createServices();
    services.bootstrap.mockResolvedValue({
      code: 200,
      data: {
        profile,
        presence: {
          ...presence('available'),
          console_session_id: 'session-2',
        },
      },
    });
    services.online.mockRejectedValue(
      new Error('当前坐席已在其他页面上线'),
    );

    render(
      <PresenceHarness
        options={{
          services,
          devicePreflight: jest.fn().mockResolvedValue(successPreflight),
          suppressExistingSessionMessage: true,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('offline');
    });
    expect(screen.getByTestId('error').textContent).toBe('');

    fireEvent.click(screen.getByRole('button', { name: '上线' }));

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toBe(
        '当前坐席已在其他页面上线；如确认原页面已关闭，请重新点击上线接听。',
      );
    });
  });

  it('keeps heartbeating while the page is hidden', async () => {
    jest.useFakeTimers();
    const services = createServices();
    services.bootstrap.mockResolvedValueOnce({
      code: 200,
      data: { profile, presence: presence('available') },
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    render(
      <PresenceHarness
        options={{
          services,
          devicePreflight: jest.fn(),
          heartbeatIntervalMs: 1_000,
        }}
      />,
    );
    await screen.findByText('available');

    await act(async () => {
      jest.advanceTimersByTime(2_000);
      await Promise.resolve();
    });

    expect(services.heartbeat).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('status').textContent).toBe('available');
  });

  it('adopts the expired status returned by heartbeat', async () => {
    jest.useFakeTimers();
    const services = createServices();
    services.bootstrap.mockResolvedValueOnce({
      code: 200,
      data: { profile, presence: presence('available') },
    });
    services.heartbeat.mockResolvedValueOnce({
      code: 200,
      data: presence('offline'),
    });

    render(
      <PresenceHarness
        options={{
          services,
          devicePreflight: jest.fn(),
          heartbeatIntervalMs: 1_000,
        }}
      />,
    );
    await screen.findByText('available');

    await act(async () => {
      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(services.heartbeat).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status').textContent).toBe('offline');
    expect(screen.getByTestId('error').textContent).toBe(
      '坐席会话已过期，请重新上线',
    );
  });

  it('re-bootstraps after the network or visible page recovers', async () => {
    const services = createServices();
    render(
      <PresenceHarness options={{ services, devicePreflight: jest.fn() }} />,
    );
    await screen.findByText('offline');

    act(() => {
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(services.bootstrap).toHaveBeenCalledTimes(3);
    });
  });

  it('renews an online lease before bootstrapping a visible page', async () => {
    const services = createServices();
    services.bootstrap.mockResolvedValue({
      code: 200,
      data: { profile, presence: presence('available') },
    });
    render(
      <PresenceHarness options={{ services, devicePreflight: jest.fn() }} />,
    );
    await screen.findByText('available');

    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => {
      expect(services.heartbeat).toHaveBeenCalledTimes(1);
      expect(services.bootstrap).toHaveBeenCalledTimes(2);
    });
    expect(services.heartbeat.mock.invocationCallOrder[0]).toBeLessThan(
      services.bootstrap.mock.invocationCallOrder[1],
    );
  });

  it('retries a gateway bootstrap five times with a friendly recovery state', async () => {
    jest.useFakeTimers();
    const services = createServices();
    services.bootstrap.mockRejectedValue({ response: { status: 504 } });

    render(
      <PresenceHarness options={{ services, devicePreflight: jest.fn() }} />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('service-recovering').textContent).toBe('yes');
    });
    expect(screen.getByTestId('error').textContent).toBe(
      '坐席服务暂不可用，正在重新连接',
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(12_000);
    });

    await waitFor(() => {
      expect(services.bootstrap).toHaveBeenCalledTimes(5);
      expect(screen.getByTestId('service-recovering').textContent).toBe('no');
    });
    expect(screen.getByTestId('error').textContent).toBe(
      '坐席服务暂不可用，请点击重新连接',
    );
  });

  it('recovers the profile after a manual bootstrap retry', async () => {
    jest.useFakeTimers();
    const services = createServices();
    services.bootstrap
      .mockRejectedValueOnce({ response: { status: 504 } })
      .mockRejectedValueOnce({ response: { status: 504 } })
      .mockRejectedValueOnce({ response: { status: 504 } })
      .mockRejectedValueOnce({ response: { status: 504 } })
      .mockRejectedValueOnce({ response: { status: 504 } });

    render(
      <PresenceHarness options={{ services, devicePreflight: jest.fn() }} />,
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(12_000);
    });
    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toBe(
        '坐席服务暂不可用，请点击重新连接',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: '重新连接' }));

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('offline');
      expect(screen.getByTestId('error').textContent).toBe('');
    });
    expect(services.bootstrap).toHaveBeenCalledTimes(6);
  });
});

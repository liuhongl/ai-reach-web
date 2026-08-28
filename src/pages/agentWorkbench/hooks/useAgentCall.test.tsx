import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as React from 'react';
import { useAgentCall } from './useAgentCall';

jest.mock('livekit-client', () => ({
  ConnectionQuality: {},
  DisconnectReason: {
    PARTICIPANT_REMOVED: 4,
    ROOM_DELETED: 5,
  },
  RoomEvent: {
    Disconnected: 'disconnected',
    TrackSubscribed: 'trackSubscribed',
    ConnectionQualityChanged: 'connectionQualityChanged',
  },
  Track: { Kind: { Audio: 'audio' } },
  Room: jest.fn(),
  createLocalAudioTrack: jest.fn(),
}));

const credential = {
  livekit_url: 'wss://livekit.example.com',
  participant_token: 'agent-token',
  participant_identity: 'human-agent-9007199254740993',
  handoff: {
    handoff_id: '9007199254740993',
    call_id: 'call-1',
    scene_code: 'intro_geo' as const,
    status: 'accepted' as const,
    requested_at: '2026-07-22T08:00:00Z',
  },
};

const createRoom = () => {
  let disconnected: ((reason?: number) => void) | undefined;
  let remoteAudio: (() => void) | undefined;
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    publishMicrophone: jest.fn().mockResolvedValue(undefined),
    setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
    switchAudioInput: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    onDisconnected: jest.fn((handler) => {
      disconnected = handler;
    }),
    onRemoteAudio: jest.fn((handler) => {
      remoteAudio = handler;
    }),
    onNetworkQuality: jest.fn(),
    emitDisconnected: (reason?: number) => disconnected?.(reason),
    emitRemoteAudio: () => remoteAudio?.(),
  };
};

const createServices = () => ({
  mediaReady: jest.fn().mockResolvedValue({ code: 200 }),
  reconnectToken: jest.fn().mockResolvedValue({
    code: 200,
    data: {
      handoff: credential.handoff,
      seat_token: {
        livekit_url: credential.livekit_url,
        participant_token: 'reconnect-token',
        participant_identity: credential.participant_identity,
      },
    },
  }),
  complete: jest.fn().mockResolvedValue({ code: 200 }),
});

const Harness = ({ options }: { options: any }) => {
  const call = useAgentCall(options);
  return (
    <div>
      <span data-testid="phase">{call.phase}</span>
      <span data-testid="remote-audio">
        {call.remoteAudioReady ? 'yes' : 'no'}
      </span>
      <span data-testid="error">{call.errorMessage}</span>
      <button type="button" onClick={() => void call.endCall()}>
        结束
      </button>
    </div>
  );
};

describe('useAgentCall', () => {
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not create a Room until a credential is available', async () => {
    const roomFactory = jest.fn(createRoom);
    const { rerender } = render(
      <Harness options={{ consoleSessionId: 'session-1', roomFactory }} />,
    );
    expect(roomFactory).not.toHaveBeenCalled();

    rerender(
      <Harness
        options={{ credential, consoleSessionId: 'session-1', roomFactory }}
      />,
    );
    await waitFor(() => expect(roomFactory).toHaveBeenCalledTimes(1));
  });

  it('reconnects a server-restored active handoff and keeps the hang-up action available', async () => {
    const room = createRoom();
    const services = createServices();
    const onWrapUp = jest.fn();
    const resumeHandoff = {
      ...credential.handoff,
      status: 'connected' as const,
    };

    render(
      <Harness
        options={{
          resumeHandoff,
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services,
          onWrapUp,
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );
    expect(services.reconnectToken).toHaveBeenCalledWith(
      resumeHandoff.handoff_id,
      expect.objectContaining({ consoleSessionId: 'session-1' }),
    );
    expect(services.mediaReady).toHaveBeenCalledWith(
      resumeHandoff.handoff_id,
      expect.objectContaining({
        consoleSessionId: 'session-1',
        participantIdentity: credential.participant_identity,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: '结束' }));

    await waitFor(() =>
      expect(services.complete).toHaveBeenCalledWith(
        resumeHandoff.handoff_id,
        expect.objectContaining({ consoleSessionId: 'session-1' }),
      ),
    );
    expect(onWrapUp).toHaveBeenCalledWith(credential.handoff);
  });

  it('reports media-ready only after the microphone is published', async () => {
    const room = createRoom();
    const services = createServices();
    render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services,
        }}
      />,
    );

    await waitFor(() => expect(services.mediaReady).toHaveBeenCalledTimes(1));
    expect(room.publishMicrophone).toHaveBeenCalledTimes(1);
    expect(services.mediaReady).toHaveBeenCalledWith(
      credential.handoff.handoff_id,
      expect.objectContaining({
        consoleSessionId: 'session-1',
        participantIdentity: credential.participant_identity,
      }),
    );
    expect(room.publishMicrophone.mock.invocationCallOrder[0]).toBeLessThan(
      services.mediaReady.mock.invocationCallOrder[0],
    );
    expect(screen.getByTestId('phase').textContent).toBe('connected');
  });

  it('keeps the active room when only the refresh callback changes', async () => {
    const room = createRoom();
    const services = createServices();
    const roomFactory = jest.fn(() => room);
    const view = render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory,
          services,
          refresh: jest.fn(),
        }}
      />,
    );
    await waitFor(() => expect(services.mediaReady).toHaveBeenCalledTimes(1));

    view.rerender(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory,
          services,
          refresh: jest.fn(),
        }}
      />,
    );

    await waitFor(() => expect(roomFactory).toHaveBeenCalledTimes(1));
    expect(services.mediaReady).toHaveBeenCalledTimes(1);
    expect(room.disconnect).not.toHaveBeenCalled();
  });

  it('marks subscribed remote audio as playable', async () => {
    const room = createRoom();
    render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services: createServices(),
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );
    act(() => room.emitRemoteAudio());
    expect(screen.getByTestId('remote-audio').textContent).toBe('yes');
  });

  it('disconnects and refreshes after the initial connection timeout', async () => {
    jest.useFakeTimers();
    const room = createRoom();
    room.connect = jest.fn(() => new Promise(() => undefined));
    const refresh = jest.fn();
    render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services: createServices(),
          refresh,
          connectTimeoutMs: 15_000,
        }}
      />,
    );

    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(room.disconnect).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('phase').textContent).toBe('error');
  });

  it('identifies microphone publication as the failed connection stage', async () => {
    const room = createRoom();
    room.publishMicrophone.mockRejectedValueOnce(
      new Error('microphone publication rejected'),
    );
    render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services: createServices(),
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('error'),
    );
    expect(screen.getByTestId('error').textContent).toBe(
      '已连接房间，但麦克风发布失败',
    );
  });

  it('requests a token for the same handoff after a network disconnect', async () => {
    const firstRoom = createRoom();
    const reconnectRoom = createRoom();
    const roomFactory = jest
      .fn()
      .mockReturnValueOnce(firstRoom)
      .mockReturnValueOnce(reconnectRoom);
    const services = createServices();
    render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory,
          services,
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );

    act(() => firstRoom.emitDisconnected());
    await waitFor(() =>
      expect(services.reconnectToken).toHaveBeenCalledTimes(1),
    );
    expect(services.reconnectToken).toHaveBeenCalledWith(
      credential.handoff.handoff_id,
      expect.objectContaining({ consoleSessionId: 'session-1' }),
    );
    await waitFor(() =>
      expect(reconnectRoom.connect).toHaveBeenCalledWith(
        credential.livekit_url,
        'reconnect-token',
      ),
    );
    await waitFor(() => expect(services.mediaReady).toHaveBeenCalledTimes(2));
  });

  it('enters wrap-up without reconnecting when LiveKit deletes the room', async () => {
    const room = createRoom();
    const services = createServices();
    const onWrapUp = jest.fn();
    render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services,
          onWrapUp,
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );

    act(() => room.emitDisconnected(5));

    await waitFor(() =>
      expect(onWrapUp).toHaveBeenCalledWith(credential.handoff),
    );
    expect(services.reconnectToken).not.toHaveBeenCalled();
    expect(screen.getByTestId('phase').textContent).toBe('wrap_up_quick');
  });

  it('enters wrap-up on reconnect timeout without claiming another task', async () => {
    const room = createRoom();
    const services = createServices();
    services.reconnectToken.mockRejectedValueOnce({
      data: { errorCode: 'AGENT_RECONNECT_TIMEOUT' },
    });
    const onWrapUp = jest.fn();
    render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services,
          onWrapUp,
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );
    act(() => room.emitDisconnected());

    await waitFor(() =>
      expect(onWrapUp).toHaveBeenCalledWith(
        credential.handoff,
        '坐席网络重连超时，通话已转入话后处理',
      ),
    );
    expect(screen.getByTestId('phase').textContent).toBe('wrap_up_quick');
  });

  it('enters wrap-up when the handoff is already terminal during reconnect', async () => {
    const room = createRoom();
    const services = createServices();
    services.reconnectToken.mockRejectedValueOnce({
      response: {
        code: 500,
        data: { errorCode: 'HANDOFF_STATE_CONFLICT' },
      },
    });
    const onWrapUp = jest.fn();
    render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services,
          onWrapUp,
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );
    act(() => room.emitDisconnected());

    await waitFor(() =>
      expect(onWrapUp).toHaveBeenCalledWith(credential.handoff),
    );
    expect(screen.getByTestId('phase').textContent).toBe('wrap_up_quick');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('completes through the backend, while unmount only disconnects local media', async () => {
    const room = createRoom();
    const services = createServices();
    const onWrapUp = jest.fn();
    const view = render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services,
          onWrapUp,
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );
    fireEvent.click(screen.getByRole('button', { name: '结束' }));
    await waitFor(() => expect(services.complete).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('ended'),
    );
    expect(room.disconnect).toHaveBeenCalledTimes(1);
    expect(onWrapUp).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(services.complete).toHaveBeenCalledTimes(1);
  });

  it('restores a retryable connected state when completion fails', async () => {
    const room = createRoom();
    const services = createServices();
    const refresh = jest.fn().mockResolvedValue(undefined);
    services.complete
      .mockRejectedValueOnce({
        response: { data: { msg: '通话状态写入失败' } },
      })
      .mockResolvedValueOnce({ code: 200 });
    render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services,
          refresh,
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );

    fireEvent.click(screen.getByRole('button', { name: '结束' }));

    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );
    expect(screen.getByTestId('error').textContent).toBe('通话状态写入失败');
    expect(room.disconnect).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '结束' }));
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('ended'),
    );
    expect(services.complete).toHaveBeenCalledTimes(2);
    expect(room.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not request a reconnect token while completion is pending', async () => {
    const room = createRoom();
    const services = createServices();
    let resolveComplete: ((value: { code: number }) => void) | undefined;
    services.complete.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveComplete = resolve;
        }),
    );
    render(
      <Harness
        options={{
          credential,
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services,
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );

    fireEvent.click(screen.getByRole('button', { name: '结束' }));
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('ending'),
    );
    act(() => room.emitDisconnected());
    await act(async () => {
      await Promise.resolve();
    });

    expect(services.reconnectToken).not.toHaveBeenCalled();

    await act(async () => {
      resolveComplete?.({ code: 200 });
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('ended'),
    );
  });
});

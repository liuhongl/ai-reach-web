import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as React from 'react';
import { useFollowUpCallback } from './useFollowUpCallback';

jest.mock('livekit-client', () => ({
  ConnectionQuality: {},
  DisconnectReason: { ROOM_DELETED: 1, PARTICIPANT_REMOVED: 2 },
  RoomEvent: {},
  Track: { Kind: { Audio: 'audio' } },
  Room: jest.fn(),
  createLocalAudioTrack: jest.fn(),
}));

const credential = {
  call_id: 'call-callback-1',
  status: 'accepted' as const,
  livekit_url: 'wss://livekit.example.com',
  participant_token: 'callback-token',
  participant_identity: 'human-callback-call-callback-1',
  expires_in_seconds: 60,
};

const createRoom = () => {
  let disconnected: ((reason?: number) => void) | undefined;
  let remoteAudio: (() => void) | undefined;
  let sipCallStatus: ((status: string) => void) | undefined;
  let remoteParticipantDisconnected: (() => void) | undefined;
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
    onSipCallStatus: jest.fn((handler) => {
      sipCallStatus = handler;
    }),
    onRemoteParticipantDisconnected: jest.fn((handler) => {
      remoteParticipantDisconnected = handler;
    }),
    onNetworkQuality: jest.fn(),
    emitDisconnected: (reason?: number) => disconnected?.(reason),
    emitRemoteAudio: () => remoteAudio?.(),
    emitSipCallStatus: (status: string) => sipCallStatus?.(status),
    emitRemoteParticipantDisconnected: () => remoteParticipantDisconnected?.(),
  };
};

const Harness = ({ options }: { options: any }) => {
  const call = useFollowUpCallback(options);
  const [endResult, setEndResult] = React.useState('');
  return (
    <div>
      <span data-testid="phase">{call.phase}</span>
      <span data-testid="remote-audio">
        {call.remoteAudioReady ? 'yes' : 'no'}
      </span>
      <span data-testid="end-result">{endResult}</span>
      <button
        type="button"
        onClick={() =>
          void call.endCall().then((result) => setEndResult(String(result)))
        }
      >
        结束
      </button>
    </div>
  );
};

describe('useFollowUpCallback', () => {
  afterEach(cleanup);

  it('joins the callback room, publishes the microphone, and ends the SIP call', async () => {
    const room = createRoom();
    const end = jest.fn().mockResolvedValue({ code: 200 });
    render(
      <Harness
        options={{
          credential,
          followUpId: 'follow-up-1',
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services: { end },
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );
    expect(room.connect).toHaveBeenCalledWith(
      credential.livekit_url,
      credential.participant_token,
    );
    expect(room.publishMicrophone).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '结束' }));

    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('ended'),
    );
    expect(screen.getByTestId('end-result').textContent).toBe('true');
    expect(end).toHaveBeenCalledWith(
      'follow-up-1',
      credential.call_id,
      expect.objectContaining({ consoleSessionId: 'session-1' }),
    );
    expect(room.disconnect).toHaveBeenCalledTimes(1);
  });

  it('treats a terminal LiveKit disconnect as a completed callback', async () => {
    const room = createRoom();
    render(
      <Harness
        options={{
          credential,
          followUpId: 'follow-up-1',
          consoleSessionId: 'session-1',
          roomFactory: () => room,
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );
    act(() => room.emitDisconnected(1));

    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('ended'),
    );
  });

  it('marks callback audio ready only after the SIP call becomes active', async () => {
    const room = createRoom();
    const confirmConnected = jest.fn().mockResolvedValue({ code: 200 });
    render(
      <Harness
        options={{
          credential,
          followUpId: 'follow-up-1',
          consoleSessionId: 'session-1',
          roomFactory: () => room,
          services: { end: jest.fn(), confirmConnected },
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('connected'),
    );
    act(() => room.emitRemoteAudio());
    expect(screen.getByTestId('remote-audio').textContent).toBe('no');

    act(() => room.emitSipCallStatus('ringing'));
    expect(confirmConnected).not.toHaveBeenCalled();
    act(() => room.emitSipCallStatus('active'));

    await waitFor(() =>
      expect(screen.getByTestId('remote-audio').textContent).toBe('yes'),
    );
    expect(confirmConnected).toHaveBeenCalledWith(
      'follow-up-1',
      credential.call_id,
      expect.objectContaining({ consoleSessionId: 'session-1' }),
    );

    act(() => room.emitRemoteParticipantDisconnected());
    await waitFor(() =>
      expect(screen.getByTestId('phase').textContent).toBe('ended'),
    );
  });
});

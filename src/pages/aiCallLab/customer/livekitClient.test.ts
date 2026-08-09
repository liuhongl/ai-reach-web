import { createLocalAudioTrack, Room } from 'livekit-client';
import { connectAiCallLabRoom } from './livekitClient';

jest.mock('livekit-client', () => ({
  __mockLiveKit: {
    audioTrack: {
      mute: jest.fn(),
      stop: jest.fn(),
      unmute: jest.fn(),
    },
    publishTrack: jest.fn(),
    roomConnect: jest.fn(),
    roomDisconnect: jest.fn(),
    roomHandlers: new Map(),
  },
  RoomEvent: {
    Disconnected: 'disconnected',
    TrackSubscribed: 'trackSubscribed',
  },
  Room: jest.fn().mockImplementation(() => {
    const { __mockLiveKit } = jest.requireMock('livekit-client');
    return {
      connect: __mockLiveKit.roomConnect,
      disconnect: __mockLiveKit.roomDisconnect,
      localParticipant: {
        publishTrack: __mockLiveKit.publishTrack,
      },
      on: jest.fn((eventName, handler) => {
        __mockLiveKit.roomHandlers.set(eventName, handler);
      }),
    };
  }),
  createLocalAudioTrack: jest.fn().mockImplementation(() => {
    const { __mockLiveKit } = jest.requireMock('livekit-client');
    return Promise.resolve(__mockLiveKit.audioTrack);
  }),
}));

const liveKitMock = jest.requireMock('livekit-client').__mockLiveKit;

describe('connectAiCallLabRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    liveKitMock.roomHandlers.clear();
  });

  it('uses participantToken returned by the backend to connect LiveKit', async () => {
    await connectAiCallLabRoom({
      callId: 'call-1',
      livekitUrl: 'http://127.0.0.1:7880',
      participantToken: 'participant-token-1',
    });

    expect(Room).toHaveBeenCalledWith({
      adaptiveStream: true,
      dynacast: true,
    });
    expect(createLocalAudioTrack).toHaveBeenCalledWith({
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
    });
    expect(liveKitMock.roomConnect).toHaveBeenCalledWith(
      'http://127.0.0.1:7880',
      'participant-token-1',
    );
    expect(liveKitMock.publishTrack).toHaveBeenCalled();
  });

  it('attaches subscribed remote audio tracks for playback', async () => {
    await connectAiCallLabRoom({
      callId: 'call-1',
      livekitUrl: 'http://127.0.0.1:7880',
      participantToken: 'participant-token-1',
    });

    const remoteAudio = document.createElement('audio');
    const play = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(remoteAudio, 'play', { value: play });
    const remoteTrack = {
      attach: jest.fn(() => remoteAudio),
      kind: 'audio',
    };

    liveKitMock.roomHandlers.get('trackSubscribed')?.(remoteTrack);

    expect(remoteTrack.attach).toHaveBeenCalled();
    expect(remoteAudio.autoplay).toBe(true);
    expect(remoteAudio.muted).toBe(false);
    expect(
      (remoteAudio as HTMLAudioElement & { playsInline?: boolean }).playsInline,
    ).toBe(true);
    expect(document.body.contains(remoteAudio)).toBe(true);
    expect(play).toHaveBeenCalled();
  });

  it('releases media and notifies when LiveKit disconnects remotely', async () => {
    const onDisconnected = jest.fn();
    await connectAiCallLabRoom(
      {
        callId: 'call-1',
        livekitUrl: 'http://127.0.0.1:7880',
        participantToken: 'participant-token-1',
      },
      onDisconnected,
    );

    const remoteAudio = document.createElement('audio');
    Object.defineProperty(remoteAudio, 'play', {
      value: jest.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(remoteAudio, 'pause', { value: jest.fn() });
    liveKitMock.roomHandlers.get('trackSubscribed')?.({
      attach: jest.fn(() => remoteAudio),
      kind: 'audio',
    });

    liveKitMock.roomHandlers.get('disconnected')?.();

    expect(liveKitMock.audioTrack.stop).toHaveBeenCalledTimes(1);
    expect(document.body.contains(remoteAudio)).toBe(false);
    expect(onDisconnected).toHaveBeenCalledTimes(1);
  });

  it('does not notify a remote disconnect when the browser disconnects locally', async () => {
    const onDisconnected = jest.fn();
    const connection = await connectAiCallLabRoom(
      {
        callId: 'call-1',
        livekitUrl: 'http://127.0.0.1:7880',
        participantToken: 'participant-token-1',
      },
      onDisconnected,
    );
    liveKitMock.roomDisconnect.mockImplementationOnce(async () => {
      liveKitMock.roomHandlers.get('disconnected')?.();
    });

    await connection.disconnect();

    expect(onDisconnected).not.toHaveBeenCalled();
    expect(liveKitMock.audioTrack.stop).toHaveBeenCalledTimes(1);
  });

  it('releases the local track and room when LiveKit connect fails', async () => {
    liveKitMock.roomConnect.mockRejectedValueOnce(
      new Error('LiveKit unavailable'),
    );

    await expect(
      connectAiCallLabRoom({
        callId: 'call-1',
        livekitUrl: 'http://127.0.0.1:7880',
        participantToken: 'participant-token-1',
      }),
    ).rejects.toThrow('LiveKit unavailable');

    expect(liveKitMock.audioTrack.stop).toHaveBeenCalledTimes(1);
    expect(liveKitMock.roomDisconnect).toHaveBeenCalledWith(true);
  });

  it('releases the local track and room when microphone publishing fails', async () => {
    liveKitMock.publishTrack.mockRejectedValueOnce(
      new Error('publish rejected'),
    );

    await expect(
      connectAiCallLabRoom({
        callId: 'call-1',
        livekitUrl: 'http://127.0.0.1:7880',
        participantToken: 'participant-token-1',
      }),
    ).rejects.toThrow('publish rejected');

    expect(liveKitMock.audioTrack.stop).toHaveBeenCalledTimes(1);
    expect(liveKitMock.roomDisconnect).toHaveBeenCalledWith(true);
  });
});

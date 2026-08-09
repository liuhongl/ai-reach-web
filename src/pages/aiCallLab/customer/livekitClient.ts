import { createLocalAudioTrack, Room, RoomEvent } from 'livekit-client';
import type { AiCallLabSession } from '@/services/ruoyi/ai-call-lab';

export type AiCallLabRoomConnection = {
  disconnect: () => Promise<void>;
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
};

export const connectAiCallLabRoom = async (
  session: AiCallLabSession,
  onDisconnected?: () => void,
): Promise<AiCallLabRoomConnection> => {
  const token = session.participantToken || session.token;
  if (!session.livekitUrl || !token) {
    throw new Error('缺少 LiveKit 连接信息');
  }

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });
  const remoteAudioElements: HTMLMediaElement[] = [];
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind !== 'audio') return;
    const media = track.attach();
    const playableMedia = media as HTMLMediaElement & {
      playsInline?: boolean;
    };
    media.autoplay = true;
    media.muted = false;
    playableMedia.playsInline = true;
    document.body.appendChild(media);
    remoteAudioElements.push(media);
    void media.play().catch(() => undefined);
  });
  const audioTrack = await createLocalAudioTrack({
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
  });
  let disconnectingLocally = false;
  let mediaReleased = false;

  const releaseMedia = () => {
    if (mediaReleased) return;
    mediaReleased = true;
    audioTrack.stop();
    remoteAudioElements.forEach((media) => {
      media.pause();
      media.remove();
    });
    remoteAudioElements.length = 0;
  };

  room.on(RoomEvent.Disconnected, () => {
    releaseMedia();
    if (!disconnectingLocally) onDisconnected?.();
  });

  const disconnect = async () => {
    disconnectingLocally = true;
    releaseMedia();
    await room.disconnect(true);
  };

  try {
    await room.connect(session.livekitUrl, token);
    await room.localParticipant.publishTrack(audioTrack);
  } catch (error) {
    try {
      await disconnect();
    } catch {
      // 保留原始入会错误；清理失败不应覆盖根因。
    }
    throw error;
  }

  return {
    disconnect,
    setMicrophoneEnabled: async (enabled: boolean) => {
      if (enabled) {
        await audioTrack.unmute();
        return;
      }
      await audioTrack.mute();
    },
  };
};

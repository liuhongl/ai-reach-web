import { DisconnectReason } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  endFollowUpCall,
  type FollowUpCallbackCredentialDto,
  type IdempotentSessionInput,
} from '@/services/ruoyi/agent-console';
import {
  type AgentCallConnectionStage,
  type AgentCallPhase,
  type AgentNetworkQuality,
  type AgentRoomConnection,
  createLiveKitAgentRoom,
} from './useAgentCall';

type FollowUpCallbackServices = {
  end: typeof endFollowUpCall;
};

export type UseFollowUpCallbackOptions = {
  credential?: FollowUpCallbackCredentialDto;
  followUpId?: string;
  consoleSessionId?: string;
  roomFactory?: () => AgentRoomConnection;
  services?: FollowUpCallbackServices;
  refresh?: () => void | Promise<void>;
};

const defaultServices: FollowUpCallbackServices = { end: endFollowUpCall };

const idempotencyInput = (
  consoleSessionId: string,
): IdempotentSessionInput => ({
  consoleSessionId,
  idempotencyKey: crypto.randomUUID(),
});

export const useFollowUpCallback = ({
  credential,
  followUpId,
  consoleSessionId,
  roomFactory = createLiveKitAgentRoom,
  services = defaultServices,
  refresh,
}: UseFollowUpCallbackOptions) => {
  const [phase, setPhase] = useState<AgentCallPhase>('idle');
  const [connectionStage, setConnectionStage] =
    useState<AgentCallConnectionStage>('idle');
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [remoteAudioReady, setRemoteAudioReady] = useState(false);
  const [networkQuality, setNetworkQuality] =
    useState<AgentNetworkQuality>('unknown');
  const [errorMessage, setErrorMessage] = useState('');
  const roomRef = useRef<AgentRoomConnection | undefined>(undefined);
  const generationRef = useRef(0);
  const intentionalDisconnectRef = useRef(false);
  const endingRef = useRef(false);

  const disconnectRoom = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = undefined;
    if (!room) return;
    intentionalDisconnectRef.current = true;
    try {
      await room.disconnect();
    } finally {
      intentionalDisconnectRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!credential || !consoleSessionId) {
      setPhase('idle');
      setConnectionStage('idle');
      return;
    }
    const generation = ++generationRef.current;
    const room = roomFactory();
    roomRef.current = room;
    setPhase('connecting');
    setConnectionStage('livekit_connecting');
    setRemoteAudioReady(false);
    setErrorMessage('');
    room.onRemoteAudio(() => {
      if (generation === generationRef.current) setRemoteAudioReady(true);
    });
    room.onNetworkQuality((quality) => {
      if (generation === generationRef.current) setNetworkQuality(quality);
    });
    room.onDisconnected((reason) => {
      if (
        generation !== generationRef.current ||
        intentionalDisconnectRef.current ||
        endingRef.current
      ) {
        return;
      }
      if (
        reason === DisconnectReason.ROOM_DELETED ||
        reason === DisconnectReason.PARTICIPANT_REMOVED
      ) {
        setPhase('ended');
        setErrorMessage('通话已挂断，正在同步处理结果');
        void refresh?.();
        return;
      }
      setPhase('error');
      setErrorMessage('浏览器音频连接已断开，请刷新页面确认回拨状态');
      void refresh?.();
    });
    void (async () => {
      try {
        await room.connect(
          credential.livekit_url,
          credential.participant_token,
        );
        if (generation !== generationRef.current) return;
        setConnectionStage('livekit_connected');
        setConnectionStage('microphone_publishing');
        await room.publishMicrophone();
        if (generation !== generationRef.current) return;
        setConnectionStage('connected');
        setPhase('connected');
      } catch {
        if (generation !== generationRef.current) return;
        await disconnectRoom();
        setPhase('error');
        setErrorMessage(
          '回拨已受理，但浏览器音频接入失败，请刷新后确认通话状态',
        );
        void refresh?.();
      }
    })();
    return () => {
      generationRef.current += 1;
      void disconnectRoom();
    };
  }, [consoleSessionId, credential, disconnectRoom, refresh, roomFactory]);

  const toggleMicrophone = useCallback(async () => {
    const enabled = !microphoneEnabled;
    await roomRef.current?.setMicrophoneEnabled(enabled);
    setMicrophoneEnabled(enabled);
  }, [microphoneEnabled]);

  const switchAudioInput = useCallback(async (deviceId: string) => {
    await roomRef.current?.switchAudioInput(deviceId);
  }, []);

  const endCall = useCallback(async () => {
    if (!credential || !followUpId || !consoleSessionId || endingRef.current)
      return false;
    endingRef.current = true;
    setPhase('ending');
    setErrorMessage('');
    try {
      await services.end(
        followUpId,
        credential.call_id,
        idempotencyInput(consoleSessionId),
      );
      await disconnectRoom();
      setPhase('ended');
      void refresh?.();
      return true;
    } catch {
      setPhase('connected');
      setErrorMessage('结束通话失败，请重试');
      return false;
    } finally {
      endingRef.current = false;
    }
  }, [
    consoleSessionId,
    credential,
    disconnectRoom,
    followUpId,
    refresh,
    services,
  ]);

  return {
    phase,
    connectionStage,
    microphoneEnabled,
    remoteAudioReady,
    networkQuality,
    errorMessage,
    toggleMicrophone,
    switchAudioInput,
    endCall,
  };
};

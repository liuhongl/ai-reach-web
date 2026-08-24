import {
  type ConnectionQuality,
  createLocalAudioTrack,
  DisconnectReason,
  type LocalAudioTrack,
  type Participant,
  type RemoteTrack,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  completeHandoff,
  confirmHandoffMediaReady,
  getHandoffReconnectToken,
  type HandoffDto,
  type IdempotentSessionInput,
  type MediaCredentialDto,
} from '@/services/ruoyi/agent-console';

export type AgentCallPhase =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ending'
  | 'ended'
  | 'wrap_up_quick'
  | 'error';

export type AgentCallConnectionStage =
  | 'idle'
  | 'livekit_connecting'
  | 'livekit_connected'
  | 'microphone_publishing'
  | 'microphone_published'
  | 'media_ready_reporting'
  | 'connected';

export type AgentNetworkQuality =
  | 'excellent'
  | 'good'
  | 'poor'
  | 'lost'
  | 'unknown';

export type AgentRoomConnection = {
  connect: (url: string, token: string) => Promise<void>;
  publishMicrophone: () => Promise<void>;
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
  switchAudioInput: (deviceId: string) => Promise<void>;
  disconnect: () => Promise<void> | void;
  onDisconnected: (handler: (reason?: DisconnectReason) => void) => void;
  onRemoteAudio: (handler: () => void) => void;
  onSipCallStatus?: (handler: (status: string) => void) => void;
  onRemoteParticipantDisconnected?: (handler: () => void) => void;
  onNetworkQuality: (handler: (quality: AgentNetworkQuality) => void) => void;
};

type AgentCallServices = {
  mediaReady: typeof confirmHandoffMediaReady;
  reconnectToken: typeof getHandoffReconnectToken;
  complete: typeof completeHandoff;
};

export type UseAgentCallOptions = {
  credential?: MediaCredentialDto;
  consoleSessionId?: string;
  roomFactory?: () => AgentRoomConnection;
  services?: AgentCallServices;
  refresh?: () => void | Promise<void>;
  onWrapUp?: (handoff: HandoffDto, abnormalReason?: string) => void;
  connectTimeoutMs?: number;
};

const defaultServices: AgentCallServices = {
  mediaReady: confirmHandoffMediaReady,
  reconnectToken: getHandoffReconnectToken,
  complete: completeHandoff,
};

const idempotencyInput = (
  consoleSessionId: string,
): IdempotentSessionInput => ({
  consoleSessionId,
  idempotencyKey: crypto.randomUUID(),
});

const readErrorCode = (value: unknown) => {
  if (!value || typeof value !== 'object') return undefined;
  const direct =
    Reflect.get(value, 'errorCode') || Reflect.get(value, 'error_code');
  if (typeof direct === 'string') return direct;
  const data = Reflect.get(value, 'data');
  if (data && typeof data === 'object') {
    const nested =
      Reflect.get(data, 'errorCode') || Reflect.get(data, 'error_code');
    if (typeof nested === 'string') return nested;
  }
  return undefined;
};

const getErrorCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return undefined;
  return (
    readErrorCode(error) ||
    readErrorCode(Reflect.get(error, 'response')) ||
    readErrorCode(Reflect.get(error, 'info'))
  );
};

const readErrorMessage = (value: unknown) => {
  if (!value || typeof value !== 'object') return undefined;
  const direct = Reflect.get(value, 'msg');
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const data = Reflect.get(value, 'data');
  if (data && typeof data === 'object') {
    const nested = Reflect.get(data, 'msg');
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return undefined;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object') {
    const businessMessage =
      readErrorMessage(error) ||
      readErrorMessage(Reflect.get(error, 'response')) ||
      readErrorMessage(Reflect.get(error, 'info'));
    if (businessMessage) return businessMessage;
  }
  if (
    error instanceof Error &&
    error.message &&
    !/^Request failed with status code \d+$/i.test(error.message)
  ) {
    return error.message;
  }
  return fallback;
};

const stageErrorMessages: Partial<Record<AgentCallConnectionStage, string>> = {
  livekit_connecting: '已认领，但无法连接通话房间',
  livekit_connected: '已连接房间，但麦克风尚未开始发布',
  microphone_publishing: '已连接房间，但麦克风发布失败',
  microphone_published: '麦克风已发布，但坐席状态尚未确认',
  media_ready_reporting: '麦克风已就绪，但坐席状态确认失败',
};

const unwrapCredential = (response: unknown): MediaCredentialDto => {
  if (response && typeof response === 'object') {
    const data = Reflect.get(response, 'data');
    if (
      data &&
      typeof data === 'object' &&
      Reflect.get(data, 'participant_token')
    ) {
      return data as MediaCredentialDto;
    }
  }
  return response as MediaCredentialDto;
};

export const createLiveKitAgentRoom = (): AgentRoomConnection => {
  const room = new Room({ adaptiveStream: true, dynacast: true });
  let localAudioTrack: LocalAudioTrack | undefined;
  let disconnectHandler: ((reason?: DisconnectReason) => void) | undefined;
  let remoteAudioHandler: (() => void) | undefined;
  let sipCallStatusHandler: ((status: string) => void) | undefined;
  let remoteParticipantDisconnectedHandler: (() => void) | undefined;
  let qualityHandler: ((quality: AgentNetworkQuality) => void) | undefined;
  const attachedAudio = new Set<HTMLMediaElement>();
  const notifySipCallStatus = (participant: Participant) => {
    if (!participant.identity.startsWith('sip-')) return;
    const status = participant.attributes?.['sip.callStatus'];
    if (status) sipCallStatusHandler?.(status);
  };

  room.on(RoomEvent.Disconnected, (reason) => disconnectHandler?.(reason));
  room.on(RoomEvent.ParticipantConnected, notifySipCallStatus);
  room.on(
    RoomEvent.ParticipantAttributesChanged,
    (changed: Record<string, string>, participant: Participant) => {
      const status = changed['sip.callStatus'];
      if (status && participant.identity.startsWith('sip-')) {
        sipCallStatusHandler?.(status);
      }
    },
  );
  room.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
    if (participant.identity.startsWith('sip-')) {
      remoteParticipantDisconnectedHandler?.();
    }
  });
  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
    if (track.kind !== Track.Kind.Audio) return;
    const element = track.attach();
    element.autoplay = true;
    element.dataset.agentRemoteAudio = 'true';
    document.body.appendChild(element);
    attachedAudio.add(element);
    void element.play().catch(() => undefined);
    remoteAudioHandler?.();
  });
  room.on(
    RoomEvent.ConnectionQualityChanged,
    (quality: ConnectionQuality, participant: Participant) => {
      if (participant === room.localParticipant) {
        qualityHandler?.(quality as AgentNetworkQuality);
      }
    },
  );

  return {
    connect: (url, token) => room.connect(url, token),
    publishMicrophone: async () => {
      localAudioTrack = await createLocalAudioTrack({
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      });
      await room.localParticipant.publishTrack(localAudioTrack);
    },
    setMicrophoneEnabled: async (enabled) => {
      if (localAudioTrack) {
        if (enabled) await localAudioTrack.unmute();
        else await localAudioTrack.mute();
        return;
      }
      await room.localParticipant.setMicrophoneEnabled(enabled);
    },
    switchAudioInput: async (deviceId) => {
      await room.switchActiveDevice('audioinput', deviceId, true);
    },
    disconnect: async () => {
      localAudioTrack?.stop();
      localAudioTrack = undefined;
      await room.disconnect();
      for (const element of attachedAudio) element.remove();
      attachedAudio.clear();
    },
    onDisconnected: (handler) => {
      disconnectHandler = handler;
    },
    onRemoteAudio: (handler) => {
      remoteAudioHandler = handler;
    },
    onSipCallStatus: (handler) => {
      sipCallStatusHandler = handler;
      room.remoteParticipants.forEach(notifySipCallStatus);
    },
    onRemoteParticipantDisconnected: (handler) => {
      remoteParticipantDisconnectedHandler = handler;
    },
    onNetworkQuality: (handler) => {
      qualityHandler = handler;
    },
  };
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('连接超时')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const useAgentCall = ({
  credential,
  consoleSessionId,
  roomFactory = createLiveKitAgentRoom,
  services = defaultServices,
  refresh,
  onWrapUp,
  connectTimeoutMs = 15_000,
}: UseAgentCallOptions) => {
  const [phase, setPhase] = useState<AgentCallPhase>('idle');
  const [connectionStage, setConnectionStage] =
    useState<AgentCallConnectionStage>('idle');
  const [microphoneEnabled, setMicrophoneEnabledState] = useState(true);
  const [remoteAudioReady, setRemoteAudioReady] = useState(false);
  const [networkQuality, setNetworkQuality] =
    useState<AgentNetworkQuality>('unknown');
  const [errorMessage, setErrorMessage] = useState('');
  const roomRef = useRef<AgentRoomConnection | undefined>(undefined);
  const generationRef = useRef(0);
  const connectionStageRef = useRef<AgentCallConnectionStage>('idle');
  const intentionalDisconnectRef = useRef(false);
  const reconnectingRef = useRef(false);
  const endingRef = useRef(false);
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const updateConnectionStage = useCallback(
    (stage: AgentCallConnectionStage) => {
      connectionStageRef.current = stage;
      setConnectionStage(stage);
    },
    [],
  );

  const disconnectCurrentRoom = useCallback(async () => {
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

  const connectCredential = useCallback(
    async (nextCredential: MediaCredentialDto, reconnecting: boolean) => {
      const generation = ++generationRef.current;
      const room = roomFactory();
      roomRef.current = room;
      intentionalDisconnectRef.current = false;
      setPhase(reconnecting ? 'reconnecting' : 'connecting');
      updateConnectionStage('livekit_connecting');
      setErrorMessage('');
      setRemoteAudioReady(false);
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
          reconnectingRef.current ||
          endingRef.current
        ) {
          return;
        }
        if (
          reason === DisconnectReason.ROOM_DELETED ||
          reason === DisconnectReason.PARTICIPANT_REMOVED
        ) {
          setPhase('wrap_up_quick');
          setErrorMessage('');
          onWrapUp?.(nextCredential.handoff);
          return;
        }
        reconnectingRef.current = true;
        setPhase('reconnecting');
        void services
          .reconnectToken(
            nextCredential.handoff.handoff_id,
            idempotencyInput(consoleSessionId || ''),
          )
          .then(async (response) => {
            const reconnectCredential = unwrapCredential(response);
            intentionalDisconnectRef.current = true;
            await room.disconnect();
            intentionalDisconnectRef.current = false;
            await connectCredential(reconnectCredential, true);
          })
          .catch((error) => {
            const errorCode = getErrorCode(error);
            if (errorCode === 'AGENT_RECONNECT_TIMEOUT') {
              const reason = '坐席网络重连超时，通话已转入话后处理';
              setPhase('wrap_up_quick');
              setErrorMessage(reason);
              onWrapUp?.(nextCredential.handoff, reason);
              return;
            }
            if (errorCode === 'HANDOFF_STATE_CONFLICT') {
              setPhase('wrap_up_quick');
              setErrorMessage('');
              onWrapUp?.(nextCredential.handoff);
              return;
            }
            setPhase('error');
            setErrorMessage(
              getErrorMessage(error, '网络重连失败，请刷新坐席状态'),
            );
          })
          .finally(() => {
            reconnectingRef.current = false;
          });
      });

      await withTimeout(
        (async () => {
          await room.connect(
            nextCredential.livekit_url,
            nextCredential.participant_token,
          );
          updateConnectionStage('livekit_connected');
          updateConnectionStage('microphone_publishing');
          await room.publishMicrophone();
          updateConnectionStage('microphone_published');
        })(),
        connectTimeoutMs,
      );
      if (generation !== generationRef.current) return;
      if (!reconnecting) {
        updateConnectionStage('media_ready_reporting');
        await services.mediaReady(nextCredential.handoff.handoff_id, {
          ...idempotencyInput(consoleSessionId || ''),
          participantIdentity: nextCredential.participant_identity,
        });
      }
      updateConnectionStage('connected');
      setPhase('connected');
    },
    [
      connectTimeoutMs,
      consoleSessionId,
      onWrapUp,
      roomFactory,
      services,
      updateConnectionStage,
    ],
  );

  useEffect(() => {
    if (!credential || !consoleSessionId) {
      setPhase('idle');
      updateConnectionStage('idle');
      return;
    }
    let active = true;
    void connectCredential(credential, false).catch(async (error) => {
      if (!active) return;
      await disconnectCurrentRoom();
      setPhase('error');
      setErrorMessage(
        stageErrorMessages[connectionStageRef.current] ||
          getErrorMessage(error, '人工通话接入失败，请刷新坐席状态'),
      );
      await refreshRef.current?.();
    });
    return () => {
      active = false;
      generationRef.current += 1;
      void disconnectCurrentRoom();
    };
  }, [
    connectCredential,
    consoleSessionId,
    credential,
    disconnectCurrentRoom,
    updateConnectionStage,
  ]);

  const toggleMicrophone = useCallback(async () => {
    const nextEnabled = !microphoneEnabled;
    await roomRef.current?.setMicrophoneEnabled(nextEnabled);
    setMicrophoneEnabledState(nextEnabled);
  }, [microphoneEnabled]);

  const switchAudioInput = useCallback(async (deviceId: string) => {
    await roomRef.current?.switchAudioInput(deviceId);
  }, []);

  const endCall = useCallback(async () => {
    if (
      !credential ||
      !consoleSessionId ||
      phase === 'ending' ||
      endingRef.current
    ) {
      return;
    }
    endingRef.current = true;
    setPhase('ending');
    setErrorMessage('');
    try {
      await services.complete(
        credential.handoff.handoff_id,
        idempotencyInput(consoleSessionId),
      );
      await disconnectCurrentRoom();
      setPhase('ended');
      onWrapUp?.(credential.handoff);
    } catch (error) {
      setPhase('connected');
      setErrorMessage(getErrorMessage(error, '结束通话失败，请重试'));
      try {
        await refreshRef.current?.();
      } catch {
        // 保留原始结束错误，状态刷新失败由下一次心跳或手动重试继续收敛。
      }
    } finally {
      endingRef.current = false;
    }
  }, [
    consoleSessionId,
    credential,
    disconnectCurrentRoom,
    onWrapUp,
    phase,
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RuoyiResponse } from '@/adapters/ruoyi/response';
import {
  type AgentConsoleBootstrapDto,
  type AgentPresenceDto,
  type AgentProfileDto,
  getAgentConsoleBootstrap,
  type HandoffDto,
  heartbeatAgent,
  pauseAgent,
  setAgentOffline,
  setAgentOnline,
} from '@/services/ruoyi/agent-console';
import { isRetryableReadError, readWithGatewayRetry } from '../utils/readRetry';

export type DeviceCheckState = 'idle' | 'checking' | 'passed' | 'failed';

export type DevicePreflightResult = {
  ok: boolean;
  checks: {
    microphone: DeviceCheckState;
    inputLevel: DeviceCheckState;
    audioPlayback: DeviceCheckState;
    browser: DeviceCheckState;
    network: DeviceCheckState;
  };
  inputLevelPercent?: number;
  message?: string;
};

type ServiceResponse<T> = Promise<RuoyiResponse<T> | T>;

export type AgentPresenceServices = {
  bootstrap: () => ServiceResponse<AgentConsoleBootstrapDto>;
  online: (input: {
    consoleSessionId: string;
    devicePreflightPassed: boolean;
  }) => ServiceResponse<AgentPresenceDto>;
  pause: (input: {
    consoleSessionId: string;
  }) => ServiceResponse<AgentPresenceDto>;
  offline: (input: {
    consoleSessionId: string;
  }) => ServiceResponse<AgentPresenceDto>;
  heartbeat: (input: {
    consoleSessionId: string;
  }) => ServiceResponse<AgentPresenceDto>;
};

export type UseAgentPresenceOptions = {
  services?: AgentPresenceServices;
  devicePreflight?: () => Promise<DevicePreflightResult>;
  heartbeatIntervalMs?: number;
  suppressExistingSessionMessage?: boolean;
};

export type AgentPresencePhase =
  | 'loading'
  | 'ready'
  | 'checking'
  | 'updating'
  | 'blocked'
  | 'error';

export type AgentBlockReason = 'unregistered' | 'disabled' | '';

const SESSION_STORAGE_KEY = 'agent-workbench:console-session-id';
const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000;

const emptyChecks: DevicePreflightResult['checks'] = {
  microphone: 'idle',
  inputLevel: 'idle',
  audioPlayback: 'idle',
  browser: 'idle',
  network: 'idle',
};

const defaultServices: AgentPresenceServices = {
  bootstrap: getAgentConsoleBootstrap,
  online: setAgentOnline,
  pause: pauseAgent,
  offline: setAgentOffline,
  heartbeat: heartbeatAgent,
};

const unwrapData = <T>(response: RuoyiResponse<T> | T): T => {
  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    (response as RuoyiResponse<T>).data !== undefined
  ) {
    return (response as RuoyiResponse<T>).data as T;
  }
  return response as T;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '坐席状态加载失败，请稍后重试';

const resolveBlockReason = (error: unknown): AgentBlockReason => {
  const message = getErrorMessage(error);
  if (message.includes('停用') || message.includes('禁用')) return 'disabled';
  if (
    message.includes('未开通') ||
    message.includes('未建档') ||
    message.includes('档案不存在')
  ) {
    return 'unregistered';
  }
  return '';
};

export const getOrCreateConsoleSessionId = () => {
  const randomUuid = globalThis.crypto?.randomUUID;
  const createSessionId = () => {
    if (typeof randomUuid === 'function') {
      return randomUuid.call(globalThis.crypto);
    }
    // ponytail: non-cryptographic HTTP fallback; HTTPS restores Web Crypto.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
    });
  };
  const storage = globalThis.sessionStorage;
  if (!storage) return createSessionId();
  const existing = storage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const created = createSessionId();
  storage.setItem(SESSION_STORAGE_KEY, created);
  return created;
};

const failPreflight = (
  checks: DevicePreflightResult['checks'],
  message: string,
): DevicePreflightResult => ({ ok: false, checks, message });

export const runAgentDevicePreflight =
  async (): Promise<DevicePreflightResult> => {
    const checks = { ...emptyChecks };
    const AudioContextClass =
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    const browserSupported = Boolean(
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
        typeof AudioContextClass === 'function' &&
        typeof Reflect.get(globalThis, 'RTCPeerConnection') === 'function',
    );

    checks.browser = browserSupported ? 'passed' : 'failed';
    if (!browserSupported) {
      return failPreflight(
        checks,
        '当前浏览器不支持坐席通话，请使用最新版 Chrome 或 Edge',
      );
    }

    checks.network = navigator.onLine ? 'passed' : 'failed';
    if (!navigator.onLine) {
      return failPreflight(checks, '当前网络不可用，请恢复网络后重新上线');
    }

    let stream: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      checks.microphone = 'passed';

      audioContext = new AudioContextClass();
      await audioContext.resume();
      checks.audioPlayback =
        audioContext.state === 'closed' ? 'failed' : 'passed';

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(samples);
      const peak = samples.reduce(
        (maximum, sample) => Math.max(maximum, Math.abs(sample - 128)),
        0,
      );
      checks.inputLevel = 'passed';
      source.disconnect();

      return {
        ok: true,
        checks,
        inputLevelPercent: Math.min(100, Math.round((peak / 128) * 100)),
      };
    } catch (error) {
      checks.microphone = 'failed';
      const denied =
        error instanceof DOMException &&
        ['NotAllowedError', 'SecurityError'].includes(error.name);
      return failPreflight(
        checks,
        denied
          ? '麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重新上线'
          : '未检测到可用麦克风，请检查设备连接后重新上线',
      );
    } finally {
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
      }
    }
  };

export const useAgentPresence = (options: UseAgentPresenceOptions = {}) => {
  const services = options.services ?? defaultServices;
  const devicePreflight = options.devicePreflight ?? runAgentDevicePreflight;
  const heartbeatIntervalMs =
    options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const suppressExistingSessionMessage =
    options.suppressExistingSessionMessage ?? false;
  const [consoleSessionId] = useState(getOrCreateConsoleSessionId);
  const [phase, setPhase] = useState<AgentPresencePhase>('loading');
  const [blockReason, setBlockReason] = useState<AgentBlockReason>('');
  const [profile, setProfile] = useState<AgentProfileDto>();
  const [presence, setPresence] = useState<AgentPresenceDto>();
  const [currentHandoff, setCurrentHandoff] = useState<HandoffDto>();
  const [deviceResult, setDeviceResult] = useState<DevicePreflightResult>({
    ok: false,
    checks: emptyChecks,
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [serviceRecovering, setServiceRecovering] = useState(false);

  const status = presence?.status ?? (phase === 'ready' ? 'offline' : '');

  const bootstrap = useCallback(async (bootstrapOptions?: {
    reportExistingSession?: boolean;
  }) => {
    setErrorMessage('');
    setServiceRecovering(false);
    try {
      const result = unwrapData(
        await readWithGatewayRetry(services.bootstrap, {
          onRetry: () => {
            setServiceRecovering(true);
            setErrorMessage('坐席服务暂不可用，正在重新连接');
          },
        }),
      );
      setServiceRecovering(false);
      if (!result?.profile) {
        setBlockReason('unregistered');
        setProfile(undefined);
        setPresence(undefined);
        setCurrentHandoff(undefined);
        setPhase('blocked');
        return;
      }
      setProfile(result.profile);
      if (!result.profile.enabled) {
        setBlockReason('disabled');
        setPresence(undefined);
        setCurrentHandoff(undefined);
        setPhase('blocked');
        return;
      }
      setBlockReason('');
      const nextPresence = result.presence ?? {
        agent_identity: result.profile.agent_identity,
        status: 'offline',
      };
      const ownedByAnotherSession =
        nextPresence.status !== 'offline' &&
        Boolean(nextPresence.console_session_id) &&
        nextPresence.console_session_id !== consoleSessionId;
      if (ownedByAnotherSession) {
        setPresence({ ...nextPresence, status: 'offline' });
        setCurrentHandoff(undefined);
        if (
          bootstrapOptions?.reportExistingSession ??
          !suppressExistingSessionMessage
        ) {
          setErrorMessage(
            '当前坐席已在其他页面上线；如确认原页面已关闭，请重新点击上线接听。',
          );
        }
      } else {
        setPresence(nextPresence);
        setCurrentHandoff(result.current_handoff ?? undefined);
      }
      setPhase('ready');
    } catch (error) {
      const gatewayUnavailable = isRetryableReadError(error);
      const reason = resolveBlockReason(error);
      setBlockReason(reason);
      setErrorMessage(
        gatewayUnavailable
          ? '坐席服务暂不可用，请点击重新连接'
          : getErrorMessage(error),
      );
      setServiceRecovering(false);
      setPhase(reason ? 'blocked' : 'error');
    }
  }, [consoleSessionId, services, suppressExistingSessionMessage]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const recover = async () => {
      if (document.visibilityState !== 'visible') return;
      if (status && !['offline', 'paused'].includes(status)) {
        try {
          setPresence(
            unwrapData(await services.heartbeat({ consoleSessionId })),
          );
        } catch {
          // bootstrap 会以服务端状态为准恢复页面。
        }
      }
      await bootstrap();
    };
    const handleRecover = () => {
      void recover();
    };
    window.addEventListener('online', handleRecover);
    window.addEventListener('pageshow', handleRecover);
    document.addEventListener('visibilitychange', handleRecover);
    return () => {
      window.removeEventListener('online', handleRecover);
      window.removeEventListener('pageshow', handleRecover);
      document.removeEventListener('visibilitychange', handleRecover);
    };
  }, [bootstrap, consoleSessionId, services, status]);

  useEffect(() => {
    if (!status || ['offline', 'paused'].includes(status)) return undefined;
    const timer = window.setInterval(() => {
      void services
        .heartbeat({ consoleSessionId })
        .then((response) => {
          const nextPresence = unwrapData(response);
          setPresence(nextPresence);
          if (nextPresence.status === 'offline') {
            setErrorMessage('坐席会话已过期，请重新上线');
          }
        })
        .catch(() => void bootstrap());
    }, heartbeatIntervalMs);
    return () => window.clearInterval(timer);
  }, [bootstrap, consoleSessionId, heartbeatIntervalMs, services, status]);

  const goOnline = useCallback(async () => {
    if (!profile?.enabled) return false;
    setErrorMessage('');
    setPhase('checking');
    const result = await devicePreflight();
    setDeviceResult(result);
    if (!result.ok) {
      setErrorMessage(result.message || '设备预检未通过，请修复后重试');
      setPhase('ready');
      return false;
    }
    setPhase('updating');
    try {
      setPresence(
        unwrapData(
          await services.online({
            consoleSessionId,
            devicePreflightPassed: true,
          }),
        ),
      );
      setPhase('ready');
      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setPhase('error');
      await bootstrap({ reportExistingSession: true });
      return false;
    }
  }, [bootstrap, consoleSessionId, devicePreflight, profile, services]);

  const changePresence = useCallback(
    async (operation: AgentPresenceServices['pause' | 'offline']) => {
      setErrorMessage('');
      setPhase('updating');
      try {
        setPresence(unwrapData(await operation({ consoleSessionId })));
        setPhase('ready');
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
        setPhase('error');
        await bootstrap();
      }
    },
    [bootstrap, consoleSessionId],
  );

  return useMemo(
    () => ({
      phase,
      status,
      profile,
      presence,
      currentHandoff,
      blockReason,
      errorMessage,
      consoleSessionId,
      deviceResult,
      serviceRecovering,
      bootstrap,
      retryBootstrap: bootstrap,
      goOnline,
      pause: () => changePresence(services.pause),
      goOffline: () => changePresence(services.offline),
    }),
    [
      blockReason,
      bootstrap,
      changePresence,
      consoleSessionId,
      deviceResult,
      errorMessage,
      goOnline,
      phase,
      presence,
      profile,
      currentHandoff,
      serviceRecovering,
      services,
      status,
    ],
  );
};

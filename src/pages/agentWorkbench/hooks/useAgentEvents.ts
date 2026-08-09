import {
  EventStreamContentType,
  fetchEventSource,
} from '@microsoft/fetch-event-source';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getClientId } from '@/adapters/ruoyi/env';
import { getToken } from '@/adapters/ruoyi/token';

export const AGENT_CONSOLE_EVENTS_URL =
  '/ai-call-agent-api/ai-call/agent-console/events';

export type AgentEventHandlers = {
  onOpen: () => void;
  onEvent: (event: { type?: string }) => void;
  onError: (error: unknown) => void;
};

export type AgentEventConnector = (handlers: AgentEventHandlers) => () => void;

export type AgentNotificationAdapter = {
  permission: () => NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  show: (title: string, options?: NotificationOptions) => void;
};

export type UseAgentEventsOptions = {
  agentStatus: string;
  refresh: () => void | Promise<void>;
  pollRefresh?: () => void | Promise<void>;
  connector?: AgentEventConnector;
  pollIntervalMs?: number;
  sound?: { play: () => void | Promise<void> };
  notifications?: AgentNotificationAdapter;
};

const NOTIFICATION_REQUESTED_KEY =
  'agent-workbench:notification-permission-requested';
const DEFAULT_POLL_INTERVAL_MS = 3_000;

const parseEventType = (raw: string, fallback?: string) => {
  try {
    const payload = JSON.parse(raw) as { type?: unknown };
    return typeof payload.type === 'string' ? payload.type : fallback;
  } catch {
    return fallback;
  }
};

export const connectAgentEventStream: AgentEventConnector = (handlers) => {
  const controller = new AbortController();
  const token = getToken();
  const headers: Record<string, string> = {
    clientid: getClientId(),
    'Content-Language': 'zh_CN',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  void fetchEventSource(AGENT_CONSOLE_EVENTS_URL, {
    method: 'GET',
    headers,
    signal: controller.signal,
    openWhenHidden: true,
    onopen: async (response) => {
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.startsWith(EventStreamContentType)) {
        throw new Error(`Agent event stream unavailable: ${response.status}`);
      }
      handlers.onOpen();
    },
    onmessage: (event) => {
      handlers.onEvent({ type: parseEventType(event.data, event.event) });
    },
    onclose: () => {
      handlers.onError(new Error('Agent event stream closed'));
      throw new Error('Agent event stream closed');
    },
    onerror: (error) => {
      if (!controller.signal.aborted) handlers.onError(error);
      return DEFAULT_POLL_INTERVAL_MS;
    },
  }).catch((error) => {
    if (!controller.signal.aborted) handlers.onError(error);
  });

  return () => controller.abort();
};

const defaultNotifications: AgentNotificationAdapter = {
  permission: () =>
    typeof Notification === 'undefined' ? 'denied' : Notification.permission,
  requestPermission: () =>
    typeof Notification === 'undefined'
      ? Promise.resolve('denied')
      : Notification.requestPermission(),
  show: (title, options) => {
    if (typeof Notification !== 'undefined') {
      new Notification(title, options);
    }
  },
};

const defaultSound = {
  play: async () => {
    const AudioContextClass =
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    try {
      await context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 740;
      gain.gain.setValueAtTime(0.08, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
    } finally {
      window.setTimeout(() => void context.close(), 250);
    }
  },
};

const isNewHandoffEvent = (type?: string) =>
  type === 'agent.handoff.requested' || type === 'handoff.requested';

export const useAgentEvents = (options: UseAgentEventsOptions) => {
  const connector = options.connector ?? connectAgentEventStream;
  const notifications = options.notifications ?? defaultNotifications;
  const sound = options.sound ?? defaultSound;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const initialTitle = useRef(
    typeof document === 'undefined' ? '' : document.title,
  );
  const [transport, setTransport] = useState<'connecting' | 'sse' | 'polling'>(
    'connecting',
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const refreshRef = useRef(options.refresh);
  refreshRef.current = options.refresh;
  const pollRefreshRef = useRef(options.pollRefresh ?? options.refresh);
  pollRefreshRef.current = options.pollRefresh ?? options.refresh;

  const agentStatus = options.agentStatus;

  const handleEvent = useCallback(
    (event: { type?: string }) => {
      void refreshRef.current();
      if (!isNewHandoffEvent(event.type)) return;
      setUnreadCount((count) => count + 1);
      if (agentStatus !== 'available') return;
      void sound.play();
      if (notifications.permission() === 'granted') {
        notifications.show('有新的待接来电', {
          body: '请返回坐席工作台查看并接听',
          tag: 'agent-handoff-requested',
        });
      }
    },
    [agentStatus, notifications, sound],
  );

  useEffect(() => {
    setTransport('connecting');
    return connector({
      onOpen: () => {
        setTransport('sse');
        void refreshRef.current();
      },
      onEvent: handleEvent,
      onError: () => {
        setTransport('polling');
        void refreshRef.current();
      },
    });
  }, [connector, handleEvent]);

  useEffect(() => {
    const timer = window.setInterval(
      () => void pollRefreshRef.current(),
      pollIntervalMs,
    );
    return () => window.clearInterval(timer);
  }, [pollIntervalMs]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.title = unreadCount
      ? `(${unreadCount}) ${initialTitle.current}`
      : initialTitle.current;
    return () => {
      document.title = initialTitle.current;
    };
  }, [unreadCount]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  const requestNotificationPermission = useCallback(async () => {
    const current = notifications.permission();
    if (current !== 'default') return current;
    if (sessionStorage.getItem(NOTIFICATION_REQUESTED_KEY)) return current;
    sessionStorage.setItem(NOTIFICATION_REQUESTED_KEY, 'true');
    return notifications.requestPermission();
  }, [notifications]);

  return {
    transport,
    unreadCount,
    clearUnread,
    requestNotificationPermission,
  };
};

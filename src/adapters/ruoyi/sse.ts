import {
  type EventSourceMessage,
  EventStreamContentType,
  fetchEventSource,
} from '@microsoft/fetch-event-source';
import { history } from '@umijs/max';
import { getBaseApi, getClientId, getSseApi } from './env';
import { showRuoyiHtmlInfo } from './message';
import { getToken, removeToken } from './token';

const loginPath = '/user/login';
const initialReconnectDelay = 1000;
const maxReconnectDelay = 30000;
const maxExponentialStep = 5;

type JsonObject = Record<string, unknown>;

export type RuoyiSseMessage<T = unknown> = {
  event: string;
  id?: string;
  type?: string;
  data: T;
  raw: string;
  retry?: number;
  receivedAt: number;
};

export type RuoyiSseMessageListener = (
  message: RuoyiSseMessage,
) => void | Promise<void>;

class FatalSseError extends Error {}

class RetriableSseError extends Error {}

const listeners = new Set<RuoyiSseMessageListener>();

let abortController: AbortController | undefined;
let reconnectAttempt = 0;

const isBrowser = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

const isAbsoluteUrl = (url: string) => /^[a-z][a-z\d+\-.]*:\/\//i.test(url);

const isAuthFailureCode = (code: unknown) =>
  code === 401 || code === 403 || code === '401' || code === '403';

const isJsonContentType = (contentType: string) =>
  contentType.toLowerCase().includes('application/json');

const readRuoyiResponseCode = async (response: Response) => {
  try {
    const payload = (await response.clone().json()) as { code?: unknown };
    return payload?.code;
  } catch {
    return undefined;
  }
};

const withBaseApi = (url: string, baseApi: string) => {
  if (isAbsoluteUrl(url)) return url;

  const base = trimSlashes(baseApi);
  const normalizedBaseApi = base ? `/${base}` : '';
  const normalizedUrl = `/${trimSlashes(url)}`;

  if (!normalizedBaseApi) return normalizedUrl;
  if (normalizedUrl === normalizedBaseApi) return normalizedBaseApi;
  if (normalizedUrl.startsWith(`${normalizedBaseApi}/`)) return normalizedUrl;

  return `${normalizedBaseApi}${normalizedUrl}`;
};

export const getSseUrl = () => withBaseApi(getSseApi(), getBaseApi());

const isRecord = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getMessageType = (value: unknown) => {
  if (!isRecord(value)) return undefined;
  const type = value.type;
  return typeof type === 'string' && type.trim() ? type.trim() : undefined;
};

const parseSseData = (raw: string) => {
  const text = raw.trim();
  if (!text) {
    return {
      data: '',
      type: undefined,
    };
  }

  try {
    const data = JSON.parse(text);
    return {
      data,
      type: getMessageType(data),
    };
  } catch {
    return {
      data: raw,
      type: undefined,
    };
  }
};

const isEmptySseMessage = (event: EventSourceMessage) =>
  !event.data && !event.event && !event.id;

const toRuoyiSseMessage = (event: EventSourceMessage): RuoyiSseMessage => {
  const parsed = parseSseData(event.data);
  return {
    event: event.event || 'message',
    id: event.id || undefined,
    type: parsed.type,
    data: parsed.data,
    raw: event.data,
    retry: event.retry,
    receivedAt: Date.now(),
  };
};

const notifyListeners = (message: RuoyiSseMessage) => {
  listeners.forEach((listener) => {
    try {
      void listener(message);
    } catch (error) {
      console.warn('[SSE] message listener failed:', error);
    }
  });
};

const getReconnectDelay = () => {
  const step = Math.min(reconnectAttempt, maxExponentialStep);
  return Math.min(initialReconnectDelay * 2 ** step, maxReconnectDelay);
};

const redirectToLogin = () => {
  removeToken();
  const { pathname, search, hash } = history.location;
  if (pathname !== loginPath) {
    history.replace(
      `${loginPath}?redirect=${encodeURIComponent(pathname + search + hash)}`,
    );
  }
};

const handleAuthExpired = () => {
  stopSse();
  redirectToLogin();
};

const buildHeaders = () => {
  const token = getToken();
  const headers: Record<string, string> = {
    clientid: getClientId(),
    'Content-Language': 'zh_CN',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const handleMessage = (event: EventSourceMessage) => {
  if (isEmptySseMessage(event)) return;

  const message = toRuoyiSseMessage(event);
  reconnectAttempt = 0;
  notifyListeners(message);

  if (!message.type && typeof message.data === 'string' && message.data) {
    showRuoyiHtmlInfo(message.data);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[SSE] message:', message);
  }
};

export const subscribeSseMessage = (listener: RuoyiSseMessageListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const startSse = () => {
  if (!isBrowser() || abortController) return;
  if (!getToken()) return;

  const controller = new AbortController();
  abortController = controller;
  reconnectAttempt = 0;

  void fetchEventSource(getSseUrl(), {
    method: 'GET',
    headers: buildHeaders(),
    signal: controller.signal,
    openWhenHidden: true,
    async onopen(response) {
      if (response.status === 401 || response.status === 403) {
        throw new FatalSseError('SSE unauthorized.');
      }

      if (!response.ok) {
        throw new RetriableSseError(`SSE open failed: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (isJsonContentType(contentType)) {
        const code = await readRuoyiResponseCode(response);
        if (isAuthFailureCode(code)) {
          throw new FatalSseError('SSE unauthorized.');
        }
      }

      if (!contentType.startsWith(EventStreamContentType)) {
        throw new RetriableSseError(
          `Expected SSE content-type, got ${contentType || 'empty'}.`,
        );
      }

      reconnectAttempt = 0;
    },
    onmessage: handleMessage,
    onclose() {
      throw new RetriableSseError('SSE connection closed.');
    },
    onerror(error) {
      if (controller.signal.aborted) return undefined;

      if (error instanceof FatalSseError) {
        handleAuthExpired();
        throw error;
      }

      const delay = getReconnectDelay();
      reconnectAttempt += 1;
      console.warn(`[SSE] reconnect in ${delay}ms:`, error);
      return delay;
    },
  })
    .catch((error) => {
      if (!controller.signal.aborted) {
        console.warn('[SSE] stopped:', error);
      }
    })
    .finally(() => {
      if (abortController === controller) {
        abortController = undefined;
      }
    });
};

export const stopSse = () => {
  reconnectAttempt = 0;
  abortController?.abort();
  abortController = undefined;
};

export const isSseStarted = () => Boolean(abortController);

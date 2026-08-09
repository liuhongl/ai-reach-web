import { fetchEventSource } from '@microsoft/fetch-event-source';
import { history } from '@umijs/max';
import { startSse, stopSse, subscribeSseMessage } from './sse';

jest.mock('@umijs/max', () => ({
  history: {
    location: {
      hash: '',
      pathname: '/index',
      search: '',
    },
    replace: jest.fn(),
  },
}));

jest.mock('@microsoft/fetch-event-source', () => ({
  EventStreamContentType: 'text/event-stream',
  fetchEventSource: jest.fn(() => Promise.resolve()),
}));

jest.mock('./env', () => ({
  getBaseApi: () => '/dev-api',
  getClientId: () => 'test-client',
  getSseApi: () => '/resource/sse',
}));

jest.mock('./message', () => ({
  showRuoyiHtmlInfo: jest.fn(),
}));

const getFetchOptions = () => (fetchEventSource as jest.Mock).mock.calls[0][1];

const createMockResponse = ({
  contentType,
  ok = true,
  status = 200,
  payload,
}: {
  contentType: string;
  ok?: boolean;
  status?: number;
  payload?: unknown;
}) =>
  ({
    clone: () => ({
      json: async () => payload,
    }),
    headers: {
      get: (key: string) =>
        key.toLowerCase() === 'content-type' ? contentType : null,
    },
    ok,
    status,
  }) as Response;

describe('ruoyi sse adapter', () => {
  afterEach(() => {
    stopSse();
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('ignores comment-only heartbeat messages', () => {
    localStorage.setItem('Admin-Token', 'token');
    const listener = jest.fn();
    const unsubscribe = subscribeSseMessage(listener);

    startSse();
    getFetchOptions().onmessage({
      data: '',
      event: '',
      id: '',
      retry: undefined,
    });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('dispatches typed business messages', () => {
    localStorage.setItem('Admin-Token', 'token');
    const listener = jest.fn();
    const unsubscribe = subscribeSseMessage(listener);

    startSse();
    getFetchOptions().onmessage({
      data: '{"type":"recov.flow_event.changed"}',
      event: 'message',
      id: '',
      retry: undefined,
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'message',
        type: 'recov.flow_event.changed',
      }),
    );
    unsubscribe();
  });

  it('treats ruoyi json unauthorized response as fatal', async () => {
    localStorage.setItem('Admin-Token', 'token');

    startSse();
    const options = getFetchOptions();
    let authError: unknown;
    try {
      await options.onopen(
        createMockResponse({
          contentType: 'application/json',
          payload: { code: 401, msg: '认证失败' },
        }),
      );
    } catch (error) {
      authError = error;
    }

    expect(authError).toEqual(expect.any(Error));
    expect(() => options.onerror(authError)).toThrow('SSE unauthorized.');
    expect(localStorage.getItem('Admin-Token')).toBeNull();
    expect(history.replace).toHaveBeenCalledWith(
      '/user/login?redirect=%2Findex',
    );
  });
});

import { request as umiRequest } from '@umijs/max';
import { showRuoyiError } from './message';
import { ruoyiRequest } from './request';

jest.mock('@umijs/max', () => ({
  history: {
    location: { hash: '', pathname: '/ai-call/voices', search: '' },
    replace: jest.fn(),
  },
  request: jest.fn(),
}));

jest.mock('./message', () => ({
  showRuoyiError: jest.fn(),
}));

jest.mock('./env', () => ({
  getBaseApi: () => '/dev-api',
  getClientId: () => 'reach-client',
  getClientEnv: () => '',
  isClientEncryptEnabled: () => false,
}));

jest.mock('./sse', () => ({ stopSse: jest.fn() }));

jest.mock('./token', () => ({
  getToken: () => 'reach-token',
  removeToken: jest.fn(),
}));

const mockUmiRequest = umiRequest as jest.Mock;
const mockShowRuoyiError = showRuoyiError as jest.Mock;

describe('ruoyiRequest', () => {
  beforeEach(() => {
    mockUmiRequest.mockReset();
    mockShowRuoyiError.mockReset();
  });

  it('sends the RuoYi client and bearer token headers', async () => {
    mockUmiRequest.mockResolvedValueOnce({
      data: { code: 200, data: null },
      headers: {},
    });

    await ruoyiRequest('/system/user/getInfo');

    expect(mockUmiRequest).toHaveBeenCalledWith(
      '/dev-api/system/user/getInfo',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer reach-token',
          clientid: 'reach-client',
        }),
      }),
    );
  });

  it('surfaces the RuoYi message from non-2xx response envelopes', async () => {
    mockUmiRequest.mockRejectedValueOnce({
      response: {
        status: 503,
        data: {
          code: -1,
          msg: '音色复刻功能未启用',
          data: null,
        },
      },
    });

    await expect(
      ruoyiRequest('/ai-call/voice-enrollments', {
        baseApi: '/ai-call-agent-api',
        method: 'post',
      }),
    ).rejects.toMatchObject({
      message: '音色复刻功能未启用',
    });

    expect(mockUmiRequest.mock.calls[0][1]).toMatchObject({
      skipErrorHandler: true,
    });
    expect(mockShowRuoyiError).toHaveBeenCalledWith('音色复刻功能未启用');
  });
});

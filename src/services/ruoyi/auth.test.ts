import { getClientId } from '@/adapters/ruoyi/env';
import { ruoyiRequest } from '@/adapters/ruoyi/request';
import { login } from './auth';

jest.mock('@/adapters/ruoyi/env', () => ({ getClientId: jest.fn() }));
jest.mock('@/adapters/ruoyi/request', () => ({ ruoyiRequest: jest.fn() }));

describe('auth service', () => {
  it('登录时补充 clientId 和密码授权类型', async () => {
    jest.mocked(getClientId).mockReturnValue('reach-client');
    jest.mocked(ruoyiRequest).mockResolvedValue({ code: 200 } as never);

    await login({ username: 'admin', password: 'secret' });

    expect(ruoyiRequest).toHaveBeenCalledWith(
      '/auth/login',
      expect.objectContaining({
        method: 'post',
        data: expect.objectContaining({
          clientId: 'reach-client',
          grantType: 'password',
        }),
      }),
    );
  });
});

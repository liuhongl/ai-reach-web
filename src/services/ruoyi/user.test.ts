import { ruoyiRequest } from '@/adapters/ruoyi/request';
import { getInfo, listUsers } from './user';

jest.mock('@/adapters/ruoyi/request', () => ({ ruoyiRequest: jest.fn() }));

describe('user service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('读取当前用户信息', async () => {
    jest.mocked(ruoyiRequest).mockResolvedValue({ code: 200 } as never);

    await getInfo();

    expect(ruoyiRequest).toHaveBeenCalledWith(
      '/system/user/getInfo',
      expect.objectContaining({ method: 'get' }),
    );
  });

  it('按条件读取用户列表', async () => {
    jest.mocked(ruoyiRequest).mockResolvedValue({ code: 200 } as never);

    await listUsers({ pageNum: 1, pageSize: 20 });

    expect(ruoyiRequest).toHaveBeenCalledWith(
      '/system/user/list',
      expect.objectContaining({
        method: 'get',
        params: { pageNum: 1, pageSize: 20 },
      }),
    );
  });
});

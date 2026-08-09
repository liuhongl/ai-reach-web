import { ruoyiRequest } from '@/adapters/ruoyi/request';
import { clearTenant, switchTenant } from './tenant-context';

jest.mock('@/adapters/ruoyi/request', () => ({ ruoyiRequest: jest.fn() }));

describe('tenant context service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('切换到编码后的租户标识', async () => {
    jest.mocked(ruoyiRequest).mockResolvedValue({ code: 200 } as never);

    await switchTenant('100001');

    expect(ruoyiRequest).toHaveBeenCalledWith(
      '/system/tenant/dynamic/100001',
      expect.objectContaining({ method: 'get' }),
    );
  });

  it('清除动态租户上下文', async () => {
    jest.mocked(ruoyiRequest).mockResolvedValue({ code: 200 } as never);

    await clearTenant();

    expect(ruoyiRequest).toHaveBeenCalledWith(
      '/system/tenant/dynamic/clear',
      expect.objectContaining({ method: 'get' }),
    );
  });
});

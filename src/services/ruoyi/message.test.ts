import { ruoyiRequest } from '@/adapters/ruoyi/request';
import {
  getUnreadMessageCount,
  listMessages,
  readAllMessages,
  readMessage,
} from './message';

jest.mock('@/adapters/ruoyi/request', () => ({ ruoyiRequest: jest.fn() }));

describe('message service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ruoyiRequest).mockResolvedValue({ code: 200 } as never);
  });

  it('使用固定的通知接口', async () => {
    await listMessages({ pageNum: 1, pageSize: 10 });
    await getUnreadMessageCount();
    await readMessage('m-1');
    await readAllMessages();

    expect(ruoyiRequest).toHaveBeenCalledWith(
      '/resource/message/list',
      expect.any(Object),
    );
    expect(ruoyiRequest).toHaveBeenCalledWith(
      '/resource/message/unread-count',
      expect.any(Object),
    );
    expect(ruoyiRequest).toHaveBeenCalledWith(
      '/resource/message/m-1/read',
      expect.objectContaining({ method: 'put' }),
    );
    expect(ruoyiRequest).toHaveBeenCalledWith(
      '/resource/message/read-all',
      expect.objectContaining({ method: 'put' }),
    );
  });
});

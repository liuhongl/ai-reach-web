import { ruoyiRequest } from '@/adapters/ruoyi/request';
import {
  createAiCallLine,
  deleteAiCallLine,
  disableAiCallLine,
  enableAiCallLine,
  listAiCallLines,
  preflightAiCallLine,
  setDefaultAiCallLine,
  updateAiCallLine,
} from './service';

jest.mock('@/adapters/ruoyi/request', () => ({
  ruoyiRequest: jest.fn(),
}));

const mockRequest = ruoyiRequest as jest.Mock;

const payload = {
  lineCode: 'primary-line',
  lineName: '正式外呼线路',
  enabled: true,
  adapterType: 'livekit_sip' as const,
  routeMode: 'managed_trunk_id' as const,
  trunkId: 'ST_primary',
  proxyHost: null,
  proxyPort: null,
  authMode: 'managed_trunk' as const,
  callerNumber: '01088886666',
  destinationCountry: 'CN',
  maxConcurrency: 10,
  originateTimeoutSeconds: 45,
};

describe('AI Call 线路配置服务', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('通过独立 AI Call 代理分页查询线路', async () => {
    mockRequest.mockResolvedValue({
      rows: [{ lineId: '340700000000000001', ...payload }],
      total: 1,
    });

    const result = await listAiCallLines({ pageNum: 1, pageSize: 10 });

    expect(mockRequest).toHaveBeenCalledWith('/ai-call/outbound-lines', {
      baseApi: '/ai-call-agent-api',
      method: 'get',
      params: { pageNum: 1, pageSize: 10 },
    });
    expect(result.total).toBe(1);
    expect(result.rows[0].lineId).toBe('340700000000000001');
  });

  it('使用线路接口完成新增和编辑', async () => {
    mockRequest
      .mockResolvedValueOnce({ data: { lineId: 'line/1', ...payload } })
      .mockResolvedValueOnce({
        data: { lineId: 'line/1', ...payload, lineName: '备用线路' },
      });

    await createAiCallLine(payload);
    await updateAiCallLine('line/1', { ...payload, lineName: '备用线路' });

    expect(mockRequest).toHaveBeenNthCalledWith(1, '/ai-call/outbound-lines', {
      baseApi: '/ai-call-agent-api',
      method: 'post',
      data: payload,
    });
    expect(mockRequest).toHaveBeenNthCalledWith(
      2,
      '/ai-call/outbound-lines/line%2F1',
      {
        baseApi: '/ai-call-agent-api',
        method: 'put',
        data: { ...payload, lineName: '备用线路' },
      },
    );
  });

  it('使用编码后的线路 ID 执行预检、默认、启停和删除操作', async () => {
    mockRequest.mockResolvedValue({ data: { lineId: 'line/1' } });

    await preflightAiCallLine('line/1');
    await setDefaultAiCallLine('line/1');
    await enableAiCallLine('line/1');
    await disableAiCallLine('line/1');
    await deleteAiCallLine('line/1');

    expect(mockRequest.mock.calls).toEqual([
      [
        '/ai-call/outbound-lines/line%2F1/preflight',
        { baseApi: '/ai-call-agent-api', method: 'post' },
      ],
      [
        '/ai-call/outbound-lines/line%2F1/set-default',
        { baseApi: '/ai-call-agent-api', method: 'post' },
      ],
      [
        '/ai-call/outbound-lines/line%2F1/enable',
        { baseApi: '/ai-call-agent-api', method: 'post' },
      ],
      [
        '/ai-call/outbound-lines/line%2F1/disable',
        { baseApi: '/ai-call-agent-api', method: 'post' },
      ],
      [
        '/ai-call/outbound-lines/line%2F1',
        { baseApi: '/ai-call-agent-api', method: 'delete' },
      ],
    ]);
  });
});

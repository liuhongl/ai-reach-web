import { ruoyiRequest } from '@/adapters/ruoyi/request';
import { getOutboundStatistics } from './service';

jest.mock('@/adapters/ruoyi/request', () => ({
  ruoyiRequest: jest.fn(),
}));

const mockedRuoyiRequest = ruoyiRequest as jest.Mock;

describe('AI Call 外呼统计服务', () => {
  beforeEach(() => {
    mockedRuoyiRequest.mockReset();
  });

  it('通过独立代理查询正式外呼统计并解包数据', async () => {
    const statistics = {
      generatedAt: '2026-07-31T16:20:00+08:00',
      period: {
        timeZone: 'Asia/Shanghai',
        currentStartedAt: '2026-07-25T00:00:00+08:00',
        currentEndedAt: '2026-07-31T16:20:00+08:00',
        previousStartedAt: '2026-07-18T07:40:00+08:00',
        previousEndedAt: '2026-07-25T00:00:00+08:00',
      },
      overview: {
        dialAttempts: 8,
        connectedCalls: 2,
        connectRate: 0.25,
        totalDurationMs: 60_000,
        intentLeads: 1,
        pendingFollowUps: 2,
      },
      comparison: {
        dialAttemptsChangeRate: 1,
        connectedCallsChangeRate: 0,
        connectRateChangePoints: -25,
        totalDurationChangeRate: 1,
        intentLeadsChangeRate: null,
      },
      trend: [],
      results: [],
    };
    mockedRuoyiRequest.mockResolvedValue({ data: statistics });
    const query = {
      startedAtBegin: '2026-07-25T00:00:00.000Z',
      startedAtEnd: '2026-08-01T00:00:00.000Z',
      timeZone: 'Asia/Shanghai',
      granularity: 'day' as const,
    };

    await expect(getOutboundStatistics(query)).resolves.toEqual(statistics);
    expect(mockedRuoyiRequest).toHaveBeenCalledWith(
      '/ai-call/outbound-statistics',
      {
        baseApi: '/ai-call-agent-api',
        method: 'get',
        params: query,
      },
    );
  });
});

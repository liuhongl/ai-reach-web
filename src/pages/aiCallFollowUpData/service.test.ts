import { ruoyiRequest } from '@/adapters/ruoyi/request';
import {
  adjustFollowUpDataClassification,
  getFollowUpData,
  listFollowUpData,
  scheduleFollowUpData,
} from './service';

jest.mock('@/adapters/ruoyi/request', () => ({ ruoyiRequest: jest.fn() }));

const request = ruoyiRequest as jest.Mock;

describe('跟进数据接口', () => {
  beforeEach(() => request.mockReset());

  it('查询列表和详情', async () => {
    request
      .mockResolvedValueOnce({ rows: [{ follow_up_data_id: '1' }], total: 1 })
      .mockResolvedValueOnce({
        data: { follow_up_data_id: '1', timeline: [] },
      });

    await expect(
      listFollowUpData({
        classification: 'interested',
        customerName: '科技公司',
        pageNum: 1,
        pageSize: 20,
      }),
    ).resolves.toEqual({ rows: [{ follow_up_data_id: '1' }], total: 1 });
    await expect(getFollowUpData('1')).resolves.toMatchObject({
      follow_up_data_id: '1',
    });
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/ai-call/follow-up-data',
      expect.objectContaining({
        baseApi: '/ai-call-agent-api',
        method: 'get',
        params: {
          classification: 'interested',
          customerName: '科技公司',
          pageNum: 1,
          pageSize: 20,
        },
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/ai-call/follow-up-data/1',
      expect.objectContaining({ baseApi: '/ai-call-agent-api', method: 'get' }),
    );
  });

  it('提交分类和回访安排的版本与幂等键', async () => {
    request
      .mockResolvedValueOnce({ data: { version: 2 } })
      .mockResolvedValueOnce({ data: { version: 3, follow_up_id: '9' } });

    await adjustFollowUpDataClassification('1', {
      classification: 'low_value',
      reason: '客户当前暂无需求',
      conclusion: '客户明确表示当前不考虑采购。',
      lowValueReason: 'no_current_need',
      expectedVersion: 1,
      idempotencyKey: 'classification-1',
    });
    await scheduleFollowUpData('1', {
      followUpReason: '客户要求下周联系',
      nextFollowUpAt: '2026-08-20T10:00:00+08:00',
      expectedVersion: 2,
      idempotencyKey: 'schedule-1',
    });

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/ai-call/follow-up-data/1/classification',
      expect.objectContaining({
        method: 'put',
        headers: { 'Idempotency-Key': 'classification-1' },
        data: {
          classification: 'low_value',
          reason: '客户当前暂无需求',
          conclusion: '客户明确表示当前不考虑采购。',
          low_value_reason: 'no_current_need',
          expected_version: 1,
        },
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/ai-call/follow-up-data/1/schedule',
      expect.objectContaining({
        method: 'post',
        headers: { 'Idempotency-Key': 'schedule-1' },
        data: {
          follow_up_reason: '客户要求下周联系',
          next_follow_up_at: '2026-08-20T10:00:00+08:00',
          expected_version: 2,
        },
      }),
    );
  });
});

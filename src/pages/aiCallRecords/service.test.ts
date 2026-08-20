import { ruoyiRequest } from '@/adapters/ruoyi/request';
import {
  getAiCallRecordDetail,
  getAiCallRecordDialogue,
  getAiCallRecordEvents,
  getAiCallRecordHandoffs,
  getAiCallRecordQuality,
  getAiCallRecordRecording,
  getAiCallRecordSemanticAnalysis,
  listAiCallRecords,
  reviewAiCallRecordClassification,
  scoreAiCallRecordQuality,
} from './service';

const mockedRuoyiRequest = ruoyiRequest as jest.Mock;

jest.mock('@/adapters/ruoyi/request', () => ({
  ruoyiRequest: jest.fn(),
}));

describe('AI Call 通话记录服务', () => {
  beforeEach(() => {
    mockedRuoyiRequest.mockReset();
  });

  it('通过统一认证请求分页查询通话记录', async () => {
    const response = {
      rows: [{ callId: 'call-1', entryType: 'web' }],
      total: 1,
    };
    mockedRuoyiRequest.mockResolvedValue(response);

    const query = {
      pageNum: 1,
      pageSize: 10,
      taskId: 'task-1',
      targetId: 'target-1',
      phoneNumber: '',
      entryType: 'web',
      customerIntent: 'positive',
      classificationReviewStatus: 'suggested',
      followUpStatus: 'pending',
      startedAtBegin: undefined,
    } as const;
    const result = await listAiCallRecords(query);

    expect(mockedRuoyiRequest).toHaveBeenCalledWith('/ai-call/records', {
      baseApi: '/ai-call-agent-api',
      method: 'get',
      params: {
        pageNum: 1,
        pageSize: 10,
        taskId: 'task-1',
        targetId: 'target-1',
        entryType: 'web',
        customerIntent: 'positive',
        classificationReviewStatus: 'suggested',
        followUpStatus: 'pending',
      },
    });
    expect(result).toEqual({
      rows: [{ callId: 'call-1', entryType: 'web' }],
      total: 1,
    });
  });

  it('查询详情和五类附属信息并正确编码通话 ID', async () => {
    mockedRuoyiRequest
      .mockResolvedValueOnce({ data: { record: { callId: 'call/1' } } })
      .mockResolvedValueOnce({ data: { status: 'completed' } })
      .mockResolvedValueOnce({ data: { rows: [{ text: '您好' }], total: 1 } })
      .mockResolvedValueOnce({ data: { analysisStatus: 'completed' } })
      .mockResolvedValueOnce({
        data: { rows: [{ handoffId: 'handoff-1' }], total: 1 },
      })
      .mockResolvedValueOnce({
        data: { rows: [{ eventId: 'event-1' }], total: 1 },
      })
      .mockResolvedValueOnce({
        data: { score: { status: 'completed', score: 86 }, review: null },
      })
      .mockResolvedValueOnce({
        data: { score: { status: 'completed', score: 88 }, review: null },
      })
      .mockResolvedValueOnce({
        data: {
          followUp: { id: 'follow-up-1', status: 'pending' },
          reviewStatus: 'created',
        },
      });

    await getAiCallRecordDetail('call/1');
    await getAiCallRecordRecording('call/1');
    await getAiCallRecordDialogue('call/1');
    await getAiCallRecordSemanticAnalysis('call/1');
    await getAiCallRecordHandoffs('call/1');
    await getAiCallRecordEvents('call/1');
    await getAiCallRecordQuality('call/1');
    await scoreAiCallRecordQuality('call/1');
    await reviewAiCallRecordClassification('call/1', {
      classification: 'interested',
      reason: '客户询问产品演示',
      expectedVersion: 1,
      idempotencyKey: 'review-1',
    });

    expect(mockedRuoyiRequest.mock.calls.map(([path]) => path)).toEqual([
      '/ai-call/records/call%2F1',
      '/ai-call/records/call%2F1/recording',
      '/ai-call/records/call%2F1/dialogue-segments',
      '/ai-call/records/call%2F1/semantic-analysis',
      '/ai-call/records/call%2F1/handoffs',
      '/ai-call/records/call%2F1/events',
      '/ai-call/records/call%2F1/quality',
      '/ai-call/records/call%2F1/quality/score',
      '/ai-call/records/call%2F1/classification-review',
    ]);
    expect(mockedRuoyiRequest).toHaveBeenNthCalledWith(
      3,
      '/ai-call/records/call%2F1/dialogue-segments',
      {
        baseApi: '/ai-call-agent-api',
        method: 'get',
        params: { limit: 1000 },
      },
    );
    expect(mockedRuoyiRequest).toHaveBeenNthCalledWith(
      6,
      '/ai-call/records/call%2F1/events',
      {
        baseApi: '/ai-call-agent-api',
        method: 'get',
        params: { limit: 200 },
      },
    );
    expect(mockedRuoyiRequest).toHaveBeenNthCalledWith(
      8,
      '/ai-call/records/call%2F1/quality/score',
      {
        baseApi: '/ai-call-agent-api',
        method: 'post',
      },
    );
    expect(mockedRuoyiRequest).toHaveBeenNthCalledWith(
      9,
      '/ai-call/records/call%2F1/classification-review',
      {
        baseApi: '/ai-call-agent-api',
        headers: { 'Idempotency-Key': 'review-1' },
        data: {
          classification: 'interested',
          reason: '客户询问产品演示',
          low_value_reason: undefined,
          expected_version: 1,
        },
        method: 'post',
      },
    );
  });
});

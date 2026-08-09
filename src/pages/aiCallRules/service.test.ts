import { ruoyiRequest } from '@/adapters/ruoyi/request';
import {
  createAiCallRule,
  deleteAiCallRule,
  getAiCallRuleMetadata,
  listAiCallRules,
  updateAiCallRule,
} from './service';

jest.mock('@/adapters/ruoyi/request', () => ({
  ruoyiRequest: jest.fn(),
}));

const mockedRuoyiRequest = ruoyiRequest as jest.Mock;

const rule = {
  ruleId: 'rule-1',
  ruleName: '工作日规则',
  enabled: true,
  callWindows: [{ startTime: '09:00', endTime: '18:00' }],
  retryCount: 1,
  retryIntervalsMinutes: [30],
  retryableResults: ['no_answer'],
  updatedAt: '2026-07-27 10:00:00',
};

const payload = {
  ruleName: '工作日规则',
  enabled: true,
  callWindows: [{ startTime: '09:00', endTime: '18:00' }],
  retryCount: 1,
  retryIntervalsMinutes: [30],
  retryableResults: ['no_answer'],
};

describe('AI Call rule service', () => {
  beforeEach(() => {
    mockedRuoyiRequest.mockReset();
  });

  it('loads rule metadata from the isolated proxy', async () => {
    const metadata = {
      maxRetryCount: 5,
      retryableResults: [{ value: 'no_answer', label: '无人接听' }],
    };
    mockedRuoyiRequest.mockResolvedValueOnce({ code: 200, data: metadata });

    await expect(getAiCallRuleMetadata()).resolves.toEqual(metadata);
    expect(mockedRuoyiRequest).toHaveBeenCalledWith(
      '/ai-call/outbound-rules/meta',
      {
        baseApi: '/ai-call-agent-api',
        method: 'get',
      },
    );
  });

  it('normalizes rule pagination', async () => {
    mockedRuoyiRequest.mockResolvedValueOnce({
      code: 200,
      rows: [rule],
      total: 1,
    });

    await expect(
      listAiCallRules({
        pageNum: 1,
        pageSize: 20,
        ruleName: '工作日',
      }),
    ).resolves.toEqual({ rows: [rule], total: 1 });

    expect(mockedRuoyiRequest).toHaveBeenCalledWith('/ai-call/outbound-rules', {
      baseApi: '/ai-call-agent-api',
      method: 'get',
      params: { pageNum: 1, pageSize: 20, ruleName: '工作日' },
    });
  });

  it('creates and updates rules with ordinary response envelopes', async () => {
    mockedRuoyiRequest
      .mockResolvedValueOnce({ code: 200, data: rule })
      .mockResolvedValueOnce({
        code: 200,
        data: { ...rule, ruleName: '调整后的规则' },
      });

    await createAiCallRule(payload);
    await updateAiCallRule('rule-1', {
      ...payload,
      ruleName: '调整后的规则',
    });

    expect(mockedRuoyiRequest.mock.calls).toEqual([
      [
        '/ai-call/outbound-rules',
        {
          baseApi: '/ai-call-agent-api',
          method: 'post',
          data: payload,
        },
      ],
      [
        '/ai-call/outbound-rules/rule-1',
        {
          baseApi: '/ai-call-agent-api',
          method: 'put',
          data: { ...payload, ruleName: '调整后的规则' },
        },
      ],
    ]);
  });

  it('deletes a rule without requiring a data field', async () => {
    mockedRuoyiRequest.mockResolvedValueOnce({
      code: 200,
      msg: '删除成功',
    });

    await expect(deleteAiCallRule('rule-1')).resolves.toBeUndefined();
    expect(mockedRuoyiRequest).toHaveBeenCalledWith(
      '/ai-call/outbound-rules/rule-1',
      {
        baseApi: '/ai-call-agent-api',
        method: 'delete',
      },
    );
  });

  it('rejects non-contract responses', async () => {
    mockedRuoyiRequest
      .mockResolvedValueOnce({ rows: [rule], total: 1 })
      .mockResolvedValueOnce({ code: 200 });

    await expect(listAiCallRules({ pageNum: 1, pageSize: 20 })).rejects.toThrow(
      '接口响应缺少 code',
    );
    await expect(getAiCallRuleMetadata()).rejects.toThrow('接口响应缺少 data');
  });
});

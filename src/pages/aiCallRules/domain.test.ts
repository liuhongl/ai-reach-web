import {
  type AiCallRuleMetadata,
  type CallRuleFormValue,
  validateCallRule,
} from './domain';

const metadata: AiCallRuleMetadata = {
  maxRetryCount: 5,
  retryableResults: [
    { value: 'no_answer', label: '无人接听' },
    { value: 'busy', label: '忙线' },
    { value: 'call_failed', label: '呼叫失败' },
  ],
};

const buildRule = (
  overrides: Partial<CallRuleFormValue> = {},
): CallRuleFormValue => ({
  ruleName: '工作日规则',
  enabled: true,
  callWindows: [{ startTime: '09:00', endTime: '18:00' }],
  retryCount: 1,
  retryIntervalsMinutes: [30],
  retryableResults: ['no_answer'],
  ...overrides,
});

describe('AI Call rule domain', () => {
  it('rejects a call window whose start is not before its end', () => {
    expect(
      validateCallRule(
        buildRule({
          callWindows: [{ startTime: '18:00', endTime: '09:00' }],
        }),
        metadata,
      ),
    ).toContain('呼叫时段开始时间必须早于结束时间');
  });

  it('rejects overlapping windows and mismatched retry intervals', () => {
    expect(
      validateCallRule(
        buildRule({
          callWindows: [
            { startTime: '09:00', endTime: '12:00' },
            { startTime: '11:30', endTime: '18:00' },
          ],
          retryCount: 2,
          retryIntervalsMinutes: [30],
        }),
        metadata,
      ),
    ).toEqual(
      expect.arrayContaining([
        '呼叫时段不能重叠',
        '重试间隔数量必须与重试次数一致',
      ]),
    );
  });

  it('validates retry limits, positive intervals and supported results', () => {
    expect(
      validateCallRule(
        buildRule({
          retryCount: 6,
          retryIntervalsMinutes: [30, 0, 60, 90, 120, 150],
          retryableResults: ['rejected'],
        }),
        metadata,
      ),
    ).toEqual(
      expect.arrayContaining([
        '重试次数不能超过 5 次',
        '重试间隔必须为正整数',
        '存在不支持的可重试结果',
      ]),
    );
  });

  it('requires at least one call window', () => {
    expect(
      validateCallRule(buildRule({ callWindows: [] }), metadata),
    ).toContain('至少配置一个呼叫时段');
  });

  it('accepts a valid rule', () => {
    expect(validateCallRule(buildRule(), metadata)).toEqual([]);
  });
});

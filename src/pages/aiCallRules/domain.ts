export type CallWindow = {
  startTime: string;
  endTime: string;
};

export type RetryableResult = 'no_answer' | 'busy' | 'call_failed';

export type AiCallRule = {
  ruleId: string;
  ruleName: string;
  enabled: boolean;
  callWindows: CallWindow[];
  retryCount: number;
  retryIntervalsMinutes: number[];
  retryableResults: string[];
  updatedAt: string;
};

export type AiCallRuleMetadata = {
  maxRetryCount: number;
  retryableResults: Array<{
    value: RetryableResult;
    label: string;
  }>;
};

export type CallRuleFormValue = Omit<AiCallRule, 'ruleId' | 'updatedAt'>;

const addError = (errors: string[], error: string) => {
  if (!errors.includes(error)) {
    errors.push(error);
  }
};

export const validateCallRule = (
  rule: CallRuleFormValue,
  metadata: AiCallRuleMetadata,
): string[] => {
  const errors: string[] = [];

  if (rule.callWindows.length === 0) {
    addError(errors, '至少配置一个呼叫时段');
  }

  for (const window of rule.callWindows) {
    if (!window.startTime || !window.endTime) {
      addError(errors, '呼叫时段必须填写开始和结束时间');
    } else if (window.startTime >= window.endTime) {
      addError(errors, '呼叫时段开始时间必须早于结束时间');
    }
  }

  const sortedWindows = [...rule.callWindows].sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  );
  for (let index = 1; index < sortedWindows.length; index += 1) {
    const previous = sortedWindows[index - 1];
    const current = sortedWindows[index];
    if (previous.endTime > current.startTime) {
      addError(errors, '呼叫时段不能重叠');
      break;
    }
  }

  if (!Number.isInteger(rule.retryCount) || rule.retryCount < 0) {
    addError(errors, '重试次数必须为非负整数');
  } else if (rule.retryCount > metadata.maxRetryCount) {
    addError(errors, `重试次数不能超过 ${metadata.maxRetryCount} 次`);
  }

  if (rule.retryIntervalsMinutes.length !== rule.retryCount) {
    addError(errors, '重试间隔数量必须与重试次数一致');
  }
  if (
    rule.retryIntervalsMinutes.some(
      (interval) => !Number.isInteger(interval) || interval <= 0,
    )
  ) {
    addError(errors, '重试间隔必须为正整数');
  }

  const supportedResults = new Set(
    metadata.retryableResults.map((item) => item.value),
  );
  if (
    rule.retryableResults.some(
      (result) => !supportedResults.has(result as RetryableResult),
    )
  ) {
    addError(errors, '存在不支持的可重试结果');
  }

  return errors;
};

export type ReadRetryOptions = {
  attempts?: number;
  delayMs?: number;
  onRetry?: (error: unknown, failedAttempt: number) => void;
};

const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  'ERR_NETWORK',
  'ECONNRESET',
  'ECONNREFUSED',
]);

export const isRetryableReadError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const response = Reflect.get(error, 'response');
  const status =
    Reflect.get(error, 'status') ??
    (response && typeof response === 'object'
      ? Reflect.get(response, 'status')
      : undefined);
  const code = String(Reflect.get(error, 'code') || '');
  const message = error instanceof Error ? error.message : '';
  return (
    RETRYABLE_HTTP_STATUSES.has(Number(status)) ||
    RETRYABLE_NETWORK_CODES.has(code) ||
    /network error|failed to fetch/i.test(message)
  );
};

const delay = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

export const readWithGatewayRetry = async <T>(
  operation: () => Promise<T>,
  { attempts = 5, delayMs = 3_000, onRetry }: ReadRetryOptions = {},
): Promise<T> => {
  const safeAttempts = Math.max(1, attempts);
  for (let attempt = 1; attempt <= safeAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableReadError(error) || attempt === safeAttempts) throw error;
      onRetry?.(error, attempt);
      await delay(delayMs);
    }
  }
  throw new Error('只读请求重试状态异常');
};

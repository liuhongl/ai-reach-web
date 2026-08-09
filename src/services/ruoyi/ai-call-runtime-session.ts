import {
  type AiCallRuntimeBootstrap,
  type AiCallRuntimeToken,
  createAiCallRuntimeToken,
  getAiCallRuntimeBootstrap,
} from './ai-call-runtime';

const RETRYABLE_TOKEN_GATE_CODES = new Set([
  'CALL_NOT_READY',
  'OWNER_UNAVAILABLE',
]);

export class AiCallRuntimeEndedBeforeReadyError extends Error {
  readonly code = 'CALL_ENDED_BEFORE_READY';

  constructor(callId: string) {
    super(`AI Call ${callId} ended before runtime readiness`);
    this.name = 'AiCallRuntimeEndedBeforeReadyError';
  }
}

export class AiCallRuntimeReadyTimeoutError extends Error {
  readonly code = 'RUNTIME_READY_TIMEOUT';

  constructor(callId: string) {
    super(`AI Call ${callId} did not become ready before the polling limit`);
    this.name = 'AiCallRuntimeReadyTimeoutError';
  }
}

export type AiCallRuntimeReadyToken = {
  bootstrap: AiCallRuntimeBootstrap;
  token: AiCallRuntimeToken;
};

export type AiCallRuntimeReadyOptions = {
  maxAttempts?: number;
  pollIntervalMs?: number;
  wait?: (delayMs: number) => Promise<void>;
};

const defaultWait = (delayMs: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));

const readErrorCode = (
  value: unknown,
  visited: Set<object> = new Set(),
): string | undefined => {
  if (!value || typeof value !== 'object' || visited.has(value))
    return undefined;
  visited.add(value);
  const direct =
    Reflect.get(value, 'errorCode') || Reflect.get(value, 'error_code');
  if (typeof direct === 'string' && direct) return direct;
  for (const key of ['data', 'response', 'info']) {
    const nested = readErrorCode(Reflect.get(value, key), visited);
    if (nested) return nested;
  }
  return undefined;
};

export const getAiCallRuntimeErrorCode = (error: unknown) =>
  readErrorCode(error);

export const waitForAiCallRuntimeReadyToken = async (
  callId: string,
  options: AiCallRuntimeReadyOptions = {},
): Promise<AiCallRuntimeReadyToken> => {
  const maxAttempts = options.maxAttempts ?? 60;
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const wait = options.wait ?? defaultWait;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts must be a positive integer');
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new RangeError('pollIntervalMs must be non-negative');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const bootstrap = await getAiCallRuntimeBootstrap(callId);
    if (bootstrap.phase === 'ending' || bootstrap.phase === 'terminal') {
      throw new AiCallRuntimeEndedBeforeReadyError(callId);
    }
    if (bootstrap.phase === 'ready') {
      try {
        return {
          bootstrap,
          token: await createAiCallRuntimeToken(callId),
        };
      } catch (error) {
        const errorCode = getAiCallRuntimeErrorCode(error);
        if (errorCode === 'CALL_ENDING') {
          throw new AiCallRuntimeEndedBeforeReadyError(callId);
        }
        if (!errorCode || !RETRYABLE_TOKEN_GATE_CODES.has(errorCode)) {
          throw error;
        }
      }
    }
    if (attempt < maxAttempts) {
      await wait(pollIntervalMs);
    }
  }
  throw new AiCallRuntimeReadyTimeoutError(callId);
};

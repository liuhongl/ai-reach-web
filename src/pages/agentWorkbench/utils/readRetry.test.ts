import { isRetryableReadError, readWithGatewayRetry } from './readRetry';

describe('readWithGatewayRetry', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries gateway reads every three seconds until recovery', async () => {
    jest.useFakeTimers();
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce({ response: { status: 504 } })
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValue('ok');
    const onRetry = jest.fn();

    const result = readWithGatewayRetry(operation, { onRetry });
    await jest.advanceTimersByTimeAsync(6_000);

    await expect(result).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-gateway business failures', async () => {
    const failure = { response: { status: 400 } };
    const operation = jest.fn<Promise<string>, []>().mockRejectedValue(failure);

    await expect(readWithGatewayRetry(operation)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('stops after five failed read attempts', async () => {
    jest.useFakeTimers();
    const failure = { response: { status: 502 } };
    const operation = jest.fn<Promise<string>, []>().mockRejectedValue(failure);

    const result = readWithGatewayRetry(operation);
    const rejection = expect(result).rejects.toBe(failure);
    await jest.advanceTimersByTimeAsync(12_000);

    await rejection;
    expect(operation).toHaveBeenCalledTimes(5);
  });
});

describe('isRetryableReadError', () => {
  it.each([
    [{ response: { status: 502 } }],
    [{ status: 503 }],
    [{ code: 'ERR_NETWORK' }],
    [new Error('Failed to fetch')],
  ])('recognizes a transient read failure', (error) => {
    expect(isRetryableReadError(error)).toBe(true);
  });
});

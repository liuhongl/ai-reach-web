import { act, cleanup, render } from '@testing-library/react';
import * as React from 'react';
import { useVisiblePolling } from './useVisiblePolling';

const Harness = ({
  enabled = true,
  onTick,
}: {
  enabled?: boolean;
  onTick: () => void;
}) => {
  useVisiblePolling({ enabled, intervalMs: 10_000, onTick });
  return null;
};

describe('useVisiblePolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('ticks immediately and then at the configured interval', () => {
    const refresh = jest.fn();
    render(<Harness onTick={refresh} />);

    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('stops while hidden and restarts when the page becomes visible', () => {
    const refresh = jest.fn();
    render(<Harness onTick={refresh} />);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      jest.advanceTimersByTime(20_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not tick when disabled and clears the timer on unmount', () => {
    const refresh = jest.fn();
    const view = render(<Harness enabled={false} onTick={refresh} />);
    expect(refresh).not.toHaveBeenCalled();

    view.rerender(<Harness onTick={refresh} />);
    expect(refresh).toHaveBeenCalledTimes(1);
    view.unmount();
    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});

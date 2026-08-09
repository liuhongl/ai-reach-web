import { useEffect, useRef } from 'react';

export type VisiblePollingOptions = {
  enabled: boolean;
  intervalMs: number;
  onTick: () => void | Promise<void>;
};

export const useVisiblePolling = ({
  enabled,
  intervalMs,
  onTick,
}: VisiblePollingOptions) => {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    const start = () => {
      stop();
      if (document.visibilityState !== 'visible') return;
      void onTickRef.current();
      timer = setInterval(() => {
        void onTickRef.current();
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
};

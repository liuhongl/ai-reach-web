import { useEffect } from 'react';
import { startSse, stopSse } from '@/adapters/ruoyi/sse';

type SseBootstrapProps = {
  enabled?: boolean;
  connectionKey?: string;
};

const SseBootstrap = ({ enabled, connectionKey }: SseBootstrapProps) => {
  useEffect(() => {
    if (!enabled) {
      stopSse();
      return undefined;
    }

    startSse();
    return () => {
      stopSse();
    };
  }, [enabled, connectionKey]);

  return null;
};

export default SseBootstrap;

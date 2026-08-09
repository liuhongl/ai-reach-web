import { useCallback, useEffect, useRef, useState } from 'react';
import type { RuoyiResponse } from '@/adapters/ruoyi/response';
import {
  getHandoffContext,
  type HandoffContextDto,
  type HandoffDto,
} from '@/services/ruoyi/agent-console';
import { isRetryableReadError, readWithGatewayRetry } from '../utils/readRetry';

type HandoffContextService = (
  handoffId: string,
  consoleSessionId: string,
) => Promise<RuoyiResponse<HandoffContextDto> | HandoffContextDto>;

export type UseHandoffContextOptions = {
  handoff?: HandoffDto;
  consoleSessionId?: string;
  service?: HandoffContextService;
};

const unwrapContext = (
  response: RuoyiResponse<HandoffContextDto> | HandoffContextDto,
) => {
  if ('data' in response && response.data) return response.data;
  return response as HandoffContextDto;
};

export const useHandoffContext = ({
  handoff,
  consoleSessionId,
  service = getHandoffContext,
}: UseHandoffContextOptions) => {
  const [context, setContext] = useState<HandoffContextDto>();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = ++generationRef.current;
    if (!handoff || !consoleSessionId) {
      setContext(undefined);
      setLoading(false);
      setErrorMessage('');
      return;
    }
    setContext((current) =>
      current?.handoff_id === handoff.handoff_id ? current : undefined,
    );
    setLoading(true);
    setErrorMessage('');
    void readWithGatewayRetry(
      () => service(handoff.handoff_id, consoleSessionId),
      {
        onRetry: () => {
          if (generation === generationRef.current) {
            setErrorMessage('完整会话暂不可用，正在重新连接');
          }
        },
      },
    )
      .then((response) => {
        if (generation !== generationRef.current) return;
        setContext(unwrapContext(response));
        setErrorMessage('');
      })
      .catch((error) => {
        if (generation !== generationRef.current) return;
        setErrorMessage(
          isRetryableReadError(error)
            ? '完整会话暂不可用，请点击重试'
            : '完整会话加载失败，请点击重试',
        );
      })
      .finally(() => {
        if (generation === generationRef.current) setLoading(false);
      });
  }, [
    consoleSessionId,
    handoff?.handoff_id,
    handoff?.status,
    reloadKey,
    service,
  ]);

  const retry = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  return {
    context,
    loading,
    errorMessage,
    retry,
  };
};

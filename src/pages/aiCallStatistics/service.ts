import { ruoyiRequest } from '@/adapters/ruoyi/request';
import type { OutboundStatistics, StatisticsQuery } from './domain';

type AiCallResponse<T> = {
  data?: T;
};

export const getOutboundStatistics = async (
  params: StatisticsQuery,
): Promise<OutboundStatistics> => {
  const response = await ruoyiRequest<OutboundStatistics>(
    '/ai-call/outbound-statistics',
    {
      baseApi: '/ai-call-agent-api',
      method: 'get',
      params,
    },
  );
  if (
    response &&
    typeof response === 'object' &&
    Object.hasOwn(response, 'data')
  ) {
    return (response as AiCallResponse<OutboundStatistics>)
      .data as OutboundStatistics;
  }
  return response as unknown as OutboundStatistics;
};

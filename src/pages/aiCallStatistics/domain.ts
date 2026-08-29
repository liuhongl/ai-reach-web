import dayjs, { type Dayjs } from 'dayjs';

export type DateRange = [Dayjs, Dayjs];
export type StatisticsGranularity = 'hour' | 'day';
export type CallResultGroup =
  | 'connected'
  | 'voicemail'
  | 'transport_connected'
  | 'no_answer'
  | 'rejected'
  | 'early_hangup'
  | 'invalid_number'
  | 'other';

export type StatisticsQuery = {
  startedAtBegin: string;
  startedAtEnd: string;
  timeZone: string;
  granularity: StatisticsGranularity;
  sceneCode?: string;
  taskId?: string;
};

export type OutboundStatistics = {
  generatedAt: string;
  period: {
    timeZone: string;
    currentStartedAt: string;
    currentEndedAt: string;
    previousStartedAt: string;
    previousEndedAt: string;
  };
  overview: {
    dialAttempts: number;
    connectedCalls: number;
    connectRate: number;
    totalDurationMs: number;
    intentLeads: number;
    pendingFollowUps: number;
  };
  comparison: {
    dialAttemptsChangeRate: number | null;
    connectedCallsChangeRate: number | null;
    connectRateChangePoints: number | null;
    totalDurationChangeRate: number | null;
    intentLeadsChangeRate: number | null;
  };
  trend: Array<{
    bucketStart: string;
    dialAttempts: number;
    connectedCalls: number;
    connectRate: number;
  }>;
  results: Array<{
    result: CallResultGroup;
    count: number;
    rate: number;
  }>;
};

export const getDefaultDateRange = (now = dayjs()): DateRange => [
  now.subtract(6, 'day').startOf('day'),
  now.endOf('day'),
];

export const validateDateRange = (
  range: DateRange,
  now = dayjs(),
): string | undefined => {
  const [begin, end] = range;
  if (begin.startOf('day').isAfter(end.startOf('day'))) {
    return '开始日期不能晚于结束日期';
  }
  if (begin.startOf('day').isAfter(now.startOf('day'))) {
    return '不能选择未来日期';
  }
  const naturalDays = end.startOf('day').diff(begin.startOf('day'), 'day') + 1;
  if (naturalDays > 90) {
    return '统计范围不能超过 90 个自然日';
  }
  return undefined;
};

export const buildAppliedQuery = (
  range: DateRange,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  filters: Pick<StatisticsQuery, 'sceneCode' | 'taskId'> = {},
): StatisticsQuery => ({
  startedAtBegin: range[0].startOf('day').toISOString(),
  startedAtEnd: range[1].add(1, 'day').startOf('day').toISOString(),
  timeZone,
  granularity: range[0].isSame(range[1], 'day') ? 'hour' : 'day',
  ...filters,
});

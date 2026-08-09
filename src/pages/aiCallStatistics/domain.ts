import dayjs, { type Dayjs } from 'dayjs';

export type DateRange = [Dayjs, Dayjs];
export type StatisticsGranularity = 'hour' | 'day';
export type CallResultGroup =
  | 'connected'
  | 'no_answer'
  | 'busy'
  | 'invalid_number'
  | 'call_failed'
  | 'processing'
  | 'other';

export type StatisticsQuery = {
  startedAtBegin: string;
  startedAtEnd: string;
  timeZone: string;
  granularity: StatisticsGranularity;
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
    pendingFollowUps: number;
  };
  comparison: {
    dialAttemptsChangeRate: number | null;
    connectedCallsChangeRate: number | null;
    connectRateChangePoints: number | null;
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

type DrillDownRange = Pick<StatisticsQuery, 'startedAtBegin' | 'startedAtEnd'>;

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
): StatisticsQuery => ({
  startedAtBegin: range[0].startOf('day').toISOString(),
  startedAtEnd: range[1].add(1, 'day').startOf('day').toISOString(),
  timeZone,
  granularity: range[0].isSame(range[1], 'day') ? 'hour' : 'day',
});

export const buildRecordsUrl = (
  params: DrillDownRange & { callResult?: CallResultGroup },
) => {
  const search = new URLSearchParams({
    formalOutboundOnly: 'true',
    startedAtBegin: params.startedAtBegin,
    startedAtEnd: params.startedAtEnd,
  });
  if (params.callResult) {
    search.set('callResult', params.callResult);
  }
  return `/ai-call/records?${search.toString()}`;
};

export const buildFollowUpsUrl = (params: DrillDownRange) => {
  const search = new URLSearchParams({
    status: 'pending',
    formalOutboundOnly: 'true',
    sourceStartedAtBegin: params.startedAtBegin,
    sourceStartedAtEnd: params.startedAtEnd,
  });
  return `/ai-call/follow-up-overview?${search.toString()}`;
};

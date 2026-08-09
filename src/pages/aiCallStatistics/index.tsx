import {
  CheckCircleOutlined,
  PercentageOutlined,
  PhoneOutlined,
  ReloadOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  message,
  Result,
  Row,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import CallResultChart from './components/CallResultChart';
import MetricCard from './components/MetricCard';
import OutboundTrendChart from './components/OutboundTrendChart';
import {
  buildAppliedQuery,
  buildFollowUpsUrl,
  buildRecordsUrl,
  type CallResultGroup,
  type DateRange,
  getDefaultDateRange,
  type OutboundStatistics,
  type StatisticsQuery,
  validateDateRange,
} from './domain';
import { getOutboundStatistics } from './service';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const percentFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatChangeRate = (value: number | null) => {
  if (value === null) {
    return '上期无可比数据';
  }
  if (value === 0) {
    return '较上期 — 0.0%';
  }
  return `较上期 ${value > 0 ? '↑' : '↓'} ${Math.abs(value * 100).toFixed(1)}%`;
};

const formatChangePoints = (value: number | null) => {
  if (value === null) {
    return '上期无可比数据';
  }
  if (value === 0) {
    return '较上期 — 0.00 个百分点';
  }
  return `较上期 ${value > 0 ? '↑' : '↓'} ${Math.abs(value).toFixed(2)} 个百分点`;
};

const getTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';

const AiCallStatisticsPage = () => {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [draftRange, setDraftRange] = useState<DateRange>(defaultRange);
  const [appliedQuery, setAppliedQuery] = useState<StatisticsQuery>(() =>
    buildAppliedQuery(defaultRange, getTimeZone()),
  );
  const [statistics, setStatistics] = useState<OutboundStatistics>();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const requestIdRef = useRef(0);

  const loadStatistics = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setLoadFailed(false);
    try {
      const result = await getOutboundStatistics(appliedQuery);
      if (requestId === requestIdRef.current) {
        setStatistics(result);
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setStatistics(undefined);
        setLoadFailed(true);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [appliedQuery]);

  useEffect(() => {
    void loadStatistics();
  }, [loadStatistics]);

  const applyRange = () => {
    const error = validateDateRange(draftRange);
    if (error) {
      void message.warning(error);
      return;
    }
    setAppliedQuery(buildAppliedQuery(draftRange, getTimeZone()));
  };

  const resetRange = () => {
    const nextRange = getDefaultDateRange();
    setDraftRange(nextRange);
    setAppliedQuery(buildAppliedQuery(nextRange, getTimeZone()));
  };

  const getEffectiveRange = () => ({
    startedAtBegin:
      statistics?.period.currentStartedAt ?? appliedQuery.startedAtBegin,
    startedAtEnd:
      statistics?.period.currentEndedAt ?? appliedQuery.startedAtEnd,
  });

  const openRecords = (callResult?: CallResultGroup) => {
    history.push(buildRecordsUrl({ ...getEffectiveRange(), callResult }));
  };

  const openFollowUps = () => {
    history.push(buildFollowUpsUrl(getEffectiveRange()));
  };

  const openTrendBucket = (bucketStart: string) => {
    const nextBucket = dayjs(bucketStart)
      .add(1, appliedQuery.granularity)
      .toISOString();
    const effectiveEnd =
      statistics?.period.currentEndedAt ?? appliedQuery.startedAtEnd;
    history.push(
      buildRecordsUrl({
        startedAtBegin: bucketStart,
        startedAtEnd: dayjs(nextBucket).isAfter(dayjs(effectiveEnd))
          ? effectiveEnd
          : nextBucket,
      }),
    );
  };

  return (
    <PageContainer title="外呼统计">
      <Flex vertical gap={16}>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <Flex justify="space-between" align="center" gap={12} wrap>
            <Space wrap>
              <RangePicker
                value={draftRange}
                allowClear={false}
                presets={[
                  { label: '今天', value: [dayjs(), dayjs()] },
                  {
                    label: '昨天',
                    value: [
                      dayjs().subtract(1, 'day'),
                      dayjs().subtract(1, 'day'),
                    ],
                  },
                  { label: '最近 7 天', value: getDefaultDateRange() },
                  {
                    label: '最近 30 天',
                    value: [dayjs().subtract(29, 'day'), dayjs()],
                  },
                ]}
                disabledDate={(current) =>
                  current.startOf('day').isAfter(dayjs().startOf('day'))
                }
                onChange={(value) => {
                  if (value?.[0] && value[1]) {
                    setDraftRange([value[0], value[1]]);
                  }
                }}
              />
              <Button type="primary" onClick={applyRange}>
                查询
              </Button>
              <Button onClick={resetRange}>重置</Button>
            </Space>
            <Button
              icon={<ReloadOutlined />}
              aria-label="刷新"
              loading={loading}
              onClick={() => void loadStatistics()}
            >
              刷新
            </Button>
          </Flex>
        </Card>

        {loadFailed ? (
          <Card
            styles={{
              body: {
                alignItems: 'center',
                display: 'flex',
                justifyContent: 'center',
                minHeight: 320,
              },
            }}
          >
            <Result
              status="warning"
              title="暂时无法获取外呼统计"
              subTitle="请检查服务状态或稍后重试，当前筛选条件已保留。"
              extra={
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  aria-label="重新加载"
                  onClick={() => void loadStatistics()}
                >
                  重新加载
                </Button>
              }
            />
          </Card>
        ) : null}

        {loading && !statistics ? (
          <Card>
            <Skeleton active />
          </Card>
        ) : null}

        {statistics ? (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} xl={6}>
                <MetricCard
                  title="拨打次数"
                  value={statistics.overview.dialAttempts.toLocaleString()}
                  unit="次"
                  comparison={formatChangeRate(
                    statistics.comparison.dialAttemptsChangeRate,
                  )}
                  icon={<PhoneOutlined />}
                  tone="info"
                  onClick={() => openRecords()}
                />
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <MetricCard
                  title="接通通话"
                  value={statistics.overview.connectedCalls.toLocaleString()}
                  unit="通"
                  comparison={formatChangeRate(
                    statistics.comparison.connectedCallsChangeRate,
                  )}
                  icon={<CheckCircleOutlined />}
                  tone="success"
                  onClick={() => openRecords('connected')}
                />
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <MetricCard
                  title="接通率"
                  value={`${percentFormatter.format(statistics.overview.connectRate * 100)}%`}
                  comparison={formatChangePoints(
                    statistics.comparison.connectRateChangePoints,
                  )}
                  icon={<PercentageOutlined />}
                  tone="warning"
                  onClick={() => openRecords('connected')}
                />
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <MetricCard
                  title="待跟进"
                  value={statistics.overview.pendingFollowUps.toLocaleString()}
                  unit="条"
                  comparison="当前筛选范围"
                  icon={<ScheduleOutlined />}
                  tone="error"
                  emphasized
                  onClick={openFollowUps}
                />
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={16}>
                <Card title="外呼趋势" style={{ height: '100%' }}>
                  <OutboundTrendChart
                    data={statistics.trend}
                    granularity={appliedQuery.granularity}
                    onBucketClick={openTrendBucket}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={8}>
                <Card title="通话结果" style={{ height: '100%' }}>
                  <CallResultChart
                    data={statistics.results}
                    onResultClick={openRecords}
                  />
                </Card>
              </Col>
            </Row>

            <Flex justify="flex-end">
              <Text type="secondary" style={{ fontSize: 12 }}>
                数据更新于{' '}
                {dayjs(statistics.generatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </Flex>
          </>
        ) : null}
      </Flex>
    </PageContainer>
  );
};

export default AiCallStatisticsPage;

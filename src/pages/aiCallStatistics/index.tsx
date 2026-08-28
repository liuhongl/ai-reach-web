import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  PercentageOutlined,
  PhoneOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  message,
  Result,
  Row,
  Select,
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
import { getAiCallLabPromptProfiles } from '@/services/ruoyi/ai-call-lab';
import { listAiCallTasks } from '../aiCallTasks/service';
import CallResultChart from './components/CallResultChart';
import MetricCard from './components/MetricCard';
import OutboundTrendChart from './components/OutboundTrendChart';
import {
  buildAppliedQuery,
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

type ComparisonTone = 'positive' | 'negative' | 'neutral';

const comparisonTone = (value: number | null): ComparisonTone =>
  value === null || value === 0
    ? 'neutral'
    : value > 0
      ? 'positive'
      : 'negative';

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

const durationMinutes = (durationMs: number) =>
  percentFormatter.format(durationMs / 60_000);

const AiCallStatisticsPage = () => {
  const defaultRange = useMemo(() => getDefaultDateRange(), []);
  const [draftRange, setDraftRange] = useState<DateRange>(defaultRange);
  const [draftSceneCode, setDraftSceneCode] = useState<string>();
  const [draftTaskId, setDraftTaskId] = useState<string>();
  const [sceneOptions, setSceneOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [taskOptions, setTaskOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [appliedQuery, setAppliedQuery] = useState<StatisticsQuery>(() =>
    buildAppliedQuery(defaultRange, getTimeZone()),
  );
  const [statistics, setStatistics] = useState<OutboundStatistics>();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    setSceneLoading(true);
    void getAiCallLabPromptProfiles()
      .then(({ rows }) => {
        if (!active) return;
        const unique = new Map<string, string>();
        rows.forEach((profile) => {
          if (!unique.has(profile.sceneCode)) {
            unique.set(profile.sceneCode, profile.name);
          }
        });
        setSceneOptions(
          Array.from(unique, ([value, label]) => ({ label, value })),
        );
      })
      .catch(() => {
        if (active) void message.error('业务场景加载失败');
      })
      .finally(() => {
        if (active) setSceneLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!draftSceneCode) {
      setTaskOptions([]);
      return;
    }
    let active = true;
    setTaskLoading(true);
    void listAiCallTasks({
      pageNum: 1,
      pageSize: 200,
      sceneCode: draftSceneCode,
    })
      .then(({ rows }) => {
        if (active) {
          setTaskOptions(
            rows.map((task) => ({ label: task.taskName, value: task.taskId })),
          );
        }
      })
      .catch(() => {
        if (active) void message.error('外呼任务加载失败');
      })
      .finally(() => {
        if (active) setTaskLoading(false);
      });
    return () => {
      active = false;
    };
  }, [draftSceneCode]);

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

  const applyFilters = () => {
    const error = validateDateRange(draftRange);
    if (error) {
      void message.warning(error);
      return;
    }
    setAppliedQuery(
      buildAppliedQuery(draftRange, getTimeZone(), {
        sceneCode: draftSceneCode,
        taskId: draftTaskId,
      }),
    );
  };

  const resetFilters = () => {
    const nextRange = getDefaultDateRange();
    setDraftRange(nextRange);
    setDraftSceneCode(undefined);
    setDraftTaskId(undefined);
    setTaskOptions([]);
    setAppliedQuery(buildAppliedQuery(nextRange, getTimeZone()));
  };

  return (
    <PageContainer title="外呼统计">
      <Flex vertical gap={16}>
        <Card size="small" styles={{ body: { padding: 16 } }}>
          <Flex justify="space-between" align="center" gap={12} wrap>
            <Space wrap>
              <Select
                aria-label="业务场景"
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="全部场景"
                loading={sceneLoading}
                options={sceneOptions}
                value={draftSceneCode}
                style={{ width: 200 }}
                onChange={(value) => {
                  setDraftSceneCode(value);
                  setDraftTaskId(undefined);
                  setTaskOptions([]);
                }}
              />
              <Select
                aria-label="外呼任务"
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={draftSceneCode ? '全部任务' : '请先选择场景'}
                disabled={!draftSceneCode}
                loading={taskLoading}
                options={taskOptions}
                value={draftTaskId}
                style={{ width: 220 }}
                onChange={setDraftTaskId}
              />
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
              <Button type="primary" onClick={applyFilters}>
                查询
              </Button>
              <Button onClick={resetFilters}>重置</Button>
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
              <Col xs={24} sm={12} lg={8} xl={4}>
                <MetricCard
                  title="外呼次数"
                  value={statistics.overview.dialAttempts.toLocaleString()}
                  unit="次"
                  comparison={formatChangeRate(
                    statistics.comparison.dialAttemptsChangeRate,
                  )}
                  comparisonTone={comparisonTone(
                    statistics.comparison.dialAttemptsChangeRate,
                  )}
                  icon={<PhoneOutlined />}
                  tone="info"
                />
              </Col>
              <Col xs={24} sm={12} lg={8} xl={4}>
                <MetricCard
                  title="接通通话"
                  value={statistics.overview.connectedCalls.toLocaleString()}
                  unit="通"
                  comparison={formatChangeRate(
                    statistics.comparison.connectedCallsChangeRate,
                  )}
                  comparisonTone={comparisonTone(
                    statistics.comparison.connectedCallsChangeRate,
                  )}
                  icon={<CheckCircleOutlined />}
                  tone="success"
                />
              </Col>
              <Col xs={24} sm={12} lg={8} xl={4}>
                <MetricCard
                  title="接通率"
                  value={`${percentFormatter.format(statistics.overview.connectRate * 100)}%`}
                  comparison={formatChangePoints(
                    statistics.comparison.connectRateChangePoints,
                  )}
                  comparisonTone={comparisonTone(
                    statistics.comparison.connectRateChangePoints,
                  )}
                  icon={<PercentageOutlined />}
                  tone="warning"
                />
              </Col>
              <Col xs={24} sm={12} lg={8} xl={4}>
                <MetricCard
                  title="通话总时长"
                  value={durationMinutes(statistics.overview.totalDurationMs)}
                  unit="分钟"
                  comparison={formatChangeRate(
                    statistics.comparison.totalDurationChangeRate,
                  )}
                  comparisonTone={comparisonTone(
                    statistics.comparison.totalDurationChangeRate,
                  )}
                  icon={<ClockCircleOutlined />}
                  tone="info"
                />
              </Col>
              <Col xs={24} sm={12} lg={8} xl={4}>
                <MetricCard
                  title="意向线索"
                  value={statistics.overview.intentLeads.toLocaleString()}
                  unit="个"
                  comparison={formatChangeRate(
                    statistics.comparison.intentLeadsChangeRate,
                  )}
                  comparisonTone={comparisonTone(
                    statistics.comparison.intentLeadsChangeRate,
                  )}
                  icon={<UserAddOutlined />}
                  tone="success"
                />
              </Col>
              <Col xs={24} sm={12} lg={8} xl={4}>
                <MetricCard
                  title="待跟进"
                  value={statistics.overview.pendingFollowUps.toLocaleString()}
                  unit="条"
                  comparison="当前待处理总量"
                  icon={<ScheduleOutlined />}
                  tone="error"
                  emphasized
                />
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={16}>
                <Card
                  title="外呼趋势：拨打次数（柱）/ 接通率（折线）"
                  style={{ height: '100%' }}
                >
                  <OutboundTrendChart
                    data={statistics.trend}
                    granularity={appliedQuery.granularity}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={8}>
                <Card title="呼叫结果分布" style={{ height: '100%' }}>
                  <CallResultChart data={statistics.results} />
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

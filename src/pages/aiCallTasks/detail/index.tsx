import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PhoneOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProCard, ProTable } from '@ant-design/pro-components';
import { history, useParams } from '@umijs/max';
import {
  Button,
  Descriptions,
  Progress,
  Result,
  Space,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  ListPage,
  ListStack,
  StatsStrip,
  TableCard,
} from '@/components/ListLayout';
import TaskStatusTag from '../components/TaskStatusTag';
import WebTaskCallModal from '../components/WebTaskCallModal';
import {
  type AiCallTask,
  type AiCallTaskTarget,
  getTaskProgress,
  shouldPollTask,
  type TargetStatus,
} from '../domain';
import { useVisiblePolling } from '../hooks/useVisiblePolling';
import { getAiCallTask, listAiCallTaskTargets } from '../service';

const { Text } = Typography;

const targetStatusValueEnum: Record<TargetStatus, { text: string }> = {
  PENDING: { text: '待拨打' },
  DIALING: { text: '拨号中' },
  IN_CALL: { text: '通话中' },
  RETRY_WAIT: { text: '等待重试' },
  COMPLETED: { text: '已完成' },
  CANCELLED: { text: '已取消' },
};

const targetStatusColors: Record<TargetStatus, string> = {
  PENDING: 'default',
  DIALING: 'processing',
  IN_CALL: 'processing',
  RETRY_WAIT: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
};

const callResultLabels: Record<string, string> = {
  connected: '已接通',
  no_answer: '无人接听',
  busy: '占线',
  rejected: '电话拒接',
  early_hangup: '主动挂断（≤5秒）',
  call_failed: '呼叫失败',
  invalid_number: '号码无效',
};

const callResultColors: Record<string, string> = {
  connected: 'success',
  no_answer: 'default',
  busy: 'warning',
  rejected: 'error',
  early_hangup: 'warning',
  call_failed: 'error',
  invalid_number: 'error',
};

const getTaskExecutionLabel = (task: AiCallTask) => {
  const dialerTypes = Array.from(new Set(task.attemptDialerTypes || []));
  if (dialerTypes.length === 0) return '尚未执行';
  if (dialerTypes.length > 1) return '混合执行';
  if (dialerTypes[0] === 'mock') return '模拟执行';
  if (dialerTypes[0] === 'sip') return 'SIP 外呼';
  if (dialerTypes[0]?.startsWith('linphone')) return 'Linphone 本地验证';
  if (dialerTypes[0] === 'owner_runtime') return '平台运行时';
  return '其他执行方式';
};

const getConnectedStatTitle = (task: AiCallTask) => {
  const dialerTypes = new Set(task.attemptDialerTypes || []);
  if (dialerTypes.size === 1 && dialerTypes.has('mock')) return '模拟成功数';
  if (dialerTypes.has('mock')) return '成功数（含模拟）';
  return '线路接通数';
};

const getLatestResultLabel = (target: AiCallTaskTarget) => {
  if (!target.latestResult) return '—';
  if (
    target.latestResult === 'no_answer' &&
    (target.providerStatusCode === '480' ||
      target.hangupCause === 'USER_UNAVAILABLE')
  ) {
    return '被叫暂时不可用（SIP 480）';
  }
  const result = callResultLabels[target.latestResult] || target.latestResult;
  if (target.latestDialerType === 'mock') {
    return target.latestResult === 'connected'
      ? '模拟执行完成'
      : `模拟：${result}`;
  }
  if (target.latestResult !== 'connected') return result;
  return target.answerType === 'human'
    ? '真人接通'
    : target.answerType === 'voicemail'
      ? '语音信箱'
      : target.answerType === 'transport'
        ? '仅线路接通'
        : result;
};

const getLatestResultColor = (target: AiCallTaskTarget) =>
  target.answerType === 'voicemail'
    ? 'purple'
    : target.answerType === 'transport'
      ? 'blue'
      : callResultColors[target.latestResult || ''] || 'default';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '任务详情加载失败';

const buildRecordsUrl = (taskId: string, targetId?: string) => {
  const search = new URLSearchParams({ taskId });
  if (targetId) search.set('targetId', targetId);
  return `/ai-call/records?${search.toString()}`;
};

const toneStyles = {
  blue: { color: '#1677ff', backgroundColor: '#e6f4ff' },
  cyan: { color: '#08979c', backgroundColor: '#e6fffb' },
  green: { color: '#389e0d', backgroundColor: '#f6ffed' },
  red: { color: '#cf1322', backgroundColor: '#fff1f0' },
};

const StatCard = ({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone: 'blue' | 'cyan' | 'green' | 'red';
}) => (
  <ProCard size="small" styles={{ body: { padding: 12 } }}>
    <Space orientation="vertical" size={8}>
      <Space size={8}>
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
          style={toneStyles[tone]}
        >
          {icon}
        </span>
        <Text type="secondary">{title}</Text>
      </Space>
      <Text strong style={{ fontSize: 22 }}>
        {value}
      </Text>
    </Space>
  </ProCard>
);

const AiCallTaskDetailPage = () => {
  const { taskId } = useParams<{ taskId?: string }>();
  const actionRef = useRef<ActionType>(null);
  const [task, setTask] = useState<AiCallTask>();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [webCallId, setWebCallId] = useState<string>();
  const dismissedWebCallIdsRef = useRef(new Set<string>());

  const loadTask = async () => {
    if (!taskId) {
      setErrorMessage('缺少任务 ID');
      setLoading(false);
      return;
    }
    try {
      setTask(await getAiCallTask(taskId));
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTask();
  }, [taskId]);

  useVisiblePolling({
    enabled: Boolean(task && shouldPollTask(task)),
    intervalMs: 5_000,
    onTick: async () => {
      await Promise.all([loadTask(), actionRef.current?.reload()]);
    },
  });

  if (!taskId || errorMessage) {
    return (
      <ListPage breadcrumbRender={false} title="外呼任务详情">
        <Result
          status="error"
          subTitle={errorMessage || '缺少任务 ID'}
          title="任务详情加载失败"
          extra={
            <Button onClick={() => history.push('/ai-call/tasks')}>
              返回任务列表
            </Button>
          }
        />
      </ListPage>
    );
  }

  if (loading || !task) {
    return <ListPage breadcrumbRender={false} loading title="外呼任务详情" />;
  }

  const columns: ProColumns<AiCallTaskTarget>[] = [
    {
      title: '客户名称',
      dataIndex: 'customerName',
      width: 140,
      renderText: (value) => value || '—',
    },
    {
      title: '最近呼叫结果',
      dataIndex: 'latestResult',
      width: 160,
      search: false,
      render: (_, target) =>
        target.latestResult ? (
          <Tag color={getLatestResultColor(target)}>
            {getLatestResultLabel(target)}
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '执行状态',
      dataIndex: 'status',
      width: 120,
      valueType: 'select',
      valueEnum: targetStatusValueEnum,
      render: (_, target) => (
        <Tag color={targetStatusColors[target.status]}>
          {targetStatusValueEnum[target.status]?.text || target.status}
        </Tag>
      ),
    },
    {
      title: '拨打次数',
      dataIndex: 'attemptCount',
      width: 100,
      search: false,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
      search: false,
    },
    {
      title: '操作',
      key: 'actions',
      width: 130,
      fixed: 'right',
      search: false,
      render: (_value, target) => (
        <Button
          size="small"
          type="link"
          onClick={() =>
            history.push(buildRecordsUrl(task.taskId, target.targetId))
          }
        >
          查看通话记录
        </Button>
      ),
    },
  ];

  return (
    <ListPage breadcrumbRender={false} title="外呼任务详情">
      <ListStack>
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          data-testid="task-detail-toolbar"
        >
          <Space wrap>
            <h2 className="m-0 break-words text-xl font-semibold">
              {task.taskName}
            </h2>
            <TaskStatusTag status={task.status} />
            {task.attemptDialerTypes?.length ? (
              <Tag
                color={
                  task.attemptDialerTypes.includes('mock') ? 'blue' : 'green'
                }
              >
                {getTaskExecutionLabel(task)}
              </Tag>
            ) : null}
          </Space>
          <Space wrap>
            <Button onClick={() => history.push(buildRecordsUrl(task.taskId))}>
              查看全部通话记录
            </Button>
            <Button onClick={() => history.push('/ai-call/tasks')}>
              返回任务列表
            </Button>
          </Space>
        </div>

        <StatsStrip className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={<TeamOutlined />}
            title="对象总数"
            tone="blue"
            value={task.totalTargets}
          />
          <StatCard
            icon={<CheckCircleOutlined />}
            title="完成数"
            tone="green"
            value={task.completedTargets}
          />
          <StatCard
            icon={<PhoneOutlined />}
            title={getConnectedStatTitle(task)}
            tone="cyan"
            value={task.connectedTargets}
          />
          <StatCard
            icon={<CloseCircleOutlined />}
            title="失败数"
            tone="red"
            value={task.failedTargets}
          />
          <StatCard
            icon={<CheckCircleOutlined />}
            title="完成进度"
            tone="green"
            value={`${getTaskProgress(task)}%`}
          />
        </StatsStrip>

        <TableCard
          className="recov-toolbar-card"
          data-testid="task-config-card"
          title="任务配置"
          style={{ flex: '0 0 auto' }}
        >
          <Descriptions
            column={{ xs: 1, md: 2 }}
            items={[
              {
                key: 'prompt',
                label: '提示词',
                children: task.promptName || '—',
              },
              {
                key: 'voice',
                label: '音色',
                children: task.voiceName || '—',
              },
              {
                key: 'rule',
                label: '呼叫规则',
                children: task.ruleName,
              },
              {
                key: 'ruleSummary',
                label: '规则摘要',
                children: task.ruleSummary,
              },
              {
                key: 'answerMode',
                label: '客户接听端',
                children:
                  task.answerMode === 'web'
                    ? 'Web（浏览器）'
                    : '电话（SIP 线路）',
              },
              {
                key: 'executionMode',
                label: '执行计划',
                children:
                  task.executionMode === 'scheduled' ? '定时执行' : '立即执行',
              },
              ...(task.executionMode === 'scheduled'
                ? [
                    {
                      key: 'scheduledAt',
                      label: '计划执行时间',
                      children: task.scheduledAt || '—',
                    },
                  ]
                : []),
            ]}
            styles={{
              content: { minWidth: 0, overflowWrap: 'anywhere' },
              label: { whiteSpace: 'nowrap' },
            }}
          />
          <Progress
            className="mt-4"
            percent={getTaskProgress(task)}
            format={() => `${task.completedTargets}/${task.totalTargets}`}
          />
        </TableCard>

        <TableCard title="外呼对象">
          <ProTable<AiCallTaskTarget>
            actionRef={actionRef}
            className="recov-stable-pagination-table"
            columns={columns}
            options={false}
            pagination={{
              defaultPageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            request={async (params) => {
              const response = await listAiCallTaskTargets(task.taskId, {
                pageNum: params.current || 1,
                pageSize: params.pageSize || 20,
                customerName: params.customerName,
                status: params.status,
              });
              const readyWebCall = response.rows.find(
                (target) =>
                  task.answerMode === 'web' &&
                  target.activeCallStatus === 'ready' &&
                  target.activeCallId &&
                  !dismissedWebCallIdsRef.current.has(target.activeCallId),
              );
              if (readyWebCall?.activeCallId) {
                setWebCallId(readyWebCall.activeCallId);
              }
              return {
                data: response.rows,
                total: response.total,
                success: true,
              };
            }}
            rowKey="targetId"
            scroll={{ x: 1100 }}
            search={{ labelWidth: 'auto' }}
          />
        </TableCard>
        {webCallId ? (
          <WebTaskCallModal
            callId={webCallId}
            open
            onClosed={(callId) => {
              dismissedWebCallIdsRef.current.add(callId);
              setWebCallId(undefined);
            }}
          />
        ) : null}
      </ListStack>
    </ListPage>
  );
};

export default AiCallTaskDetailPage;

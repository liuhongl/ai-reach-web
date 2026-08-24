import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  Modal,
  message,
  Select,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListPage } from '@/components/ListLayout';
import { PermissionButton } from '@/components/Permission';
import AgentName from '@/pages/agentWorkbench/components/AgentName';
import CurrentCallPanel from '@/pages/agentWorkbench/components/CurrentCallPanel';
import { useAgentPresence } from '@/pages/agentWorkbench/hooks/useAgentPresence';
import { useFollowUpCallback } from '@/pages/agentWorkbench/hooks/useFollowUpCallback';
import CallRecordDetailContent from '@/pages/aiCallRecords/CallRecordDetailContent';
import { listAiCallTasks } from '@/pages/aiCallTasks/service';
import {
  confirmFollowUpDataCallConnected,
  endFollowUpDataCall,
  type FollowUpCallbackCredentialDto,
  startFollowUpDataCall,
} from '@/services/ruoyi/agent-console';
import {
  adjustFollowUpDataClassification,
  type FollowUpClassification,
  type FollowUpDataDetail,
  type FollowUpDataRow,
  getFollowUpData,
  type LowValueReason,
  listFollowUpData,
  scheduleFollowUpData,
} from './service';

const { Paragraph, Text } = Typography;

const classificationLabels: Record<FollowUpClassification, string> = {
  interested: '有意向',
  nurturing: '持续跟进',
  low_value: '低价值',
  converted: '已转化',
};

const classificationColors: Record<FollowUpClassification, string> = {
  interested: 'gold',
  nurturing: 'blue',
  low_value: 'default',
  converted: 'green',
};

const lowValueReasonLabels: Record<LowValueReason, string> = {
  explicit_rejection: '明确拒绝',
  no_current_need: '暂无需求',
  customer_mismatch: '客户不匹配',
  non_target_customer: '非目标客户',
  invalid_contact: '联系方式无效',
  other: '其他',
};

const classificationSourceLabels = {
  ai: 'AI 分类',
  human: '人工确认',
  system: '系统分类',
} as const;

const callStatusLabels: Record<string, string> = {
  ready: '等待呼叫',
  dialing: '正在呼叫',
  ringing: '等待接听',
  running: '通话中',
  connected: '通话中',
  completed: '已结束',
  failed: '呼叫失败',
};

const formatDateTime = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';

const formatDuration = (durationMs?: number | null) => {
  if (!durationMs) return '-';
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
};

const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `follow-up-data-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const followUpDataCallbackServices = {
  end: endFollowUpDataCall,
  confirmConnected: confirmFollowUpDataCallConnected,
};

const suggestedFocus: Record<FollowUpClassification, string> = {
  interested: '确认需求细节、决策条件和下一步合作安排。',
  nurturing: '确认当前进展、仍待解决的问题和下一次沟通节点。',
  low_value: '核实客户现状是否变化，确认是否需要重新激活。',
  converted: '确认当前转化状态及是否仍有补充沟通需求。',
};

const unwrapAgentConsoleData = <T,>(response: unknown): T =>
  response && typeof response === 'object' && Reflect.get(response, 'data')
    ? (Reflect.get(response, 'data') as T)
    : (response as T);

const loadTaskOptions = async () => {
  const page = await listAiCallTasks({ pageNum: 1, pageSize: 200 });
  return page.rows.map((task) => ({
    label: task.taskName,
    value: task.taskId,
  }));
};

const ClassificationTag = ({ row }: { row: FollowUpDataRow }) => (
  <Flex vertical gap={4} align="flex-start">
    <Flex gap={4} wrap>
      <Tag color={classificationColors[row.classification]}>
        {classificationLabels[row.classification]}
      </Tag>
      {row.classification_source ? (
        <Tag>{classificationSourceLabels[row.classification_source]}</Tag>
      ) : null}
      {row.after_call_result_status === 'pending' ? (
        <Tag color="processing">话后结果待提交</Tag>
      ) : null}
    </Flex>
    {row.low_value_reason ? (
      <Text type="secondary">
        原因：{lowValueReasonLabels[row.low_value_reason]}
      </Text>
    ) : null}
  </Flex>
);

type FollowUpDataDetailDrawerProps = {
  detail?: FollowUpDataDetail;
  error?: string;
  loading: boolean;
  onClose: () => void;
  onRetry: () => void;
  open: boolean;
};

const FollowUpDataDetailDrawer = ({
  detail,
  error,
  loading,
  onClose,
  onRetry,
  open,
}: FollowUpDataDetailDrawerProps) => {
  const [selectedCallId, setSelectedCallId] = useState<string>();
  const close = () => {
    setSelectedCallId(undefined);
    onClose();
  };

  return (
    <Drawer
      title={selectedCallId ? '通话记录详情' : '跟进数据详情'}
      open={open}
      loading={loading}
      size={selectedCallId ? 860 : 620}
      extra={
        selectedCallId ? (
          <Button type="link" onClick={() => setSelectedCallId(undefined)}>
            返回跟进数据详情
          </Button>
        ) : null
      }
      onClose={close}
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          title={error}
          action={
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          }
        />
      ) : selectedCallId ? (
        <CallRecordDetailContent callId={selectedCallId} />
      ) : detail ? (
        <Flex vertical gap={24}>
          <Descriptions
            column={1}
            items={[
              {
                key: 'customer',
                label: '客户',
                children:
                  [detail.customer_name, detail.masked_contact]
                    .filter(Boolean)
                    .join(' · ') || '-',
              },
              {
                key: 'task',
                label: '所属任务',
                children: detail.task_name || '-',
              },
              {
                key: 'classification',
                label: '当前分类',
                children: <ClassificationTag row={detail} />,
              },
              {
                key: 'reason',
                label: '分类原因',
                children: detail.classification_reason || '-',
              },
              {
                key: 'conclusion',
                label: '最新沟通结论',
                children: detail.latest_conclusion || '-',
              },
              {
                key: 'contactAt',
                label: '最近联系时间',
                children: formatDateTime(detail.last_contact_at),
              },
              {
                key: 'followUpAt',
                label: '计划回访时间',
                children: formatDateTime(detail.next_follow_up_at),
              },
            ]}
          />
          <section>
            <Typography.Title level={5}>通话与处理记录</Typography.Title>
            <Timeline
              items={detail.timeline.map((item) => {
                if (item.type === 'classification_adjustment') {
                  return {
                    color: 'gray',
                    content: (
                      <Flex vertical gap={4}>
                        <Text strong>人工调整分类</Text>
                        <Text type="secondary">
                          {formatDateTime(item.occurred_at)}
                          {item.operator ? ` · ${item.operator}` : ''}
                        </Text>
                        <Flex gap={4} align="center" wrap>
                          {item.from_classification ? (
                            <Tag>
                              {classificationLabels[item.from_classification]}
                            </Tag>
                          ) : null}
                          <Text>→</Text>
                          {item.to_classification ? (
                            <Tag
                              color={
                                classificationColors[item.to_classification]
                              }
                            >
                              {classificationLabels[item.to_classification]}
                            </Tag>
                          ) : null}
                        </Flex>
                        <Text>{item.conclusion || '-'}</Text>
                      </Flex>
                    ),
                  };
                }
                const isHuman = Boolean(item.operator_agent_identity);
                const title = isHuman
                  ? item.entry_type === 'sip_callback'
                    ? '人工回访'
                    : '转人工通话'
                  : '原始 AI 通话';
                return {
                  color:
                    item.after_call_result_status === 'pending'
                      ? 'blue'
                      : 'green',
                  content: (
                    <Flex vertical gap={4}>
                      <Flex gap={4} align="center" wrap>
                        <Text strong>{title}</Text>
                        <Tag>
                          {callStatusLabels[item.status || ''] ||
                            item.status ||
                            '状态未知'}
                        </Tag>
                        {item.after_call_result_status === 'pending' ? (
                          <Tag color="processing">待提交话后结果</Tag>
                        ) : null}
                      </Flex>
                      <Text type="secondary">
                        {formatDateTime(item.occurred_at)} · 通话时长{' '}
                        {formatDuration(item.duration_ms)}
                        {item.operator_agent_identity ? (
                          <>
                            {' · 坐席 '}
                            <AgentName
                              identity={item.operator_agent_identity}
                            />
                          </>
                        ) : null}
                      </Text>
                      <Text>沟通结论：{item.conclusion || '-'}</Text>
                      {item.next_follow_up_at ? (
                        <Text>
                          计划回访：{formatDateTime(item.next_follow_up_at)}
                        </Text>
                      ) : null}
                      {item.call_id ? (
                        <Button
                          type="link"
                          size="small"
                          style={{ alignSelf: 'flex-start', paddingInline: 0 }}
                          onClick={() => setSelectedCallId(item.call_id || '')}
                        >
                          查看本次通话详情
                        </Button>
                      ) : null}
                    </Flex>
                  ),
                };
              })}
            />
          </section>
        </Flex>
      ) : null}
    </Drawer>
  );
};

type ClassificationForm = {
  classification: FollowUpClassification;
  lowValueReason?: LowValueReason;
  reason: string;
  conclusion: string;
};

type ScheduleForm = {
  followUpReason: string;
  nextFollowUpAt: Dayjs;
};

type FollowUpDataCallModalProps = {
  target: FollowUpDataRow;
  onClose: () => void;
  onFinished: (callId: string) => void;
};

const FollowUpDataCallModal = ({
  target,
  onClose,
  onFinished,
}: FollowUpDataCallModalProps) => {
  const agent = useAgentPresence({ suppressExistingSessionMessage: true });
  const [credential, setCredential] = useState<FollowUpCallbackCredentialDto>();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [takeoverReason, setTakeoverReason] = useState('');
  const [idempotencyKey] = useState(createIdempotencyKey);
  const finishedCallRef = useRef<string | undefined>(undefined);
  const callbackCall = useFollowUpCallback({
    credential,
    followUpId: target.follow_up_data_id,
    consoleSessionId: agent.consoleSessionId,
    services: followUpDataCallbackServices,
    refresh: agent.bootstrap,
  });
  const currentAgentIdentity = agent.profile?.agent_identity;
  const currentOwner = target.active_follow_up_owner_agent_identity;
  const needsTakeover = Boolean(
    currentOwner &&
      currentAgentIdentity &&
      currentOwner !== currentAgentIdentity,
  );
  const agentBusy = Boolean(
    agent.status && !['available', 'offline', 'paused'].includes(agent.status),
  );

  useEffect(() => {
    const callId = credential?.call_id;
    if (
      callbackCall.phase !== 'ended' ||
      !callId ||
      finishedCallRef.current === callId
    ) {
      return;
    }
    finishedCallRef.current = callId;
    onFinished(callId);
  }, [callbackCall.phase, credential?.call_id, onFinished]);

  const startCall = async () => {
    if (!agent.profile || agentBusy) return;
    const normalizedTakeoverReason = takeoverReason.trim();
    if (needsTakeover && !normalizedTakeoverReason) {
      setStartError('请填写接管原因');
      return;
    }
    setStartError('');
    setStarting(true);
    try {
      const ready =
        agent.status === 'available' ? true : await agent.goOnline();
      if (!ready) {
        setStartError(agent.errorMessage || '上线失败，请完成设备检查后重试');
        return;
      }
      const response = await startFollowUpDataCall(target.follow_up_data_id, {
        consoleSessionId: agent.consoleSessionId,
        idempotencyKey,
        takeover: needsTakeover,
        takeoverReason: needsTakeover ? normalizedTakeoverReason : undefined,
      });
      setCredential(
        unwrapAgentConsoleData<FollowUpCallbackCredentialDto>(response),
      );
    } catch (error) {
      setStartError(
        error instanceof Error
          ? error.message
          : '人工外呼发起失败，请检查坐席状态后重试',
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal
      title={credential ? '立即人工外呼' : '确认立即人工外呼'}
      open
      width={720}
      closable={!credential}
      keyboard={!credential}
      mask={{ closable: false }}
      footer={
        credential
          ? null
          : [
              <Button key="cancel" onClick={onClose}>
                取消
              </Button>,
              <Button
                key="call"
                type="primary"
                loading={starting}
                disabled={
                  agent.phase === 'loading' ||
                  agent.phase === 'checking' ||
                  agent.phase === 'updating' ||
                  agentBusy ||
                  !agent.profile
                }
                onClick={() => void startCall()}
              >
                {agent.status === 'available'
                  ? needsTakeover
                    ? '接管并外呼'
                    : '发起外呼'
                  : '上线并呼叫'}
              </Button>,
            ]
      }
      onCancel={onClose}
    >
      {credential ? (
        <CurrentCallPanel
          {...callbackCall}
          endConfirmDescription="结束后客户将退出本次通话，话后结果请在通话记录中提交。"
          onToggleMicrophone={callbackCall.toggleMicrophone}
          onSwitchAudioInput={callbackCall.switchAudioInput}
          onEndCall={async () => {
            await callbackCall.endCall();
          }}
        />
      ) : (
        <Flex vertical gap={16}>
          {agent.errorMessage || startError ? (
            <Alert
              type="error"
              showIcon
              title={startError || agent.errorMessage}
            />
          ) : null}
          {agentBusy ? (
            <Alert
              type="warning"
              showIcon
              title="当前坐席正在处理其他通话，暂不能发起外呼"
            />
          ) : null}
          {needsTakeover ? (
            <Alert
              type="warning"
              showIcon
              title={
                <>
                  当前回访任务由 <AgentName identity={currentOwner} />
                  负责，继续后将接管该任务
                </>
              }
            />
          ) : target.active_follow_up_id && !currentOwner ? (
            <Alert
              type="info"
              showIcon
              title="当前回访任务尚未认领，外呼时将自动认领给当前坐席"
            />
          ) : null}
          <Descriptions
            column={1}
            items={[
              {
                key: 'customer',
                label: '客户/联系人',
                children:
                  [target.customer_name, target.masked_contact]
                    .filter(Boolean)
                    .join(' · ') || '-',
              },
              {
                key: 'classification',
                label: '当前分类',
                children: (
                  <Flex gap={8} align="center" wrap>
                    <Tag color={classificationColors[target.classification]}>
                      {classificationLabels[target.classification]}
                    </Tag>
                    <Text>{target.classification_reason || '-'}</Text>
                  </Flex>
                ),
              },
              {
                key: 'conclusion',
                label: '上次沟通结论',
                children: target.latest_conclusion || '-',
              },
              {
                key: 'reason',
                label: '本次跟进原因',
                children:
                  target.active_follow_up_reason ||
                  target.classification_reason ||
                  '核实客户当前意向与下一步安排',
              },
              {
                key: 'focus',
                label: '建议沟通重点',
                children: suggestedFocus[target.classification],
              },
            ]}
          />
          {needsTakeover ? (
            <Input.TextArea
              aria-label="接管原因"
              rows={3}
              maxLength={500}
              showCount
              value={takeoverReason}
              placeholder="说明接管并外呼的原因"
              onChange={(event) => {
                setTakeoverReason(event.target.value);
                setStartError('');
              }}
            />
          ) : null}
        </Flex>
      )}
    </Modal>
  );
};

const FollowUpDataPage = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const detailRequestIdRef = useRef(0);
  const [messageApi, messageContextHolder] = message.useMessage();
  const [classification, setClassification] =
    useState<FollowUpClassification>('interested');
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<FollowUpDataDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>();
  const [classificationTarget, setClassificationTarget] =
    useState<FollowUpDataRow>();
  const [scheduleTarget, setScheduleTarget] = useState<FollowUpDataRow>();
  const [callTarget, setCallTarget] = useState<FollowUpDataRow>();
  const [classificationKey, setClassificationKey] = useState('');
  const [scheduleKey, setScheduleKey] = useState('');
  const [classificationSubmitting, setClassificationSubmitting] =
    useState(false);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [classificationForm] = Form.useForm<ClassificationForm>();
  const [scheduleForm] = Form.useForm<ScheduleForm>();
  const selectedClassification = Form.useWatch(
    'classification',
    classificationForm,
  );

  const openDetail = useCallback(async (followUpDataId: string) => {
    const requestId = ++detailRequestIdRef.current;
    setSelectedId(followUpDataId);
    setDetail(undefined);
    setDetailError(undefined);
    setDetailLoading(true);
    try {
      const nextDetail = await getFollowUpData(followUpDataId);
      if (requestId === detailRequestIdRef.current) setDetail(nextDetail);
    } catch {
      if (requestId === detailRequestIdRef.current) {
        setDetailError('跟进数据详情加载失败，请重试');
      }
    } finally {
      if (requestId === detailRequestIdRef.current) setDetailLoading(false);
    }
  }, []);

  useEffect(
    () => () => {
      detailRequestIdRef.current += 1;
    },
    [],
  );

  const refreshAfterChange = async (followUpDataId: string) => {
    await actionRef.current?.reload();
    if (selectedId === followUpDataId) await openDetail(followUpDataId);
  };

  const openClassification = (row: FollowUpDataRow) => {
    setClassificationTarget(row);
    setClassificationKey(createIdempotencyKey());
    classificationForm.setFieldsValue({
      classification: row.classification,
      lowValueReason: row.low_value_reason || undefined,
      reason: row.classification_reason || '',
      conclusion: row.latest_conclusion || '',
    });
  };

  const openSchedule = (row: FollowUpDataRow) => {
    setScheduleTarget(row);
    setScheduleKey(createIdempotencyKey());
    scheduleForm.resetFields();
  };

  const columns = useMemo<ProColumns<FollowUpDataRow>[]>(
    () => [
      {
        title: '客户姓名',
        dataIndex: 'customerName',
        hideInTable: true,
        fieldProps: { placeholder: '输入客户姓名' },
      },
      {
        title: '所属任务',
        dataIndex: 'taskId',
        valueType: 'select',
        hideInTable: true,
        request: loadTaskOptions,
        fieldProps: { showSearch: true, optionFilterProp: 'label' },
      },
      {
        title: '最近联系时间',
        dataIndex: 'lastContactAtRange',
        valueType: 'dateRange',
        hideInTable: true,
      },
      {
        title: '客户',
        dataIndex: 'customer_name',
        search: false,
        width: 180,
        render: (_, row) => (
          <Flex vertical gap={2}>
            <Text>{row.customer_name || '未命名客户'}</Text>
            <Text type="secondary">{row.masked_contact || '-'}</Text>
          </Flex>
        ),
      },
      {
        title: '所属任务',
        dataIndex: 'task_name',
        search: false,
        width: 180,
        ellipsis: true,
        renderText: (value) => value || '-',
      },
      {
        title: '当前分类',
        dataIndex: 'classification',
        search: false,
        width: 220,
        render: (_, row) => <ClassificationTag row={row} />,
      },
      {
        title: '最新沟通结论',
        dataIndex: 'latest_conclusion',
        search: false,
        width: 260,
        render: (_, row) => (
          <Tooltip title={row.latest_conclusion || undefined}>
            <Paragraph
              ellipsis={{ rows: 2 }}
              type={row.latest_conclusion ? undefined : 'secondary'}
              style={{ marginBottom: 0 }}
            >
              {row.latest_conclusion || '暂无沟通结论'}
            </Paragraph>
          </Tooltip>
        ),
      },
      {
        title: '最近联系时间',
        dataIndex: 'last_contact_at',
        search: false,
        width: 180,
        renderText: formatDateTime,
      },
      {
        title: '计划回访时间',
        dataIndex: 'next_follow_up_at',
        search: false,
        width: 180,
        renderText: formatDateTime,
      },
      {
        title: '操作',
        valueType: 'option',
        fixed: 'right',
        width: 340,
        render: (_, row) => (
          <Flex gap={4} wrap>
            <Button
              type="link"
              size="small"
              onClick={() => openDetail(row.follow_up_data_id)}
            >
              详情
            </Button>
            {row.blocking_human_call_id ? (
              <Button
                type="link"
                size="small"
                onClick={() =>
                  history.push(
                    `/ai-call/records?callId=${encodeURIComponent(row.blocking_human_call_id || '')}`,
                  )
                }
              >
                查看通话
              </Button>
            ) : (
              <PermissionButton
                permissions={['ai_call:agent:manage', 'ai_call:agent:console']}
                mode="all"
                noAccess="disable"
                title="立即人工外呼需要同时具备管理和坐席权限"
                type="link"
                size="small"
                onClick={() => setCallTarget(row)}
              >
                立即人工外呼
              </PermissionButton>
            )}
            <Button
              type="link"
              size="small"
              onClick={() => openClassification(row)}
            >
              调整分类
            </Button>
            {row.active_follow_up_id ? (
              <Button
                type="link"
                size="small"
                onClick={() =>
                  history.push(
                    `/ai-call/follow-up-overview?followUpId=${encodeURIComponent(row.active_follow_up_id || '')}`,
                  )
                }
              >
                查看回访任务
              </Button>
            ) : ['interested', 'nurturing'].includes(row.classification) ? (
              <Button
                type="link"
                size="small"
                onClick={() => openSchedule(row)}
              >
                安排后续回访
              </Button>
            ) : null}
          </Flex>
        ),
      },
    ],
    [openDetail],
  );

  return (
    <ListPage title="跟进数据">
      {messageContextHolder}
      <Tabs
        activeKey={classification}
        items={Object.entries(classificationLabels).map(([key, label]) => ({
          key,
          label,
        }))}
        onChange={(key) => setClassification(key as FollowUpClassification)}
      />
      <ProTable<FollowUpDataRow>
        className="recov-stable-pagination-table"
        actionRef={actionRef}
        rowKey="follow_up_data_id"
        columns={columns}
        params={{ classification }}
        search={{ labelWidth: 112, defaultCollapsed: false }}
        scroll={{ x: 1450 }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        request={async ({
          current,
          pageSize,
          classification: selected,
          customerName,
          taskId,
          lastContactAtRange,
        }) => {
          const lastRange = Array.isArray(lastContactAtRange)
            ? lastContactAtRange
            : undefined;
          const page = await listFollowUpData({
            classification: selected as FollowUpClassification,
            pageNum: current || 1,
            pageSize: pageSize || 20,
            customerName: customerName as string | undefined,
            taskId: taskId as string | undefined,
            lastContactAtBegin: lastRange?.[0]
              ? dayjs(lastRange[0]).startOf('day').toISOString()
              : undefined,
            lastContactAtEnd: lastRange?.[1]
              ? dayjs(lastRange[1]).add(1, 'day').startOf('day').toISOString()
              : undefined,
          });
          return { data: page.rows, total: page.total, success: true };
        }}
      />

      <FollowUpDataDetailDrawer
        detail={detail}
        error={detailError}
        loading={detailLoading}
        open={Boolean(selectedId)}
        onRetry={() => selectedId && openDetail(selectedId)}
        onClose={() => {
          detailRequestIdRef.current += 1;
          setSelectedId(undefined);
          setDetail(undefined);
          setDetailError(undefined);
        }}
      />

      {callTarget ? (
        <FollowUpDataCallModal
          key={callTarget.follow_up_data_id}
          target={callTarget}
          onClose={() => setCallTarget(undefined)}
          onFinished={(callId) => {
            setCallTarget(undefined);
            messageApi.success('通话已结束，请提交话后结果');
            history.push(
              `/ai-call/records?callId=${encodeURIComponent(callId)}`,
            );
          }}
        />
      ) : null}

      <Modal
        title="调整分类"
        open={Boolean(classificationTarget)}
        confirmLoading={classificationSubmitting}
        okText="确认调整"
        onCancel={() => setClassificationTarget(undefined)}
        onOk={async () => {
          if (!classificationTarget) return;
          const values = await classificationForm.validateFields();
          setClassificationSubmitting(true);
          try {
            await adjustFollowUpDataClassification(
              classificationTarget.follow_up_data_id,
              {
                classification: values.classification,
                reason: values.reason.trim(),
                conclusion: values.conclusion.trim(),
                lowValueReason:
                  values.classification === 'low_value'
                    ? values.lowValueReason
                    : undefined,
                expectedVersion: classificationTarget.version,
                idempotencyKey: classificationKey,
              },
            );
            messageApi.success('分类已更新');
            setClassificationTarget(undefined);
            await refreshAfterChange(classificationTarget.follow_up_data_id);
          } catch {
            messageApi.error('分类更新失败，请保留当前内容后重试');
          } finally {
            setClassificationSubmitting(false);
          }
        }}
      >
        <Form form={classificationForm} layout="vertical">
          <Form.Item
            label="客户分类"
            name="classification"
            rules={[{ required: true, message: '请选择客户分类' }]}
          >
            <Select
              options={Object.entries(classificationLabels).map(
                ([value, label]) => ({ value, label }),
              )}
            />
          </Form.Item>
          {selectedClassification === 'low_value' ? (
            <Form.Item
              label="低价值原因"
              name="lowValueReason"
              rules={[{ required: true, message: '请选择低价值原因' }]}
            >
              <Select
                options={Object.entries(lowValueReasonLabels).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
            </Form.Item>
          ) : null}
          <Form.Item
            label="调整原因"
            name="reason"
            rules={[
              { required: true, whitespace: true, message: '请填写调整原因' },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="说明本次分类判断依据"
            />
          </Form.Item>
          <Form.Item
            label="沟通结论"
            name="conclusion"
            rules={[
              { required: true, whitespace: true, message: '请填写沟通结论' },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={4000}
              showCount
              placeholder="确认或修正上次通话的沟通结论"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="安排后续回访"
        open={Boolean(scheduleTarget)}
        confirmLoading={scheduleSubmitting}
        okText="确认安排"
        onCancel={() => setScheduleTarget(undefined)}
        onOk={async () => {
          if (!scheduleTarget) return;
          const values = await scheduleForm.validateFields();
          setScheduleSubmitting(true);
          try {
            await scheduleFollowUpData(scheduleTarget.follow_up_data_id, {
              followUpReason: values.followUpReason.trim(),
              nextFollowUpAt: values.nextFollowUpAt.toISOString(),
              expectedVersion: scheduleTarget.version,
              idempotencyKey: scheduleKey,
            });
            messageApi.success('回访已安排');
            setScheduleTarget(undefined);
            await refreshAfterChange(scheduleTarget.follow_up_data_id);
          } catch {
            messageApi.error('回访安排失败，请保留当前内容后重试');
          } finally {
            setScheduleSubmitting(false);
          }
        }}
      >
        <Form form={scheduleForm} layout="vertical">
          <Form.Item
            label="本次回访原因"
            name="followUpReason"
            rules={[
              { required: true, whitespace: true, message: '请填写回访原因' },
            ]}
          >
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              placeholder="说明本次需要回访的目标或原因"
            />
          </Form.Item>
          <Form.Item
            label="计划回访时间"
            name="nextFollowUpAt"
            rules={[
              { required: true, message: '请选择计划回访时间' },
              {
                validator: (_, value: Dayjs | undefined) =>
                  !value || value.isAfter(dayjs())
                    ? Promise.resolve()
                    : Promise.reject(new Error('计划回访时间需晚于当前时间')),
              },
            ]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              disabledDate={(current) => current.isBefore(dayjs(), 'day')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </ListPage>
  );
};

export default FollowUpDataPage;

import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  Badge,
  Button,
  DatePicker,
  Flex,
  Input,
  Modal,
  message,
  Select,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type AttemptResult,
  type ClosedReason,
  claimFollowUp,
  type FollowUpCallbackCredentialDto,
  type FollowUpListQuery,
  type FollowUpNextAction,
  type FollowUpTaskDto,
  getAgentFollowUp,
  type IdempotentSessionInput,
  listAgentFollowUps,
  type SubmitFollowUpHandlingResultInput,
  startFollowUpCall,
  submitFollowUpHandlingResult,
} from '@/services/ruoyi/agent-console';
import './FollowUpPanel.css';
import AfterCallResultForm, {
  type AfterCallResultValues,
} from './AfterCallResultForm';
import FollowUpTaskDetailDrawer from './FollowUpTaskDetailDrawer';

const { Text } = Typography;

type FollowUpServices = {
  list: (params?: FollowUpListQuery) => Promise<unknown>;
  detail: (followUpId: string) => Promise<unknown>;
  claim: (followUpId: string, idempotencyKey: string) => Promise<unknown>;
  call: (followUpId: string, input: IdempotentSessionInput) => Promise<unknown>;
  submitResult: (
    followUpId: string,
    input: SubmitFollowUpHandlingResultInput,
  ) => Promise<unknown>;
};

type FollowUpPanelProps = {
  agentStatus?: string;
  handlingTaskToOpen?: { task: FollowUpTaskDto; callId?: string };
  callbackEnabled?: boolean;
  consoleSessionId?: string;
  onHandlingTaskOpened?: () => void;
  onPrepareCallback?: () => Promise<boolean>;
  services?: FollowUpServices;
  onCallAccepted?: (
    callback: FollowUpCallbackCredentialDto,
    task: FollowUpTaskDto,
  ) => void;
};

const defaultServices: FollowUpServices = {
  list: listAgentFollowUps,
  detail: getAgentFollowUp,
  claim: claimFollowUp,
  call: startFollowUpCall,
  submitResult: submitFollowUpHandlingResult,
};

const unwrapPage = (response: unknown) => {
  if (!response || typeof response !== 'object') return { rows: [], total: 0 };
  const data = Reflect.get(response, 'data');
  if (data && typeof data === 'object') {
    const rows = Reflect.get(data, 'rows');
    const total = Number(Reflect.get(data, 'total'));
    if (Array.isArray(rows))
      return { rows: rows as FollowUpTaskDto[], total: total || 0 };
  }
  const rows = Reflect.get(response, 'rows');
  const total = Number(Reflect.get(response, 'total'));
  return {
    rows: Array.isArray(rows) ? (rows as FollowUpTaskDto[]) : [],
    total: total || 0,
  };
};

const unwrapData = (response: unknown) =>
  response && typeof response === 'object' && Reflect.get(response, 'data')
    ? Reflect.get(response, 'data')
    : response;

const followUpStatusLabels: Record<FollowUpTaskDto['status'], string> = {
  pending: '待认领',
  processing: '已认领待处理',
  completed: '已办结',
  closed: '已终止',
};

const attemptResultLabels: Record<AttemptResult, string> = {
  connected: '已接通',
  no_answer: '无人接听',
  busy: '占线',
  rejected: '客户拒接',
  invalid_contact: '无效联系方式',
  technical_failure: '技术失败',
};

const formatCallbackAt = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '未约定回访时间';

export const isFutureFollowUpTime = (value: string, now = dayjs()) =>
  dayjs(value).isAfter(now);

const createIdempotencyKey = () => {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === 'function')
    return randomUuid.call(globalThis.crypto);
  // ponytail: HTTP fallback only; HTTPS restores Web Crypto UUIDs.
  return `follow-up-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const nextActionLabels: Record<FollowUpNextAction, string> = {
  continue: '继续跟进',
  complete: '办结任务',
  close: '终止跟进',
};

const allowedNextActions = (result: AttemptResult): FollowUpNextAction[] => {
  if (['no_answer', 'busy', 'technical_failure'].includes(result)) {
    return ['continue'];
  }
  if (['rejected', 'invalid_contact'].includes(result)) {
    return ['continue', 'close'];
  }
  return ['continue', 'complete', 'close'];
};

const attemptForCall = (task: FollowUpTaskDto, callId?: string) =>
  callId
    ? task.attempts?.find((attempt) => attempt.related_call_id === callId)
    : undefined;

const resultForCall = (task: FollowUpTaskDto, callId?: string) =>
  attemptForCall(task, callId)?.attempt_result || 'connected';

const defaultRemarkFor = (result: AttemptResult, hasCall: boolean) => {
  if (hasCall && result === 'no_answer') return '本次回拨未接通';
  if (!hasCall || result === 'connected') return '';
  return result === 'technical_failure'
    ? '本次回拨技术失败：'
    : `本次回拨${attemptResultLabels[result]}`;
};

const FollowUpPanel = ({
  agentStatus = 'available',
  handlingTaskToOpen,
  callbackEnabled = false,
  consoleSessionId,
  onHandlingTaskOpened,
  onPrepareCallback,
  services = defaultServices,
  onCallAccepted,
}: FollowUpPanelProps) => {
  const [scope, setScope] = useState<'unassigned' | 'mine'>('unassigned');
  const [scopeTotals, setScopeTotals] = useState<{
    unassigned?: number;
    mine?: number;
  }>({});
  const [messageApi, messageContextHolder] = message.useMessage();
  const [handlingTask, setHandlingTask] = useState<FollowUpTaskDto>();
  const [handlingCallId, setHandlingCallId] = useState<string>();
  const [contactResult, setContactResult] =
    useState<AttemptResult>('connected');
  const [handlingRemark, setHandlingRemark] = useState('');
  const [nextAction, setNextAction] = useState<FollowUpNextAction>('continue');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [closedReason, setClosedReason] = useState<ClosedReason>();
  const [handlingError, setHandlingError] = useState('');
  const [handlingIdempotencyKey, setHandlingIdempotencyKey] = useState('');
  const [selectedTask, setSelectedTask] = useState<FollowUpTaskDto>();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const loadedScopeRef = useRef(scope);
  const inFlightRef = useRef(new Set<string>());

  const runOnce = useCallback(
    async (key: string, operation: () => Promise<void>) => {
      if (inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);
      try {
        await operation();
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [],
  );

  const refreshScopeTotals = useCallback(async () => {
    try {
      const [unassigned, mine] = await Promise.all([
        services.list({
          pageNum: 1,
          pageSize: 1,
          ownership: 'unassigned',
          status: ['pending'],
        }),
        services.list({ pageNum: 1, pageSize: 1, ownership: 'mine' }),
      ]);
      setScopeTotals({
        unassigned: unwrapPage(unassigned).total,
        mine: unwrapPage(mine).total,
      });
    } catch {
      // 保留上一次已展示的数量，避免短暂请求失败显示错误的 0。
    }
  }, [services]);

  useEffect(() => {
    void refreshScopeTotals();
  }, [refreshScopeTotals]);

  const openHandlingResult = useCallback(
    (task: FollowUpTaskDto, callId?: string) =>
      runOnce(`handling:${task.id}:${callId || 'manual'}`, async () => {
        let detail = task;
        if (callId) {
          try {
            detail = unwrapData(await services.detail(task.id));
          } catch {
            messageApi.error('本次回拨结果加载失败，请稍后重试');
            return;
          }
        }
        const result = resultForCall(detail, callId);
        if (callId && !attemptForCall(detail, callId)) {
          messageApi.warning('本次回拨结果尚未生成，请刷新后重试');
          return;
        }
        setHandlingTask(detail);
        setHandlingCallId(callId);
        setContactResult(result);
        setHandlingRemark(defaultRemarkFor(result, Boolean(callId)));
        setNextAction('continue');
        setNextFollowUpAt('');
        setClosedReason(undefined);
        setHandlingError('');
        setHandlingIdempotencyKey(
          callId ? `follow-up-handling:${callId}` : createIdempotencyKey(),
        );
      }),
    [messageApi, runOnce, services],
  );

  useEffect(() => {
    if (!handlingTaskToOpen) return;
    void openHandlingResult(handlingTaskToOpen.task, handlingTaskToOpen.callId);
    onHandlingTaskOpened?.();
  }, [handlingTaskToOpen, onHandlingTaskOpened, openHandlingResult]);

  useEffect(() => {
    if (loadedScopeRef.current === scope) return;
    loadedScopeRef.current = scope;
    void actionRef.current?.reload();
  }, [scope]);

  const claim = (task: FollowUpTaskDto) =>
    runOnce(`claim:${task.id}`, async () => {
      try {
        await services.claim(task.id, createIdempotencyKey());
        messageApi.success('回访任务认领成功，负责人已固定为当前坐席');
        await Promise.all([actionRef.current?.reload(), refreshScopeTotals()]);
      } catch {
        messageApi.error('回访任务认领失败，请刷新后重试');
      }
    });

  const openTaskDetail = (task: FollowUpTaskDto) =>
    runOnce(`detail:${task.id}`, async () => {
      setSelectedTask(task);
      try {
        const detail = unwrapData(
          await services.detail(task.id),
        ) as FollowUpTaskDto;
        setSelectedTask((current) =>
          current?.id === task.id ? detail : current,
        );
      } catch {
        messageApi.error('跟进任务详情加载失败，请重试');
      }
    });

  const callCustomer = (task: FollowUpTaskDto) =>
    runOnce(`call:${task.id}`, async () => {
      if (!consoleSessionId) {
        messageApi.warning('请先在坐席工作台上线后再发起回拨');
        return;
      }
      if (!['available', 'offline', 'paused'].includes(agentStatus)) {
        messageApi.warning('当前坐席正在通话、话后处理或重连，暂不能回拨');
        return;
      }
      if (onPrepareCallback && !(await onPrepareCallback())) {
        messageApi.error('上线失败，请完成设备检查后重试');
        return;
      }
      const response = unwrapData(
        await services.call(task.id, {
          consoleSessionId,
          idempotencyKey: createIdempotencyKey(),
        }),
      ) as FollowUpCallbackCredentialDto;
      messageApi.success('回拨任务已受理，等待最终通话状态');
      if (response?.call_id) onCallAccepted?.(response, task);
    });

  const terminal = (task: FollowUpTaskDto) =>
    ['completed', 'closed'].includes(task.status);
  const statusLabel = (task: FollowUpTaskDto) => {
    if (task.awaiting_handling_result) return '待提交处理结果';
    if (scope === 'mine' && task.status === 'pending') return '待跟进';
    return followUpStatusLabels[task.status];
  };
  const canStartCallback =
    Boolean(consoleSessionId) &&
    ['available', 'offline', 'paused'].includes(agentStatus);
  const callbackInProgress = ['claiming', 'in_call', 'reconnecting'].includes(
    agentStatus,
  );
  const canSubmitHandlingResult = (task: FollowUpTaskDto) =>
    !callbackInProgress &&
    (!callbackEnabled || Boolean(task.awaiting_handling_result));

  const finishHandlingSubmission = async () => {
    messageApi.success('处理结果已提交');
    setHandlingTask(undefined);
    setHandlingError('');
    await Promise.all([actionRef.current?.reload(), refreshScopeTotals()]);
  };

  const submitCallResult = async (values: AfterCallResultValues) => {
    if (!handlingTask || !handlingCallId) return;
    await services.submitResult(handlingTask.id, {
      callId: handlingCallId,
      contactResult,
      remark: values.remark,
      classification: values.classification,
      lowValueReason: values.lowValueReason,
      conclusion: values.conclusion,
      scheduleFollowUp: values.scheduleFollowUp,
      nextFollowUpAt: values.nextFollowUpAt,
      expectedVersion: handlingTask.follow_up_data_version ?? 0,
      idempotencyKey: handlingIdempotencyKey,
    });
    await finishHandlingSubmission();
  };

  const taskActions = (task: FollowUpTaskDto) => (
    <Flex gap="small" wrap>
      <Button
        type="link"
        size="small"
        onClick={() => void openTaskDetail(task)}
      >
        查看详情
      </Button>
      {!terminal(task) &&
      scope === 'unassigned' &&
      !task.owner_agent_identity ? (
        <Button type="link" size="small" onClick={() => void claim(task)}>
          认领回访
        </Button>
      ) : null}
      {!terminal(task) && scope === 'mine' ? (
        <>
          {callbackEnabled ? (
            <Button
              type="link"
              size="small"
              disabled={!canStartCallback}
              title={
                canStartCallback
                  ? undefined
                  : '当前坐席正在通话、话后处理或重连，暂不能回拨'
              }
              onClick={() => void callCustomer(task)}
            >
              {agentStatus === 'available' ? '呼叫客户' : '上线并呼叫'}
            </Button>
          ) : null}
          {canSubmitHandlingResult(task) ? (
            <Button
              type="link"
              size="small"
              onClick={() =>
                void openHandlingResult(
                  task,
                  task.pending_handling_call_id || undefined,
                )
              }
            >
              提交处理结果
            </Button>
          ) : null}
        </>
      ) : null}
    </Flex>
  );

  const columns: ProColumns<FollowUpTaskDto>[] = [
    {
      title: '客户姓名',
      dataIndex: 'customerName',
      hideInTable: true,
    },
    {
      title: '客户',
      dataIndex: 'masked_contact',
      search: false,
      width: 170,
      render: (_, task) => (
        <Flex vertical gap={2}>
          {task.customer_name ? <Text>{task.customer_name}</Text> : null}
          <Text type={task.customer_name ? 'secondary' : undefined}>
            {task.masked_contact || '联系方式已脱敏'}
          </Text>
        </Flex>
      ),
    },
    {
      title: '所属任务',
      dataIndex: 'task_name',
      search: false,
      ellipsis: true,
      renderText: (value) => value || '-',
    },
    {
      title: '任务创建时间',
      dataIndex: 'createdAtRange',
      valueType: 'dateRange',
      width: 180,
      render: (_, task) => formatCallbackAt(task.created_at),
    },
    {
      title: '跟进原因',
      dataIndex: 'follow_up_reason',
      search: false,
      ellipsis: true,
    },
    {
      title: '应跟进时间',
      dataIndex: 'customer_callback_at',
      search: false,
      width: 190,
      renderText: (value) => formatCallbackAt(value),
    },
    ...(scope === 'mine'
      ? [
          {
            title: '回访状态',
            dataIndex: 'status',
            valueType: 'select' as const,
            valueEnum: {
              pending: { text: '待跟进' },
              processing: { text: '已认领待处理' },
              completed: { text: '已办结' },
              closed: { text: '已终止' },
            },
            width: 120,
            render: (_: unknown, task: FollowUpTaskDto) => (
              <Tag
                color={
                  task.status === 'completed'
                    ? 'success'
                    : task.status === 'closed'
                      ? 'default'
                      : 'processing'
                }
              >
                {statusLabel(task)}
              </Tag>
            ),
          } satisfies ProColumns<FollowUpTaskDto>,
        ]
      : []),
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 220,
      render: (_, task) => taskActions(task),
    },
  ];

  return (
    <div className="agent-follow-up-panel">
      {messageContextHolder}
      <Tabs
        className="agent-follow-up-scope-tabs"
        activeKey={scope}
        items={[
          {
            key: 'unassigned',
            label: (
              <span className="agent-follow-up-scope-label">
                待认领回访
                {scopeTotals.unassigned !== undefined ? (
                  <Badge
                    color="#722ed1"
                    count={scopeTotals.unassigned}
                    showZero
                    size="small"
                  />
                ) : null}
              </span>
            ),
          },
          {
            key: 'mine',
            label: (
              <span className="agent-follow-up-scope-label">
                我的任务
                {scopeTotals.mine !== undefined ? (
                  <Badge
                    color="#722ed1"
                    count={scopeTotals.mine}
                    showZero
                    size="small"
                  />
                ) : null}
              </span>
            ),
          },
        ]}
        onChange={(key) => setScope(key as 'unassigned' | 'mine')}
      />
      <ProTable<FollowUpTaskDto>
        className="recov-stable-pagination-table"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        params={{ ownership: scope }}
        search={{ labelWidth: 104 }}
        scroll={{ x: 1400 }}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        request={async ({
          current,
          pageSize,
          ownership,
          createdAtRange,
          ...filters
        }) => {
          const createdRange = Array.isArray(createdAtRange)
            ? createdAtRange
            : undefined;
          const page = unwrapPage(
            await services.list({
              pageNum: current,
              pageSize,
              ownership: ownership as 'unassigned' | 'mine',
              status: filters.status
                ? [filters.status as FollowUpTaskDto['status']]
                : ownership === 'unassigned'
                  ? ['pending']
                  : undefined,
              customerName: filters.customerName as string | undefined,
              createdAtBegin: createdRange?.[0]
                ? dayjs(createdRange[0]).startOf('day').toISOString()
                : undefined,
              createdAtEnd: createdRange?.[1]
                ? dayjs(createdRange[1]).endOf('day').toISOString()
                : undefined,
            }),
          );
          return { data: page.rows, total: page.total, success: true };
        }}
      />

      <FollowUpTaskDetailDrawer
        open={Boolean(selectedTask)}
        task={selectedTask}
        onClose={() => setSelectedTask(undefined)}
      />

      <Modal
        title={handlingCallId ? '提交话后结果' : '提交处理结果'}
        open={Boolean(handlingTask)}
        okText="提交结果"
        cancelText="取消"
        footer={handlingCallId ? null : undefined}
        mask={{ enabled: true, closable: false }}
        onCancel={() => setHandlingTask(undefined)}
        onOk={async () => {
          if (!handlingTask || handlingCallId) return;
          const remark = handlingRemark.trim();
          if (!remark) {
            setHandlingError('请填写处理备注');
            return;
          }
          if (
            contactResult === 'technical_failure' &&
            remark === '本次回拨技术失败：'
          ) {
            setHandlingError('请补充技术失败原因');
            return;
          }
          if (nextAction === 'continue' && !nextFollowUpAt) {
            setHandlingError('请选择下次跟进时间');
            return;
          }
          if (
            nextAction === 'continue' &&
            !isFutureFollowUpTime(nextFollowUpAt)
          ) {
            setHandlingError('下次跟进时间需晚于当前时间');
            return;
          }
          if (nextAction === 'close' && !closedReason) {
            setHandlingError('请选择终止原因');
            return;
          }
          try {
            await services.submitResult(handlingTask.id, {
              callId: handlingCallId,
              contactChannel: handlingCallId ? undefined : 'other',
              contactResult,
              remark,
              nextAction,
              nextFollowUpAt:
                nextAction === 'continue'
                  ? new Date(nextFollowUpAt).toISOString()
                  : undefined,
              closedReason: nextAction === 'close' ? closedReason : undefined,
              idempotencyKey: handlingIdempotencyKey,
            });
            await finishHandlingSubmission();
          } catch {
            setHandlingError('处理结果提交失败，请保留当前内容后重试');
          }
        }}
      >
        {handlingTask && handlingCallId ? (
          <AfterCallResultForm
            key={handlingCallId}
            contactResult={contactResult}
            currentClassification={handlingTask.classification}
            includeConverted
            includeInvalidContactReason={false}
            initialRemark={defaultRemarkFor(contactResult, true)}
            submitText="提交话后结果"
            onSubmit={submitCallResult}
          />
        ) : (
          <div className="agent-follow-up-close-form">
            {handlingError ? (
              <Alert type="error" showIcon title={handlingError} />
            ) : null}
            <Select
              aria-label="联系结果"
              disabled={Boolean(handlingCallId)}
              value={contactResult}
              options={[
                { value: 'connected', label: '已接通' },
                { value: 'no_answer', label: '无人接听' },
                { value: 'busy', label: '占线' },
                { value: 'rejected', label: '客户拒接' },
                { value: 'invalid_contact', label: '联系方式无效' },
                { value: 'technical_failure', label: '技术失败' },
              ]}
              onChange={(value) => {
                setContactResult(value);
                setNextAction('continue');
                setHandlingRemark(defaultRemarkFor(value, false));
                setHandlingError('');
              }}
            />
            <Input.TextArea
              aria-label="处理备注"
              rows={3}
              placeholder="填写本次沟通结论"
              maxLength={300}
              value={handlingRemark}
              onChange={(event) => {
                setHandlingRemark(event.target.value);
                setHandlingError('');
              }}
            />
            <Select
              aria-label="下一步"
              value={nextAction}
              options={allowedNextActions(contactResult).map((value) => ({
                value,
                label: nextActionLabels[value],
              }))}
              onChange={(value) => {
                setNextAction(value);
                setHandlingError('');
              }}
            />
            {nextAction === 'continue' ? (
              <DatePicker
                aria-label="下次跟进时间"
                format="YYYY-MM-DD HH:mm"
                showTime={{ format: 'HH:mm', hideDisabledOptions: true }}
                style={{ width: '100%' }}
                value={nextFollowUpAt ? dayjs(nextFollowUpAt) : null}
                disabledDate={(current) => current.isBefore(dayjs(), 'day')}
                disabledTime={(current) => {
                  const now = dayjs();
                  if (!current.isSame(now, 'day')) return {};
                  return {
                    disabledHours: () =>
                      Array.from({ length: now.hour() }, (_, hour) => hour),
                    disabledMinutes: (hour) =>
                      hour === now.hour()
                        ? Array.from(
                            { length: now.minute() + 1 },
                            (_, minute) => minute,
                          )
                        : [],
                  };
                }}
                onChange={(value) => {
                  setNextFollowUpAt(value?.format('YYYY-MM-DDTHH:mm') || '');
                  setHandlingError('');
                }}
              />
            ) : null}
            {nextAction === 'close' ? (
              <Select
                aria-label="终止原因"
                placeholder="选择终止原因"
                value={closedReason}
                options={[
                  { value: 'customer_refused', label: '客户明确拒绝' },
                  { value: 'invalid_contact', label: '联系方式无效' },
                  { value: 'created_by_error', label: '任务误创建' },
                  { value: 'no_longer_needed', label: '已无需跟进' },
                  { value: 'other', label: '其他' },
                ]}
                onChange={(value) => {
                  setClosedReason(value);
                  setHandlingError('');
                }}
              />
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FollowUpPanel;

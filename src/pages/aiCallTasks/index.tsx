import { BarChartOutlined, PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  message,
  Progress,
  Space,
  Tag,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useRef, useState } from 'react';
import {
  ListPage,
  ListStack,
  TableCard,
} from '@/components/ListLayout';
import TaskActions from './components/TaskActions';
import TaskStatusTag from './components/TaskStatusTag';
import {
  type AiCallTask,
  getTaskProgress,
  isTaskPollingStatus,
  type TaskActionKey,
  type TaskStatus,
} from './domain';
import { useVisiblePolling } from './hooks/useVisiblePolling';
import {
  cancelAiCallTask,
  listAiCallTasks,
  pauseAiCallTask,
  resumeAiCallTask,
  stopAiCallTask,
  updateAiCallTaskSchedule,
} from './service';

type ScheduleFormValues = {
  taskName: string;
  scheduledAt: Dayjs;
};

type ActionState = {
  taskId: string;
  action: TaskActionKey;
};

const statusValueEnum: Record<TaskStatus, { text: string }> = {
  SCHEDULED: { text: '待执行' },
  RUNNING: { text: '执行中' },
  PAUSING: { text: '暂停中' },
  PAUSED: { text: '已暂停' },
  STOPPING: { text: '停止中' },
  STOPPED: { text: '已停止' },
  COMPLETED: { text: '已完成' },
  FAILED: { text: '失败' },
  CANCELLED: { text: '已取消' },
};

const confirmationCopy: Partial<
  Record<TaskActionKey, (task: AiCallTask) => string>
> = {
  pause: (task) =>
    `确认暂停外呼任务“${task.taskName}”吗？系统将停止发起新的呼叫，正在进行中的通话不受影响。`,
  stop: (task) =>
    `确认停止外呼任务“${task.taskName}”吗？未拨打对象将不再执行，正在进行中的通话不强制中断。`,
  cancel: (task) =>
    `确认取消外呼任务“${task.taskName}”吗？取消后该任务不会按计划执行。`,
};

const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `ai-call-task-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '操作失败，请稍后重试';

const getTaskExecutionLabel = (task: AiCallTask) => {
  if (task.answerMode === 'web') return 'Web 接听';
  const dialerTypes = Array.from(new Set(task.attemptDialerTypes || []));
  if (dialerTypes.length === 0) return '尚未执行';
  if (dialerTypes.length > 1) return '混合执行';
  if (dialerTypes[0] === 'mock') return 'Mock 流程演练';
  if (dialerTypes[0] === 'sip') return 'SIP 外呼';
  if (dialerTypes[0]?.startsWith('linphone')) return 'Linphone 本地验证';
  if (dialerTypes[0] === 'owner_runtime') return '平台运行时';
  return dialerTypes[0].toUpperCase();
};

const getTaskResultText = (task: AiCallTask) => {
  if (task.answerMode === 'web') {
    if (task.connectedTargets > 0) return `Web 接通 ${task.connectedTargets}`;
    if ((task.failedAttempts || 0) > 0) {
      return `Web 接听失败 ${task.failedAttempts}`;
    }
    return 'Web 接通 0';
  }
  const dialerTypes = new Set(task.attemptDialerTypes || []);
  if (dialerTypes.size === 0) return '—';
  if (dialerTypes.size > 1) {
    return `成功 ${task.connectedTargets}（含 Mock）`;
  }
  if (dialerTypes.has('mock')) return `模拟成功 ${task.connectedTargets}`;
  if ([...dialerTypes].some((item) => item.startsWith('linphone'))) {
    return `本地接通 ${task.connectedTargets}`;
  }
  return `SIP 接通 ${task.connectedTargets}`;
};

const isWebTaskWaitingRetry = (task: AiCallTask) =>
  task.answerMode === 'web' &&
  task.status === 'RUNNING' &&
  (task.failedAttempts || 0) > 0 &&
  Boolean(task.nextDispatchAt);

const AiCallTasksPage = () => {
  const actionRef = useRef<ActionType>(null);
  const [scheduleForm] = Form.useForm<ScheduleFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [hasPollingTask, setHasPollingTask] = useState(false);
  const [actionState, setActionState] = useState<ActionState>();
  const [scheduleTask, setScheduleTask] = useState<AiCallTask>();
  const [savingSchedule, setSavingSchedule] = useState(false);

  useVisiblePolling({
    enabled: hasPollingTask,
    intervalMs: 10_000,
    onTick: () => actionRef.current?.reload(),
  });

  const executeAction = async (
    action: 'pause' | 'resume' | 'stop' | 'cancel',
    task: AiCallTask,
  ) => {
    const command = {
      pause: pauseAiCallTask,
      resume: resumeAiCallTask,
      stop: stopAiCallTask,
      cancel: cancelAiCallTask,
    }[action];

    setActionState({ taskId: task.taskId, action });
    try {
      await command(task.taskId, createIdempotencyKey());
      messageApi.success('操作已受理，任务状态将在后台更新');
      await actionRef.current?.reload();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
      throw error;
    } finally {
      setActionState(undefined);
    }
  };

  const confirmAction = (
    action: 'pause' | 'stop' | 'cancel',
    task: AiCallTask,
  ) => {
    const label =
      action === 'pause' ? '暂停' : action === 'stop' ? '停止' : '取消';
    modalApi.confirm({
      title: `${label}外呼任务`,
      content: confirmationCopy[action]?.(task),
      okText: `确认${label}`,
      okButtonProps: { danger: action !== 'pause' },
      cancelText: '返回',
      onOk: () => executeAction(action, task),
    });
  };

  const openScheduleEditor = (task: AiCallTask) => {
    scheduleForm.setFieldsValue({
      taskName: task.taskName,
      scheduledAt: task.scheduledAt ? dayjs(task.scheduledAt) : dayjs(),
    });
    setScheduleTask(task);
  };

  const saveSchedule = async (values: ScheduleFormValues) => {
    if (!scheduleTask) return;
    setSavingSchedule(true);
    try {
      await updateAiCallTaskSchedule(
        scheduleTask.taskId,
        {
          taskName: values.taskName.trim(),
          scheduledAt: values.scheduledAt.format('YYYY-MM-DD HH:mm:ss'),
        },
        createIdempotencyKey(),
      );
      messageApi.success('操作已受理，任务状态将在后台更新');
      setScheduleTask(undefined);
      scheduleForm.resetFields();
      await actionRef.current?.reload();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleTaskAction = (action: TaskActionKey, task: AiCallTask) => {
    if (action === 'view') {
      history.push(`/ai-call/tasks/${task.taskId}`);
      return;
    }
    if (action === 'editSchedule') {
      openScheduleEditor(task);
      return;
    }
    if (action === 'resume') {
      void executeAction(action, task);
      return;
    }
    confirmAction(action, task);
  };

  const columns: ProColumns<AiCallTask>[] = [
    {
      title: '任务名称',
      dataIndex: 'taskName',
      width: 220,
      render: (_value, task) => (
        <Space orientation="vertical" size={0}>
          <span>{task.taskName}</span>
          <span className="text-gray-500">
            {task.taskMode === 'single' ? '单个客户' : '名单外呼'}
          </span>
        </Space>
      ),
    },
    {
      title: '外呼对象',
      dataIndex: 'totalTargets',
      width: 100,
      search: false,
      render: (_value, task) => `${task.totalTargets} 个`,
    },
    {
      title: '完成进度',
      key: 'progress',
      width: 190,
      search: false,
      render: (_value, task) => (
        <Progress
          percent={getTaskProgress(task)}
          size="small"
          format={() => `${task.completedTargets}/${task.totalTargets}`}
        />
      ),
    },
    {
      title: '执行方式',
      key: 'executionType',
      width: 140,
      search: false,
      renderText: (_value, task) => getTaskExecutionLabel(task),
    },
    {
      title: '执行结果',
      key: 'executionResult',
      width: 150,
      search: false,
      renderText: (_value, task) => getTaskResultText(task),
    },
    {
      title: '任务状态',
      dataIndex: 'status',
      width: 190,
      valueType: 'select',
      valueEnum: statusValueEnum,
      render: (_value, task) => (
        <Space orientation="vertical" size={0}>
          {isWebTaskWaitingRetry(task) ? (
            <Tag color="warning">等待重试</Tag>
          ) : (
            <TaskStatusTag status={task.status} />
          )}
          {isWebTaskWaitingRetry(task) ? (
            <span className="text-gray-500">
              下次重试：{task.nextDispatchAt}
            </span>
          ) : null}
          {task.status === 'FAILED' && task.errorMessage ? (
            <span className="text-red-500">{task.errorMessage}</span>
          ) : null}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTimeRange',
      hideInTable: true,
    },
    {
      title: '计划/开始时间',
      key: 'executionTime',
      width: 180,
      search: false,
      render: (_value, task) =>
        task.executionMode === 'scheduled'
          ? task.scheduledAt || '—'
          : task.startedAt || '—',
    },
    {
      title: '创建人',
      dataIndex: 'createdByName',
      width: 120,
      search: false,
      renderText: (value) => value || '—',
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      search: false,
      render: (_value, task) => (
        <TaskActions
          task={task}
          loadingAction={
            actionState?.taskId === task.taskId ? actionState.action : undefined
          }
          onAction={handleTaskAction}
        />
      ),
    },
  ];

  return (
    <ListPage breadcrumbRender={false} title="外呼任务">
      {messageContextHolder}
      {modalContextHolder}
      <ListStack>
        <div className="flex items-center justify-between gap-4">
          <h2 className="m-0 text-xl font-semibold">外呼任务</h2>
          <Space>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => history.push('/ai-call/statistics')}
            >
              外呼统计
            </Button>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => history.push('/ai-call/tasks/create')}
            >
              新建任务
            </Button>
          </Space>
        </div>

        <TableCard>
          <ProTable<AiCallTask>
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
              const createdAt = params.createdAt as
                | [string, string]
                | undefined;
              const result = await listAiCallTasks({
                pageNum: params.current || 1,
                pageSize: params.pageSize || 20,
                taskName: params.taskName,
                status: params.status,
                beginTime: createdAt?.[0],
                endTime: createdAt?.[1],
              });
              setHasPollingTask(
                result.rows.some((task) => isTaskPollingStatus(task.status)),
              );
              return {
                data: result.rows,
                total: result.total,
                success: true,
              };
            }}
            rowKey="taskId"
            scroll={{ x: 1200 }}
            search={{ labelWidth: 'auto' }}
          />
        </TableCard>
      </ListStack>

      <Modal
        confirmLoading={savingSchedule}
        destroyOnHidden
        forceRender
        okText="保存"
        open={scheduleTask !== undefined}
        title="修改定时任务"
        onCancel={() => {
          setScheduleTask(undefined);
          scheduleForm.resetFields();
        }}
        onOk={() => scheduleForm.submit()}
      >
        <Form<ScheduleFormValues>
          form={scheduleForm}
          layout="vertical"
          onFinish={saveSchedule}
        >
          <Form.Item
            label="任务名称"
            name="taskName"
            rules={[
              { required: true, whitespace: true, message: '请输入任务名称' },
            ]}
          >
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item
            label="计划执行时间"
            name="scheduledAt"
            rules={[{ required: true, message: '请选择计划执行时间' }]}
          >
            <DatePicker
              className="w-full"
              format="YYYY-MM-DD HH:mm:ss"
              minDate={dayjs()}
              showTime
            />
          </Form.Item>
        </Form>
      </Modal>
    </ListPage>
  );
};

export default AiCallTasksPage;

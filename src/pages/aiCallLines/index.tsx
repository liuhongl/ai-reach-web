import {
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  PoweroffOutlined,
  StarOutlined,
} from '@ant-design/icons';
import {
  type ActionType,
  DrawerForm,
  type ProColumns,
  ProForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Modal, message, Tag, Tooltip } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import * as React from 'react';
import { useRef, useState } from 'react';
import { ListPage } from '@/components/ListLayout';
import TableActions from '@/components/TableActions';
import { useDeleteConfirm } from '@/hooks/useDeleteConfirm';
import {
  type AiCallLine,
  type AiCallLineHealthStatus,
  type AiCallLinePayload,
  type AiCallLineRouteMode,
  createAiCallLine,
  deleteAiCallLine,
  disableAiCallLine,
  enableAiCallLine,
  listAiCallLines,
  preflightAiCallLine,
  setDefaultAiCallLine,
  updateAiCallLine,
} from './service';

type LineFormValues = Omit<
  Partial<AiCallLinePayload>,
  'expiresAt' | 'unitPrice'
> & {
  routeMode?: AiCallLineRouteMode;
  expiresAt?: string | Dayjs | null;
  unitPrice?: string | number | null;
};

const routeModeLabels: Record<AiCallLineRouteMode, string> = {
  managed_trunk_id: '已有 LiveKit Trunk',
  inline_hostname: '厂商 SIP 线路',
};

const healthStatusMeta: Record<
  AiCallLineHealthStatus,
  { color?: string; label: string }
> = {
  UNKNOWN: { label: '未检查' },
  AVAILABLE: { color: 'success', label: '配置通过' },
  MISCONFIGURED: { color: 'warning', label: '配置异常' },
  UNAVAILABLE: { color: 'error', label: '不可用' },
};

const createInitialValues: LineFormValues = {
  enabled: false,
  adapterType: 'livekit_sip',
  routeMode: 'inline_hostname',
  proxyPort: 5089,
  authMode: 'ip_allowlist',
  destinationCountry: 'CN',
  maxConcurrency: 1,
  originateTimeoutSeconds: 30,
};

const trimmed = (value: unknown) => String(value ?? '').trim();

export const createLineCode = (now = Date.now()) =>
  `sip-line-${now.toString(36)}`;

export const toCopyInitialValues = (
  line: AiCallLine,
  now = Date.now(),
): LineFormValues => {
  const suffix = '（副本）';
  return {
    ...line,
    lineCode: createLineCode(now),
    lineName: `${line.lineName.slice(0, 100 - suffix.length)}${suffix}`,
    enabled: false,
  };
};

export const toLinePayload = (values: LineFormValues): AiCallLinePayload => {
  const unitPrice = trimmed(values.unitPrice);
  const expiresAt = dayjs.isDayjs(values.expiresAt)
    ? values.expiresAt.format('YYYY-MM-DD')
    : trimmed(values.expiresAt);
  return {
    lineCode: trimmed(values.lineCode),
    lineName: trimmed(values.lineName),
    description: trimmed(values.description) || null,
    unitPrice: unitPrice ? Number(unitPrice).toFixed(4) : null,
    purpose: trimmed(values.purpose) || null,
    expiresAt: expiresAt || null,
    enabled: values.enabled ?? false,
    adapterType: 'livekit_sip',
    routeMode: 'inline_hostname',
    trunkId: null,
    proxyHost: trimmed(values.proxyHost),
    proxyPort: Number(values.proxyPort),
    authMode: 'ip_allowlist',
    callerNumber: trimmed(values.callerNumber),
    destinationCountry: 'CN',
    maxConcurrency: Number(values.maxConcurrency),
    originateTimeoutSeconds: Number(values.originateTimeoutSeconds),
  };
};

const lineEndpoint = (line: AiCallLine) =>
  line.routeMode === 'managed_trunk_id'
    ? line.trunkId || '-'
    : [line.proxyHost, line.proxyPort].filter(Boolean).join(':') || '-';

const AiCallLinesPage = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<AiCallLine>();
  const [creatingValues, setCreatingValues] = useState<LineFormValues>(() => ({
    ...createInitialValues,
    lineCode: createLineCode(),
  }));
  const [busyAction, setBusyAction] = useState('');
  const openDeleteConfirm = useDeleteConfirm({
    modal: modalApi,
    messageApi,
  });

  const reloadTable = () => {
    actionRef.current?.reload();
  };

  const runAction = async (
    actionKey: string,
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setBusyAction(actionKey);
    try {
      await action();
      messageApi.success(successMessage);
      reloadTable();
    } finally {
      setBusyAction('');
    }
  };

  const openCreateDrawer = () => {
    setEditingLine(undefined);
    setCreatingValues({
      ...createInitialValues,
      lineCode: createLineCode(),
    });
    setDrawerOpen(true);
  };

  const openEditDrawer = (line: AiCallLine) => {
    setEditingLine(line);
    setDrawerOpen(true);
  };

  const openCopyDrawer = (line: AiCallLine) => {
    setEditingLine(undefined);
    setCreatingValues(toCopyInitialValues(line));
    setDrawerOpen(true);
  };

  const checkLine = async (line: AiCallLine) => {
    const actionKey = `preflight:${line.lineId}`;
    setBusyAction(actionKey);
    try {
      const result = await preflightAiCallLine(line.lineId);
      const status = healthStatusMeta[result.healthStatus];
      const content = result.healthMessage
        ? `${status.label}：${result.healthMessage}`
        : status.label;
      if (result.healthStatus === 'AVAILABLE') {
        messageApi.success(content);
      } else {
        messageApi.warning(content);
      }
      reloadTable();
    } finally {
      setBusyAction('');
    }
  };

  const confirmSetDefault = (line: AiCallLine) => {
    modalApi.confirm({
      title: '设为默认线路',
      content: `确定将「${line.lineName}」设为默认线路吗？后续新建的外呼任务将使用该线路。`,
      okText: '确认设置',
      cancelText: '取消',
      onOk: () =>
        runAction(
          `default:${line.lineId}`,
          () => setDefaultAiCallLine(line.lineId),
          '默认线路设置成功',
        ),
    });
  };

  const confirmToggleLine = (line: AiCallLine) => {
    const nextEnabled = !line.enabled;
    modalApi.confirm({
      title: nextEnabled ? '启用线路' : '停用线路',
      content: nextEnabled
        ? `确定启用「${line.lineName}」吗？`
        : `确定停用「${line.lineName}」吗？停用后该线路不能用于新的外呼任务。`,
      okText: nextEnabled ? '确认启用' : '确认停用',
      cancelText: '取消',
      okButtonProps: nextEnabled ? undefined : { danger: true },
      onOk: () =>
        runAction(
          `toggle:${line.lineId}`,
          () =>
            nextEnabled
              ? enableAiCallLine(line.lineId)
              : disableAiCallLine(line.lineId),
          nextEnabled ? '线路已启用' : '线路已停用',
        ),
    });
  };

  const confirmDeleteLine = (line: AiCallLine) => {
    openDeleteConfirm({
      records: [line],
      entityName: '线路',
      getName: (item) => item.lineName,
      description:
        '删除后该线路不能继续用于新的外呼任务，历史任务仍保留线路快照。',
      onConfirm: async () => {
        await deleteAiCallLine(line.lineId);
      },
      onSuccess: reloadTable,
    });
  };

  const columns: ProColumns<AiCallLine>[] = [
    {
      title: '线路名称',
      dataIndex: 'lineName',
      width: 190,
    },
    {
      title: '默认线路',
      dataIndex: 'isDefault',
      width: 108,
      render: (_, line) =>
        line.isDefault ? (
          <Tag color="processing" variant="outlined">
            默认线路
          </Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      width: 220,
      ellipsis: true,
      renderText: (value) => value || '-',
    },
    {
      title: '接入方式',
      dataIndex: 'routeMode',
      width: 120,
      renderText: (value: AiCallLineRouteMode) =>
        routeModeLabels[value] || value,
    },
    {
      title: 'SIP 接入地址',
      key: 'endpoint',
      width: 210,
      ellipsis: true,
      renderText: (_, line) => lineEndpoint(line),
    },
    {
      title: '报备主叫号码',
      dataIndex: 'callerNumber',
      width: 150,
    },
    {
      title: '最大并发',
      dataIndex: 'maxConcurrency',
      width: 100,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      width: 150,
      renderText: (value) =>
        value === null || value === undefined || value === ''
          ? '-'
          : `${Number(value).toFixed(4)} 元/分钟`,
    },
    {
      title: '用途',
      dataIndex: 'purpose',
      width: 180,
      ellipsis: true,
      renderText: (value) => value || '-',
    },
    {
      title: '健康状态',
      dataIndex: 'healthStatus',
      width: 118,
      render: (_, line) => {
        const meta = healthStatusMeta[line.healthStatus];
        return (
          <Tooltip title={line.healthMessage || undefined}>
            <Tag color={meta.color} variant="outlined">
              {meta.label}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      width: 108,
      render: (_, line) => (
        <Tag color={line.enabled ? 'success' : undefined} variant="outlined">
          {line.enabled ? '已启用' : '已停用'}
        </Tag>
      ),
    },
    {
      title: '到期时间',
      dataIndex: 'expiresAt',
      valueType: 'date',
      width: 130,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
      width: 180,
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 120,
      render: (_, line) => (
        <TableActions
          maxVisible={2}
          actions={[
            {
              key: 'edit',
              label: '编辑线路',
              icon: <EditOutlined />,
              onClick: () => openEditDrawer(line),
            },
            {
              key: 'preflight',
              label: '配置检查',
              icon: <CheckCircleOutlined />,
              loading: busyAction === `preflight:${line.lineId}`,
              onClick: () => {
                void checkLine(line);
              },
            },
            {
              key: 'copy',
              label: '复制配置',
              icon: <CopyOutlined />,
              onClick: () => openCopyDrawer(line),
            },
            {
              key: 'default',
              label: '设为默认',
              icon: <StarOutlined />,
              disabled: line.isDefault || !line.enabled,
              loading: busyAction === `default:${line.lineId}`,
              onClick: () => confirmSetDefault(line),
            },
            {
              key: 'toggle',
              label: line.enabled ? '停用线路' : '启用线路',
              icon: <PoweroffOutlined />,
              danger: line.enabled,
              disabled: line.isDefault,
              loading: busyAction === `toggle:${line.lineId}`,
              onClick: () => confirmToggleLine(line),
            },
            {
              key: 'delete',
              label: '删除线路',
              icon: <DeleteOutlined />,
              danger: true,
              disabled: line.isDefault,
              onClick: () => confirmDeleteLine(line),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <ListPage title="线路配置">
      {messageContextHolder}
      {modalContextHolder}
      <ProTable<AiCallLine>
        className="recov-stable-pagination-table"
        actionRef={actionRef}
        rowKey="lineId"
        search={false}
        columns={columns}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ x: 2180 }}
        request={async (params) => {
          const result = await listAiCallLines({
            pageNum: params.current || 1,
            pageSize: params.pageSize || 10,
          });
          return {
            data: result.rows,
            total: result.total,
            success: true,
          };
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateDrawer}
          >
            新增线路
          </Button>,
        ]}
      />

      <DrawerForm<LineFormValues>
        key={editingLine?.lineId || String(creatingValues.lineCode)}
        title={editingLine ? '编辑线路配置' : '新增线路配置'}
        open={drawerOpen}
        width={760}
        initialValues={{
          ...(editingLine || creatingValues),
          expiresAt: (editingLine || creatingValues).expiresAt
            ? dayjs((editingLine || creatingValues).expiresAt)
            : undefined,
        }}
        drawerProps={{
          destroyOnHidden: true,
          maskClosable: false,
          onClose: () => setDrawerOpen(false),
        }}
        submitter={{
          searchConfig: {
            submitText: '保存',
            resetText: '取消',
          },
        }}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditingLine(undefined);
        }}
        onFinish={async (values) => {
          const payload = toLinePayload({
            ...values,
            lineCode: editingLine?.lineCode || creatingValues.lineCode,
          });
          if (editingLine) {
            await updateAiCallLine(editingLine.lineId, payload);
          } else {
            await createAiCallLine(payload);
          }
          messageApi.success(editingLine ? '线路修改成功' : '线路新增成功');
          reloadTable();
          return true;
        }}
      >
        <ProForm.Group title="基本信息">
          <ProFormText
            name="lineName"
            label="线路名称"
            width="xl"
            placeholder="请输入线路名称"
            rules={[{ required: true, message: '请输入线路名称' }]}
          />
          <ProFormSwitch name="enabled" label="启用状态" />
        </ProForm.Group>

        <ProForm.Group title="SIP 接入">
          <ProFormText
            name="proxyHost"
            label="SIP 地址"
            width="md"
            placeholder="请输入厂商 SIP 域名或 IP 地址"
            rules={[{ required: true, message: '请输入 SIP 地址' }]}
          />
          <ProFormDigit
            name="proxyPort"
            label="SIP 端口"
            width="md"
            min={1}
            max={65535}
            placeholder="5089"
            rules={[{ required: true, message: '请输入 SIP 端口' }]}
          />
          <ProFormText
            name="callerNumber"
            label="报备主叫号码"
            width="md"
            placeholder="请输入厂商已报备的主叫号码"
            rules={[{ required: true, message: '请输入报备主叫号码' }]}
          />
        </ProForm.Group>

        <ProForm.Group title="容量设置">
          <ProFormDigit
            name="maxConcurrency"
            label="最大并发"
            width="md"
            min={1}
            max={1000}
            rules={[{ required: true, message: '请输入最大并发' }]}
          />
          <ProFormDigit
            name="originateTimeoutSeconds"
            label="呼叫超时"
            width="md"
            min={1}
            max={120}
            fieldProps={{ suffix: '秒' }}
            rules={[{ required: true, message: '请输入呼叫超时' }]}
          />
        </ProForm.Group>

        <ProForm.Group title="业务信息">
          <ProFormDigit
            name="unitPrice"
            label="单价"
            width="md"
            min={0}
            max={99_999_999.9999}
            fieldProps={{
              precision: 4,
              step: 0.0001,
              stringMode: true,
              suffix: '元/分钟',
            }}
          />
          <ProFormDatePicker
            name="expiresAt"
            label="到期时间"
            width="md"
            fieldProps={{ format: 'YYYY-MM-DD' }}
          />
          <ProFormTextArea
            name="description"
            label="描述"
            width="xl"
            placeholder="请输入线路描述"
            fieldProps={{ maxLength: 500, rows: 3, showCount: true }}
          />
          <ProFormTextArea
            name="purpose"
            label="用途"
            width="xl"
            placeholder="请输入线路用途"
            fieldProps={{ maxLength: 200, rows: 3, showCount: true }}
          />
        </ProForm.Group>
      </DrawerForm>
    </ListPage>
  );
};

export default AiCallLinesPage;

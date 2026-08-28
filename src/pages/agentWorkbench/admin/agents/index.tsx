import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Switch,
  Tag,
  Typography,
} from 'antd';
import * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { ListPage } from '@/components/ListLayout';
import TableActions from '@/components/TableActions';
import {
  type AdminAgentDto,
  type AgentPresenceDto,
  createAdminAgent,
  getAdminAgentStatus,
  listAdminAgents,
  releaseStaleAgent,
  type SceneCode,
  updateAdminAgent,
  updateAdminAgentSceneScopes,
} from '@/services/ruoyi/agent-console';
import { listUsers, type RuoyiUser } from '@/services/ruoyi/user';
import AgentName from '../../components/AgentName';
import {
  AdminMetricRow,
  formatDateTime,
  sceneLabels,
  sceneValueEnum,
  statusLabels,
  unwrapPage,
} from '../_shared';

const { Text } = Typography;

type AgentFormValues = {
  userId: string;
  agentIdentity: string;
  enabled: boolean;
  sceneCodes: SceneCode[];
};

const getRuntimeStatus = (row?: AdminAgentDto) =>
  row?.runtime_status || row?.presence?.status || 'offline';

const AgentAdminPage = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [form] = Form.useForm<AgentFormValues>();
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [editRecord, setEditRecord] = useState<AdminAgentDto>();
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailRecord, setDetailRecord] = useState<AdminAgentDto>();
  const [detailPresence, setDetailPresence] = useState<AgentPresenceDto>();
  const [userOptions, setUserOptions] = useState<
    { label: React.ReactNode; value: string }[]
  >([]);

  const loadUsers = async (keyword = '') => {
    const response = (await listUsers({
      userName: keyword || undefined,
      pageNum: 1,
      pageSize: 20,
    })) as unknown as { rows?: RuoyiUser[]; data?: { rows?: RuoyiUser[] } };
    const users = response.data?.rows || response.rows || [];
    setUserOptions(
      users.map((user) => ({
        value: String(user.userId),
        label: `${user.nickName || user.userName || '用户'}（${user.userName || user.userId}）`,
      })),
    );
  };

  const openCreate = () => {
    setEditRecord(undefined);
    form.resetFields();
    form.setFieldsValue({ enabled: false, sceneCodes: [] });
    setFormOpen(true);
    void loadUsers();
  };

  const openEdit = (record: AdminAgentDto) => {
    setEditRecord(record);
    form.setFieldsValue({
      userId: record.user_id,
      agentIdentity: record.agent_identity,
      enabled: record.enabled,
      sceneCodes: record.scene_codes,
    });
    setUserOptions([
      {
        value: record.user_id,
        label: <AgentName identity={record.agent_identity} />,
      },
    ]);
    setFormOpen(true);
  };

  const showDetail = async (record: AdminAgentDto) => {
    setDetailRecord(record);
    setDetailPresence(undefined);
    const response = (await getAdminAgentStatus(record.id)) as unknown;
    setDetailPresence(
      response && typeof response === 'object' && Reflect.get(response, 'data')
        ? (Reflect.get(response, 'data') as AgentPresenceDto)
        : (response as AgentPresenceDto),
    );
  };

  const columns = useMemo<ProColumns<AdminAgentDto>[]>(
    () => [
      {
        title: '用户姓名或账号',
        dataIndex: 'keyword',
        hideInTable: true,
      },
      {
        title: '启用状态',
        dataIndex: 'enabled',
        valueType: 'select',
        valueEnum: {
          true: { text: '已启用' },
          false: { text: '已停用' },
        },
        render: (_, row) => (
          <Tag color={row.enabled ? 'success' : 'default'}>
            {row.enabled ? '已启用' : '已停用'}
          </Tag>
        ),
      },
      {
        title: '运行状态',
        dataIndex: 'runtime_status',
        valueType: 'select',
        valueEnum: Object.fromEntries(
          Object.entries(statusLabels)
            .slice(0, 7)
            .map(([value, text]) => [value, { text }]),
        ),
        render: (_, row) =>
          statusLabels[getRuntimeStatus(row)] || getRuntimeStatus(row),
      },
      {
        title: '业务场景',
        dataIndex: 'scene_code',
        valueType: 'select',
        valueEnum: sceneValueEnum,
        hideInTable: true,
      },
      {
        title: '坐席',
        dataIndex: 'agent_identity',
        hideInSearch: true,
        render: (_, row) => (
          <div>
            <Text strong>
              <AgentName identity={row.agent_identity} />
            </Text>
            <div>
              <Text type="secondary">{row.agent_identity}</Text>
            </div>
          </div>
        ),
      },
      {
        title: '可接场景',
        dataIndex: 'scene_codes',
        hideInSearch: true,
        render: (_, row) =>
          row.scene_codes.map((scene) => (
            <Tag key={scene}>{sceneLabels[scene]}</Tag>
          )),
      },
      {
        title: '当前通话',
        dataIndex: ['presence', 'active_call_id'],
        hideInSearch: true,
        renderText: (value) => value || '-',
      },
      {
        title: '最近心跳',
        dataIndex: ['presence', 'last_seen_at'],
        hideInSearch: true,
        renderText: (value) => formatDateTime(value),
      },
      {
        title: '操作',
        valueType: 'option',
        fixed: 'right',
        width: 190,
        render: (_, row) => (
          <TableActions
            maxVisible={2}
            showLabels
            actions={[
              {
                key: 'detail',
                label: '查看状态',
                onClick: () => void showDetail(row),
              },
              { key: 'edit', label: '编辑坐席', onClick: () => openEdit(row) },
              ...(row.stale_occupied
                ? [
                    {
                      key: 'release',
                      label: '强制释放',
                      danger: true,
                      onClick: () =>
                        Modal.confirm({
                          title: '确认释放异常占用',
                          content: (
                            <>
                              仅在已确认没有活动 Room
                              或客户通话后执行。将释放坐席{' '}
                              <AgentName identity={row.agent_identity} />
                              的异常占用，并记录审计。
                            </>
                          ),
                          okText: '确认释放',
                          okType: 'danger',
                          cancelText: '取消',
                          onOk: async () => {
                            await releaseStaleAgent(
                              row.id,
                              crypto.randomUUID(),
                            );
                            actionRef.current?.reload();
                          },
                        }),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ],
    [],
  );

  return (
    <ListPage className="agent-admin-page" title="坐席管理">
      <AdminMetricRow
        items={[
          {
            key: 'enabled',
            label: '已启用',
            value: metrics.enabled ?? 0,
            tone: 'blue',
          },
          {
            key: 'online',
            label: '当前在线',
            value: metrics.online ?? 0,
            tone: 'green',
          },
          {
            key: 'available',
            label: '当前空闲',
            value: metrics.available ?? 0,
            tone: 'green',
          },
          {
            key: 'in_call',
            label: '通话中',
            value: metrics.in_call ?? 0,
            tone: 'purple',
          },
          {
            key: 'abnormal',
            label: '异常占用',
            value: metrics.stale_occupied ?? 0,
            tone: 'red',
          },
        ]}
      />
      <ProTable<AdminAgentDto>
        className="recov-stable-pagination-table"
        actionRef={actionRef}
        rowKey={(row) => String(row.id)}
        columns={columns}
        search={{ labelWidth: 104 }}
        scroll={{ x: 1100 }}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        request={async ({ current, pageSize, ...filters }) => {
          const page = unwrapPage<AdminAgentDto>(
            await listAdminAgents({ pageNum: current, pageSize, ...filters }),
          );
          setMetrics(page.metrics || {});
          return { data: page.rows, total: page.total, success: true };
        }}
        toolBarRender={() => [
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={() => actionRef.current?.reload()}
          >
            刷新
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
          >
            添加坐席
          </Button>,
        ]}
      />

      <Drawer
        title={editRecord ? '编辑坐席' : '添加坐席'}
        open={formOpen}
        size={520}
        destroyOnHidden
        onClose={() => setFormOpen(false)}
        extra={
          <Button type="primary" loading={saving} onClick={() => form.submit()}>
            保存
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            if (values.enabled && values.sceneCodes.length === 0) {
              form.setFields([
                {
                  name: 'sceneCodes',
                  errors: ['启用坐席至少选择一个业务场景'],
                },
              ]);
              return;
            }
            setSaving(true);
            try {
              let agentId = editRecord?.id;
              if (!editRecord) {
                const response = (await createAdminAgent({
                  userId: values.userId,
                  agentIdentity: values.agentIdentity,
                  enabled: false,
                })) as unknown as { data?: AdminAgentDto } & AdminAgentDto;
                agentId = response.data?.id || response.id;
              }
              if (!agentId) throw new Error('坐席创建结果缺少 ID');
              await updateAdminAgentSceneScopes(agentId, {
                sceneCodes: values.sceneCodes,
              });
              await updateAdminAgent(agentId, { enabled: values.enabled });
              setFormOpen(false);
              actionRef.current?.reload();
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item
            label="系统用户"
            name="userId"
            rules={[{ required: true, message: '请选择系统用户' }]}
          >
            <Select
              showSearch={{
                filterOption: false,
                onSearch: (value) => void loadUsers(value),
              }}
              disabled={Boolean(editRecord)}
              options={userOptions}
              placeholder="搜索现有用户姓名或账号"
            />
          </Form.Item>
          <Form.Item
            label="坐席标识"
            name="agentIdentity"
            rules={[{ required: true, message: '请输入稳定坐席标识' }]}
          >
            <Input disabled={Boolean(editRecord)} />
          </Form.Item>
          <Form.Item
            label="可接业务场景"
            name="sceneCodes"
            rules={[{ required: true, message: '请至少选择一个业务场景' }]}
          >
            <Select
              mode="multiple"
              options={Object.entries(sceneLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item label="启用状态" name="enabled" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title="坐席当前状态"
        open={Boolean(detailRecord)}
        size={520}
        onClose={() => setDetailRecord(undefined)}
      >
        <Descriptions
          column={1}
          items={[
            {
              key: 'agent',
              label: '坐席',
              children: <AgentName identity={detailRecord?.agent_identity} />,
            },
            {
              key: 'status',
              label: '运行状态',
              children:
                statusLabels[
                  detailPresence?.status ||
                    getRuntimeStatus(detailRecord as AdminAgentDto)
                ],
            },
            {
              key: 'call',
              label: '当前通话',
              children: detailPresence?.active_call_id || '-',
            },
            {
              key: 'handoff',
              label: '当前 handoff',
              children: detailPresence?.active_handoff_id || '-',
            },
            {
              key: 'session',
              label: '控制会话',
              children: detailPresence?.console_session_id || '-',
            },
            {
              key: 'heartbeat',
              label: '最近心跳',
              children: formatDateTime(detailPresence?.last_seen_at),
            },
          ]}
        />
      </Drawer>
    </ListPage>
  );
};

export default AgentAdminPage;

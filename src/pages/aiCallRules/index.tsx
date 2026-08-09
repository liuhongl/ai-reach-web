import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Select,
  Space,
  Switch,
  Tag,
  TimePicker,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import TableActions from '@/components/TableActions';
import {
  ListPage,
  ListStack,
  TableCard,
} from '@/components/ListLayout';
import {
  type AiCallRule,
  type AiCallRuleMetadata,
  type CallRuleFormValue,
  validateCallRule,
} from './domain';
import {
  createAiCallRule,
  deleteAiCallRule,
  getAiCallRuleMetadata,
  listAiCallRules,
  updateAiCallRule,
} from './service';

type RuleEditorValues = {
  ruleName: string;
  enabled: boolean;
  callWindows: Array<{ range: [Dayjs, Dayjs] }>;
  retryCount: number;
  retryIntervals: Array<{ minutes: number }>;
  retryableResults: string[];
};

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; rule: AiCallRule };

const toTime = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return dayjs().hour(hour).minute(minute).second(0).millisecond(0);
};

const defaultEditorValues = (): RuleEditorValues => ({
  ruleName: '',
  enabled: true,
  callWindows: [
    {
      range: [toTime('09:00'), toTime('18:00')],
    },
  ],
  retryCount: 1,
  retryIntervals: [{ minutes: 30 }],
  retryableResults: ['no_answer'],
});

const toEditorValues = (rule: AiCallRule): RuleEditorValues => ({
  ruleName: rule.ruleName,
  enabled: rule.enabled,
  callWindows: rule.callWindows.map((window) => ({
    range: [toTime(window.startTime), toTime(window.endTime)],
  })),
  retryCount: rule.retryCount,
  retryIntervals: rule.retryIntervalsMinutes.map((minutes) => ({ minutes })),
  retryableResults: rule.retryableResults,
});

const toRulePayload = (values: RuleEditorValues): CallRuleFormValue => ({
  ruleName: values.ruleName.trim(),
  enabled: values.enabled,
  callWindows: values.callWindows.map(({ range }) => ({
    startTime: range[0].format('HH:mm'),
    endTime: range[1].format('HH:mm'),
  })),
  retryCount: values.retryCount,
  retryIntervalsMinutes: values.retryIntervals.map(({ minutes }) => minutes),
  retryableResults: values.retryableResults,
});

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '操作失败，请稍后重试';

const formatCallWindows = (rule: AiCallRule) =>
  rule.callWindows
    .map((window) => `${window.startTime}–${window.endTime}`)
    .join('、');

const AiCallRulesPage = () => {
  const actionRef = useRef<ActionType>(null);
  const [form] = Form.useForm<RuleEditorValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [metadata, setMetadata] = useState<AiCallRuleMetadata>();
  const [metadataError, setMetadataError] = useState<string>();
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAiCallRuleMetadata()
      .then((value) => {
        setMetadata(value);
        setMetadataError(undefined);
      })
      .catch((error: unknown) => {
        setMetadataError(getErrorMessage(error));
      });
  }, []);

  const openCreateEditor = () => {
    form.setFieldsValue(defaultEditorValues());
    setEditor({ mode: 'create' });
  };

  const openEditEditor = (rule: AiCallRule) => {
    form.setFieldsValue(toEditorValues(rule));
    setEditor({ mode: 'edit', rule });
  };

  const closeEditor = () => {
    setEditor({ mode: 'closed' });
    form.resetFields();
  };

  const saveRule = async (values: RuleEditorValues) => {
    if (!metadata) {
      messageApi.error(metadataError || '呼叫规则元数据尚未加载完成');
      return;
    }

    const payload = toRulePayload(values);
    const errors = validateCallRule(payload, metadata);
    if (errors.length > 0) {
      messageApi.error(errors[0]);
      return;
    }

    setSaving(true);
    try {
      if (editor.mode === 'edit') {
        await updateAiCallRule(editor.rule.ruleId, payload);
      } else {
        await createAiCallRule(payload);
      }
      messageApi.success(editor.mode === 'edit' ? '规则已更新' : '规则已创建');
      closeEditor();
      await actionRef.current?.reload();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteRule = (rule: AiCallRule) => {
    modalApi.confirm({
      title: '删除呼叫规则',
      content: `确认删除呼叫规则“${rule.ruleName}”吗？删除后不能用于新任务，已创建任务仍按原规则执行。此操作不可恢复。`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      async onOk() {
        try {
          await deleteAiCallRule(rule.ruleId);
          messageApi.success('呼叫规则已删除');
          await actionRef.current?.reload();
        } catch (error) {
          messageApi.error(getErrorMessage(error));
          throw error;
        }
      },
    });
  };

  const resultLabelMap = useMemo(
    () =>
      new Map<string, string>(
        (metadata?.retryableResults || []).map((item) => [
          item.value,
          item.label,
        ]),
      ),
    [metadata],
  );

  const columns = useMemo<ProColumns<AiCallRule>[]>(
    () => [
      {
        title: '规则名称',
        dataIndex: 'ruleName',
        width: 180,
      },
      {
        title: '允许呼叫时段',
        key: 'callWindows',
        width: 260,
        search: false,
        render: (_value, rule) => formatCallWindows(rule),
      },
      {
        title: '重试规则',
        key: 'retry',
        width: 220,
        search: false,
        render: (_value, rule) => (
          <Space orientation="vertical" size={0}>
            <span>最多重试 {rule.retryCount} 次</span>
            <span className="text-gray-500">
              {rule.retryIntervalsMinutes.length > 0
                ? `间隔 ${rule.retryIntervalsMinutes.join('、')} 分钟`
                : '不重试'}
            </span>
          </Space>
        ),
      },
      {
        title: '可重试结果',
        key: 'retryableResults',
        width: 220,
        search: false,
        render: (_value, rule) =>
          rule.retryableResults.length > 0
            ? rule.retryableResults
                .map((item) => resultLabelMap.get(item) || item)
                .join('、')
            : '—',
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        width: 100,
        valueType: 'select',
        valueEnum: {
          true: { text: '启用' },
          false: { text: '停用' },
        },
        render: (_value, rule) => (
          <Tag color={rule.enabled ? 'success' : 'default'}>
            {rule.enabled ? '启用' : '停用'}
          </Tag>
        ),
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
        width: 104,
        fixed: 'right',
        search: false,
        render: (_value, rule) => (
          <TableActions
            maxVisible={2}
            actions={[
              {
                key: 'edit',
                label: '编辑',
                icon: <EditOutlined />,
                onClick: () => openEditEditor(rule),
              },
              {
                key: 'delete',
                label: '删除',
                danger: true,
                icon: <DeleteOutlined />,
                onClick: () => confirmDeleteRule(rule),
              },
            ]}
          />
        ),
      },
    ],
    [resultLabelMap],
  );

  return (
    <ListPage breadcrumbRender={false} title="呼叫规则">
      {messageContextHolder}
      {modalContextHolder}
      <ListStack>
        <h2 className="m-0 text-xl font-semibold">呼叫规则</h2>
        <TableCard className="recov-toolbar-card">
          <div className="flex w-full justify-end">
            <Space size={8} wrap>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => actionRef.current?.reload()}
              >
                刷新
              </Button>
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={openCreateEditor}
              >
                新建规则
              </Button>
            </Space>
          </div>
        </TableCard>

        <TableCard>
          <ProTable<AiCallRule>
            actionRef={actionRef}
            className="recov-stable-pagination-table"
            columns={columns}
            rowKey="ruleId"
            scroll={{ x: 1200 }}
            options={false}
            pagination={{
              defaultPageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            request={async (params) => {
              const result = await listAiCallRules({
                pageNum: params.current || 1,
                pageSize: params.pageSize || 20,
                ruleName: params.ruleName,
                enabled:
                  params.enabled === undefined
                    ? undefined
                    : params.enabled === true || params.enabled === 'true',
              });
              return {
                data: result.rows,
                total: result.total,
                success: true,
              };
            }}
            search={{ labelWidth: 'auto' }}
          />
        </TableCard>
      </ListStack>

      <Modal
        destroyOnHidden
        confirmLoading={saving}
        okText="保存"
        open={editor.mode !== 'closed'}
        title={editor.mode === 'edit' ? '编辑规则' : '新建规则'}
        width={720}
        onCancel={closeEditor}
        onOk={() => form.submit()}
      >
        <Form<RuleEditorValues>
          form={form}
          layout="vertical"
          onFinish={saveRule}
        >
          <Form.Item
            label="规则名称"
            name="ruleName"
            rules={[
              { required: true, whitespace: true, message: '请输入规则名称' },
            ]}
          >
            <Input maxLength={50} placeholder="请输入规则名称" />
          </Form.Item>

          <Form.Item label="启用状态" name="enabled" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>

          <Form.Item label="允许呼叫时段" required>
            <Form.List name="callWindows">
              {(fields, { add, remove }) => (
                <Space orientation="vertical" className="w-full" size={8}>
                  {fields.map((field) => (
                    <Space key={field.key} align="baseline">
                      <Form.Item
                        noStyle
                        name={[field.name, 'range']}
                        rules={[
                          {
                            required: true,
                            message: '请选择开始和结束时间',
                          },
                        ]}
                      >
                        <TimePicker.RangePicker
                          allowClear={false}
                          format="HH:mm"
                          minuteStep={5}
                        />
                      </Form.Item>
                      <Button
                        danger
                        disabled={fields.length === 1}
                        type="link"
                        onClick={() => remove(field.name)}
                      >
                        移除时段
                      </Button>
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() =>
                      add({
                        range: [toTime('09:00'), toTime('18:00')],
                      })
                    }
                  >
                    添加时段
                  </Button>
                </Space>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item
            label="重试次数"
            name="retryCount"
            rules={[{ required: true, message: '请输入重试次数' }]}
          >
            <InputNumber
              className="w-full"
              max={metadata?.maxRetryCount ?? 0}
              min={0}
              precision={0}
            />
          </Form.Item>
          <div className="mb-4 text-sm text-gray-500">
            最大重试次数：{metadata?.maxRetryCount ?? '—'} 次
          </div>

          <Form.Item label="各次重试间隔" required>
            <Form.List name="retryIntervals">
              {(fields, { add, remove }) => (
                <Space orientation="vertical" className="w-full" size={8}>
                  {fields.map((field, index) => (
                    <Space key={field.key} align="baseline">
                      <span>第 {index + 1} 次</span>
                      <Form.Item
                        noStyle
                        name={[field.name, 'minutes']}
                        rules={[
                          {
                            required: true,
                            message: '请输入重试间隔',
                          },
                        ]}
                      >
                        <InputNumber min={1} precision={0} />
                      </Form.Item>
                      <span>分钟</span>
                      <Button
                        danger
                        type="link"
                        onClick={() => remove(field.name)}
                      >
                        删除间隔
                      </Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ minutes: 30 })}>
                    添加间隔
                  </Button>
                </Space>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item
            label="可重试结果"
            name="retryableResults"
            rules={[{ required: true, message: '请选择可重试结果' }]}
          >
            <Select
              mode="multiple"
              options={metadata?.retryableResults || []}
              placeholder="请选择可重试结果"
            />
          </Form.Item>
        </Form>
      </Modal>
    </ListPage>
  );
};

export default AiCallRulesPage;

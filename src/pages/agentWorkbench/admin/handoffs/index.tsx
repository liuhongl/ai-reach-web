import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Modal,
  Space,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { ListPage } from '@/components/ListLayout';
import AgentName from '@/pages/agentWorkbench/components/AgentName';
import {
  type AiCallRecording,
  getAiCallRecordRecording,
} from '@/pages/aiCallRecords/service';
import {
  getAdminHandoff,
  type HandoffDto,
  listAdminHandoffs,
  reconcileAdminHandoff,
} from '@/services/ruoyi/agent-console';
import {
  AdminMetricRow,
  formatDateTime,
  getDialogueSpeakerLabel,
  getHandoffCustomerIdentity,
  getHandoffReasonLabel,
  getRecordingStatusLabel,
  type HandoffAdminDetail,
  normalizeHandoffDetail,
  normalizeHandoffMetrics,
  sceneLabels,
  sceneValueEnum,
  statusColors,
  statusLabels,
  unwrapPage,
} from '../_shared';

const { Paragraph, Text, Title } = Typography;

const detailDescriptionStyles = {
  label: { color: '#1f1f1f' },
};

const classificationLabels: Record<string, string> = {
  interested: '有意向',
  nurturing: '持续跟进',
  low_value: '低价值',
  converted: '已转化',
};

const terminalHandoffStatuses = new Set([
  'completed',
  'expired',
  'canceled',
  'failed',
]);

const waitSeconds = (row: HandoffDto) => {
  const end = row.connected_at || row.ended_at || new Date().toISOString();
  return Math.max(
    0,
    Math.round(
      (new Date(end).getTime() - new Date(row.requested_at).getTime()) / 1000,
    ),
  );
};

const createIdempotencyKey = () => {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === 'function')
    return randomUuid.call(globalThis.crypto);
  // ponytail: HTTP fallback only; HTTPS restores Web Crypto UUIDs.
  return `handoff-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const HandoffAdminPage = () => {
  const { message } = App.useApp();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [detail, setDetail] = useState<HandoffAdminDetail>();
  const [recording, setRecording] = useState<AiCallRecording | null>();

  const columns = useMemo<ProColumns<HandoffDto>[]>(
    () => [
      {
        title: '时间范围',
        key: 'requested_at_filter',
        dataIndex: 'requested_at_range',
        valueType: 'dateTimeRange',
        hideInTable: true,
      },
      {
        title: '业务场景',
        key: 'scene_code_filter',
        dataIndex: 'scene_code',
        valueType: 'select',
        valueEnum: sceneValueEnum,
        hideInTable: true,
      },
      {
        title: '转人工状态',
        key: 'status_filter',
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: Object.fromEntries(
          [
            'requested',
            'accepted',
            'connected',
            'completed',
            'expired',
            'canceled',
            'failed',
          ].map((value) => [value, { text: statusLabels[value] }]),
        ),
        hideInTable: true,
      },
      {
        title: '客户姓名',
        key: 'customer_name_filter',
        dataIndex: 'customer_name',
        hideInTable: true,
      },
      {
        title: '客户标识',
        key: 'customer_identity',
        dataIndex: 'masked_customer_name',
        search: false,
        render: (_, row) => {
          const customer = getHandoffCustomerIdentity(row);
          return (
            <div>
              <Text strong>{customer.primary}</Text>
              <div>
                <Text type="secondary">{customer.secondary}</Text>
              </div>
            </div>
          );
        },
      },
      {
        title: '业务场景',
        key: 'scene_code_display',
        dataIndex: 'scene_code',
        search: false,
        renderText: (value) => sceneLabels[value] || value,
      },
      {
        title: '转人工原因',
        key: 'request_reason_display',
        dataIndex: 'request_reason',
        search: false,
        ellipsis: true,
        renderText: (value) => getHandoffReasonLabel(value),
      },
      {
        title: '等待时长',
        key: 'wait_seconds',
        search: false,
        render: (_, row) => `${waitSeconds(row)} 秒`,
      },
      {
        title: '接听坐席',
        key: 'human_agent_identity_display',
        dataIndex: 'human_agent_identity',
        search: false,
        render: (_, row) => <AgentName identity={row.human_agent_identity} />,
      },
      {
        title: '最终结果',
        key: 'status_display',
        dataIndex: 'status',
        search: false,
        render: (_, row) => (
          <Tag color={statusColors[row.status]}>
            {statusLabels[row.status] || '未知状态'}
          </Tag>
        ),
      },
      {
        title: '请求时间',
        key: 'requested_at_display',
        dataIndex: 'requested_at',
        search: false,
        renderText: (value) => formatDateTime(value),
      },
      {
        title: '操作',
        valueType: 'option',
        fixed: 'right',
        width: 168,
        render: (_, row) => (
          <Space size={0}>
            <Button
              type="link"
              size="small"
              onClick={async () => {
                setRecording(undefined);
                const [detailResult, recordingResult] =
                  await Promise.allSettled([
                    getAdminHandoff(row.handoff_id),
                    getAiCallRecordRecording(row.call_id),
                  ]);
                if (detailResult.status === 'fulfilled') {
                  setDetail(normalizeHandoffDetail(detailResult.value));
                }
                setRecording(
                  recordingResult.status === 'fulfilled'
                    ? recordingResult.value
                    : null,
                );
              }}
            >
              查看详情
            </Button>
            {row.failure_stage && !terminalHandoffStatuses.has(row.status) ? (
              <Button
                danger
                type="link"
                size="small"
                onClick={() =>
                  Modal.confirm({
                    title: '确认重新核对状态',
                    content:
                      '系统会重新核对该异常转人工记录的状态，不会重新外呼或修改正常通话结果。',
                    okText: '重新核对',
                    cancelText: '取消',
                    onOk: async () => {
                      const result = await reconcileAdminHandoff(
                        row.handoff_id,
                        createIdempotencyKey(),
                      );
                      const nextHandoff =
                        normalizeHandoffDetail(result).handoff;
                      message.success(
                        nextHandoff.status === row.status
                          ? '核对完成，当前状态无需调整'
                          : `核对完成，状态已更新为“${
                              statusLabels[nextHandoff.status] ||
                              nextHandoff.status
                            }”`,
                      );
                      actionRef.current?.reload();
                    },
                  })
                }
              >
                重新核对状态
              </Button>
            ) : null}
          </Space>
        ),
      },
    ],
    [message],
  );

  const detailHandoff = detail?.handoff;
  const detailRecord = detail?.record;
  const recentDialogue = detailHandoff?.recent_dialogue || [];
  const detailCustomer = detailHandoff
    ? getHandoffCustomerIdentity({
        ...detailHandoff,
        masked_contact:
          (detailRecord?.masked_contact as string | undefined) ||
          detailHandoff.masked_contact,
        business_id:
          (detailRecord?.business_id as string | undefined) ||
          detailHandoff.business_id,
      })
    : undefined;
  const timelineItems = detailHandoff
    ? [
        { label: '请求转人工', value: detailHandoff.requested_at },
        { label: '坐席认领', value: detailHandoff.accepted_at },
        { label: '人工媒体接通', value: detailHandoff.connected_at },
        { label: '通话结束', value: detailHandoff.ended_at },
      ].filter((item) => item.value)
    : [];
  const normalizedMetrics = normalizeHandoffMetrics(metrics);
  const recordingUrl =
    recording?.playUrl ||
    recording?.tracks?.find((track) => track.playUrl)?.playUrl;
  const afterCallWork = detail?.afterCallWork;
  const afterCallClassification = afterCallWork?.classification || '';
  const afterCallNeedsFollowUp = afterCallWork?.needs_follow_up === true;
  const afterCallNextFollowUpAt = afterCallWork?.next_follow_up_at;
  const followUp = detail?.followUp;
  const followUpStatus = followUp?.status || '';

  return (
    <ListPage className="agent-admin-page" title="转人工记录">
      <AdminMetricRow
        items={[
          {
            key: 'requests',
            label: '请求数',
            value: normalizedMetrics.requests,
            tone: 'blue',
          },
          {
            key: 'connect_rate',
            label: '60 秒内接通率',
            value: `${normalizedMetrics.connectRate}%`,
            tone: 'green',
          },
          {
            key: 'avg_wait',
            label: '平均等待时间',
            value: `${normalizedMetrics.averageWaitSeconds} 秒`,
            tone: 'orange',
          },
          {
            key: 'expired',
            label: '等待超时数',
            value: normalizedMetrics.timeoutCount,
            tone: 'red',
          },
          {
            key: 'media_failed',
            label: '媒体接入失败数',
            value: normalizedMetrics.mediaFailureCount,
            tone: 'red',
          },
        ]}
      />
      <ProTable<HandoffDto>
        className="recov-stable-pagination-table"
        actionRef={actionRef}
        rowKey={(row) => String(row.handoff_id)}
        columns={columns}
        search={{ labelWidth: 112, defaultCollapsed: false }}
        scroll={{ x: 1280 }}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        beforeSearchSubmit={(values) => {
          const requestedAtRange =
            values.requested_at_filter ?? values.requested_at_range;
          const sceneCode = values.scene_code_filter ?? values.scene_code;
          const status = values.status_filter ?? values.status;
          const customerName =
            values.customer_name_filter ?? values.customer_name;

          return {
            ...(sceneCode ? { sceneCode } : {}),
            ...(status ? { status } : {}),
            ...(customerName ? { customerName } : {}),
            ...(Array.isArray(requestedAtRange) && requestedAtRange[0]
              ? {
                  requestedAtBegin: new Date(requestedAtRange[0]).toISOString(),
                }
              : {}),
            ...(Array.isArray(requestedAtRange) && requestedAtRange[1]
              ? { requestedAtEnd: new Date(requestedAtRange[1]).toISOString() }
              : {}),
          };
        }}
        request={async (params) => {
          const { current, pageSize } = params;
          const filters = params as typeof params & {
            sceneCode?: string;
            status?: string;
            customerName?: string;
            requestedAtBegin?: string;
            requestedAtEnd?: string;
          };
          const page = unwrapPage<HandoffDto>(
            await listAdminHandoffs({
              pageNum: current,
              pageSize,
              ...(filters.sceneCode ? { sceneCode: filters.sceneCode } : {}),
              ...(filters.status ? { status: filters.status } : {}),
              ...(filters.customerName
                ? { customerName: filters.customerName }
                : {}),
              ...(filters.requestedAtBegin
                ? { requestedAtBegin: filters.requestedAtBegin }
                : {}),
              ...(filters.requestedAtEnd
                ? { requestedAtEnd: filters.requestedAtEnd }
                : {}),
            }),
          );
          setMetrics(page.metrics || {});
          return { data: page.rows, total: page.total, success: true };
        }}
      />

      <Drawer
        title="转人工记录详情"
        open={Boolean(detail)}
        size={720}
        onClose={() => {
          setDetail(undefined);
          setRecording(undefined);
        }}
      >
        {detailHandoff ? (
          <div className="agent-admin-detail">
            <section className="agent-admin-detail-section">
              <Title level={5}>基本信息</Title>
              <Descriptions
                column={2}
                styles={detailDescriptionStyles}
                items={[
                  {
                    key: 'call',
                    label: '通话编号',
                    children: detailHandoff.call_id,
                  },
                  {
                    key: 'customer',
                    label: '客户标识',
                    children: detailCustomer
                      ? `${detailCustomer.primary} · ${detailCustomer.secondary}`
                      : '-',
                  },
                  {
                    key: 'scene',
                    label: '业务场景',
                    children:
                      sceneLabels[detailHandoff.scene_code] ||
                      detailHandoff.scene_code,
                  },
                  {
                    key: 'reason',
                    label: '转人工原因',
                    children: getHandoffReasonLabel(
                      detailHandoff.request_reason,
                    ),
                  },
                  {
                    key: 'agent',
                    label: '接听坐席',
                    children: (
                      <AgentName
                        identity={detailHandoff.human_agent_identity}
                        emptyText="未接听"
                      />
                    ),
                  },
                  {
                    key: 'status',
                    label: '最终结果',
                    children: (
                      <Tag color={statusColors[detailHandoff.status]}>
                        {statusLabels[detailHandoff.status] || '未知状态'}
                      </Tag>
                    ),
                  },
                ]}
              />
            </section>
            <section className="agent-admin-detail-section">
              <Title level={5}>状态时间线</Title>
              <Timeline
                items={timelineItems.map((item) => ({
                  children: `${item.label} · ${formatDateTime(item.value)}`,
                }))}
              />
            </section>
            <section className="agent-admin-detail-section">
              <Title level={5}>AI 交接摘要与待处理事项</Title>
              <Paragraph>
                {detailHandoff.handoff_summary ||
                  detailHandoff.request_message ||
                  '摘要未生成'}
              </Paragraph>
              <ul>
                {(detailHandoff.pending_items || []).map((item) => (
                  <li key={item.text}>{item.text}</li>
                ))}
              </ul>
            </section>
            <section className="agent-admin-detail-section">
              <Title level={5}>转接前对话摘录</Title>
              {recentDialogue.length ? (
                <div
                  className="ai-call-dialogue-region"
                  style={{
                    maxHeight: 360,
                    overflowY: 'auto',
                    padding: 12,
                    border: '1px solid #eef0f4',
                    borderRadius: 10,
                    background: '#f8f9fb',
                  }}
                >
                  {recentDialogue.map((item, index) => (
                    <div
                      className={`ai-call-dialogue-row ai-call-dialogue-row--${
                        item.speaker_type === 'customer' ? 'right' : 'left'
                      }`}
                      key={item.id || `${item.speaker_type}-${index}`}
                      style={{
                        display: 'flex',
                        justifyContent:
                          item.speaker_type === 'customer'
                            ? 'flex-end'
                            : 'flex-start',
                        marginBottom:
                          index === recentDialogue.length - 1 ? 0 : 12,
                      }}
                    >
                      <div
                        className={`ai-call-dialogue-bubble ai-call-dialogue-bubble--${
                          item.speaker_type === 'customer' ? 'customer' : 'ai'
                        }`}
                        style={{
                          maxWidth: '82%',
                          padding: '10px 12px',
                          border: `1px solid ${
                            item.speaker_type === 'customer'
                              ? '#dfd4fa'
                              : '#e6ebf2'
                          }`,
                          borderRadius:
                            item.speaker_type === 'customer'
                              ? '10px 10px 2px 10px'
                              : '10px 10px 10px 2px',
                          background:
                            item.speaker_type === 'customer'
                              ? '#f1edfb'
                              : '#f1f5fb',
                          lineHeight: 1.6,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        <Text strong>
                          {getDialogueSpeakerLabel(item.speaker_type)}：
                        </Text>
                        <Text>{item.text}</Text>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary">本次转人工未保存转接前对话</Text>
              )}
            </section>
            <section className="agent-admin-detail-section">
              <Title level={5}>通话录音</Title>
              <div data-testid="handoff-recording-player">
                {recordingUrl ? (
                  // biome-ignore lint/a11y/useMediaCaption: 同一详情中已展示完整转接前对话，录音暂无独立字幕轨道。
                  <audio
                    controls
                    controlsList="nodownload"
                    preload="metadata"
                    src={recordingUrl}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      getRecordingStatusLabel(
                        detailRecord?.recording_status as string | undefined,
                      ) === '录音已生成'
                        ? '暂无可播放录音'
                        : getRecordingStatusLabel(
                            detailRecord?.recording_status as
                              | string
                              | undefined,
                          )
                    }
                  />
                )}
              </div>
            </section>
            <section className="agent-admin-detail-section">
              <Title level={5}>快速话后结果</Title>
              {afterCallWork ? (
                <Descriptions
                  column={2}
                  styles={detailDescriptionStyles}
                  items={[
                    {
                      key: 'classification',
                      label: '客户分类',
                      children: afterCallClassification ? (
                        <Tag>
                          {classificationLabels[afterCallClassification] ||
                            afterCallClassification}
                        </Tag>
                      ) : (
                        '-'
                      ),
                    },
                    {
                      key: 'schedule',
                      label: '后续安排',
                      children: afterCallNeedsFollowUp
                        ? afterCallNextFollowUpAt
                          ? formatDateTime(afterCallNextFollowUpAt)
                          : '需要跟进，暂未约定时间'
                        : '暂不安排回访',
                    },
                    {
                      key: 'summary',
                      label: '沟通结论',
                      children: afterCallWork.summary || '-',
                      span: 2,
                    },
                    {
                      key: 'agent',
                      label: '提交坐席',
                      children: (
                        <AgentName identity={afterCallWork.agent_identity} />
                      ),
                    },
                    {
                      key: 'submittedAt',
                      label: '提交时间',
                      children: formatDateTime(afterCallWork.submitted_at),
                    },
                  ]}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="尚未提交话后结果"
                />
              )}
            </section>
            <section className="agent-admin-detail-section">
              <Title level={5}>关联跟进任务</Title>
              {followUp ? (
                <Descriptions
                  column={2}
                  styles={detailDescriptionStyles}
                  items={[
                    {
                      key: 'id',
                      label: '任务编号',
                      children: followUp.id || '-',
                    },
                    {
                      key: 'status',
                      label: '任务状态',
                      children: (
                        <Tag color={statusColors[followUpStatus]}>
                          {statusLabels[followUpStatus] ||
                            followUpStatus ||
                            '-'}
                        </Tag>
                      ),
                    },
                    {
                      key: 'reason',
                      label: '跟进原因',
                      children: followUp.follow_up_reason || '-',
                      span: 2,
                    },
                    {
                      key: 'owner',
                      label: '负责坐席',
                      children: (
                        <AgentName
                          identity={followUp.owner_agent_identity}
                          emptyText="待认领"
                        />
                      ),
                    },
                    {
                      key: 'callbackAt',
                      label: '应回访时间',
                      children: formatDateTime(followUp.customer_callback_at),
                    },
                  ]}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="未创建关联跟进任务"
                />
              )}
            </section>
          </div>
        ) : null}
      </Drawer>
    </ListPage>
  );
};

export default HandoffAdminPage;

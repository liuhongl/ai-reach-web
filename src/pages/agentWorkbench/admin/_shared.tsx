import { ProCard } from '@ant-design/pro-components';
import { Typography } from 'antd';
import dayjs from 'dayjs';
import * as React from 'react';
import type {
  AfterCallWorkDto,
  FollowUpTaskDto,
  HandoffDto,
  PageResult,
} from '@/services/ruoyi/agent-console';
import './admin.css';

const { Text } = Typography;

export const sceneLabels: Record<string, string> = {
  intro_contract: '合同审核',
  intro_document: '跨境文书',
  intro_overseas: '海外获客',
  intro_geo: 'GEO',
};

export const sceneValueEnum = Object.fromEntries(
  Object.entries(sceneLabels).map(([value, text]) => [value, { text }]),
);

export const statusLabels: Record<string, string> = {
  offline: '离线',
  available: '空闲',
  claiming: '认领中',
  in_call: '通话中',
  reconnecting: '重连中',
  wrap_up_quick: '话后处理中',
  paused: '暂停',
  requested: '待接听',
  accepted: '已认领',
  connected: '已接通',
  completed: '已完成',
  expired: '等待超时',
  canceled: '已取消',
  failed: '失败',
  pending: '待处理',
  processing: '已认领待处理',
  closed: '已关闭',
};

export const statusColors: Record<string, string> = {
  offline: 'default',
  available: 'success',
  claiming: 'processing',
  in_call: 'blue',
  reconnecting: 'warning',
  wrap_up_quick: 'purple',
  paused: 'orange',
  requested: 'blue',
  accepted: 'cyan',
  connected: 'processing',
  completed: 'success',
  expired: 'orange',
  canceled: 'default',
  failed: 'error',
  pending: 'gold',
  processing: 'blue',
  closed: 'default',
};

const handoffReasonLabels: Record<string, string> = {
  customer_request: '客户要求转人工',
  customer_requested_human: '客户要求转人工',
  customer_requested_handoff: '客户要求转人工',
  business_escalation: '业务升级转人工',
  ai_escalation: 'AI 判断需要人工处理',
  manual_request: '人工发起转接',
};

export const getHandoffReasonLabel = (value?: string | null) =>
  (value && handoffReasonLabels[value]) || '其他原因';

const dialogueSpeakerLabels: Record<string, string> = {
  ai: 'AI',
  customer: '客户',
  human_agent: '人工坐席',
};

export const getDialogueSpeakerLabel = (value?: string | null) =>
  (value && dialogueSpeakerLabels[value]) || '未知说话方';

const afterCallWorkLabels: Record<string, string> = {
  follow_up_required: '需要后续跟进',
  resolved: '已解决',
  customer_refused: '客户拒绝',
  invalid_contact: '联系方式无效',
  other: '其他',
};

export const getAfterCallWorkLabel = (value?: string | null) =>
  (value && afterCallWorkLabels[value]) || '尚未提交';

const recordingStatusLabels: Record<string, string> = {
  starting: '录音启动中',
  recording: '录音中',
  stopping: '录音处理中',
  verifying: '录音生成校验中',
  completed: '录音已生成',
  failed: '录音生成失败',
  not_generated: '未生成录音',
};

export const getRecordingStatusLabel = (value?: string | null) =>
  value ? recordingStatusLabels[value] || '录音状态未知' : '未生成录音';

export const getHandoffCustomerIdentity = (row: {
  masked_customer_name?: string | null;
  masked_contact?: string | null;
  business_id?: string | null;
  call_id: string;
}) => {
  if (row.masked_customer_name) {
    return {
      primary: row.masked_customer_name,
      secondary: row.masked_contact || '联系方式未提供',
    };
  }
  if (row.masked_contact) {
    return {
      primary: row.masked_contact,
      secondary: '客户姓名未提供',
    };
  }
  return {
    primary: '客户信息未提供',
    secondary: '-',
  };
};

export type HandoffAdminDetail = {
  handoff: HandoffDto;
  record?: Record<string, unknown> | null;
  afterCallWork?: AfterCallWorkDto | null;
  followUp?: FollowUpTaskDto | null;
};

export const normalizeHandoffDetail = (
  response: unknown,
): HandoffAdminDetail => {
  const data =
    response &&
    typeof response === 'object' &&
    Reflect.get(response, 'data') !== undefined
      ? Reflect.get(response, 'data')
      : response;
  if (data && typeof data === 'object' && Reflect.get(data, 'handoff')) {
    return {
      handoff: Reflect.get(data, 'handoff') as HandoffDto,
      record: Reflect.get(data, 'record') as
        | Record<string, unknown>
        | null
        | undefined,
      afterCallWork: Reflect.get(data, 'after_call_work') as
        | AfterCallWorkDto
        | null
        | undefined,
      followUp: Reflect.get(data, 'follow_up') as
        | FollowUpTaskDto
        | null
        | undefined,
    };
  }
  return { handoff: data as HandoffDto };
};

export const normalizeHandoffMetrics = (
  metrics: Record<string, number> = {},
) => {
  const rate =
    metrics.connected_rate_within_60_seconds ?? metrics.connect_rate ?? 0;
  return {
    requests: metrics.request_count ?? metrics.requests ?? 0,
    connectRate: Math.round((rate <= 1 ? rate * 100 : rate) * 100) / 100,
    averageWaitSeconds:
      metrics.average_wait_seconds ?? metrics.avg_wait_seconds ?? 0,
    timeoutCount: metrics.timeout_count ?? metrics.expired ?? 0,
    mediaFailureCount: metrics.media_failure_count ?? metrics.media_failed ?? 0,
  };
};

export const formatDateTime = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';

export const unwrapPage = <T,>(response: unknown): PageResult<T> => {
  if (!response || typeof response !== 'object') return { rows: [], total: 0 };
  const data = Reflect.get(response, 'data');
  const page = data && typeof data === 'object' ? data : response;
  const rows = Reflect.get(page, 'rows');
  const total = Reflect.get(page, 'total');
  const metrics = Reflect.get(page, 'metrics');
  return {
    rows: Array.isArray(rows) ? rows : [],
    total:
      typeof total === 'number' ? total : Array.isArray(rows) ? rows.length : 0,
    metrics: metrics && typeof metrics === 'object' ? metrics : undefined,
  };
};

export type MetricItem = {
  key: string;
  label: string;
  value: string | number;
  tone: 'blue' | 'green' | 'orange' | 'red' | 'purple';
};

export const AdminMetricRow = ({ items }: { items: MetricItem[] }) => (
  <div className="agent-admin-metrics">
    {items.map((item) => (
      <ProCard
        key={item.key}
        size="small"
        className={`agent-admin-metric-card agent-admin-metric-card--${item.tone}`}
      >
        <div>
          <Text type="secondary">{item.label}</Text>
          <div className="agent-admin-metric-value">{item.value}</div>
        </div>
      </ProCard>
    ))}
  </div>
);

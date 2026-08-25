import { type ProColumns, ProTable } from '@ant-design/pro-components';
import { useSearchParams } from '@umijs/max';
import { Button, Tag } from 'antd';
import dayjs from 'dayjs';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListPage } from '@/components/ListLayout';
import AgentName from '@/pages/agentWorkbench/components/AgentName';
import { listAiCallTasks } from '@/pages/aiCallTasks/service';
import {
  type FollowUpTaskDto,
  getAdminFollowUp,
  listAdminFollowUps,
} from '@/services/ruoyi/agent-console';
import FollowUpTaskDetailDrawer from '../../components/FollowUpTaskDetailDrawer';
import {
  AdminMetricRow,
  formatDateTime,
  sceneLabels,
  sceneValueEnum,
  statusColors,
  unwrapPage,
} from '../_shared';

const sourceLabels: Record<string, string> = {
  after_call_work: '接通后跟进',
  handoff_unanswered: '人工未接回访',
  ai_post_call: 'AI 话后跟进',
};

const followUpStatusLabels: Record<FollowUpTaskDto['status'], string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已办结',
  closed: '已终止',
};

const attemptResultLabels: Record<string, string> = {
  connected: '已接通',
  no_answer: '无人接听',
  busy: '占线',
  rejected: '客户拒接',
  invalid_contact: '无效联系方式',
  technical_failure: '技术失败',
};

const loadTaskOptions = async () => {
  const page = await listAiCallTasks({ pageNum: 1, pageSize: 200 });
  return page.rows.map((task) => ({
    label: task.taskName,
    value: task.taskId,
  }));
};

const normalizeDetail = (response: unknown): FollowUpTaskDto => {
  const data =
    response &&
    typeof response === 'object' &&
    Reflect.get(response, 'data') !== undefined
      ? Reflect.get(response, 'data')
      : response;
  if (data && typeof data === 'object' && Reflect.get(data, 'task')) {
    const task = Reflect.get(data, 'task') as FollowUpTaskDto;
    return {
      ...task,
      attempts: (Reflect.get(data, 'attempts') ||
        task.attempts ||
        []) as FollowUpTaskDto['attempts'],
      callback_records: (Reflect.get(data, 'callback_records') ||
        task.callback_records ||
        []) as FollowUpTaskDto['callback_records'],
    };
  }
  return data as FollowUpTaskDto;
};

export const FollowUpOverviewPage = () => {
  const [searchParams] = useSearchParams();
  const deepLinkFollowUpId = searchParams.get('followUpId')?.trim() || '';
  const presetStatus = searchParams.get('status')?.trim() || '';
  const presetFormalOutboundOnly =
    searchParams.get('formalOutboundOnly') === 'true';
  const presetSourceStartedAtBegin =
    searchParams.get('sourceStartedAtBegin')?.trim() || '';
  const presetSourceStartedAtEnd =
    searchParams.get('sourceStartedAtEnd')?.trim() || '';
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [detail, setDetail] = useState<FollowUpTaskDto>();
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>();
  const detailRequestIdRef = useRef(0);

  const openDetail = useCallback(async (followUpId: string) => {
    const requestId = ++detailRequestIdRef.current;
    setSelectedFollowUpId(followUpId);
    setDetail(undefined);
    setDetailError(undefined);
    setDetailLoading(true);
    try {
      const nextDetail = normalizeDetail(await getAdminFollowUp(followUpId));
      if (requestId === detailRequestIdRef.current) {
        setDetail(nextDetail);
      }
    } catch {
      if (requestId === detailRequestIdRef.current) {
        setDetailError('跟进任务详情加载失败，请确认任务是否存在或重试');
      }
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setDetailLoading(false);
      }
    }
  }, []);

  useEffect(
    () => () => {
      detailRequestIdRef.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (deepLinkFollowUpId) {
      void openDetail(deepLinkFollowUpId);
    }
  }, [deepLinkFollowUpId, openDetail]);

  const columns = useMemo<ProColumns<FollowUpTaskDto>[]>(
    () => [
      {
        title: '来源类型',
        dataIndex: 'source_type',
        valueType: 'select',
        valueEnum: Object.fromEntries(
          Object.entries(sourceLabels).map(([value, text]) => [
            value,
            { text },
          ]),
        ),
        renderText: (value) => sourceLabels[value] || value,
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
        title: '所属任务',
        dataIndex: 'task_id',
        valueType: 'select',
        hideInTable: true,
        request: loadTaskOptions,
        fieldProps: { showSearch: true, optionFilterProp: 'label' },
      },
      {
        title: '任务状态',
        dataIndex: 'status',
        initialValue: presetStatus || undefined,
        valueType: 'select',
        valueEnum: Object.fromEntries(
          ['pending', 'processing', 'completed', 'closed'].map((value) => [
            value,
            { text: followUpStatusLabels[value as FollowUpTaskDto['status']] },
          ]),
        ),
        render: (_, row) => (
          <Tag color={statusColors[row.status]}>
            {followUpStatusLabels[row.status]}
          </Tag>
        ),
      },
      {
        title: '脱敏客户',
        dataIndex: 'masked_contact',
        hideInSearch: true,
        search: false,
        renderText: (value) => value || '联系方式已脱敏',
      },
      {
        title: '业务场景',
        dataIndex: 'scene_code',
        hideInSearch: true,
        search: false,
        renderText: (value) => sceneLabels[value] || value,
      },
      {
        title: '跟进原因',
        dataIndex: 'follow_up_reason',
        hideInSearch: true,
        search: false,
        ellipsis: true,
      },
      {
        title: '负责人',
        dataIndex: 'owner_agent_identity',
        hideInSearch: true,
        search: false,
        render: (_, row) => (
          <AgentName identity={row.owner_agent_identity} emptyText="待认领" />
        ),
      },
      {
        title: '客户预约时间',
        dataIndex: 'customer_callback_at',
        hideInSearch: true,
        search: false,
        renderText: (value) => (value ? formatDateTime(value) : '未约定'),
      },
      {
        title: '最近联系结果',
        key: 'latest_attempt',
        hideInSearch: true,
        search: false,
        render: (_, row) => {
          const latest = row.latest_attempt || row.attempts?.at(-1);
          return latest
            ? `${attemptResultLabels[latest.attempt_result] || '其他结果'} · ${formatDateTime(latest.contacted_at)}`
            : '-';
        },
      },
      {
        title: '操作',
        valueType: 'option',
        hideInSearch: true,
        search: false,
        fixed: 'right',
        width: 100,
        render: (_, row) => (
          <Button
            type="link"
            size="small"
            onClick={() => void openDetail(row.id)}
          >
            查看详情
          </Button>
        ),
      },
    ],
    [
      openDetail,
      presetSourceStartedAtBegin,
      presetSourceStartedAtEnd,
      presetStatus,
    ],
  );

  return (
    <ListPage className="agent-admin-page" title="跟进总览">
      <AdminMetricRow
        items={[
          {
            key: 'pending',
            label: '待处理',
            value: metrics.pending ?? 0,
            tone: 'blue',
          },
          {
            key: 'unanswered',
            label: '人工未接回访',
            value: metrics.handoff_unanswered ?? metrics.unanswered ?? 0,
            tone: 'orange',
          },
          {
            key: 'completed',
            label: '已办结',
            value: metrics.completed ?? 0,
            tone: 'green',
          },
          {
            key: 'closed',
            label: '已终止',
            value: metrics.closed ?? 0,
            tone: 'blue',
          },
        ]}
      />
      <ProTable<FollowUpTaskDto>
        className="recov-stable-pagination-table"
        rowKey={(row) => String(row.id)}
        columns={columns}
        search={{ labelWidth: 112, defaultCollapsed: false }}
        scroll={{ x: 1300 }}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        request={async ({
          current,
          pageSize,
          source_started_at_range,
          source_type,
          scene_code,
          task_id,
          status: selectedStatus,
          ...filters
        }) => {
          const sourceRange = Array.isArray(source_started_at_range)
            ? source_started_at_range
            : undefined;
          const status = (selectedStatus as string | undefined) || presetStatus;
          const sourceStartedAtBegin = sourceRange?.[0]
            ? dayjs(sourceRange[0]).toISOString()
            : presetSourceStartedAtBegin;
          const sourceStartedAtEnd = sourceRange?.[1]
            ? dayjs(sourceRange[1]).toISOString()
            : presetSourceStartedAtEnd;
          const page = unwrapPage<FollowUpTaskDto>(
            await listAdminFollowUps({
              pageNum: current,
              pageSize,
              ...filters,
              ...(source_type ? { sourceType: source_type } : {}),
              ...(scene_code ? { sceneCode: scene_code } : {}),
              ...(task_id ? { taskId: task_id } : {}),
              ...(status ? { status } : {}),
              ...(presetFormalOutboundOnly ? { formalOutboundOnly: true } : {}),
              ...(sourceStartedAtBegin ? { sourceStartedAtBegin } : {}),
              ...(sourceStartedAtEnd ? { sourceStartedAtEnd } : {}),
            }),
          );
          setMetrics(page.metrics || {});
          return {
            data: page.rows,
            total: page.total,
            success: true,
          };
        }}
      />

      <FollowUpTaskDetailDrawer
        error={detailError}
        loading={detailLoading}
        open={Boolean(selectedFollowUpId)}
        task={detail}
        onClose={() => {
          setSelectedFollowUpId(undefined);
          setDetail(undefined);
          setDetailError(undefined);
        }}
      />
    </ListPage>
  );
};

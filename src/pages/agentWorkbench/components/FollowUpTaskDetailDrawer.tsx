import {
  Button,
  Descriptions,
  Drawer,
  Flex,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import * as React from 'react';
import { useState } from 'react';
import type {
  AttemptResult,
  FollowUpHandlingResultDto,
  FollowUpNextAction,
  FollowUpTaskDto,
} from '@/services/ruoyi/agent-console';
import CallRecordDetailContent from '../../aiCallRecords/CallRecordDetailContent';
import FollowUpCallDetail from './FollowUpCallDetail';

const { Text, Title } = Typography;

void React.createElement;

const sourceLabels: Record<FollowUpTaskDto['source_type'], string> = {
  after_call_work: '接通后跟进',
  handoff_unanswered: '人工未接回访',
  ai_post_call: 'AI 话后跟进',
};

const attemptResultLabels: Record<AttemptResult, string> = {
  connected: '已接通',
  no_answer: '无人接听',
  busy: '占线',
  rejected: '客户拒接',
  invalid_contact: '无效联系方式',
  technical_failure: '技术失败',
};

const nextActionLabels: Record<FollowUpNextAction, string> = {
  continue: '继续跟进',
  complete: '办结任务',
  close: '终止跟进',
};

const callStatusLabels: Record<string, string> = {
  dialing: '正在呼叫',
  ringing: '等待接听',
  connected: '通话中',
  completed: '已结束',
  failed: '呼叫失败',
};

const formatDateTime = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '未约定回访时间';

const latestAttemptOf = (task: FollowUpTaskDto) =>
  task.latest_attempt || task.attempts?.at(-1);

type FollowUpTaskDetailDrawerProps = {
  error?: string;
  loading?: boolean;
  onClose: () => void;
  open: boolean;
  task?: FollowUpTaskDto;
};

const FollowUpTaskDetailDrawer = ({
  error,
  loading = false,
  onClose,
  open,
  task,
}: FollowUpTaskDetailDrawerProps) => {
  const [selectedCallId, setSelectedCallId] = useState<string>();
  const [selectedSourceCallId, setSelectedSourceCallId] = useState<string>();
  const latestAttempt = task ? latestAttemptOf(task) : undefined;
  const handlingResults = task?.handling_results || [];
  const callbackRecords = task?.callback_records || [];
  const renderHandlingResult = (
    handling: FollowUpHandlingResultDto,
    showHandledAt = true,
  ) => (
    <Flex vertical gap={2}>
      {showHandledAt ? (
        <Text>处理时间：{formatDateTime(handling.handled_at)}</Text>
      ) : null}
      <Text>坐席：{handling.agent_identity}</Text>
      <Text>联系结果：{attemptResultLabels[handling.contact_result]}</Text>
      <Text>处理备注：{handling.remark}</Text>
      <Text>下一步：{nextActionLabels[handling.next_action]}</Text>
      {handling.next_follow_up_at ? (
        <Text>下次跟进：{formatDateTime(handling.next_follow_up_at)}</Text>
      ) : null}
    </Flex>
  );
  const relatedTimelineItems = [
    {
      occurredAt: task?.source_record?.started_at,
      color: 'gray',
      content: (
        <Flex vertical gap={4}>
          <Text strong>原始通话</Text>
          <Text type="secondary">
            {task?.source_record
              ? `${formatDateTime(task.source_record.started_at)} · ${callStatusLabels[task.source_record.status] || '状态未知'}`
              : '暂无原始通话信息'}
          </Text>
          {task?.source_record?.call_id || task?.source_call_id ? (
            <Button
              type="link"
              size="small"
              style={{ alignSelf: 'flex-start', paddingInline: 0 }}
              onClick={() =>
                setSelectedSourceCallId(
                  task.source_record?.call_id || task.source_call_id,
                )
              }
            >
              查看原始通话详情
            </Button>
          ) : null}
        </Flex>
      ),
    },
    ...[...callbackRecords]
      .sort(
        (left, right) =>
          dayjs(left.started_at).valueOf() - dayjs(right.started_at).valueOf(),
      )
      .map((record, index) => {
        const attempt = task?.attempts?.find(
          (item) => item.related_call_id === record.call_id,
        );
        const handling = handlingResults.find(
          (item) => item.related_call_id === record.call_id,
        );
        const isCurrent =
          record.call_id === (selectedCallId || task?.pending_handling_call_id);
        return {
          occurredAt: record.started_at,
          color: isCurrent ? 'blue' : 'green',
          content: (
            <Flex vertical gap={4}>
              <Flex align="center" gap="small" wrap>
                <Text strong>{`第${index + 1}次人工回拨`}</Text>
                {isCurrent ? <Tag color="blue">当前回拨</Tag> : null}
                <Text type="secondary">{`回拨时间：${formatDateTime(record.started_at)}`}</Text>
                <Tag>
                  {attempt
                    ? attemptResultLabels[attempt.attempt_result]
                    : callStatusLabels[record.status] || '状态未知'}
                </Tag>
              </Flex>
              {handling ? (
                renderHandlingResult(handling, false)
              ) : (
                <Text type="secondary">待提交处理结果</Text>
              )}
              <Button
                type="link"
                size="small"
                style={{ alignSelf: 'flex-start', paddingInline: 0 }}
                onClick={() => setSelectedCallId(record.call_id)}
              >
                查看本次通话详情
              </Button>
            </Flex>
          ),
        };
      }),
    ...handlingResults
      .filter((item) => !item.related_call_id)
      .map((handling) => ({
        occurredAt: handling.handled_at,
        color: 'green',
        content: renderHandlingResult(handling),
      })),
  ]
    .sort(
      (left, right) =>
        dayjs(left.occurredAt || 0).valueOf() -
        dayjs(right.occurredAt || 0).valueOf(),
    )
    .map(({ occurredAt: _occurredAt, ...item }) => item);

  const close = () => {
    setSelectedCallId(undefined);
    setSelectedSourceCallId(undefined);
    onClose();
  };
  const returnToTask = () => {
    setSelectedCallId(undefined);
    setSelectedSourceCallId(undefined);
  };

  return (
    <Drawer
      title={
        selectedSourceCallId
          ? '通话记录详情'
          : selectedCallId
            ? '回拨通话详情'
            : '跟进任务详情'
      }
      open={open}
      loading={loading}
      size={selectedCallId || selectedSourceCallId ? 800 : 520}
      extra={
        selectedCallId || selectedSourceCallId ? (
          <Button type="link" onClick={returnToTask}>
            返回跟进任务详情
          </Button>
        ) : null
      }
      onClose={close}
    >
      {error ? (
        <Typography.Text type="danger">{error}</Typography.Text>
      ) : task ? (
        <Flex vertical gap={24}>
          {selectedSourceCallId ? (
            <CallRecordDetailContent callId={selectedSourceCallId} />
          ) : selectedCallId ? (
            <FollowUpCallDetail callId={selectedCallId} followUp={task} />
          ) : (
            <Descriptions
              column={1}
              styles={{ label: { color: '#1f1f1f' } }}
              items={[
                {
                  key: 'contact',
                  label: '客户',
                  children:
                    [task.customer_name, task.masked_contact]
                      .filter((value) => value && value !== '未提供')
                      .join(' · ') || '-',
                },
                {
                  key: 'source',
                  label: '来源',
                  children: sourceLabels[task.source_type],
                },
                {
                  key: 'reason',
                  label: '跟进原因',
                  children: task.follow_up_reason,
                },
                {
                  key: 'callback',
                  label: '应跟进时间',
                  children: formatDateTime(task.customer_callback_at),
                },
                {
                  key: 'latest',
                  label: '最近联系结果',
                  children: latestAttempt
                    ? attemptResultLabels[latestAttempt.attempt_result]
                    : '暂无联系记录',
                },
              ]}
            />
          )}
          {!selectedSourceCallId ? (
            <section>
              <Title level={5}>关联通话与处理记录</Title>
              <Timeline items={relatedTimelineItems} />
            </section>
          ) : null}
        </Flex>
      ) : null}
    </Drawer>
  );
};

export default FollowUpTaskDetailDrawer;

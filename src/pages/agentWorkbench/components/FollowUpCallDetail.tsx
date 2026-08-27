import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Flex,
  Spin,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import * as React from 'react';
import { useEffect, useState } from 'react';
import DialogueSegments from '@/pages/aiCallRecords/DialogueSegments';
import {
  type AiCallDialogueSegment,
  type AiCallRecordDetail,
  type AiCallRecording,
  getAiCallRecordDetail,
  getAiCallRecordDialogue,
  getAiCallRecordRecording,
} from '@/pages/aiCallRecords/service';
import type { FollowUpTaskDto } from '@/services/ruoyi/agent-console';
import AgentName from './AgentName';

const { Text, Title } = Typography;

type CallBundle = {
  detail: AiCallRecordDetail;
  recording: AiCallRecording | null;
  dialogue: AiCallDialogueSegment[];
};

const detailDescriptionStyles = { label: { color: '#1f1f1f' } };

const recordStatusLabels: Record<string, string> = {
  created: '已创建',
  dialing: '正在呼叫',
  ringing: '等待接听',
  running: '通话中',
  connected: '通话中',
  completed: '已结束',
  failed: '呼叫失败',
};

const endReasonLabels: Record<string, string> = {
  agent_completed: '坐席结束',
  customer_end: '客户结束',
  remote_hangup: '远端挂断',
  sip_participant_left: '对方挂断',
  handoff_timeout: '转人工等待超时',
  callback_completed: '已结束',
  callback_ended_by_agent: '坐席结束',
  callback_no_answer: '未接通',
  callback_busy: '忙线',
  callback_rejected: '已拒接',
  callback_invalid_contact: '联系方式无效',
  callback_technical_failure: '呼叫失败',
};

const formatDateTime = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';

const formatDuration = (durationMs?: number | null) => {
  if (durationMs == null) return '-';
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  return seconds >= 60
    ? `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
    : `${seconds} 秒`;
};

const FollowUpCallDetail = ({
  callId,
  followUp,
}: {
  callId: string;
  followUp: FollowUpTaskDto;
}) => {
  const [bundle, setBundle] = useState<CallBundle>();
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setBundle(undefined);
    setError('');

    void Promise.allSettled([
      getAiCallRecordDetail(callId),
      getAiCallRecordRecording(callId),
      getAiCallRecordDialogue(callId),
    ]).then(([detail, recording, dialogue]) => {
      if (!active) return;
      if (detail.status === 'rejected') {
        setError('通话详情加载失败，请重试');
        return;
      }
      setBundle({
        detail: detail.value,
        recording: recording.status === 'fulfilled' ? recording.value : null,
        dialogue: dialogue.status === 'fulfilled' ? dialogue.value.rows : [],
      });
    });

    return () => {
      active = false;
    };
  }, [callId, reloadKey]);

  if (error) {
    return (
      <Alert
        showIcon
        type="error"
        title={error}
        action={
          <Button onClick={() => setReloadKey((key) => key + 1)}>重试</Button>
        }
      />
    );
  }
  if (!bundle) {
    return (
      <Flex justify="center">
        <Spin />
      </Flex>
    );
  }

  const record = bundle.detail.record;
  const recordingUrl = bundle.recording?.playUrl || record.recordingPlayUrl;
  const attempt = followUp.attempts?.find(
    (item) => item.related_call_id === callId,
  );
  const handling = followUp.handling_results?.find(
    (item) => item.related_call_id === callId,
  );
  const agent = handling?.agent_identity || attempt?.agent_identity || '-';

  return (
    <Flex vertical gap={28}>
      <section>
        <Title level={5}>本次回拨</Title>
        <Descriptions
          column={2}
          styles={detailDescriptionStyles}
          items={[
            {
              key: 'customer',
              label: '客户',
              children: [
                followUp.customer_name,
                followUp.masked_contact || '联系方式已脱敏',
              ]
                .filter(Boolean)
                .join(' · '),
            },
            {
              key: 'task',
              label: '所属跟进任务',
              children: followUp.task_name || followUp.follow_up_reason,
            },
            {
              key: 'source',
              label: '原始通话',
              children: followUp.source_record
                ? `${formatDateTime(followUp.source_record.started_at)} · ${recordStatusLabels[followUp.source_record.status] || '状态未知'}`
                : '暂无原始通话信息',
            },
            {
              key: 'agent',
              label: '坐席',
              children: <AgentName identity={agent} />,
            },
            {
              key: 'startedAt',
              label: '开始时间',
              children: formatDateTime(record.startedAt),
            },
            {
              key: 'duration',
              label: '通话时长',
              children: formatDuration(record.durationMs),
            },
            {
              key: 'endReason',
              label: '结束状态',
              children: record.endReason
                ? endReasonLabels[record.endReason] || record.endReason
                : recordStatusLabels[record.status] || record.status,
              span: 2,
            },
          ]}
        />
      </section>

      <section>
        <Title level={5}>录音与对话</Title>
        {recordingUrl ? (
          <div
            data-testid="follow-up-recording-player"
            style={{ marginBottom: 16 }}
          >
            {
              // biome-ignore lint/a11y/useMediaCaption: 同一区域展示完整通话对话，录音暂无独立字幕轨道。
              <audio
                controls
                controlsList="nodownload"
                preload="metadata"
                src={recordingUrl}
                style={{ width: '100%' }}
              />
            }
          </div>
        ) : (
          <Text type="secondary">暂无录音</Text>
        )}
        {bundle.dialogue.length ? (
          <DialogueSegments segments={bundle.dialogue} />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无对话文本"
          />
        )}
      </section>
    </Flex>
  );
};

export default FollowUpCallDetail;

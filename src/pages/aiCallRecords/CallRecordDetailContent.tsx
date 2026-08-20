import { Alert, Descriptions, Empty, Flex, Spin, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  getHandoffReasonLabel,
  statusLabels as handoffStatusLabels,
} from '@/pages/agentWorkbench/admin/_shared';
import AgentName from '@/pages/agentWorkbench/components/AgentName';
import AnalysisResultDescriptions, {
  describeBusinessScene,
  describeEndReason,
  hasAnalysisResult,
} from './AnalysisResultDescriptions';
import DialogueSegments from './DialogueSegments';
import {
  type AiCallDialogueSegment,
  type AiCallHandoff,
  type AiCallRecord,
  type AiCallRecordDetail,
  type AiCallRecording,
  type AiCallSemanticAnalysis,
  getAiCallRecordDetail,
  getAiCallRecordDialogue,
  getAiCallRecordHandoffs,
  getAiCallRecordRecording,
  getAiCallRecordSemanticAnalysis,
} from './service';

const { Text, Title } = Typography;

void React.createElement;

const detailDescriptionStyles = { label: { color: '#1f1f1f' } };

const entryTypeLabels: Record<string, string> = {
  web: '浏览器测试',
  outbound: '外呼',
  sip_outbound: 'SIP 外呼',
  sip_inbound: 'SIP 呼入',
  sip_callback: '人工回拨',
  owner_runtime: '平台运行时',
  outbound_mock: '模拟执行',
};

const getEntryTypeLabel = (
  record: Pick<AiCallRecord, 'entryType' | 'taskId'>,
) =>
  record.entryType === 'web' && record.taskId
    ? 'Web 接听'
    : entryTypeLabels[record.entryType] || record.entryType;

const statusLabels: Record<string, string> = {
  created: '已创建',
  pending: '待处理',
  processing: '处理中',
  starting: '启动中',
  running: '通话中',
  active: '通话中',
  ending: '结束中',
  completed: '已完成',
  closed: '已关闭',
  failed: '失败',
};

const analysisStatusLabels: Record<string, string> = {
  '0': '待分析',
  '1': '分析中',
  '2': '分析成功',
  '3': '分析失败',
  '4': '无有效客户话术',
};

const businessTypeLabels: Record<string, string> = {
  outbound_task: '正式外呼任务',
  outbound_attempt: '外呼通话',
  lead: '销售线索',
  debt_collection: '物业催收',
};

const dispositionLabels: Record<string, string> = {
  resolved: '已解决',
  follow_up_required: '需要后续跟进',
  customer_refused: '客户拒绝',
  invalid_contact: '联系方式无效',
  other: '其他',
};

const formatDateTime = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';

const formatDuration = (durationMs?: number | null) => {
  if (durationMs == null) return '-';
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
};

const describeRecordStatus = (record: AiCallRecord) =>
  statusLabels[record.status] || record.status;

const describeEndResult = (record: AiCallRecord) =>
  record.failureMessage ||
  (record.endReason
    ? describeEndReason(record.endReason)
    : record.status === 'failed'
      ? '未知失败原因'
      : '-');

type DetailErrors = Partial<
  Record<'recording' | 'dialogue' | 'analysis' | 'handoffs' | 'detail', string>
>;

type CallRecordDetailContentProps = {
  callId?: string;
};

const CallRecordDetailContent = ({ callId }: CallRecordDetailContentProps) => {
  const [detail, setDetail] = useState<AiCallRecordDetail>();
  const [recording, setRecording] = useState<AiCallRecording | null>();
  const [dialogue, setDialogue] = useState<AiCallDialogueSegment[]>([]);
  const [analysis, setAnalysis] = useState<AiCallSemanticAnalysis | null>();
  const [handoffs, setHandoffs] = useState<AiCallHandoff[]>([]);
  const [errors, setErrors] = useState<DetailErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!callId) return;
    let active = true;
    setDetail(undefined);
    setRecording(undefined);
    setDialogue([]);
    setAnalysis(undefined);
    setHandoffs([]);
    setErrors({});
    setLoading(true);
    void (async () => {
      try {
        const nextDetail = await getAiCallRecordDetail(callId);
        const results = await Promise.allSettled([
          getAiCallRecordRecording(callId),
          getAiCallRecordDialogue(callId),
          getAiCallRecordSemanticAnalysis(callId),
          getAiCallRecordHandoffs(callId),
        ]);
        if (!active) return;
        const nextErrors: DetailErrors = {};
        if (results[0].status === 'fulfilled') setRecording(results[0].value);
        else nextErrors.recording = '录音信息加载失败';
        if (results[1].status === 'fulfilled')
          setDialogue(results[1].value.rows);
        else nextErrors.dialogue = '对话记录加载失败';
        if (results[2].status === 'fulfilled') setAnalysis(results[2].value);
        else nextErrors.analysis = 'AI 分析加载失败';
        if (results[3].status === 'fulfilled')
          setHandoffs(results[3].value.rows);
        else nextErrors.handoffs = '转人工记录加载失败';
        setDetail(nextDetail);
        setErrors(nextErrors);
      } catch {
        if (active) setErrors({ detail: '通话详情加载失败' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [callId]);

  if (loading) {
    return (
      <Flex justify="center">
        <Spin />
      </Flex>
    );
  }
  const record = detail?.record;
  if (!record) {
    return (
      <Alert
        showIcon
        title={errors.detail || '通话详情加载失败'}
        type="error"
      />
    );
  }
  const executionConfig = detail?.executionConfig;
  const afterCallWork = detail?.afterCallWork;
  const recordingUrl =
    recording?.playUrl ||
    record.recordingPlayUrl ||
    recording?.tracks?.find((track) => track.playUrl)?.playUrl;
  return (
    <Flex data-testid="call-detail-sections" vertical gap={32}>
      <section>
        <Title level={5}>基本信息</Title>
        <Descriptions
          column={2}
          styles={detailDescriptionStyles}
          items={[
            {
              key: 'entryType',
              label: '通话来源',
              children: getEntryTypeLabel(record),
            },
            {
              key: 'status',
              label: '通话状态',
              children: describeRecordStatus(record),
            },
            {
              key: 'sceneCode',
              label: '业务场景',
              children: describeBusinessScene(record.sceneCode),
            },
            {
              key: 'businessType',
              label: '业务类型',
              children: record.businessType
                ? businessTypeLabels[record.businessType] || record.businessType
                : '-',
            },
            {
              key: 'startedAt',
              label: '开始时间',
              children: formatDateTime(record.startedAt),
            },
            {
              key: 'answeredAt',
              label: '接通时间',
              children: formatDateTime(record.answeredAt),
            },
            {
              key: 'endedAt',
              label: '结束时间',
              children: formatDateTime(record.endedAt),
            },
            {
              key: 'duration',
              label: '通话时长',
              children: formatDuration(record.durationMs),
            },
            {
              key: 'result',
              label: '结束结果',
              children: describeEndResult(record),
              span: 2,
            },
          ]}
        />
      </section>
      <section>
        <Title level={5}>执行配置</Title>
        {executionConfig ? (
          <Descriptions
            column={2}
            styles={detailDescriptionStyles}
            items={[
              {
                key: 'prompt',
                label: '提示词',
                children: executionConfig.promptName || '-',
              },
              {
                key: 'scene',
                label: '业务场景',
                children: describeBusinessScene(executionConfig.sceneCode),
              },
              {
                key: 'voice',
                label: '音色',
                children: executionConfig.voiceName || '-',
              },
              {
                key: 'rule',
                label: '呼叫规则',
                children: executionConfig.ruleName || '-',
              },
            ]}
          />
        ) : (
          <Text type="secondary">未保存执行配置快照</Text>
        )}
      </section>
      <section>
        <Title level={5}>录音与对话</Title>
        <div data-testid="recording-player" style={{ marginBottom: 16 }}>
          {errors.recording ? (
            <Alert showIcon title={errors.recording} type="error" />
          ) : recordingUrl ? (
            // biome-ignore lint/a11y/useMediaCaption: 同一区域展示完整通话对话，录音暂无独立字幕轨道。
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
              description="暂无录音"
            />
          )}
        </div>
        {errors.dialogue ? (
          <Alert showIcon title={errors.dialogue} type="error" />
        ) : dialogue.length ? (
          <DialogueSegments segments={dialogue} />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无对话文本"
          />
        )}
      </section>
      <section>
        {afterCallWork ? (
          <>
            <Title level={5}>坐席最终处置</Title>
            <Descriptions
              column={1}
              styles={detailDescriptionStyles}
              items={[
                {
                  key: 'result',
                  label: '处置结果',
                  children: (
                    <Tag
                      color={
                        afterCallWork.needsFollowUp ? 'warning' : 'success'
                      }
                    >
                      {dispositionLabels[afterCallWork.dispositionCode || ''] ||
                        afterCallWork.dispositionCode}
                    </Tag>
                  ),
                },
                {
                  key: 'summary',
                  label: '处理备注',
                  children: afterCallWork.summary || '-',
                },
                {
                  key: 'agent',
                  label: '提交坐席',
                  children: (
                    <AgentName identity={afterCallWork.agentIdentity} />
                  ),
                },
                {
                  key: 'time',
                  label: '提交时间',
                  children: formatDateTime(afterCallWork.submittedAt),
                },
              ]}
            />
          </>
        ) : (
          <>
            <Title level={5}>AI 分析与转人工</Title>
            {errors.analysis ? (
              <Alert showIcon title={errors.analysis} type="error" />
            ) : analysis ? (
              <Flex vertical gap={12}>
                <Text>{`分析状态：${
                  analysisStatusLabels[analysis.analysisStatus] ||
                  analysis.analysisStatus
                }`}</Text>
                {analysis.analysisError ? (
                  <Alert showIcon title={analysis.analysisError} type="error" />
                ) : hasAnalysisResult(analysis.analysisResult) ? (
                  <AnalysisResultDescriptions
                    analysisResult={analysis.analysisResult}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无结构化分析结果"
                  />
                )}
              </Flex>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无 AI 分析"
              />
            )}
          </>
        )}
        {errors.handoffs ? (
          <Alert showIcon title={errors.handoffs} type="error" />
        ) : handoffs.length ? (
          <Flex
            data-testid="handoff-details"
            vertical
            gap={8}
            style={{ marginTop: 16 }}
          >
            {handoffs.map((handoff) => (
              <Descriptions
                key={handoff.handoffId}
                column={2}
                styles={detailDescriptionStyles}
                items={[
                  {
                    key: 'status',
                    label: '转人工状态',
                    children:
                      handoffStatusLabels[handoff.status] || handoff.status,
                  },
                  {
                    key: 'agent',
                    label: '接听坐席',
                    children: (
                      <AgentName identity={handoff.humanAgentIdentity} />
                    ),
                  },
                  {
                    key: 'reason',
                    label: '转人工原因',
                    children: getHandoffReasonLabel(handoff.requestReason),
                    span: 2,
                  },
                ]}
              />
            ))}
          </Flex>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="本次未转人工"
          />
        )}
      </section>
    </Flex>
  );
};

export default CallRecordDetailContent;

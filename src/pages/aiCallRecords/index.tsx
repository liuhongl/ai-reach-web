import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { history, useSearchParams } from '@umijs/max';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  message,
  Popconfirm,
  Radio,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getHandoffReasonLabel,
  statusLabels as handoffStatusLabels,
} from '@/pages/agentWorkbench/admin/_shared';
import { listAiCallTasks } from '@/pages/aiCallTasks/service';
import AnalysisResultDescriptions, {
  describeBusinessScene,
  describeEndReason,
  hasAnalysisResult,
} from './AnalysisResultDescriptions';
import DialogueSegments from './DialogueSegments';
import {
  type AiCallDialogueSegment,
  type AiCallHandoff,
  type AiCallQualityDetail,
  type AiCallRecord,
  type AiCallRecordDetail,
  type AiCallRecording,
  type AiCallSemanticAnalysis,
  getAiCallRecordDetail,
  getAiCallRecordDialogue,
  getAiCallRecordHandoffs,
  getAiCallRecordQuality,
  getAiCallRecordRecording,
  getAiCallRecordSemanticAnalysis,
  listAiCallRecords,
  type QualityReviewResult,
  reviewAiCallRecordFollowUp,
  saveAiCallRecordQualityReview,
  scoreAiCallRecordQuality,
} from './service';
import {
  getCustomerIntentPresentation,
  getFollowUpPresentation,
  getQualityReviewPresentation,
  getQualityScorePresentation,
  hasUnstablePostCallData,
  isFormalOutboundRecord,
  type StatusPresentation,
} from './status';

const { Text, Title } = Typography;

void React.createElement;

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

const mockStatusLabels: Record<string, string> = {
  created: '模拟待执行',
  starting: '模拟启动中',
  running: '模拟执行中',
  active: '模拟执行中',
  ending: '模拟结束中',
  completed: '模拟执行完成',
  failed: '模拟执行失败',
};

const callResultLabels: Record<string, string> = {
  connected: '已接通',
  no_answer: '无人接听',
  busy: '占线',
  call_failed: '呼叫失败',
  invalid_number: '号码无效',
};

const callResultColors: Record<string, string> = {
  connected: '#389e0d',
  no_answer: '#595959',
  busy: '#d48806',
  call_failed: '#cf1322',
  invalid_number: '#cf1322',
};

const detailDescriptionStyles = {
  label: { color: '#1f1f1f' },
};

const analysisStatusLabels: Record<string, string> = {
  '0': '待分析',
  '1': '分析中',
  '2': '分析成功',
  '3': '分析失败',
  '4': '无有效客户话术',
};

const qualityScoreStatusLabels: Record<string, string> = {
  pending: '待评分',
  processing: '评分中',
  completed: '评分完成',
  failed: '评分失败',
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

const qualityReviewOptions: Array<{
  label: string;
  style: React.CSSProperties;
  value: QualityReviewResult;
}> = [
  {
    label: '优秀',
    value: 'excellent',
    style: { flex: 1, textAlign: 'center' },
  },
  { label: '良好', value: 'good', style: { flex: 1, textAlign: 'center' } },
  { label: '合格', value: 'pass', style: { flex: 1, textAlign: 'center' } },
  { label: '不合格', value: 'fail', style: { flex: 1, textAlign: 'center' } },
];

const canOpenQualityReview = (row: AiCallRecord) =>
  row.entryType === 'outbound' ||
  row.entryType === 'sip_outbound' ||
  (row.entryType === 'web' && Boolean(row.taskId));

const buildQualityFallback = (row: AiCallRecord): AiCallQualityDetail => {
  if (
    row.qualityScoreStatus !== 'pending' &&
    row.qualityScoreStatus !== 'processing' &&
    row.qualityScoreStatus !== 'completed' &&
    row.qualityScoreStatus !== 'failed'
  ) {
    return { score: null, review: null };
  }
  return {
    score: {
      id: '',
      callId: row.callId,
      status: row.qualityScoreStatus,
      score: row.qualityScore,
      reason: null,
      modelVersion: '',
      retryCount: 0,
    },
    review: null,
  };
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

const maskPhoneNumber = (value?: string | null) => {
  if (!value) return '-';
  return value.length >= 7
    ? `${value.slice(0, 3)}****${value.slice(-4)}`
    : value;
};

const describeError = (row: AiCallRecord) =>
  row.failureMessage ||
  (row.endReason
    ? describeEndReason(row.endReason)
    : row.status === 'failed'
      ? '未知失败原因'
      : '-');

const describeRecordStatus = (row: AiCallRecord) =>
  row.entryType === 'outbound_mock'
    ? mockStatusLabels[row.status] || `模拟执行（${row.status}）`
    : statusLabels[row.status] || row.status;

const describeMockResult = (row: AiCallRecord) => {
  const result = row.callResult || row.endReason;
  if (result === 'connected') return '模拟执行完成';
  return result && callResultLabels[result]
    ? `模拟：${callResultLabels[result]}`
    : describeRecordStatus(row);
};

const describeCallResult = (row: AiCallRecord) =>
  row.entryType === 'outbound_mock'
    ? describeMockResult(row)
    : row.callResult
      ? callResultLabels[row.callResult] || row.callResult
      : describeRecordStatus(row);

const describeEndResult = (row: AiCallRecord) =>
  row.entryType === 'outbound_mock'
    ? describeMockResult(row)
    : describeError(row);

const renderPostCallStatus = (
  presentation: StatusPresentation | null,
  onClick?: () => void,
) => {
  if (!presentation) {
    return <Text type="secondary">-</Text>;
  }
  const tag = (
    <Tag color={presentation.color} style={{ marginInlineEnd: 0 }}>
      {presentation.text}
    </Tag>
  );
  return (
    <Tooltip title={presentation.tooltip}>
      {presentation.target && onClick ? (
        <Button
          aria-label={`${presentation.text}，查看详情`}
          size="small"
          type="link"
          style={{ height: 'auto', padding: 0 }}
          onClick={onClick}
        >
          {tag}
        </Button>
      ) : (
        tag
      )}
    </Tooltip>
  );
};

const getQualityScoreTextColor = (score?: number | null) => {
  if (typeof score !== 'number') return undefined;
  if (score >= 85) return '#52c41a';
  if (score >= 60) return '#faad14';
  return '#ff4d4f';
};

const renderDialogueSegments = (segments: AiCallDialogueSegment[]) => (
  <DialogueSegments segments={segments} />
);

const MAX_POST_CALL_POLLS = 12;
const POST_CALL_POLL_INTERVAL_MS = 5000;

type DetailErrors = Partial<
  Record<'recording' | 'dialogue' | 'analysis' | 'handoffs' | 'detail', string>
>;

type QualityReviewErrors = Partial<
  Record<'recording' | 'dialogue' | 'quality', string>
>;

type QualityReviewFormValues = {
  qualityResult?: QualityReviewResult;
  qualityReason?: string | null;
};

const AiCallRecordsPage = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [qualityForm] = Form.useForm<QualityReviewFormValues>();
  const selectedQualityResult = Form.useWatch('qualityResult', qualityForm);
  const selectedQualityReason = Form.useWatch('qualityReason', qualityForm);
  const [searchParams] = useSearchParams();
  const presetCallId = searchParams.get('callId')?.trim() || undefined;
  const presetListOnly = searchParams.get('view') === 'list';
  const presetTaskId = searchParams.get('taskId') || undefined;
  const presetTargetId = searchParams.get('targetId') || undefined;
  const presetEntryType = searchParams.get('entryType') || undefined;
  const presetFormalOutboundOnly =
    searchParams.get('formalOutboundOnly') === 'true';
  const presetCallResult = searchParams.get('callResult') || undefined;
  const presetStartedAtBegin = searchParams.get('startedAtBegin') || undefined;
  const presetStartedAtEnd = searchParams.get('startedAtEnd') || undefined;
  const [taskOptions, setTaskOptions] = useState<
    Array<{ label: string; value: string }>
  >(presetTaskId ? [{ label: presetTaskId, value: presetTaskId }] : []);
  const [selectedCallId, setSelectedCallId] = useState<string>();
  const [detail, setDetail] = useState<AiCallRecordDetail>();
  const [recording, setRecording] = useState<AiCallRecording | null>();
  const [dialogue, setDialogue] = useState<AiCallDialogueSegment[]>([]);
  const [analysis, setAnalysis] = useState<AiCallSemanticAnalysis | null>();
  const [handoffs, setHandoffs] = useState<AiCallHandoff[]>([]);
  const [detailErrors, setDetailErrors] = useState<DetailErrors>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [followUpReviewing, setFollowUpReviewing] = useState(false);
  const [qualityRecord, setQualityRecord] = useState<AiCallRecord>();
  const [qualityDetail, setQualityDetail] = useState<AiCallQualityDetail>();
  const [qualityRecording, setQualityRecording] =
    useState<AiCallRecording | null>();
  const [qualityDialogue, setQualityDialogue] = useState<
    AiCallDialogueSegment[]
  >([]);
  const [qualityErrors, setQualityErrors] = useState<QualityReviewErrors>({});
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualitySaving, setQualitySaving] = useState(false);
  const [qualityScoring, setQualityScoring] = useState(false);
  const [hasUnstableRecords, setHasUnstableRecords] = useState(false);
  const postCallPollCountRef = useRef(0);
  const postCallRefreshInFlightRef = useRef(false);

  const loadTaskOptions = useCallback(
    async (taskName?: string) => {
      try {
        const page = await listAiCallTasks({
          pageNum: 1,
          pageSize: 20,
          ...(taskName ? { taskName } : {}),
        });
        setTaskOptions((current) => {
          const next = page.rows.map((task) => ({
            label: task.taskName,
            value: task.taskId,
          }));
          const currentPreset = current.find(
            (option) => option.value === presetTaskId,
          );
          return currentPreset &&
            !next.some((option) => option.value === currentPreset.value)
            ? [currentPreset, ...next]
            : next;
        });
      } catch {
        // 任务筛选加载失败不阻塞通话记录主列表。
      }
    },
    [presetTaskId],
  );

  useEffect(() => {
    void loadTaskOptions();
  }, [loadTaskOptions]);

  const closeDetail = () => {
    setSelectedCallId(undefined);
    setDetail(undefined);
    setRecording(undefined);
    setDialogue([]);
    setAnalysis(undefined);
    setHandoffs([]);
    setDetailErrors({});
    setFollowUpReviewing(false);
  };

  const closeQualityReview = () => {
    setQualityRecord(undefined);
    setQualityDetail(undefined);
    setQualityRecording(undefined);
    setQualityDialogue([]);
    setQualityErrors({});
    setQualityScoring(false);
    qualityForm.resetFields();
  };

  const openDetail = useCallback(async (callId: string) => {
    setSelectedCallId(callId);
    setDetail(undefined);
    setRecording(undefined);
    setDialogue([]);
    setAnalysis(undefined);
    setHandoffs([]);
    setDetailErrors({});
    setDetailLoading(true);
    try {
      const nextDetail = await getAiCallRecordDetail(callId);
      setDetail(nextDetail);

      const results = await Promise.allSettled([
        getAiCallRecordRecording(callId),
        getAiCallRecordDialogue(callId),
        getAiCallRecordSemanticAnalysis(callId),
        getAiCallRecordHandoffs(callId),
      ]);
      const nextErrors: DetailErrors = {};

      if (results[0].status === 'fulfilled') {
        setRecording(results[0].value);
      } else {
        nextErrors.recording = '录音信息加载失败';
      }
      if (results[1].status === 'fulfilled') {
        setDialogue(results[1].value.rows);
      } else {
        nextErrors.dialogue = '对话记录加载失败';
      }
      if (results[2].status === 'fulfilled') {
        setAnalysis(results[2].value);
      } else {
        nextErrors.analysis = 'AI 分析加载失败';
      }
      if (results[3].status === 'fulfilled') {
        setHandoffs(results[3].value.rows);
      } else {
        nextErrors.handoffs = '转人工记录加载失败';
      }
      setDetailErrors(nextErrors);
    } catch {
      setDetailErrors({ detail: '通话详情加载失败' });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openQualityReview = useCallback(
    async (row: AiCallRecord) => {
      setQualityRecord(row);
      setQualityDetail(undefined);
      setQualityRecording(undefined);
      setQualityDialogue([]);
      setQualityErrors({});
      qualityForm.resetFields();
      setQualityLoading(true);
      const shouldLoadQualityDetail =
        row.qualityScoreStatus === 'completed' ||
        Boolean(row.qualityReviewResult);
      const qualityDetailRequest = shouldLoadQualityDetail
        ? getAiCallRecordQuality(row.callId)
        : Promise.resolve(buildQualityFallback(row));
      const results = await Promise.allSettled([
        getAiCallRecordRecording(row.callId),
        getAiCallRecordDialogue(row.callId),
        qualityDetailRequest,
      ]);
      const nextErrors: QualityReviewErrors = {};

      if (results[0].status === 'fulfilled') {
        setQualityRecording(results[0].value);
      } else {
        nextErrors.recording = '录音信息加载失败';
      }
      if (results[1].status === 'fulfilled') {
        setQualityDialogue(results[1].value.rows);
      } else {
        nextErrors.dialogue = '对话记录加载失败';
      }
      if (results[2].status === 'fulfilled') {
        setQualityDetail(results[2].value);
        qualityForm.setFieldsValue({
          qualityResult: results[2].value.review?.qualityResult,
          qualityReason: results[2].value.review?.qualityReason || undefined,
        });
      } else {
        setQualityDetail(buildQualityFallback(row));
      }
      setQualityErrors(nextErrors);
      setQualityLoading(false);
    },
    [qualityForm],
  );

  const reviewFollowUp = async (action: 'create' | 'dismiss') => {
    if (!selectedCallId) return;
    setFollowUpReviewing(true);
    try {
      await reviewAiCallRecordFollowUp(selectedCallId, action);
      await openDetail(selectedCallId);
      await Promise.resolve(actionRef.current?.reload?.());
    } catch {
      await Promise.allSettled([
        openDetail(selectedCallId),
        Promise.resolve(actionRef.current?.reload?.()),
      ]);
      message.error('跟进确认失败，已刷新最新状态');
    } finally {
      setFollowUpReviewing(false);
    }
  };

  const saveQualityReview = async () => {
    if (!qualityRecord) return;
    const values = await qualityForm.validateFields();
    if (!values.qualityResult) return;
    setQualitySaving(true);
    try {
      const review = await saveAiCallRecordQualityReview(qualityRecord.callId, {
        qualityResult: values.qualityResult,
        qualityReason:
          values.qualityResult === 'fail' ? values.qualityReason?.trim() : null,
      });
      setQualityDetail((current) => ({ ...(current || {}), review }));
      setQualityRecord((current) =>
        current
          ? { ...current, qualityReviewResult: review.qualityResult }
          : current,
      );
      await Promise.resolve(actionRef.current?.reload?.());
      closeQualityReview();
    } finally {
      setQualitySaving(false);
    }
  };

  const scoreQuality = async () => {
    if (!qualityRecord) return;
    setQualityScoring(true);
    setQualityErrors((current) => ({ ...current, quality: undefined }));
    try {
      const nextDetail = await scoreAiCallRecordQuality(qualityRecord.callId);
      setQualityDetail(nextDetail);
      setQualityRecord((current) =>
        current
          ? {
              ...current,
              qualityScore: nextDetail.score?.score ?? current.qualityScore,
              qualityScoreStatus:
                nextDetail.score?.status ?? current.qualityScoreStatus,
              qualityReviewResult:
                nextDetail.review?.qualityResult ?? current.qualityReviewResult,
            }
          : current,
      );
      qualityForm.setFieldsValue({
        qualityResult: nextDetail.review?.qualityResult,
        qualityReason: nextDetail.review?.qualityReason || undefined,
      });
      await Promise.resolve(actionRef.current?.reload?.());
    } catch {
      setQualityErrors((current) => ({
        ...current,
        quality: 'AI 评分执行失败',
      }));
    } finally {
      setQualityScoring(false);
    }
  };

  useEffect(() => {
    if (presetCallId && !presetListOnly) void openDetail(presetCallId);
  }, [openDetail, presetCallId, presetListOnly]);

  useEffect(() => {
    if (!hasUnstableRecords) {
      postCallPollCountRef.current = 0;
      return;
    }

    const refresh = () => {
      if (
        document.visibilityState !== 'visible' ||
        postCallPollCountRef.current >= MAX_POST_CALL_POLLS ||
        postCallRefreshInFlightRef.current ||
        !actionRef.current?.reload
      ) {
        return;
      }
      postCallPollCountRef.current += 1;
      postCallRefreshInFlightRef.current = true;
      void Promise.resolve(actionRef.current.reload()).finally(() => {
        postCallRefreshInFlightRef.current = false;
      });
    };

    const timer = window.setInterval(refresh, POST_CALL_POLL_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [hasUnstableRecords]);

  const columns = useMemo<ProColumns<AiCallRecord>[]>(
    () => [
      {
        title: '所属任务',
        dataIndex: 'taskId',
        valueType: 'select',
        hideInTable: true,
        initialValue: presetTaskId,
        fieldProps: {
          allowClear: true,
          filterOption: false,
          options: taskOptions,
          placeholder: '搜索任务名称',
          showSearch: true,
          onSearch: (value: string) => void loadTaskOptions(value.trim()),
        },
      },
      {
        title: '客户名称',
        dataIndex: 'customerName',
        hideInTable: true,
      },
      {
        title: '通话来源',
        dataIndex: 'entryType',
        initialValue: presetEntryType,
        valueType: 'select',
        valueEnum: {
          web: { text: entryTypeLabels.web },
          outbound: { text: entryTypeLabels.outbound },
          sip_outbound: { text: entryTypeLabels.sip_outbound },
          sip_inbound: { text: entryTypeLabels.sip_inbound },
          sip_callback: { text: entryTypeLabels.sip_callback },
        },
        hideInTable: true,
      },
      {
        title: '呼叫结果',
        dataIndex: 'callResult',
        initialValue: presetCallResult,
        valueType: 'select',
        valueEnum: Object.fromEntries(
          Object.entries(callResultLabels).map(([value, text]) => [
            value,
            { text },
          ]),
        ),
        hideInTable: true,
      },
      {
        title: '客户意向',
        dataIndex: 'customerIntent',
        valueType: 'select',
        valueEnum: {
          pending: { text: '待分析 / 分析中' },
          positive: { text: '正向' },
          neutral: { text: '中性' },
          negative: { text: '负向' },
          failed: { text: '分析失败' },
        },
        hideInTable: true,
      },
      {
        title: '后续跟进',
        dataIndex: 'followUpStatus',
        valueType: 'select',
        valueEnum: {
          suggested: { text: '待人工确认' },
          pending: { text: '待跟进' },
          processing: { text: '跟进中' },
          completed: { text: '已完成' },
          closed: { text: '已关闭' },
          none: { text: '无需跟进' },
        },
        hideInTable: true,
      },
      {
        title: '通话时间范围',
        dataIndex: 'startedAtRange',
        initialValue:
          presetStartedAtBegin && presetStartedAtEnd
            ? [presetStartedAtBegin, presetStartedAtEnd]
            : undefined,
        valueType: 'dateTimeRange',
        hideInTable: true,
      },
      {
        title: '客户信息',
        key: 'customer',
        search: false,
        width: 160,
        render: (_, row) => (
          <Flex vertical gap={2}>
            <Text>{row.customerName || '-'}</Text>
            <Text type="secondary">{maskPhoneNumber(row.phoneNumber)}</Text>
          </Flex>
        ),
      },
      {
        title: '任务信息',
        key: 'task',
        search: false,
        width: 180,
        render: (_, row) => (
          <Flex vertical gap={2}>
            <Text>{row.taskName || '-'}</Text>
          </Flex>
        ),
      },
      {
        title: '呼叫情况',
        key: 'call',
        search: false,
        width: 160,
        render: (_, row) => (
          <Flex vertical gap={4}>
            <Text
              strong
              style={{
                color:
                  row.entryType === 'outbound_mock'
                    ? '#1677ff'
                    : callResultColors[row.callResult || ''] || '#1f1f1f',
              }}
            >
              {describeCallResult(row)}
            </Text>
            <Text type="secondary">
              {getEntryTypeLabel(row)}
              {row.attemptNo ? ` · 第 ${row.attemptNo} 次` : ''}
            </Text>
          </Flex>
        ),
      },
      {
        title: '通话摘要',
        key: 'analysis',
        search: false,
        width: 240,
        render: (_, row) => (
          <Text
            type={row.summary ? undefined : 'secondary'}
            title={row.summary || undefined}
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {row.summary || '暂无摘要'}
          </Text>
        ),
      },
      {
        title: '通话时间',
        dataIndex: 'startedAt',
        search: false,
        width: 176,
        render: (_, row) => (
          <Flex vertical gap={2}>
            <Text>{formatDateTime(row.startedAt)}</Text>
            <Text type="secondary">
              {formatDuration(row.durationMs)}
            </Text>
          </Flex>
        ),
      },
      {
        title: '客户意向',
        key: 'customerIntentDisplay',
        search: false,
        width: 104,
        render: (_, row) =>
          renderPostCallStatus(getCustomerIntentPresentation(row), () => {
            void openDetail(row.callId);
          }),
      },
      {
        title: '后续跟进',
        key: 'followUpDisplay',
        search: false,
        width: 112,
        render: (_, row) => {
          const presentation = getFollowUpPresentation(row);
          return renderPostCallStatus(presentation, () => {
            if (presentation?.target === 'follow_up' && row.followUpId) {
              history.push(
                `/ai-call/follow-up-overview?followUpId=${encodeURIComponent(
                  row.followUpId,
                )}`,
              );
              return;
            }
            void openDetail(row.callId);
          });
        },
      },
      {
        title: 'AI 评分',
        key: 'qualityScoreDisplay',
        search: false,
        width: 104,
        render: (_, row) =>
          renderPostCallStatus(getQualityScorePresentation(row)),
      },
      {
        title: '人工质检',
        key: 'qualityReviewDisplay',
        search: false,
        fixed: 'right',
        width: 120,
        render: (_, row) => {
          if (!canOpenQualityReview(row)) {
            return <Text type="secondary">-</Text>;
          }
          const presentation = getQualityReviewPresentation(
            row.qualityReviewResult,
          );
          const content = presentation ? (
            renderPostCallStatus(presentation)
          ) : (
            <Text type="secondary">未复核</Text>
          );
          return (
            <Flex vertical align="flex-start" gap={2}>
              {content}
              <Button
                size="small"
                type="link"
                style={{ height: 'auto', padding: 0 }}
                onClick={() => void openQualityReview(row)}
              >
                {presentation ? '修改' : '复核'}
              </Button>
            </Flex>
          );
        },
      },
      {
        title: '操作',
        key: 'option',
        valueType: 'option',
        fixed: 'right',
        width: 92,
        render: (_, row) => {
          return (
            <Flex gap={4}>
              <Button
                size="small"
                type="link"
                onClick={() => void openDetail(row.callId)}
              >
                查看详情
              </Button>
            </Flex>
          );
        },
      },
    ],
    [
      loadTaskOptions,
      openDetail,
      openQualityReview,
      presetCallResult,
      presetEntryType,
      presetStartedAtBegin,
      presetStartedAtEnd,
      presetTaskId,
      taskOptions,
    ],
  );

  const record = detail?.record;
  const recordingUrl =
    record?.recordingPlayUrl ||
    recording?.playUrl ||
    recording?.tracks?.find((track) => track.playUrl)?.playUrl;
  const qualityRecordingUrl =
    qualityRecord?.recordingPlayUrl ||
    qualityRecording?.playUrl ||
    qualityRecording?.tracks?.find((track) => track.playUrl)?.playUrl;
  const qualityScore = qualityDetail?.score;
  const canSaveQualityReview = qualityScore?.status === 'completed';
  const canSubmitQualityReview = Boolean(
    selectedQualityResult &&
      (selectedQualityResult !== 'fail' ||
        String(selectedQualityReason || '').trim()),
  );
  const executionConfig = detail?.executionConfig;
  const afterCallWork = detail?.afterCallWork;
  const followUp = detail?.followUp;
  const analysisResult = analysis?.analysisResult || {};
  const needsManualFollowUpReview =
    !followUp &&
    handoffs.length === 0 &&
    Boolean(detail?.record && isFormalOutboundRecord(detail.record)) &&
    analysis?.analysisStatus === '2' &&
    Boolean(analysis?.followUpRequiresReview);
  return (
    <PageContainer title="通话记录">
      <ProTable<AiCallRecord>
        actionRef={actionRef}
        rowKey="callId"
        columns={columns}
        search={{ labelWidth: 104 }}
        scroll={{ x: 1450 }}
        pagination={{
          defaultPageSize: 10,
          showTotal: (total) => `共 ${total} 条`,
        }}
        request={async ({ current, pageSize, startedAtRange, ...filters }) => {
          const range = Array.isArray(startedAtRange)
            ? startedAtRange
            : undefined;
          const entryType =
            (filters.entryType as string | undefined) || presetEntryType;
          const callResult =
            (filters.callResult as string | undefined) || presetCallResult;
          const startedAtBegin = range?.[0]
            ? dayjs(range[0]).toISOString()
            : presetStartedAtBegin;
          const startedAtEnd = range?.[1]
            ? dayjs(range[1]).toISOString()
            : presetStartedAtEnd;
          const page = await listAiCallRecords({
            ...filters,
            pageNum: current,
            pageSize,
            ...(presetCallId ? { callId: presetCallId } : {}),
            ...((filters.taskId as string | undefined) || presetTaskId
              ? {
                  taskId:
                    (filters.taskId as string | undefined) || presetTaskId,
                }
              : {}),
            ...(presetTargetId ? { targetId: presetTargetId } : {}),
            ...(entryType ? { entryType } : {}),
            ...(presetFormalOutboundOnly ? { formalOutboundOnly: true } : {}),
            ...(callResult ? { callResult } : {}),
            ...(startedAtBegin ? { startedAtBegin } : {}),
            ...(startedAtEnd ? { startedAtEnd } : {}),
          });
          const unstable = hasUnstablePostCallData(page.rows);
          setHasUnstableRecords((current) =>
            current === unstable ? current : unstable,
          );
          return { data: page.rows, total: page.total, success: true };
        }}
      />

      <Drawer
        title="通话记录详情"
        open={Boolean(selectedCallId)}
        size="large"
        onClose={closeDetail}
      >
        {detailLoading ? (
          <Flex justify="center">
            <Spin />
          </Flex>
        ) : record ? (
          <Flex data-testid="call-detail-sections" vertical gap={32}>
            <section>
              <Title level={5}>基本信息</Title>
              <Descriptions
                column={2}
                styles={detailDescriptionStyles}
                items={[
                  {
                    key: 'callId',
                    label: '通话 ID',
                    children: record.callId,
                  },
                  {
                    key: 'entryType',
                    label: '通话来源',
                    children: getEntryTypeLabel(record),
                  },
                  {
                    key: 'sceneCode',
                    label: '业务场景',
                    children: describeBusinessScene(record.sceneCode),
                  },
                  {
                    key: 'status',
                    label: '通话状态',
                    children: describeRecordStatus(record),
                  },
                  {
                    key: 'businessType',
                    label: '业务类型',
                    children: record.businessType
                      ? businessTypeLabels[record.businessType] ||
                        record.businessType
                      : '-',
                  },
                  {
                    key: 'businessId',
                    label: '业务 ID',
                    children: record.businessId || '-',
                  },
                  {
                    key: 'startedAt',
                    label: '开始时间',
                    children: formatDateTime(record.startedAt),
                  },
                  {
                    key: 'answeredAt',
                    label: '接通时间',
                    children:
                      record.entryType === 'outbound_mock'
                        ? '不适用（模拟执行）'
                        : formatDateTime(record.answeredAt),
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

            {followUp ? (
              <section>
                <Title level={5}>关联跟进</Title>
                <Descriptions
                  column={1}
                  styles={detailDescriptionStyles}
                  items={[
                    {
                      key: 'followUpTask',
                      label: '所属跟进任务',
                      children: (
                        <Flex align="center" gap={8} wrap>
                          <Tag color="success">已创建跟进</Tag>
                          <Tag
                            color={
                              {
                                pending: 'gold',
                                processing: 'processing',
                                completed: 'success',
                                closed: 'default',
                              }[followUp.status] || 'default'
                            }
                          >
                            {statusLabels[followUp.status] || followUp.status}
                          </Tag>
                          <Text>{followUp.reason}</Text>
                          <Button
                            size="small"
                            type="link"
                            onClick={() =>
                              history.push(
                                `/ai-call/follow-ups?followUpId=${encodeURIComponent(
                                  followUp.id,
                                )}`,
                              )
                            }
                          >
                            查看跟进任务
                          </Button>
                        </Flex>
                      ),
                    },
                  ]}
                />
              </section>
            ) : null}

            <section>
              <Title level={5}>执行配置</Title>
              {executionConfig ? (
                <Descriptions
                  column={2}
                  styles={detailDescriptionStyles}
                  items={[
                    {
                      key: 'promptName',
                      label: '提示词',
                      children: executionConfig.promptName || '-',
                    },
                    {
                      key: 'sceneCode',
                      label: '业务场景',
                      children: describeBusinessScene(
                        executionConfig.sceneCode,
                      ),
                    },
                    {
                      key: 'voice',
                      label: '音色',
                      children: executionConfig.voiceName || '-',
                    },
                    {
                      key: 'ruleName',
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
                {detailErrors.recording ? (
                  <Alert showIcon title={detailErrors.recording} type="error" />
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
              {detailErrors.dialogue ? (
                <Alert showIcon title={detailErrors.dialogue} type="error" />
              ) : dialogue.length ? (
                renderDialogueSegments(dialogue)
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
                        key: 'disposition',
                        label: '处置结果',
                        children: (
                          <Tag
                            color={
                              afterCallWork.needsFollowUp
                                ? 'warning'
                                : 'success'
                            }
                          >
                            {dispositionLabels[afterCallWork.dispositionCode] ||
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
                        children: afterCallWork.agentIdentity,
                      },
                      {
                        key: 'submittedAt',
                        label: '提交时间',
                        children: formatDateTime(afterCallWork.submittedAt),
                      },
                    ]}
                  />
                </>
              ) : (
                <>
                  <Title level={5}>AI 分析与转人工</Title>
                  {detailErrors.analysis ? (
                    <Alert
                      showIcon
                      title={detailErrors.analysis}
                      type="error"
                    />
                  ) : analysis ? (
                    <Flex vertical gap={12}>
                      <Text>
                        分析状态：
                        {analysisStatusLabels[analysis.analysisStatus] ||
                          analysis.analysisStatus}
                      </Text>
                      {analysis.analysisError ? (
                        <Alert
                          showIcon
                          title={analysis.analysisError}
                          type="error"
                        />
                      ) : hasAnalysisResult(analysisResult) ? (
                        <>
                          <AnalysisResultDescriptions
                            analysisResult={analysisResult}
                          />
                          {needsManualFollowUpReview ? (
                            <Flex gap={8}>
                              <Button
                                loading={followUpReviewing}
                                size="small"
                                type="primary"
                                onClick={() => void reviewFollowUp('create')}
                              >
                                创建跟进
                              </Button>
                              <Popconfirm
                                cancelText="取消"
                                description="此操作不会创建跟进任务。"
                                okText="确认无需跟进"
                                title="确认无需跟进？"
                                onConfirm={() => reviewFollowUp('dismiss')}
                              >
                                <Button
                                  disabled={followUpReviewing}
                                  size="small"
                                >
                                  无需跟进
                                </Button>
                              </Popconfirm>
                            </Flex>
                          ) : null}
                          {analysis.followUpReviewStatus === 'dismissed' ? (
                            <Descriptions
                              column={1}
                              styles={detailDescriptionStyles}
                              items={[
                                {
                                  key: 'followUpReview',
                                  label: '人工确认',
                                  children: `无需跟进 · ${
                                    analysis.followUpReviewedByName ||
                                    analysis.followUpReviewedBy ||
                                    '-'
                                  } · ${formatDateTime(
                                    analysis.followUpReviewedAt,
                                  )}`,
                                },
                              ]}
                            />
                          ) : null}
                        </>
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

              {detailErrors.handoffs ? (
                <Alert showIcon title={detailErrors.handoffs} type="error" />
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
                            handoffStatusLabels[handoff.status] ||
                            handoff.status,
                        },
                        {
                          key: 'agent',
                          label: '接听坐席',
                          children: handoff.humanAgentIdentity || '-',
                        },
                        {
                          key: 'reason',
                          label: '转人工原因',
                          children: getHandoffReasonLabel(
                            handoff.requestReason,
                          ),
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
        ) : (
          <Alert
            showIcon
            title={detailErrors.detail || '通话详情加载失败'}
            type="error"
          />
        )}
      </Drawer>

      <Drawer
        title="外呼质检复核"
        open={Boolean(qualityRecord)}
        size="large"
        onClose={closeQualityReview}
      >
        {qualityLoading ? (
          <Flex justify="center">
            <Spin />
          </Flex>
        ) : qualityRecord ? (
          <Flex vertical gap={24}>
            <section>
              <Title level={5}>AI 评分</Title>
              {qualityErrors.quality ? (
                <Alert showIcon title={qualityErrors.quality} type="error" />
              ) : qualityScore ? (
                <Descriptions
                  column={1}
                  styles={detailDescriptionStyles}
                  items={[
                    {
                      key: 'score',
                      label: '评分',
                      children:
                        typeof qualityScore.score === 'number' ? (
                          <Text
                            data-testid="quality-score-value"
                            strong
                            style={{
                              color: getQualityScoreTextColor(
                                qualityScore.score,
                              ),
                            }}
                          >
                            {qualityScore.score}分
                          </Text>
                        ) : (
                          '-'
                        ),
                    },
                    {
                      key: 'status',
                      label: '评分状态',
                      children:
                        qualityScoreStatusLabels[qualityScore.status] ||
                        qualityScore.status,
                    },
                    {
                      key: 'reason',
                      label: '评分理由',
                      children: qualityScore.reason || '-',
                    },
                  ]}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无 AI 评分"
                />
              )}
            </section>

            <section>
              <Title level={5}>录音</Title>
              {qualityErrors.recording ? (
                <Alert showIcon title={qualityErrors.recording} type="error" />
              ) : qualityRecordingUrl ? (
                <div data-testid="quality-recording-player">
                  {
                    // biome-ignore lint/a11y/useMediaCaption: 质检抽屉展示完整通话对话，录音暂无独立字幕轨道。
                    <audio
                      controls
                      controlsList="nodownload"
                      preload="metadata"
                      src={qualityRecordingUrl}
                      style={{ width: '100%' }}
                    />
                  }
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无录音"
                />
              )}
            </section>

            <section>
              <Title level={5}>对话文本</Title>
              {qualityErrors.dialogue ? (
                <Alert showIcon title={qualityErrors.dialogue} type="error" />
              ) : qualityDialogue.length ? (
                renderDialogueSegments(qualityDialogue)
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无对话文本"
                />
              )}
            </section>

            <section>
              <Title level={5}>人工质检</Title>
              {!canSaveQualityReview ? (
                <Alert
                  action={
                    <Button
                      loading={qualityScoring}
                      size="small"
                      type="primary"
                      onClick={() => void scoreQuality()}
                    >
                      立即评分
                    </Button>
                  }
                  showIcon
                  title="AI 评分完成后才能复核"
                  type="info"
                  style={{ marginBottom: 12 }}
                />
              ) : null}
              {canSaveQualityReview ? (
                <Form form={qualityForm} layout="vertical">
                  <Form.Item
                    label="质检结果"
                    name="qualityResult"
                    rules={[{ required: true, message: '请选择质检结果' }]}
                  >
                    <Radio.Group
                      block
                      buttonStyle="solid"
                      options={qualityReviewOptions}
                      optionType="button"
                      size="large"
                      style={{ display: 'flex', width: '100%' }}
                    />
                  </Form.Item>
                  {selectedQualityResult === 'fail' ? (
                    <Form.Item
                      label="不合格原因"
                      name="qualityReason"
                      rules={[
                        {
                          validator: (_, value) =>
                            String(value || '').trim()
                              ? Promise.resolve()
                              : Promise.reject(new Error('请输入不合格原因')),
                        },
                      ]}
                    >
                      <Input.TextArea
                        maxLength={500}
                        placeholder="请输入不合格原因"
                        rows={3}
                        showCount
                      />
                    </Form.Item>
                  ) : null}
                  <Flex justify="end" gap={8}>
                    <Button
                      autoInsertSpace={false}
                      onClick={closeQualityReview}
                    >
                      取消
                    </Button>
                    <Button
                      autoInsertSpace={false}
                      disabled={!canSubmitQualityReview}
                      loading={qualitySaving}
                      type="primary"
                      onClick={() => void saveQualityReview()}
                    >
                      保存
                    </Button>
                  </Flex>
                </Form>
              ) : null}
            </section>
          </Flex>
        ) : null}
      </Drawer>
    </PageContainer>
  );
};

export default AiCallRecordsPage;

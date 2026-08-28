import { AuditOutlined, CheckOutlined, EditOutlined } from '@ant-design/icons';
import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { history, useSearchParams } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  message,
  Radio,
  Select,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListPage } from '@/components/ListLayout';
import {
  getHandoffReasonLabel,
  statusLabels as handoffStatusLabels,
} from '@/pages/agentWorkbench/admin/_shared';
import AfterCallResultForm, {
  type AfterCallResultValues,
} from '@/pages/agentWorkbench/components/AfterCallResultForm';
import AgentName from '@/pages/agentWorkbench/components/AgentName';
import {
  adjustFollowUpDataClassification,
  type FollowUpClassification,
  type LowValueReason,
  scheduleFollowUpData,
} from '@/pages/aiCallFollowUpData/service';
import { listAiCallTasks } from '@/pages/aiCallTasks/service';
import {
  type AttemptResult,
  submitAfterCallWork,
  submitFollowUpDataHandlingResult,
  submitFollowUpHandlingResult,
} from '@/services/ruoyi/agent-console';
import AnalysisResultDescriptions, {
  describeBusinessScene,
  describeEndReason,
  formatAnalysisSummary,
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
  reviewAiCallRecordClassification,
  saveAiCallRecordQualityReview,
  scoreAiCallRecordQuality,
} from './service';
import {
  getClassificationReviewPresentation,
  getCustomerIntentPresentation,
  getFollowUpPresentation,
  getQualityReviewPresentation,
  getQualityScorePresentation,
  hasUnstablePostCallData,
  isFormalOutboundRecord,
  resolveCallResult,
  type StatusPresentation,
} from './status';
import './index.less';

const { Paragraph, Text, Title } = Typography;

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
  busy: '忙线',
  rejected: '电话拒接',
  early_hangup: '主动挂断（≤5秒）',
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

const unansweredCallResults = new Set([
  'no_answer',
  'busy',
  'rejected',
  'call_failed',
  'invalid_number',
]);

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

const classificationLabels: Record<FollowUpClassification, string> = {
  interested: '有意向',
  nurturing: '持续跟进',
  low_value: '低价值',
  converted: '已转化',
};

const lowValueReasonLabels: Record<LowValueReason, string> = {
  explicit_rejection: '明确拒绝',
  no_current_need: '暂无需求',
  customer_mismatch: '客户不匹配',
  non_target_customer: '非目标客户',
  invalid_contact: '联系方式无效',
  other: '其他',
};

const reviewableClassifications = new Set<FollowUpClassification>([
  'interested',
  'nurturing',
  'low_value',
]);

const lowValueReasons = new Set<LowValueReason>(
  Object.keys(lowValueReasonLabels) as LowValueReason[],
);

const createIdempotencyKey = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ||
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getAiClassification = (
  result: Record<string, unknown>,
): FollowUpClassification | undefined => {
  const value = result.classification as FollowUpClassification | undefined;
  return value && reviewableClassifications.has(value) ? value : undefined;
};

const getAiLowValueReason = (
  result: Record<string, unknown>,
): LowValueReason | undefined => {
  const value = result.low_value_reason as LowValueReason | undefined;
  return value && lowValueReasons.has(value) ? value : undefined;
};

const afterCallResultStatusLabels = {
  pending: { color: 'processing', text: '待提交' },
  submitted: { color: 'success', text: '已提交' },
  not_applicable: { color: 'default', text: '不适用' },
} as const;

const attemptResults = new Set<AttemptResult>([
  'connected',
  'no_answer',
  'busy',
  'rejected',
  'invalid_contact',
  'technical_failure',
]);

const getAfterCallContactResult = (record: AiCallRecord): AttemptResult => {
  if (record.afterCallResultType === 'handoff') return 'connected';
  if (attemptResults.has(record.callResult as AttemptResult)) {
    return record.callResult as AttemptResult;
  }
  return record.status === 'failed' ? 'technical_failure' : 'connected';
};

const getAfterCallRemark = (record: AiCallRecord, result: AttemptResult) => {
  if (record.failureMessage) return record.failureMessage;
  if (result === 'no_answer') return '本次回拨未接通';
  if (result === 'technical_failure') return '本次回拨技术失败：';
  return result === 'connected' ? '' : `本次回拨${callResultLabels[result]}`;
};

const qualityReviewOptions: Array<{
  description: string;
  label: string;
  value: QualityReviewResult;
}> = [
  {
    description: '明显超出质检标准',
    label: '优秀',
    value: 'excellent',
  },
  { description: '整体准确，略有瑕疵', label: '良好', value: 'good' },
  { description: '达到基本质检要求', label: '合格', value: 'pass' },
  { description: '存在明显问题', label: '不合格', value: 'fail' },
];

const canOpenQualityReview = (row: AiCallRecord) =>
  isFormalOutboundRecord(row) && row.callResult === 'connected';

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
  (row.failureMessage ? describeEndReason(row.failureMessage) : undefined) ||
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
    : callResultLabels[resolveCallResult(row) || ''] || '-';

const describeEndResult = (row: AiCallRecord) =>
  row.entryType === 'outbound_mock' ? '-' : describeError(row);

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

type ClassificationReviewFormValues = {
  classification: FollowUpClassification;
  lowValueReason?: LowValueReason;
  reason: string;
};

type ScheduleFollowUpFormValues = {
  followUpReason: string;
  nextFollowUpAt: Dayjs;
};

const AiCallRecordsPage = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [qualityForm] = Form.useForm<QualityReviewFormValues>();
  const [classificationForm] = Form.useForm<ClassificationReviewFormValues>();
  const [scheduleForm] = Form.useForm<ScheduleFollowUpFormValues>();
  const selectedQualityResult = Form.useWatch('qualityResult', qualityForm);
  const selectedQualityReason = Form.useWatch('qualityReason', qualityForm);
  const selectedClassification = Form.useWatch(
    'classification',
    classificationForm,
  );
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
  const [classificationReviewing, setClassificationReviewing] = useState(false);
  const [classificationModalOpen, setClassificationModalOpen] = useState(false);
  const [classificationReviewKey, setClassificationReviewKey] = useState('');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleKey, setScheduleKey] = useState('');
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
    setClassificationReviewing(false);
    setClassificationModalOpen(false);
    setScheduleModalOpen(false);
    classificationForm.resetFields();
    scheduleForm.resetFields();
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
    setClassificationReviewKey(createIdempotencyKey('classification-review'));
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

  const submitPendingAfterCallResult = async (
    values: AfterCallResultValues,
  ) => {
    const pendingRecord = detail?.record;
    if (!pendingRecord || pendingRecord.afterCallResultStatus !== 'pending') {
      throw new Error('该通话已无需提交话后结果');
    }
    const expectedVersion = detail.followUpData?.version ?? 0;
    if (pendingRecord.afterCallResultType === 'handoff') {
      const handoff =
        handoffs.find(
          (item) =>
            item.humanAgentIdentity === pendingRecord.operatorAgentIdentity,
        ) || handoffs[0];
      if (!handoff) throw new Error('转人工记录尚未同步，请稍后重试');
      if (!values.classification || values.classification === 'converted') {
        throw new Error('请选择有意向、持续跟进或低价值');
      }
      if (values.lowValueReason === 'invalid_contact') {
        throw new Error('已接通时不能选择联系方式无效');
      }
      await submitAfterCallWork(pendingRecord.callId, {
        handoffId: handoff.handoffId,
        classification: values.classification,
        lowValueReason: values.lowValueReason,
        conclusion: values.conclusion || '',
        scheduleFollowUp: values.scheduleFollowUp,
        nextFollowUpAt: values.nextFollowUpAt,
        expectedVersion,
        idempotencyKey: `after-call-result:${pendingRecord.callId}`,
      });
    } else if (pendingRecord.afterCallResultType === 'follow_up') {
      if (!detail.followUp?.id) throw new Error('关联回访任务不存在');
      await submitFollowUpHandlingResult(detail.followUp.id, {
        callId: pendingRecord.callId,
        contactResult: getAfterCallContactResult(pendingRecord),
        remark: values.remark,
        classification: values.classification,
        lowValueReason: values.lowValueReason,
        conclusion: values.conclusion,
        scheduleFollowUp: values.scheduleFollowUp,
        nextFollowUpAt: values.nextFollowUpAt,
        expectedVersion,
        idempotencyKey: `follow-up-handling:${pendingRecord.callId}`,
      });
    } else {
      const followUpDataId =
        detail.followUpData?.id || pendingRecord.followUpDataId;
      if (!followUpDataId) throw new Error('关联跟进数据不存在');
      await submitFollowUpDataHandlingResult(followUpDataId, {
        callId: pendingRecord.callId,
        contactResult: getAfterCallContactResult(pendingRecord),
        remark: values.remark,
        classification: values.classification,
        lowValueReason: values.lowValueReason,
        conclusion: values.conclusion,
        scheduleFollowUp: values.scheduleFollowUp,
        nextFollowUpAt: values.nextFollowUpAt,
        expectedVersion,
        idempotencyKey: `follow-up-data-handling:${pendingRecord.callId}`,
      });
    }
    message.success('话后结果已提交');
    await Promise.all([
      openDetail(pendingRecord.callId),
      Promise.resolve(actionRef.current?.reload?.()),
    ]);
  };

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

  const submitClassificationReview = async (
    values: ClassificationReviewFormValues,
  ) => {
    if (!selectedCallId || !detail?.followUpData) return;
    setClassificationReviewing(true);
    try {
      const result = analysis?.analysisResult || {};
      const canReviewAiClassification = Boolean(
        analysis?.analysisStatus === '2' &&
          analysis.classificationReviewStatus !== 'reviewed' &&
          getAiClassification(result) &&
          String(result.reason || '').trim(),
      );
      const input = {
        classification: values.classification,
        reason: values.reason.trim(),
        lowValueReason:
          values.classification === 'low_value'
            ? values.lowValueReason
            : undefined,
        expectedVersion: detail.followUpData.version,
        idempotencyKey: classificationReviewKey,
      };
      if (canReviewAiClassification) {
        await reviewAiCallRecordClassification(selectedCallId, input);
      } else {
        await adjustFollowUpDataClassification(detail.followUpData.id, {
          ...input,
          conclusion: detail.followUpData.latestConclusion || input.reason,
        });
      }
      message.success(
        canReviewAiClassification ? '分类复核已提交' : '客户分类已修改',
      );
      setClassificationModalOpen(false);
      await openDetail(selectedCallId);
      await Promise.resolve(actionRef.current?.reload?.());
    } catch {
      await Promise.allSettled([
        openDetail(selectedCallId),
        Promise.resolve(actionRef.current?.reload?.()),
      ]);
      message.error('分类复核失败，已刷新最新状态');
    } finally {
      setClassificationReviewing(false);
    }
  };

  const adoptAiClassification = async () => {
    const result = analysis?.analysisResult || {};
    const classification = getAiClassification(result);
    const reason = String(result.reason || '').trim();
    const lowValueReason = getAiLowValueReason(result);
    if (!classification || !reason) return;
    if (classification === 'low_value' && !lowValueReason) {
      classificationForm.setFieldsValue({ classification, reason });
      setClassificationModalOpen(true);
      message.warning('请先补充低价值原因');
      return;
    }
    await submitClassificationReview({
      classification,
      reason,
      lowValueReason,
    });
  };

  const retainCurrentClassification = async () => {
    const followUpData = detail?.followUpData;
    const classification = followUpData?.classification;
    if (!followUpData || !classification) return;
    const lowValueReason = lowValueReasons.has(
      followUpData.lowValueReason as LowValueReason,
    )
      ? (followUpData.lowValueReason as LowValueReason)
      : undefined;
    if (classification === 'low_value' && !lowValueReason) {
      openClassificationReview();
      message.warning('请先补充低价值原因');
      return;
    }
    await submitClassificationReview({
      classification,
      lowValueReason,
      reason: '人工复核后保留当前业务分类。',
    });
  };

  const openClassificationReview = () => {
    const result = analysis?.analysisResult || {};
    const current = detail?.followUpData?.classification || undefined;
    const currentLowValueReason = lowValueReasons.has(
      detail?.followUpData?.lowValueReason as LowValueReason,
    )
      ? (detail?.followUpData?.lowValueReason as LowValueReason)
      : undefined;
    classificationForm.setFieldsValue({
      classification: current || getAiClassification(result),
      lowValueReason:
        current === 'low_value'
          ? currentLowValueReason
          : getAiLowValueReason(result),
      reason:
        detail?.followUpData?.latestConclusion ||
        String(result.reason || '').trim(),
    });
    setClassificationModalOpen(true);
  };

  const openSchedule = () => {
    scheduleForm.resetFields();
    setScheduleKey(createIdempotencyKey('schedule-follow-up'));
    setScheduleModalOpen(true);
  };

  const submitSchedule = async () => {
    if (!detail?.followUpData) return;
    const values = await scheduleForm.validateFields();
    setScheduleSubmitting(true);
    try {
      await scheduleFollowUpData(detail.followUpData.id, {
        followUpReason: values.followUpReason.trim(),
        nextFollowUpAt: values.nextFollowUpAt.toISOString(),
        expectedVersion: detail.followUpData.version,
        idempotencyKey: scheduleKey,
      });
      message.success('回访已安排');
      setScheduleModalOpen(false);
      await Promise.all([
        openDetail(detail.record.callId),
        Promise.resolve(actionRef.current?.reload?.()),
      ]);
    } catch {
      message.error('回访安排失败，请保留当前内容后重试');
    } finally {
      setScheduleSubmitting(false);
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
        title: '分类复核状态',
        dataIndex: 'classificationReviewStatus',
        valueType: 'select',
        valueEnum: {
          suggested: { text: '建议复核' },
          reviewed: { text: '已复核' },
        },
        hideInTable: true,
      },
      {
        title: '回访任务状态',
        dataIndex: 'followUpStatus',
        valueType: 'select',
        valueEnum: {
          none: { text: '未安排' },
          pending: { text: '待处理' },
          processing: { text: '处理中' },
          completed: { text: '已完成' },
          closed: { text: '已关闭' },
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
        title: '任务名称',
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
        render: (_, row) => {
          const failureReason = describeError(row);
          const callResult = resolveCallResult(row);
          return (
            <Flex vertical gap={4}>
              <Text
                strong
                style={{
                  color:
                    row.entryType === 'outbound_mock'
                      ? '#1677ff'
                      : callResultColors[callResult || ''] || '#1f1f1f',
                }}
              >
                {describeCallResult(row)}
              </Text>
              <Text type="secondary">
                {getEntryTypeLabel(row)}
                {row.entryType !== 'sip_callback' && row.attemptNo
                  ? ` · 第 ${row.attemptNo} 次`
                  : ''}
              </Text>
              {callResult !== 'connected' && failureReason !== '-' ? (
                <Tooltip title={failureReason}>
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {`原因：${failureReason}`}
                  </Text>
                </Tooltip>
              ) : null}
            </Flex>
          );
        },
      },
      {
        title: '通话摘要',
        key: 'analysis',
        search: false,
        width: 240,
        render: (_, row) => {
          const summary = formatAnalysisSummary(row.summary);
          return (
            <Tooltip placement="topLeft" title={summary || undefined}>
              <Paragraph
                ellipsis={{ rows: 2 }}
                type={summary ? undefined : 'secondary'}
                style={{ marginBottom: 0 }}
              >
                {summary || '暂无摘要'}
              </Paragraph>
            </Tooltip>
          );
        },
      },
      {
        title: '通话时间',
        dataIndex: 'startedAt',
        search: false,
        width: 176,
        render: (_, row) => (
          <Flex vertical gap={2}>
            <Text>{formatDateTime(row.startedAt)}</Text>
            <Text type="secondary">{formatDuration(row.durationMs)}</Text>
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
        title: '分类复核',
        key: 'classificationReviewDisplay',
        search: false,
        width: 104,
        render: (_, row) =>
          renderPostCallStatus(
            getClassificationReviewPresentation(row),
            () => void openDetail(row.callId),
          ),
      },
      {
        title: '回访任务',
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
        title: '话后结果',
        dataIndex: 'afterCallResultStatus',
        valueType: 'select',
        width: 104,
        valueEnum: Object.fromEntries(
          Object.entries(afterCallResultStatusLabels).map(([value, meta]) => [
            value,
            { text: meta.text },
          ]),
        ),
        render: (_, row) => {
          const meta = row.afterCallResultStatus
            ? afterCallResultStatusLabels[row.afterCallResultStatus]
            : undefined;
          return meta && row.afterCallResultStatus !== 'not_applicable' ? (
            <Tag color={meta.color}>{meta.text}</Tag>
          ) : (
            <Text type="secondary">-</Text>
          );
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
        width: 176,
        render: (_, row) => {
          if (!canOpenQualityReview(row)) {
            return <Text type="secondary">-</Text>;
          }
          const presentation = getQualityReviewPresentation(
            row.qualityReviewResult,
          );
          const actionLabel = presentation ? '修改复核' : '复核';
          return (
            <Flex vertical align="flex-start" gap={4}>
              <Flex align="center" gap={4}>
                {presentation ? (
                  renderPostCallStatus(presentation)
                ) : (
                  <Tag color="warning" style={{ marginInlineEnd: 0 }}>
                    未复核
                  </Tag>
                )}
                <Tooltip title={actionLabel}>
                  <Button
                    aria-label={actionLabel}
                    icon={presentation ? <EditOutlined /> : <AuditOutlined />}
                    size="small"
                    type="text"
                    onClick={() => void openQualityReview(row)}
                  />
                </Tooltip>
              </Flex>
              {row.qualityReviewResult === 'fail' && row.qualityReviewReason ? (
                <Tooltip title={row.qualityReviewReason}>
                  <Text
                    type="danger"
                    style={{
                      display: '-webkit-box',
                      fontSize: 12,
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                    }}
                  >
                    原因：{row.qualityReviewReason}
                  </Text>
                </Tooltip>
              ) : null}
            </Flex>
          );
        },
      },
      {
        title: '操作',
        key: 'option',
        valueType: 'option',
        fixed: 'right',
        width: 120,
        render: (_, row) => {
          return (
            <Flex gap={4}>
              <Button
                size="small"
                type="link"
                onClick={() => void openDetail(row.callId)}
              >
                {row.afterCallResultStatus === 'pending'
                  ? '提交话后结果'
                  : '查看详情'}
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
  const resolvedCallResult = record ? resolveCallResult(record) : undefined;
  const connectedCall = Boolean(
    record?.answeredAt && resolvedCallResult === 'connected',
  );
  const failedBeforeAnswer = Boolean(
    record &&
      !record.answeredAt &&
      unansweredCallResults.has(resolvedCallResult || ''),
  );
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
  const exceptionHandling = detail?.exceptionHandling;
  const afterCallWork = detail?.afterCallWork;
  const followUp = detail?.followUp;
  const currentClassification = detail?.followUpData?.classification;
  const analysisResult = analysis?.analysisResult || {};
  const aiClassification = getAiClassification(analysisResult);
  const needsClassificationReview = Boolean(
    detail?.followUpData &&
      aiClassification &&
      analysis?.classificationRequiresReview,
  );
  const classificationConflict = Boolean(
    currentClassification &&
      aiClassification &&
      currentClassification !== aiClassification &&
      analysis?.classificationReviewStatus !== 'reviewed',
  );
  const classificationReviewPrompt = classificationConflict
    ? 'AI 建议分类与当前业务分类不一致，请在下方保留、采纳或修改分类，完成人工复核。'
    : analysisResult.evidence_conflict === true
      ? 'AI 分类与当前业务分类一致，但分类依据与对话证据存在冲突，请确认当前分类或修改分类，完成人工复核。'
      : 'AI 分类与当前业务分类一致，但分类置信度较低，请确认当前分类或修改分类，完成人工复核。';
  const activeFollowUpId =
    detail?.followUpData?.activeFollowUpId ||
    (followUp?.status === 'pending' || followUp?.status === 'processing'
      ? followUp.id
      : undefined);
  const activeFollowUpShownAbove = Boolean(
    activeFollowUpId && followUp?.id === activeFollowUpId,
  );
  const canScheduleFollowUp = Boolean(
    connectedCall &&
      detail?.followUpData &&
      !detailErrors.analysis &&
      !needsClassificationReview &&
      !activeFollowUpId &&
      ['interested', 'nurturing'].includes(
        detail.followUpData.classification || '',
      ),
  );
  return (
    <ListPage title="通话记录">
      <ProTable<AiCallRecord>
        className="recov-stable-pagination-table"
        actionRef={actionRef}
        rowKey="callId"
        columns={columns}
        search={{ labelWidth: 104 }}
        scroll={{ x: 1748 }}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
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
                    label: '处理状态',
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
                    label:
                      resolvedCallResult === 'connected'
                        ? '通话时长'
                        : '呼叫耗时',
                    children: formatDuration(record.durationMs),
                  },
                  {
                    key: 'callResult',
                    label: '呼叫结果',
                    children: resolvedCallResult ? (
                      <Tag color={callResultColors[resolvedCallResult]}>
                        {describeCallResult(record)}
                      </Tag>
                    ) : (
                      '-'
                    ),
                    span: 2,
                  },
                  {
                    key: 'endResult',
                    label: '结束原因',
                    children: describeEndResult(record),
                    span: 2,
                  },
                ]}
              />
            </section>

            {record.afterCallResultStatus === 'pending' ? (
              <section>
                <Title level={5}>待提交话后结果</Title>
                <Alert
                  type="warning"
                  showIcon
                  title="本次人工通话已结束，请核对下方录音、对话和历史后提交结果。"
                  style={{ marginBottom: 16 }}
                />
                <AfterCallResultForm
                  key={record.callId}
                  contactResult={getAfterCallContactResult(record)}
                  currentClassification={
                    record.afterCallResultType === 'handoff' &&
                    detail.followUpData?.classification === 'converted'
                      ? undefined
                      : detail.followUpData?.classification
                  }
                  conclusionDraft={record.summary || undefined}
                  includeConverted={record.afterCallResultType !== 'handoff'}
                  includeInvalidContactReason={false}
                  initialRemark={getAfterCallRemark(
                    record,
                    getAfterCallContactResult(record),
                  )}
                  submitText="提交话后结果"
                  onSubmit={submitPendingAfterCallResult}
                />
              </section>
            ) : null}

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
                                `/ai-call/follow-up-overview?followUpId=${encodeURIComponent(
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
                    ...(exceptionHandling
                      ? [
                          {
                            key: 'exceptionStatus',
                            label: '异常处理状态',
                            children:
                              {
                                PENDING: '待重呼',
                                WAITING: '等待执行',
                                CALLING: '重呼中',
                                CONNECTED: '已接通',
                                MAXED: '已达上限',
                                UNAVAILABLE: '不可重呼',
                                STOPPED: '已停止',
                              }[exceptionHandling.status] ||
                              exceptionHandling.status,
                          },
                          {
                            key: 'exceptionProgress',
                            label: '异常重呼进度',
                            children: `${exceptionHandling.retryCount}/${exceptionHandling.maxRetryCount}`,
                          },
                          {
                            key: 'exceptionLastResult',
                            label: '异常处理最后结果',
                            children:
                              callResultLabels[
                                exceptionHandling.lastResult || ''
                              ] ||
                              exceptionHandling.lastResult ||
                              '-',
                          },
                        ]
                      : []),
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
                ) : failedBeforeAnswer ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="未接通，无有效通话录音"
                  />
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

            {afterCallWork ? (
              <section>
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
                            afterCallWork.needsFollowUp ? 'warning' : 'success'
                          }
                        >
                          {(afterCallWork.classification &&
                            classificationLabels[
                              afterCallWork.classification
                            ]) ||
                            dispositionLabels[
                              afterCallWork.dispositionCode || ''
                            ] ||
                            afterCallWork.classification ||
                            afterCallWork.dispositionCode ||
                            '-'}
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
                      key: 'submittedAt',
                      label: '提交时间',
                      children: formatDateTime(afterCallWork.submittedAt),
                    },
                  ]}
                />
              </section>
            ) : null}

            <section
              data-testid="customer-follow-up-section"
              hidden={!connectedCall}
            >
              <Title level={5}>客户分类与回访</Title>
              <Flex vertical gap={12}>
                <Descriptions
                  column={2}
                  styles={detailDescriptionStyles}
                  items={[
                    {
                      key: 'currentClassification',
                      label: '当前业务分类',
                      children: currentClassification ? (
                        <Tag>{classificationLabels[currentClassification]}</Tag>
                      ) : (
                        <Text type="secondary">未分类</Text>
                      ),
                    },
                    {
                      key: 'aiClassification',
                      label: 'AI 建议分类',
                      children: aiClassification ? (
                        <Tag color="purple">
                          {classificationLabels[aiClassification]}
                        </Tag>
                      ) : (
                        <Text type="secondary">暂无建议</Text>
                      ),
                    },
                    ...(!activeFollowUpShownAbove
                      ? [
                          {
                            key: 'activeFollowUp',
                            label: '当前回访任务',
                            children: activeFollowUpId ? (
                              <Tag color="processing">
                                {statusLabels[
                                  detail?.followUpData?.activeFollowUpStatus ||
                                    followUp?.status ||
                                    ''
                                ] || '已安排'}
                              </Tag>
                            ) : (
                              <Text type="secondary">未安排</Text>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
                {analysis?.classificationReviewStatus === 'reviewed' ? (
                  <Descriptions
                    column={1}
                    styles={detailDescriptionStyles}
                    items={[
                      {
                        key: 'classificationReview',
                        label: '分类复核',
                        children: `${
                          analysis.followUpReviewStatus === 'confirmed'
                            ? `已确认分类：${
                                aiClassification
                                  ? classificationLabels[aiClassification]
                                  : currentClassification
                                    ? classificationLabels[
                                        currentClassification
                                      ]
                                    : '-'
                              }`
                            : `已确认最终分类：${
                                currentClassification
                                  ? classificationLabels[currentClassification]
                                  : '-'
                              }`
                        } · ${
                          analysis.followUpReviewedByName ||
                          analysis.followUpReviewedBy ||
                          '-'
                        } · ${formatDateTime(analysis.followUpReviewedAt)}`,
                      },
                    ]}
                  />
                ) : null}
                {needsClassificationReview ? (
                  <Alert
                    showIcon
                    title={classificationReviewPrompt}
                    type="warning"
                  />
                ) : null}
                {detail?.followUpData ? (
                  <Flex wrap gap={8}>
                    {needsClassificationReview ? (
                      <>
                        {classificationConflict ? (
                          <Button
                            color="primary"
                            loading={classificationReviewing}
                            size="small"
                            variant="outlined"
                            onClick={() => void retainCurrentClassification()}
                          >
                            保留当前分类
                          </Button>
                        ) : null}
                        <Button
                          color="primary"
                          disabled={classificationReviewing}
                          size="small"
                          variant="outlined"
                          onClick={() => void adoptAiClassification()}
                        >
                          {classificationConflict
                            ? '采纳 AI 分类'
                            : '确认当前分类'}
                        </Button>
                      </>
                    ) : null}
                    <Button
                      aria-label="修改分类"
                      color="primary"
                      disabled={classificationReviewing}
                      size="small"
                      variant="outlined"
                      onClick={openClassificationReview}
                    >
                      修改分类
                    </Button>
                    {activeFollowUpId ? (
                      activeFollowUpShownAbove ? null : (
                        <Button
                          size="small"
                          onClick={() =>
                            history.push(
                              `/ai-call/follow-up-overview?followUpId=${encodeURIComponent(activeFollowUpId)}`,
                            )
                          }
                        >
                          查看回访任务
                        </Button>
                      )
                    ) : canScheduleFollowUp ? (
                      <Button size="small" onClick={openSchedule}>
                        安排回访
                      </Button>
                    ) : null}
                  </Flex>
                ) : null}
              </Flex>
            </section>

            <section data-testid="analysis-result-section">
              <Title level={5}>AI 分析结果</Title>
              {detailErrors.analysis ? (
                <Alert showIcon title={detailErrors.analysis} type="error" />
              ) : analysis ? (
                <Flex vertical gap={12}>
                  <Descriptions
                    column={1}
                    styles={detailDescriptionStyles}
                    items={[
                      {
                        key: 'analysisStatus',
                        label: '分析状态',
                        children: (
                          <Tag>
                            {analysisStatusLabels[analysis.analysisStatus] ||
                              analysis.analysisStatus}
                          </Tag>
                        ),
                      },
                    ]}
                  />
                  {analysis.analysisError ? (
                    <Alert
                      showIcon
                      title={analysis.analysisError}
                      type="error"
                    />
                  ) : hasAnalysisResult(analysisResult) ? (
                    <AnalysisResultDescriptions
                      analysisResult={analysisResult}
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
            </section>

            <section data-testid="handoff-result-section">
              <Title level={5}>转人工结果</Title>
              {detailErrors.handoffs ? (
                <Alert showIcon title={detailErrors.handoffs} type="error" />
              ) : handoffs.length ? (
                <Flex data-testid="handoff-details" vertical gap={8}>
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
                          children: (
                            <AgentName identity={handoff.humanAgentIdentity} />
                          ),
                        },
                        {
                          key: 'reason',
                          label: '转人工原因',
                          children: getHandoffReasonLabel(
                            handoff.requestReason,
                          ),
                          span: 2,
                        },
                        ...(handoff.failureMessage
                          ? [
                              {
                                key: 'failureMessage',
                                label: '失败原因',
                                children: handoff.failureMessage,
                                span: 2,
                              },
                            ]
                          : []),
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

      <Modal
        title="修改分类"
        open={classificationModalOpen}
        confirmLoading={classificationReviewing}
        okText="确认修改"
        onCancel={() => setClassificationModalOpen(false)}
        onOk={async () => {
          const values = await classificationForm.validateFields();
          if (values.classification === 'converted') {
            Modal.confirm({
              title: '确认客户已转化？',
              content: '确认后将完成已有回访任务，请核对业务事实。',
              okText: '确认已转化',
              cancelText: '取消',
              onOk: () => submitClassificationReview(values),
            });
            return;
          }
          await submitClassificationReview(values);
        }}
      >
        <Form form={classificationForm} layout="vertical">
          <Form.Item
            label="客户分类"
            name="classification"
            rules={[{ required: true, message: '请选择客户分类' }]}
          >
            <Select
              options={Object.entries(classificationLabels).map(
                ([value, label]) => ({ value, label }),
              )}
            />
          </Form.Item>
          {selectedClassification === 'low_value' ? (
            <Form.Item
              label="低价值原因"
              name="lowValueReason"
              rules={[{ required: true, message: '请选择低价值原因' }]}
            >
              <Select
                options={Object.entries(lowValueReasonLabels).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
            </Form.Item>
          ) : null}
          <Form.Item
            label="分类原因"
            name="reason"
            rules={[
              { required: true, whitespace: true, message: '请填写分类原因' },
            ]}
          >
            <Input.TextArea
              maxLength={500}
              placeholder="说明本次分类判断依据"
              rows={4}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="安排回访"
        open={scheduleModalOpen}
        confirmLoading={scheduleSubmitting}
        okText="确认安排"
        onCancel={() => setScheduleModalOpen(false)}
        onOk={submitSchedule}
      >
        <Form form={scheduleForm} layout="vertical">
          <Form.Item
            label="回访原因"
            name="followUpReason"
            rules={[
              { required: true, whitespace: true, message: '请填写回访原因' },
            ]}
          >
            <Input.TextArea
              maxLength={500}
              placeholder="说明本次安排回访的目标或依据"
              rows={3}
              showCount
            />
          </Form.Item>
          <Form.Item
            label="计划回访时间"
            name="nextFollowUpAt"
            rules={[{ required: true, message: '请选择计划回访时间' }]}
          >
            <DatePicker
              showTime
              style={{ width: '100%' }}
              disabledDate={(current) => current.endOf('day').isBefore(dayjs())}
            />
          </Form.Item>
        </Form>
      </Modal>

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
                    <Radio.Group className="ai-call-quality-review-options">
                      {qualityReviewOptions.map((option) => (
                        <Radio.Button
                          aria-label={`${option.label}：${option.description}`}
                          className={`ai-call-quality-review-option ai-call-quality-review-option--${option.value}`}
                          key={option.value}
                          value={option.value}
                        >
                          <span className="ai-call-quality-review-option-copy">
                            <span className="ai-call-quality-review-option-title">
                              {option.label}
                            </span>
                            <span className="ai-call-quality-review-option-description">
                              {option.description}
                            </span>
                          </span>
                          <CheckOutlined className="ai-call-quality-review-option-check" />
                        </Radio.Button>
                      ))}
                    </Radio.Group>
                  </Form.Item>
                  {selectedQualityResult === 'fail' ? (
                    <Form.Item
                      label="不合格原因"
                      name="qualityReason"
                      required
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
    </ListPage>
  );
};

export default AiCallRecordsPage;

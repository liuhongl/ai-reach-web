import type { AiCallRecord } from './service';

export type StatusPresentation = {
  text: string;
  color: string;
  tooltip: string;
  target: 'record' | 'follow_up' | null;
};

const customerIntentPresentations = {
  positive: {
    text: '正向',
    color: 'success',
    tooltip: 'AI 语义分析判断客户意向为正向',
    target: 'record',
  },
  neutral: {
    text: '中性',
    color: 'processing',
    tooltip: 'AI 语义分析判断客户意向为中性',
    target: 'record',
  },
  negative: {
    text: '负向',
    color: 'error',
    tooltip: 'AI 语义分析判断客户意向为负向',
    target: 'record',
  },
} as const satisfies Record<string, StatusPresentation>;

const analysisPresentations = {
  '0': {
    text: '待分析',
    color: 'default',
    tooltip: '通话已进入语义分析队列',
    target: 'record',
  },
  '1': {
    text: '分析中',
    color: 'processing',
    tooltip: '正在生成通话摘要和客户意向',
    target: 'record',
  },
  '3': {
    text: '分析失败',
    color: 'error',
    tooltip: '语义分析未完成，可进入详情查看失败原因',
    target: 'record',
  },
} as const satisfies Record<string, StatusPresentation>;

const followUpPresentations = {
  pending: {
    text: '待处理',
    color: 'warning',
    tooltip: '已生成正式跟进任务，等待坐席领取',
    target: 'follow_up',
  },
  processing: {
    text: '处理中',
    color: 'processing',
    tooltip: '正式跟进任务正在处理',
    target: 'follow_up',
  },
  completed: {
    text: '已完成',
    color: 'success',
    tooltip: '正式跟进任务已完成',
    target: 'follow_up',
  },
  closed: {
    text: '已关闭',
    color: 'default',
    tooltip: '正式跟进任务已关闭',
    target: 'follow_up',
  },
} as const satisfies Record<string, StatusPresentation>;

const qualityScorePresentations = {
  pending: {
    text: '待评分',
    color: 'default',
    tooltip: '录音和转写准备好后，系统会自动评分',
    target: null,
  },
  processing: {
    text: '评分中',
    color: 'processing',
    tooltip: 'AI 正在生成本次外呼评分',
    target: null,
  },
  failed: {
    text: '评分失败',
    color: 'error',
    tooltip: 'AI 评分失败，系统会自动重试',
    target: null,
  },
} as const satisfies Record<string, StatusPresentation>;

const qualityReviewPresentations = {
  excellent: {
    text: '优秀',
    color: 'purple',
    tooltip: '质检员认为 AI 评分非常准确',
    target: null,
  },
  good: {
    text: '良好',
    color: 'blue',
    tooltip: '质检员认为 AI 评分基本准确',
    target: null,
  },
  pass: {
    text: '合格',
    color: 'success',
    tooltip: '质检员认为 AI 评分可接受',
    target: null,
  },
  fail: {
    text: '不合格',
    color: 'error',
    tooltip: '质检员认为 AI 评分存在明显问题',
    target: null,
  },
} as const satisfies Record<string, StatusPresentation>;

export const isFormalOutboundRecord = (
  record: Pick<AiCallRecord, 'entryType' | 'taskId'>,
) =>
  record.entryType === 'outbound' ||
  record.entryType === 'sip_outbound' ||
  (record.entryType === 'web' && Boolean(record.taskId));

export const getCustomerIntentPresentation = (
  record: Pick<
    AiCallRecord,
    'entryType' | 'taskId' | 'analysisStatus' | 'customerIntent'
  >,
): StatusPresentation | null => {
  if (!isFormalOutboundRecord(record) || record.analysisStatus === '4') {
    return null;
  }
  if (record.analysisStatus && record.analysisStatus in analysisPresentations) {
    return analysisPresentations[
      record.analysisStatus as keyof typeof analysisPresentations
    ];
  }
  if (
    record.analysisStatus === '2' &&
    record.customerIntent &&
    record.customerIntent in customerIntentPresentations
  ) {
    return customerIntentPresentations[record.customerIntent];
  }
  return null;
};

export const getFollowUpPresentation = (
  record: Pick<
    AiCallRecord,
    | 'entryType'
    | 'taskId'
    | 'followUpId'
    | 'followUpStatus'
  >,
): StatusPresentation | null => {
  if (!isFormalOutboundRecord(record)) {
    return null;
  }
  if (record.followUpId) {
    if (
      record.followUpStatus &&
      record.followUpStatus in followUpPresentations
    ) {
      return followUpPresentations[record.followUpStatus];
    }
    return {
      text: '状态异常',
      color: 'error',
      tooltip: '跟进任务已关联，但缺少可识别的任务状态',
      target: null,
    };
  }
  if (record.followUpStatus) {
    return {
      text: '状态异常',
      color: 'error',
      tooltip: '存在跟进任务状态，但缺少任务标识',
      target: null,
    };
  }
  return null;
};

export const getClassificationReviewPresentation = (
  record: Pick<
    AiCallRecord,
    'entryType' | 'taskId' | 'classificationReviewStatus'
  >,
): StatusPresentation | null => {
  if (!isFormalOutboundRecord(record)) return null;
  if (record.classificationReviewStatus === 'suggested') {
    return {
      text: '建议复核',
      color: 'warning',
      tooltip: '本次 AI 分类置信度较低或证据存在冲突，可人工复核',
      target: 'record',
    };
  }
  if (record.classificationReviewStatus === 'reviewed') {
    return {
      text: '已复核',
      color: 'success',
      tooltip: '本次 AI 分类已经人工确认或修改',
      target: 'record',
    };
  }
  return null;
};

export const getQualityScorePresentation = (
  record: Pick<
    AiCallRecord,
    'entryType' | 'taskId' | 'qualityScoreStatus' | 'qualityScore'
  >,
): StatusPresentation | null => {
  if (!isFormalOutboundRecord(record)) {
    return null;
  }
  if (record.qualityScoreStatus === 'completed') {
    return {
      text:
        typeof record.qualityScore === 'number'
          ? `${record.qualityScore}分`
          : '已评分',
      color: 'success',
      tooltip: 'AI 根据录音和通话转写自动评分，点击复核查看评分理由',
      target: null,
    };
  }
  if (
    record.qualityScoreStatus &&
    record.qualityScoreStatus in qualityScorePresentations
  ) {
    return qualityScorePresentations[
      record.qualityScoreStatus as keyof typeof qualityScorePresentations
    ];
  }
  return null;
};

export const getQualityReviewPresentation = (
  result: AiCallRecord['qualityReviewResult'],
): StatusPresentation | null => {
  if (!result || !(result in qualityReviewPresentations)) {
    return null;
  }
  return qualityReviewPresentations[
    result as keyof typeof qualityReviewPresentations
  ];
};

export const hasUnstablePostCallData = (
  records: Array<
    Pick<
      AiCallRecord,
      | 'entryType'
      | 'taskId'
      | 'status'
      | 'analysisStatus'
      | 'qualityScoreStatus'
    >
  >,
) =>
  records.some((record) => {
    if (!isFormalOutboundRecord(record)) {
      return false;
    }
    if (record.status !== 'completed' && record.status !== 'failed') {
      return true;
    }
    return (
      record.analysisStatus == null ||
      record.analysisStatus === '0' ||
      record.analysisStatus === '1' ||
      record.qualityScoreStatus === 'pending' ||
      record.qualityScoreStatus === 'processing' ||
      record.qualityScoreStatus === 'failed'
    );
  });

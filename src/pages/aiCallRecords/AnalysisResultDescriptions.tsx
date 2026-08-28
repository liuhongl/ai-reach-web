import { Descriptions, Flex, Tag, Typography } from 'antd';
import * as React from 'react';

const { Text } = Typography;

void React.createElement;

const detailDescriptionStyles = { label: { color: '#1f1f1f' } };

export const businessSceneLabels: Record<string, string> = {
  intro_contract: '合同审核',
  intro_document: '跨境文书',
  intro_overseas: '海外获客',
  intro_geo: 'GEO 产品介绍',
};

const endReasonLabels: Record<string, string> = {
  agent_completed: '人工坐席结束',
  web_user_end: '浏览器用户结束',
  browser_disconnect: '浏览器连接断开',
  browser_connection_failed: '浏览器连接失败',
  customer_end: '客户结束',
  remote_hangup: '远端挂断',
  ai_completed: 'AI 完成',
  runtime_failed: '运行异常',
  reconnect_timeout: '重连超时',
  handoff_timeout: '转人工等待超时',
  no_online_agent: '无在线坐席，转人工失败后结束',
  callback_no_answer: '未接通',
  callback_busy: '忙线',
  callback_rejected: '已拒接',
  callback_invalid_contact: '联系方式无效',
  callback_technical_failure: '呼叫失败',
  user_unavailable: '被叫暂时不可用（SIP 480）',
  sip_480: '被叫暂时不可用（SIP 480）',
  sip_participant_left: '对方挂断',
  unknown: '未知原因',
};

const analysisFieldLabels: Record<string, string> = {
  summary: '通话摘要',
  follow_up: '后续跟进建议',
  feedback_type: '客户反馈',
  key_points: '关键要点',
  time_hint: '客户确认联系时间',
  tags: '分析标签',
  customer_intent: '客户意向',
  classification: 'AI 建议分类',
  reason: '分类原因',
  evidence: '判断依据',
  confidence: '分类置信度',
  evidence_conflict: '证据冲突',
  valid_dialogue: '有效业务对话',
  low_value_reason: '低价值原因',
};

const analysisFieldOrder = [
  'summary',
  'follow_up',
  'feedback_type',
  'key_points',
  'time_hint',
  'tags',
  'customer_intent',
  'classification',
  'reason',
  'evidence',
  'confidence',
  'evidence_conflict',
  'valid_dialogue',
  'low_value_reason',
];

const feedbackTagColors: Record<string, string> = {
  正向: 'success',
  中性: 'processing',
  负向: 'error',
};

const analysisTagColors: Record<string, string> = {
  试用意向初显: 'green',
  需要跟进: 'green',
  功能细节疑问: 'blue',
  价格敏感: 'gold',
  转写噪声风险: 'orange',
  低互动意愿: 'orange',
  未确认身份: 'orange',
};

const customerIntentLabels: Record<string, string> = {
  positive: '正向',
  neutral: '中性',
  negative: '负向',
};

const classificationLabels: Record<string, string> = {
  interested: '有意向',
  nurturing: '持续跟进',
  low_value: '低价值',
  converted: '已转化',
};

const classificationTagColors: Record<string, string> = {
  interested: 'gold',
  nurturing: 'blue',
  low_value: 'default',
  converted: 'success',
};

const followUpConfidenceLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const followUpConfidenceColors: Record<string, string> = {
  high: 'success',
  medium: 'warning',
  low: 'error',
};

const followUpConsentLabels: Record<string, string> = {
  explicit: '明确同意',
  missing: '未提及',
  refused: '明确拒绝',
};

const followUpConsentColors: Record<string, string> = {
  explicit: 'success',
  refused: 'error',
};

const lowValueReasonLabels: Record<string, string> = {
  explicit_rejection: '明确拒绝',
  no_current_need: '暂无需求',
  customer_mismatch: '客户不匹配',
  non_target_customer: '非目标客户',
  invalid_contact: '联系方式无效',
  other: '其他',
};

export const describeBusinessScene = (value?: string | null) =>
  value ? businessSceneLabels[value] || value : '-';

export const describeEndReason = (value?: string | null) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '-';
  if (
    /\bSIP[_\s:-]?480\b/i.test(normalized) ||
    /\bUSER_UNAVAILABLE\b/i.test(normalized)
  ) {
    return endReasonLabels.sip_480;
  }
  return endReasonLabels[normalized] || normalized;
};

export const hasAnalysisResult = (
  analysisResult?: Record<string, unknown> | null,
) =>
  Boolean(
    analysisResult &&
      analysisFieldOrder.some((key) => Object.hasOwn(analysisResult, key)),
  );

export const formatAnalysisSummary = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/^[\s，,。；;、’”"'）)]+/u, '');

const renderAnalysisValue = (
  key: string,
  value: unknown,
  analysisResult?: Record<string, unknown> | null,
) => {
  if (key === 'summary') {
    const text = formatAnalysisSummary(value);
    return text ? (
      <Typography.Paragraph
        data-testid="analysis-summary"
        style={{ marginBottom: 0 }}
      >
        {text}
      </Typography.Paragraph>
    ) : (
      '-'
    );
  }
  if (key === 'follow_up' && value && typeof value === 'object') {
    const followUp = value as Record<string, unknown>;
    const consent = String(followUp.consent || '');
    const confidence = String(followUp.confidence || '');
    const required =
      followUp.required === true
        ? '是'
        : followUp.required === false
          ? '否'
          : '-';
    return (
      <Descriptions
        colon={false}
        column={2}
        data-testid="analysis-follow-up"
        size="small"
        styles={detailDescriptionStyles}
        items={[
          {
            key: 'required',
            label: '需要跟进',
            children: (
              <Tag
                color={followUp.required === true ? 'success' : 'default'}
                style={{ marginInlineEnd: 0 }}
              >
                {required}
              </Tag>
            ),
          },
          {
            key: 'consent',
            label: '客户同意',
            children: (
              <Tag
                color={followUpConsentColors[consent] || 'default'}
                style={{ marginInlineEnd: 0 }}
              >
                {followUpConsentLabels[consent] || consent || '-'}
              </Tag>
            ),
          },
          {
            key: 'preferredTime',
            label: '期望时间',
            children: String(followUp.preferred_time || '未确认'),
          },
          {
            key: 'confidence',
            label: '置信度',
            children: (
              <Tag
                color={followUpConfidenceColors[confidence] || 'default'}
                style={{ marginInlineEnd: 0 }}
              >
                {followUpConfidenceLabels[confidence] || confidence || '-'}
              </Tag>
            ),
          },
          {
            key: 'reason',
            label: '原因',
            children: String(followUp.reason || '-'),
            span: 2,
          },
        ]}
      />
    );
  }
  if (key === 'feedback_type') {
    const text = String(value || '-');
    return <Tag color={feedbackTagColors[text] || 'default'}>{text}</Tag>;
  }
  if (key === 'key_points' && Array.isArray(value)) {
    const points = Array.from(new Set(value.map(String)));
    return points.length ? (
      <Flex vertical gap={4}>
        {points.map((item) => (
          <Text key={item}>{item}</Text>
        ))}
      </Flex>
    ) : (
      '-'
    );
  }
  if (key === 'time_hint') {
    const followUp =
      analysisResult?.follow_up && typeof analysisResult.follow_up === 'object'
        ? (analysisResult.follow_up as Record<string, unknown>)
        : undefined;
    const hint =
      value && typeof value === 'object'
        ? (value as {
            time_text?: unknown;
            time_value?: unknown;
            original_texts?: unknown;
          })
        : undefined;
    const originalText = Array.isArray(hint?.original_texts)
      ? hint.original_texts.map(String).find((item) => item.trim())
      : '';
    const timeHint = String(
      hint?.time_text ||
        hint?.time_value ||
        originalText ||
        (typeof value === 'object' ? '' : value) ||
        '',
    ).trim();
    if (followUp?.consent === 'explicit') {
      return (
        String(followUp.preferred_time || '').trim() ||
        '客户已同意，未确认具体时间'
      );
    }
    return timeHint
      ? `客户未确认（检测到时间线索：${timeHint}）`
      : '客户未确认';
  }
  if (key === 'tags' && Array.isArray(value)) {
    return value.length ? (
      <Flex wrap gap={4}>
        {Array.from(new Set(value.map(String))).map((item) => (
          <Tag color={analysisTagColors[item] || 'default'} key={item}>
            {item}
          </Tag>
        ))}
      </Flex>
    ) : (
      '-'
    );
  }
  if (key === 'customer_intent') {
    const intent = String(value || '');
    return customerIntentLabels[intent] || intent || '-';
  }
  if (key === 'classification') {
    const classification = String(value || '');
    return (
      <Tag color={classificationTagColors[classification] || 'default'}>
        {classificationLabels[classification] || classification || '-'}
      </Tag>
    );
  }
  if (key === 'evidence' && Array.isArray(value)) {
    const evidence = Array.from(new Set(value.map(String)));
    return evidence.length ? (
      <Flex vertical gap={4}>
        {evidence.map((item) => (
          <Text key={item}>{item}</Text>
        ))}
      </Flex>
    ) : (
      '-'
    );
  }
  if (key === 'confidence') {
    const confidence = String(value || '');
    return (
      <Tag
        color={followUpConfidenceColors[confidence] || 'default'}
        data-testid="classification-confidence"
      >
        {followUpConfidenceLabels[confidence] || confidence || '-'}
      </Tag>
    );
  }
  if (key === 'evidence_conflict') {
    return value === true ? (
      <Flex align="center" gap={8} wrap>
        <Tag color="warning" style={{ marginInlineEnd: 0 }}>
          需人工复核
        </Tag>
        <Text type="secondary">
          AI 分类依据与对话证据不一致，需人工确认最终分类。
        </Text>
      </Flex>
    ) : (
      '无'
    );
  }
  if (key === 'valid_dialogue') {
    return value === true ? '是' : '否';
  }
  if (key === 'low_value_reason') {
    const reason = String(value || '');
    return lowValueReasonLabels[reason] || reason || '-';
  }
  return value && typeof value === 'object'
    ? JSON.stringify(value)
    : String(value ?? '-');
};

const AnalysisResultDescriptions = ({
  analysisResult,
}: {
  analysisResult?: Record<string, unknown> | null;
}) => {
  if (!hasAnalysisResult(analysisResult)) return null;
  return (
    <Descriptions
      column={1}
      styles={detailDescriptionStyles}
      items={analysisFieldOrder
        .filter((key) => Object.hasOwn(analysisResult || {}, key))
        .filter(
          (key) =>
            key !== 'key_points' ||
            !formatAnalysisSummary(analysisResult?.summary),
        )
        .map((key) => ({
          key,
          label: analysisFieldLabels[key],
          children: renderAnalysisValue(
            key,
            analysisResult?.[key],
            analysisResult,
          ),
        }))}
    />
  );
};

export default AnalysisResultDescriptions;

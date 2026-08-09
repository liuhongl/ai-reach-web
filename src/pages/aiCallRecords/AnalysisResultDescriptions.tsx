import { Descriptions, Flex, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
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
  sip_participant_left: '对方挂断',
  unknown: '未知原因',
};

const analysisFieldLabels: Record<string, string> = {
  summary: '通话摘要',
  feedback_type: '客户反馈',
  key_points: '关键要点',
  time_hint: '客户期望联系时间',
  tags: '分析标签',
  customer_intent: '客户意向',
  follow_up: '后续跟进结论',
};

const analysisFieldOrder = [
  'summary',
  'feedback_type',
  'key_points',
  'time_hint',
  'tags',
  'customer_intent',
  'follow_up',
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

const followUpConsentLabels: Record<string, string> = {
  explicit: '明确同意',
  refused: '明确拒绝',
  missing: '未表达',
};

const followUpConfidenceLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const describeBusinessScene = (value?: string | null) =>
  value ? businessSceneLabels[value] || value : '-';

export const describeEndReason = (value?: string | null) =>
  value ? endReasonLabels[value] || value : '-';

export const hasAnalysisResult = (
  analysisResult?: Record<string, unknown> | null,
) =>
  Boolean(
    analysisResult &&
      analysisFieldOrder.some((key) => Object.hasOwn(analysisResult, key)),
  );

const renderAnalysisValue = (key: string, value: unknown) => {
  if (key === 'summary') {
    const text = String(value || '').trim();
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
    if (value && typeof value === 'object') {
      const hint = value as {
        time_text?: unknown;
        time_value?: unknown;
      };
      return (
        String(hint.time_text || hint.time_value || '').trim() || '客户未提及'
      );
    }
    return String(value || '').trim() || '客户未提及';
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
  if (key === 'follow_up' && value && typeof value === 'object') {
    const followUp = value as {
      required?: unknown;
      consent?: unknown;
      reason?: unknown;
      preferred_time?: unknown;
      confidence?: unknown;
    };
    const consent = String(followUp.consent || 'missing');
    const confidence = String(followUp.confidence || '');
    const preferredAt = String(followUp.preferred_time || '').trim();
    const decision = followUp.required
      ? consent === 'explicit'
        ? '客户已明确同意后续联系'
        : '存在后续跟进线索，客户尚未明确同意'
      : consent === 'refused'
        ? '客户明确拒绝后续联系'
        : '未识别到明确的后续联系需求';
    return (
      <Descriptions
        column={1}
        size="small"
        styles={detailDescriptionStyles}
        items={[
          {
            key: 'suggested',
            label: '处理建议',
            children: (
              <Tag
                color={
                  followUp.required
                    ? 'warning'
                    : consent === 'refused'
                      ? 'default'
                      : 'purple'
                }
              >
                {followUp.required
                  ? '建议跟进'
                  : consent === 'refused'
                    ? '无需跟进'
                    : 'AI 建议：无需跟进'}
              </Tag>
            ),
          },
          { key: 'decision', label: '跟进判断', children: decision },
          {
            key: 'consent',
            label: '客户态度',
            children: followUpConsentLabels[consent] || consent,
          },
          {
            key: 'reason',
            label: '判断依据',
            children: String(followUp.reason || '').trim() || '-',
          },
          {
            key: 'preferredAt',
            label: '期望时间',
            children: preferredAt
              ? dayjs(preferredAt).format('YYYY-MM-DD HH:mm:ss')
              : '-',
          },
          {
            key: 'confidence',
            label: '置信度',
            children: followUpConfidenceLabels[confidence] || confidence || '-',
          },
        ]}
      />
    );
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
        .map((key) => ({
          key,
          label: analysisFieldLabels[key],
          children: renderAnalysisValue(key, analysisResult?.[key]),
        }))}
    />
  );
};

export default AnalysisResultDescriptions;

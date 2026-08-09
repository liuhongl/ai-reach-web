import { Flex, Typography } from 'antd';
import * as React from 'react';
import type { AiCallDialogueSegment } from './service';

const { Text } = Typography;

void React.createElement;

const speakerLabels: Record<string, string> = {
  ai: 'AI',
  customer: '客户',
  human_agent: '人工坐席',
  agent: '人工坐席',
};

const DialogueSegments = ({
  segments,
}: {
  segments: AiCallDialogueSegment[];
}) => (
  <Flex
    data-testid="dialogue-scroll-region"
    vertical
    gap={12}
    className="ai-call-dialogue-region"
    style={{
      maxHeight: 420,
      overflowY: 'auto',
      padding: 12,
      border: '1px solid #eef0f4',
      borderRadius: 10,
      background: '#f8f9fb',
    }}
  >
    {segments.map((segment, index) => {
      const isCustomer = segment.speakerType === 'customer';
      const isHuman =
        segment.speakerType === 'human_agent' ||
        segment.speakerType === 'agent';
      const speaker = speakerLabels[segment.speakerType] || segment.speakerType;
      return (
        <div
          className={`ai-call-dialogue-row ai-call-dialogue-row--${
            isCustomer ? 'right' : 'left'
          }`}
          style={{
            display: 'flex',
            width: '100%',
            justifyContent: isCustomer ? 'flex-end' : 'flex-start',
          }}
          key={
            segment.id || `${segment.segmentNo}-${segment.speakerType}-${index}`
          }
        >
          <div
            className={`ai-call-dialogue-bubble ai-call-dialogue-bubble--${
              isCustomer ? 'customer' : segment.speakerType
            }`}
            style={{
              maxWidth: '82%',
              padding: '10px 12px',
              border: `1px solid ${
                isCustomer ? '#dfd4fa' : isHuman ? '#d4eadf' : '#e6ebf2'
              }`,
              borderRadius: 10,
              background: isCustomer
                ? '#fbf8ff'
                : isHuman
                  ? '#f1fbf5'
                  : '#f6f9ff',
            }}
          >
            <Text strong>{`${speaker}：`}</Text>
            <Text>{segment.text}</Text>
          </div>
        </div>
      );
    })}
  </Flex>
);

export default DialogueSegments;

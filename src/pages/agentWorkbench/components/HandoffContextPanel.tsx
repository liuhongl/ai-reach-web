import { Alert, Button, Empty, Spin, Tag, Typography } from 'antd';
import * as React from 'react';
import { useEffect, useRef } from 'react';
import type {
  HandoffContextDto,
  HandoffDto,
} from '@/services/ruoyi/agent-console';
import './HandoffContextPanel.css';

const { Paragraph, Text } = Typography;

const sceneLabels: Record<string, string> = {
  intro_contract: '合同审核',
  intro_document: '跨境文书',
  intro_overseas: '海外获客',
  intro_geo: 'GEO',
};

const dialogueSpeakerLabels: Record<'ai' | 'customer', string> = {
  customer: '客户',
  ai: 'AI',
};

export type HandoffContextPanelProps = {
  handoff?: HandoffDto;
  context?: HandoffContextDto;
  loading?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
};

const HandoffContextPanel = ({
  handoff,
  context,
  loading = false,
  errorMessage,
  onRetry,
}: HandoffContextPanelProps) => {
  const dialogueScrollRef = useRef<HTMLDivElement>(null);
  const displayHandoff = context || handoff;
  const dialogue = context?.dialogue || [];

  useEffect(() => {
    const scroll = dialogueScrollRef.current;
    if (scroll && dialogue.length) {
      scroll.scrollTop = scroll.scrollHeight;
    }
  }, [context?.handoff_id, dialogue.length]);

  if (!displayHandoff) {
    return (
      <div className="agent-workbench-empty-state">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="转人工请求到达后显示业务上下文"
        />
      </div>
    );
  }

  return (
    <div className="agent-handoff-context">
      <div className="agent-handoff-customer">
        <Text strong>{displayHandoff.masked_customer_name || '客户'}</Text>
        <Text type="secondary">
          {displayHandoff.masked_contact || '联系方式已脱敏'}
        </Text>
        <Tag>
          {sceneLabels[displayHandoff.scene_code] || displayHandoff.scene_code}
        </Tag>
      </div>

      <section className="agent-handoff-summary">
        <Text className="agent-handoff-section-title" strong>
          交接摘要
        </Text>
        <Paragraph>
          {displayHandoff.handoff_summary ||
            displayHandoff.request_message ||
            '摘要生成中'}
        </Paragraph>
      </section>

      <section className="agent-handoff-dialogue">
        <div className="agent-handoff-dialogue-heading">
          <Text className="agent-handoff-section-title" strong>
            完整会话
          </Text>
          <Text type="secondary">{dialogue.length} 条</Text>
        </div>
        {errorMessage ? (
          <Alert
            type="warning"
            showIcon
            title={errorMessage}
            action={
              onRetry ? (
                <Button size="small" onClick={onRetry}>
                  重试
                </Button>
              ) : undefined
            }
          />
        ) : null}
        <Spin spinning={loading} description="正在加载完整会话">
          {dialogue.length ? (
            <div
              className="agent-handoff-dialogue-scroll"
              data-testid="dialogue-scroll"
              ref={dialogueScrollRef}
            >
              {dialogue.map((item, index) => {
                const speaker =
                  item.speaker_type === 'customer' ? 'customer' : 'ai';
                return (
                  <article
                    className="agent-handoff-dialogue-turn"
                    data-speaker={speaker}
                    data-testid="dialogue-turn"
                    key={item.id || `${item.speaker_type}-${index}`}
                  >
                    <Text className="agent-handoff-dialogue-text">
                      {`${dialogueSpeakerLabels[speaker]}：${item.text}`}
                    </Text>
                  </article>
                );
              })}
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={loading ? '正在加载完整会话' : '暂无对话记录'}
            />
          )}
        </Spin>
      </section>
    </div>
  );
};

export default HandoffContextPanel;

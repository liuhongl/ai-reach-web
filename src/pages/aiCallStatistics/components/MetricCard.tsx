import { Card, Flex, Space, Typography, theme } from 'antd';
import React, { type KeyboardEvent, type ReactNode } from 'react';
import MetricIcon, {
  type MetricTone,
} from '@/components/MetricIcon';

const { Text } = Typography;

type MetricCardProps = {
  title: string;
  value: string;
  unit?: string;
  comparison: string;
  icon: ReactNode;
  tone: MetricTone;
  emphasized?: boolean;
  onClick: () => void;
};

const MetricCard = ({
  title,
  value,
  unit,
  comparison,
  icon,
  tone,
  emphasized = false,
  onClick,
}: MetricCardProps) => {
  const { token } = theme.useToken();
  const emphasizedColor = emphasized ? token.colorPrimary : undefined;
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      hoverable
      size="small"
      role="button"
      tabIndex={0}
      aria-label={`${title} ${value}${unit ?? ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      styles={{ body: { padding: 16 } }}
      style={{ height: '100%' }}
    >
      <Flex vertical gap={12}>
        <Flex align="center" justify="space-between" gap={12}>
          <Text type="secondary">{title}</Text>
          <MetricIcon icon={icon} tone={tone} />
        </Flex>
        <Space align="baseline" size={4}>
          <Text
            strong
            style={{
              fontSize: 26,
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
              color: emphasizedColor,
            }}
          >
            {value}
          </Text>
          {unit ? (
            <Text
              type={emphasized ? undefined : 'secondary'}
              style={{ color: emphasizedColor }}
            >
              {unit}
            </Text>
          ) : null}
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {comparison}
        </Text>
      </Flex>
    </Card>
  );
};

export default MetricCard;

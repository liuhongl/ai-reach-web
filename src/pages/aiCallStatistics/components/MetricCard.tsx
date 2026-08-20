import { Card, Flex, Space, Typography, theme } from 'antd';
import React, { type ReactNode } from 'react';
import MetricIcon, {
  type MetricTone,
} from '@/components/MetricIcon';

const { Text } = Typography;

type MetricCardProps = {
  title: string;
  value: string;
  unit?: string;
  comparison: string;
  comparisonTone?: 'positive' | 'negative' | 'neutral';
  icon: ReactNode;
  tone: MetricTone;
  emphasized?: boolean;
};

const MetricCard = ({
  title,
  value,
  unit,
  comparison,
  comparisonTone = 'neutral',
  icon,
  tone,
  emphasized = false,
}: MetricCardProps) => {
  const { token } = theme.useToken();
  const emphasizedColor = emphasized ? token.colorPrimary : undefined;
  const comparisonColor =
    comparisonTone === 'positive'
      ? token.colorSuccess
      : comparisonTone === 'negative'
        ? token.colorError
        : token.colorTextSecondary;

  return (
    <Card
      size="small"
      aria-label={`${title} ${value}${unit ?? ''}`}
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
        <Text style={{ color: comparisonColor, fontSize: 12 }}>
          {comparison}
        </Text>
      </Flex>
    </Card>
  );
};

export default MetricCard;

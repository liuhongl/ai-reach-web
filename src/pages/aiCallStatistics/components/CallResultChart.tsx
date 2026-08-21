import { Pie } from '@ant-design/plots';
import { Empty, Flex, Space, Typography } from 'antd';
import React from 'react';
import type { CallResultGroup, OutboundStatistics } from '../domain';

const { Text } = Typography;

const RESULT_META: Record<
  CallResultGroup,
  { label: string; color: string }
> = {
  connected: { label: '接通', color: '#5B8F8B' },
  no_answer: { label: '无人接听', color: '#C49A5A' },
  rejected: { label: '拒接', color: '#C56A7A' },
  early_hangup: { label: '主动挂断', color: '#B9855B' },
  invalid_number: { label: '空号停机类', color: '#8A93A3' },
  other: { label: '其他', color: '#8B7FB3' },
};

type ResultItem = OutboundStatistics['results'][number];

type CallResultChartProps = {
  data: ResultItem[];
};

const CallResultChart = ({ data }: CallResultChartProps) => {
  if (data.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const chartData = data.map((item) => ({
    ...item,
    label: RESULT_META[item.result].label,
  }));

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Flex vertical gap={12}>
      <div style={{ position: 'relative' }}>
        <Pie
          height={220}
          data={chartData}
          angleField="count"
          colorField="label"
          innerRadius={0.64}
          scale={{
            color: {
              range: chartData.map((item) => RESULT_META[item.result].color),
            },
          }}
          legend={false}
          label={{
            text: (datum: ResultItem) =>
              datum.rate >= 0.05 ? `${(datum.rate * 100).toFixed(1)}%` : '',
            position: 'outside',
          }}
          tooltip={{
            title: 'label',
            items: [
              { field: 'count', name: '数量' },
              {
                field: 'rate',
                name: '占比',
                valueFormatter: (value: number) => `${(value * 100).toFixed(1)}%`,
              },
            ],
          }}
        />
        <Flex
          vertical
          align="center"
          style={{
            left: '50%',
            pointerEvents: 'none',
            position: 'absolute',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Text strong style={{ fontSize: 22 }}>
            {total.toLocaleString()}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            外呼次数
          </Text>
        </Flex>
      </div>
      <div
        data-testid="call-result-legend"
        style={{
          display: 'grid',
          gap: '4px 12px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        {data.map((item) => {
          const meta = RESULT_META[item.result];
          const content = (
            <Flex
              key={item.result}
              align="center"
              justify="space-between"
              gap={12}
            >
              <Space size={8}>
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    flex: '0 0 auto',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: meta.color,
                  }}
                />
                <Text style={{ whiteSpace: 'nowrap' }}>{meta.label}</Text>
              </Space>
              <Text style={{ whiteSpace: 'nowrap' }}>
                {item.count.toLocaleString()}（{(item.rate * 100).toFixed(1)}%）
              </Text>
            </Flex>
          );

          return (
            <div key={item.result} style={{ padding: '4px 8px' }}>
              {content}
            </div>
          );
        })}
      </div>
    </Flex>
  );
};

export default CallResultChart;

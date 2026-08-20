import { DualAxes } from '@ant-design/plots';
import { Empty } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import type { OutboundStatistics, StatisticsGranularity } from '../domain';

type TrendItem = OutboundStatistics['trend'][number];

type OutboundTrendChartProps = {
  data: TrendItem[];
  granularity: StatisticsGranularity;
};

const TREND_COLORS = {
  dialAttempts: '#7C6BCB',
  connectRate: '#5B8F8B',
};

const OutboundTrendChart = ({
  data,
  granularity,
}: OutboundTrendChartProps) => {
  if (data.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const chartData = data.map((item) => ({
    ...item,
    bucketLabel: dayjs(item.bucketStart).format(
      granularity === 'hour' ? 'HH:mm' : 'MM-DD',
    ),
    connectRatePercent: Number((item.connectRate * 100).toFixed(2)),
  }));
  const children = [
    {
      type: 'interval',
      data: chartData,
      yField: 'dialAttempts',
      style: {
        fill: TREND_COLORS.dialAttempts,
        fillOpacity: 0.82,
        maxWidth: 36,
      },
      axis: { y: { title: '拨打次数' } },
      tooltip: {
        items: [
          (datum: { dialAttempts: number }) => ({
            name: '拨打次数',
            value: `${datum.dialAttempts.toLocaleString()} 次`,
          }),
        ],
      },
    },
    {
      type: 'line',
      data: chartData,
      yField: 'connectRatePercent',
      shapeField: 'smooth',
      style: { stroke: TREND_COLORS.connectRate, lineWidth: 2 },
      axis: {
        y: {
          position: 'right',
          title: '接通率',
          labelFormatter: (value: number) => `${value}%`,
        },
      },
      tooltip: {
        items: [
          (datum: { connectRatePercent: number }) => ({
            name: '接通率',
            value: `${datum.connectRatePercent.toFixed(1)}%`,
          }),
        ],
      },
    },
  ];

  return (
    <DualAxes
      height={300}
      xField="bucketLabel"
      {...{ children }}
      scale={{
        color: {
          range: [TREND_COLORS.dialAttempts, TREND_COLORS.connectRate],
        },
      }}
      tooltip={{ title: 'bucketLabel' }}
      legend={{
        color: {
          itemLabelText: (datum: { label?: string }) =>
            datum.label === 'dialAttempts' ? '拨打次数' : '接通率',
        },
      }}
    />
  );
};

export default OutboundTrendChart;

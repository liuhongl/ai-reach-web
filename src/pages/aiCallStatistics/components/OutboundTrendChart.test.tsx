import { render } from '@testing-library/react';
import * as React from 'react';
import OutboundTrendChart from './OutboundTrendChart';

let mockDualAxesProps: Record<string, any> = {};

jest.mock('@ant-design/plots', () => {
  const React = require('react');
  return {
    DualAxes: (props: Record<string, unknown>) => {
      mockDualAxesProps = props;
      return React.createElement('div', {
        'data-testid': 'outbound-trend-chart',
      });
    },
  };
});

describe('OutboundTrendChart', () => {
  it('使用低饱和趋势色并提供中文悬浮提示', () => {
    render(
      <OutboundTrendChart
        data={[
          {
            bucketStart: '2026-07-31T00:00:00+08:00',
            dialAttempts: 6,
            connectedCalls: 5,
            connectRate: 0.8333,
          },
        ]}
        granularity="day"
      />,
    );

    const [dialAttemptsMark, connectRateMark] = mockDualAxesProps.children;
    expect(mockDualAxesProps.scale.color.range).toEqual(['#7C6BCB', '#5B8F8B']);
    expect(dialAttemptsMark.style.fill).toBe('#7C6BCB');
    expect(connectRateMark.style.stroke).toBe('#5B8F8B');
    expect(typeof dialAttemptsMark.tooltip?.items?.[0]).toBe('function');
    expect(dialAttemptsMark.tooltip.items[0]({ dialAttempts: 6 })).toEqual({
      name: '拨打次数',
      value: '6 次',
    });
    expect(typeof connectRateMark.tooltip?.items?.[0]).toBe('function');
    expect(
      connectRateMark.tooltip.items[0]({ connectRatePercent: 83.33 }),
    ).toEqual({ name: '接通率', value: '83.3%' });
  });
});

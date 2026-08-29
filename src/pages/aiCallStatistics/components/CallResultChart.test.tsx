import { render, screen } from '@testing-library/react';
import * as React from 'react';
import CallResultChart from './CallResultChart';

let mockPieProps: Record<string, any> = {};

jest.mock('@ant-design/plots', () => {
  const React = require('react');
  return {
    Pie: (props: Record<string, unknown>) => {
      mockPieProps = props;
      return React.createElement('div', { 'data-testid': 'call-result-chart' });
    },
  };
});

describe('CallResultChart', () => {
  it('环图和结果列表共用低饱和语义色', () => {
    const { container } = render(
      <CallResultChart
        data={[
          { result: 'connected', count: 19, rate: 0.792 },
          { result: 'voicemail', count: 2, rate: 0.083 },
          { result: 'transport_connected', count: 1, rate: 0.042 },
          { result: 'rejected', count: 5, rate: 0.208 },
        ]}
      />,
    );

    expect(mockPieProps.scale.color.range).toEqual([
      '#5B8F8B',
      '#7C6BCB',
      '#6F8FAF',
      '#C56A7A',
    ]);
    expect(container.textContent).toContain('27');
    expect(container.textContent).toContain('真人接通');
    expect(container.textContent).toContain('语音信箱');
    expect(container.textContent).toContain('仅线路接通');
    const colorDots = container.querySelectorAll(
      'span[aria-hidden="true"]',
    ) as NodeListOf<HTMLElement>;
    expect(colorDots[0].style.display).toBe('inline-block');
    expect(colorDots[0].style.background).toBe('rgb(91, 143, 139)');
    expect(colorDots[1].style.background).toBe('rgb(124, 107, 203)');
    expect(colorDots[2].style.background).toBe('rgb(111, 143, 175)');
    const legend = screen.getByTestId('call-result-legend');
    expect(legend.style.display).toBe('grid');
    expect(legend.style.gridTemplateColumns).toBe(
      'repeat(auto-fit, minmax(220px, 1fr))',
    );
    expect(
      Array.from(
        legend.querySelectorAll<HTMLElement>('.ant-typography'),
      ).every((item) => item.style.whiteSpace === 'nowrap'),
    ).toBe(true);
  });
});

import { render } from '@testing-library/react';
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
          { result: 'call_failed', count: 5, rate: 0.208 },
        ]}
        onResultClick={jest.fn()}
      />,
    );

    expect(mockPieProps.scale.color.range).toEqual(['#5B8F8B', '#C56A7A']);
    const colorDots = container.querySelectorAll(
      'span[aria-hidden="true"]',
    ) as NodeListOf<HTMLElement>;
    expect(colorDots[0].style.display).toBe('inline-block');
    expect(colorDots[0].style.background).toBe('rgb(91, 143, 139)');
    expect(colorDots[1].style.background).toBe('rgb(197, 106, 122)');
  });
});

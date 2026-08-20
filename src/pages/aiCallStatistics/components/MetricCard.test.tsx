import { render, screen } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import React from 'react';
import MetricCard from './MetricCard';

describe('MetricCard', () => {
  it('强调态使用主题色且卡片不提供下钻操作', () => {
    render(
      <ConfigProvider theme={{ token: { colorPrimary: '#722ED1' } }}>
        <MetricCard
          title="待跟进"
          value="7"
          unit="条"
          comparison="当前筛选范围"
          icon={<span />}
          tone="error"
          emphasized
        />
      </ConfigProvider>,
    );

    expect(screen.getByText('7').parentElement?.style.color).toBe(
      'rgb(114, 46, 209)',
    );
    expect(screen.getByText('条').style.color).toBe('rgb(114, 46, 209)');

    expect(screen.queryByRole('button', { name: '待跟进 7条' })).toBeNull();
  });
});

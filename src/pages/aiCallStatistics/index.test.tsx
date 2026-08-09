import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { history } from '@umijs/max';
import * as React from 'react';
import AiCallStatisticsPage from '.';
import { getOutboundStatistics } from './service';

jest.mock('./service', () => ({
  getOutboundStatistics: jest.fn(),
}));

jest.mock('@umijs/max', () => ({
  history: { push: jest.fn() },
}));

jest.mock('@ant-design/pro-components', () => {
  const React = require('react');
  return {
    PageContainer: (props: Record<string, unknown>) => {
      const { children, title } = props;
      return React.createElement(
        'main',
        null,
        React.createElement('h1', null, title),
        children,
      );
    },
  };
});

jest.mock('@ant-design/plots', () => {
  const React = require('react');
  return {
    DualAxes: () =>
      React.createElement('div', { 'data-testid': 'outbound-trend-chart' }),
    Pie: () =>
      React.createElement('div', { 'data-testid': 'call-result-chart' }),
  };
});

const statistics = {
  generatedAt: '2026-07-31T16:20:00+08:00',
  period: {
    timeZone: 'Asia/Shanghai',
    currentStartedAt: '2026-07-25T00:00:00+08:00',
    currentEndedAt: '2026-07-31T16:20:00+08:00',
    previousStartedAt: '2026-07-18T07:40:00+08:00',
    previousEndedAt: '2026-07-25T00:00:00+08:00',
  },
  overview: {
    dialAttempts: 1268,
    connectedCalls: 712,
    connectRate: 0.5615,
    pendingFollowUps: 38,
  },
  comparison: {
    dialAttemptsChangeRate: 0.0832,
    connectedCallsChangeRate: 0.0517,
    connectRateChangePoints: -1.68,
  },
  trend: [
    {
      bucketStart: '2026-07-25T00:00:00+08:00',
      dialAttempts: 180,
      connectedCalls: 102,
      connectRate: 0.5667,
    },
  ],
  results: [
    { result: 'connected' as const, count: 712, rate: 0.5615 },
    { result: 'no_answer' as const, count: 331, rate: 0.261 },
  ],
};

describe('AI Call 外呼统计页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getOutboundStatistics as jest.Mock).mockResolvedValue(statistics);
  });

  it('加载最近七天统计并展示四项核心指标和图表', async () => {
    render(<AiCallStatisticsPage />);

    expect(await screen.findByText('1,268')).toBeTruthy();
    expect(screen.getAllByText('712').length).toBeGreaterThan(0);
    expect(screen.getAllByText('56.2%').length).toBeGreaterThan(0);
    expect(screen.getByText('38')).toBeTruthy();
    expect(screen.getByText('38').parentElement?.style.color).toBe(
      'rgb(22, 119, 255)',
    );
    expect(screen.getByText('较上期 ↑ 8.3%')).toBeTruthy();
    expect(screen.getByText('较上期 ↓ 1.68 个百分点')).toBeTruthy();
    expect(screen.getByTestId('outbound-trend-chart')).toBeTruthy();
    expect(screen.getByTestId('call-result-chart')).toBeTruthy();
    expect(getOutboundStatistics).toHaveBeenCalledWith(
      expect.objectContaining({
        granularity: 'day',
        timeZone: expect.any(String),
      }),
    );
  });

  it('核心指标下钻时保留正式外呼和服务端有效区间', async () => {
    render(<AiCallStatisticsPage />);
    await screen.findByText('1,268');

    fireEvent.click(screen.getByRole('button', { name: /接通通话/ }));
    expect(history.push).toHaveBeenLastCalledWith(
      expect.stringContaining(
        '/ai-call/records?formalOutboundOnly=true&startedAtBegin=',
      ),
    );
    expect(history.push).toHaveBeenLastCalledWith(
      expect.stringContaining('callResult=connected'),
    );

    fireEvent.click(screen.getByRole('button', { name: /待跟进/ }));
    expect(history.push).toHaveBeenLastCalledWith(
      expect.stringContaining(
        '/ai-call/follow-up-overview?status=pending&formalOutboundOnly=true',
      ),
    );
  });

  it('刷新只重取当前已应用范围', async () => {
    render(<AiCallStatisticsPage />);
    await screen.findByText('1,268');

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));

    await waitFor(() => {
      expect(getOutboundStatistics).toHaveBeenCalledTimes(2);
    });
    expect((getOutboundStatistics as jest.Mock).mock.calls[1][0]).toEqual(
      (getOutboundStatistics as jest.Mock).mock.calls[0][0],
    );
  });

  it('请求失败时展示完整异常状态、清空旧数据并允许重新加载', async () => {
    (getOutboundStatistics as jest.Mock)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(statistics);

    render(<AiCallStatisticsPage />);

    expect(await screen.findByText('暂时无法获取外呼统计')).toBeTruthy();
    expect(
      screen.getByText('请检查服务状态或稍后重试，当前筛选条件已保留。'),
    ).toBeTruthy();
    expect(screen.queryByText('1,268')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    expect(await screen.findByText('1,268')).toBeTruthy();
  });
});

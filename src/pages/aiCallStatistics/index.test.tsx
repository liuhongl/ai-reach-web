import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { getAiCallLabPromptProfiles } from '@/services/ruoyi/ai-call-lab';
import { listAiCallTasks } from '../aiCallTasks/service';
import AiCallStatisticsPage from '.';
import { getOutboundStatistics } from './service';

jest.mock('./service', () => ({
  getOutboundStatistics: jest.fn(),
}));

jest.mock('@/services/ruoyi/ai-call-lab', () => ({
  getAiCallLabPromptProfiles: jest.fn(),
}));

jest.mock('../aiCallTasks/service', () => ({
  listAiCallTasks: jest.fn(),
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
    totalDurationMs: 1_440_000,
    intentLeads: 5,
    pendingFollowUps: 38,
  },
  comparison: {
    dialAttemptsChangeRate: 0.0832,
    connectedCallsChangeRate: 0.0517,
    connectRateChangePoints: -1.68,
    totalDurationChangeRate: 0.12,
    intentLeadsChangeRate: -0.2,
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
    { result: 'voicemail' as const, count: 35, rate: 0.0276 },
    { result: 'transport_connected' as const, count: 25, rate: 0.0197 },
    { result: 'no_answer' as const, count: 331, rate: 0.261 },
    { result: 'rejected' as const, count: 80, rate: 0.0631 },
    { result: 'early_hangup' as const, count: 45, rate: 0.0355 },
    { result: 'invalid_number' as const, count: 40, rate: 0.0315 },
    { result: 'other' as const, count: 0, rate: 0 },
  ],
};

describe('AI Call 外呼统计页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getOutboundStatistics as jest.Mock).mockResolvedValue(statistics);
    (getAiCallLabPromptProfiles as jest.Mock).mockResolvedValue({
      rows: [{ id: 1, name: '产品介绍', sceneCode: 'product_intro' }],
      total: 1,
    });
    (listAiCallTasks as jest.Mock).mockResolvedValue({
      rows: [{ taskId: '100', taskName: '八月产品外呼' }],
      total: 1,
    });
  });

  it('加载最近七天统计并展示六项核心指标和图表', async () => {
    render(<AiCallStatisticsPage />);

    expect((await screen.findAllByText('1,268')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('712').length).toBeGreaterThan(0);
    expect(screen.getAllByText('56.2%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('真人接通').length).toBeGreaterThan(0);
    expect(screen.getByText('真人接通率')).toBeTruthy();
    expect(screen.getByText('真人通话总时长')).toBeTruthy();
    expect(screen.getByText('语音信箱')).toBeTruthy();
    expect(screen.getByText('仅线路接通')).toBeTruthy();
    expect(screen.getByText('24.0')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('38')).toBeTruthy();
    expect(screen.getByText('当前待处理总量')).toBeTruthy();
    expect(screen.getByText('38').parentElement?.style.color).toBe(
      'rgb(22, 119, 255)',
    );
    expect(screen.getByText('较上期 ↑ 8.3%')).toBeTruthy();
    expect(screen.getByText('较上期 ↓ 1.68 个百分点')).toBeTruthy();
    expect(screen.getByText('较上期 ↑ 8.3%').style.color).toBe(
      'rgb(82, 196, 26)',
    );
    expect(screen.getByText('较上期 ↓ 1.68 个百分点').style.color).toBe(
      'rgb(255, 77, 79)',
    );
    expect(screen.getByTestId('outbound-trend-chart')).toBeTruthy();
    expect(screen.getByTestId('call-result-chart')).toBeTruthy();
    expect(
      screen
        .getByText('外呼趋势：拨打次数（柱）/ 接通率（折线）')
        .closest('.ant-card')
        ?.getAttribute('style'),
    ).toContain('height: 100%');
    expect(
      screen
        .getByText('呼叫结果分布')
        .closest('.ant-card')
        ?.getAttribute('style'),
    ).toContain('height: 100%');
    expect(getOutboundStatistics).toHaveBeenCalledWith(
      expect.objectContaining({
        granularity: 'day',
        timeZone: expect.any(String),
      }),
    );
  });

  it('按场景加载任务并把二级筛选用于查询', async () => {
    render(<AiCallStatisticsPage />);
    await screen.findAllByText('1,268');

    expect(screen.getByLabelText('外呼任务').hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.mouseDown(screen.getByLabelText('业务场景'));
    fireEvent.click(await screen.findByText('产品介绍'));
    await waitFor(() => {
      expect(listAiCallTasks).toHaveBeenCalledWith({
        pageNum: 1,
        pageSize: 200,
        sceneCode: 'product_intro',
      });
    });

    fireEvent.mouseDown(screen.getByLabelText('外呼任务'));
    fireEvent.click(await screen.findByText('八月产品外呼'));
    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }));
    await waitFor(() => {
      expect(getOutboundStatistics).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sceneCode: 'product_intro',
          taskId: '100',
        }),
      );
    });
  });

  it('刷新只重取当前已应用范围', async () => {
    render(<AiCallStatisticsPage />);
    await screen.findAllByText('1,268');

    const refresh = screen.getByRole('button', { name: '刷新' });
    await waitFor(() => {
      expect(refresh.hasAttribute('disabled')).toBe(false);
    });
    fireEvent.click(refresh);

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
    expect((await screen.findAllByText('1,268')).length).toBeGreaterThan(0);
  });
});

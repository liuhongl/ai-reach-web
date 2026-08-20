import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { history, useModel } from '@umijs/max';
import IndexPage from './index';

jest.mock('@umijs/max', () => ({
  history: { replace: jest.fn() },
  useModel: jest.fn(),
}));

const mockUseModel = jest.mocked(useModel);

describe('index page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('跳转到首个可访问入口', () => {
    mockUseModel.mockReturnValue({
      initialState: {
        currentUser: { permissions: ['ai_call:lab:use'] },
      },
    } as never);

    render(<IndexPage />);

    expect(history.replace).toHaveBeenCalledWith('/ai-call-lab/customer');
  });

  it('超级权限跳转到数据看板', () => {
    mockUseModel.mockReturnValue({
      initialState: { currentUser: { permissions: ['*:*:*'] } },
    } as never);

    render(<IndexPage />);

    expect(history.replace).toHaveBeenCalledWith('/ai-call/statistics');
  });

  it('无 AI Call 权限时显示 403', () => {
    mockUseModel.mockReturnValue({
      initialState: { currentUser: { permissions: [] } },
    } as never);

    render(<IndexPage />);

    expect(screen.getByText('无权访问 AI Reach')).toBeTruthy();
  });
});

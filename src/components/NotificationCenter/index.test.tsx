import * as React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { subscribeSseMessage } from '@/adapters/ruoyi/sse';
import { listMessages } from '@/services/ruoyi/message';
import NotificationCenter from './index';

let mockSseListener: ((message: any) => void) | undefined;

jest.mock('@/adapters/ruoyi/sse', () => ({
  subscribeSseMessage: jest.fn((listener) => {
    mockSseListener = listener;
    return jest.fn();
  }),
}));
jest.mock('@/services/ruoyi/message', () => ({
  listMessages: jest.fn(),
  readAllMessages: jest.fn(),
  readMessage: jest.fn(),
}));
jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: new Proxy({}, { get: (_target, key) => String(key) }),
  }),
}));
jest.mock('antd', () => {
  const React = require('react');
  const passthrough = ({ children }: any) => React.createElement('div', null, children);
  const Button = ({ children, ...props }: any) =>
    React.createElement('button', props, children);
  const Empty = Object.assign(passthrough, { PRESENTED_IMAGE_SIMPLE: null });
  return {
    App: { useApp: () => ({ message: { warning: jest.fn() } }) },
    Badge: passthrough,
    Button,
    Drawer: passthrough,
    Empty,
    Grid: { useBreakpoint: () => ({ md: true }) },
    Popover: passthrough,
    Segmented: passthrough,
    Skeleton: passthrough,
    Tooltip: passthrough,
  };
});
jest.mock('@/components/SafeHtml', () => () => null);
jest.mock('@/components/SiderFooterAction', () => () => null);

describe('NotificationCenter SSE boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSseListener = undefined;
    jest.mocked(listMessages).mockResolvedValue({ rows: [], total: 0 } as never);
  });

  it('只响应通知类型，不消费 AI Call 坐席事件', async () => {
    render(<NotificationCenter contextKey="1:default:0" enabled />);
    await waitFor(() => expect(subscribeSseMessage).toHaveBeenCalled());
    await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockSseListener?.({ type: 'ai-call.agent.changed', data: {} });
    });
    expect(listMessages).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockSseListener?.({ type: 'resource.message.changed', data: {} });
    });
    await waitFor(() => expect(listMessages).toHaveBeenCalledTimes(2));
  });
});

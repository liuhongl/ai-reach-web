import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { history } from '@umijs/max';
import { setRuoyiMessage } from '@/adapters/ruoyi/message';
import { getToken } from '@/adapters/ruoyi/token';
import { getInfo } from '@/services/ruoyi/user';
import * as appRuntime from './app';
import { getInitialState, layout, rootContainer } from './app';

jest.mock('@umijs/max', () => ({
  history: {
    location: { pathname: '/ai-call/tasks', search: '?page=1', hash: '#top' },
    replace: jest.fn(),
  },
}));
jest.mock('@/adapters/ruoyi/message', () => ({ setRuoyiMessage: jest.fn() }));
jest.mock('@/adapters/ruoyi/token', () => ({ getToken: jest.fn() }));
jest.mock('@/services/ruoyi/user', () => ({ getInfo: jest.fn() }));
jest.mock('@/components/NotificationCenter', () => (props: any) => (
  <div data-context-key={props.contextKey} data-testid="notification-center" />
));
jest.mock('@/components/SseBootstrap', () => (props: any) => (
  <div
    data-connection-key={props.connectionKey}
    data-enabled={String(props.enabled)}
    data-testid="sse-bootstrap"
  />
));
jest.mock('@/components/UserMenu', () => ({ children }: any) => children);

const mockHistory = history as any;

const userResponse = (userId: number, roles: string[] = []) => ({
  data: {
    user: { userId, userName: 'admin', nickName: '管理员' },
    roles,
    permissions: ['ai_call:agent:manage'],
  },
});

describe('Umi runtime exports', () => {
  it('只导出 Umi 支持的运行时配置', () => {
    expect(Object.keys(appRuntime).sort()).toEqual(
      ['getInitialState', 'layout', 'request', 'rootContainer'].sort(),
    );
  });
});

describe('getInitialState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHistory.location = {
      pathname: '/ai-call/tasks',
      search: '?page=1',
      hash: '#top',
    };
  });

  it('有 Token 时读取并映射用户、角色和权限', async () => {
    jest.mocked(getToken).mockReturnValue('token');
    jest.mocked(getInfo).mockResolvedValue(userResponse(2, ['operator']) as never);

    const state = await getInitialState();

    expect(getInfo).toHaveBeenCalledWith({ skipErrorHandler: true });
    expect(state.currentUser).toMatchObject({
      userid: '2',
      name: '管理员',
      roles: ['operator'],
      permissions: ['ai_call:agent:manage'],
    });
  });

  it('受保护路由无 Token 时安全跳转登录页', async () => {
    jest.mocked(getToken).mockReturnValue(null);

    await getInitialState();

    expect(getInfo).not.toHaveBeenCalled();
    expect(history.replace).toHaveBeenCalledWith(
      '/user/login?redirect=%2Fai-call%2Ftasks%3Fpage%3D1%23top',
    );
  });

  it('登录页不读取用户信息', async () => {
    mockHistory.location = { pathname: '/user/login', search: '', hash: '' };
    jest.mocked(getToken).mockReturnValue('token');

    await getInitialState();

    expect(getInfo).not.toHaveBeenCalled();
  });

});

describe('rootContainer', () => {
  it('向 RuoYi 错误适配器注入 Ant Design message', async () => {
    render(rootContainer(<div>AI Reach</div>));

    await waitFor(() => expect(setRuoyiMessage).toHaveBeenCalled());
  });
});

describe('layout background capabilities', () => {
  it('按登录用户挂载一个通知中心与一个 RuoYi SSE，不提供运行时租户切换', () => {
    const config = (layout as any)({
      initialState: {
        currentUser: { userid: '1', name: '管理员', permissions: [] },
      },
    });

    render(
      <>
        {config.actionsRender()}
        {config.childrenRender(<div>页面</div>)}
      </>,
    );

    expect(screen.getByTestId('notification-center').dataset.contextKey).toBe('1');
    expect(screen.getByTestId('sse-bootstrap').dataset.enabled).toBe('true');
    expect(screen.getByTestId('sse-bootstrap').dataset.connectionKey).toBe('1');
    expect(screen.queryByText('租户切换')).toBeNull();
    expect(config.menuDataRender().some((item: any) => item.name === '外呼任务')).toBe(
      false,
    );
  });

});

import * as React from 'react';
import { act, render } from '@testing-library/react';
import { history, useModel } from '@umijs/max';
import { stopSse } from '@/adapters/ruoyi/sse';
import { removeToken } from '@/adapters/ruoyi/token';
import { logout } from '@/services/ruoyi/auth';
import UserMenu from './index';

let dropdownProps: any;
const mockCallOrder: string[] = [];

jest.mock('@umijs/max', () => ({
  history: {
    location: { pathname: '/ai-call/tasks', search: '?page=1', hash: '' },
    push: jest.fn(),
    replace: jest.fn(),
  },
  useModel: jest.fn(),
}));
jest.mock('@/adapters/ruoyi/sse', () => ({
  stopSse: jest.fn(() => mockCallOrder.push('sse')),
}));
jest.mock('@/adapters/ruoyi/token', () => ({
  removeToken: jest.fn(() => mockCallOrder.push('token')),
}));
jest.mock('@/services/ruoyi/auth', () => ({ logout: jest.fn() }));
jest.mock('@/components/HeaderDropdown', () => (props: any) => {
  dropdownProps = props;
  return require('react').createElement('div', null, props.children);
});

describe('UserMenu', () => {
  const setInitialState = jest.fn();

  beforeEach(() => {
    mockCallOrder.length = 0;
    jest.clearAllMocks();
    jest.mocked(useModel).mockReturnValue({
      initialState: { currentUser: { userid: '1', name: '管理员' } },
      setInitialState,
    } as never);
    jest.mocked(logout).mockResolvedValue({ code: 200 } as never);
  });

  it('显示偏好设置入口并打开抽屉', async () => {
    render(<UserMenu><button type="button">管理员</button></UserMenu>);

    expect(
      dropdownProps.menu.items.some((item: any) => item?.key === 'preferences'),
    ).toBe(true);

    await act(async () => {
      await dropdownProps.menu.onClick({ key: 'preferences' });
    });

    const update = setInitialState.mock.calls[0][0];
    expect(update({ currentUser: {} })).toMatchObject({
      preferencesOpen: true,
    });
  });

  it('有配置权限时跳转到系统管理的首个配置页', async () => {
    jest.mocked(useModel).mockReturnValue({
      initialState: {
        currentUser: {
          userid: '1',
          name: '管理员',
          permissions: ['ai_call:voice:manage'],
        },
      },
      setInitialState,
    } as never);
    render(<UserMenu><button type="button">管理员</button></UserMenu>);

    expect(
      dropdownProps.menu.items.some((item: any) => item?.key === 'system-management'),
    ).toBe(true);

    await act(async () => {
      await dropdownProps.menu.onClick({ key: 'system-management' });
    });

    expect(history.push).toHaveBeenCalledWith('/ai-call/voices');
  });

  it('退出时按顺序停止 SSE、删除 Token 并跳转登录', async () => {
    render(<UserMenu><button type="button">管理员</button></UserMenu>);

    await act(async () => {
      await dropdownProps.menu.onClick({ key: 'logout' });
    });

    expect(stopSse).toHaveBeenCalled();
    expect(removeToken).toHaveBeenCalled();
    expect(mockCallOrder).toEqual(['sse', 'token']);
    expect(history.replace).toHaveBeenCalledWith(
      '/user/login?redirect=%2Fai-call%2Ftasks%3Fpage%3D1',
    );
  });
});

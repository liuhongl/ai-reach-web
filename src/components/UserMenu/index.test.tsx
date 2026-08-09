import * as React from 'react';
import { act, render } from '@testing-library/react';
import { history, useModel } from '@umijs/max';
import { clearStoredDynamicTenantId } from '@/adapters/ruoyi/dynamicTenant';
import { stopSse } from '@/adapters/ruoyi/sse';
import { removeToken } from '@/adapters/ruoyi/token';
import { logout } from '@/services/ruoyi/auth';
import UserMenu from './index';

let dropdownProps: any;
const mockCallOrder: string[] = [];

jest.mock('@umijs/max', () => ({
  history: {
    location: { pathname: '/ai-call/tasks', search: '?page=1', hash: '' },
    replace: jest.fn(),
  },
  useModel: jest.fn(),
}));
jest.mock('@/adapters/ruoyi/dynamicTenant', () => ({
  clearStoredDynamicTenantId: jest.fn(() => mockCallOrder.push('tenant')),
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
  beforeEach(() => {
    mockCallOrder.length = 0;
    jest.clearAllMocks();
    jest.mocked(useModel).mockReturnValue({
      initialState: { currentUser: { userid: '1', name: '管理员' } },
      setInitialState: jest.fn(),
    } as never);
    jest.mocked(logout).mockResolvedValue({ code: 200 } as never);
  });

  it('退出时按顺序停止 SSE、删除 Token、清除租户并跳转登录', async () => {
    render(<UserMenu><button type="button">管理员</button></UserMenu>);

    await act(async () => {
      await dropdownProps.menu.onClick({ key: 'logout' });
    });

    expect(stopSse).toHaveBeenCalled();
    expect(removeToken).toHaveBeenCalled();
    expect(clearStoredDynamicTenantId).toHaveBeenCalled();
    expect(mockCallOrder).toEqual(['sse', 'token', 'tenant']);
    expect(history.replace).toHaveBeenCalledWith(
      '/user/login?redirect=%2Fai-call%2Ftasks%3Fpage%3D1',
    );
  });
});

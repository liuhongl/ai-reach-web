import * as React from 'react';
import { render, waitFor } from '@testing-library/react';
import { history } from '@umijs/max';
import {
  clearStoredDynamicTenantId,
  getStoredDynamicTenantId,
} from '@/adapters/ruoyi/dynamicTenant';
import { setRuoyiMessage } from '@/adapters/ruoyi/message';
import { getToken } from '@/adapters/ruoyi/token';
import { switchTenant } from '@/services/ruoyi/tenant-context';
import { getInfo } from '@/services/ruoyi/user';
import { getInitialState, rootContainer } from './app';

jest.mock('@umijs/max', () => ({
  history: {
    location: { pathname: '/ai-call/tasks', search: '?page=1', hash: '#top' },
    replace: jest.fn(),
  },
}));
jest.mock('@/adapters/ruoyi/dynamicTenant', () => ({
  clearStoredDynamicTenantId: jest.fn(),
  getStoredDynamicTenantId: jest.fn(),
}));
jest.mock('@/adapters/ruoyi/message', () => ({ setRuoyiMessage: jest.fn() }));
jest.mock('@/adapters/ruoyi/token', () => ({ getToken: jest.fn() }));
jest.mock('@/services/ruoyi/tenant-context', () => ({ switchTenant: jest.fn() }));
jest.mock('@/services/ruoyi/user', () => ({ getInfo: jest.fn() }));

const mockHistory = history as any;

const userResponse = (userId: number, roles: string[] = []) => ({
  data: {
    user: { userId, userName: 'admin', nickName: '管理员' },
    roles,
    permissions: ['ai_call:agent:manage'],
  },
});

describe('getInitialState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHistory.location = {
      pathname: '/ai-call/tasks',
      search: '?page=1',
      hash: '#top',
    };
    jest.mocked(getStoredDynamicTenantId).mockReturnValue(undefined);
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

  it('普通用户清除误留的本地动态租户', async () => {
    jest.mocked(getToken).mockReturnValue('token');
    jest.mocked(getInfo).mockResolvedValue(userResponse(2) as never);
    jest.mocked(getStoredDynamicTenantId).mockReturnValue('100001');

    const state = await getInitialState();

    expect(clearStoredDynamicTenantId).toHaveBeenCalled();
    expect(switchTenant).not.toHaveBeenCalled();
    expect(state.dynamicTenantId).toBeUndefined();
  });

  it('超级管理员恢复已保存的动态租户', async () => {
    jest.mocked(getToken).mockReturnValue('token');
    jest.mocked(getInfo).mockResolvedValue(userResponse(1, ['admin']) as never);
    jest.mocked(getStoredDynamicTenantId).mockReturnValue('100001');
    jest.mocked(switchTenant).mockResolvedValue({ code: 200 } as never);

    const state = await getInitialState();

    expect(switchTenant).toHaveBeenCalledWith('100001');
    expect(state.dynamicTenantId).toBe('100001');
  });
});

describe('rootContainer', () => {
  it('向 RuoYi 错误适配器注入 Ant Design message', async () => {
    render(rootContainer(<div>AI Reach</div>));

    await waitFor(() => expect(setRuoyiMessage).toHaveBeenCalled());
  });
});

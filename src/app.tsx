import * as React from 'react';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { App as AntdApp } from 'antd';
import {
  clearStoredDynamicTenantId,
  getStoredDynamicTenantId,
} from '@/adapters/ruoyi/dynamicTenant';
import { setRuoyiMessage } from '@/adapters/ruoyi/message';
import { RuoYiCode, RuoyiError } from '@/adapters/ruoyi/response';
import { getToken } from '@/adapters/ruoyi/token';
import { buildAiCallMenu } from '@/aiCallNavigation';
import Footer from '@/components/Footer';
import TenantSwitch from '@/components/TenantSwitch';
import UserMenu from '@/components/UserMenu';
import { switchTenant } from '@/services/ruoyi/tenant-context';
import { getInfo, type UserInfo } from '@/services/ruoyi/user';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

const loginPath = '/user/login';

export type RuoyiCurrentUser = API.CurrentUser & {
  roles: string[];
  permissions: string[];
  rawUser?: UserInfo['user'];
};

export const toCurrentUser = (
  info?: UserInfo,
): RuoyiCurrentUser | undefined => {
  const user = info?.user;
  if (!user) return undefined;
  const roles = info.roles ?? [];
  return {
    userid: String(user.userId ?? ''),
    name: user.nickName || user.userName || '用户',
    avatar: user.avatar,
    email: user.email,
    phone: user.phonenumber,
    access: roles.includes('admin') ? 'admin' : 'user',
    roles,
    permissions: info.permissions ?? [],
    rawUser: user,
  };
};

const redirectToLogin = () => {
  const { pathname, search, hash } = history.location;
  if (pathname !== loginPath) {
    history.replace(
      `${loginPath}?redirect=${encodeURIComponent(pathname + search + hash)}`,
    );
  }
};

const restoreDynamicTenant = async (currentUser?: RuoyiCurrentUser) => {
  const tenantId = getStoredDynamicTenantId();
  if (!tenantId || !currentUser) return undefined;
  if (Number(currentUser.rawUser?.userId) !== 1) {
    clearStoredDynamicTenantId();
    return undefined;
  }

  try {
    await switchTenant(tenantId);
    return tenantId;
  } catch (error) {
    if (
      error instanceof RuoyiError &&
      [RuoYiCode.UNAUTHORIZED, 403].includes(Number(error.code))
    ) {
      clearStoredDynamicTenantId();
    }
    return undefined;
  }
};

export type AiReachInitialState = {
  currentUser?: RuoyiCurrentUser;
  dynamicTenantId?: string;
  fetchUserInfo: () => Promise<RuoyiCurrentUser | undefined>;
  settings: typeof defaultSettings;
  tenantSwitchVersion: number;
};

export async function getInitialState(): Promise<AiReachInitialState> {
  const fetchUserInfo = async () => {
    try {
      const response = await getInfo({ skipErrorHandler: true });
      return toCurrentUser(response.data);
    } catch {
      redirectToLogin();
      return undefined;
    }
  };

  if (history.location.pathname === loginPath) {
    return {
      fetchUserInfo,
      settings: defaultSettings,
      tenantSwitchVersion: 0,
    };
  }

  if (!getToken()) {
    redirectToLogin();
    return {
      fetchUserInfo,
      settings: defaultSettings,
      tenantSwitchVersion: 0,
    };
  }

  const currentUser = await fetchUserInfo();
  const dynamicTenantId = await restoreDynamicTenant(currentUser);
  return {
    currentUser,
    dynamicTenantId,
    fetchUserInfo,
    settings: defaultSettings,
    tenantSwitchVersion: 0,
  };
}

export const layout: RunTimeLayoutConfig = ({ initialState }) => ({
  ...defaultSettings,
  actionsRender: () => [<TenantSwitch key="tenant" />],
  avatarProps: initialState?.currentUser
    ? {
        title: initialState.currentUser.name,
        render: () => (
          <UserMenu>
            <span>{initialState.currentUser?.name || '用户'}</span>
          </UserMenu>
        ),
      }
    : false,
  footerRender: () => <Footer />,
  menuDataRender: () =>
    buildAiCallMenu(initialState?.currentUser?.permissions ?? []),
  onPageChange: () => {
    if (!initialState?.currentUser && history.location.pathname !== loginPath) {
      redirectToLogin();
    }
  },
});

const RuoyiAppBridge = ({ children }: { children: React.ReactNode }) => {
  const { message } = AntdApp.useApp();

  React.useEffect(() => setRuoyiMessage(message), [message]);
  return <>{children}</>;
};

export const request: RequestConfig = { ...errorConfig };

export function rootContainer(container: React.ReactNode) {
  return (
    <AntdApp>
      <RuoyiAppBridge>{container}</RuoyiAppBridge>
    </AntdApp>
  );
}

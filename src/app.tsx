import * as React from 'react';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { App as AntdApp } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { setRuoyiMessage } from '@/adapters/ruoyi/message';
import { getToken } from '@/adapters/ruoyi/token';
import { buildAiCallMenu } from '@/aiCallNavigation';
import Footer from '@/components/Footer';
import NotificationCenter from '@/components/NotificationCenter';
import PreferencesDrawer from '@/components/PreferencesDrawer';
import SseBootstrap from '@/components/SseBootstrap';
import UserMenu from '@/components/UserMenu';
import {
  type AiReachPreferences,
  buildPreferenceSettings,
  readPreferences,
} from '@/preferences';
import { getInfo, type UserInfo } from '@/services/ruoyi/user';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

dayjs.extend(relativeTime);

const loginPath = '/user/login';

export type RuoyiCurrentUser = API.CurrentUser & {
  roles: string[];
  permissions: string[];
  rawUser?: UserInfo['user'];
};

const toCurrentUser = (info?: UserInfo): RuoyiCurrentUser | undefined => {
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

export type AiReachInitialState = {
  currentUser?: RuoyiCurrentUser;
  fetchUserInfo: () => Promise<RuoyiCurrentUser | undefined>;
  preferences: AiReachPreferences;
  settings: typeof defaultSettings;
  preferencesOpen: boolean;
};

export async function getInitialState(): Promise<AiReachInitialState> {
  const preferences = readPreferences();
  const settings = {
    ...defaultSettings,
    ...buildPreferenceSettings(preferences),
  } as typeof defaultSettings;
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
      preferences,
      preferencesOpen: false,
      settings,
    };
  }

  if (!getToken()) {
    redirectToLogin();
    return {
      fetchUserInfo,
      preferences,
      preferencesOpen: false,
      settings,
    };
  }

  const currentUser = await fetchUserInfo();
  return {
    currentUser,
    fetchUserInfo,
    preferences,
    preferencesOpen: false,
    settings,
  };
}

export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  const connectionKey = initialState?.currentUser?.userid || 'anonymous';
  const enabled = Boolean(initialState?.currentUser);

  return {
    ...defaultSettings,
    ...initialState?.settings,
    actionsRender: () => [
      <NotificationCenter
        contextKey={connectionKey}
        enabled={enabled}
        key="notification"
      />,
    ],
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
    childrenRender: (children) => (
      <>
        <PreferencesDrawer />
        <SseBootstrap connectionKey={connectionKey} enabled={enabled} />
        {children}
      </>
    ),
    footerRender: () => <Footer />,
    menuDataRender: () =>
      buildAiCallMenu(initialState?.currentUser?.permissions ?? []),
    onPageChange: () => {
      if (
        !initialState?.currentUser &&
        history.location.pathname !== loginPath
      ) {
        redirectToLogin();
      }
    },
  };
};

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

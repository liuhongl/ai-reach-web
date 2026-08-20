import * as React from 'react';
import {
  LogoutOutlined,
  SettingOutlined,
  SkinOutlined,
} from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { stopSse } from '@/adapters/ruoyi/sse';
import { removeToken } from '@/adapters/ruoyi/token';
import { getFirstAiCallSystemPath } from '@/aiCallNavigation';
import HeaderDropdown from '@/components/HeaderDropdown';
import { logout } from '@/services/ruoyi/auth';

const loginPath = '/user/login';

export default function UserMenu({ children }: { children: React.ReactNode }) {
  const { initialState, setInitialState } = useModel('@@initialState');
  const systemManagementPath = getFirstAiCallSystemPath(
    initialState?.currentUser?.permissions ?? [],
  );

  const onMenuClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'preferences') {
      setInitialState((state) =>
        state ? { ...state, preferencesOpen: true } : state,
      );
      return;
    }

    if (key === 'system-management' && systemManagementPath) {
      history.push(systemManagementPath);
      return;
    }

    if (key !== 'logout') return;

    try {
      await logout();
    } finally {
      stopSse();
      removeToken();
      setInitialState((state) =>
        state ? { ...state, currentUser: undefined } : state,
      );

      const { pathname, search, hash } = history.location;
      const redirect = encodeURIComponent(pathname + search + hash);
      history.replace(`${loginPath}?redirect=${redirect}`);
    }
  };

  return (
    <HeaderDropdown
      arrow
      menu={{
        items: [
          {
            key: 'preferences',
            icon: <SkinOutlined />,
            label: '偏好设置',
          },
          ...(systemManagementPath
            ? [
                {
                  key: 'system-management',
                  icon: <SettingOutlined />,
                  label: '系统管理',
                },
              ]
            : []),
          { type: 'divider' },
          {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: '退出登录',
          },
        ],
        onClick: onMenuClick,
      }}
      placement="bottomRight"
      trigger={['click']}
    >
      {children}
    </HeaderDropdown>
  );
}

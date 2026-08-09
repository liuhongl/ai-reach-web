import * as React from 'react';
import { LogoutOutlined } from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { stopSse } from '@/adapters/ruoyi/sse';
import { removeToken } from '@/adapters/ruoyi/token';
import HeaderDropdown from '@/components/HeaderDropdown';
import { logout } from '@/services/ruoyi/auth';

const loginPath = '/user/login';

export default function UserMenu({ children }: { children: React.ReactNode }) {
  const { setInitialState } = useModel('@@initialState');

  const onMenuClick: MenuProps['onClick'] = async ({ key }) => {
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

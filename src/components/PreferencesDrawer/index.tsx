import * as React from 'react';
import { useModel } from '@umijs/max';
import { Drawer, Radio, Space, Switch, Typography } from 'antd';
import {
  DEFAULT_PREFERENCES,
  type AiReachPreferences,
  buildPreferenceSettings,
  writePreferences,
} from '@/preferences';

const colorOptions = [
  { label: '酱紫', value: '#722ED1' },
  { label: '科技蓝', value: '#1677FF' },
  { label: '明青', value: '#13C2C2' },
  { label: '极光绿', value: '#52C41A' },
];

export default function PreferencesDrawer() {
  const { initialState, setInitialState } = useModel('@@initialState');
  const preferences = initialState?.preferences ?? DEFAULT_PREFERENCES;

  const updatePreferences = (patch: Partial<AiReachPreferences>) => {
    const next = { ...preferences, ...patch };
    writePreferences(next);
    setInitialState((state) =>
      state
        ? {
            ...state,
            preferences: next,
            settings: {
              ...state.settings,
              ...buildPreferenceSettings(next),
            },
          }
        : state,
    );
  };

  return (
    <Drawer
      onClose={() =>
        setInitialState((state) =>
          state ? { ...state, preferencesOpen: false } : state,
        )
      }
      open={Boolean(initialState?.preferencesOpen)}
      size={360}
      title="偏好设置"
    >
      <Space orientation="vertical" size={24} style={{ width: '100%' }}>
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text strong>整体风格</Typography.Text>
          <Radio.Group
            block
            buttonStyle="solid"
            onChange={(event) =>
              updatePreferences({ appearance: event.target.value })
            }
            optionType="button"
            options={[
              { label: '默认浅色', value: 'light' },
              { label: '深色导航', value: 'dark-nav' },
            ]}
            value={preferences.appearance}
          />
        </Space>

        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text strong>主题色</Typography.Text>
          <Radio.Group
            onChange={(event) =>
              updatePreferences({ colorPrimary: event.target.value })
            }
            optionType="button"
            options={colorOptions}
            value={preferences.colorPrimary}
          />
        </Space>

        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text strong>布局设置</Typography.Text>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Typography.Text>固定顶栏</Typography.Text>
            <Switch
              aria-label="固定顶栏"
              checked={preferences.fixedHeader}
              onChange={(fixedHeader) => updatePreferences({ fixedHeader })}
            />
          </Space>
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Typography.Text>固定侧边栏</Typography.Text>
            <Switch
              aria-label="固定侧边栏"
              checked={preferences.fixSiderbar}
              onChange={(fixSiderbar) => updatePreferences({ fixSiderbar })}
            />
          </Space>
        </Space>
      </Space>
    </Drawer>
  );
}

import type { ProLayoutProps } from '@ant-design/pro-components';

export const PREFERENCES_KEY = 'ai-reach:preferences';

const appearances = ['light', 'dark-nav'] as const;
export const PRIMARY_COLORS = [
  '#722ED1',
  '#1677FF',
  '#13C2C2',
  '#52C41A',
] as const;

export type AiReachPreferences = {
  appearance: (typeof appearances)[number];
  colorPrimary: (typeof PRIMARY_COLORS)[number];
  fixedHeader: boolean;
  fixSiderbar: boolean;
};

export const DEFAULT_PREFERENCES: AiReachPreferences = {
  appearance: 'light',
  colorPrimary: '#722ED1',
  fixedHeader: false,
  fixSiderbar: true,
};

export const buildPreferenceSettings = (
  preferences: AiReachPreferences,
): Partial<ProLayoutProps> => ({
  navTheme: 'light',
  colorPrimary: preferences.colorPrimary,
  fixedHeader: preferences.fixedHeader,
  fixSiderbar: preferences.fixSiderbar,
  token:
    preferences.appearance === 'dark-nav'
      ? {
          sider: {
            colorMenuBackground: '#1a1d24',
            colorBgMenuItemActive: `${preferences.colorPrimary}29`,
            colorBgMenuItemHover: `${preferences.colorPrimary}1A`,
            colorBgMenuItemSelected: `${preferences.colorPrimary}29`,
            colorMenuItemDivider: 'rgba(255, 255, 255, 0.08)',
            colorTextMenu: '#c9ced8',
            colorTextMenuActive: '#ffffff',
            colorTextMenuItemHover: '#ffffff',
            colorTextMenuSecondary: '#7d8492',
            colorTextMenuSelected: '#ffffff',
            colorTextMenuTitle: '#ffffff',
            colorTextSubMenuSelected: '#ffffff',
            colorBgCollapsedButton: '#252934',
            colorTextCollapsedButton: '#c9ced8',
            colorTextCollapsedButtonHover: preferences.colorPrimary,
          },
        }
      : undefined,
});

export const readPreferences = (): AiReachPreferences => {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFERENCES };

  try {
    const parsed = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
    const value = parsed && typeof parsed === 'object' ? parsed : {};

    return {
      appearance: appearances.includes(value.appearance)
        ? value.appearance
        : DEFAULT_PREFERENCES.appearance,
      colorPrimary: PRIMARY_COLORS.includes(value.colorPrimary)
        ? value.colorPrimary
        : DEFAULT_PREFERENCES.colorPrimary,
      fixedHeader:
        typeof value.fixedHeader === 'boolean'
          ? value.fixedHeader
          : DEFAULT_PREFERENCES.fixedHeader,
      fixSiderbar:
        typeof value.fixSiderbar === 'boolean'
          ? value.fixSiderbar
          : DEFAULT_PREFERENCES.fixSiderbar,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
};

export const writePreferences = (value: AiReachPreferences) => {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value));
  } catch {
    // 浏览器禁用或存储空间不足时，保留当前内存设置。
  }
};

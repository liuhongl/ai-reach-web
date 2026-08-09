import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useModel } from '@umijs/max';
import { PREFERENCES_KEY } from '@/preferences';
import PreferencesDrawer from './index';

jest.mock('@umijs/max', () => ({ useModel: jest.fn() }));
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    Drawer: ({ children, open, title }: any) =>
      open
        ? require('react').createElement(
            'div',
            { 'aria-label': String(title), role: 'dialog' },
            title,
            children,
          )
        : null,
  };
});

describe('PreferencesDrawer', () => {
  const setInitialState = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.mocked(useModel).mockReturnValue({
      initialState: {
        preferencesOpen: true,
        preferences: {
          appearance: 'light',
          colorPrimary: '#722ED1',
          fixedHeader: false,
          fixSiderbar: true,
        },
        settings: {
          navTheme: 'light',
          colorPrimary: '#722ED1',
          fixedHeader: false,
          fixSiderbar: true,
        },
      },
      setInitialState,
    } as never);
  });

  it('只展示四项正式用户偏好', () => {
    render(<PreferencesDrawer />);

    expect(screen.getByText('整体风格')).toBeTruthy();
    expect(screen.getByText('主题色')).toBeTruthy();
    expect(screen.getByLabelText('固定顶栏')).toBeTruthy();
    expect(screen.getByLabelText('固定侧边栏')).toBeTruthy();
    expect(screen.queryByText('导航模式')).toBeNull();
    expect(screen.queryByText('复制配置')).toBeNull();
  });

  it('选择主题色后立即保存并更新布局设置', () => {
    render(<PreferencesDrawer />);

    fireEvent.click(screen.getByText('科技蓝'));

    expect(JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}')).toEqual({
      appearance: 'light',
      colorPrimary: '#1677FF',
      fixedHeader: false,
      fixSiderbar: true,
    });

    const update = setInitialState.mock.calls[0][0];
    expect(
      update({
        preferencesOpen: true,
        preferences: {
          appearance: 'light',
          colorPrimary: '#722ED1',
          fixedHeader: false,
          fixSiderbar: true,
        },
        settings: { colorPrimary: '#722ED1' },
      }),
    ).toMatchObject({
      preferences: { colorPrimary: '#1677FF' },
      settings: { colorPrimary: '#1677FF' },
    });
  });
});

import * as React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { history, useModel } from '@umijs/max';
import { setToken } from '@/adapters/ruoyi/token';
import { getCodeImg, getTenantList, login } from '@/services/ruoyi/auth';
import LoginPage, { resolveLoginRedirect } from './index';

let loginFormProps: any;
const mockMessage = { error: jest.fn(), success: jest.fn() };
const mockSetInitialState = jest.fn();
const mockFetchUserInfo = jest.fn();

jest.mock('@ant-design/pro-components', () => {
  const React = require('react');
  const LoginForm = (props: any) => {
    loginFormProps = props;
    return React.createElement('form', null, props.children);
  };
  const ProFormText = () => null;
  ProFormText.Password = () => null;
  return { LoginForm, ProFormSelect: () => null, ProFormText };
});
jest.mock('@umijs/max', () => ({
  history: {
    location: { pathname: '/user/login', search: '?redirect=%2Fai-call%2Ftasks' },
    replace: jest.fn(),
  },
  useModel: jest.fn(),
}));
jest.mock('antd', () => {
  const React = require('react');
  return {
    Alert: () => null,
    App: { useApp: () => ({ message: mockMessage }) },
    Button: ({ loading: _loading, ...props }: any) =>
      React.createElement('button', props),
    Form: {
      Item: ({ children }: any) => children,
      useForm: () => [
        {
          getFieldValue: jest.fn(),
          setFieldsValue: jest.fn(),
        },
      ],
    },
  };
});
jest.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: new Proxy({}, { get: (_target, key) => String(key) }),
  }),
}));
jest.mock('@/adapters/ruoyi/token', () => ({ setToken: jest.fn() }));
jest.mock('@/components/Footer', () => () => null);
jest.mock('@/services/ruoyi/auth', () => ({
  getCodeImg: jest.fn(),
  getTenantList: jest.fn(),
  login: jest.fn(),
}));

describe('resolveLoginRedirect', () => {
  it.each([
    ['/ai-call/tasks', '/ai-call/tasks'],
    ['/', '/ai-call/statistics'],
    [null, '/ai-call/statistics'],
    ['https://evil.example/path', '/ai-call/statistics'],
    ['//evil.example/path', '/ai-call/statistics'],
    ['/user/login', '/ai-call/statistics'],
  ])('将 %s 解析为 %s', (redirect, expected) => {
    expect(resolveLoginRedirect(redirect)).toBe(expected);
  });
});

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useModel).mockReturnValue({
      initialState: { fetchUserInfo: mockFetchUserInfo },
      setInitialState: mockSetInitialState,
    } as never);
    jest.mocked(getCodeImg).mockResolvedValue({
      data: { captchaEnabled: false },
    } as never);
    jest.mocked(getTenantList).mockResolvedValue({
      data: { tenantEnabled: false, voList: [] },
    } as never);
    mockFetchUserInfo.mockResolvedValue({ userid: '1', name: '管理员' });
  });

  it('登录成功后保存 Token、刷新用户并安全回跳', async () => {
    jest.mocked(login).mockResolvedValue({
      data: { access_token: 'reach-token' },
    } as never);
    render(<LoginPage />);
    await waitFor(() => expect(getCodeImg).toHaveBeenCalled());
    expect(loginFormProps.initialValues).toEqual({
      tenantId: '000000',
      username: '',
      password: '',
      code: '',
      uuid: '',
    });

    await act(async () => {
      await loginFormProps.onFinish({ username: 'admin', password: 'secret' });
    });

    expect(setToken).toHaveBeenCalledWith('reach-token');
    expect(mockFetchUserInfo).toHaveBeenCalled();
    expect(mockSetInitialState).toHaveBeenCalled();
    expect(history.replace).toHaveBeenCalledWith('/ai-call/tasks');
  });

  it('根地址登录后等待用户状态更新并进入数据看板', async () => {
    jest.mocked(login).mockResolvedValue({
      data: { access_token: 'reach-token' },
    } as never);
    Object.assign(history.location, { search: '?redirect=%2F' });
    let finishStateUpdate!: () => void;
    mockSetInitialState.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishStateUpdate = resolve;
        }),
    );
    render(<LoginPage />);
    await waitFor(() => expect(getCodeImg).toHaveBeenCalled());

    let submitPromise!: Promise<void>;
    act(() => {
      submitPromise = loginFormProps.onFinish({
        username: 'admin',
        password: 'secret',
      });
    });
    await waitFor(() => expect(mockSetInitialState).toHaveBeenCalled());

    expect(history.replace).not.toHaveBeenCalled();
    finishStateUpdate();
    await act(async () => submitPromise);
    expect(history.replace).toHaveBeenCalledWith('/ai-call/statistics');
  });
});

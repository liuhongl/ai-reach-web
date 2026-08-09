import * as React from 'react';
import { act, render } from '@testing-library/react';
import { useModel } from '@umijs/max';
import { setStoredDynamicTenantId } from '@/adapters/ruoyi/dynamicTenant';
import { getTenantList } from '@/services/ruoyi/auth';
import { switchTenant } from '@/services/ruoyi/tenant-context';
import TenantSwitch from './index';

let selectProps: any;
const mockSetInitialState = jest.fn();
const mockFetchUserInfo = jest.fn();

jest.mock('@umijs/max', () => ({ useModel: jest.fn() }));
jest.mock('antd', () => ({
  App: { useApp: () => ({ message: { error: jest.fn(), success: jest.fn() } }) },
  Select: (props: any) => {
    selectProps = props;
    return require('react').createElement('div', {
      'data-testid': 'tenant-switch',
    });
  },
}));
jest.mock('@/adapters/ruoyi/dynamicTenant', () => ({
  clearStoredDynamicTenantId: jest.fn(),
  setStoredDynamicTenantId: jest.fn(),
}));
jest.mock('@/services/ruoyi/auth', () => ({ getTenantList: jest.fn() }));
jest.mock('@/services/ruoyi/tenant-context', () => ({
  clearTenant: jest.fn(),
  switchTenant: jest.fn(),
}));

describe('TenantSwitch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    selectProps = undefined;
    mockFetchUserInfo.mockResolvedValue({ userid: '1', name: '管理员' });
    jest.mocked(getTenantList).mockResolvedValue({
      data: {
        tenantEnabled: true,
        voList: [{ tenantId: '100001', companyName: '测试租户' }],
      },
    } as never);
  });

  it('仅用户 ID 为 1 时显示', async () => {
    jest.mocked(useModel).mockReturnValue({
      initialState: { currentUser: { userid: '2' } },
      setInitialState: mockSetInitialState,
    } as never);
    const { queryByTestId, rerender } = render(<TenantSwitch />);
    expect(queryByTestId('tenant-switch')).toBeNull();

    jest.mocked(useModel).mockReturnValue({
      initialState: {
        currentUser: { userid: '1' },
        fetchUserInfo: mockFetchUserInfo,
      },
      setInitialState: mockSetInitialState,
    } as never);
    rerender(<TenantSwitch />);

    await act(async () => undefined);
    expect(getTenantList).toHaveBeenCalledWith(true);
  });

  it('切换租户后刷新用户并更新版本', async () => {
    jest.mocked(useModel).mockReturnValue({
      initialState: {
        currentUser: { userid: '1' },
        fetchUserInfo: mockFetchUserInfo,
      },
      setInitialState: mockSetInitialState,
    } as never);
    jest.mocked(switchTenant).mockResolvedValue({ code: 200 } as never);
    render(<TenantSwitch />);
    await act(async () => undefined);

    await act(async () => selectProps.onChange('100001'));

    expect(switchTenant).toHaveBeenCalledWith('100001');
    expect(setStoredDynamicTenantId).toHaveBeenCalledWith('100001');
    expect(mockFetchUserInfo).toHaveBeenCalled();
    expect(mockSetInitialState).toHaveBeenCalled();
    const updater = mockSetInitialState.mock.calls[0][0];
    expect(updater({ tenantSwitchVersion: 2 })).toMatchObject({
      currentUser: { userid: '1' },
      dynamicTenantId: '100001',
      tenantSwitchVersion: 3,
    });
  });
});

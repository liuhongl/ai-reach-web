import * as React from 'react';
import { BankOutlined } from '@ant-design/icons';
import { useModel } from '@umijs/max';
import { App, Select } from 'antd';
import {
  clearStoredDynamicTenantId,
  setStoredDynamicTenantId,
} from '@/adapters/ruoyi/dynamicTenant';
import { getTenantList, type TenantInfo } from '@/services/ruoyi/auth';
import { clearTenant, switchTenant } from '@/services/ruoyi/tenant-context';

type TenantOption = TenantInfo['voList'][number];

const getUserId = (currentUser?: {
  userid?: string;
  rawUser?: { userId?: number | string };
}) => currentUser?.rawUser?.userId ?? currentUser?.userid;

export default function TenantSwitch() {
  const { message } = App.useApp();
  const { initialState, setInitialState } = useModel('@@initialState');
  const [tenants, setTenants] = React.useState<TenantOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const isSuperAdmin = Number(getUserId(initialState?.currentUser)) === 1;

  React.useEffect(() => {
    if (!isSuperAdmin) {
      setTenants([]);
      return;
    }

    let mounted = true;
    setLoading(true);
    getTenantList(true)
      .then((response) => {
        if (!mounted) return;
        setTenants(
          response.data?.tenantEnabled === false ? [] : response.data?.voList ?? [],
        );
      })
      .catch(() => {
        if (mounted) setTenants([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isSuperAdmin]);

  if (!isSuperAdmin || tenants.length === 0) return null;

  const handleChange = async (tenantId?: string) => {
    setLoading(true);
    try {
      if (tenantId) {
        await switchTenant(tenantId);
        setStoredDynamicTenantId(tenantId);
      } else {
        await clearTenant();
        clearStoredDynamicTenantId();
      }

      const currentUser = await initialState?.fetchUserInfo?.();
      setInitialState((state) =>
        state
          ? {
              ...state,
              currentUser,
              dynamicTenantId: tenantId,
              tenantSwitchVersion: state.tenantSwitchVersion + 1,
            }
          : state,
      );
      message.success(tenantId ? '租户切换成功' : '已恢复默认租户');
    } catch {
      message.error('租户切换失败，请重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select
      allowClear
      loading={loading}
      options={tenants.map((tenant) => ({
        label: tenant.companyName,
        value: tenant.tenantId,
      }))}
      placeholder="切换租户"
      prefix={<BankOutlined />}
      showSearch={{ optionFilterProp: 'label' }}
      style={{ width: 220 }}
      value={initialState?.dynamicTenantId}
      onChange={handleChange}
    />
  );
}

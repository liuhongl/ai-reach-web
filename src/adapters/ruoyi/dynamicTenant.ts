const DynamicTenantKey = 'Ruoyi-Dynamic-Tenant-Id';

const canUseSessionStorage = () => typeof sessionStorage !== 'undefined';

export const getStoredDynamicTenantId = () => {
  if (!canUseSessionStorage()) return undefined;
  return sessionStorage.getItem(DynamicTenantKey) || undefined;
};

export const setStoredDynamicTenantId = (tenantId: string) => {
  if (!canUseSessionStorage()) return;
  sessionStorage.setItem(DynamicTenantKey, tenantId);
};

export const clearStoredDynamicTenantId = () => {
  if (!canUseSessionStorage()) return;
  sessionStorage.removeItem(DynamicTenantKey);
};

import { ruoyiRequest } from '@/adapters/ruoyi/request';

export const switchTenant = (tenantId: string) =>
  ruoyiRequest(`/system/tenant/dynamic/${encodeURIComponent(tenantId)}`, {
    method: 'get',
  });

export const clearTenant = () =>
  ruoyiRequest('/system/tenant/dynamic/clear', { method: 'get' });

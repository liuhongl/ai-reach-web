import { getClientId } from '@/adapters/ruoyi/env';
import { ruoyiRequest } from '@/adapters/ruoyi/request';

export type LoginData = {
  tenantId?: string;
  username?: string;
  password?: string;
  code?: string;
  uuid?: string;
  clientId?: string;
  grantType?: string;
};

export type LoginResult = { access_token: string };

export type VerifyCodeResult = {
  captchaEnabled: boolean;
  uuid?: string;
  img?: string;
};

export type TenantInfo = {
  tenantEnabled: boolean;
  voList: Array<{
    companyName: string;
    domain: unknown;
    tenantId: string;
  }>;
};

export const login = (data: LoginData) =>
  ruoyiRequest<LoginResult>('/auth/login', {
    method: 'post',
    data: {
      ...data,
      clientId: data.clientId || getClientId(),
      grantType: data.grantType || 'password',
    },
    headers: {
      isToken: false,
      isEncrypt: true,
      repeatSubmit: false,
    },
  });

export const logout = () => ruoyiRequest('/auth/logout', { method: 'post' });

export const getCodeImg = () =>
  ruoyiRequest<VerifyCodeResult>('/auth/code', {
    method: 'get',
    headers: { isToken: false },
    timeout: 20000,
  });

export const getTenantList = (isToken: boolean) =>
  ruoyiRequest<TenantInfo>('/auth/tenant/list', {
    method: 'get',
    headers: { isToken },
  });

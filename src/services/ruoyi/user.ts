import {
  ruoyiRequest,
  type RuoyiRequestOptions,
} from '@/adapters/ruoyi/request';

export type PageQuery = {
  pageNum?: number;
  pageSize?: number;
  [key: string]: unknown;
};

export type RuoyiUser = {
  userId?: number | string;
  userName?: string;
  nickName?: string;
  avatar?: string;
  email?: string;
  phonenumber?: string;
  admin?: boolean;
};

export type UserQuery = PageQuery & {
  userName?: string;
  nickName?: string;
  phonenumber?: string;
  status?: string;
  deptId?: number | string;
};

export type UserInfo = {
  user?: RuoyiUser;
  roles?: string[];
  permissions?: string[];
};

export const getInfo = (options: RuoyiRequestOptions = {}) =>
  ruoyiRequest<UserInfo>('/system/user/getInfo', {
    method: 'get',
    ...options,
  });

export const listUsers = (params: UserQuery) =>
  ruoyiRequest<RuoyiUser>('/system/user/list', {
    method: 'get',
    params,
  });

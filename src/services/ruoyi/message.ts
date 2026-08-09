import {
  ruoyiRequest,
  type RuoyiRequestOptions,
} from '@/adapters/ruoyi/request';

export type PageQuery = {
  pageNum?: number;
  pageSize?: number;
  [key: string]: unknown;
};

export type MessageItem = {
  messageId?: number | string;
  tenantId?: string;
  recipientUserId?: number | string;
  contentHtml?: string;
  sendScope?: 'USER' | 'ALL' | string;
  readStatus?: '0' | '1' | string;
  readTime?: string;
  createBy?: number | string;
  createTime?: string;
};

export type MessageQuery = PageQuery & {
  readStatus?: '0' | '1' | string;
};

export const listMessages = (
  params: MessageQuery = {},
  options: RuoyiRequestOptions = {},
) =>
  ruoyiRequest<MessageItem>('/resource/message/list', {
    ...options,
    method: 'get',
    params,
  });

export const getUnreadMessageCount = (options: RuoyiRequestOptions = {}) =>
  ruoyiRequest<number>('/resource/message/unread-count', {
    ...options,
    method: 'get',
  });

export const readMessage = (
  messageId: number | string,
  options: RuoyiRequestOptions = {},
) =>
  ruoyiRequest(`/resource/message/${messageId}/read`, {
    ...options,
    method: 'put',
  });

export const readAllMessages = (options: RuoyiRequestOptions = {}) =>
  ruoyiRequest('/resource/message/read-all', {
    ...options,
    method: 'put',
  });

import { ruoyiRequest } from '@/adapters/ruoyi/request';

const AI_CALL_AGENT_BASE_API = '/ai-call-agent-api';
export const AI_CALL_LINES_PREFIX = '/ai-call/outbound-lines';

type AiCallDataResponse<T> = {
  data?: T;
};

export type AiCallLineRouteMode = 'managed_trunk_id' | 'inline_hostname';
export type AiCallLineAuthMode = 'managed_trunk' | 'ip_allowlist';
export type AiCallLineHealthStatus =
  | 'UNKNOWN'
  | 'AVAILABLE'
  | 'MISCONFIGURED'
  | 'UNAVAILABLE';

export type AiCallLinePayload = {
  lineCode: string;
  lineName: string;
  enabled: boolean;
  adapterType: 'livekit_sip';
  routeMode: AiCallLineRouteMode;
  trunkId?: string | null;
  proxyHost?: string | null;
  proxyPort?: number | null;
  authMode: AiCallLineAuthMode;
  callerNumber: string;
  destinationCountry: string;
  maxConcurrency: number;
  originateTimeoutSeconds: number;
};

export type AiCallLine = AiCallLinePayload & {
  lineId: string;
  isDefault: boolean;
  healthStatus: AiCallLineHealthStatus;
  healthMessage?: string | null;
  lastCheckedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiCallLineHealth = {
  lineId: string;
  healthStatus: AiCallLineHealthStatus;
  healthMessage?: string | null;
  lastCheckedAt: string;
};

export type AiCallLineQuery = {
  pageNum?: number;
  pageSize?: number;
};

export type AiCallLinePage = {
  rows: AiCallLine[];
  total: number;
};

const unwrapData = <T>(response: AiCallDataResponse<T>): T =>
  response.data as T;

const linePath = (lineId: string, suffix = '') =>
  `${AI_CALL_LINES_PREFIX}/${encodeURIComponent(lineId)}${suffix}`;

const requestOptions = {
  baseApi: AI_CALL_AGENT_BASE_API,
} as const;

export const listAiCallLines = async (
  params: AiCallLineQuery,
): Promise<AiCallLinePage> => {
  const response = await ruoyiRequest<AiCallLine>(AI_CALL_LINES_PREFIX, {
    ...requestOptions,
    method: 'get',
    params,
  });
  return {
    rows: Array.isArray(response.rows) ? response.rows : [],
    total: Number(response.total) || 0,
  };
};

export const createAiCallLine = async (payload: AiCallLinePayload) => {
  const response = await ruoyiRequest<AiCallLine>(AI_CALL_LINES_PREFIX, {
    ...requestOptions,
    method: 'post',
    data: payload,
  });
  return unwrapData(response);
};

export const updateAiCallLine = async (
  lineId: string,
  payload: AiCallLinePayload,
) => {
  const response = await ruoyiRequest<AiCallLine>(linePath(lineId), {
    ...requestOptions,
    method: 'put',
    data: payload,
  });
  return unwrapData(response);
};

const postLineAction = async <T>(lineId: string, suffix: string) => {
  const response = await ruoyiRequest<T>(linePath(lineId, suffix), {
    ...requestOptions,
    method: 'post',
  });
  return unwrapData(response);
};

export const preflightAiCallLine = (lineId: string) =>
  postLineAction<AiCallLineHealth>(lineId, '/preflight');

export const setDefaultAiCallLine = (lineId: string) =>
  postLineAction<AiCallLine>(lineId, '/set-default');

export const enableAiCallLine = (lineId: string) =>
  postLineAction<AiCallLine>(lineId, '/enable');

export const disableAiCallLine = (lineId: string) =>
  postLineAction<AiCallLine>(lineId, '/disable');

export const deleteAiCallLine = async (lineId: string) => {
  await ruoyiRequest(linePath(lineId), {
    ...requestOptions,
    method: 'delete',
  });
};

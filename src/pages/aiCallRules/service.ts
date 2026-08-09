import { ruoyiRequest } from '@/adapters/ruoyi/request';
import type { RuoyiResponse } from '@/adapters/ruoyi/response';
import type {
  AiCallRule,
  AiCallRuleMetadata,
  CallRuleFormValue,
} from './domain';

const AI_CALL_AGENT_BASE_API = '/ai-call-agent-api';
const RULES_PATH = '/ai-call/outbound-rules';

export type AiCallRuleQuery = {
  pageNum: number;
  pageSize: number;
  ruleName?: string;
  enabled?: boolean;
};

export type AiCallRulePage = {
  rows: AiCallRule[];
  total: number;
};

const requireEnvelope = <T>(
  response: RuoyiResponse<T> | T,
): RuoyiResponse<T> => {
  if (!response || typeof response !== 'object' || !('code' in response)) {
    throw new Error('接口响应缺少 code');
  }
  return response as RuoyiResponse<T>;
};

const unwrapData = <T>(response: RuoyiResponse<T> | T): T => {
  const envelope = requireEnvelope(response);
  if (envelope.data === undefined) {
    throw new Error('接口响应缺少 data');
  }
  return envelope.data;
};

const unwrapPage = (
  response: RuoyiResponse<AiCallRule> | AiCallRule,
): AiCallRulePage => {
  const envelope = requireEnvelope(response);
  if (!Array.isArray(envelope.rows) || typeof envelope.total !== 'number') {
    throw new Error('分页响应缺少 rows 或 total');
  }
  return { rows: envelope.rows, total: envelope.total };
};

const requestOptions = {
  baseApi: AI_CALL_AGENT_BASE_API,
} as const;

export const getAiCallRuleMetadata = async (): Promise<AiCallRuleMetadata> =>
  unwrapData(
    await ruoyiRequest<AiCallRuleMetadata>(`${RULES_PATH}/meta`, {
      ...requestOptions,
      method: 'get',
    }),
  );

export const listAiCallRules = async (
  params: AiCallRuleQuery,
): Promise<AiCallRulePage> =>
  unwrapPage(
    await ruoyiRequest<AiCallRule>(RULES_PATH, {
      ...requestOptions,
      method: 'get',
      params,
    }),
  );

export const createAiCallRule = async (
  payload: CallRuleFormValue,
): Promise<AiCallRule> =>
  unwrapData(
    await ruoyiRequest<AiCallRule>(RULES_PATH, {
      ...requestOptions,
      method: 'post',
      data: payload,
    }),
  );

export const updateAiCallRule = async (
  ruleId: string,
  payload: CallRuleFormValue,
): Promise<AiCallRule> =>
  unwrapData(
    await ruoyiRequest<AiCallRule>(`${RULES_PATH}/${ruleId}`, {
      ...requestOptions,
      method: 'put',
      data: payload,
    }),
  );

export const deleteAiCallRule = async (ruleId: string): Promise<void> => {
  const response = await ruoyiRequest(`${RULES_PATH}/${ruleId}`, {
    ...requestOptions,
    method: 'delete',
  });
  requireEnvelope(response);
};

export const RuoYiCode = {
  SUCCESS: 200,
  UNAUTHORIZED: 401,
  SERVER_ERROR: 500,
  WARN: 601,
} as const;

export type RuoyiResponse<T = unknown> = {
  code: number;
  msg?: string;
  data?: T;
  rows?: T[];
  total?: number;
};

export class RuoyiError<T = unknown> extends Error {
  code?: number;
  response?: RuoyiResponse<T>;

  constructor(message: string, response?: RuoyiResponse<T>) {
    super(message);
    this.name = 'RuoyiError';
    this.code = response?.code;
    this.response = response;
  }
}

export const isRuoyiResponse = (value: unknown): value is RuoyiResponse => {
  if (!value || typeof value !== 'object') return false;
  return 'code' in value;
};

export const getRuoyiMessage = (response: RuoyiResponse) =>
  response.msg || '请求失败';

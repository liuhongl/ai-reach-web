import { history, request as umiRequest } from '@umijs/max';
import {
  decryptBase64,
  decryptWithAes,
  encryptBase64,
  encryptWithAes,
  generateAesKey,
  isEncryptEnabled,
  rsaDecrypt,
  rsaEncrypt,
} from './crypto';
import { getBaseApi, getClientId } from './env';
import { showRuoyiError } from './message';
import { normalizeRuoyiParams } from './params';
import {
  getRuoyiMessage,
  isRuoyiResponse,
  RuoYiCode,
  RuoyiError,
  type RuoyiResponse,
} from './response';
import { stopSse } from './sse';
import { getToken, removeToken } from './token';

const encryptHeader = 'encrypt-key';
const loginPath = '/user/login';
const repeatSubmitInterval = 500;

type ResponseType = 'arraybuffer' | 'blob' | 'document' | 'json' | 'text';

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, unknown>;
  timeout?: number;
  responseType?: ResponseType;
  skipErrorHandler?: boolean;
  [key: string]: unknown;
};

type AxiosResponse<T = unknown> = {
  data: T;
  headers?: Record<string, string>;
  request?: {
    responseType?: string;
  };
};

type HttpError = {
  message?: string;
  response?: {
    data?: unknown;
    status?: number;
  };
};

type UmiRequest = (url: string, opts: RequestOptions) => Promise<AxiosResponse>;

type InternalHeaders = Record<string, unknown> & {
  isToken?: boolean;
  isEncrypt?: boolean | string;
  repeatSubmit?: boolean;
};

export type RuoyiRequestOptions = {
  baseApi?: string;
  method?: string;
  headers?: InternalHeaders;
  data?: unknown;
  params?: Record<string, unknown>;
  timeout?: number;
  responseType?: ResponseType;
  skipErrorHandler?: boolean;
  isEncrypt?: boolean | string;
  repeatSubmit?: boolean;
  [key: string]: unknown;
};

export type RuoyiRawRequestOptions = RuoyiRequestOptions & {
  responseType: 'blob' | 'arraybuffer';
};

const isTrue = (value: unknown) => value === true || value === 'true';

const normalizeMethod = (method?: string) => (method || 'get').toLowerCase();

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

const isAbsoluteUrl = (url: string) => /^[a-z][a-z\d+\-.]*:\/\//i.test(url);

const withBaseApi = (url: string, baseApi: string) => {
  if (isAbsoluteUrl(url)) return url;

  const base = trimSlashes(baseApi);
  const normalizedBaseApi = base ? `/${base}` : '';
  const normalizedUrl = `/${trimSlashes(url)}`;

  if (!normalizedBaseApi) return normalizedUrl;
  if (normalizedUrl === normalizedBaseApi) return normalizedBaseApi;
  if (normalizedUrl.startsWith(`${normalizedBaseApi}/`)) return normalizedUrl;

  return `${normalizedBaseApi}${normalizedUrl}`;
};

const shouldCheckRepeatSubmit = (
  method: string,
  repeatSubmit?: boolean,
  headers?: InternalHeaders,
) =>
  ['post', 'put'].includes(method) &&
  repeatSubmit !== false &&
  headers?.repeatSubmit !== false;

const checkRepeatSubmit = (url: string, data: unknown) => {
  if (typeof sessionStorage === 'undefined') return;

  const requestObj = {
    url,
    data: typeof data === 'object' ? JSON.stringify(data) : data,
    time: Date.now(),
  };
  const sessionValue = sessionStorage.getItem('sessionObj');
  if (!sessionValue) {
    sessionStorage.setItem('sessionObj', JSON.stringify(requestObj));
    return;
  }

  let sessionObj: typeof requestObj | undefined;
  try {
    sessionObj = JSON.parse(sessionValue) as typeof requestObj;
  } catch {
    sessionStorage.removeItem('sessionObj');
  }

  if (
    sessionObj?.url === requestObj.url &&
    sessionObj?.data === requestObj.data &&
    requestObj.time - sessionObj.time < repeatSubmitInterval
  ) {
    throw new Error('数据正在处理，请勿重复提交');
  }
  sessionStorage.setItem('sessionObj', JSON.stringify(requestObj));
};

const encryptRequestData = (data: unknown) => {
  const aesKey = generateAesKey();
  const encryptedKey = rsaEncrypt(encryptBase64(aesKey));
  const payload = typeof data === 'string' ? data : JSON.stringify(data ?? {});
  return {
    encryptedKey,
    encryptedData: encryptWithAes(payload, aesKey),
  };
};

const toRequestHeaders = (headers: InternalHeaders) =>
  Object.entries(headers).reduce<Record<string, string>>(
    (result, [key, value]) => {
      if (value !== undefined && value !== null) {
        result[key] = String(value);
      }
      return result;
    },
    {},
  );

const hasContentType = (headers: Record<string, string>) =>
  Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');

const withJsonContentType = (headers: Record<string, string>) => {
  if (hasContentType(headers)) return headers;
  return {
    'Content-Type': 'application/json;charset=utf-8',
    ...headers,
  };
};

const isFormData = (data: unknown) =>
  typeof FormData !== 'undefined' && data instanceof FormData;

const decryptResponseData = (encryptedKey: string, data: unknown) => {
  const base64Key = rsaDecrypt(encryptedKey);
  const aesKey = decryptBase64(base64Key);
  const decrypted = decryptWithAes(String(data), aesKey);
  return JSON.parse(decrypted);
};

const getHttpError = (error: unknown): HttpError | undefined =>
  error && typeof error === 'object' ? (error as HttpError) : undefined;

const handleRuoyiErrorResponse = (
  rawData: unknown,
  options: RuoyiRequestOptions,
) => {
  if (!isRuoyiResponse(rawData)) return false;

  if (rawData.code === RuoYiCode.UNAUTHORIZED) {
    redirectToLogin();
    throw new RuoyiError('无效的会话，或者会话已过期，请重新登录。', rawData);
  }

  const errorMessage = getRuoyiMessage(rawData);
  if (!options.skipErrorHandler) {
    showRuoyiError(errorMessage);
  }
  throw new RuoyiError(errorMessage, rawData);
};

const handleUnknownHttpError = (
  error: unknown,
  options: RuoyiRequestOptions,
): never => {
  const httpError = getHttpError(error);
  const rawData = httpError?.response?.data;
  handleRuoyiErrorResponse(rawData, options);

  if (!options.skipErrorHandler) {
    showRuoyiError(
      httpError?.response?.status
        ? `Response status:${httpError.response.status}`
        : httpError?.message || '请求失败',
    );
  }
  throw error;
};

const redirectToLogin = () => {
  stopSse();
  removeToken();
  const { pathname, search, hash } = history.location;
  if (pathname !== loginPath) {
    history.replace(
      `${loginPath}?redirect=${encodeURIComponent(pathname + search + hash)}`,
    );
  }
};

const requestWithBaseApi = async <T = unknown>(
  baseApi: string,
  url: string,
  options: RuoyiRequestOptions = {},
): Promise<RuoyiResponse<T> | T> => {
  const {
    headers: inputHeaders,
    isEncrypt: optionIsEncrypt,
    repeatSubmit,
    ...umiOptions
  } = options;
  const method = normalizeMethod(options.method);
  const headers: InternalHeaders = { ...(inputHeaders || {}) };
  const isToken = headers.isToken === false;
  const shouldEncrypt =
    isEncryptEnabled() &&
    ['post', 'put'].includes(method) &&
    isTrue(optionIsEncrypt ?? headers.isEncrypt);

  if (shouldCheckRepeatSubmit(method, repeatSubmit, headers)) {
    checkRepeatSubmit(url, options.data);
  }

  const token = getToken();
  if (token && !isToken) {
    headers.Authorization = `Bearer ${token}`;
  }
  headers.clientid = getClientId();
  headers['Content-Language'] = 'zh_CN';

  delete headers.isToken;
  delete headers.isEncrypt;
  delete headers.repeatSubmit;

  const requestHeaders = toRequestHeaders(headers);

  const requestOptions: RequestOptions = {
    ...umiOptions,
    headers: requestHeaders,
    method,
    getResponse: true,
    skipErrorHandler: true,
  };

  if (method === 'get') {
    requestOptions.params = normalizeRuoyiParams(requestOptions.params);
  }

  if (
    ['post', 'put', 'patch'].includes(method) &&
    options.data !== undefined &&
    !isFormData(options.data)
  ) {
    requestOptions.headers = withJsonContentType(
      requestOptions.headers || requestHeaders,
    );
  }

  if (shouldEncrypt) {
    const { encryptedData, encryptedKey } = encryptRequestData(options.data);
    requestOptions.data = encryptedData;
    requestOptions.headers = {
      ...withJsonContentType(requestOptions.headers || requestHeaders),
      [encryptHeader]: encryptedKey,
    };
  }

  const request = umiRequest as unknown as UmiRequest;
  const response = await request(
    withBaseApi(url, baseApi),
    requestOptions,
  ).catch((error: unknown) => handleUnknownHttpError(error, options));
  const encryptedKey = response.headers?.[encryptHeader];
  const responseType = response.request?.responseType;
  const rawData =
    isEncryptEnabled() && encryptedKey
      ? decryptResponseData(encryptedKey, response.data)
      : response.data;

  if (responseType === 'blob' || responseType === 'arraybuffer') {
    return rawData as T;
  }

  if (!isRuoyiResponse(rawData)) {
    return rawData as RuoyiResponse<T>;
  }

  if (rawData.code === RuoYiCode.UNAUTHORIZED) {
    redirectToLogin();
    throw new RuoyiError('无效的会话，或者会话已过期，请重新登录。', rawData);
  }

  if (rawData.code !== RuoYiCode.SUCCESS) {
    const errorMessage = getRuoyiMessage(rawData);
    if (!options.skipErrorHandler) {
      showRuoyiError(errorMessage);
    }
    throw new RuoyiError(errorMessage, rawData);
  }

  return rawData as RuoyiResponse<T>;
};

export async function ruoyiRequest<T = unknown>(
  url: string,
  options: RuoyiRawRequestOptions,
): Promise<T>;
export async function ruoyiRequest<T = unknown>(
  url: string,
  options?: RuoyiRequestOptions,
): Promise<RuoyiResponse<T>>;
export async function ruoyiRequest<T = unknown>(
  url: string,
  options: RuoyiRequestOptions = {},
): Promise<RuoyiResponse<T> | T> {
  const { baseApi, ...requestOptions } = options;
  return requestWithBaseApi<T>(baseApi || getBaseApi(), url, requestOptions);
}

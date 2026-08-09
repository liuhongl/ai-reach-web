import { serializeRuoyiParams } from './params';
import {
  type RuoyiRawRequestOptions,
  type RuoyiRequestOptions,
  ruoyiRequest,
} from './request';
import type { RuoyiResponse } from './response';

const isJsonBlob = (blob: Blob) => blob.type === 'application/json';

const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

type DownloadRequest = <T = unknown>(
  url: string,
  options: RuoyiRawRequestOptions,
) => Promise<T | RuoyiResponse<T>>;

const downloadWithRequest = async (
  request: DownloadRequest,
  url: string,
  data: Record<string, unknown>,
  filename: string,
  options: RuoyiRequestOptions = {},
) => {
  const requestOptions: RuoyiRawRequestOptions = {
    ...options,
    method: 'post',
    data: serializeRuoyiParams(data),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(options.headers || {}),
    },
    responseType: 'blob',
  };
  const response = await request<Blob>(url, requestOptions);
  const blob = response as Blob;
  if (isJsonBlob(blob)) {
    const text = await blob.text();
    const result = JSON.parse(text) as { msg?: string };
    throw new Error(result.msg || '下载文件失败');
  }
  saveBlob(blob, filename);
};

export const ruoyiDownload = (
  url: string,
  data: Record<string, unknown>,
  filename: string,
  options: RuoyiRequestOptions = {},
) => downloadWithRequest(ruoyiRequest, url, data, filename, options);

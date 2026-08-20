import CryptoJS from 'crypto-js';
import { ruoyiRequest } from '@/adapters/ruoyi/request';
import type { RuoyiResponse } from '@/adapters/ruoyi/response';

const BASE_API = '/ai-call-agent-api';
const ITEMS_PATH = '/ai-call/knowledge/items';
const HASH_CHUNK_BYTES = 2 * 1024 * 1024;

export type KnowledgeContentCategory =
  | 'PRODUCT_SERVICE'
  | 'FAQ'
  | 'PROFESSIONAL'
  | 'INDUSTRY'
  | 'OTHER';

export type KnowledgeVersionStatus =
  | 'UPLOADING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export type KnowledgeVersion = {
  id: string;
  itemId: string;
  versionNo: number;
  status: KnowledgeVersionStatus;
  sourceFilename: string;
  extension: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  parserName?: string | null;
  parserVersion?: string | null;
  chunkStrategyVersion?: string | null;
  chunkCount: number;
  attemptCount: number;
  failureCode?: string | null;
  failureMessage?: string | null;
  failureRetryable?: boolean | null;
  createdBy?: string | null;
  createdAt: string;
  readyAt?: string | null;
};

export type KnowledgeSceneBinding = {
  promptProfileId: string;
  sceneCode: string;
  name: string;
};

export type KnowledgeItem = {
  id: string;
  displayName: string;
  contentCategory: KnowledgeContentCategory;
  note?: string | null;
  currentReadyVersionId?: string | null;
  latestVersion: KnowledgeVersion;
  versionCount: number;
  bindingCount: number;
  sceneBindings?: KnowledgeSceneBinding[];
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeItemPage = {
  rows: KnowledgeItem[];
  total: number;
};

export type KnowledgeUploadPayload = {
  file: File;
  fileSha256: string;
  contentCategory: KnowledgeContentCategory;
  note?: string;
};

export type KnowledgeUploadResult = {
  itemId: string;
  versionId: string;
  status: KnowledgeVersionStatus;
};

export type KnowledgeItemPatch = {
  displayName?: string;
  contentCategory?: KnowledgeContentCategory;
  note?: string | null;
};

const requestOptions = { baseApi: BASE_API } as const;

const itemPath = (itemId: string) =>
  `${ITEMS_PATH}/${encodeURIComponent(itemId)}`;

const versionPath = (versionId: string, action: string) =>
  `/ai-call/knowledge/versions/${encodeURIComponent(versionId)}/${action}`;

const unwrapData = <T>(response: RuoyiResponse<T>): T => {
  if (response.data === undefined) throw new Error('接口响应缺少 data');
  return response.data;
};

const unwrapPage = (
  response: RuoyiResponse<KnowledgeItem>,
): KnowledgeItemPage => {
  if (!Array.isArray(response.rows) || typeof response.total !== 'number') {
    throw new Error('分页响应缺少 rows 或 total');
  }
  return { rows: response.rows, total: response.total };
};

export const listKnowledgeItems = async (params: {
  pageNum: number;
  pageSize: number;
}) =>
  unwrapPage(
    await ruoyiRequest<KnowledgeItem>(ITEMS_PATH, {
      ...requestOptions,
      method: 'get',
      params,
    }),
  );

export const getKnowledgeItem = async (itemId: string) =>
  unwrapData(
    await ruoyiRequest<KnowledgeItem>(itemPath(itemId), {
      ...requestOptions,
      method: 'get',
    }),
  );

export const listKnowledgeVersions = async (itemId: string) =>
  unwrapData(
    await ruoyiRequest<KnowledgeVersion[]>(`${itemPath(itemId)}/versions`, {
      ...requestOptions,
      method: 'get',
    }),
  );

export const hashKnowledgeFile = async (file: File) => {
  const hash = CryptoJS.algo.SHA256.create();
  for (let offset = 0; offset < file.size; offset += HASH_CHUNK_BYTES) {
    const buffer = await file
      .slice(offset, Math.min(offset + HASH_CHUNK_BYTES, file.size))
      .arrayBuffer();
    hash.update(CryptoJS.lib.WordArray.create(buffer));
  }
  return hash.finalize().toString(CryptoJS.enc.Hex);
};

export const uploadKnowledgeItem = async (
  payload: KnowledgeUploadPayload,
  idempotencyKey: string,
  itemId?: string,
) => {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('fileSha256', payload.fileSha256);
  formData.append('contentCategory', payload.contentCategory);
  if (payload.note) formData.append('note', payload.note);

  return unwrapData(
    await ruoyiRequest<KnowledgeUploadResult>(
      itemId ? `${itemPath(itemId)}/versions/upload` : `${ITEMS_PATH}/upload`,
      {
        ...requestOptions,
        method: 'post',
        data: formData,
        headers: { 'Idempotency-Key': idempotencyKey },
        repeatSubmit: false,
      },
    ),
  );
};

export const updateKnowledgeItem = async (
  itemId: string,
  data: KnowledgeItemPatch,
) =>
  unwrapData(
    await ruoyiRequest<KnowledgeItem>(itemPath(itemId), {
      ...requestOptions,
      method: 'patch',
      data,
    }),
  );

export const replaceKnowledgeSceneBindings = async (
  itemId: string,
  promptProfileIds: string[],
) =>
  unwrapData(
    await ruoyiRequest<{ sceneBindings: KnowledgeSceneBinding[] }>(
      `${itemPath(itemId)}/scene-bindings`,
      {
        ...requestOptions,
        method: 'put',
        data: { promptProfileIds },
        repeatSubmit: false,
      },
    ),
  );

export const retryKnowledgeVersion = async (versionId: string) =>
  unwrapData(
    await ruoyiRequest(versionPath(versionId, 'retry'), {
      ...requestOptions,
      method: 'post',
    }),
  );

export const deleteKnowledgeItem = async (itemId: string) =>
  unwrapData(
    await ruoyiRequest(itemPath(itemId), {
      ...requestOptions,
      method: 'delete',
    }),
  );

const readBlob = async (
  versionId: string,
  action: 'preview' | 'download',
  extension?: string,
) => {
  const blob = await ruoyiRequest<Blob>(versionPath(versionId, action), {
    ...requestOptions,
    method: 'get',
    ...(action === 'preview' && extension?.toLowerCase() !== 'pdf'
      ? { headers: { Range: 'bytes=0-262143' } }
      : {}),
    responseType: 'blob',
  });
  if (blob.type.startsWith('application/json')) {
    const result = JSON.parse(await blob.text()) as { msg?: string };
    throw new Error(result.msg || '文件读取失败');
  }
  return blob;
};

export const previewKnowledgeVersion = (versionId: string, extension: string) =>
  readBlob(
    versionId,
    ['docx', 'pptx'].includes(extension.toLowerCase()) ? 'download' : 'preview',
    extension,
  );

export const downloadKnowledgeVersion = async (
  versionId: string,
  filename: string,
) => {
  const blob = await readBlob(versionId, 'download');
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

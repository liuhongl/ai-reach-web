import CryptoJS from 'crypto-js';
import { ruoyiRequest } from '@/adapters/ruoyi/request';
import {
  deleteKnowledgeItem,
  downloadKnowledgeVersion,
  getKnowledgeItem,
  hashKnowledgeFile,
  listKnowledgeItems,
  listKnowledgeVersions,
  previewKnowledgeVersion,
  replaceKnowledgeSceneBindings,
  retryKnowledgeVersion,
  updateKnowledgeItem,
  uploadKnowledgeItem,
} from './service';

jest.mock('@/adapters/ruoyi/request', () => ({
  ruoyiRequest: jest.fn(),
}));

const mockedRuoyiRequest = ruoyiRequest as jest.Mock;

describe('AI Call knowledge service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRuoyiRequest.mockResolvedValue({ code: 200, data: {} });
  });

  it('maps list and detail requests to the isolated AI Call proxy', async () => {
    mockedRuoyiRequest
      .mockResolvedValueOnce({ code: 200, rows: [{ id: 'item-1' }], total: 1 })
      .mockResolvedValueOnce({ code: 200, data: { id: 'item-1' } })
      .mockResolvedValueOnce({ code: 200, data: [{ id: 'version-1' }] });

    await expect(
      listKnowledgeItems({ pageNum: 2, pageSize: 10 }),
    ).resolves.toEqual({ rows: [{ id: 'item-1' }], total: 1 });
    await getKnowledgeItem('item-1');
    await listKnowledgeVersions('item-1');

    expect(mockedRuoyiRequest.mock.calls).toEqual([
      [
        '/ai-call/knowledge/items',
        {
          baseApi: '/ai-call-agent-api',
          method: 'get',
          params: { pageNum: 2, pageSize: 10 },
        },
      ],
      [
        '/ai-call/knowledge/items/item-1',
        { baseApi: '/ai-call-agent-api', method: 'get' },
      ],
      [
        '/ai-call/knowledge/items/item-1/versions',
        { baseApi: '/ai-call-agent-api', method: 'get' },
      ],
    ]);
  });

  it('uploads a new item or version with one multipart contract and idempotency key', async () => {
    const file = new File(['# FAQ'], 'faq.md', { type: 'text/markdown' });
    mockedRuoyiRequest.mockResolvedValue({
      code: 200,
      data: { itemId: 'item-1', versionId: 'version-1', status: 'PROCESSING' },
    });

    await uploadKnowledgeItem(
      {
        file,
        fileSha256: 'a'.repeat(64),
        contentCategory: 'FAQ',
        note: '售后口径',
      },
      'upload-key',
    );
    await uploadKnowledgeItem(
      {
        file,
        fileSha256: 'a'.repeat(64),
        contentCategory: 'FAQ',
      },
      'version-key',
      'item-1',
    );

    expect(mockedRuoyiRequest).toHaveBeenCalledTimes(2);
    expect(mockedRuoyiRequest.mock.calls[0][0]).toBe(
      '/ai-call/knowledge/items/upload',
    );
    expect(mockedRuoyiRequest.mock.calls[1][0]).toBe(
      '/ai-call/knowledge/items/item-1/versions/upload',
    );
    for (const [, options] of mockedRuoyiRequest.mock.calls) {
      expect(options).toMatchObject({
        baseApi: '/ai-call-agent-api',
        method: 'post',
        headers: { 'Idempotency-Key': expect.any(String) },
        repeatSubmit: false,
      });
      expect(options.data).toBeInstanceOf(FormData);
    }
    const firstForm = mockedRuoyiRequest.mock.calls[0][1].data as FormData;
    expect(firstForm.get('file')).toBe(file);
    expect(firstForm.get('fileSha256')).toBe('a'.repeat(64));
    expect(firstForm.get('contentCategory')).toBe('FAQ');
    expect(firstForm.get('note')).toBe('售后口径');
  });

  it('maps edit, bindings, retry and delete without converting string IDs to numbers', async () => {
    await updateKnowledgeItem('90071992547409931', {
      displayName: '售后知识',
    });
    await replaceKnowledgeSceneBindings('90071992547409931', [
      '90071992547409941',
    ]);
    await retryKnowledgeVersion('90071992547409951');
    await deleteKnowledgeItem('90071992547409931');

    expect(mockedRuoyiRequest.mock.calls).toEqual([
      [
        '/ai-call/knowledge/items/90071992547409931',
        {
          baseApi: '/ai-call-agent-api',
          method: 'patch',
          data: { displayName: '售后知识' },
        },
      ],
      [
        '/ai-call/knowledge/items/90071992547409931/scene-bindings',
        {
          baseApi: '/ai-call-agent-api',
          method: 'put',
          data: { promptProfileIds: ['90071992547409941'] },
          repeatSubmit: false,
        },
      ],
      [
        '/ai-call/knowledge/versions/90071992547409951/retry',
        { baseApi: '/ai-call-agent-api', method: 'post' },
      ],
      [
        '/ai-call/knowledge/items/90071992547409931',
        { baseApi: '/ai-call-agent-api', method: 'delete' },
      ],
    ]);
  });

  it('previews only the first text range and downloads through authenticated blobs', async () => {
    const preview = new Blob(['preview'], { type: 'text/plain' });
    const download = new Blob(['download'], { type: 'text/markdown' });
    mockedRuoyiRequest
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce(download);
    window.URL.createObjectURL = jest.fn(() => 'blob:knowledge-download');
    window.URL.revokeObjectURL = jest.fn();
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    await expect(previewKnowledgeVersion('version-1')).resolves.toBe(preview);
    await downloadKnowledgeVersion('version-1', 'faq.md');

    expect(mockedRuoyiRequest.mock.calls).toEqual([
      [
        '/ai-call/knowledge/versions/version-1/preview',
        {
          baseApi: '/ai-call-agent-api',
          method: 'get',
          headers: { Range: 'bytes=0-262143' },
          responseType: 'blob',
        },
      ],
      [
        '/ai-call/knowledge/versions/version-1/download',
        {
          baseApi: '/ai-call-agent-api',
          method: 'get',
          responseType: 'blob',
        },
      ],
    ]);
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(download);
    expect(click).toHaveBeenCalledTimes(1);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(
      'blob:knowledge-download',
    );
    click.mockRestore();
  });

  it('hashes file bytes without changing their content', async () => {
    const bytes = new Uint8Array([97, 98, 99]);
    const file = {
      size: bytes.byteLength,
      slice: jest.fn(() => ({
        arrayBuffer: async () => bytes.buffer,
      })),
    } as unknown as File;

    await expect(hashKnowledgeFile(file)).resolves.toBe(
      CryptoJS.SHA256('abc').toString(),
    );
    expect(file.slice).toHaveBeenCalledWith(0, bytes.byteLength);
  });
});

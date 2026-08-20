import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Modal, message } from 'antd';
import React from 'react';
import { getAiCallLabPromptProfiles } from '@/services/ruoyi/ai-call-lab';
import AiCallKnowledgePage from './index';
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

jest.mock('@/components/Permission', () => ({
  usePermission: () => ({ hasPermission: () => true }),
}));

jest.mock('@/services/ruoyi/ai-call-lab', () => ({
  getAiCallLabPromptProfiles: jest.fn(),
}));

jest.mock('./service', () => ({
  deleteKnowledgeItem: jest.fn(),
  downloadKnowledgeVersion: jest.fn(),
  getKnowledgeItem: jest.fn(),
  hashKnowledgeFile: jest.fn(),
  listKnowledgeItems: jest.fn(),
  listKnowledgeVersions: jest.fn(),
  previewKnowledgeVersion: jest.fn(),
  replaceKnowledgeSceneBindings: jest.fn(),
  retryKnowledgeVersion: jest.fn(),
  updateKnowledgeItem: jest.fn(),
  uploadKnowledgeItem: jest.fn(),
}));

jest.mock('@ant-design/pro-components', () => {
  const React = require('react');

  const ProTable = (props: Record<string, unknown>) => {
    const propsRef = React.useRef(props);
    propsRef.current = props;
    const [rows, setRows] = React.useState([]);
    const load = React.useCallback(async () => {
      const result = await propsRef.current.request({
        current: 1,
        pageSize: propsRef.current.pagination?.defaultPageSize || 20,
      });
      setRows(result.data || []);
    }, []);
    React.useEffect(() => {
      propsRef.current.actionRef.current = {
        reload: load,
        reloadAndRest: load,
      };
      void load();
    }, [load]);
    const toolBarRender = props.toolBarRender as CallableFunction;
    const columns = props.columns as Array<Record<string, unknown>>;
    return React.createElement(
      'section',
      null,
      React.createElement('h1', null, props.headerTitle),
      ...(typeof toolBarRender === 'function'
        ? (toolBarRender() || []).filter(Boolean)
        : []),
      ...columns.map((column, index) =>
        React.createElement(
          'span',
          { key: `heading-${String(column.key || column.dataIndex || index)}` },
          column.title,
        ),
      ),
      ...rows.map((row: { id: string; displayName: string }) =>
        React.createElement(
          'div',
          { key: row.id },
          ...columns.map((column, index) =>
            React.createElement(
              React.Fragment,
              {
                key: `cell-${String(column.key || column.dataIndex || index)}`,
              },
              typeof column.render === 'function'
                ? (column.render as CallableFunction)(undefined, row)
                : row[column.dataIndex as keyof typeof row],
            ),
          ),
        ),
      ),
    );
  };

  return {
    PageContainer: ({ children }: { children: unknown }) =>
      React.createElement('main', null, children),
    ProCard: ({ children }: { children: unknown }) =>
      React.createElement('div', null, children),
    ProTable,
  };
});

const item = {
  id: '90071992547409931',
  displayName: '售后知识.md',
  contentCategory: 'FAQ' as const,
  currentReadyVersionId: '90071992547409932',
  latestVersion: {
    id: '90071992547409932',
    itemId: '90071992547409931',
    versionNo: 1,
    status: 'READY' as const,
    sourceFilename: '售后知识.md',
    extension: 'md',
    mimeType: 'text/markdown',
    byteSize: 100,
    sha256: 'a'.repeat(64),
    chunkCount: 1,
    attemptCount: 1,
    createdAt: '2026-08-19T08:00:00Z',
  },
  versionCount: 1,
  note: '退款政策，客服必读',
  sceneBindings: [
    {
      promptProfileId: '101',
      sceneCode: 'after_sales',
      name: '售后回访',
    },
  ],
  bindingCount: 1,
  createdAt: '2026-08-19T08:00:00Z',
  updatedAt: '2026-08-19T08:00:00Z',
};

describe('AiCallKnowledgePage', () => {
  afterEach(() => {
    message.destroy();
    Modal.destroyAll();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (listKnowledgeItems as jest.Mock).mockResolvedValue({
      rows: [item],
      total: 1,
    });
    (hashKnowledgeFile as jest.Mock).mockResolvedValue('b'.repeat(64));
    (uploadKnowledgeItem as jest.Mock).mockResolvedValue({
      itemId: 'new-item',
      versionId: 'new-version',
      status: 'PROCESSING',
    });
    (getKnowledgeItem as jest.Mock).mockResolvedValue(item);
    (listKnowledgeVersions as jest.Mock).mockResolvedValue([
      item.latestVersion,
    ]);
    (getAiCallLabPromptProfiles as jest.Mock).mockResolvedValue({
      rows: [
        {
          id: 101,
          sceneCode: 'after_sales',
          name: '售后回访',
        },
      ],
      total: 1,
    });
    (deleteKnowledgeItem as jest.Mock).mockResolvedValue({});
    (downloadKnowledgeVersion as jest.Mock).mockResolvedValue(undefined);
    (previewKnowledgeVersion as jest.Mock).mockResolvedValue(
      new Blob(['preview']),
    );
    (replaceKnowledgeSceneBindings as jest.Mock).mockResolvedValue({
      sceneBindings: [],
    });
    (retryKnowledgeVersion as jest.Mock).mockResolvedValue({});
    (updateKnowledgeItem as jest.Mock).mockResolvedValue(item);
  });

  it('matches the knowledge asset prototype structure and filters by content category', async () => {
    render(React.createElement(AiCallKnowledgePage));

    expect(await screen.findByText('媒体分类')).toBeTruthy();
    expect(screen.getAllByText('内容分类')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '上传新知识' })).toBeTruthy();
    expect(await screen.findByText('备注：退款政策，客服必读')).toBeTruthy();
    expect(screen.getByText('关联产品（场景）')).toBeTruthy();
    expect(screen.getByRole('button', { name: '编辑备注' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '行业知识' }));
    await waitFor(() =>
      expect(listKnowledgeItems).toHaveBeenLastCalledWith({
        pageNum: 1,
        pageSize: 10,
        contentCategory: 'INDUSTRY',
      }),
    );
  });

  it.each([
    [
      'PPTX',
      'faq.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    [
      'DOCX',
      'faq.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    ['text PDF', 'faq.pdf', 'application/pdf'],
  ])('loads the list and uploads one %s file through the service', async (_, fileName, mimeType) => {
    render(React.createElement(AiCallKnowledgePage));

    expect(await screen.findByText('售后知识.md')).toBeTruthy();
    expect(listKnowledgeItems).toHaveBeenCalledWith({
      pageNum: 1,
      pageSize: 10,
      contentCategory: undefined,
    });

    fireEvent.click(screen.getByRole('button', { name: '上传新知识' }));
    const file = new File(['test content'], fileName, { type: mimeType });
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '开始上传' }));

    await waitFor(() =>
      expect(uploadKnowledgeItem).toHaveBeenCalledWith(
        {
          file,
          fileSha256: 'b'.repeat(64),
          contentCategory: 'FAQ',
          note: '',
        },
        expect.any(String),
        undefined,
      ),
    );
  });

  it('offers preview and download for PDF, DOCX, and PPTX', async () => {
    window.URL.createObjectURL = jest.fn(() => 'blob:pdf-preview');
    window.URL.revokeObjectURL = jest.fn();
    const pdfVersion = {
      ...item.latestVersion,
      id: 'pdf-version',
      sourceFilename: 'guide.pdf',
      extension: 'pdf',
      mimeType: 'application/pdf',
    };
    const docxVersion = {
      ...item.latestVersion,
      id: 'docx-version',
      versionNo: 2,
      sourceFilename: 'guide.docx',
      extension: 'docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const pptxVersion = {
      ...item.latestVersion,
      id: 'pptx-version',
      versionNo: 3,
      sourceFilename: 'guide.pptx',
      extension: 'pptx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
    (listKnowledgeVersions as jest.Mock).mockResolvedValue([
      docxVersion,
      pptxVersion,
      pdfVersion,
    ]);

    render(React.createElement(AiCallKnowledgePage));
    fireEvent.click(await screen.findByRole('button', { name: '售后知识.md' }));

    expect(await screen.findAllByRole('button', { name: /下载/ })).toHaveLength(
      3,
    );
    const previewButtons = screen.getAllByRole('button', { name: /预览/ });
    expect(previewButtons).toHaveLength(3);
    fireEvent.click(previewButtons[2]);

    await waitFor(() =>
      expect(previewKnowledgeVersion).toHaveBeenCalledWith(
        'pdf-version',
        'pdf',
      ),
    );
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message, Modal } from 'antd';
import React from 'react';
import { getAiCallLabPromptProfiles } from '@/services/ruoyi/ai-call-lab';
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
import AiCallKnowledgePage from './index';

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
      const result = await propsRef.current.request({ current: 1, pageSize: 20 });
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
    return React.createElement(
      'section',
      null,
      React.createElement('h1', null, props.headerTitle),
      ...(toolBarRender() || []).filter(Boolean),
      ...rows.map((row: { id: string; displayName: string }) =>
        React.createElement('div', { key: row.id }, row.displayName),
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
  bindingCount: 0,
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
      rows: [],
      total: 0,
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

  it('loads the list and uploads one PPTX file through the service', async () => {
    render(React.createElement(AiCallKnowledgePage));

    expect(await screen.findByText('售后知识.md')).toBeTruthy();
    expect(listKnowledgeItems).toHaveBeenCalledWith({
      pageNum: 1,
      pageSize: 20,
    });

    fireEvent.click(screen.getByRole('button', { name: /上传知识/ }));
    const file = new File(['PK\x03\x04'], 'faq.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
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
});

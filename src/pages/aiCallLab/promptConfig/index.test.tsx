import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Modal } from 'antd';
import React from 'react';
import {
  applyAiCallLabPromptVersion,
  extractAiCallLabProductInfo,
  getAiCallLabPromptCommonConfig,
  getAiCallLabPromptProfiles,
  getAiCallLabPromptVersion,
  getAiCallLabPromptVersionApplications,
  getAiCallLabPromptVersions,
  optimizeAiCallLabPrompt,
  previewAiCallLabPromptProfile,
  saveAiCallLabPromptCommonConfig,
  saveAiCallLabPromptProfile,
  updateAiCallLabPromptVersionName,
} from '@/services/ruoyi/ai-call-lab';
import AiCallLabPromptConfigPage from './index';

jest.mock('@/services/ruoyi/ai-call-lab', () => ({
  applyAiCallLabPromptVersion: jest.fn(),
  deleteAiCallLabPromptVersion: jest.fn(),
  extractAiCallLabProductInfo: jest.fn(),
  getAiCallLabPromptCommonConfig: jest.fn(),
  getAiCallLabPromptProfile: jest.fn(),
  getAiCallLabPromptProfiles: jest.fn(),
  getAiCallLabPromptVersion: jest.fn(),
  getAiCallLabPromptVersionApplications: jest.fn(),
  getAiCallLabPromptVersions: jest.fn(),
  optimizeAiCallLabPrompt: jest.fn(),
  previewAiCallLabPromptProfile: jest.fn(),
  saveAiCallLabPromptCommonConfig: jest.fn(),
  saveAiCallLabPromptProfile: jest.fn(),
  updateAiCallLabPromptVersionName: jest.fn(),
}));

jest.mock('@/components/Permission', () => ({
  usePermission: () => ({ hasPermission: () => true }),
}));

const extractProductInfoMock = extractAiCallLabProductInfo as jest.Mock;
const applyPromptVersionMock = applyAiCallLabPromptVersion as jest.Mock;
const getPromptProfilesMock = getAiCallLabPromptProfiles as jest.Mock;
const getPromptVersionMock = getAiCallLabPromptVersion as jest.Mock;
const getPromptVersionApplicationsMock =
  getAiCallLabPromptVersionApplications as jest.Mock;
const getCommonConfigMock = getAiCallLabPromptCommonConfig as jest.Mock;
const getPromptVersionsMock = getAiCallLabPromptVersions as jest.Mock;
const optimizePromptMock = optimizeAiCallLabPrompt as jest.Mock;
const previewPromptMock = previewAiCallLabPromptProfile as jest.Mock;
const saveCommonConfigMock = saveAiCallLabPromptCommonConfig as jest.Mock;
const savePromptProfileMock = saveAiCallLabPromptProfile as jest.Mock;
const updatePromptVersionNameMock =
  updateAiCallLabPromptVersionName as jest.Mock;
const stylesPath = join(__dirname, 'index.css');
const styles = existsSync(stylesPath) ? readFileSync(stylesPath, 'utf8') : '';

describe('AiCallLabPromptConfigPage', () => {
  afterEach(() => Modal.destroyAll());

  beforeEach(() => {
    jest.clearAllMocks();
    getPromptProfilesMock.mockResolvedValue({
      rows: [
        {
          id: 'profile-geo',
          name: 'GEO 产品介绍',
          sceneCode: 'intro_geo',
          providerKey: 'static_profile',
          promptText: '介绍 GEO 产品能力',
          openingMessage: '张总您好',
          productInfo: 'GEO 产品事实',
          variables: [],
          versionNo: 2,
          versionCount: 2,
        },
        {
          id: 'profile-follow-up',
          name: '客户回访',
          sceneCode: 'follow_up',
          providerKey: 'static_profile',
          promptText: '## 一、角色与任务\n回访客户',
          openingMessage: '您好',
          productInfo: '',
          variables: [],
          versionNo: 2,
          versionCount: 2,
        },
      ],
      total: 2,
    });
    getCommonConfigMock.mockResolvedValue({ content: '统一使用专业语气。' });
    getPromptVersionsMock.mockResolvedValue({ rows: [], total: 0 });
    getPromptVersionApplicationsMock.mockResolvedValue({ rows: [], total: 0 });
    applyPromptVersionMock.mockResolvedValue({
      id: 'profile-geo',
      name: 'GEO 产品介绍',
      sceneCode: 'intro_geo',
      providerKey: 'static_profile',
      promptText: 'GEO 初稿',
      openingMessage: '您好',
      productInfo: 'GEO 产品事实',
      variables: [{ key: 'customerName', label: '客户名称' }],
      versionNo: 1,
      versionCount: 2,
    });
    updatePromptVersionNameMock.mockImplementation(
      async (_profileId, _versionId, versionName) => ({
        id: 'version-1',
        profileId: 'profile-geo',
        versionNo: 2,
        versionName,
        creationMethod: 'manual',
        createdAt: '2026-08-20T12:00:00Z',
      }),
    );
    optimizePromptMock.mockResolvedValue({
      candidateContent: '您好，现在方便简单沟通吗？',
      warnings: [],
    });
    extractProductInfoMock.mockResolvedValue({
      draftText: '核心产品：合同审查。',
      sourceDocuments: [
        {
          versionId: '11',
          versionNo: 1,
          sourceFilename: '合同资料.md',
        },
        {
          versionId: '12',
          versionNo: 1,
          sourceFilename: '合同方案.pptx',
        },
      ],
      sources: [
        {
          claim: '提供合同审查',
          chunkId: '101',
          versionId: '11',
          versionNo: 1,
          sourceFilename: '合同资料.md',
          sectionPath: '核心能力',
          excerpt: '合同审查覆盖风险识别。',
        },
      ],
      conflicts: [
        {
          topic: '效果口径',
          description: '不同资料的效果描述不一致，需要人工确认。',
          sourceChunkIds: ['101', '102'],
        },
      ],
      sourceVersionIds: ['11'],
      versionSnapshotHash: 'a'.repeat(64),
    });
    previewPromptMock.mockResolvedValue({
      instructions: '产品或服务信息\nGEO 产品事实\n\n业务话术\nGEO 场景提示词',
      openingMessage: '张总您好',
      promptHash: 'sha256:prompt',
      openingMessageHash: 'sha256:opening',
      promptSourceKey: 'intro_geo',
    });
    saveCommonConfigMock.mockImplementation(async (content) => ({ content }));
    savePromptProfileMock.mockImplementation(async (profile) => ({
      ...profile,
      id: profile.id || 'profile-new',
      versionNo: 2,
      versionCount: 2,
    }));
  });

  it('shows the confirmed single-column scene workbench and collapsed common template', async () => {
    render(React.createElement(AiCallLabPromptConfigPage));

    expect(await screen.findByDisplayValue('GEO 产品介绍')).toBeTruthy();
    const commonTemplate = screen.getByText('通用沟通规则模板');
    expect(commonTemplate.closest('.ai-call-prompt-common-card')).toBeTruthy();
    expect(screen.getByText('仅替换当前场景的「三、沟通规则」')).toBeTruthy();
    expect(
      screen.queryByRole('heading', { name: 'AI Call 提示词配置' }),
    ).toBeNull();
    expect(screen.queryByDisplayValue('统一使用专业语气。')).toBeNull();
    expect(screen.getByText('产品&服务总结')).toBeTruthy();
    expect(screen.getByText('核心内容提取自关联知识库')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '从知识库一键提取' }),
    ).toBeTruthy();
    expect(screen.getByText('场景提示词')).toBeTruthy();
    expect(screen.getByText(/## 一、角色与任务/)).toBeTruthy();
    expect(screen.getByText(/以“产品&服务总结”为事实来源/)).toBeTruthy();
    expect(screen.queryByText('场景业务变量')).toBeNull();
    expect(screen.queryByRole('button', { name: /添加变量/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '定义变量' })).toBeNull();
    expect(screen.getAllByRole('button', { name: '插入变量' })).toHaveLength(2);
    const aiButtons = screen.getAllByRole('button', {
      name: 'AI 生成 / 优化',
    });
    expect(aiButtons).toHaveLength(2);
    expect(
      aiButtons.every((button) =>
        button.classList.contains('ai-call-prompt-ai-button'),
      ),
    ).toBe(true);
    expect(document.querySelector('.ai-call-prompt-config-grid')).toBeNull();
    expect(styles).toMatch(
      /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(styles).toMatch(
      /ai-call-prompt-config-page\.ant-pro-page-container\s*{[^}]*overflow-y:\s*auto/s,
    );
    expect(styles).toMatch(
      /ai-call-prompt-config-layout\s*{[^}]*padding-bottom:\s*var\(--recov-page-content-gap,\s*24px\)/s,
    );
  });

  it('edits and saves the common template independently', async () => {
    render(React.createElement(AiCallLabPromptConfigPage));

    fireEvent.click(await screen.findByText('通用沟通规则模板'));
    const input = await screen.findByDisplayValue('统一使用专业语气。');
    fireEvent.change(input, {
      target: { value: '统一使用克制、自然的语气。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存通用沟通规则' }));

    await waitFor(() =>
      expect(saveCommonConfigMock).toHaveBeenCalledWith(
        '统一使用克制、自然的语气。',
      ),
    );
  });

  it('previews the current unsaved draft instead of only a scene code', async () => {
    render(React.createElement(AiCallLabPromptConfigPage));

    fireEvent.click(await screen.findByRole('button', { name: '预览提示词' }));

    await waitFor(() =>
      expect(previewPromptMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sceneCode: 'intro_geo',
          productInfo: 'GEO 产品事实',
        }),
      ),
    );
    expect(
      await screen.findByText(/平台安全、转人工和结束通话约束/),
    ).toBeTruthy();
  });

  it('renders readable version details and hides apply on the current version', async () => {
    getPromptVersionsMock.mockResolvedValue({
      rows: [
        {
          id: 'version-1',
          profileId: 'profile-geo',
          versionNo: 2,
          versionName: 'GEO 产品介绍',
          creationMethod: 'manual',
          createdAt: '2026-08-20T12:00:00Z',
        },
        {
          id: 'version-old',
          profileId: 'profile-geo',
          versionNo: 1,
          versionName: 'GEO 初稿',
          creationMethod: 'restored',
          createdAt: '2026-08-20T11:00:00Z',
        },
      ],
      total: 2,
    });
    getPromptVersionApplicationsMock.mockResolvedValue({
      rows: [
        {
          id: 'application-1',
          profileId: 'profile-geo',
          fromVersionId: 'version-1',
          fromVersionNo: 2,
          fromVersionName: 'GEO 产品介绍',
          toVersionId: 'version-old',
          toVersionNo: 1,
          toVersionName: 'GEO 初稿',
          appliedBy: '7',
          appliedByName: '测试用户',
          appliedAt: '2026-08-20T13:00:00Z',
        },
      ],
      total: 1,
    });
    getPromptVersionMock.mockResolvedValue({
      id: 'version-1',
      profileId: 'profile-geo',
      versionNo: 2,
      versionName: 'GEO 产品介绍',
      creationMethod: 'manual',
      createdAt: '2026-08-20T12:00:00Z',
      snapshot: {
        name: 'GEO 产品介绍',
        sceneCode: 'intro_geo',
        providerKey: 'static_profile',
        openingMessage: '您好',
        productInfo: 'GEO 产品事实',
        promptText: 'GEO 场景提示词',
        variables: [{ key: 'customerName', label: '客户名称' }],
      },
    });

    render(React.createElement(AiCallLabPromptConfigPage));

    const applyButton = (await screen.findAllByText('应用此版本'))[0];
    expect(screen.getAllByText('应用此版本')).toHaveLength(1);
    expect(screen.getByText(/人工编辑.*2026-08-20/)).toBeTruthy();
    expect(screen.getByText(/历史恢复.*2026-08-20/)).toBeTruthy();
    expect(await screen.findByText('版本切换记录')).toBeTruthy();
    expect(screen.getByText('v2 → v1')).toBeTruthy();
    expect(screen.getByText(/测试用户.*2026-08-20 21:00:00/)).toBeTruthy();
    expect((await screen.findAllByText(/2026-08-20/)).length).toBeGreaterThan(
      0,
    );
    expect(
      screen
        .getAllByRole('button', { name: '删除' })[0]
        .querySelector('.anticon'),
    ).toBeNull();
    fireEvent.click(applyButton);
    expect(await screen.findByText(/v1 将成为当前使用版本/)).toBeTruthy();
    expect(screen.queryByText(/生成一个新的最新版本/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /确\s*定/ }));
    await waitFor(() =>
      expect(applyPromptVersionMock).toHaveBeenCalledWith(
        'profile-geo',
        'version-old',
      ),
    );
    fireEvent.click(screen.getAllByRole('button', { name: '查看详情' })[0]);
    expect(await screen.findByText('固定场景配置')).toBeTruthy();
    expect(screen.getAllByText('场景编码').length).toBeGreaterThan(0);
    expect(screen.getAllByText('客户名称').length).toBeGreaterThan(0);
    expect(screen.queryByText('static_profile')).toBeNull();
  });

  it('switches scenes and saves all business fields as a static scene profile', async () => {
    render(React.createElement(AiCallLabPromptConfigPage));

    fireEvent.mouseDown(await screen.findByLabelText('选择场景'));
    fireEvent.click(await screen.findByText('客户回访 · follow_up'));
    fireEvent.click(screen.getByRole('button', { name: /保存场景配置/ }));

    await waitFor(() =>
      expect(savePromptProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'profile-follow-up',
          name: '客户回访',
          sceneCode: 'follow_up',
          providerKey: 'static_profile',
          openingMessage: '您好',
          productInfo: '',
          variables: [],
        }),
      ),
    );
  });

  it('separates variable creation from selection and shares the created variable', async () => {
    getPromptProfilesMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'profile-geo',
          name: 'GEO 产品介绍',
          sceneCode: 'intro_geo',
          providerKey: 'static_profile',
          promptText: '## 一、角色与任务\n介绍{{companyName}}',
          openingMessage: '您好{{companyName}}',
          productInfo: 'GEO 产品事实',
          variables: [{ key: 'companyName', label: '公司名' }],
          versionNo: 2,
          versionCount: 2,
        },
      ],
      total: 1,
    });
    render(React.createElement(AiCallLabPromptConfigPage));

    const insertButtons = await screen.findAllByRole('button', {
      name: '插入变量',
    });
    fireEvent.click(insertButtons[0]);
    expect(await screen.findByPlaceholderText('搜索变量')).toBeTruthy();
    expect(screen.queryByPlaceholderText('例如：公司名')).toBeNull();
    expect(screen.queryByRole('button', { name: '编辑' })).toBeNull();
    expect(screen.queryByRole('button', { name: '删除' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '新建变量' }));
    expect(screen.queryByPlaceholderText('搜索变量')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('例如：公司名'), {
      target: { value: '企业名称' },
    });
    fireEvent.change(screen.getByPlaceholderText('例如：companyName'), {
      target: { value: 'enterpriseName' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^创\s*建$/ }));

    expect(await screen.findByPlaceholderText('搜索变量')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: '企业名称' })
        .classList.contains('ant-btn-primary'),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^插\s*入$/ }));
    fireEvent.click(screen.getByRole('button', { name: /保存场景配置/ }));

    await waitFor(() =>
      expect(savePromptProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          openingMessage: expect.stringContaining('{{enterpriseName}}'),
          variables: [
            { key: 'companyName', label: '公司名' },
            { key: 'enterpriseName', label: '企业名称' },
          ],
        }),
      ),
    );
  });

  it('reviews and manually applies a sourced product draft before saving', async () => {
    render(React.createElement(AiCallLabPromptConfigPage));

    await screen.findByDisplayValue('GEO 产品介绍');
    fireEvent.click(
      await screen.findByRole('button', { name: '从知识库一键提取' }),
    );

    await waitFor(() =>
      expect(extractProductInfoMock).toHaveBeenCalledWith('profile-geo'),
    );
    expect(savePromptProfileMock).not.toHaveBeenCalled();
    expect(await screen.findByText('合同方案.pptx · v1')).toBeTruthy();
    expect(screen.getByText('本次参与提取资料')).toBeTruthy();
    expect(screen.getByText('原文片段：')).toBeTruthy();
    expect(screen.getByText('合同审查覆盖风险识别。')).toBeTruthy();
    expect(
      screen.getByText('不同资料的效果描述不一致，需要人工确认。'),
    ).toBeTruthy();
    expect(styles).toMatch(
      /ai-call-product-draft-sources[^}]*max-height:\s*320px[^}]*overflow-y:\s*auto/s,
    );

    const draft = screen.getByLabelText('产品与服务草稿');
    fireEvent.change(draft, {
      target: { value: '核心产品：人工确认后的合同审查。' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: '应用到产品 / 服务信息' }),
    );
    expect(
      (document.getElementById('prompt-product-info') as HTMLTextAreaElement)
        .value,
    ).toBe('核心产品：人工确认后的合同审查。');

    fireEvent.click(screen.getByRole('button', { name: /保存场景配置/ }));
    await waitFor(() =>
      expect(savePromptProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          productInfo: '核心产品：人工确认后的合同审查。',
          knowledgeVersionSnapshotHash: 'a'.repeat(64),
        }),
      ),
    );
  });

  it('returns to the previous scene when creation is cancelled', async () => {
    render(React.createElement(AiCallLabPromptConfigPage));

    fireEvent.click(await screen.findByRole('button', { name: /新建场景/ }));
    expect(screen.getByRole('button', { name: /取消新建/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /取消新建/ }));

    expect(await screen.findByDisplayValue('GEO 产品介绍')).toBeTruthy();
  });

  it('does not show a comparison when AI returns unchanged content', async () => {
    optimizePromptMock.mockResolvedValueOnce({
      candidateContent: '张总您好',
      warnings: [],
    });
    render(React.createElement(AiCallLabPromptConfigPage));

    const optimizeButtons = await screen.findAllByRole('button', {
      name: 'AI 生成 / 优化',
    });
    fireEvent.click(optimizeButtons[0]);

    await waitFor(() => expect(optimizePromptMock).toHaveBeenCalled());
    expect(screen.queryByText('开场白 AI 候选内容')).toBeNull();
  });

  it('clears the AI instruction when the candidate modal closes', async () => {
    render(React.createElement(AiCallLabPromptConfigPage));

    const optimizeButtons = await screen.findAllByRole('button', {
      name: 'AI 生成 / 优化',
    });
    fireEvent.click(optimizeButtons[0]);
    const instruction = await screen.findByPlaceholderText(
      '可选：填写再次优化要求',
    );
    fireEvent.change(instruction, { target: { value: '语气卡哇伊一点' } });
    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));

    fireEvent.click(optimizeButtons[0]);
    const reopenedInstruction = await screen.findByPlaceholderText(
      '可选：填写再次优化要求',
    );
    expect((reopenedInstruction as HTMLTextAreaElement).value).toBe('');
  });

  it('shows the AI optimization rejection reason', async () => {
    optimizePromptMock.mockRejectedValueOnce(
      new Error('提示词 AI 优化失败：AI 优化生成了系统未支持的动作承诺'),
    );
    render(React.createElement(AiCallLabPromptConfigPage));

    const optimizeButtons = await screen.findAllByRole('button', {
      name: 'AI 生成 / 优化',
    });
    fireEvent.click(optimizeButtons[0]);

    expect(
      await screen.findByText(
        '提示词 AI 优化失败：AI 优化生成了系统未支持的动作承诺',
      ),
    ).toBeTruthy();
  });
});

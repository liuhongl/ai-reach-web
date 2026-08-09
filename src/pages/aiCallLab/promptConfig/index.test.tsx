import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  getAiCallLabPromptComponents,
  getAiCallLabPromptProfiles,
  saveAiCallLabPromptProfile,
} from '@/services/ruoyi/ai-call-lab';
import AiCallLabPromptConfigPage from './index';

jest.mock('@/services/ruoyi/ai-call-lab', () => ({
  getAiCallLabPromptProfiles: jest.fn(),
  getAiCallLabPromptComponents: jest.fn(),
  saveAiCallLabPromptProfile: jest.fn(),
}));

const getPromptProfilesMock = getAiCallLabPromptProfiles as jest.Mock;
const getPromptComponentsMock = getAiCallLabPromptComponents as jest.Mock;
const savePromptProfileMock = saveAiCallLabPromptProfile as jest.Mock;
const stylesPath = join(__dirname, 'index.css');
const styles = existsSync(stylesPath) ? readFileSync(stylesPath, 'utf8') : '';

describe('AiCallLabPromptConfigPage', () => {
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
        },
        {
          id: 'profile-collection',
          name: '催收还款提醒',
          sceneCode: 'intro_collection',
          providerKey: 'business_query',
          promptText: null,
          openingMessage: null,
        },
      ],
      total: 2,
    });
    getPromptComponentsMock.mockResolvedValue({
      rows: [
        {
          componentKey: 'platform_constraints',
          name: '平台约束',
          content: '保持自然、专业、合规。',
        },
        {
          componentKey: 'call_end_tool',
          name: '结束工具',
          content: '必要时调用结束通话工具。',
        },
      ],
      total: 2,
    });
    savePromptProfileMock.mockResolvedValue({
      id: 'profile-geo',
      name: 'GEO 产品介绍',
      sceneCode: 'intro_geo',
      providerKey: 'static_profile',
      promptText: '介绍 GEO 产品能力',
      openingMessage: '张总您好',
    });
  });

  it('loads prompt profiles and renders the selected profile structure', async () => {
    render(React.createElement(AiCallLabPromptConfigPage));

    expect(screen.getByText('AI Call 提示词配置')).toBeTruthy();
    expect((await screen.findAllByText('GEO 产品介绍')).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText('intro_geo')).toBeTruthy();
    expect(screen.getByDisplayValue('介绍 GEO 产品能力')).toBeTruthy();
    expect(screen.getByText(/平台约束/)).toBeTruthy();
    expect(screen.getByText(/保持自然、专业、合规/)).toBeTruthy();
    expect(screen.getByText(/业务话术/)).toBeTruthy();
  });

  it('keeps the wide prompt workspace bounded and independently scrollable', async () => {
    render(React.createElement(AiCallLabPromptConfigPage));

    expect(await screen.findByDisplayValue('介绍 GEO 产品能力')).toBeTruthy();
    expect(document.querySelector('.ai-call-prompt-config-page')).toBeTruthy();
    expect(document.querySelector('.recov-list-page')).toBeTruthy();
    expect(document.querySelector('.ai-call-prompt-config-grid')).toBeTruthy();
    expect(
      document.querySelectorAll('.ai-call-prompt-config-card'),
    ).toHaveLength(3);
    expect(styles).toMatch(
      /\.ai-call-prompt-config-grid\s*{[^}]*flex:\s*1 1 0[^}]*grid-template-rows:\s*minmax\(0, 1fr\)[^}]*overflow:\s*hidden/s,
    );
    expect(styles).toMatch(
      /\.ai-call-prompt-config-card\.ant-pro-card\s*>\s*\.ant-pro-card-body\s*{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/s,
    );
    expect(styles).toMatch(/@media \(max-width:\s*1399px\)/);
    expect(styles).toMatch(/@media \(max-width:\s*991px\)/);
  });

  it('keeps equal top and bottom spacing inside each scene card', async () => {
    render(React.createElement(AiCallLabPromptConfigPage));

    const sceneButton = await screen.findByRole('button', {
      name: /GEO 产品介绍/,
    });

    expect(sceneButton.classList).toContain('ai-call-prompt-profile-button');
    expect(styles).toMatch(
      /\.ai-call-prompt-profile-button\.ant-btn\s*{[^}]*padding-block:\s*8px/s,
    );
  });

  it('switches profiles and saves the selected prompt profile', async () => {
    render(React.createElement(AiCallLabPromptConfigPage));

    fireEvent.click(
      await screen.findByRole('button', { name: /催收还款提醒/ }),
    );

    expect(screen.getByDisplayValue('催收还款提醒')).toBeTruthy();
    expect(screen.getByText('{{业务话术}}')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    await waitFor(() => {
      expect(savePromptProfileMock).toHaveBeenCalledWith({
        id: 'profile-collection',
        name: '催收还款提醒',
        sceneCode: 'intro_collection',
        providerKey: 'business_query',
        promptText: null,
        openingMessage: null,
      });
    });
  });
});

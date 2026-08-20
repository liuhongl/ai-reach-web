import {
  createAiCallLabSession,
  endAiCallLabSession,
  extractAiCallLabProductInfo,
  getAiCallLabDialoguePreview,
  getAiCallLabEvents,
  getAiCallLabHandoff,
  getAiCallLabPromptCommonConfig,
  getAiCallLabPromptProfiles,
  getAiCallLabPromptComponents,
  getAiCallLabRecording,
  getAiCallLabSession,
  getAiCallLabVoiceProfiles,
  optimizeAiCallLabPrompt,
  reportAiCallLabBrowserEvent,
  previewAiCallLabPromptProfile,
  saveAiCallLabPromptCommonConfig,
  saveAiCallLabPromptProfile,
  unwrapAiCallLabPage,
} from './ai-call-lab';

const mockRuoyiRequest = jest.fn();

jest.mock('@/adapters/ruoyi/request', () => ({
  ruoyiRequest: (...args: unknown[]) => mockRuoyiRequest(...args),
}));

describe('AI Call Lab configuration service', () => {
  beforeEach(() => {
    mockRuoyiRequest.mockReset();
  });

  it('unwraps data.rows and top-level rows responses', () => {
    expect(
      unwrapAiCallLabPage<{ id: string }>({
        data: { rows: [{ id: 'profile-1' }], total: 1 },
      }),
    ).toEqual({ rows: [{ id: 'profile-1' }], total: 1 });
    expect(
      unwrapAiCallLabPage<{ id: string }>({
        rows: [{ id: 'profile-2' }],
        total: 1,
      }),
    ).toEqual({ rows: [{ id: 'profile-2' }], total: 1 });
  });

  it('loads prompt profiles through the AI Call agent proxy', async () => {
    mockRuoyiRequest.mockResolvedValueOnce({
      rows: [{ id: 'prompt-1', name: '客户回访', sceneCode: 'follow_up' }],
      total: 1,
    });

    await getAiCallLabPromptProfiles();

    expect(mockRuoyiRequest).toHaveBeenCalledWith(
      '/ai-call/prompt-profiles',
      {
        baseApi: '/ai-call-agent-api',
        method: 'get',
        params: { pageSize: 200 },
        timeout: 10_000,
      },
    );
  });

  it('uses the authenticated request wrapper for every Lab operation', async () => {
    mockRuoyiRequest.mockResolvedValue({ rows: [], total: 0 });

    await getAiCallLabPromptComponents();
    await getAiCallLabPromptCommonConfig();
    await saveAiCallLabPromptCommonConfig('统一品牌语气');
    await previewAiCallLabPromptProfile({ sceneCode: 'follow_up' });
    await saveAiCallLabPromptProfile({
      id: 'prompt/1',
      name: '客户回访',
      sceneCode: 'follow_up',
      knowledgeVersionSnapshotHash: 'a'.repeat(64),
    });
    await extractAiCallLabProductInfo('prompt/1');
    await optimizeAiCallLabPrompt({
      targetType: 'opening',
      currentContent: '您好',
      sceneContext: {
        sceneName: '客户回访',
        productInfo: '',
        commonPrompt: '',
        variables: [],
      },
    });
    await createAiCallLabSession({ sceneCode: 'follow_up' });
    await reportAiCallLabBrowserEvent('call/1', { type: 'connected' });
    await getAiCallLabSession('call/1');
    await getAiCallLabEvents('call/1', 'event/1');
    await getAiCallLabDialoguePreview('call/1');
    await getAiCallLabRecording('call/1');
    await getAiCallLabHandoff('call/1');
    await endAiCallLabSession('call/1');

    const paths = mockRuoyiRequest.mock.calls.map(([path]) => path);
    expect(paths).toEqual([
      '/ai-call/prompt-components',
      '/ai-call/prompt-common-config',
      '/ai-call/prompt-common-config',
      '/ai-call/prompt-profiles/preview',
      '/ai-call/prompt-profiles/prompt%2F1',
      '/ai-call/prompt-profiles/prompt%2F1/product-info:extract',
      '/ai-call/prompt-profiles/ai-optimize',
      '/ai-call/sessions',
      '/ai-call/sessions/call%2F1/browser-events',
      '/ai-call/sessions/call%2F1',
      '/ai-call/sessions/call%2F1/events',
      '/ai-call/sessions/call%2F1/dialogue-preview',
      '/ai-call/records/call%2F1/recording',
      '/ai-call/sessions/call%2F1/handoff',
      '/ai-call/sessions/call%2F1/end',
    ]);
    expect(
      mockRuoyiRequest.mock.calls.every(
        ([, options]) => options.baseApi === '/ai-call-agent-api',
      ),
    ).toBe(true);
    expect(mockRuoyiRequest).toHaveBeenCalledWith(
      '/ai-call/prompt-profiles/ai-optimize',
      expect.objectContaining({ skipErrorHandler: true }),
    );
    expect(mockRuoyiRequest).toHaveBeenCalledWith(
      '/ai-call/prompt-profiles/prompt%2F1',
      expect.objectContaining({
        data: expect.objectContaining({
          knowledgeVersionSnapshotHash: 'a'.repeat(64),
        }),
        skipErrorHandler: true,
      }),
    );
  });

  it('loads only available voices for formal tasks through the authenticated voice service', async () => {
    mockRuoyiRequest.mockResolvedValue({
      code: 200,
      rows: [],
      total: 0,
    });

    await getAiCallLabVoiceProfiles({ availableOnly: true, pageSize: 200 });

    expect(mockRuoyiRequest).toHaveBeenCalledWith(
      '/ai-call/voice-profiles',
      expect.objectContaining({
        baseApi: '/ai-call-agent-api',
        method: 'get',
        params: expect.objectContaining({
          availableOnly: true,
          pageSize: 200,
        }),
      }),
    );
  });
});

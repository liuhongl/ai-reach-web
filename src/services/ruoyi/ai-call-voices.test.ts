import { ruoyiRequest } from '@/adapters/ruoyi/request';
import {
  createVoiceEnrollment,
  createVoicePreviewAudio,
  deleteTenantVoice,
  getVoiceDeletionCheck,
  listVoiceProfiles,
  reenrollVoice,
  setTenantVoiceAvailability,
} from './ai-call-voices';

jest.mock('@/adapters/ruoyi/request', () => ({
  ruoyiRequest: jest.fn(),
}));

const mockRuoyiRequest = ruoyiRequest as jest.Mock;

const voiceProfile = {
  id: '9007199254740993',
  scope: 'TENANT',
  voice: 'qwen-voice-1',
  displayName: '客服小林',
  voiceType: '自定义复刻',
  gender: '女声',
  language: 'zh',
  targetModel: 'qwen3.5-omni-plus-realtime',
  status: 'ENABLED',
  errorMessage: null,
  canPreview: true,
  canDelete: true,
  createdAt: '2026-07-30T10:00:00Z',
  updatedAt: '2026-07-30T10:00:00Z',
};

const enrollmentPayload = {
  file: new File(['voice'], 'voice.mp3', { type: 'audio/mpeg' }),
  request: {
    displayName: '客服小林',
    gender: '女声' as const,
    language: 'zh' as const,
    consentConfirmed: true,
  },
};

describe('AI Call voice service', () => {
  beforeEach(() => {
    mockRuoyiRequest.mockReset();
  });

  it('uses camelCase parameters and preserves string ids in pagination', async () => {
    mockRuoyiRequest.mockResolvedValueOnce({
      code: 200,
      rows: [voiceProfile],
      total: 1,
    });

    await expect(
      listVoiceProfiles({
        pageNum: 2,
        pageSize: 20,
        voiceType: '自定义复刻',
        availableOnly: false,
        includeDeleted: true,
      }),
    ).resolves.toEqual({ rows: [voiceProfile], total: 1 });

    expect(mockRuoyiRequest).toHaveBeenCalledWith('/ai-call/voice-profiles', {
      baseApi: '/ai-call-agent-api',
      method: 'get',
      params: {
        pageNum: 2,
        pageSize: 20,
        voiceType: '自定义复刻',
        availableOnly: false,
        includeDeleted: true,
      },
    });
  });

  it('submits FormData without manually setting Content-Type', async () => {
    const accepted = {
      voiceProfileId: '9007199254740993',
      enrollmentId: '9007199254740995',
      status: 'CREATING',
      displayName: '客服小林',
    };
    mockRuoyiRequest.mockResolvedValueOnce({ code: 200, data: accepted });

    await expect(
      createVoiceEnrollment(enrollmentPayload, 'uuid-1'),
    ).resolves.toEqual(accepted);

    const [url, options] = mockRuoyiRequest.mock.calls[0];
    expect(url).toBe('/ai-call/voice-enrollments');
    expect(options.baseApi).toBe('/ai-call-agent-api');
    expect(options.method).toBe('post');
    expect(options.repeatSubmit).toBe(false);
    expect(options.skipErrorHandler).toBe(true);
    expect(options.data).toBeInstanceOf(FormData);
    expect(options.data.get('file')).toBe(enrollmentPayload.file);
    expect(options.data.get('request')).toBe(
      JSON.stringify(enrollmentPayload.request),
    );
    expect(options.headers).toEqual({ 'Idempotency-Key': 'uuid-1' });
    expect(options.headers).not.toHaveProperty('Content-Type');
  });

  it('posts reenrollment to the tenant profile path with the same contract', async () => {
    const accepted = {
      voiceProfileId: '9007199254740993',
      enrollmentId: '9007199254740996',
      status: 'CREATING',
      displayName: '客服小林',
    };
    mockRuoyiRequest.mockResolvedValueOnce({ code: 200, data: accepted });

    await expect(
      reenrollVoice('9007199254740993', enrollmentPayload, 'uuid-2'),
    ).resolves.toEqual(accepted);

    const [url, options] = mockRuoyiRequest.mock.calls[0];
    expect(url).toBe(
      '/ai-call/tenant-voice-profiles/9007199254740993/enrollments',
    );
    expect(options.data).toBeInstanceOf(FormData);
    expect(options.headers).toEqual({ 'Idempotency-Key': 'uuid-2' });
    expect(options.headers).not.toHaveProperty('Content-Type');
    expect(options.skipErrorHandler).toBe(true);
  });

  it('creates a direct preview audio without a LiveKit session lifecycle', async () => {
    const previewAudio = {
      audioUrl: 'data:audio/wav;base64,UklGRg==',
      text: '您好，我是您的智能语音助手，很高兴为您服务。',
    };
    mockRuoyiRequest.mockResolvedValueOnce({ code: 200, data: previewAudio });

    await expect(createVoicePreviewAudio('qwen-voice-1')).resolves.toEqual(
      previewAudio,
    );

    expect(mockRuoyiRequest.mock.calls).toEqual([
      [
        '/ai-call/voice-preview-audio',
        {
          baseApi: '/ai-call-agent-api',
          method: 'post',
          data: { voice: 'qwen-voice-1' },
        },
      ],
    ]);
  });

  it('checks references before deleting a tenant voice with an idempotency key', async () => {
    const check = {
      deletable: true,
      blockingTaskCount: 0,
      historicalTaskCount: 3,
      blockingTaskIds: [],
    };
    const accepted = {
      voiceProfileId: '9007199254740993',
      deletionId: '9007199254740997',
      status: 'DELETING',
    };
    mockRuoyiRequest
      .mockResolvedValueOnce({ code: 200, data: check })
      .mockResolvedValueOnce({ code: 200, data: accepted });

    await expect(
      getVoiceDeletionCheck('9007199254740993'),
    ).resolves.toEqual(check);
    await expect(
      deleteTenantVoice('9007199254740993', 'uuid-delete'),
    ).resolves.toEqual(accepted);

    expect(mockRuoyiRequest.mock.calls).toEqual([
      [
        '/ai-call/tenant-voice-profiles/9007199254740993/deletion-check',
        {
          baseApi: '/ai-call-agent-api',
          method: 'get',
        },
      ],
      [
        '/ai-call/tenant-voice-profiles/9007199254740993',
        {
          baseApi: '/ai-call-agent-api',
          method: 'delete',
          headers: { 'Idempotency-Key': 'uuid-delete' },
        },
      ],
    ]);
  });

  it('updates custom voice availability with the dedicated status endpoint', async () => {
    const disabledProfile = {
      ...voiceProfile,
      status: 'DISABLED',
      canPreview: false,
      canDelete: true,
    };
    mockRuoyiRequest.mockResolvedValueOnce({
      code: 200,
      data: disabledProfile,
    });

    await expect(
      setTenantVoiceAvailability('9007199254740993', 'DISABLED'),
    ).resolves.toEqual(disabledProfile);

    expect(mockRuoyiRequest.mock.calls).toEqual([
      [
        '/ai-call/tenant-voice-profiles/9007199254740993/status',
        {
          baseApi: '/ai-call-agent-api',
          method: 'patch',
          data: { status: 'DISABLED' },
        },
      ],
    ]);
  });

  it('rejects malformed response envelopes', async () => {
    mockRuoyiRequest
      .mockResolvedValueOnce({ rows: [voiceProfile], total: 1 })
      .mockResolvedValueOnce({ code: 200 });

    await expect(
      listVoiceProfiles({ pageNum: 1, pageSize: 20 }),
    ).rejects.toThrow('接口响应缺少 code');
    await expect(
      createVoicePreviewAudio('qwen-voice-1'),
    ).rejects.toThrow('接口响应缺少 data');
  });
});

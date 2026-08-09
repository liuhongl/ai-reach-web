import {
  canPollVoiceStatus,
  getVoiceStatusMeta,
  validateVoiceSample,
} from './domain';

describe('voice domain', () => {
  it('only polls active states', () => {
    expect(canPollVoiceStatus('CREATING')).toBe(true);
    expect(canPollVoiceStatus('DELETING')).toBe(true);
    expect(canPollVoiceStatus('ENABLED')).toBe(false);
    expect(canPollVoiceStatus('CREATE_FAILED')).toBe(false);
    expect(canPollVoiceStatus('DELETE_FAILED')).toBe(false);
    expect(canPollVoiceStatus('DELETED')).toBe(false);
  });

  it('labels deletion failures without making them selectable', () => {
    expect(getVoiceStatusMeta('DELETE_FAILED')).toMatchObject({
      label: '删除失败',
      selectable: false,
    });
    expect(getVoiceStatusMeta('ENABLED')).toMatchObject({
      label: '可用',
      selectable: true,
    });
  });

  it.each([
    ['voice.wav', 'audio/wav'],
    ['voice.WAV', 'audio/x-wav'],
    ['voice.mp3', 'audio/mpeg'],
    ['voice.m4a', 'audio/mp4'],
  ])('accepts supported sample %s with matching MIME', (name, type) => {
    expect(validateVoiceSample(new File(['voice'], name, { type }))).toBeNull();
  });

  it('rejects an empty file', () => {
    expect(
      validateVoiceSample(new File([], 'voice.mp3', { type: 'audio/mpeg' })),
    ).toBe('声音样本不能为空');
  });

  it('rejects unsupported extensions', () => {
    expect(
      validateVoiceSample(
        new File(['voice'], 'voice.ogg', { type: 'audio/ogg' }),
      ),
    ).toBe('声音样本仅支持 WAV、MP3 或 M4A');
  });

  it('rejects a mismatched MIME type', () => {
    expect(
      validateVoiceSample(
        new File(['voice'], 'voice.mp3', { type: 'application/octet-stream' }),
      ),
    ).toBe('声音样本 MIME 类型不受支持');
  });

  it('rejects files at or above 10 MB', () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024)], 'voice.mp3', {
      type: 'audio/mpeg',
    });
    expect(validateVoiceSample(file)).toBe('声音样本必须小于 10 MB');
  });
});

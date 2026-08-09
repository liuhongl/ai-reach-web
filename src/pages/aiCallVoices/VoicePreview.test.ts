import { playVoicePreviewAudio } from './VoicePreview';

describe('playVoicePreviewAudio', () => {
  let play: jest.SpyInstance<Promise<void>, []>;
  let pause: jest.SpyInstance<void, []>;

  beforeEach(() => {
    play = jest
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
    pause = jest
      .spyOn(window.HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.querySelectorAll('audio').forEach((audio) => {
      audio.remove();
    });
    jest.restoreAllMocks();
  });

  it('plays a direct audio url without LiveKit', async () => {
    const preview = await playVoicePreviewAudio({
      audioUrl: 'data:audio/wav;base64,UklGRg==',
    });

    const audio = document.body.querySelector('audio');
    expect(audio?.getAttribute('src')).toBe('data:audio/wav;base64,UklGRg==');
    expect(audio?.autoplay).toBe(true);
    expect(audio?.muted).toBe(false);
    expect(audio?.hasAttribute('playsinline')).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);

    await preview.disconnect();

    expect(pause).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('audio')).toBeNull();
  });

  it('notifies the page after playback ends', async () => {
    const onEnded = jest.fn();
    await playVoicePreviewAudio(
      { audioUrl: 'data:audio/wav;base64,UklGRg==' },
      onEnded,
    );

    document.body.querySelector('audio')?.dispatchEvent(new Event('ended'));
    await Promise.resolve();

    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('audio')).toBeNull();
  });

  it('rejects an empty audio url', async () => {
    await expect(playVoicePreviewAudio({ audioUrl: '' })).rejects.toThrow(
      '缺少试听音频地址',
    );
  });

  it('removes the audio element when playback fails', async () => {
    play.mockRejectedValueOnce(new Error('浏览器拒绝播放'));

    await expect(
      playVoicePreviewAudio({ audioUrl: 'data:audio/wav;base64,UklGRg==' }),
    ).rejects.toThrow('浏览器拒绝播放');

    expect(document.body.querySelector('audio')).toBeNull();
  });
});

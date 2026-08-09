import type { VoicePreviewAudio } from '@/services/ruoyi/ai-call-voices.types';

export type VoicePreviewConnection = {
  disconnect: () => Promise<void>;
};

export const playVoicePreviewAudio = async (
  previewAudio: Pick<VoicePreviewAudio, 'audioUrl'>,
  onEnded?: () => void,
): Promise<VoicePreviewConnection> => {
  if (!previewAudio.audioUrl) {
    throw new Error('缺少试听音频地址');
  }

  const audio = document.createElement('audio');
  let disconnectPromise: Promise<void> | undefined;
  let pageHideListenerRegistered = false;

  const disconnect = () => {
    if (disconnectPromise) return disconnectPromise;
    if (pageHideListenerRegistered) {
      window.removeEventListener('pagehide', handlePageHide);
      pageHideListenerRegistered = false;
    }
    disconnectPromise = Promise.resolve().then(() => {
      audio.pause();
      audio.remove();
    });
    return disconnectPromise;
  };

  const handlePageHide = () => {
    void disconnect().catch(() => undefined);
  };

  audio.autoplay = true;
  audio.muted = false;
  audio.setAttribute('playsinline', '');
  audio.setAttribute('src', previewAudio.audioUrl);
  audio.addEventListener(
    'ended',
    () => {
      onEnded?.();
      void disconnect().catch(() => undefined);
    },
    { once: true },
  );
  document.body.appendChild(audio);
  window.addEventListener('pagehide', handlePageHide);
  pageHideListenerRegistered = true;

  try {
    await audio.play();
  } catch (error) {
    try {
      await disconnect();
    } catch {
      // 保留浏览器播放失败的原始错误。
    }
    throw error;
  }

  return { disconnect };
};

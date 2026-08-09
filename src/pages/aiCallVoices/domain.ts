import type { VoiceStatus } from '@/services/ruoyi/ai-call-voices.types';

const MAX_VOICE_SAMPLE_BYTES = 10 * 1024 * 1024;

const SAMPLE_MIME_BY_EXTENSION: Record<string, ReadonlySet<string>> = {
  '.wav': new Set(['audio/wav', 'audio/x-wav', 'audio/wave']),
  '.mp3': new Set(['audio/mpeg', 'audio/mp3']),
  '.m4a': new Set(['audio/mp4', 'audio/m4a', 'audio/x-m4a']),
};

export const ACTIVE_VOICE_STATUSES = new Set<VoiceStatus>([
  'CREATING',
  'DELETING',
]);

export type VoiceStatusMeta = {
  label: string;
  color: string;
  selectable: boolean;
};

const VOICE_STATUS_META: Record<VoiceStatus, VoiceStatusMeta> = {
  CREATING: {
    label: '创建中',
    color: 'processing',
    selectable: false,
  },
  ENABLED: {
    label: '可用',
    color: 'success',
    selectable: true,
  },
  DISABLED: {
    label: '停用',
    color: 'default',
    selectable: false,
  },
  CREATE_FAILED: {
    label: '创建失败',
    color: 'error',
    selectable: false,
  },
  DELETING: {
    label: '删除中',
    color: 'warning',
    selectable: false,
  },
  DELETE_FAILED: {
    label: '删除失败',
    color: 'error',
    selectable: false,
  },
  DELETED: {
    label: '已删除',
    color: 'default',
    selectable: false,
  },
};

export const canPollVoiceStatus = (status: VoiceStatus) =>
  ACTIVE_VOICE_STATUSES.has(status);

export const getVoiceStatusMeta = (status: VoiceStatus) =>
  VOICE_STATUS_META[status];

export const validateVoiceSample = (file: File): string | null => {
  if (file.size === 0) {
    return '声音样本不能为空';
  }

  const extension = file.name
    .slice(file.name.lastIndexOf('.'))
    .toLocaleLowerCase();
  const supportedMimeTypes = SAMPLE_MIME_BY_EXTENSION[extension];
  if (!supportedMimeTypes) {
    return '声音样本仅支持 WAV、MP3 或 M4A';
  }
  if (!supportedMimeTypes.has(file.type.toLocaleLowerCase())) {
    return '声音样本 MIME 类型不受支持';
  }
  if (file.size >= MAX_VOICE_SAMPLE_BYTES) {
    return '声音样本必须小于 10 MB';
  }
  return null;
};

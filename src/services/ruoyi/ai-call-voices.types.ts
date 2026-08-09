export type VoiceStatus =
  | 'CREATING'
  | 'ENABLED'
  | 'DISABLED'
  | 'CREATE_FAILED'
  | 'DELETING'
  | 'DELETE_FAILED'
  | 'DELETED';

export type VoiceScope = 'GLOBAL' | 'TENANT';

export type VoiceAvailabilityStatus = 'ENABLED' | 'DISABLED';

export type AiCallVoiceProfile = {
  id: string;
  scope: VoiceScope;
  voice: string | null;
  displayName: string;
  voiceType: string;
  gender: string;
  language?: string | null;
  targetModel: string;
  status: VoiceStatus;
  errorMessage?: string | null;
  canPreview: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VoiceProfileQuery = {
  pageNum?: number;
  pageSize?: number;
  voiceType?: string;
  gender?: string;
  status?: VoiceStatus;
  includeDeleted?: boolean;
  availableOnly?: boolean;
};

export type PageResult<T> = {
  rows: T[];
  total: number;
};

export type VoiceEnrollmentRequest = {
  displayName: string;
  gender: '未知' | '女声' | '男声';
  language: 'zh';
  transcript?: string;
  consentConfirmed: boolean;
};

export type VoiceEnrollmentPayload = {
  file: File;
  request: VoiceEnrollmentRequest;
};

export type VoiceEnrollmentAccepted = {
  voiceProfileId: string;
  enrollmentId: string;
  status: 'CREATING';
  displayName: string;
};

export type VoicePreviewAudio = {
  audioUrl: string;
  text?: string;
};

export type VoiceDeletionCheck = {
  voiceProfileId?: string;
  deletable: boolean;
  blockingTaskCount: number;
  historicalTaskCount: number;
  blockingTaskIds: string[];
};

export type VoiceDeletionAccepted = {
  voiceProfileId: string;
  deletionId: string;
  status: 'DELETING' | 'DELETED' | 'DELETE_FAILED';
};

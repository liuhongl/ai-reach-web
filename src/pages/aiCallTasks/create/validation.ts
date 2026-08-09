import dayjs from 'dayjs';
import type { AiCallRule } from '@/pages/aiCallRules/domain';
import type { ExecutionMode } from '../domain';

type ExecutionPlan = {
  executionMode: ExecutionMode;
  scheduledAt?: string;
  rule: AiCallRule;
  now?: Date;
};

export const MAX_BATCH_TARGET_FILE_SIZE = 10 * 1024 * 1024;

export const validateBatchTargetFile = (file: File): string | undefined => {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return '仅支持 .xlsx 格式的名单文件';
  }
  if (file.size > MAX_BATCH_TARGET_FILE_SIZE) {
    return '名单文件大小不能超过 10 MB';
  }
  return undefined;
};

const isAllowedTime = (time: string, rule: AiCallRule) =>
  rule.callWindows.some(
    (window) => time >= window.startTime && time < window.endTime,
  );

export const validateExecutionPlan = ({
  executionMode,
  scheduledAt,
  rule,
  now = new Date(),
}: ExecutionPlan): string | undefined => {
  if (!rule.enabled) return '呼叫规则已停用';

  const nowValue = dayjs(now);
  if (executionMode === 'immediate') {
    return isAllowedTime(nowValue.format('HH:mm'), rule)
      ? undefined
      : '当前时间不在呼叫规则允许时段内';
  }

  if (!scheduledAt) return '请选择计划执行时间';
  const scheduledValue = dayjs(scheduledAt);
  if (!scheduledValue.isValid()) return '计划执行时间无效';
  if (!scheduledValue.isAfter(nowValue)) {
    return '计划执行时间必须晚于当前时间';
  }
  return isAllowedTime(scheduledValue.format('HH:mm'), rule)
    ? undefined
    : '计划执行时间不在呼叫规则允许时段内';
};

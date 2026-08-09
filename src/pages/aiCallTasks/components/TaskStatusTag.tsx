import { Tag } from 'antd';
import React from 'react';
import type { TaskStatus } from '../domain';

const statusConfig: Record<TaskStatus, { color: string; label: string }> = {
  SCHEDULED: { color: 'processing', label: '待执行' },
  RUNNING: { color: 'processing', label: '执行中' },
  PAUSING: { color: 'warning', label: '暂停中' },
  PAUSED: { color: 'warning', label: '已暂停' },
  STOPPING: { color: 'warning', label: '停止中' },
  STOPPED: { color: 'default', label: '已停止' },
  COMPLETED: { color: 'success', label: '已完成' },
  FAILED: { color: 'error', label: '失败' },
  CANCELLED: { color: 'default', label: '已取消' },
};

const TaskStatusTag = ({ status }: { status: TaskStatus }) => {
  const config = statusConfig[status];
  return <Tag color={config.color}>{config.label}</Tag>;
};

export default TaskStatusTag;

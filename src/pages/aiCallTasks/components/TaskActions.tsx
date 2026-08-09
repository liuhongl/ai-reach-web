import {
  CloseCircleOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import React from 'react';
import TableActions, { type TableActionItem } from '@/components/TableActions';
import {
  type AiCallTask,
  getAllowedTaskActions,
  type TaskActionKey,
} from '../domain';

type TaskActionsProps = {
  task: AiCallTask;
  loadingAction?: TaskActionKey;
  onAction: (action: TaskActionKey, task: AiCallTask) => void;
};

const actionConfig: Record<
  TaskActionKey,
  Pick<TableActionItem, 'label' | 'danger' | 'icon'>
> = {
  editSchedule: { label: '修改', icon: <EditOutlined /> },
  pause: { label: '暂停', icon: <PauseCircleOutlined /> },
  resume: { label: '恢复', icon: <PlayCircleOutlined /> },
  stop: { label: '停止', danger: true, icon: <StopOutlined /> },
  cancel: { label: '取消', danger: true, icon: <CloseCircleOutlined /> },
  view: { label: '查看' },
};

const TaskActions = ({ task, loadingAction, onAction }: TaskActionsProps) => {
  const actions = getAllowedTaskActions(task.status).map((action) => ({
    key: action,
    ...actionConfig[action],
    loading: loadingAction === action,
    disabled: loadingAction !== undefined && loadingAction !== action,
    onClick: () => onAction(action, task),
  }));

  return <TableActions actions={actions} maxVisible={3} showLabels />;
};

export default TaskActions;

import { render, screen } from '@testing-library/react';
import * as React from 'react';
import TaskActions from './TaskActions';

void React.createElement;

jest.mock('@/components/TableActions', () => ({
  __esModule: true,
  default: ({
    actions,
  }: {
    actions: Array<{ icon?: unknown; key: string }>;
  }) => (
    <div>
      {actions.map((action) => (
        <span data-testid={action.key} key={action.key}>
          {action.icon ? '有图标' : '无图标'}
        </span>
      ))}
    </div>
  ),
}));

describe('TaskActions', () => {
  it('查看操作只保留主题文字，不展示眼睛图标', () => {
    render(
      <TaskActions
        task={{
          taskId: 'task-1',
          taskName: '已完成任务',
          taskMode: 'batch',
          status: 'COMPLETED',
          totalTargets: 1,
          completedTargets: 1,
          connectedTargets: 1,
          failedTargets: 0,
          executionMode: 'immediate',
          promptName: 'GEO 产品介绍',
          sceneCode: 'intro_geo',
          voice: 'liuhongli',
          ruleId: 'rule-1',
          ruleName: '工作日规则',
          ruleSummary: '-',
          createdAt: '2026-08-07 22:00:00',
          updatedAt: '2026-08-07 22:00:00',
        }}
        onAction={jest.fn()}
      />,
    );

    expect(screen.getByTestId('view').textContent).toBe('无图标');
  });
});

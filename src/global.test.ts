import fs from 'node:fs';
import path from 'node:path';

describe('global AI Reach styles', () => {
  const styles = fs.readFileSync(path.join(__dirname, 'global.less'), 'utf8');

  it('保留列表、分页、任务创建和侧栏通知所需规则', () => {
    expect(styles).toContain('.recov-list-page.ant-pro-page-container');
    expect(styles).toContain('.recov-stable-pagination-table .ant-table-wrapper');
    expect(styles).toContain(
      '.recov-stable-pagination-table > .ant-pro-card:last-child',
    );
    expect(styles).toContain('--recov-page-content-gap: 24px');
    expect(styles).toContain('padding: var(--recov-page-content-gap)');
    expect(styles).toContain('.recov-task-create-page.ant-pro-page-container');
    expect(styles).toContain('.recov-sider-footer-action');
    expect(styles).toContain("button[aria-label='通知中心']");
  });

  it('菜单列表页统一使用固定分页和表内滚动布局', () => {
    const pageFiles = [
      'pages/aiCallVoices/index.tsx',
      'pages/aiCallLines/index.tsx',
      'pages/aiCallRules/index.tsx',
      'pages/aiCallTasks/index.tsx',
      'pages/aiCallRecords/index.tsx',
      'pages/agentWorkbench/admin/handoffs/index.tsx',
      'pages/agentWorkbench/admin/followUps/index.tsx',
      'pages/agentWorkbench/admin/agents/index.tsx',
      'pages/agentWorkbench/components/FollowUpPanel.tsx',
    ];

    pageFiles.forEach((file) => {
      const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
      expect(source).toContain('recov-stable-pagination-table');
      expect(source).toContain('showSizeChanger: true');
      expect(source).toContain('showTotal:');
    });
  });

  it('不包含 Recov 流程中心样式', () => {
    expect(styles).not.toContain('flow-event-center-tabs');
  });
});

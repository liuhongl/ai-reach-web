import fs from 'node:fs';
import path from 'node:path';

describe('global AI Reach styles', () => {
  const styles = fs.readFileSync(path.join(__dirname, 'global.less'), 'utf8');

  it('保留列表、分页、任务创建和侧栏通知所需规则', () => {
    expect(styles).toContain('.recov-list-page.ant-pro-page-container');
    expect(styles).toContain('.recov-stable-pagination-table.ant-table-wrapper');
    expect(styles).toContain('.recov-task-create-page.ant-pro-page-container');
    expect(styles).toContain('.recov-sider-footer-action');
  });

  it('不包含 Recov 流程中心样式', () => {
    expect(styles).not.toContain('flow-event-center-tabs');
  });
});

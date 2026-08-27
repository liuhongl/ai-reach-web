import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import * as React from 'react';
import AgentAdminPage from './index';

type ContainerProps = {
  children?: unknown;
};

jest.mock('@ant-design/pro-components', () => {
  const ReactModule = jest.requireActual('react');
  const Container = ({ children }: ContainerProps) =>
    ReactModule.createElement('div', null, children as never);

  return {
    PageContainer: Container,
    ProCard: Container,
    ProTable: () => null,
  };
});

const sourcePath = path.join(__dirname, 'index.tsx');

describe('agent administration page', () => {
  it('renders safely before a detail record is selected', () => {
    expect(() => render(<AgentAdminPage />)).not.toThrow();
  });

  it('contains the required metrics, filters, columns and guarded actions', () => {
    const source = fs.readFileSync(sourcePath, 'utf8');
    for (const text of [
      '已启用',
      '当前在线',
      '当前空闲',
      '通话中',
      '异常占用',
      '用户姓名或账号',
      '启用状态',
      '运行状态',
      '业务场景',
      '坐席',
      '可接场景',
      '当前通话',
      '最近心跳',
      '添加坐席',
      '编辑坐席',
      '强制释放',
    ])
      expect(source).toContain(text);
    expect(source).toContain('releaseStaleAgent');
    expect(source).toContain('row.stale_occupied');
    expect(source).toContain('metrics.stale_occupied');
    expect(source).toContain('Modal.confirm');
    expect(source).toContain('showLabels');
    expect(source).not.toContain('最大并发');
    expect(source).not.toContain('编辑手机号');
  });
});

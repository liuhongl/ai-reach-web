import { render, screen } from '@testing-library/react';
import * as React from 'react';
import TableActions from './index';

jest.mock('@/components/Permission', () => ({
  usePermission: () => ({ canAccess: () => true }),
}));

describe('TableActions', () => {
  it('支持在表格操作列显示中文按钮文案', () => {
    render(
      <TableActions
        showLabels
        actions={[
          {
            key: 'pause',
            label: '暂停',
            onClick: jest.fn(),
          },
          {
            key: 'stop',
            label: '停止',
            onClick: jest.fn(),
          },
          {
            key: 'view',
            label: '查看',
            onClick: jest.fn(),
          },
        ]}
        maxVisible={3}
      />,
    );

    expect(screen.getByRole('button', { name: '暂停' }).textContent).toBe(
      '暂停',
    );
    expect(screen.getByRole('button', { name: '停止' }).textContent).toBe(
      '停止',
    );
    expect(screen.getByRole('button', { name: '查看' }).textContent).toBe(
      '查看',
    );
    expect(screen.getByRole('button', { name: '查看' }).className).toContain(
      'ant-btn-link',
    );
  });
});

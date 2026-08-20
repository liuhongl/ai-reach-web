import fs from 'node:fs';
import path from 'node:path';
import { render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { listAdminAgents } from '@/services/ruoyi/agent-console';
import AgentName from './AgentName';

jest.mock('@/services/ruoyi/agent-console', () => ({
  listAdminAgents: jest.fn(),
}));

const mockedListAdminAgents = jest.mocked(listAdminAgents);

describe('AgentName', () => {
  it('优先展示坐席中文名，未知坐席保留内部标识', async () => {
    mockedListAdminAgents.mockResolvedValue({
      data: {
        rows: [
          {
            id: '1',
            tenant_id: '1',
            user_id: '1',
            user_name: 'local-admin',
            nick_name: '本地联调管理员',
            agent_identity: 'agent-admin',
            enabled: true,
            scene_codes: ['intro_geo'],
          },
        ],
      },
    } as never);

    render(
      <>
        <AgentName identity="agent-admin" />
        <AgentName identity="unknown-agent" />
        <AgentName identity={null} emptyText="待认领" />
      </>,
    );

    await waitFor(() =>
      expect(document.body.textContent).toContain('本地联调管理员'),
    );
    expect(document.body.textContent).toContain('unknown-agent');
    expect(document.body.textContent).toContain('待认领');
  });

  it('相关管理页面统一使用坐席名称展示', () => {
    for (const file of [
      '../admin/handoffs/index.tsx',
      '../admin/followUps/index.tsx',
      '../../aiCallFollowUpData/index.tsx',
      '../../aiCallRecords/index.tsx',
      '../../aiCallRecords/CallRecordDetailContent.tsx',
    ]) {
      const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
      expect(source).toContain('<AgentName');
    }
  });
});

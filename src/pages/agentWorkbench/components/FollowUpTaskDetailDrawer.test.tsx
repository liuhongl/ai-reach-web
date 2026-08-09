import { render, screen, within } from '@testing-library/react';
import * as React from 'react';
import FollowUpTaskDetailDrawer from './FollowUpTaskDetailDrawer';

jest.mock('@/pages/aiCallRecords/CallRecordDetailContent', () => () => null);
jest.mock('./FollowUpCallDetail', () => () => null);

const task = {
  id: 'follow-up-1',
  source_type: 'after_call_work',
  source_call_id: 'call-1',
  source_handoff_id: null,
  scene_code: 'intro_geo',
  customer_name: '刘先生',
  masked_contact: '199****1001',
  status: 'processing',
  follow_up_reason: '用户明确要求转人工',
  customer_callback_at: '2026-08-05T23:07:00+08:00',
  created_at: '2026-08-03T22:21:03+08:00',
  latest_attempt: {
    id: 'attempt-1',
    follow_up_id: 'follow-up-1',
    agent_identity: 'agent-admin',
    contact_channel: 'manual_phone',
    attempt_result: 'connected',
    contacted_at: '2026-08-05T23:04:25+08:00',
  },
  source_record: {
    id: 'record-1',
    call_id: 'call-1',
    entry_type: 'owner_runtime',
    status: 'completed',
    started_at: '2026-08-03T22:15:59+08:00',
  },
  callback_records: [
    {
      id: 'record-2',
      call_id: 'call-2',
      entry_type: 'owner_runtime',
      status: 'completed',
      started_at: '2026-08-05T16:52:30+08:00',
    },
  ],
  handling_results: [
    {
      id: 'handling-1',
      follow_up_id: 'follow-up-1',
      related_call_id: 'call-2',
      contact_channel: 'manual_phone',
      contact_result: 'connected',
      remark: '大大',
      next_action: 'continue',
      next_follow_up_at: '2026-08-05T22:53:00+08:00',
      agent_identity: 'agent-admin',
      handled_at: '2026-08-05T22:53:39+08:00',
    },
  ],
} as any;

describe('FollowUpTaskDetailDrawer', () => {
  it('renders the identical task overview and related timeline for every entry', () => {
    render(<FollowUpTaskDetailDrawer open onClose={jest.fn()} task={task} />);

    const drawer = screen.getByRole('dialog', { name: '跟进任务详情' });
    expect(within(drawer).getByText('刘先生 · 199****1001')).toBeTruthy();
    expect(within(drawer).getByText('用户明确要求转人工')).toBeTruthy();
    expect(within(drawer).getByText('关联通话与处理记录')).toBeTruthy();
    expect(
      within(drawer).getByRole('button', { name: '查看原始通话详情' }),
    ).toBeTruthy();
    expect(
      within(drawer).getByText('回拨时间：2026-08-05 16:52:30'),
    ).toBeTruthy();
    expect(within(drawer).queryByText(/^处理时间：/)).toBeNull();
  });

  it('手机号未提供时只展示客户姓名', () => {
    render(
      <FollowUpTaskDetailDrawer
        open
        onClose={jest.fn()}
        task={{ ...task, masked_contact: '未提供' }}
      />,
    );

    const drawer = screen.getByRole('dialog', { name: '跟进任务详情' });
    expect(within(drawer).getByText('刘先生')).toBeTruthy();
    expect(within(drawer).queryByText('刘先生 · 未提供')).toBeNull();
    expect(within(drawer).queryByText('未提供')).toBeNull();
  });
});

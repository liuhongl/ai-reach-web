import { cleanup, render, screen } from '@testing-library/react';
import * as React from 'react';
import type {
  HandoffContextDto,
  HandoffDto,
} from '@/services/ruoyi/agent-console';
import HandoffContextPanel from './HandoffContextPanel';

const handoff: HandoffDto = {
  handoff_id: 'handoff-1',
  call_id: 'call-1',
  scene_code: 'intro_contract',
  status: 'connected',
  request_source: 'customer',
  request_reason: 'customer_request',
  request_message: '请转人工',
  handoff_summary: '客户希望人工确认续约时间',
  requested_at: '2026-07-30T10:00:00.000Z',
};

const context: HandoffContextDto = {
  ...handoff,
  dialogue: [
    {
      id: '1',
      speaker_type: 'ai',
      text: 'AI 开场',
      occurred_at: '2026-07-30T10:00:01.000Z',
    },
    {
      id: '2',
      speaker_type: 'customer',
      text: '客户回复',
      occurred_at: '2026-07-30T10:00:02.000Z',
    },
    { id: '3', speaker_type: 'ai', text: 'AI 第三条' },
    { id: '4', speaker_type: 'customer', text: '客户第四条' },
    { id: '5', speaker_type: 'ai', text: 'AI 第五条' },
    { id: '6', speaker_type: 'customer', text: '客户第六条' },
    { id: '7', speaker_type: 'ai', text: 'AI 第七条' },
    { id: '8', speaker_type: 'customer', text: '客户第八条' },
  ],
};

describe('HandoffContextPanel', () => {
  afterEach(cleanup);

  it('keeps the summary and renders every AI/customer turn without timestamps', () => {
    render(<HandoffContextPanel handoff={handoff} context={context} />);

    expect(screen.getByText('客户希望人工确认续约时间')).toBeTruthy();
    expect(screen.getByText('完整会话')).toBeTruthy();
    expect(screen.getAllByTestId('dialogue-turn')).toHaveLength(8);
    expect(screen.queryByText('待处理事项')).toBeNull();
    expect(screen.queryByText('最近对话')).toBeNull();
    expect(screen.queryByText(/2026-07-30T10:00/)).toBeNull();
    expect(
      screen
        .getByText('AI：AI 开场')
        .closest('[data-speaker]')
        ?.getAttribute('data-speaker'),
    ).toBe('ai');
    expect(
      screen.getByText('AI：AI 开场').closest('[data-speaker]')?.textContent,
    ).toBe('AI：AI 开场');
    expect(
      screen
        .getByText('客户：客户回复')
        .closest('[data-speaker]')
        ?.getAttribute('data-speaker'),
    ).toBe('customer');
    expect(
      screen.getByText('客户：客户回复').closest('[data-speaker]')?.textContent,
    ).toBe('客户：客户回复');
  });

  it('keeps the handoff context focused on the summary and full conversation', () => {
    render(<HandoffContextPanel handoff={handoff} context={context} />);

    const dialogue = screen.getByText('完整会话').closest('section');
    expect(dialogue).toBeTruthy();
    expect(dialogue?.className).toContain('agent-handoff-dialogue');
    expect(screen.getByTestId('dialogue-scroll').className).toContain(
      'agent-handoff-dialogue-scroll',
    );
    expect(screen.queryByText('业务资料')).toBeNull();
    expect(screen.queryByText('转人工原因：')).toBeNull();
    expect(screen.queryByText('业务来源：')).toBeNull();
    expect(screen.queryByText('通话编号：')).toBeNull();
  });
});

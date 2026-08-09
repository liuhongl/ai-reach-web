import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as React from 'react';
import type { HandoffDto } from '@/services/ruoyi/agent-console';
import WaitingPool from './WaitingPool';

const now = Date.parse('2026-07-22T10:00:35.000Z');
const handoff: HandoffDto = {
  handoff_id: 'handoff-1',
  call_id: 'call-1',
  scene_code: 'intro_geo',
  status: 'requested',
  masked_customer_name: '张**',
  masked_contact: '138****0000',
  request_reason: '客户要求人工解释方案',
  request_message: '请帮我转人工',
  handoff_summary: '客户希望确认 GEO 服务范围',
  pending_items: [
    { text: '确认服务范围' },
    { text: '确认交付周期' },
    { text: '确认报价' },
    { text: '第四项不应展示' },
  ],
  recent_dialogue: [{ speaker_type: 'customer', text: '我想找人工确认' }],
  requested_at: '2026-07-22T10:00:00.000Z',
};

describe('WaitingPool', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => 'claim-key-1'),
    });
  });

  it('shows the actionable handoff snapshot and SLA level', () => {
    render(
      <WaitingPool
        handoffs={[handoff]}
        agentStatus="available"
        consoleSessionId="session-1"
        now={now}
      />,
    );

    expect(screen.getByText('GEO')).toBeTruthy();
    expect(screen.getByText('张** · 138****0000')).toBeTruthy();
    expect(screen.getByText('已等待 35 秒')).toBeTruthy();
    expect(screen.getByText('客户希望确认 GEO 服务范围')).toBeTruthy();
    expect(screen.queryByText('确认服务范围')).toBeNull();
    expect(screen.queryByText('第四项不应展示')).toBeNull();
    expect(
      screen
        .getByText('已等待 35 秒')
        .closest('[data-sla-level]')
        ?.getAttribute('data-sla-level'),
    ).toBe('warning');
  });

  it('falls back to the customer request and recent dialogue while summary is pending', () => {
    render(
      <WaitingPool
        handoffs={[
          {
            ...handoff,
            request_reason: undefined,
            handoff_summary: null,
            pending_items: [],
          },
        ]}
        agentStatus="available"
        consoleSessionId="session-1"
        now={now}
      />,
    );

    expect(screen.getByText('请帮我转人工')).toBeTruthy();
    expect(screen.queryByText('我想找人工确认')).toBeNull();
  });

  it('sends only one idempotent claim for repeated clicks', async () => {
    let resolveClaim: ((value: unknown) => void) | undefined;
    const claim = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveClaim = resolve;
        }),
    );
    render(
      <WaitingPool
        handoffs={[handoff]}
        agentStatus="available"
        consoleSessionId="session-1"
        claim={claim}
        now={now}
      />,
    );

    const button = screen.getByRole('button', { name: /接管通话/ });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(claim).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalledWith('handoff-1', {
      consoleSessionId: 'session-1',
      idempotencyKey: 'claim-key-1',
    });
    resolveClaim?.({
      handoff,
      livekit_url: 'ws://livekit',
      participant_token: 'token',
    });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
  });

  it('normalizes the backend handoff and seat token response before connecting media', async () => {
    const acceptedHandoff: HandoffDto = {
      ...handoff,
      status: 'accepted',
    };
    const onClaimed = jest.fn();
    const claim = jest.fn().mockResolvedValue({
      code: 200,
      data: {
        handoff: acceptedHandoff,
        seat_token: {
          livekit_url: 'http://192.168.0.111:7890',
          participant_token: 'agent-token',
          participant_identity: 'human-agent-handoff-1',
        },
      },
    });
    render(
      <WaitingPool
        handoffs={[handoff]}
        agentStatus="available"
        consoleSessionId="session-1"
        claim={claim}
        onClaimed={onClaimed}
        now={now}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /接管通话/ }));

    await waitFor(() =>
      expect(onClaimed).toHaveBeenCalledWith({
        handoff: acceptedHandoff,
        livekit_url: 'http://192.168.0.111:7890',
        participant_token: 'agent-token',
        participant_identity: 'human-agent-handoff-1',
      }),
    );
  });

  it('removes an already claimed task and shows a stable notice', async () => {
    const onRemove = jest.fn();
    const claim = jest.fn().mockRejectedValue(
      Object.assign(new Error('claim conflict'), {
        code: 'HANDOFF_ALREADY_CLAIMED',
      }),
    );
    render(
      <WaitingPool
        handoffs={[handoff]}
        agentStatus="available"
        consoleSessionId="session-1"
        claim={claim}
        onRemove={onRemove}
        now={now}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /接管通话/ }));

    expect(await screen.findByText('已被其他坐席接听')).toBeTruthy();
    expect(screen.queryByText('张** · 138****0000')).toBeNull();
    expect(onRemove).toHaveBeenCalledWith('handoff-1');
  });

  it('allows an available agent to claim only the head of the queue', () => {
    const secondHandoff: HandoffDto = {
      ...handoff,
      handoff_id: 'handoff-2',
      call_id: 'call-2',
      masked_customer_name: '李**',
      masked_contact: '139****0000',
      requested_at: '2026-07-22T10:00:10.000Z',
    };

    render(
      <WaitingPool
        handoffs={[secondHandoff, handoff]}
        agentStatus="available"
        consoleSessionId="session-1"
        now={now}
      />,
    );

    expect(
      screen.getByRole('button', { name: '接管通话 张** · 138****0000' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /接管通话/ })).toHaveLength(1);
    expect(screen.getByText('排队中')).toBeTruthy();
  });

  it('keeps the queue visible but read-only while the agent is in a call', () => {
    render(
      <WaitingPool
        handoffs={[handoff]}
        agentStatus="in_call"
        consoleSessionId="session-1"
        now={now}
      />,
    );

    expect(screen.getByText('张** · 138****0000')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /接管通话/ })).toBeNull();
    expect(screen.getByText('通话中，暂不可接管')).toBeTruthy();
  });
});

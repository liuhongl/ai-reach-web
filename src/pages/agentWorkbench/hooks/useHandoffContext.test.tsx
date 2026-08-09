import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import type {
  HandoffContextDto,
  HandoffDto,
} from '@/services/ruoyi/agent-console';
import { useHandoffContext } from './useHandoffContext';

const handoff = (handoffId: string): HandoffDto => ({
  handoff_id: handoffId,
  call_id: `call-${handoffId}`,
  scene_code: 'intro_geo',
  status: 'requested',
  requested_at: '2026-07-31T08:00:00.000Z',
});

const context = (handoffId: string): HandoffContextDto => ({
  ...handoff(handoffId),
  handoff_summary: `摘要-${handoffId}`,
  dialogue: [{ speaker_type: 'ai', text: `对话-${handoffId}` }],
});

const Harness = ({
  selected,
  service,
}: {
  selected?: HandoffDto;
  service: jest.Mock;
}) => {
  const state = useHandoffContext({
    handoff: selected,
    consoleSessionId: 'session-1',
    service,
  });
  return (
    <div>
      <span data-testid="context-id">{state.context?.handoff_id}</span>
      <span data-testid="loading">{state.loading ? 'yes' : 'no'}</span>
      <span data-testid="error">{state.errorMessage}</span>
    </div>
  );
};

describe('useHandoffContext', () => {
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('loads the full context for the selected handoff and console session', async () => {
    const service = jest.fn().mockResolvedValue({
      code: 200,
      data: context('handoff-1'),
    });
    render(<Harness selected={handoff('handoff-1')} service={service} />);

    await waitFor(() =>
      expect(screen.getByTestId('context-id').textContent).toBe('handoff-1'),
    );
    expect(service).toHaveBeenCalledWith('handoff-1', 'session-1');
  });

  it('retries a transient context read without clearing the selected request', async () => {
    jest.useFakeTimers();
    const service = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 504 } })
      .mockResolvedValue({
        code: 200,
        data: context('handoff-1'),
      });
    render(<Harness selected={handoff('handoff-1')} service={service} />);

    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toBe(
        '完整会话暂不可用，正在重新连接',
      ),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3_000);
    });

    await waitFor(() =>
      expect(screen.getByTestId('context-id').textContent).toBe('handoff-1'),
    );
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('does not let an older request replace a newly selected handoff', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const service = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        code: 200,
        data: context('handoff-2'),
      });
    const view = render(
      <Harness selected={handoff('handoff-1')} service={service} />,
    );
    view.rerender(
      <Harness selected={handoff('handoff-2')} service={service} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('context-id').textContent).toBe('handoff-2'),
    );
    act(() => {
      resolveFirst?.({ code: 200, data: context('handoff-1') });
    });
    await Promise.resolve();

    expect(screen.getByTestId('context-id').textContent).toBe('handoff-2');
  });
});

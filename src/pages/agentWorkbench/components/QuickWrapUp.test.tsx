import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as React from 'react';
import QuickWrapUp from './QuickWrapUp';

const handoff = {
  handoff_id: '9007199254740993',
  call_id: 'call-1',
  scene_code: 'intro_geo' as const,
  status: 'completed' as const,
  requested_at: '2026-07-22T08:00:00Z',
};

describe('QuickWrapUp', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('requires only disposition and follow-up choice while summary stays optional', async () => {
    const submit = jest.fn().mockResolvedValue({ code: 200 });
    render(<QuickWrapUp handoff={handoff} submit={submit} />);

    fireEvent.click(screen.getByRole('button', { name: '提交并恢复接听' }));
    expect(await screen.findByText('请选择处理结果')).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('已解决'));
    fireEvent.click(screen.getByText('无需跟进'));
    fireEvent.click(screen.getByRole('button', { name: '提交并恢复接听' }));

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        handoff.call_id,
        expect.objectContaining({
          handoffId: handoff.handoff_id,
          dispositionCode: 'resolved',
          needsFollowUp: false,
          summary: undefined,
        }),
      ),
    );
  });

  it('does not require a preset callback time when follow-up is needed', async () => {
    const submit = jest.fn().mockResolvedValue({ code: 200 });
    const onSubmitted = jest.fn();
    render(
      <QuickWrapUp
        handoff={handoff}
        aiSummaryDraft="客户希望补充材料"
        recordingStatus="processing"
        submit={submit}
        onSubmitted={onSubmitted}
      />,
    );
    fireEvent.click(screen.getAllByText('需要跟进')[1]);
    fireEvent.click(screen.getByRole('button', { name: '提交并恢复接听' }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(screen.getByText('录音处理中，不影响提交')).toBeTruthy();
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });
});

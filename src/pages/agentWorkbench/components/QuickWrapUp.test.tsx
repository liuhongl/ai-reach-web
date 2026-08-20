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
  follow_up_data_id: '100',
  follow_up_data_version: 2,
  classification: 'interested' as const,
};

describe('QuickWrapUp', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('提交客户分类、沟通结论和独立回访安排', async () => {
    const submit = jest.fn().mockResolvedValue({ code: 200 });
    render(<QuickWrapUp handoff={handoff} submit={submit} />);

    fireEvent.click(screen.getByRole('button', { name: '提交并恢复接听' }));
    expect(await screen.findByText('请填写沟通结论')).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: '沟通结论' }), {
      target: { value: '客户希望下周查看演示' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交并恢复接听' }));

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith(
        handoff.call_id,
        expect.objectContaining({
          handoffId: handoff.handoff_id,
          classification: 'interested',
          conclusion: '客户希望下周查看演示',
          scheduleFollowUp: false,
          expectedVersion: 2,
        }),
      ),
    );
  });

  it('复用 AI 摘要草稿且暂不安排时不要求计划时间', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: '提交并恢复接听' }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit).toHaveBeenCalledWith(
      handoff.call_id,
      expect.objectContaining({
        conclusion: '客户希望补充材料',
        scheduleFollowUp: false,
        nextFollowUpAt: undefined,
      }),
    );
    expect(screen.getByText('录音处理中，不影响提交')).toBeTruthy();
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });
});

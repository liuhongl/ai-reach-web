import { render } from '@testing-library/react';
import React from 'react';
import TaskConfirmation from './TaskConfirmation';

describe('TaskConfirmation', () => {
  it('marks its root so the enclosing card can expand to fit the summary', () => {
    const { container } = render(
      <TaskConfirmation
        answerMode="linphone"
        taskName="转人工测试"
        targetCount={1}
        promptName="GEO 产品介绍"
        voiceName="思怡 Chloe"
        ruleName="工作日规则"
        ruleSummary="00:00–23:55，最多重试 2 次"
        executionTime="立即执行"
        creating={false}
        onConfirm={jest.fn()}
      />,
    );

    expect(container.querySelector('.ai-call-task-confirmation')).toBeTruthy();
    expect(container.textContent).toContain('客户接听端');
    expect(container.textContent).toContain('电话（SIP 线路）');
    expect(container.textContent).toContain('GEO 产品介绍');
    expect(container.textContent).not.toContain('intro_geo');
    expect(container.textContent).not.toContain('客户名称');
    expect(container.textContent).not.toContain('Linphone');
  });
});

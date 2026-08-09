import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import ValidationResult from './ValidationResult';

jest.mock('../service', () => ({
  downloadValidationIssues: jest.fn(),
  listValidationIssues: jest.fn(),
}));

describe('batch validation system errors', () => {
  afterEach(cleanup);

  it('requires a new upload when parsing did not produce reusable rows', () => {
    const onRetry = jest.fn();

    render(
      <ValidationResult
        result={{
          validationId: 'validation-parsing-error',
          status: 'SYSTEM_ERROR',
          validTargetCount: 0,
          issueCount: 0,
          errorMessage: 'Excel 解析失败',
          retryAction: 'REUPLOAD',
        }}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('Excel 解析失败')).toBeTruthy();
    expect(screen.getByText('请重新上传完整名单')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '重新校验' })).toBeNull();
  });

  it('allows retry by validationId after parsed rows are persisted', () => {
    const onRetry = jest.fn();

    render(
      <ValidationResult
        result={{
          validationId: 'validation-system-error',
          status: 'SYSTEM_ERROR',
          validTargetCount: 18,
          issueCount: 0,
          errorMessage: '系统校验服务暂时不可用',
          retryAction: 'RETRY_VALIDATION',
        }}
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '重新校验' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables the retry action while the validation retry is pending', () => {
    render(
      <ValidationResult
        result={{
          validationId: 'validation-system-error',
          status: 'SYSTEM_ERROR',
          validTargetCount: 18,
          issueCount: 0,
          retryAction: 'RETRY_VALIDATION',
        }}
        retrying
        onRetry={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button').classList.contains('ant-btn-loading'),
    ).toBe(true);
  });
});

describe('batch validation issue list', () => {
  afterEach(cleanup);

  it('does not render a redundant query form for the issue list', () => {
    const { container } = render(
      <ValidationResult
        result={{
          validationId: 'validation-issues',
          status: 'FAILED',
          validTargetCount: 0,
          issueCount: 1,
        }}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: '重置' })).toBeNull();
    expect(screen.queryByRole('button', { name: '查询' })).toBeNull();
    expect(container.querySelector('.ant-pro-query-filter')).toBeNull();
  });
});

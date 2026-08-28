import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as React from 'react';
import { listAiCallRules } from '@/pages/aiCallRules/service';
import {
  getAiCallLabPromptProfiles,
  getAiCallLabVoiceProfiles,
} from '@/services/ruoyi/ai-call-lab';
import {
  createAiCallTask,
  createBatchValidation,
  downloadOutboundTargetTemplate,
  getValidationResult,
  retryBatchValidation,
  validateSingleTarget,
} from '../service';
import AiCallTaskCreatePage from './index';

const mockPush = jest.fn();

jest.mock('@umijs/max', () => ({
  history: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/services/ruoyi/ai-call-lab', () => ({
  getAiCallLabPromptProfiles: jest.fn(),
  getAiCallLabVoiceProfiles: jest.fn(),
}));

jest.mock('@/pages/aiCallRules/service', () => ({
  listAiCallRules: jest.fn(),
}));

jest.mock('../service', () => ({
  createAiCallTask: jest.fn(),
  createBatchValidation: jest.fn(),
  downloadOutboundTargetTemplate: jest.fn(),
  downloadValidationIssues: jest.fn(),
  getValidationResult: jest.fn(),
  listValidationIssues: jest.fn(),
  retryBatchValidation: jest.fn(),
  validateSingleTarget: jest.fn(),
}));

const mockedPromptProfiles = getAiCallLabPromptProfiles as jest.Mock;
const mockedVoiceProfiles = getAiCallLabVoiceProfiles as jest.Mock;
const mockedListRules = listAiCallRules as jest.Mock;
const mockedValidateSingle = validateSingleTarget as jest.Mock;
const mockedCreateTask = createAiCallTask as jest.Mock;
const mockedCreateBatch = createBatchValidation as jest.Mock;
const mockedDownloadTemplate = downloadOutboundTargetTemplate as jest.Mock;
const mockedGetValidation = getValidationResult as jest.Mock;
const mockedRetryBatch = retryBatchValidation as jest.Mock;

const findFileInput = async (container: HTMLElement) => {
  await waitFor(() => {
    const nextInput = container.querySelector('input[type="file"]');
    expect(nextInput).toBeInstanceOf(HTMLInputElement);
  });
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('未找到名单文件选择框');
  }
  return input;
};

describe('single target AI Call task creation', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockedPromptProfiles.mockReset();
    mockedVoiceProfiles.mockReset();
    mockedListRules.mockReset();
    mockedValidateSingle.mockReset();
    mockedCreateTask.mockReset();
    mockedCreateBatch.mockReset();
    mockedDownloadTemplate.mockReset();
    mockedGetValidation.mockReset();
    mockedRetryBatch.mockReset();
    mockedPromptProfiles.mockResolvedValue({
      rows: [
        {
          id: 'prompt-1',
          name: '客户回访',
          sceneCode: 'intro_follow_up',
        },
      ],
      total: 1,
    });
    mockedVoiceProfiles.mockResolvedValue({
      rows: [
        { voice: 'Cherry', displayName: '芊悦', status: 'ENABLED' },
        { voice: null, displayName: '创建中音色', status: 'CREATING' },
        { voice: 'Failed', displayName: '失败音色', status: 'CREATE_FAILED' },
      ],
      total: 1,
    });
    mockedListRules.mockResolvedValue({
      rows: [
        {
          ruleId: 'rule-1',
          ruleName: '工作日规则',
          enabled: true,
          callWindows: [{ startTime: '00:00', endTime: '23:59' }],
          retryCount: 1,
          retryIntervalsMinutes: [30],
          retryableResults: ['no_answer'],
          updatedAt: '2026-07-27 10:00:00',
        },
      ],
      total: 1,
    });
    mockedValidateSingle.mockResolvedValue({
      validationId: 'validation-1',
      status: 'PASSED',
      validTargetCount: 1,
      issueCount: 0,
    });
    mockedCreateTask.mockResolvedValue({
      accepted: true,
      taskId: 'task-created',
    });
    mockedCreateBatch.mockResolvedValue({
      validationId: 'validation-batch',
      status: 'PASSED',
      validTargetCount: 2,
      issueCount: 0,
    });
    mockedDownloadTemplate.mockResolvedValue(undefined);
    mockedGetValidation.mockResolvedValue({
      validationId: 'validation-pending',
      status: 'VALIDATING',
      validTargetCount: 0,
      issueCount: 0,
    });
    mockedRetryBatch.mockResolvedValue({
      validationId: 'validation-batch',
      status: 'VALIDATING',
      validTargetCount: 2,
      issueCount: 0,
    });
  });

  afterEach(cleanup);

  it('is a single page with only the approved single-target fields', async () => {
    render(<AiCallTaskCreatePage />);
    await screen.findByText('客户回访');

    expect(
      (screen.getByRole('radio', { name: '单个客户' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole('radio', {
          name: 'Web（浏览器）',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(screen.queryByText('手机号')).toBeNull();
    expect(screen.getByText('客户名称')).toBeTruthy();
    expect(screen.queryByText('公司名称')).toBeNull();
    expect(screen.queryByText('产品名称')).toBeNull();
    expect(screen.queryByText('业务参数')).toBeNull();
    expect(screen.queryByText('草稿')).toBeNull();
    expect(screen.queryByText('上一步')).toBeNull();
    expect(screen.queryByText('下一步')).toBeNull();
    expect(screen.queryByText(/版本/)).toBeNull();
    expect(screen.getByText('00:00–23:59，最多重试 1 次')).toBeTruthy();
  });

  it('loads only available voices and links to voice management', async () => {
    render(<AiCallTaskCreatePage />);
    await screen.findByText('客户回访');

    expect(mockedVoiceProfiles).toHaveBeenCalledWith({
      availableOnly: true,
      pageSize: 200,
    });
    expect(screen.getByText('芊悦')).toBeTruthy();
    expect(screen.queryByText('芊悦 / Cherry')).toBeNull();
    expect(screen.queryByText(/创建中音色/)).toBeNull();
    expect(screen.queryByText(/失败音色/)).toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: '前往音色管理',
      }),
    );
    expect(mockPush).toHaveBeenCalledWith('/ai-call/voices');
  });

  it('keeps the rule summary and primary action in normal form flow', async () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    try {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 1280,
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 720,
      });

      const { container } = render(<AiCallTaskCreatePage />);
      await screen.findByText('客户回访');
      const ruleSummary = await screen.findByText('00:00–23:59，最多重试 1 次');

      const pageStack = container.querySelector('.recov-list-stack');
      const actionButton = screen.getByRole('button', {
        name: '校验任务',
      });
      const actionArea = actionButton.parentElement;
      expect(pageStack?.classList.contains('pb-20')).toBe(false);
      expect(ruleSummary.classList.contains('mb-8')).toBe(true);
      expect(actionArea?.classList.contains('sticky')).toBe(false);
      expect(actionArea?.classList.contains('mt-2')).toBe(true);
      expect(actionButton.classList.contains('pointer-events-auto')).toBe(
        false,
      );
      expect(container.querySelector('.recov-task-create-page')).toBeTruthy();
      expect(
        container.querySelector('.recov-task-create-form-card'),
      ).toBeTruthy();
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalWidth,
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalHeight,
      });
    }
  });

  it('validates a target, shows an inline confirmation and creates once', async () => {
    render(<AiCallTaskCreatePage />);
    await screen.findByText('客户回访');

    fireEvent.click(screen.getByRole('radio', { name: '电话（SIP 线路）' }));
    await screen.findByPlaceholderText('请输入手机号');
    fireEvent.change(screen.getByPlaceholderText('请输入任务名称'), {
      target: { value: '重点客户回访' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入手机号'), {
      target: { value: '19900001001' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入客户名称（选填）'), {
      target: { value: '张先生' },
    });
    fireEvent.click(screen.getByRole('button', { name: '校验任务' }));

    await waitFor(() =>
      expect(mockedValidateSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          taskMode: 'single',
          answerMode: 'linphone',
          phoneNumber: '19900001001',
          customerName: '张先生',
          promptProfileId: 'prompt-1',
          sceneCode: 'intro_follow_up',
        }),
      ),
    );
    expect(await screen.findByText('人工确认摘要')).toBeTruthy();
    const validationCard = screen
      .getByText('校验通过')
      .closest('.ant-pro-card');
    expect(validationCard?.classList.contains('recov-toolbar-card')).toBe(true);
    expect(screen.getAllByText('客户回访').length).toBeGreaterThan(1);
    expect(screen.queryByText(/intro_follow_up/)).toBeNull();

    const confirm = screen.getByRole('button', { name: '确认启动' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(mockedCreateTask).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/ai-call/tasks/task-created'),
    );
  });

  it('defaults to Web reception and validates without a phone number', async () => {
    render(<AiCallTaskCreatePage />);
    await screen.findByText('客户回访');

    expect(
      (
        screen.getByRole('radio', {
          name: 'Web（浏览器）',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(screen.queryByPlaceholderText('请输入手机号')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('请输入任务名称'), {
      target: { value: 'Web 接听测试' },
    });
    fireEvent.click(screen.getByRole('button', { name: '校验任务' }));

    await waitFor(() => expect(mockedValidateSingle).toHaveBeenCalledTimes(1));
    const [request] = mockedValidateSingle.mock.calls[0];
    expect(request).toEqual(
      expect.objectContaining({ taskMode: 'single', answerMode: 'web' }),
    );
    expect(request).not.toHaveProperty('phoneNumber');
    expect(await screen.findAllByText('客户接听端')).toHaveLength(2);
    expect(screen.getByText('浏览器接听')).toBeTruthy();
  });

  it('downloads the template and directly uploads one xlsx list for validation', async () => {
    const { container } = render(<AiCallTaskCreatePage />);
    await screen.findByText('客户回访');

    fireEvent.click(screen.getByRole('radio', { name: '名单外呼' }));
    fireEvent.click(
      await screen.findByRole('button', { name: /下载名单模板/ }),
    );
    await waitFor(() =>
      expect(mockedDownloadTemplate).toHaveBeenCalledTimes(1),
    );

    fireEvent.change(screen.getByPlaceholderText('请输入任务名称'), {
      target: { value: '批量客户回访' },
    });
    const input = await findFileInput(container);
    expect(input.accept).toBe('.xlsx');
    const file = new File(['手机号,客户名称'], 'targets.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '校验任务' }));

    await waitFor(() =>
      expect(mockedCreateBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
          request: expect.objectContaining({
            taskMode: 'batch',
            taskName: '批量客户回访',
          }),
        }),
      ),
    );
    expect(await screen.findByText('有效外呼对象 2 个')).toBeTruthy();
    expect(screen.getByText('人工确认摘要')).toBeTruthy();
  });

  it('shows upload then validation phases around validationId acceptance', async () => {
    let resolveBatch:
      | ((value: {
          validationId: string;
          status: 'VALIDATING';
          validTargetCount: number;
          issueCount: number;
        }) => void)
      | undefined;
    mockedCreateBatch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = resolve;
      }),
    );

    const { container } = render(<AiCallTaskCreatePage />);
    await screen.findByText('客户回访');
    fireEvent.click(screen.getByRole('radio', { name: '名单外呼' }));
    fireEvent.change(screen.getByPlaceholderText('请输入任务名称'), {
      target: { value: '批量客户回访' },
    });
    const input = await findFileInput(container);
    const file = new File(['xlsx'], 'targets.xlsx');
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '校验任务' }));

    expect(await screen.findByText('正在上传名单')).toBeTruthy();
    await act(async () => {
      resolveBatch?.({
        validationId: 'validation-pending',
        status: 'VALIDATING',
        validTargetCount: 0,
        issueCount: 0,
      });
    });
    expect(await screen.findByText('名单校验中')).toBeTruthy();
  });

  it('retries persisted system validation by validationId without reuploading', async () => {
    mockedCreateBatch.mockResolvedValueOnce({
      validationId: 'validation-system-error',
      status: 'SYSTEM_ERROR',
      validTargetCount: 18,
      issueCount: 0,
      errorMessage: '系统校验服务暂时不可用',
      retryAction: 'RETRY_VALIDATION',
    });

    const { container } = render(<AiCallTaskCreatePage />);
    await screen.findByText('客户回访');
    fireEvent.click(screen.getByRole('radio', { name: '名单外呼' }));
    fireEvent.change(screen.getByPlaceholderText('请输入任务名称'), {
      target: { value: '批量客户回访' },
    });
    const input = await findFileInput(container);
    fireEvent.change(input, {
      target: { files: [new File(['xlsx'], 'targets.xlsx')] },
    });
    fireEvent.click(screen.getByRole('button', { name: '校验任务' }));

    const retryButton = await screen.findByRole('button', {
      name: '重新校验',
    });
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);
    await waitFor(() =>
      expect(mockedRetryBatch).toHaveBeenCalledWith('validation-system-error'),
    );
    expect(mockedRetryBatch).toHaveBeenCalledTimes(1);
    expect(mockedCreateBatch).toHaveBeenCalledTimes(1);
  });

  it('ignores an upload response after the selected task configuration changes', async () => {
    let resolveBatch:
      | ((value: {
          validationId: string;
          status: 'PASSED';
          validTargetCount: number;
          issueCount: number;
        }) => void)
      | undefined;
    mockedCreateBatch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBatch = resolve;
      }),
    );

    const { container } = render(<AiCallTaskCreatePage />);
    await screen.findByText('客户回访');
    fireEvent.click(screen.getByRole('radio', { name: '名单外呼' }));
    const taskNameInput = screen.getByPlaceholderText('请输入任务名称');
    fireEvent.change(taskNameInput, {
      target: { value: '旧批量任务' },
    });
    const input = await findFileInput(container);
    fireEvent.change(input, {
      target: { files: [new File(['xlsx'], 'old-targets.xlsx')] },
    });
    fireEvent.click(screen.getByRole('button', { name: '校验任务' }));
    expect(await screen.findByText('正在上传名单')).toBeTruthy();

    fireEvent.change(taskNameInput, {
      target: { value: '新批量任务' },
    });
    await act(async () => {
      resolveBatch?.({
        validationId: 'stale-upload-validation',
        status: 'PASSED',
        validTargetCount: 20,
        issueCount: 0,
      });
    });

    expect(screen.queryByText('人工确认摘要')).toBeNull();
    expect(screen.queryByText('有效外呼对象 20 个')).toBeNull();
  });

  it('ignores a polling response after the selected file changes', async () => {
    let resolvePolling:
      | ((value: {
          validationId: string;
          status: 'PASSED';
          validTargetCount: number;
          issueCount: number;
        }) => void)
      | undefined;
    mockedCreateBatch.mockResolvedValueOnce({
      validationId: 'stale-poll-validation',
      status: 'VALIDATING',
      validTargetCount: 0,
      issueCount: 0,
    });
    mockedGetValidation.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePolling = resolve;
      }),
    );

    const { container } = render(<AiCallTaskCreatePage />);
    await screen.findByText('客户回访');
    fireEvent.click(screen.getByRole('radio', { name: '名单外呼' }));
    fireEvent.change(screen.getByPlaceholderText('请输入任务名称'), {
      target: { value: '批量任务' },
    });
    const input = await findFileInput(container);
    fireEvent.change(input, {
      target: { files: [new File(['xlsx'], 'old-targets.xlsx')] },
    });
    fireEvent.click(screen.getByRole('button', { name: '校验任务' }));
    await waitFor(() =>
      expect(mockedGetValidation).toHaveBeenCalledWith('stale-poll-validation'),
    );

    const replacementInput = await findFileInput(container);
    fireEvent.change(replacementInput, {
      target: { files: [new File(['xlsx'], 'new-targets.xlsx')] },
    });
    expect(
      await screen.findByRole('button', {
        name: '完整文件名：new-targets.xlsx',
      }),
    ).toBeTruthy();
    await act(async () => {
      resolvePolling?.({
        validationId: 'stale-poll-validation',
        status: 'PASSED',
        validTargetCount: 30,
        issueCount: 0,
      });
    });

    expect(screen.queryByText('人工确认摘要')).toBeNull();
    expect(screen.queryByText('有效外呼对象 30 个')).toBeNull();
  });

  it('keeps validation polling single-flight when a response exceeds the interval', async () => {
    let resolvePolling:
      | ((value: {
          validationId: string;
          status: 'VALIDATING';
          validTargetCount: number;
          issueCount: number;
        }) => void)
      | undefined;
    mockedCreateBatch.mockResolvedValueOnce({
      validationId: 'slow-poll-validation',
      status: 'VALIDATING',
      validTargetCount: 0,
      issueCount: 0,
    });
    mockedGetValidation.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePolling = resolve;
      }),
    );

    const { container } = render(<AiCallTaskCreatePage />);
    await screen.findByText('客户回访');
    fireEvent.click(screen.getByRole('radio', { name: '名单外呼' }));
    fireEvent.change(screen.getByPlaceholderText('请输入任务名称'), {
      target: { value: '慢校验任务' },
    });
    const input = await findFileInput(container);
    fireEvent.change(input, {
      target: { files: [new File(['xlsx'], 'slow-targets.xlsx')] },
    });
    fireEvent.click(screen.getByRole('button', { name: '校验任务' }));
    await waitFor(() =>
      expect(mockedGetValidation).toHaveBeenCalledWith('slow-poll-validation'),
    );

    await act(() => new Promise((resolve) => setTimeout(resolve, 2_100)));
    expect(mockedGetValidation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePolling?.({
        validationId: 'slow-poll-validation',
        status: 'VALIDATING',
        validTargetCount: 0,
        issueCount: 0,
      });
    });
    await waitFor(() => expect(mockedGetValidation).toHaveBeenCalledTimes(2), {
      timeout: 2_500,
    });
  });
});

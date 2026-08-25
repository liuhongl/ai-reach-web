import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import * as React from 'react';
import AiCallRulesPage from './index';
import {
  createAiCallRule,
  deleteAiCallRule,
  getAiCallRuleMetadata,
  listAiCallRules,
  updateAiCallRule,
} from './service';

jest.mock('./service', () => ({
  createAiCallRule: jest.fn(),
  deleteAiCallRule: jest.fn(),
  getAiCallRuleMetadata: jest.fn(),
  listAiCallRules: jest.fn(),
  updateAiCallRule: jest.fn(),
}));

jest.mock('@/components/TableActions', () => ({
  __esModule: true,
  default: ({
    actions,
  }: {
    actions: Array<{
      key: string;
      label: string;
      onClick: () => void;
    }>;
  }) => (
    <div>
      {actions.map((action) => (
        <button key={action.key} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

const mockedGetMetadata = getAiCallRuleMetadata as jest.Mock;
const mockedListRules = listAiCallRules as jest.Mock;
const mockedCreateRule = createAiCallRule as jest.Mock;
const mockedUpdateRule = updateAiCallRule as jest.Mock;
const mockedDeleteRule = deleteAiCallRule as jest.Mock;

const metadata = {
  maxRetryCount: 5,
  retryableResults: [
    { value: 'no_answer', label: '无人接听' },
    { value: 'busy', label: '忙线' },
    { value: 'rejected', label: '拒接' },
  ],
};

const rule = {
  ruleId: 'rule-1',
  ruleName: '工作日规则',
  enabled: true,
  callWindows: [{ startTime: '09:00', endTime: '18:00' }],
  retryCount: 1,
  retryIntervalsMinutes: [30],
  retryableResults: ['no_answer'],
  updatedAt: '2026-07-27 10:00:00',
};

const findEditor = async () => {
  await screen.findByText('最大重试次数：5 次');
  const editor = document.querySelector('.ant-modal');
  if (!(editor instanceof HTMLElement)) {
    throw new Error('未找到呼叫规则编辑弹窗');
  }
  return editor;
};

describe('AI Call rules page', () => {
  beforeEach(() => {
    mockedGetMetadata.mockReset();
    mockedListRules.mockReset();
    mockedCreateRule.mockReset();
    mockedUpdateRule.mockReset();
    mockedDeleteRule.mockReset();
    mockedGetMetadata.mockResolvedValue(metadata);
    mockedListRules.mockResolvedValue({ rows: [rule], total: 1 });
    mockedCreateRule.mockResolvedValue(rule);
    mockedUpdateRule.mockResolvedValue(rule);
    mockedDeleteRule.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('loads metadata and displays rule summaries', async () => {
    render(<AiCallRulesPage />);

    expect(await screen.findByText('工作日规则')).toBeTruthy();
    expect(document.querySelector('.recov-list-stack > h2')).toBeNull();
    expect(screen.getByText('09:00–18:00')).toBeTruthy();
    expect(screen.getByText('最多重试 1 次')).toBeTruthy();
    expect(screen.getByText('启用')).toBeTruthy();
    expect(mockedGetMetadata).toHaveBeenCalledTimes(1);
    expect(mockedListRules).toHaveBeenCalledWith(
      expect.objectContaining({ pageNum: 1, pageSize: 20 }),
    );
  });

  it('opens the rule editor from the new rule action', async () => {
    render(<AiCallRulesPage />);

    await screen.findByText('工作日规则');
    fireEvent.click(screen.getByRole('button', { name: /新建规则/ }));

    const editor = await findEditor();
    expect(within(editor).getByText('新建规则')).toBeTruthy();
    expect(within(editor).getByPlaceholderText('请输入规则名称')).toBeTruthy();
  });

  it('edits an existing rule through the update service', async () => {
    render(<AiCallRulesPage />);

    await screen.findByText('工作日规则');
    fireEvent.click(screen.getByRole('button', { name: '编辑' }));
    const editor = await findEditor();
    expect(within(editor).getByText('编辑规则')).toBeTruthy();
    const input = within(editor).getByPlaceholderText('请输入规则名称');
    fireEvent.change(input, { target: { value: '调整后的工作日规则' } });
    fireEvent.click(within(editor).getByRole('button', { name: /保\s*存/ }));

    await waitFor(() =>
      expect(mockedUpdateRule).toHaveBeenCalledWith(
        'rule-1',
        expect.objectContaining({
          ruleName: '调整后的工作日规则',
        }),
      ),
    );
  });

  it('creates a rule from a valid default form', async () => {
    render(<AiCallRulesPage />);

    await screen.findByText('工作日规则');
    fireEvent.click(screen.getByRole('button', { name: /新建规则/ }));
    const editor = await findEditor();
    fireEvent.change(within(editor).getByPlaceholderText('请输入规则名称'), {
      target: { value: '午间通知规则' },
    });
    fireEvent.click(within(editor).getByRole('button', { name: /保\s*存/ }));

    await waitFor(() =>
      expect(mockedCreateRule).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleName: '午间通知规则',
          callWindows: [{ startTime: '09:00', endTime: '18:00' }],
          retryCount: 1,
          retryIntervalsMinutes: [30],
        }),
      ),
    );
  });

  it('shows an explicit delete confirmation and refreshes after deletion', async () => {
    render(<AiCallRulesPage />);

    await screen.findByText('工作日规则');
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    expect(
      await screen.findByText(
        '确认删除呼叫规则“工作日规则”吗？删除后不能用于新任务，已创建任务仍按原规则执行。此操作不可恢复。',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() =>
      expect(mockedDeleteRule).toHaveBeenCalledWith('rule-1'),
    );
    await waitFor(() => expect(mockedListRules).toHaveBeenCalledTimes(2));
  });
});

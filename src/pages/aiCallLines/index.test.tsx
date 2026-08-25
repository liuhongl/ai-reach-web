import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { message } from 'antd';
import * as React from 'react';
import AiCallLinesPage, {
  createLineCode,
  toCopyInitialValues,
  toLinePayload,
} from '.';
import {
  disableAiCallLine,
  listAiCallLines,
  preflightAiCallLine,
} from './service';

jest.mock('./service', () => ({
  createAiCallLine: jest.fn(),
  deleteAiCallLine: jest.fn(),
  disableAiCallLine: jest.fn(),
  enableAiCallLine: jest.fn(),
  listAiCallLines: jest.fn(),
  preflightAiCallLine: jest.fn(),
  setDefaultAiCallLine: jest.fn(),
  updateAiCallLine: jest.fn(),
}));

jest.mock('@/components/TableActions', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ actions }: { actions: Array<Record<string, unknown>> }) =>
      React.createElement(
        React.Fragment,
        null,
        ...actions.map((action) =>
          React.createElement(
            'button',
            {
              disabled: Boolean(action.disabled),
              key: String(action.key),
              onClick: action.onClick,
              type: 'button',
            },
            String(action.label),
          ),
        ),
      ),
  };
});

jest.mock('@ant-design/pro-components', () => {
  const React = require('react');
  const Field = ({
    label,
    name,
    width,
  }: {
    label: string;
    name?: string;
    width?: string;
  }) =>
    React.createElement(
      'label',
      { 'data-field-name': name, 'data-field-width': width },
      label,
    );
  const ProForm = {
    Group: ({ children, title }: { children: unknown; title: string }) =>
      React.createElement(
        'section',
        null,
        React.createElement('h3', null, title),
        children,
      ),
  };
  return {
    DrawerForm: (props: Record<string, unknown>) =>
      props.open
        ? React.createElement(
            'aside',
            { 'data-drawer-width': props.width },
            React.createElement('h2', null, props.title),
            props.children,
          )
        : null,
    PageContainer: ({
      children,
      className,
      title,
    }: {
      children: unknown;
      className?: string;
      title: string;
    }) =>
      React.createElement(
        'main',
        { className },
        React.createElement('h1', null, title),
        children,
      ),
    ProForm,
    ProFormDependency: ({
      children,
    }: {
      children: (values: { routeMode: string }) => unknown;
    }) => children({ routeMode: 'managed_trunk_id' }),
    ProFormDigit: Field,
    ProFormDatePicker: Field,
    ProFormSelect: Field,
    ProFormSwitch: Field,
    ProFormText: Field,
    ProFormTextArea: ({
      label,
      name,
      width,
    }: {
      label: string;
      name?: string;
      width?: string;
    }) =>
      React.createElement(
        'label',
        {
          'data-field-kind': 'textarea',
          'data-field-name': name,
          'data-field-width': width,
        },
        label,
      ),
    ProTable: (props: Record<string, unknown>) => {
      const columns = props.columns as Array<{
        dataIndex?: string;
        title?: unknown;
        valueType?: string;
        render?: (value: unknown, row: unknown) => unknown;
      }>;
      const request = props.request as CallableFunction;
      const toolBarRender = props.toolBarRender as (() => unknown) | undefined;
      React.useEffect(() => {
        void request({ current: 1, pageSize: 10 });
      }, [request]);
      const optionColumn = columns.find(
        (column) => column.valueType === 'option',
      );
      const lineNameColumn = columns.find(
        (column) => column.dataIndex === 'lineName',
      );
      const mockRow = {
        lineId: '340700000000000001',
        lineCode: 'primary-line',
        lineName: '正式外呼线路',
        description: '用于正式营销外呼',
        unitPrice: '0.1250',
        purpose: '新客户邀约',
        expiresAt: '2027-12-31',
        enabled: true,
        adapterType: 'livekit_sip',
        routeMode: 'managed_trunk_id',
        trunkId: 'ST_primary',
        proxyHost: null,
        proxyPort: null,
        authMode: 'managed_trunk',
        callerNumber: '01088886666',
        destinationCountry: 'CN',
        maxConcurrency: 10,
        originateTimeoutSeconds: 45,
        isDefault: false,
        healthStatus: 'UNKNOWN',
        healthMessage: null,
        lastCheckedAt: null,
        createdAt: '2026-07-29T10:00:00',
        updatedAt: '2026-07-29T10:00:00',
      };
      return React.createElement(
        'section',
        {
          'data-testid': 'line-table',
          'data-column-order': columns
            .map((column) => String(column.title || ''))
            .join('|'),
          'data-line-name-custom-render': String(
            Boolean(lineNameColumn?.render),
          ),
        },
        toolBarRender?.(),
        ...columns.map((column, index) =>
          React.createElement('span', { key: `column-${index}` }, column.title),
        ),
        React.createElement(
          'div',
          { key: 'line-name' },
          lineNameColumn?.render?.(undefined, mockRow) ?? mockRow.lineName,
        ),
        React.createElement(
          'div',
          { key: 'row-actions' },
          optionColumn?.render?.(undefined, mockRow),
        ),
      );
    },
  };
});

jest.mock('antd', () => {
  const React = require('react');
  const messageApi = {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  };
  const modalApi = {
    confirm: jest.fn((options: { onOk?: () => unknown }) => options.onOk?.()),
  };
  return {
    Button: ({
      children,
      onClick,
    }: {
      children: unknown;
      onClick: () => void;
    }) => React.createElement('button', { onClick, type: 'button' }, children),
    Flex: ({ children }: { children: unknown }) =>
      React.createElement('div', null, children),
    message: {
      useMessage: () => [messageApi, null],
    },
    Modal: {
      useModal: () => [modalApi, null],
    },
    Space: ({ children }: { children: unknown }) =>
      React.createElement('div', null, children),
    Tag: ({ children }: { children: unknown }) =>
      React.createElement('span', null, children),
    Tooltip: ({ children }: { children: unknown }) => children,
    Typography: {
      Text: ({ children }: { children: unknown }) =>
        React.createElement('span', null, children),
    },
  };
});

const line = {
  lineId: '340700000000000001',
  lineCode: 'primary-line',
  lineName: '正式外呼线路',
  description: '用于正式营销外呼',
  unitPrice: '0.1250',
  purpose: '新客户邀约',
  expiresAt: '2027-12-31',
  enabled: true,
  adapterType: 'livekit_sip' as const,
  routeMode: 'managed_trunk_id' as const,
  trunkId: 'ST_primary',
  proxyHost: null,
  proxyPort: null,
  authMode: 'managed_trunk' as const,
  callerNumber: '01088886666',
  destinationCountry: 'CN',
  maxConcurrency: 10,
  originateTimeoutSeconds: 45,
  isDefault: false,
  healthStatus: 'UNKNOWN' as const,
  healthMessage: null,
  lastCheckedAt: null,
  createdAt: '2026-07-29T10:00:00',
  updatedAt: '2026-07-29T10:00:00',
};

describe('AI Call 线路配置页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listAiCallLines as jest.Mock).mockResolvedValue({
      rows: [line],
      total: 1,
    });
    (preflightAiCallLine as jest.Mock).mockResolvedValue({
      lineId: line.lineId,
      healthStatus: 'AVAILABLE',
      healthMessage:
        '基础配置有效，LiveKit API 可连接；未验证运营商 SIP trunk、号码路由、振铃、媒体或真实通话',
      lastCheckedAt: '2026-07-29T10:01:00',
    });
    (disableAiCallLine as jest.Mock).mockResolvedValue({
      ...line,
      enabled: false,
    });
  });

  it('展示线路业务字段、完整操作且没有真实拨打入口', async () => {
    const { container } = render(<AiCallLinesPage />);

    expect(container.querySelector('.recov-list-page')).toBeTruthy();

    for (const text of [
      '线路配置',
      '新增线路',
      '线路名称',
      '描述',
      '单价',
      '用途',
      '到期时间',
      '接入方式',
      'SIP 接入地址',
      '报备主叫号码',
      '最大并发',
      '健康状态',
      '启用状态',
      '默认线路',
      '更新时间',
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }

    for (const action of [
      '编辑线路',
      '配置检查',
      '复制配置',
      '设为默认',
      '停用线路',
      '删除线路',
    ]) {
      expect(await screen.findByRole('button', { name: action })).toBeTruthy();
    }
    expect(screen.queryByText('测试拨打')).toBeNull();
    expect(screen.queryByText('外呼测试')).toBeNull();
    expect(screen.queryByText('primary-line')).toBeNull();
    expect(
      screen.getByTestId('line-table').getAttribute('data-column-order'),
    ).toBe(
      '线路名称|默认线路|描述|接入方式|SIP 接入地址|报备主叫号码|最大并发|单价|用途|健康状态|启用状态|到期时间|更新时间|操作',
    );
    expect(
      screen
        .getByTestId('line-table')
        .getAttribute('data-line-name-custom-render'),
    ).toBe('false');
  });

  it('新增线路只展示当前厂商需要的业务字段', () => {
    render(<AiCallLinesPage />);

    fireEvent.click(screen.getByRole('button', { name: '新增线路' }));

    const drawer = screen.getByRole('complementary');
    expect(drawer.getAttribute('data-drawer-width')).toBe('760');
    expect(
      within(drawer).getByRole('heading', { name: '新增线路配置' }),
    ).toBeTruthy();
    expect(
      Array.from(drawer.querySelectorAll('h3'), (heading) =>
        heading.textContent?.trim(),
      ),
    ).toEqual(['基本信息', 'SIP 接入', '容量设置', '业务信息']);
    const businessSection = within(drawer)
      .getByRole('heading', { name: '业务信息' })
      .closest('section');
    expect(
      Array.from(businessSection?.querySelectorAll('label') || [], (label) =>
        label.textContent?.trim(),
      ),
    ).toEqual(['单价', '到期时间', '描述', '用途']);
    expect(
      within(drawer).getByText('线路名称').getAttribute('data-field-width'),
    ).toBe('xl');
    expect(
      within(drawer).getByText('用途').getAttribute('data-field-kind'),
    ).toBe('textarea');
    for (const label of [
      'SIP 地址',
      'SIP 端口',
      '最大并发',
      '呼叫超时',
      '单价',
      '到期时间',
    ]) {
      expect(
        within(drawer).getByText(label).getAttribute('data-field-width'),
      ).toBe('md');
    }
    for (const text of [
      '基本信息',
      '业务信息',
      'SIP 接入',
      '容量设置',
      '线路名称',
      '描述',
      '单价',
      '用途',
      '到期时间',
      'SIP 地址',
      'SIP 端口',
      '报备主叫号码',
      '最大并发',
      '呼叫超时',
    ]) {
      expect(within(drawer).getAllByText(text).length).toBeGreaterThan(0);
    }
    for (const text of [
      '线路编码',
      '接入方式',
      'Trunk ID',
      '目标国家',
      '高级设置',
    ]) {
      expect(within(drawer).queryByText(text)).toBeNull();
    }
  });

  it('配置检查调用非拨号预检接口', async () => {
    render(<AiCallLinesPage />);

    fireEvent.click(await screen.findByRole('button', { name: '配置检查' }));

    await waitFor(() =>
      expect(preflightAiCallLine).toHaveBeenCalledWith(line.lineId),
    );
    expect(message.useMessage()[0].success).toHaveBeenCalledWith(
      '配置通过：基础配置有效，LiveKit API 可连接；未验证运营商 SIP trunk、号码路由、振铃、媒体或真实通话',
    );
  });

  it('为当前厂商固定 IP 白名单线路参数', () => {
    expect(
      toLinePayload({
        ...line,
        enabled: undefined,
        routeMode: 'managed_trunk_id',
        trunkId: 'stale-trunk',
        proxyHost: 'sip.example.com',
        proxyPort: 5089,
        destinationCountry: 'US',
      }),
    ).toMatchObject({
      routeMode: 'inline_hostname',
      trunkId: null,
      proxyHost: 'sip.example.com',
      proxyPort: 5089,
      authMode: 'ip_allowlist',
      destinationCountry: 'CN',
      enabled: false,
      description: '用于正式营销外呼',
      unitPrice: '0.1250',
      purpose: '新客户邀约',
      expiresAt: '2027-12-31',
    });
  });

  it('复制配置生成新名称和编码并默认停用', () => {
    expect(toCopyInitialValues(line, 1_722_225_600_000)).toMatchObject({
      lineCode: 'sip-line-lz6gnls0',
      lineName: '正式外呼线路（副本）',
      enabled: false,
      description: '用于正式营销外呼',
      unitPrice: '0.1250',
      purpose: '新客户邀约',
      expiresAt: '2027-12-31',
    });
  });

  it('自动生成稳定格式的线路编码', () => {
    expect(createLineCode(1_722_225_600_000)).toBe('sip-line-lz6gnls0');
  });
});

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { message } from 'antd';
import * as React from 'react';
import AiCallLinesPage, { createLineCode, toLinePayload } from '.';
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
  const Field = ({ label }: { label: string }) =>
    React.createElement('label', null, label);
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
            null,
            React.createElement('h2', null, props.title),
            props.children,
          )
        : null,
    PageContainer: ({
      children,
      title,
    }: {
      children: unknown;
      title: string;
    }) =>
      React.createElement(
        'main',
        null,
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
    ProFormSelect: Field,
    ProFormSwitch: Field,
    ProFormText: Field,
    ProTable: (props: Record<string, unknown>) => {
      const columns = props.columns as Array<{
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
      const mockRow = {
        lineId: '340700000000000001',
        lineCode: 'primary-line',
        lineName: '正式外呼线路',
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
        null,
        toolBarRender?.(),
        ...columns.map((column, index) =>
          React.createElement('span', { key: `column-${index}` }, column.title),
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
    render(<AiCallLinesPage />);

    for (const text of [
      '线路配置',
      '新增线路',
      '线路名称',
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
      '设为默认',
      '停用线路',
      '删除线路',
    ]) {
      expect(await screen.findByRole('button', { name: action })).toBeTruthy();
    }
    expect(screen.queryByText('测试拨打')).toBeNull();
    expect(screen.queryByText('外呼测试')).toBeNull();
  });

  it('新增线路只展示当前厂商需要的业务字段', () => {
    render(<AiCallLinesPage />);

    fireEvent.click(screen.getByRole('button', { name: '新增线路' }));

    const drawer = screen.getByRole('complementary');
    expect(
      within(drawer).getByRole('heading', { name: '新增线路配置' }),
    ).toBeTruthy();
    for (const text of [
      '基本信息',
      'SIP 接入',
      '容量设置',
      '线路名称',
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
    });
  });

  it('自动生成稳定格式的线路编码', () => {
    expect(createLineCode(1_722_225_600_000)).toBe('sip-line-lz6gnls0');
  });
});

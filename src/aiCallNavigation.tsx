import type { MenuDataItem } from '@ant-design/pro-components';
import { hasPermission } from '@/utils/permission';

export type AiCallMenuItem = MenuDataItem & {
  name: string;
  children?: AiCallMenuItem[];
};

export type AiCallNavItem = AiCallMenuItem & {
  name: string;
  path: string;
  permission: string;
};

export const AI_CALL_NAV_ITEMS: AiCallNavItem[] = [
  {
    name: '数据看板',
    path: '/ai-call/statistics',
    permission: 'ai_call:agent:manage',
  },
  {
    name: '知识资产',
    path: '/ai-call/knowledge',
    permission: 'ai_call:knowledge:view',
  },
  {
    name: '提示词',
    path: '/ai-call-lab/prompt-config',
    permission: 'ai_call:prompt:manage',
  },
  {
    name: '外呼任务',
    path: '/ai-call/tasks',
    permission: 'ai_call:agent:manage',
  },
  {
    name: '通话记录',
    path: '/ai-call/records',
    permission: 'ai_call:agent:manage',
  },
  {
    name: '坐席工作台',
    path: '/ai-call/agent-workbench',
    permission: 'ai_call:agent:console',
  },
  {
    name: '坐席管理',
    path: '/ai-call/agents',
    permission: 'ai_call:agent:manage',
  },
  {
    name: '转人工记录',
    path: '/ai-call/handoffs',
    permission: 'ai_call:agent:manage',
  },
  {
    name: '跟进总览',
    path: '/ai-call/follow-up-overview',
    permission: 'ai_call:agent:manage',
  },
  {
    name: '跟进数据',
    path: '/ai-call/follow-up-data',
    permission: 'ai_call:agent:manage',
  },
  {
    name: '回访任务',
    path: '/ai-call/follow-ups',
    permission: 'ai_call:agent:console',
  },
  {
    name: '呼叫规则',
    path: '/ai-call/rules',
    permission: 'ai_call:agent:manage',
  },
  {
    name: '音色管理',
    path: '/ai-call/voices',
    permission: 'ai_call:voice:manage',
  },
  { name: '线路', path: '/ai-call/lines', permission: 'ai_call:agent:manage' },
  {
    name: '通话测试台',
    path: '/ai-call-lab/customer',
    permission: 'ai_call:lab:use',
    hideInMenu: true,
  },
];

const findNavItem = (name: string) =>
  AI_CALL_NAV_ITEMS.find((item) => item.name === name) as AiCallNavItem;

const AI_CALL_MENU: AiCallMenuItem[] = [
  findNavItem('数据看板'),
  {
    name: '知识库',
    children: [findNavItem('知识资产'), findNavItem('提示词')],
  },
  {
    name: '外呼',
    children: [findNavItem('外呼任务'), findNavItem('通话记录')],
  },
  {
    name: '坐席',
    children: [
      findNavItem('坐席工作台'),
      findNavItem('回访任务'),
      findNavItem('坐席管理'),
      findNavItem('转人工记录'),
    ],
  },
  {
    name: '跟进',
    children: [findNavItem('跟进总览'), findNavItem('跟进数据')],
  },
  {
    name: '规则配置',
    children: [findNavItem('呼叫规则'), findNavItem('音色管理')],
  },
  findNavItem('线路'),
];

const permissionSubject = (permissions: string[]) => ({ permissions });

const AI_CALL_SYSTEM_NAV_ITEMS = [
  '知识资产',
  '提示词',
  '线路',
  '呼叫规则',
  '音色管理',
].map(findNavItem);

export const buildAiCallMenu = (permissions: string[]): AiCallMenuItem[] =>
  AI_CALL_MENU.reduce<AiCallMenuItem[]>((menu, item) => {
    if (!item.children) {
      const navItem = item as AiCallNavItem;
      if (hasPermission(permissionSubject(permissions), navItem.permission))
        menu.push(navItem);
      return menu;
    }

    const children = (item.children as AiCallNavItem[]).filter((child) =>
      hasPermission(permissionSubject(permissions), child.permission),
    );
    if (children.length) menu.push({ ...item, children });
    return menu;
  }, []);

export const getFirstAiCallPath = (permissions: string[]) =>
  AI_CALL_NAV_ITEMS.find((item) =>
    hasPermission(permissionSubject(permissions), item.permission),
  )?.path;

export const getFirstAiCallSystemPath = (permissions: string[]) =>
  AI_CALL_SYSTEM_NAV_ITEMS.find((item) =>
    hasPermission(permissionSubject(permissions), item.permission),
  )?.path;

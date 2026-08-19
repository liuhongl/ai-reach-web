import type { MenuDataItem } from '@ant-design/pro-components';
import { hasPermission } from '@/utils/permission';

export type AiCallNavItem = MenuDataItem & {
  name: string;
  path: string;
  permission: string;
};

export const AI_CALL_NAV_ITEMS: AiCallNavItem[] = [
  { name: '外呼任务', path: '/ai-call/tasks', permission: 'ai_call:agent:manage' },
  { name: '通话记录', path: '/ai-call/records', permission: 'ai_call:agent:manage' },
  { name: '音色管理', path: '/ai-call/voices', permission: 'ai_call:voice:manage' },
  { name: '线路配置', path: '/ai-call/lines', permission: 'ai_call:agent:manage' },
  { name: '呼叫规则', path: '/ai-call/rules', permission: 'ai_call:agent:manage' },
  { name: '跟进处理', path: '/ai-call/follow-ups', permission: 'ai_call:agent:console' },
  { name: '跟进总览', path: '/ai-call/follow-up-overview', permission: 'ai_call:agent:manage' },
  { name: '外呼统计', path: '/ai-call/statistics', permission: 'ai_call:agent:manage' },
  {
    name: '知识资产',
    path: '/ai-call/knowledge',
    permission: 'ai_call:knowledge:view',
  },
  { name: '坐席工作台', path: '/ai-call/agent-workbench', permission: 'ai_call:agent:console' },
  { name: '坐席管理', path: '/ai-call/agents', permission: 'ai_call:agent:manage' },
  { name: '转人工记录', path: '/ai-call/handoffs', permission: 'ai_call:agent:manage' },
  { name: '通话测试台', path: '/ai-call-lab/customer', permission: 'ai_call:lab:use' },
  { name: '提示词配置', path: '/ai-call-lab/prompt-config', permission: 'ai_call:prompt:manage' },
];

const permissionSubject = (permissions: string[]) => ({ permissions });

export const buildAiCallMenu = (permissions: string[]) =>
  AI_CALL_NAV_ITEMS.filter((item) =>
    hasPermission(permissionSubject(permissions), item.permission),
  );

export const getFirstAiCallPath = (permissions: string[]) =>
  buildAiCallMenu(permissions)[0]?.path;

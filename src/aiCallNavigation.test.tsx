import {
  AI_CALL_NAV_ITEMS,
  buildAiCallMenu,
  getFirstAiCallPath,
} from './aiCallNavigation';

const expected = [
  ['外呼任务', '/ai-call/tasks', 'ai_call:agent:manage'],
  ['通话记录', '/ai-call/records', 'ai_call:agent:manage'],
  ['音色管理', '/ai-call/voices', 'ai_call:voice:manage'],
  ['线路配置', '/ai-call/lines', 'ai_call:agent:manage'],
  ['呼叫规则', '/ai-call/rules', 'ai_call:agent:manage'],
  ['跟进处理', '/ai-call/follow-ups', 'ai_call:agent:console'],
  ['跟进总览', '/ai-call/follow-up-overview', 'ai_call:agent:manage'],
  ['外呼统计', '/ai-call/statistics', 'ai_call:agent:manage'],
  ['知识资产', '/ai-call/knowledge', 'ai_call:knowledge:view'],
  ['坐席工作台', '/ai-call/agent-workbench', 'ai_call:agent:console'],
  ['坐席管理', '/ai-call/agents', 'ai_call:agent:manage'],
  ['转人工记录', '/ai-call/handoffs', 'ai_call:agent:manage'],
  ['通话测试台', '/ai-call-lab/customer', 'ai_call:lab:use'],
  ['提示词配置', '/ai-call-lab/prompt-config', 'ai_call:prompt:manage'],
] as const;

describe('AI Call navigation', () => {
  it('固定维护 14 个入口及权限', () => {
    expect(
      AI_CALL_NAV_ITEMS.map(({ name, path, permission }) => [
        name,
        path,
        permission,
      ]),
    ).toEqual(expected);
  });

  it('只返回当前用户有权访问的入口', () => {
    expect(buildAiCallMenu(['ai_call:voice:manage']).map((item) => item.name)).toEqual([
      '音色管理',
    ]);
    expect(buildAiCallMenu(['*:*:*'])).toHaveLength(14);
    expect(buildAiCallMenu([])).toEqual([]);
  });

  it('返回第一个有权访问的入口', () => {
    expect(getFirstAiCallPath(['ai_call:lab:use'])).toBe(
      '/ai-call-lab/customer',
    );
    expect(getFirstAiCallPath(['*:*:*'])).toBe('/ai-call/tasks');
    expect(getFirstAiCallPath([])).toBeUndefined();
  });
});

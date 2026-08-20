import {
  AI_CALL_NAV_ITEMS,
  buildAiCallMenu,
  getFirstAiCallPath,
  getFirstAiCallSystemPath,
} from './aiCallNavigation';

describe('AI Call navigation', () => {
  it('按原型分组已有业务入口', () => {
    const menu = buildAiCallMenu(['*:*:*']);

    expect(menu.map((item) => item.name)).toEqual([
      '数据看板',
      '知识库',
      '外呼',
      '坐席',
      '跟进',
      '规则配置',
      '线路',
    ]);
    expect(
      menu
        .find((item) => item.name === '知识库')
        ?.children?.map((item) => item.name),
    ).toEqual(['知识资产', '提示词']);
    expect(
      menu
        .find((item) => item.name === '外呼')
        ?.children?.map((item) => item.name),
    ).toEqual(['外呼任务', '通话记录']);
    expect(
      menu
        .find((item) => item.name === '坐席')
        ?.children?.map((item) => item.name),
    ).toEqual(['坐席工作台', '回访任务', '坐席管理', '转人工记录']);
    expect(
      menu
        .find((item) => item.name === '跟进')
        ?.children?.map((item) => item.name),
    ).toEqual(['跟进总览', '跟进数据']);
    expect(
      menu
        .find((item) => item.name === '规则配置')
        ?.children?.map((item) => item.name),
    ).toEqual(['呼叫规则', '音色管理']);
    expect(JSON.stringify(menu)).not.toMatch(/呼入管理|邮件管理|短信管理/);
  });

  it('按权限过滤菜单和空分组', () => {
    expect(buildAiCallMenu(['ai_call:knowledge:view'])).toEqual([
      {
        name: '知识库',
        children: [
          expect.objectContaining({
            name: '知识资产',
            path: '/ai-call/knowledge',
          }),
        ],
      },
    ]);
    expect(buildAiCallMenu(['ai_call:voice:manage'])).toEqual([
      {
        name: '规则配置',
        children: [
          expect.objectContaining({
            name: '音色管理',
            path: '/ai-call/voices',
          }),
        ],
      },
    ]);
    expect(buildAiCallMenu([])).toEqual([]);
  });

  it('保留隐藏测试台并返回首个可访问入口', () => {
    expect(
      AI_CALL_NAV_ITEMS.find((item) => item.name === '通话测试台'),
    ).toMatchObject({
      hideInMenu: true,
      path: '/ai-call-lab/customer',
    });
    expect(getFirstAiCallPath(['ai_call:lab:use'])).toBe(
      '/ai-call-lab/customer',
    );
    expect(getFirstAiCallPath(['ai_call:voice:manage'])).toBe(
      '/ai-call/voices',
    );
    expect(getFirstAiCallPath(['*:*:*'])).toBe('/ai-call/statistics');
    expect(getFirstAiCallPath([])).toBeUndefined();
    expect(getFirstAiCallSystemPath(['ai_call:knowledge:view'])).toBe(
      '/ai-call/knowledge',
    );
  });
});

import routes from './routes';

describe('routes', () => {
  it('包含登录、15 个入口、任务深链和异常页', () => {
    const paths = routes.map((route) => route.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/user/login',
        '/',
        '/ai-call/tasks',
        '/ai-call/records',
        '/ai-call/voices',
        '/ai-call/lines',
        '/ai-call/rules',
        '/ai-call/follow-ups',
        '/ai-call/follow-up-overview',
        '/ai-call/follow-up-data',
        '/ai-call/statistics',
        '/ai-call/knowledge',
        '/ai-call/agent-workbench',
        '/ai-call/agents',
        '/ai-call/handoffs',
        '/ai-call-lab/customer',
        '/ai-call-lab/prompt-config',
        '/ai-call/tasks/create',
        '/ai-call/tasks/:taskId',
        '/403',
        '/*',
      ]),
    );
    expect(paths).not.toContain('/agent-workbench');
  });

  it('受保护路由统一使用服务端权限标识', () => {
    const protectedRoutes = routes.filter((route) => route.requiredPermission);

    expect(protectedRoutes).toHaveLength(17);
    expect(protectedRoutes.every((route) => route.access === 'hasRoutePermission')).toBe(
      true,
    );
    expect(
      protectedRoutes.find((route) => route.path === '/ai-call/knowledge'),
    ).toMatchObject({ requiredPermission: 'ai_call:knowledge:view' });
  });
});

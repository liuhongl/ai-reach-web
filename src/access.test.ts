import access from './access';

describe('access', () => {
  it('按路由 requiredPermission 判断访问权限', () => {
    const permissions = access({
      currentUser: { permissions: ['ai_call:agent:console'] },
    });

    expect(
      permissions.hasRoutePermission({
        requiredPermission: 'ai_call:agent:console',
      }),
    ).toBe(true);
    expect(
      permissions.hasRoutePermission({
        requiredPermission: 'ai_call:agent:manage',
      }),
    ).toBe(false);
  });

  it('超级权限可访问全部 AI Call 路由', () => {
    const permissions = access({
      currentUser: { permissions: ['*:*:*'] },
    });

    expect(
      permissions.hasRoutePermission({
        requiredPermission: 'ai_call:prompt:manage',
      }),
    ).toBe(true);
  });
});

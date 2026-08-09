import {
  hasAllPermissions,
  hasAllRoles,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
} from '@/utils/permission';

type InitialState = {
  currentUser?: API.CurrentUser & {
    roles?: string[];
    permissions?: string[];
  };
};

export default function access(initialState?: InitialState) {
  const currentUser = initialState?.currentUser;

  return {
    canAdmin: hasRole(currentUser, 'admin'),
    hasRole: (role: string) => hasRole(currentUser, role),
    hasAnyRole: (roles: string | string[]) => hasAnyRole(currentUser, roles),
    hasAllRoles: (roles: string | string[]) => hasAllRoles(currentUser, roles),
    hasPermission: (permission: string) => hasPermission(currentUser, permission),
    hasAnyPermission: (permissions: string | string[]) =>
      hasAnyPermission(currentUser, permissions),
    hasAllPermissions: (permissions: string | string[]) =>
      hasAllPermissions(currentUser, permissions),
    hasRoutePermission: (route: { requiredPermission?: string }) =>
      Boolean(
        route.requiredPermission &&
          hasPermission(currentUser, route.requiredPermission),
      ),
  };
}

export type PermissionSubject = {
  access?: string;
  roles?: string[];
  permissions?: string[];
};

export type PermissionMode = 'any' | 'all';

export type PermissionRequirement = {
  roles?: string | string[];
  permissions?: string | string[];
  mode?: PermissionMode;
};

const adminRole = 'admin';
const allPermission = '*:*:*';

const toArray = (value?: string | string[]) => {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
};

const hasAdminRole = (subject?: PermissionSubject) =>
  subject?.access === adminRole || Boolean(subject?.roles?.includes(adminRole));

export const hasRole = (subject: PermissionSubject | undefined, role: string) =>
  Boolean(role) &&
  (hasAdminRole(subject) || Boolean(subject?.roles?.includes(role)));

export const hasAnyRole = (
  subject: PermissionSubject | undefined,
  roles?: string | string[],
) => {
  const requiredRoles = toArray(roles);
  if (requiredRoles.length === 0) return true;
  return requiredRoles.some((role) => hasRole(subject, role));
};

export const hasAllRoles = (
  subject: PermissionSubject | undefined,
  roles?: string | string[],
) => {
  const requiredRoles = toArray(roles);
  if (requiredRoles.length === 0) return true;
  return requiredRoles.every((role) => hasRole(subject, role));
};

export const hasPermission = (
  subject: PermissionSubject | undefined,
  permission: string,
) =>
  Boolean(permission) &&
  (Boolean(subject?.permissions?.includes(allPermission)) ||
    Boolean(subject?.permissions?.includes(permission)));

export const hasAnyPermission = (
  subject: PermissionSubject | undefined,
  permissions?: string | string[],
) => {
  const requiredPermissions = toArray(permissions);
  if (requiredPermissions.length === 0) return true;
  return requiredPermissions.some((permission) =>
    hasPermission(subject, permission),
  );
};

export const hasAllPermissions = (
  subject: PermissionSubject | undefined,
  permissions?: string | string[],
) => {
  const requiredPermissions = toArray(permissions);
  if (requiredPermissions.length === 0) return true;
  return requiredPermissions.every((permission) =>
    hasPermission(subject, permission),
  );
};

export const canAccess = (
  subject: PermissionSubject | undefined,
  { roles, permissions, mode = 'any' }: PermissionRequirement = {},
) => {
  const requiredRoles = toArray(roles);
  const requiredPermissions = toArray(permissions);

  if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
    return true;
  }

  if (!subject) return false;

  const roleMatched =
    mode === 'all'
      ? hasAllRoles(subject, requiredRoles)
      : hasAnyRole(subject, requiredRoles);
  const permissionMatched =
    mode === 'all'
      ? hasAllPermissions(subject, requiredPermissions)
      : hasAnyPermission(subject, requiredPermissions);

  return roleMatched && permissionMatched;
};

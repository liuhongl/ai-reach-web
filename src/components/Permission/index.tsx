import { useModel } from '@umijs/max';
import { Button, type ButtonProps } from 'antd';
import React, { useMemo } from 'react';
import {
  canAccess as checkAccess,
  hasAllPermissions,
  hasAllRoles,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
  type PermissionRequirement,
} from '@/utils/permission';

export type PermissionGuardProps = PermissionRequirement & {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
};

export const usePermission = () => {
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;

  return useMemo(
    () => ({
      currentUser,
      canAccess: (requirement: PermissionRequirement = {}) =>
        checkAccess(currentUser, requirement),
      hasRole: (role: string) => hasRole(currentUser, role),
      hasAnyRole: (roles: string | string[]) => hasAnyRole(currentUser, roles),
      hasAllRoles: (roles: string | string[]) =>
        hasAllRoles(currentUser, roles),
      hasPermission: (permission: string) =>
        hasPermission(currentUser, permission),
      hasAnyPermission: (permissions: string | string[]) =>
        hasAnyPermission(currentUser, permissions),
      hasAllPermissions: (permissions: string | string[]) =>
        hasAllPermissions(currentUser, permissions),
    }),
    [currentUser],
  );
};

export const Permission = ({
  children,
  fallback = null,
  roles,
  permissions,
  mode,
}: PermissionGuardProps) => {
  const { canAccess } = usePermission();

  if (canAccess({ roles, permissions, mode })) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

export type PermissionButtonProps = ButtonProps &
  PermissionRequirement & {
    fallback?: React.ReactNode;
    noAccess?: 'hide' | 'disable';
  };

export const PermissionButton = ({
  children,
  fallback = null,
  noAccess = 'hide',
  roles,
  permissions,
  mode,
  disabled,
  ...buttonProps
}: PermissionButtonProps) => {
  const { canAccess } = usePermission();
  const allowed = canAccess({ roles, permissions, mode });

  if (allowed) {
    return (
      <Button disabled={disabled} {...buttonProps}>
        {children}
      </Button>
    );
  }

  if (noAccess === 'disable') {
    return (
      <Button disabled {...buttonProps}>
        {children}
      </Button>
    );
  }

  return <>{fallback}</>;
};

export default Permission;

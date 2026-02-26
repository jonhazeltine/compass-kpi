import React from 'react';
import type { ReactNode } from 'react';
import type { AdminRouteDefinition, AdminRole } from '../lib/adminAuthz';
import { canAccessAdminRoute } from '../lib/adminAuthz';
import { useAdminAuthz } from '../contexts/AdminAuthzContext';

type GuardReason = 'not_admin' | 'route_forbidden';

type AdminRouteGuardProps = {
  route: AdminRouteDefinition;
  rolesOverride?: AdminRole[];
  children: ReactNode;
  fallback: (args: { reason: GuardReason; route: AdminRouteDefinition }) => ReactNode;
};

export default function AdminRouteGuard({
  route,
  rolesOverride,
  children,
  fallback,
}: AdminRouteGuardProps) {
  const { resolvedRoles, hasAdminAccess } = useAdminAuthz();
  const roles = rolesOverride ?? resolvedRoles;
  const effectiveHasAdminAccess = rolesOverride !== undefined ? roles.includes('platform_admin') || roles.includes('super_admin') : hasAdminAccess;
  const canAccessRoute = canAccessAdminRoute(roles, route);
  const routeRequiresAdminOnly = route.requiredRoles.every((role) => role === 'platform_admin' || role === 'super_admin');

  if (!canAccessRoute) {
    return <>{fallback({ reason: !effectiveHasAdminAccess && routeRequiresAdminOnly ? 'not_admin' : 'route_forbidden', route })}</>;
  }

  return <>{children}</>;
}

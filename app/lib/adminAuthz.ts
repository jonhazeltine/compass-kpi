import type { Session } from '@supabase/supabase-js';

export type AdminRole =
  | 'platform_admin'
  | 'super_admin'
  | 'team_leader'
  | 'team_member'
  | 'individual'
  | 'unknown';

export type AdminRouteKey =
  | 'overview'
  | 'users'
  | 'authz'
  | 'kpis'
  | 'challengeTemplates'
  | 'reports'
  | 'coachingAudit';

export type AdminRouteDefinition = {
  key: AdminRouteKey;
  label: string;
  path: string;
  requiredRoles: AdminRole[];
  description: string;
};

const ADMIN_ROLE_ALIASES: Record<string, AdminRole> = {
  admin: 'platform_admin',
  platform_admin: 'platform_admin',
  super_admin: 'super_admin',
  superadmin: 'super_admin',
  team_leader: 'team_leader',
  leader: 'team_leader',
  team_member: 'team_member',
  member: 'team_member',
  individual: 'individual',
};

function normalizeRole(value: unknown): AdminRole | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ADMIN_ROLE_ALIASES[normalized] ?? (normalized ? 'unknown' : null);
}

export function normalizeAdminRole(value: unknown): AdminRole | null {
  return normalizeRole(value);
}

function readRoleCandidates(session: Session | null): unknown[] {
  if (!session) return [];
  const user = session.user;
  const appMetadata = user.app_metadata ?? {};
  const userMetadata = user.user_metadata ?? {};

  return [
    appMetadata.role,
    userMetadata.role,
    ...(Array.isArray(appMetadata.roles) ? appMetadata.roles : []),
    ...(Array.isArray(userMetadata.roles) ? userMetadata.roles : []),
  ];
}

export function getSessionRoles(session: Session | null): AdminRole[] {
  const roles = readRoleCandidates(session)
    .map(normalizeRole)
    .filter((role): role is AdminRole => role !== null);

  return Array.from(new Set(roles));
}

export function hasAnyRole(sessionRoles: AdminRole[], requiredRoles: AdminRole[]): boolean {
  return requiredRoles.some((role) => sessionRoles.includes(role));
}

export function isAdminSession(session: Session | null): boolean {
  return hasAnyRole(getSessionRoles(session), ['platform_admin', 'super_admin']);
}

export function canAccessAdminRoute(
  sessionRoles: AdminRole[],
  route: Pick<AdminRouteDefinition, 'requiredRoles'>
): boolean {
  return hasAnyRole(sessionRoles, route.requiredRoles);
}

export const ADMIN_ROUTES: AdminRouteDefinition[] = [
  {
    key: 'overview',
    label: 'Overview',
    path: '/admin',
    requiredRoles: ['platform_admin', 'super_admin'],
    description: 'A1 shell landing screen and status summary placeholder.',
  },
  {
    key: 'users',
    label: 'Users',
    path: '/admin/users',
    requiredRoles: ['platform_admin', 'super_admin'],
    description: 'A1 placeholder for user ops entry point (A3 implementation later).',
  },
  {
    key: 'authz',
    label: 'AuthZ',
    path: '/admin/authz',
    requiredRoles: ['platform_admin', 'super_admin'],
    description: 'A1 route-guard and unauthorized-state baseline validation screen.',
  },
  {
    key: 'kpis',
    label: 'KPI Catalog',
    path: '/admin/kpis',
    requiredRoles: ['platform_admin', 'super_admin'],
    description: 'A1 placeholder only. CRUD implementation is in A2.',
  },
  {
    key: 'challengeTemplates',
    label: 'Templates',
    path: '/admin/challenge-templates',
    requiredRoles: ['platform_admin', 'super_admin'],
    description: 'A1 placeholder only. Challenge template management is in A2.',
  },
  {
    key: 'reports',
    label: 'Reports',
    path: '/admin/reports',
    requiredRoles: ['platform_admin', 'super_admin'],
    description: 'A1 placeholder only. Analytics/report work is in A3.',
  },
  {
    key: 'coachingAudit',
    label: 'Coaching Audit',
    path: '/admin/coaching/audit',
    requiredRoles: ['platform_admin', 'super_admin'],
    description: 'W5 approval-first AI moderation and audit queue for coach/admin ops.',
  },
];

export function getInitialAdminRouteKey(value: string | undefined): AdminRouteKey {
  const route = ADMIN_ROUTES.find((item) => item.key === value);
  return route?.key ?? 'overview';
}

export function getAdminRouteByKey(key: AdminRouteKey): AdminRouteDefinition {
  return ADMIN_ROUTES.find((item) => item.key === key) ?? ADMIN_ROUTES[0];
}

export function getAdminRouteByPath(pathname: string | undefined): AdminRouteDefinition | null {
  if (!pathname) return null;
  const normalized = pathname.replace(/\/+$/, '') || '/';

  if (normalized === '/admin') {
    return ADMIN_ROUTES.find((item) => item.path === '/admin') ?? null;
  }

  return ADMIN_ROUTES.find((item) => item.path === normalized) ?? null;
}

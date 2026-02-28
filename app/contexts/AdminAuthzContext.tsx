import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AdminRouteDefinition, AdminRole } from '../lib/adminAuthz';
import { canAccessAdminRoute, getSessionRoles, normalizeAdminRole } from '../lib/adminAuthz';
import { API_URL } from '../lib/supabase';
import { useAuth } from './AuthContext';

type AdminAuthzContextValue = {
  sessionRoles: AdminRole[];
  resolvedRoles: AdminRole[];
  backendRole: string | null;
  backendRoleError: string | null;
  backendRoleLoading: boolean;
  hasAdminAccess: boolean;
  canAccessRoute: (route: Pick<AdminRouteDefinition, 'requiredRoles'>) => boolean;
  debugLines: string[];
};

const AdminAuthzContext = createContext<AdminAuthzContextValue | undefined>(undefined);

type RuntimeRoleOverride = {
  roles: AdminRole[];
  mode: 'strict' | 'merge';
  source: 'query' | 'storage';
};

const RUNTIME_ROLE_OVERRIDE_STORAGE_KEY = 'compass_admin_authz_override_v1';

function parseRoleList(raw: string | null): AdminRole[] {
  if (!raw) return [];
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
  const normalized = values
    .map((value) => normalizeAdminRole(value))
    .filter((role): role is AdminRole => role !== null);
  return Array.from(new Set(normalized));
}

function parseMode(raw: string | null): 'strict' | 'merge' {
  return String(raw ?? '').toLowerCase() === 'merge' ? 'merge' : 'strict';
}

function readRuntimeRoleOverride(): RuntimeRoleOverride | null {
  if (!__DEV__) return null;
  if (typeof window === 'undefined') return null;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const queryRoles = parseRoleList(searchParams.get('authz_roles') ?? searchParams.get('authz_role'));
    if (queryRoles.length > 0) {
      const mode = parseMode(searchParams.get('authz_mode'));
      try {
        window.localStorage.setItem(
          RUNTIME_ROLE_OVERRIDE_STORAGE_KEY,
          JSON.stringify({ roles: queryRoles, mode })
        );
      } catch {
        // Ignore storage write failures; query override still applies for this load.
      }
      return {
        roles: queryRoles,
        mode,
        source: 'query',
      };
    }
  } catch {
    // Ignore malformed query strings and continue to storage fallback.
  }

  try {
    const raw = window.localStorage.getItem(RUNTIME_ROLE_OVERRIDE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { roles?: unknown; mode?: unknown };
    const storageRoles = Array.isArray(parsed.roles)
      ? parseRoleList(parsed.roles.map((entry) => String(entry)).join(','))
      : [];
    if (storageRoles.length === 0) return null;
    return {
      roles: storageRoles,
      mode: parseMode(typeof parsed.mode === 'string' ? parsed.mode : null),
      source: 'storage',
    };
  } catch {
    return null;
  }
}

export function AdminAuthzProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [backendRole, setBackendRole] = useState<string | null>(null);
  const [backendRoleError, setBackendRoleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBackendMeFallback() {
      if (!session?.access_token) {
        setBackendRole(null);
        setBackendRoleError(null);
        return;
      }

      if (!cancelled) {
        // Reset stale role/error state when token changes so loading/error UI stays accurate.
        setBackendRole(null);
        setBackendRoleError(null);
      }

      try {
        const response = await fetch(`${API_URL}/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!response.ok) {
          if (!cancelled) {
            setBackendRole(null);
            setBackendRoleError(`GET /me failed (${response.status})`);
          }
          return;
        }

        const data = (await response.json()) as { role?: unknown };
        if (!cancelled) {
          setBackendRole(typeof data.role === 'string' ? data.role : null);
          setBackendRoleError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setBackendRole(null);
          setBackendRoleError(error instanceof Error ? error.message : 'GET /me failed');
        }
      }
    }

    void loadBackendMeFallback();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const runtimeRoleOverride = useMemo(
    () => readRuntimeRoleOverride(),
    [session?.access_token]
  );
  const sessionRoles = useMemo(() => getSessionRoles(session), [session]);
  const resolvedRoles = useMemo(() => {
    const roleSet = new Set<AdminRole>(sessionRoles);
    const backendNormalized = normalizeAdminRole(backendRole);
    if (backendNormalized) roleSet.add(backendNormalized);
    const baseRoles = Array.from(roleSet);
    if (!runtimeRoleOverride) return baseRoles;
    if (runtimeRoleOverride.mode === 'strict') return runtimeRoleOverride.roles;
    return Array.from(new Set<AdminRole>([...baseRoles, ...runtimeRoleOverride.roles]));
  }, [backendRole, runtimeRoleOverride, sessionRoles]);

  const value = useMemo<AdminAuthzContextValue>(() => {
    const hasAdminAccess =
      resolvedRoles.includes('platform_admin') || resolvedRoles.includes('super_admin');
    const appMeta = session?.user.app_metadata ?? {};
    const userMeta = session?.user.user_metadata ?? {};

    return {
      sessionRoles,
      resolvedRoles,
      backendRole,
      backendRoleError,
      backendRoleLoading: !backendRole && !backendRoleError && !!session?.access_token,
      hasAdminAccess,
      canAccessRoute: (route) => canAccessAdminRoute(resolvedRoles, route),
      debugLines: [
        `app_metadata.role=${String((appMeta as Record<string, unknown>).role ?? '(missing)')}`,
        `app_metadata.roles=${JSON.stringify((appMeta as Record<string, unknown>).roles ?? '(missing)')}`,
        `user_metadata.role=${String((userMeta as Record<string, unknown>).role ?? '(missing)')}`,
        `user_metadata.roles=${JSON.stringify((userMeta as Record<string, unknown>).roles ?? '(missing)')}`,
        `backend /me role=${backendRole ?? '(missing)'}`,
        `backend /me error=${backendRoleError ?? '(none)'}`,
        `runtime override=${
          runtimeRoleOverride
            ? `${runtimeRoleOverride.source}:${runtimeRoleOverride.mode}:${runtimeRoleOverride.roles.join(',')}`
            : '(none)'
        }`,
        `user.id=${session?.user.id ?? '(no session)'}`,
        `user.email=${session?.user.email ?? '(unknown)'}`,
      ],
    };
  }, [backendRole, backendRoleError, resolvedRoles, runtimeRoleOverride, session, sessionRoles]);

  return <AdminAuthzContext.Provider value={value}>{children}</AdminAuthzContext.Provider>;
}

export function useAdminAuthz() {
  const ctx = useContext(AdminAuthzContext);
  if (!ctx) throw new Error('useAdminAuthz must be used within AdminAuthzProvider');
  return ctx;
}

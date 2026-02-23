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

  const sessionRoles = useMemo(() => getSessionRoles(session), [session]);
  const resolvedRoles = useMemo(() => {
    const roleSet = new Set<AdminRole>(sessionRoles);
    const backendNormalized = normalizeAdminRole(backendRole);
    if (backendNormalized) roleSet.add(backendNormalized);
    return Array.from(roleSet);
  }, [backendRole, sessionRoles]);

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
        `user.id=${session?.user.id ?? '(no session)'}`,
        `user.email=${session?.user.email ?? '(unknown)'}`,
      ],
    };
  }, [backendRole, backendRoleError, resolvedRoles, session, sessionRoles]);

  return <AdminAuthzContext.Provider value={value}>{children}</AdminAuthzContext.Provider>;
}

export function useAdminAuthz() {
  const ctx = useContext(AdminAuthzContext);
  if (!ctx) throw new Error('useAdminAuthz must be used within AdminAuthzProvider');
  return ctx;
}

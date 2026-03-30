/**
 * useRuntimePersona — Derives persona role signals, bottom-tab order,
 * team/solo persona variants, and entitlement helpers from session
 * metadata and runtime state.
 *
 * All inputs are injected so the hook remains decoupled from the
 * dashboard data layer.
 */

import { useCallback, useMemo } from 'react';

// ── Injected dependencies ───────────────────────────────────────────

export interface RuntimePersonaDeps {
  sessionUserMeta: Record<string, unknown>;
  sessionAppMeta: Record<string, unknown>;
  runtimeMeRole: string | null;
  runtimeEntitlements: Record<string, boolean | number | string | null>;
  sessionUserId: string | null;
  entitlementCan: (key: string, fallback: boolean) => boolean;
  entitlementLimitFromContext: (key: string, fallback: number) => number;
  coachProfiles: Array<{ id?: string | null }>;
  coachActiveEngagementCoachId: string | null;
  teamRosterMembers: Array<{ user_id?: string | null; role?: string | null }>;
  challengeListItems: Array<{
    id: string;
    joined?: boolean;
    challengeModeLabel?: string;
    raw?: { team_id?: string | null } | null;
  }>;
}

// ── Bottom tab type (must match host) ───────────────────────────────

export type BottomTab = 'comms' | 'team' | 'home' | 'logs' | 'coach' | 'challenge';

// ── Public surface ──────────────────────────────────────────────────

export interface RuntimePersonaState {
  teamPersonaVariant: 'leader' | 'member';
  runtimeRoleSignals: string[];
  isCoachRuntimeOperator: boolean;
  isChallengeSponsorRuntime: boolean;
  currentUserTeamRoleFromRoster: 'leader' | 'member' | null;
  inferredTeamMembershipFromChallenges: boolean;
  hasExplicitTeamRole: boolean;
  hasExplicitSoloRole: boolean;
  isSoloPersona: boolean;
  bottomTabOrder: BottomTab[];
  effectiveTeamPersonaVariant: 'leader' | 'member';
  isTeamLeaderCreatorParticipant: boolean;
}

export interface RuntimePersonaActions {
  entitlementValueByKey: (key: string) => boolean | number | string | null | undefined;
  entitlementFlag: (key: string, fallback: boolean) => boolean;
  entitlementNumber: (key: string, fallback: number) => number;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useRuntimePersona(
  deps: RuntimePersonaDeps,
): RuntimePersonaState & RuntimePersonaActions {
  const {
    sessionUserMeta,
    sessionAppMeta,
    runtimeMeRole,
    runtimeEntitlements,
    sessionUserId,
    entitlementCan,
    entitlementLimitFromContext,
    coachProfiles,
    coachActiveEngagementCoachId,
    teamRosterMembers,
    challengeListItems,
  } = deps;

  // ── teamPersonaVariant ──────────────────────────────────────────
  const teamPersonaVariant = useMemo<'leader' | 'member'>(() => {
    const roleCandidates = [
      sessionUserMeta.team_role,
      sessionUserMeta.role,
      sessionAppMeta.team_role,
      sessionAppMeta.role,
      runtimeMeRole,
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .filter(Boolean);
    if (roleCandidates.some((r) => r.includes('lead') || r.includes('manager'))) return 'leader';
    if (roleCandidates.some((r) => r.includes('member'))) return 'member';
    return 'member';
  }, [runtimeMeRole, sessionAppMeta.role, sessionAppMeta.team_role, sessionUserMeta.role, sessionUserMeta.team_role]);

  // ── runtimeRoleSignals ──────────────────────────────────────────
  const runtimeRoleSignals = useMemo(() => {
    const rawValues: unknown[] = [
      sessionUserMeta.team_role,
      sessionUserMeta.role,
      sessionUserMeta.persona,
      sessionAppMeta.team_role,
      sessionAppMeta.role,
      sessionAppMeta.persona,
      runtimeMeRole,
      Array.isArray(sessionUserMeta.roles) ? sessionUserMeta.roles.join(',') : null,
      Array.isArray(sessionAppMeta.roles) ? sessionAppMeta.roles.join(',') : null,
    ];
    return rawValues
      .flatMap((v) => String(v ?? '').toLowerCase().split(/[,\s|/]+/g))
      .map((v) => v.trim())
      .filter(Boolean);
  }, [
    sessionAppMeta.persona,
    sessionAppMeta.role,
    sessionAppMeta.roles,
    sessionAppMeta.team_role,
    sessionUserMeta.persona,
    sessionUserMeta.role,
    sessionUserMeta.roles,
    sessionUserMeta.team_role,
    runtimeMeRole,
  ]);

  // ── entitlement helpers ─────────────────────────────────────────
  const entitlementValueByKey = useCallback(
    (key: string): boolean | number | string | null | undefined => {
      const runtimeValue = runtimeEntitlements[key];
      if (runtimeValue !== undefined) return runtimeValue;
      const ctxValue = (entitlementCan(key, false) ? true : undefined) as boolean | undefined;
      if (ctxValue !== undefined) return ctxValue;
      return undefined;
    },
    [entitlementCan, runtimeEntitlements],
  );

  const entitlementFlag = useCallback(
    (key: string, fallback: boolean): boolean => {
      const value = entitlementValueByKey(key);
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
        if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
      }
      return entitlementCan(key, fallback);
    },
    [entitlementCan, entitlementValueByKey],
  );

  const entitlementNumber = useCallback(
    (key: string, fallback: number): number => {
      const value = entitlementValueByKey(key);
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return entitlementLimitFromContext(key, fallback);
    },
    [entitlementLimitFromContext, entitlementValueByKey],
  );

  // ── derived booleans ────────────────────────────────────────────
  const isCoachRuntimeOperator = useMemo(() => {
    if (runtimeRoleSignals.some((signal) => signal.includes('coach'))) return true;
    const uid = String(sessionUserId ?? '').trim();
    if (!uid) return false;
    const ownsCoachProfile = coachProfiles.some((profile) => String(profile.id ?? '') === uid);
    if (ownsCoachProfile) return true;
    const activeCoachId = String(coachActiveEngagementCoachId ?? '').trim();
    return Boolean(activeCoachId) && activeCoachId === uid;
  }, [coachActiveEngagementCoachId, coachProfiles, runtimeRoleSignals, sessionUserId]);

  const isChallengeSponsorRuntime = useMemo(
    () => runtimeRoleSignals.some((signal) => signal.includes('sponsor')),
    [runtimeRoleSignals],
  );

  const currentUserTeamRoleFromRoster = useMemo<'leader' | 'member' | null>(() => {
    const uid = String(sessionUserId ?? '').trim();
    if (!uid) return null;
    const rosterRow = teamRosterMembers.find(
      (row) => String(row.user_id ?? '').trim() === uid,
    );
    const rawRole = String(rosterRow?.role ?? '').trim().toLowerCase();
    if (!rawRole) return null;
    if (rawRole.includes('lead') || rawRole.includes('manager')) return 'leader';
    if (rawRole.includes('member')) return 'member';
    return null;
  }, [sessionUserId, teamRosterMembers]);

  const inferredTeamMembershipFromChallenges = useMemo(
    () =>
      challengeListItems.some(
        (item) => item.joined && (item.challengeModeLabel === 'Team' || Boolean(item.raw?.team_id)),
      ),
    [challengeListItems],
  );

  const hasExplicitTeamRole = useMemo(
    () =>
      Boolean(currentUserTeamRoleFromRoster) ||
      inferredTeamMembershipFromChallenges ||
      runtimeRoleSignals.some(
        (signal) =>
          signal === 'member' ||
          signal === 'team_member' ||
          signal === 'teammember' ||
          signal === 'leader' ||
          signal === 'team_leader' ||
          signal.includes('manager'),
      ),
    [currentUserTeamRoleFromRoster, inferredTeamMembershipFromChallenges, runtimeRoleSignals],
  );

  const hasExplicitSoloRole = useMemo(
    () =>
      runtimeRoleSignals.some(
        (signal) =>
          signal === 'solo' ||
          signal === 'solo_agent' ||
          signal === 'individual' ||
          signal === 'single_agent' ||
          signal.includes('solo'),
      ),
    [runtimeRoleSignals],
  );

  const isSoloPersona =
    !isCoachRuntimeOperator && !isChallengeSponsorRuntime && !hasExplicitTeamRole && hasExplicitSoloRole;

  const bottomTabOrder = useMemo<BottomTab[]>(
    () => ['challenge', 'team', 'home', 'logs', 'coach'],
    [],
  );

  const effectiveTeamPersonaVariant = currentUserTeamRoleFromRoster ?? teamPersonaVariant;

  const isTeamLeaderCreatorParticipant = useMemo(
    () =>
      effectiveTeamPersonaVariant === 'leader' ||
      runtimeRoleSignals.some((signal) => signal.includes('lead') || signal.includes('manager')),
    [effectiveTeamPersonaVariant, runtimeRoleSignals],
  );

  return {
    teamPersonaVariant,
    runtimeRoleSignals,
    isCoachRuntimeOperator,
    isChallengeSponsorRuntime,
    currentUserTeamRoleFromRoster,
    inferredTeamMembershipFromChallenges,
    hasExplicitTeamRole,
    hasExplicitSoloRole,
    isSoloPersona,
    bottomTabOrder,
    effectiveTeamPersonaVariant,
    isTeamLeaderCreatorParticipant,
    entitlementValueByKey,
    entitlementFlag,
    entitlementNumber,
  };
}

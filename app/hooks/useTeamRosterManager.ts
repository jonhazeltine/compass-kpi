/**
 * useTeamRosterManager — State + callbacks for team roster fetch,
 * invite-code CRUD, leave-team, and remove-member mutations.
 *
 * All external dependencies (session, team identity setters,
 * fetchDashboard, etc.) are injected through `deps`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import type {
  TeamApiMemberSummary,
  TeamDetailResponse,
  TeamFlowScreen,
  TeamMembershipMutationResponse,
} from '../screens/kpi-dashboard/types';

import { UUID_LIKE_RE } from '../screens/kpi-dashboard/constants';

import {
  fmtShortMonthDayYear,
  getApiErrorMessage,
  mapCommsHttpError,
} from '../screens/kpi-dashboard/helpers';

import { API_URL } from '../lib/supabase';

// ── Injected dependencies ───────────────────────────────────────────

export interface TeamRosterManagerDeps {
  accessToken: string | null;
  sessionUserId: string | null;
  sessionUserMeta: Record<string, unknown>;
  sessionAppMeta: Record<string, unknown>;
  teamIdentitySetAvatar: (v: string) => void;
  teamIdentitySetBackground: (v: string) => void;
  teamIdentitySetControlsOpen: (v: boolean) => void;
  teamIdentityControlsOpen: boolean;
  channelsApiRows: Array<{
    type?: string | null;
    is_active?: boolean | null;
    team_id?: string | null;
  }>;
  challengeListItems: Array<{
    id: string;
    joined?: boolean;
    raw?: { team_id?: string | null } | null;
  }>;
  fetchDashboard: () => Promise<void>;
}

// ── Public surface ──────────────────────────────────────────────────

export interface TeamRosterManagerState {
  teamFlowScreen: TeamFlowScreen;
  teamRosterMembers: TeamApiMemberSummary[];
  teamRosterName: string | null;
  teamRosterError: string | null;
  teamRosterTeamId: string | null;
  teamProfileMemberId: string | null;
  teamMembershipMutationBusy: boolean;
  teamMembershipMutationNotice: string | null;
  teamInviteCodeBusy: boolean;
  teamInviteCodeNotice: string | null;
  teamInviteCodeValue: string | null;
  /* derived */
  teamRuntimeCandidateIds: string[];
  teamRuntimeId: string | null;
}

export interface TeamRosterManagerActions {
  setTeamFlowScreen: React.Dispatch<React.SetStateAction<TeamFlowScreen>>;
  setTeamRosterMembers: React.Dispatch<React.SetStateAction<TeamApiMemberSummary[]>>;
  setTeamRosterName: React.Dispatch<React.SetStateAction<string | null>>;
  setTeamRosterError: React.Dispatch<React.SetStateAction<string | null>>;
  setTeamRosterTeamId: React.Dispatch<React.SetStateAction<string | null>>;
  setTeamProfileMemberId: React.Dispatch<React.SetStateAction<string | null>>;
  setTeamMembershipMutationBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setTeamMembershipMutationNotice: React.Dispatch<React.SetStateAction<string | null>>;
  setTeamInviteCodeBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setTeamInviteCodeNotice: React.Dispatch<React.SetStateAction<string | null>>;
  setTeamInviteCodeValue: React.Dispatch<React.SetStateAction<string | null>>;
  fetchTeamRoster: () => Promise<void>;
  resolveCurrentTeamContextId: () => string | null;
  createTeamInviteCode: () => Promise<void>;
  leaveCurrentTeam: () => Promise<void>;
  removeTeamMember: (targetUserId: string, targetName: string) => Promise<void>;
  lastTeamRosterFetchAtRef: React.MutableRefObject<number>;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useTeamRosterManager(
  deps: TeamRosterManagerDeps,
): TeamRosterManagerState & TeamRosterManagerActions {
  const {
    accessToken,
    sessionUserId,
    sessionUserMeta,
    sessionAppMeta,
    teamIdentitySetAvatar,
    teamIdentitySetBackground,
    teamIdentitySetControlsOpen,
    teamIdentityControlsOpen,
    channelsApiRows,
    challengeListItems,
    fetchDashboard,
  } = deps;

  // ── local state ─────────────────────────────────────────────────
  const [teamFlowScreen, setTeamFlowScreen] = useState<TeamFlowScreen>('dashboard');
  const [teamRosterMembers, setTeamRosterMembers] = useState<TeamApiMemberSummary[]>([]);
  const [teamRosterName, setTeamRosterName] = useState<string | null>(null);
  const [teamRosterError, setTeamRosterError] = useState<string | null>(null);
  const [teamRosterTeamId, setTeamRosterTeamId] = useState<string | null>(null);
  const [teamProfileMemberId, setTeamProfileMemberId] = useState<string | null>(null);
  const [teamMembershipMutationBusy, setTeamMembershipMutationBusy] = useState(false);
  const [teamMembershipMutationNotice, setTeamMembershipMutationNotice] = useState<string | null>(null);
  const [teamInviteCodeBusy, setTeamInviteCodeBusy] = useState(false);
  const [teamInviteCodeNotice, setTeamInviteCodeNotice] = useState<string | null>(null);
  const [teamInviteCodeValue, setTeamInviteCodeValue] = useState<string | null>(null);

  const lastTeamRosterFetchAtRef = useRef<number>(0);

  // ── derived: team runtime candidate IDs ─────────────────────────
  const teamRuntimeCandidateIds = useMemo(() => {
    const orderedIds: string[] = [];
    const pushCandidate = (value: unknown) => {
      const candidate = String(value ?? '').trim();
      if (!candidate || !UUID_LIKE_RE.test(candidate)) return;
      if (!orderedIds.includes(candidate)) orderedIds.push(candidate);
    };
    pushCandidate(teamRosterTeamId);
    pushCandidate(sessionUserMeta.team_id);
    pushCandidate(sessionAppMeta.team_id);
    const allChannelRows = Array.isArray(channelsApiRows) ? channelsApiRows : [];
    allChannelRows
      .filter((row) => String(row.type ?? '').toLowerCase() === 'team' && row.is_active !== false)
      .forEach((row) => pushCandidate(row.team_id));
    allChannelRows
      .filter((row) => String(row.type ?? '').toLowerCase() === 'team' && row.is_active === false)
      .forEach((row) => pushCandidate(row.team_id));
    challengeListItems
      .filter((item) => item.joined)
      .forEach((item) => pushCandidate(item.raw?.team_id ?? null));
    challengeListItems.forEach((item) => pushCandidate(item.raw?.team_id ?? null));
    return orderedIds;
  }, [challengeListItems, channelsApiRows, sessionAppMeta.team_id, sessionUserMeta.team_id, teamRosterTeamId]);

  const teamRuntimeId = useMemo(() => {
    return teamRuntimeCandidateIds[0] ?? null;
  }, [teamRuntimeCandidateIds]);

  // ── resolveCurrentTeamContextId ─────────────────────────────────
  const resolveCurrentTeamContextId = useCallback((): string | null => {
    const preferred = String(teamRosterTeamId ?? '').trim();
    if (preferred && UUID_LIKE_RE.test(preferred)) return preferred;
    for (const candidate of teamRuntimeCandidateIds) {
      const normalized = String(candidate ?? '').trim();
      if (normalized && UUID_LIKE_RE.test(normalized)) return normalized;
    }
    return null;
  }, [teamRosterTeamId, teamRuntimeCandidateIds]);

  // ── fetchTeamRoster ─────────────────────────────────────────────
  const fetchTeamRoster = useCallback(async () => {
    const token = accessToken;
    lastTeamRosterFetchAtRef.current = Date.now();
    if (!token || teamRuntimeCandidateIds.length === 0) {
      setTeamRosterMembers([]);
      setTeamRosterName(null);
      setTeamRosterError(null);
      setTeamRosterTeamId(null);
      teamIdentitySetAvatar('🛡️');
      teamIdentitySetBackground('#dff0da');
      return;
    }
    try {
      setTeamRosterError(null);
      let lastFailure: string | null = null;
      for (const candidateTeamId of teamRuntimeCandidateIds) {
        const response = await fetch(`${API_URL}/teams/${encodeURIComponent(candidateTeamId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json().catch(() => ({}))) as TeamDetailResponse;
        if (!response.ok) {
          const fallback = `Team roster request failed (${response.status})`;
          lastFailure = mapCommsHttpError(response.status, getApiErrorMessage(body, fallback));
          continue;
        }
        const members = (Array.isArray(body.members) ? body.members : []).filter(
          (member): member is TeamApiMemberSummary =>
            typeof member?.user_id === 'string' && String(member.user_id).trim().length > 0,
        );
        const resolvedTeamId = String(body.team?.id ?? candidateTeamId).trim();
        setTeamRosterMembers(members);
        setTeamRosterName(body.team?.name ? String(body.team.name) : null);
        teamIdentitySetAvatar(String(body.team?.identity_avatar ?? '🛡️').trim() || '🛡️');
        teamIdentitySetBackground(String(body.team?.identity_background ?? '#dff0da').trim() || '#dff0da');
        setTeamRosterTeamId(resolvedTeamId || candidateTeamId);
        setTeamRosterError(null);
        return;
      }
      setTeamRosterMembers([]);
      setTeamRosterName(null);
      setTeamRosterError(lastFailure ?? 'Team roster unavailable in your current scope.');
      setTeamRosterTeamId(teamRuntimeCandidateIds[0] ?? null);
      teamIdentitySetAvatar('🛡️');
      teamIdentitySetBackground('#dff0da');
    } catch (err) {
      setTeamRosterError(err instanceof Error ? err.message : 'Failed to load team roster');
      setTeamRosterMembers([]);
      setTeamRosterName(null);
      setTeamRosterTeamId(teamRuntimeCandidateIds[0] ?? null);
      teamIdentitySetAvatar('🛡️');
      teamIdentitySetBackground('#dff0da');
    }
  }, [accessToken, teamRuntimeCandidateIds, teamIdentitySetAvatar, teamIdentitySetBackground]);

  // ── team invite code: auto-fetch when controls open ─────────────
  useEffect(() => {
    if (!teamIdentityControlsOpen || teamInviteCodeValue) return;
    const token = accessToken;
    const teamId = resolveCurrentTeamContextId();
    if (!token || !teamId) return;
    void (async () => {
      try {
        const resp = await fetch(`${API_URL}/api/invites/my-codes?invite_type=team`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = (await resp.json()) as { codes?: Array<{ code?: string; target_id?: string }> };
          const match = data.codes?.find((c) => c.target_id === teamId);
          if (match?.code) setTeamInviteCodeValue(match.code);
        }
      } catch { /* silent */ }
    })();
  }, [teamIdentityControlsOpen, teamInviteCodeValue, accessToken, resolveCurrentTeamContextId]);

  // ── createTeamInviteCode ────────────────────────────────────────
  const createTeamInviteCode = useCallback(async () => {
    const token = accessToken;
    const teamId = resolveCurrentTeamContextId();
    if (!token) {
      Alert.alert('Sign in required', 'Sign in is required to create a team invite link.');
      return;
    }
    if (!teamId) {
      Alert.alert('Team unavailable', 'Team context is unavailable. Refresh and try again.');
      return;
    }
    setTeamInviteCodeBusy(true);
    setTeamInviteCodeNotice(null);
    try {
      const response = await fetch(`${API_URL}/teams/${encodeURIComponent(teamId)}/invite-codes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        invite_code?: { code?: string | null; expires_at?: string | null } | null;
      };
      if (!response.ok) {
        const fallback = `Create invite code failed (${response.status})`;
        const message = getApiErrorMessage(payload, fallback);
        setTeamInviteCodeNotice(message);
        Alert.alert('Unable to create invite link', message);
        return;
      }
      const code = String(payload.invite_code?.code ?? '').trim();
      if (!code) {
        const message = 'Invite code response did not include a code.';
        setTeamInviteCodeNotice(message);
        Alert.alert('Invite link unavailable', message);
        return;
      }
      const expiresLabel = fmtShortMonthDayYear(payload.invite_code?.expires_at ?? null);
      const success = expiresLabel ? `Code: ${code} (expires ${expiresLabel})` : `Code: ${code}`;
      setTeamInviteCodeValue(code);
      setTeamInviteCodeNotice(success);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create team invite code';
      setTeamInviteCodeNotice(message);
      Alert.alert('Unable to create invite link', message);
    } finally {
      setTeamInviteCodeBusy(false);
    }
  }, [resolveCurrentTeamContextId, accessToken]);

  // ── leaveCurrentTeam ────────────────────────────────────────────
  const leaveCurrentTeam = useCallback(async () => {
    const token = accessToken;
    const teamId = resolveCurrentTeamContextId();
    if (!token) {
      Alert.alert('Sign in required', 'Sign in is required to leave your team.');
      return;
    }
    if (!teamId) {
      Alert.alert('Team unavailable', 'Team context is unavailable. Refresh and try again.');
      return;
    }
    setTeamMembershipMutationBusy(true);
    setTeamMembershipMutationNotice(null);
    try {
      const response = await fetch(`${API_URL}/teams/${encodeURIComponent(teamId)}/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const body = (await response.json().catch(() => ({}))) as TeamMembershipMutationResponse;
      if (!response.ok) {
        const fallback = `Leave team failed (${response.status})`;
        const message = getApiErrorMessage(body, fallback);
        setTeamMembershipMutationNotice(message);
        Alert.alert('Unable to leave team', message);
        return;
      }
      const challengeRowsRemoved = Math.max(0, Number(body.cleanup?.challenge_participants_removed ?? 0));
      const channelRowsRemoved = Math.max(0, Number(body.cleanup?.channel_memberships_removed ?? 0));
      const note = body.warning?.custom_kpi_visibility_note ?? 'Team-only KPI access may be lost based on your plan.';
      const successText = `You left the team. Removed ${challengeRowsRemoved} team challenge enrollment(s) and ${channelRowsRemoved} team channel membership(s). ${note}`;
      setTeamMembershipMutationNotice(successText);
      teamIdentitySetControlsOpen(false);
      setTeamProfileMemberId(null);
      await Promise.all([fetchDashboard(), fetchTeamRoster()]);
      Alert.alert('Left team', successText);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to leave team';
      setTeamMembershipMutationNotice(message);
      Alert.alert('Unable to leave team', message);
    } finally {
      setTeamMembershipMutationBusy(false);
    }
  }, [fetchDashboard, fetchTeamRoster, resolveCurrentTeamContextId, accessToken, teamIdentitySetControlsOpen]);

  // ── removeTeamMember ────────────────────────────────────────────
  const removeTeamMember = useCallback(
    async (targetUserId: string, targetName: string) => {
      const token = accessToken;
      const teamId = resolveCurrentTeamContextId();
      if (!token) {
        Alert.alert('Sign in required', 'Sign in is required to remove team members.');
        return;
      }
      if (!teamId) {
        Alert.alert('Team unavailable', 'Team context is unavailable. Refresh and try again.');
        return;
      }
      if (!targetUserId || !UUID_LIKE_RE.test(targetUserId)) {
        Alert.alert('Member unavailable', `No valid account id was found for ${targetName}. Refresh team roster and retry.`);
        return;
      }
      setTeamMembershipMutationBusy(true);
      setTeamMembershipMutationNotice(null);
      try {
        const response = await fetch(
          `${API_URL}/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(targetUserId)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const body = (await response.json().catch(() => ({}))) as TeamMembershipMutationResponse;
        if (!response.ok) {
          const fallback = `Remove member failed (${response.status})`;
          const message = getApiErrorMessage(body, fallback);
          setTeamMembershipMutationNotice(message);
          Alert.alert('Unable to remove member', message);
          return;
        }
        const challengeRowsRemoved = Math.max(0, Number(body.cleanup?.challenge_participants_removed ?? 0));
        const channelRowsRemoved = Math.max(0, Number(body.cleanup?.channel_memberships_removed ?? 0));
        const successText = `${targetName} removed from team. Cleared ${challengeRowsRemoved} team challenge enrollment(s) and ${channelRowsRemoved} channel membership(s).`;
        setTeamMembershipMutationNotice(successText);
        setTeamProfileMemberId(null);
        await Promise.all([fetchDashboard(), fetchTeamRoster()]);
        Alert.alert('Member removed', successText);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove team member';
        setTeamMembershipMutationNotice(message);
        Alert.alert('Unable to remove member', message);
      } finally {
        setTeamMembershipMutationBusy(false);
      }
    },
    [fetchDashboard, fetchTeamRoster, resolveCurrentTeamContextId, accessToken],
  );

  return {
    // state
    teamFlowScreen,
    teamRosterMembers,
    teamRosterName,
    teamRosterError,
    teamRosterTeamId,
    teamProfileMemberId,
    teamMembershipMutationBusy,
    teamMembershipMutationNotice,
    teamInviteCodeBusy,
    teamInviteCodeNotice,
    teamInviteCodeValue,
    // derived
    teamRuntimeCandidateIds,
    teamRuntimeId,
    // actions / setters
    setTeamFlowScreen,
    setTeamRosterMembers,
    setTeamRosterName,
    setTeamRosterError,
    setTeamRosterTeamId,
    setTeamProfileMemberId,
    setTeamMembershipMutationBusy,
    setTeamMembershipMutationNotice,
    setTeamInviteCodeBusy,
    setTeamInviteCodeNotice,
    setTeamInviteCodeValue,
    fetchTeamRoster,
    resolveCurrentTeamContextId,
    createTeamInviteCode,
    leaveCurrentTeam,
    removeTeamMember,
    lastTeamRosterFetchAtRef,
  };
}

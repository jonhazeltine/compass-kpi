import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Session } from '@supabase/supabase-js';
import type {
  ChallengeFlowItem,
  ChallengeKpiGroups,
  ChannelApiRow,
  CoachingShellContext,
  CoachingShellEntrySource,
  DashboardPayload,
  TeamDirectoryMember,
  TeamFlowScreen,
  TeamFocusEditorFilter,
  TeamLeaderKpiStatusFilter,
} from '../../screens/kpi-dashboard/types';
import {
  fmtShortMonthDay,
  fmtShortMonthDayYear,
  fmtUsd,
  isApiBackedChallenge,
  isLightColor,
  normalizeChannelTypeToScope,
} from '../../screens/kpi-dashboard/helpers';
import { SELF_PROFILE_DRAWER_ID, UUID_LIKE_RE } from '../../screens/kpi-dashboard/constants';
import type { HudRailCardMetrics } from '../dashboard/HudRail';
import type { Segment } from '../../screens/kpi-dashboard/types';

// ── Types ───────────────────────────────────────────────────────────

export interface TeamTabProps {
  // Session
  session: Session | null;
  // Team identity
  teamIdentityAvatar: string;
  teamIdentityBackground: string;
  teamIdentityEditOpen: boolean;
  teamIdentityDraftName: string;
  teamIdentityDraftAvatar: string;
  teamIdentityDraftBackground: string;
  teamIdentityAvatarCategory: string;
  teamIdentitySaveBusy: boolean;
  teamIdentityControlsOpen: boolean;
  setTeamIdentityAvatarCategory: (v: import('../../hooks/useTeamIdentityEditor').TeamIdentityAvatarCategory) => void;
  setTeamIdentityControlsOpen: (v: boolean) => void;
  setTeamIdentityDraftAvatar: (v: string) => void;
  setTeamIdentityDraftBackground: (v: string) => void;
  setTeamIdentityDraftName: (v: string) => void;
  openTeamIdentityEditorFromHook: (name: string) => void;
  cancelTeamIdentityEditorFromHook: () => void;
  saveTeamIdentityEditsFromHook: (opts: { teamName: string; resolveTeamId: () => string | null; onNameSaved: (name: string) => void }) => Promise<void>;
  // Team roster / flow
  teamFlowScreen: TeamFlowScreen;
  teamRosterName: string | null;
  teamProfileMemberId: string | null;
  teamMemberDirectory: TeamDirectoryMember[];
  teamSurfaceKpis: DashboardPayload['loggable_kpis'];
  teamLeaderExpandedMemberId: string | null;
  teamChallengesSegment: 'active' | 'completed';
  teamFocusSelectedKpiIds: string[];
  teamFocusEditorOpen: boolean;
  teamFocusEditorFilter: TeamFocusEditorFilter;
  teamCommsHandoffError: string | null;
  teamMembershipMutationBusy: boolean;
  teamMembershipMutationNotice: string | null;
  teamInviteCodeBusy: boolean;
  teamInviteCodeNotice: string | null;
  teamTileCount: number;
  setTeamFlowScreen: React.Dispatch<React.SetStateAction<TeamFlowScreen>>;
  setTeamProfileMemberId: React.Dispatch<React.SetStateAction<string | null>>;
  setTeamRosterMembers: React.Dispatch<React.SetStateAction<import('../../screens/kpi-dashboard/types').TeamApiMemberSummary[]>>;
  setTeamRosterName: React.Dispatch<React.SetStateAction<string | null>>;
  setTeamLeaderExpandedMemberId: React.Dispatch<React.SetStateAction<string | null>>;
  setTeamChallengesSegment: React.Dispatch<React.SetStateAction<'active' | 'completed'>>;
  setTeamFocusSelectedKpiIds: React.Dispatch<React.SetStateAction<string[]>>;
  onSaveTeamFocusKpiIds?: (kpiIds: string[]) => void;
  setTeamFocusEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTeamFocusEditorFilter: React.Dispatch<React.SetStateAction<TeamFocusEditorFilter>>;
  setTeamCommsHandoffError: React.Dispatch<React.SetStateAction<string | null>>;
  // Challenges (subset used in team tab)
  challengeListItems: ChallengeFlowItem[];
  challengeScopedListItems: ChallengeFlowItem[];
  challengePreviewItem: ChallengeFlowItem | null;
  challengeKpiGroups: ChallengeKpiGroups;
  challengeJoinSubmittingId: string | null;
  setChallengeFlowScreen: React.Dispatch<React.SetStateAction<'explore' | 'list' | 'details' | 'leaderboard'>>;
  setChallengePreviewItem: React.Dispatch<React.SetStateAction<ChallengeFlowItem | null>>;
  setChallengeSelectedId: React.Dispatch<React.SetStateAction<string>>;
  joinChallenge: (id: string) => Promise<void>;
  // Comms
  channelsApiRows: ChannelApiRow[] | null;
  fetchChannels: () => Promise<ChannelApiRow[]>;
  fetchChannelMessages: (channelId: string) => Promise<void>;
  setCommsHubPrimaryTab: (tab: import('../../screens/kpi-dashboard/types').CommsHubPrimaryTab) => void;
  setCommsHubScopeFilter: (filter: import('../../screens/kpi-dashboard/types').CommsHubScopeFilter) => void;
  setCommsHubSearchQuery: (q: string) => void;
  setSelectedChannelId: (id: string | null) => void;
  setSelectedChannelName: (name: string | null) => void;
  setChannelMessageSubmitError: (err: string | null) => void;
  setChannelsError: (err: string | null) => void;
  setBroadcastError: (err: string | null) => void;
  // Coaching
  coachingShellContext: CoachingShellContext;
  openCoachingShell: (screen: import('../../screens/kpi-dashboard/types').CoachingShellScreen, contextPatch?: Partial<CoachingShellContext>) => void;
  // Navigation
  setActiveTab: (tab: import('../../screens/kpi-dashboard/types').BottomTab) => void;
  setViewMode: (mode: import('../../screens/kpi-dashboard/types').ViewMode) => void;
  handleOpenInviteCodeEntry: () => void;
  openChallengeWizard: (requestedKind?: import('../../screens/kpi-dashboard/types').ChallengeKind) => void;
  setChallengeWizardInviteUserIds: React.Dispatch<React.SetStateAction<string[]>>;
  // Team mutations
  removeTeamMember: (userId: string, name: string) => Promise<void>;
  leaveCurrentTeam: () => Promise<void>;
  createTeamInviteCode: () => Promise<void>;
  resolveCurrentTeamContextId: () => string | null;
  resolveTeamMemberUserId: (member: Pick<TeamDirectoryMember, 'name' | 'email' | 'userId'>) => Promise<string | null>;
  openDirectThreadForMember: (opts: { targetUserId: string; memberName: string; source: CoachingShellEntrySource; closeTeamProfile?: boolean }) => Promise<void>;
  selfProfileDrawerMember: TeamDirectoryMember | null;
  coachingClients?: Array<{ id: string; name: string; avatarUrl?: string | null; enrolledJourneyIds: string[]; enrolledJourneyNames?: string[] }>;
  // KPI / selector
  allSelectableKpis: DashboardPayload['loggable_kpis'];
  managedKpiIds: string[];
  favoriteKpiIds: string[];
  effectiveTeamPersonaVariant: 'leader' | 'member' | 'solo';
  pipelineAnchorCounts: { listings: number; buyers: number };
  // Render helpers
  renderChallengeKpiSection: (
    type: 'PC' | 'GP' | 'VP',
    title: string,
    kpis: DashboardPayload['loggable_kpis'],
    options?: { hideTypePill?: boolean; trailingControl?: React.ReactNode; compactIcons?: boolean }
  ) => React.ReactNode;
  renderKnownLimitedDataChip: (label: string) => React.ReactNode;
  // Card metrics (for team projected revenue)
  cardMetrics: HudRailCardMetrics;
}

function TeamInviteCodeCopyable({ notice }: { notice: string }) {
  const [copied, setCopied] = useState(false);
  const codeMatch = notice.match(/TEAM-[A-Z0-9-]+/);
  const code = codeMatch ? codeMatch[0] : null;
  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View style={teamInviteCopyStyles.wrap}>
      <Text style={teamInviteCopyStyles.notice}>{notice}</Text>
      {code ? (
        <TouchableOpacity style={teamInviteCopyStyles.copyBtn} onPress={handleCopy}>
          <Text style={teamInviteCopyStyles.copyBtnText}>{copied ? 'Copied!' : 'Copy Code'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const teamInviteCopyStyles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    gap: 8,
  },
  notice: {
    color: '#2f67da',
    fontSize: 13,
    fontWeight: '600',
  },
  copyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#2f67da',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  copyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default function TeamTab({
  session,
  teamIdentityAvatar,
  teamIdentityBackground,
  teamIdentityEditOpen,
  teamIdentityDraftName,
  teamIdentityDraftAvatar,
  teamIdentityDraftBackground,
  teamIdentityAvatarCategory,
  teamIdentitySaveBusy,
  teamIdentityControlsOpen,
  setTeamIdentityAvatarCategory,
  setTeamIdentityControlsOpen,
  setTeamIdentityDraftAvatar,
  setTeamIdentityDraftBackground,
  setTeamIdentityDraftName,
  openTeamIdentityEditorFromHook,
  cancelTeamIdentityEditorFromHook,
  saveTeamIdentityEditsFromHook,
  teamFlowScreen,
  teamRosterName,
  teamProfileMemberId,
  teamMemberDirectory,
  teamSurfaceKpis,
  teamLeaderExpandedMemberId,
  teamChallengesSegment,
  teamFocusSelectedKpiIds,
  teamFocusEditorOpen,
  teamFocusEditorFilter,
  teamCommsHandoffError,
  teamMembershipMutationBusy,
  teamMembershipMutationNotice,
  teamInviteCodeBusy,
  teamInviteCodeNotice,
  teamTileCount,
  setTeamFlowScreen,
  setTeamProfileMemberId,
  setTeamRosterMembers,
  setTeamRosterName,
  setTeamLeaderExpandedMemberId,
  setTeamChallengesSegment,
  setTeamFocusSelectedKpiIds,
  onSaveTeamFocusKpiIds,
  setTeamFocusEditorOpen,
  setTeamFocusEditorFilter,
  setTeamCommsHandoffError,
  challengeListItems,
  challengeScopedListItems,
  challengePreviewItem,
  challengeKpiGroups,
  challengeJoinSubmittingId,
  setChallengeFlowScreen,
  setChallengePreviewItem,
  setChallengeSelectedId,
  joinChallenge,
  channelsApiRows,
  fetchChannels,
  fetchChannelMessages,
  setCommsHubPrimaryTab,
  setCommsHubScopeFilter,
  setCommsHubSearchQuery,
  setSelectedChannelId,
  setSelectedChannelName,
  setChannelMessageSubmitError,
  setChannelsError,
  setBroadcastError,
  coachingShellContext,
  openCoachingShell,
  setActiveTab,
  setViewMode,
  handleOpenInviteCodeEntry,
  openChallengeWizard,
  setChallengeWizardInviteUserIds,
  removeTeamMember,
  leaveCurrentTeam,
  createTeamInviteCode,
  resolveCurrentTeamContextId,
  resolveTeamMemberUserId,
  openDirectThreadForMember,
  selfProfileDrawerMember,
  coachingClients,
  allSelectableKpis,
  managedKpiIds,
  favoriteKpiIds,
  effectiveTeamPersonaVariant,
  pipelineAnchorCounts,
  renderChallengeKpiSection,
  renderKnownLimitedDataChip,
  cardMetrics,
}: TeamTabProps) {
  return (
<View style={styles.challengeSurfaceWrap}>
  {(() => {
    const teamRouteMeta: Record<Exclude<TeamFlowScreen, 'dashboard'>, { title: string; figmaNode: string }> = {
      invite_member: { title: 'Invite Member', figmaNode: '173-4448' },
      pending_invitations: {
        title: effectiveTeamPersonaVariant === 'member' ? 'Pending Invites' : 'Pending Invitations',
        figmaNode: '173-4612',
      },
      kpi_settings: {
        title: effectiveTeamPersonaVariant === 'member' ? 'Team KPI Setting' : 'Team KPI Settings',
        figmaNode: '173-4531',
      },
      pipeline: { title: 'Pipeline', figmaNode: '168-16300' },
      team_challenges: {
        title: 'Team Challenges',
        figmaNode: effectiveTeamPersonaVariant === 'member' ? '389-21273' : '173-4905',
      },
    };

    const teamMembers = teamMemberDirectory;

    const teamInviteHistory: Array<{
      name: string;
      status: string;
      statusTone: 'pending' | 'joined' | 'declined';
      action: 'send' | 'check';
    }> = [];
    const teamPendingRows: Array<{
      name: string;
      email: string;
      sentAt: string;
      status: 'Pending' | 'Expired';
    }> = [];
    const teamKpiSettingRows: Array<{
      title: string;
      sub: string;
      enabled: boolean;
      tone: 'mint' | 'sand' | 'lavender' | 'rose' | 'locked';
      badge?: string;
    }> = teamSurfaceKpis.slice(0, 8).map((kpi) => ({
      title: kpi.name,
      sub: `${kpi.type} focus KPI`,
      enabled: teamFocusSelectedKpiIds.includes(String(kpi.id)),
      tone: kpi.type === 'PC' ? 'mint' : kpi.type === 'GP' ? 'sand' : 'lavender',
    }));
    const teamPipelineRows: Array<{ name: string; pending: number; current: number }> = [];
    const resolvedTeamContextId = String(resolveCurrentTeamContextId() ?? '').trim();
    const teamChallengeRows = challengeListItems.filter(
      (item) =>
        item.challengeKind === 'team' &&
        resolvedTeamContextId.length > 0 &&
        String(item.raw?.team_id ?? '').trim() === resolvedTeamContextId
    );
    const teamChallengeRowsForSurface = (() => {
      if (teamChallengeRows.length === 0) return [] as ChallengeFlowItem[];
      const toMs = (iso?: string | null) => {
        const ms = new Date(String(iso ?? '')).getTime();
        return Number.isFinite(ms) ? ms : null;
      };
      const nowMs = Date.now();
      const completed = [...teamChallengeRows]
        .filter((row) => row.bucket === 'completed')
        .sort((a, b) => (toMs(b.endAtIso) ?? 0) - (toMs(a.endAtIso) ?? 0))[0] ?? null;
      const active = [...teamChallengeRows]
        .filter((row) => row.bucket === 'active')
        .sort((a, b) => (toMs(a.startAtIso) ?? 0) - (toMs(b.startAtIso) ?? 0))[0] ?? null;
      const upcoming = [...teamChallengeRows]
        .filter((row) => row.bucket === 'upcoming')
        .filter((row) => {
          const start = toMs(row.startAtIso);
          if (start == null) return false;
          return start > nowMs;
        })
        .sort((a, b) => (toMs(a.startAtIso) ?? 0) - (toMs(b.startAtIso) ?? 0))[0] ?? null;
      const dedupe = new Set<string>();
      return [active, upcoming, completed].filter((row): row is ChallengeFlowItem => {
        if (!row) return false;
        if (dedupe.has(row.id)) return false;
        dedupe.add(row.id);
        return true;
      });
    })();
    const teamActiveChallengeCount = teamChallengeRowsForSurface.filter((item) => item.bucket !== 'completed').length;
    const teamMemberCount = Math.max(1, teamMembers.length);
    const teamChallengeActiveRows = teamChallengeRowsForSurface.filter(
      (item) => item.bucket === 'active' || item.bucket === 'upcoming'
    );
    const teamChallengeCompletedRows = teamChallengeRowsForSurface.filter((item) => item.bucket === 'completed');
    const teamChallengeVisibleRows =
      teamChallengesSegment === 'active' ? teamChallengeActiveRows : teamChallengeCompletedRows;
    const teamChallengeUpcoming = teamChallengeRowsForSurface.find((item) => item.bucket === 'upcoming') ?? null;
    const teamChallengePreviewKpis = [
      ...challengeKpiGroups.PC.slice(0, 2).map((kpi) => kpi.name),
      ...challengeKpiGroups.GP.slice(0, 2).map((kpi) => kpi.name),
      ...challengeKpiGroups.VP.slice(0, 2).map((kpi) => kpi.name),
    ].slice(0, 6);
    const openChallengeFlowFromTeam = (
      mode: 'list' | 'details' | 'leaderboard' = 'details',
      selectedChallengeId?: string
    ) => {
      const preferred =
        teamChallengeRowsForSurface.find((item) => item.id === selectedChallengeId) ??
        teamChallengeRowsForSurface.find((item) => item.bucket === 'active') ??
        teamChallengeRowsForSurface.find((item) => item.bucket === 'upcoming') ??
        teamChallengeRowsForSurface[0] ??
        challengeScopedListItems.find((item) => item.challengeKind !== 'team') ??
        challengeScopedListItems[0];
      if (preferred) setChallengeSelectedId(preferred.id);
      setChallengeFlowScreen(mode);
      setActiveTab('challenge');
    };
    const teamPrimaryChallenge =
      teamChallengeRowsForSurface.find((item) => item.bucket === 'active') ??
      teamChallengeRowsForSurface.find((item) => item.bucket === 'upcoming') ??
      teamChallengeRowsForSurface[0] ??
      null;
    const teamIdentityName = teamRosterName ?? 'Team';
    const openTeamCommsHandoff = (source: CoachingShellEntrySource) => {
      const resolveTeamChannel = (rows: ChannelApiRow[], currentTeamContextId: string | null) => {
        const teamChannelsBase = rows.filter((row) => normalizeChannelTypeToScope(row.type) === 'team');
        const teamChannelsAccessible = teamChannelsBase.filter((row) => row.is_active !== false);
        const teamChannels = teamChannelsAccessible.length > 0 ? teamChannelsAccessible : teamChannelsBase;
        if (currentTeamContextId) {
          return (
            teamChannels.find((row) => String(row.team_id ?? '').trim() === currentTeamContextId) ??
            teamChannels[0] ??
            null
          );
        }
        return teamChannels[0] ?? null;
      };

      void (async () => {
        setTeamCommsHandoffError(null);
        const currentTeamContextIdRaw =
          resolveCurrentTeamContextId() ??
          teamPrimaryChallenge?.raw?.team_id ??
          teamChallengeRowsForSurface.find((item) => item.raw?.team_id)?.raw?.team_id ??
          null;
        const currentTeamContextId = currentTeamContextIdRaw ? String(currentTeamContextIdRaw).trim() : null;
        let allChannelRows = Array.isArray(channelsApiRows) ? channelsApiRows : [];
        let resolvedTeamChannel = resolveTeamChannel(allChannelRows, currentTeamContextId);

        const shouldRefreshChannels =
          !Array.isArray(channelsApiRows) ||
          allChannelRows.length === 0 ||
          (currentTeamContextId != null && resolvedTeamChannel == null);
        if (shouldRefreshChannels) {
          allChannelRows = await fetchChannels();
          resolvedTeamChannel = resolveTeamChannel(allChannelRows, currentTeamContextId);
        }

        const resolvedTeamChannelName = String(resolvedTeamChannel?.name ?? 'Team Channel');
        const broadcastAudienceLabel =
          source === 'team_leader_dashboard'
            ? String(resolvedTeamChannel?.name ?? coachingShellContext.broadcastAudienceLabel ?? teamIdentityName)
            : null;

        setActiveTab('comms');
        setCommsHubPrimaryTab('channels');
        setCommsHubScopeFilter('team');
        setCommsHubSearchQuery('');
        setChannelMessageSubmitError(null);
        setBroadcastError(null);

        if (resolvedTeamChannel) {
          const resolvedTeamChannelId = String(resolvedTeamChannel.id);
          setSelectedChannelId(resolvedTeamChannelId);
          setSelectedChannelName(resolvedTeamChannelName);
          openCoachingShell('channel_thread', {
            source,
            preferredChannelScope: 'team',
            preferredChannelLabel: resolvedTeamChannelName,
            threadTitle: resolvedTeamChannelName,
            threadHeaderDisplayName: teamIdentityName,
            threadSub: 'Live team conversation.',
            broadcastAudienceLabel,
            broadcastRoleAllowed: source === 'team_leader_dashboard',
          });
          void fetchChannelMessages(resolvedTeamChannelId);
          return;
        }

        setSelectedChannelId(null);
        setSelectedChannelName(null);
        setTeamCommsHandoffError('Team channel unavailable. Contact admin to restore team chat.');
        openCoachingShell('inbox_channels', {
          source,
          preferredChannelScope: 'team',
          preferredChannelLabel: 'Team',
          threadTitle: null,
          threadHeaderDisplayName: null,
          threadSub: 'Team channel unavailable. Contact admin to restore team chat.',
          broadcastAudienceLabel,
          broadcastRoleAllowed: source === 'team_leader_dashboard',
        });
      })();
    };
    const teamFocusSelectedRows = teamSurfaceKpis.filter((kpi) => teamFocusSelectedKpiIds.includes(String(kpi.id)));
    const teamFocusKpisForDisplay = teamFocusSelectedRows.length > 0 ? teamFocusSelectedRows : teamSurfaceKpis.slice(0, 4);
    const teamMandatedKpiIdsOrdered = teamFocusKpisForDisplay.map((kpi) => String(kpi.id));
    const selectableById = new Map(allSelectableKpis.map((kpi) => [String(kpi.id), kpi] as const));
    const selectedPoolIds = Array.from(
      new Set([
        ...managedKpiIds.map((id) => String(id)),
        ...favoriteKpiIds.map((id) => String(id)),
        ...teamMandatedKpiIdsOrdered,
      ])
    ).filter((id) => selectableById.has(id));
    const parsePercent = (value: string) => {
      const normalized = Number(String(value).replace('%', '').trim());
      return Number.isFinite(normalized) ? normalized : 0;
    };
    const teamLeaderRows = teamMembers.map((member, idx) => {
      const basePct = parsePercent(member.metric);
      const kpis = {
        PC: Math.max(0, Math.min(100, basePct - (idx === 2 ? 12 : 4))),
        GP: Math.max(0, Math.min(100, basePct - (idx === 1 ? 10 : 6))),
        VP: Math.max(0, Math.min(100, basePct - (idx === 0 ? 8 : 14))),
      };
      const average = Math.round((kpis.PC + kpis.GP + kpis.VP) / 3);
      const status: TeamLeaderKpiStatusFilter =
        average >= 86 ? 'on_track' : average >= 72 ? 'watch' : 'at_risk';
      const concerns: string[] = [];
      if (kpis.PC < 75) concerns.push('Projection confidence trending low');
      if (kpis.GP < 72) concerns.push('Growth KPIs under target cadence');
      if (kpis.VP < 70) concerns.push('Vitality activity missing this cycle');
      const memberSelectedCandidateIds =
        selectedPoolIds.length > 0
          ? [
              selectedPoolIds[idx % selectedPoolIds.length],
              selectedPoolIds[(idx + 2) % selectedPoolIds.length],
              selectedPoolIds[(idx + 4) % selectedPoolIds.length],
              teamMandatedKpiIdsOrdered[idx % Math.max(1, teamMandatedKpiIdsOrdered.length)] ?? null,
            ]
              .filter((id): id is string => Boolean(id))
              .filter((id, itemIdx, arr) => arr.indexOf(id) === itemIdx)
          : [];
      return {
        id: member.id,
        name: member.name,
        sub: member.sub,
        metric: member.metric,
        kpis,
        average,
        status,
        concerns,
        memberSelectedCandidateIds,
      };
    });
    const teamOverallProgressPct =
      teamLeaderRows.length > 0
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(teamLeaderRows.reduce((sum, row) => sum + row.average, 0) / teamLeaderRows.length)
            )
          )
        : 0;
    const openTeamDirectThread = async (member: (typeof teamMembers)[number], source: CoachingShellEntrySource) => {
      const sessionUserId = String(session?.user?.id ?? '').trim();
      const resolvedTargetUserIdRaw = member.userId ?? (await resolveTeamMemberUserId(member));
      const resolvedTargetUserId =
        resolvedTargetUserIdRaw && UUID_LIKE_RE.test(String(resolvedTargetUserIdRaw))
          ? String(resolvedTargetUserIdRaw)
          : null;
      if (resolvedTargetUserId && sessionUserId && resolvedTargetUserId === sessionUserId) {
        Alert.alert('This is your profile', 'Open Messages to continue team chat, or select another teammate to start a direct message.');
        setActiveTab('comms');
        setCommsHubPrimaryTab('dms');
        setCommsHubSearchQuery('');
        openCoachingShell('inbox_channels', {
          source,
          preferredChannelScope: 'community',
          preferredChannelLabel: 'Direct Messages',
          threadTitle: null,
          threadHeaderDisplayName: null,
          threadSub: 'Select a teammate to start a direct message.',
          broadcastAudienceLabel: null,
          broadcastRoleAllowed: false,
        });
        return;
      }
      if (!resolvedTargetUserId) {
        const msg = `Member identity unavailable for ${member.name}. Refresh team roster and try again.`;
        Alert.alert('Messaging unavailable', msg);
        return;
      }
      try {
        await openDirectThreadForMember({
          targetUserId: resolvedTargetUserId,
          memberName: member.name,
          source,
          closeTeamProfile: true,
        });
      } catch (err) {
        const failureMessage = err instanceof Error ? err.message : `Unable to open direct thread with ${member.name}.`;
        setSelectedChannelId(null);
        setSelectedChannelName(null);
        setChannelsError(failureMessage);
        openCoachingShell('inbox_channels', {
          source,
          preferredChannelScope: 'community',
          preferredChannelLabel: member.name,
          threadTitle: null,
          threadHeaderDisplayName: null,
          threadSub: `Unable to open direct thread with ${member.name}.`,
          broadcastAudienceLabel: null,
          broadcastRoleAllowed: false,
        });
      }
    };
    const teamLeaderEscrowDeals = Math.max(0, Number(pipelineAnchorCounts.listings ?? 0) + Number(pipelineAnchorCounts.buyers ?? 0));
    const teamLeaderProjectedRevenue = Math.round(Math.max(0, Number(cardMetrics.projectedNext90 ?? 0)));
    const teamLeaderStatusCounts = teamLeaderRows.reduce(
      (acc, row) => {
        if (row.status === 'on_track') acc.onTrack += 1;
        else if (row.status === 'watch') acc.watch += 1;
        else acc.atRisk += 1;
        return acc;
      },
      { onTrack: 0, watch: 0, atRisk: 0 }
    );
    const teamLeaderHealthLabel =
      teamOverallProgressPct >= 86 ? 'Strong' : teamOverallProgressPct >= 72 ? 'Watch' : 'At Risk';
    const teamLeaderHealthLabelToneStyle =
      teamOverallProgressPct >= 86
        ? styles.teamLeaderHealthSummaryToneGood
        : teamOverallProgressPct >= 72
          ? styles.teamLeaderHealthSummaryToneWatch
          : styles.teamLeaderHealthSummaryToneRisk;
    const orderedKpiTypes: Segment[] = ['PC', 'GP', 'VP'];
    const teamFocusKpiGroups = {
      PC: teamFocusKpisForDisplay.filter((kpi) => kpi.type === 'PC'),
      GP: teamFocusKpisForDisplay.filter((kpi) => kpi.type === 'GP'),
      VP: teamFocusKpisForDisplay.filter((kpi) => kpi.type === 'VP'),
    };
    const teamAvatarCategories: Record<string, { label: string; emojis: string[] }> = {
      power: { label: 'Power', emojis: ['🏆', '🎯', '🚀', '⚡', '🔥', '💎', '👑', '⭐', '💪', '🌟', '✨', '🎖️'] },
      animals: { label: 'Animals', emojis: ['🦁', '🐺', '🦅', '🐉', '🦈', '🐝', '🦋', '🐬', '🦊', '🐻', '🦉', '🐘'] },
      nature: { label: 'Nature', emojis: ['🏔️', '🌊', '🌈', '🌸', '🍀', '🌻', '🌙', '☀️', '🌴', '🌵', '❄️', '🔮'] },
      sports: { label: 'Sports', emojis: ['⚽', '🏀', '🏈', '🎾', '🥊', '🏋️', '🚴', '🏄', '⛷️', '🏑', '🎳', '🏐'] },
      symbols: { label: 'Symbols', emojis: ['🛡️', '⚔️', '🧭', '🗺️', '🎪', '🎭', '🏴', '🔱', '⚓', '🪁', '🎬', '🎵'] },
    };
    const teamColorPalette = [
      // Row 1: Pastels / light
      '#fce4ec', '#f3e5f5', '#e8eaf6', '#e3f2fd', '#e0f7fa', '#e0f2f1',
      '#e8f5e9', '#f1f8e9', '#fffde7', '#fff8e1', '#fff3e0', '#fbe9e7',
      // Row 2: Vivid mid
      '#ef9a9a', '#ce93d8', '#9fa8da', '#90caf9', '#80deea', '#80cbc4',
      '#a5d6a7', '#c5e1a5', '#fff176', '#ffd54f', '#ffb74d', '#ff8a65',
      // Row 3: Rich saturated
      '#e53935', '#8e24aa', '#3949ab', '#1e88e5', '#00acc1', '#00897b',
      '#43a047', '#7cb342', '#fdd835', '#ffb300', '#fb8c00', '#f4511e',
      // Row 4: Deep / dark
      '#b71c1c', '#4a148c', '#1a237e', '#0d47a1', '#006064', '#004d40',
      '#1b5e20', '#33691e', '#f57f17', '#ff6f00', '#e65100', '#bf360c',
      // Row 5: Neutrals
      '#fafafa', '#f5f5f5', '#e0e0e0', '#bdbdbd', '#9e9e9e', '#757575',
      '#616161', '#424242', '#212121', '#263238', '#37474f', '#455a64',
    ];
    const currentCategoryEmojis = teamAvatarCategories[teamIdentityAvatarCategory]?.emojis ?? teamAvatarCategories.power.emojis;

    const openTeamIdentityEditor = () => {
      openTeamIdentityEditorFromHook(teamIdentityName);
    };
    const saveTeamIdentityEdits = () => {
      void saveTeamIdentityEditsFromHook({
        teamName: teamIdentityName,
        resolveTeamId: () => resolveCurrentTeamContextId(),
        onNameSaved: (name) => setTeamRosterName(name),
      });
    };
    const cancelTeamIdentityEdits = () => {
      cancelTeamIdentityEditorFromHook();
    };

      const teamIdentityCard = (
      <View style={[styles.teamIdentityCard, { backgroundColor: teamIdentityBackground }]}>
        {effectiveTeamPersonaVariant === 'leader' ? (
          <TouchableOpacity style={styles.teamIdentityEditIcon} onPress={openTeamIdentityEditor}>
            <Text style={styles.teamIdentityEditIconText}>✎</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.teamIdentityTopRow}>
          <View style={styles.teamIdentityIconCircle}>
            <Text style={styles.teamIdentityIconText}>{teamIdentityAvatar}</Text>
          </View>
          <View style={styles.teamIdentityCopy}>
            <Text style={styles.teamIdentityName}>{teamIdentityName}</Text>
            <Text style={styles.teamIdentitySub}>
              {teamMemberCount} Member{teamMemberCount === 1 ? '' : 's'} · {teamActiveChallengeCount} Active challenge{teamActiveChallengeCount === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.teamHeroStatsRow}>
          <View style={styles.teamHeroStat}>
            <View style={[styles.teamHeroStatDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.teamHeroStatValue}>{teamLeaderStatusCounts.onTrack}</Text>
            <Text style={styles.teamHeroStatLabel}>On Track</Text>
          </View>
          <View style={styles.teamHeroStat}>
            <View style={[styles.teamHeroStatDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.teamHeroStatValue}>{teamLeaderStatusCounts.watch}</Text>
            <Text style={styles.teamHeroStatLabel}>Watch</Text>
          </View>
          <View style={styles.teamHeroStat}>
            <View style={[styles.teamHeroStatDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.teamHeroStatValue}>{teamLeaderStatusCounts.atRisk}</Text>
            <Text style={styles.teamHeroStatLabel}>At Risk</Text>
          </View>
          <View style={[styles.teamHeroStat, styles.teamHeroStatHighlight]}>
            <Text style={[styles.teamHeroStatValue, { color: teamOverallProgressPct >= 86 ? '#16a34a' : teamOverallProgressPct >= 72 ? '#d97706' : '#dc2626' }]}>{teamOverallProgressPct}%</Text>
            <Text style={styles.teamHeroStatLabel}>Health</Text>
          </View>
        </View>

        <View style={styles.teamIdentityCardActions}>
          <TouchableOpacity
            style={styles.teamIdentityCardChatBtn}
            onPress={() =>
              openTeamCommsHandoff(
                effectiveTeamPersonaVariant === 'leader' ? 'team_leader_dashboard' : 'team_member_dashboard'
              )
            }
          >
            <Text style={styles.teamIdentityCardChatBtnText}>Team Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.teamIdentityCardDetailsBtn}
            onPress={() => setTeamIdentityControlsOpen(true)}
            disabled={teamMembershipMutationBusy}
          >
            <Text style={styles.teamIdentityCardDetailsBtnText}>⋯</Text>
          </TouchableOpacity>
        </View>
        <Modal
          visible={teamIdentityControlsOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setTeamIdentityControlsOpen(false)}
        >
          <Pressable style={styles.teamIdentityControlsOverlay} onPress={() => setTeamIdentityControlsOpen(false)}>
            <Pressable style={styles.teamIdentityControlsSheet} onPress={() => {}}>
              <View style={styles.teamIdentityControlsHandle} />
              <Text style={styles.teamIdentityControlsTitle}>Team Controls</Text>
              {effectiveTeamPersonaVariant === 'leader' ? (
                <>
                  <TouchableOpacity
                    style={styles.teamIdentityControlPrimaryBtn}
                    onPress={() => {
                      setTeamIdentityControlsOpen(false);
                      // Pre-load all team member user IDs as invitees
                      const memberUserIds = teamMemberDirectory
                        .filter((m) => m.userId && m.userId !== session?.user?.id)
                        .map((m) => m.userId!)
                        .filter(Boolean);
                      setChallengeWizardInviteUserIds(memberUserIds);
                      openChallengeWizard('team');
                    }}
                    disabled={teamMembershipMutationBusy || teamInviteCodeBusy}
                  >
                    <Text style={styles.teamIdentityControlPrimaryBtnText}>Set Team Challenge</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.teamIdentityControlSecondaryBtn}
                    onPress={() => {
                      setTeamIdentityControlsOpen(false);
                      setTeamFlowScreen('dashboard');
                      setTeamFocusEditorFilter('PC');
                      setTeamFocusEditorOpen(true);
                    }}
                    disabled={teamMembershipMutationBusy || teamInviteCodeBusy}
                  >
                    <Text style={styles.teamIdentityControlSecondaryBtnText}>Set Team KPIs</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.teamIdentityControlSecondaryBtn}
                    onPress={() => void createTeamInviteCode()}
                    disabled={teamMembershipMutationBusy || teamInviteCodeBusy}
                  >
                    <Text style={styles.teamIdentityControlSecondaryBtnText}>
                      {teamInviteCodeBusy ? 'Creating Invite…' : 'Create Team Invite Link'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.teamIdentityControlHint}>
                    Invite codes and member management live here to keep the team card clean.
                  </Text>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.teamIdentityControlDangerBtn, teamMembershipMutationBusy && styles.disabled]}
                    disabled={teamMembershipMutationBusy}
                    onPress={() =>
                      Alert.alert(
                        'Leave team?',
                        'You will be unenrolled from all team challenges and removed from team contribution metrics. Team custom KPI access may be lost unless you are on a qualifying paid plan.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Leave Team', style: 'destructive', onPress: () => void leaveCurrentTeam() },
                        ]
                      )
                    }
                  >
                    <Text style={styles.teamIdentityControlDangerBtnText}>
                      {teamMembershipMutationBusy ? 'Leaving…' : 'Leave Team'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.teamIdentityControlHint}>
                    Leaving removes team challenge enrollments and team-only contribution tracking.
                  </Text>
                </>
              )}
              {teamInviteCodeNotice ? (
                <TeamInviteCodeCopyable notice={teamInviteCodeNotice} />
              ) : null}
              {teamMembershipMutationNotice ? (
                <Text style={styles.teamIdentityCardInlineNotice}>{teamMembershipMutationNotice}</Text>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>
        {teamCommsHandoffError ? (
          <Text style={styles.teamIdentityCardInlineError}>{teamCommsHandoffError}</Text>
        ) : null}
        <Modal
          visible={teamIdentityEditOpen}
          transparent
          animationType="slide"
          onRequestClose={cancelTeamIdentityEdits}
        >
          <View style={styles.teamIdentityEditOverlay}>
            <View style={styles.teamIdentityEditSheet}>
              <View style={styles.teamIdentityEditSheetHandle} />
              <Text style={styles.teamIdentityEditSheetTitle}>Edit Team Identity</Text>

              <View style={[styles.teamIdentityEditPreview, { backgroundColor: teamIdentityDraftBackground }]}>
                <View style={styles.teamIdentityEditPreviewCircle}>
                  <Text style={styles.teamIdentityEditPreviewGlyph}>{teamIdentityDraftAvatar}</Text>
                </View>
                <Text style={styles.teamIdentityEditPreviewName}>{teamIdentityDraftName.trim() || teamIdentityName}</Text>
              </View>

              <ScrollView style={styles.teamIdentityEditScrollArea} showsVerticalScrollIndicator={false}>
                <Text style={styles.teamIdentityEditSectionLabel}>Team Name</Text>
                <TextInput
                  value={teamIdentityDraftName}
                  onChangeText={setTeamIdentityDraftName}
                  editable={!teamIdentitySaveBusy}
                  placeholder="Enter team name"
                  placeholderTextColor="#8290a9"
                  style={styles.teamIdentityEditNameInput}
                />
                <Text style={styles.teamIdentityEditSectionLabel}>Choose Avatar</Text>
                <View style={styles.teamIdentityEditCategoryRow}>
                  {Object.entries(teamAvatarCategories).map(([catKey, cat]) => {
                    const isActive = teamIdentityAvatarCategory === catKey;
                    return (
                      <TouchableOpacity
                        key={`avatar-cat-${catKey}`}
                        style={[styles.teamIdentityEditCategoryChip, isActive && styles.teamIdentityEditCategoryChipActive]}
                        onPress={() => setTeamIdentityAvatarCategory(catKey as import('../../hooks/useTeamIdentityEditor').TeamIdentityAvatarCategory)}
                      >
                        <Text style={[styles.teamIdentityEditCategoryChipText, isActive && styles.teamIdentityEditCategoryChipTextActive]}>{cat.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.teamIdentityEditAvatarGrid}>
                  {currentCategoryEmojis.map((emoji) => {
                    const isSelected = teamIdentityDraftAvatar === emoji;
                    return (
                      <TouchableOpacity
                        key={`av-${emoji}`}
                        style={[styles.teamIdentityEditAvatarCell, isSelected && styles.teamIdentityEditAvatarCellActive]}
                        onPress={() => setTeamIdentityDraftAvatar(emoji)}
                      >
                        <Text style={styles.teamIdentityEditAvatarEmoji}>{emoji}</Text>
                        {isSelected ? (
                          <View style={styles.teamIdentityEditChoiceCheck}>
                            <Text style={styles.teamIdentityEditChoiceCheckText}>✓</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.teamIdentityEditSectionLabel, { marginTop: 16 }]}>Background Color</Text>
                <View style={styles.teamIdentityEditColorGrid}>
                  {teamColorPalette.map((hex) => {
                    const isSelected = teamIdentityDraftBackground === hex;
                    return (
                      <TouchableOpacity
                        key={`clr-${hex}`}
                        style={[
                          styles.teamIdentityEditColorSwatch,
                          { backgroundColor: hex },
                          isSelected && styles.teamIdentityEditColorSwatchActive,
                        ]}
                        onPress={() => setTeamIdentityDraftBackground(hex)}
                      >
                        {isSelected ? (
                          <Text style={[
                            styles.teamIdentityEditColorSwatchCheck,
                            { color: isLightColor(hex) ? '#2a3140' : '#ffffff' },
                          ]}>✓</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.teamIdentityEditActions}>
                <TouchableOpacity
                  style={[styles.teamIdentityEditCancelBtn, teamIdentitySaveBusy && styles.disabled]}
                  onPress={cancelTeamIdentityEdits}
                  disabled={teamIdentitySaveBusy}
                >
                  <Text style={styles.teamIdentityEditCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.teamIdentityEditSaveBtn, teamIdentitySaveBusy && styles.disabled]}
                  onPress={() => void saveTeamIdentityEdits()}
                  disabled={teamIdentitySaveBusy}
                >
                  <Text style={styles.teamIdentityEditSaveBtnText}>
                    {teamIdentitySaveBusy ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );

    const teamLoggingBlock = (
      <View style={styles.challengeSectionsWrap}>
        {teamTileCount === 0 ? (
          <View style={styles.challengeEmptyCard}>
            <View style={[styles.challengeEmptyBadge, styles.teamHeaderBadge]}>
              <Text style={[styles.challengeEmptyBadgeText, styles.teamHeaderBadgeText]}>Team</Text>
            </View>
            <Text style={styles.challengeEmptyTitle}>No team KPIs available yet</Text>
            <Text style={styles.challengeEmptyText}>
              Your team KPIs will appear here once your team is set up.
            </Text>
            <TouchableOpacity
              style={styles.challengeEmptyCta}
              onPress={() => {
                setActiveTab('home');
                setViewMode('home');
              }}
            >
              <Text style={styles.challengeEmptyCtaText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.challengeSectionsWrap}>
            {renderChallengeKpiSection(
              'PC',
              "Team Focus KPI's",
              teamFocusKpiGroups.PC,
              {
                hideTypePill: true,
                compactIcons: true,
                trailingControl:
                  effectiveTeamPersonaVariant === 'leader' ? (
                    <TouchableOpacity
                      style={styles.teamFocusHeaderEditBtn}
                      onPress={() => setTeamFocusEditorOpen((prev) => !prev)}
                    >
                      <Text style={styles.teamFocusHeaderEditBtnText}>✎</Text>
                    </TouchableOpacity>
                  ) : null,
              }
            )}
            <Modal visible={teamFocusEditorOpen} transparent animationType="slide" onRequestClose={() => setTeamFocusEditorOpen(false)}>
              <Pressable style={styles.teamFocusDrawerBackdrop} onPress={() => setTeamFocusEditorOpen(false)}>
                <Pressable style={styles.teamFocusDrawerSheet} onPress={() => {}}>
                  <View style={styles.teamFocusDrawerHandle} />
                  <View style={styles.teamFocusDrawerHeader}>
                    <Text style={styles.teamFocusDrawerTitle}>Edit Focus KPIs</Text>
                    <TouchableOpacity style={styles.teamFocusDrawerCloseBtn} onPress={() => setTeamFocusEditorOpen(false)}>
                      <Text style={styles.teamFocusDrawerCloseBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.teamFocusDrawerSub}>Select which KPIs your team tracks on the dashboard.</Text>
                  <View style={styles.teamFocusDrawerFilterRow}>
                    {([
                      { key: 'PC', label: 'Projection' },
                      { key: 'GP', label: 'Business' },
                      { key: 'VP', label: 'Vitality' },
                    ] as const).map((chip) => {
                      const active = teamFocusEditorFilter === chip.key;
                      return (
                        <TouchableOpacity
                          key={`team-focus-filter-${chip.key}`}
                          style={[styles.teamFocusDrawerChip, active && styles.teamFocusDrawerChipActive]}
                          onPress={() => setTeamFocusEditorFilter(chip.key)}
                        >
                          <Text style={[styles.teamFocusDrawerChipText, active && styles.teamFocusDrawerChipTextActive]}>
                            {chip.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <ScrollView style={styles.teamFocusDrawerList} showsVerticalScrollIndicator={false}>
                    {(['PC', 'GP', 'VP'] as Segment[])
                      .filter((typeKey) => typeKey === teamFocusEditorFilter)
                      .map((typeKey) => {
                        const rows = teamSurfaceKpis
                          .filter((kpi) => kpi.type === typeKey)
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name));
                        if (rows.length === 0) {
                          return (
                            <Text key={`team-focus-empty-${typeKey}`} style={styles.teamFocusDrawerEmpty}>
                              No {typeKey === 'PC' ? 'Projection' : typeKey === 'GP' ? 'Business' : 'Vitality'} KPIs available.
                            </Text>
                          );
                        }
                        return rows.map((kpi) => {
                          const kpiId = String(kpi.id);
                          const selected = teamFocusSelectedKpiIds.includes(kpiId);
                          return (
                            <TouchableOpacity
                              key={`team-focus-editor-${kpiId}`}
                              style={[styles.teamFocusDrawerRow, selected && styles.teamFocusDrawerRowSelected]}
                              activeOpacity={0.6}
                              onPress={() => {
                                setTeamFocusSelectedKpiIds((prev) => {
                                  const next = prev.includes(kpiId) ? prev.filter((id) => id !== kpiId) : [...prev, kpiId];
                                  if (onSaveTeamFocusKpiIds) onSaveTeamFocusKpiIds(next);
                                  return next;
                                });
                              }}
                            >
                              <View style={[styles.teamFocusDrawerCheck, selected && styles.teamFocusDrawerCheckActive]}>
                                {selected ? <Text style={styles.teamFocusDrawerCheckMark}>✓</Text> : null}
                              </View>
                              <Text style={[styles.teamFocusDrawerRowName, selected && styles.teamFocusDrawerRowNameActive]}>{kpi.name}</Text>
                            </TouchableOpacity>
                          );
                        });
                      })}
                  </ScrollView>
                  <TouchableOpacity style={styles.teamFocusDrawerDoneBtn} onPress={() => setTeamFocusEditorOpen(false)}>
                    <Text style={styles.teamFocusDrawerDoneBtnText}>Done</Text>
                  </TouchableOpacity>
                </Pressable>
              </Pressable>
            </Modal>
            {renderChallengeKpiSection('GP', 'Team Focus Growth (GP)', teamFocusKpiGroups.GP)}
            {renderChallengeKpiSection('VP', 'Team Focus Vitality (VP)', teamFocusKpiGroups.VP)}
          </View>
        )}
      </View>
    );

    const renderTeamRouteScreen = (screen: Exclude<TeamFlowScreen, 'dashboard'>) => {
      const meta = teamRouteMeta[screen];
      return (
        <View style={styles.teamRouteScreenWrap}>
          <View style={styles.teamRouteScreenNavRow}>
            <TouchableOpacity style={styles.teamRouteScreenBackBtn} onPress={() => setTeamFlowScreen('dashboard')}>
              <Text style={styles.teamRouteScreenBackBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.teamRouteScreenNavTitle}>{meta.title}</Text>
            <View style={styles.teamRouteScreenNavSpacer} />
          </View>

          {screen === 'invite_member' ? (
            <>
              <View style={styles.teamRouteInfoBanner}>
                <Text style={styles.teamRouteInfoIcon}>i</Text>
                <Text style={styles.teamRouteInfoBannerText}>
                  Add teammates to your group by sending them an invite.
                </Text>
              </View>
              <Text style={styles.teamRouteFieldLabel}>Send Invite by Email or Username</Text>
              <View style={styles.teamRouteInlineInputRow}>
                <View style={styles.teamRouteInputGhost}>
                  <Text style={styles.teamRouteInputGhostText}>Enter friend's name or email</Text>
                </View>
                <TouchableOpacity style={styles.teamRouteSmallPrimaryBtn} onPress={() => setTeamFlowScreen('pending_invitations')}>
                  <Text style={styles.teamRouteSmallPrimaryBtnText}>Send</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.teamRouteFieldLabel}>Share Challenge Link</Text>
              <TouchableOpacity style={styles.teamRoutePrimaryBtn} onPress={() => setTeamFlowScreen('team_challenges')}>
                <Text style={styles.teamRoutePrimaryBtnText}>Copy Challenge Link</Text>
              </TouchableOpacity>
              <View style={styles.teamRouteSectionHeaderRow}>
                <Text style={styles.teamRouteSectionTitle}>Invite History</Text>
                <TouchableOpacity onPress={() => setTeamFlowScreen('pending_invitations')}>
                  <Text style={styles.teamRouteSectionLink}>View All</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.teamRouteStack}>
                {teamInviteHistory.map((row) => (
                  <View key={`${row.name}-${row.status}`} style={styles.teamRouteCardRow}>
                    <View style={styles.teamRouteAvatarCircle}>
                      <Text style={styles.teamRouteAvatarText}>
                        {row.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.teamRouteCardRowCopy}>
                      <Text style={styles.teamRouteCardRowTitle}>{row.name}</Text>
                      <Text style={styles.teamRouteCardRowSub}>{row.status}</Text>
                    </View>
                    <View style={styles.teamRouteTrailingActions}>
                      {row.action === 'send' ? (
                        <TouchableOpacity style={styles.teamRouteIconGhostBtn}>
                          <Text style={styles.teamRouteIconGhostBtnText}>↗</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={styles.teamRouteIconGhostBtn}>
                          <Text style={styles.teamRouteIconGhostBtnText}>✓</Text>
                        </TouchableOpacity>
                      )}
                      {row.statusTone === 'pending' ? (
                        <TouchableOpacity style={styles.teamRouteIconGhostBtn}>
                          <Text style={styles.teamRouteIconGhostBtnText}>×</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {screen === 'pending_invitations' ? (
            <>
              <View style={styles.teamRouteInfoBanner}>
                <Text style={styles.teamRouteInfoIcon}>i</Text>
                <Text style={styles.teamRouteInfoBannerText}>
                  Manage pending invites or approve join requests from new members.
                </Text>
              </View>
              <View style={styles.teamRouteStack}>
                {teamPendingRows.map((row) => (
                  <View key={`${row.name}-${row.status}`} style={styles.teamRoutePendingCard}>
                    <View style={styles.teamRoutePendingTopRow}>
                      <View style={styles.teamRouteAvatarCircle}>
                        <Text style={styles.teamRouteAvatarText}>
                          {row.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.teamRouteCardRowCopy}>
                        <Text style={styles.teamRouteCardRowTitle}>{row.name}</Text>
                        <Text style={styles.teamRouteCardRowSub}>{row.email}</Text>
                        <Text style={styles.teamRouteCardRowSub}>{row.sentAt}</Text>
                      </View>
                      <View
                        style={[
                          styles.teamRouteStatusBadge,
                          row.status === 'Pending' ? styles.teamRouteStatusBadgePending : styles.teamRouteStatusBadgeExpired,
                        ]}
                      >
                        <Text
                          style={[
                            styles.teamRouteStatusBadgeText,
                            row.status === 'Pending' ? styles.teamRouteStatusBadgeTextPending : styles.teamRouteStatusBadgeTextExpired,
                          ]}
                        >
                          {row.status}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.teamRouteInlineButtonsRow}>
                      <TouchableOpacity style={styles.teamRouteSmallPrimaryBtn}>
                        <Text style={styles.teamRouteSmallPrimaryBtnText}>Resend</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.teamRouteSmallSecondaryBtn}>
                        <Text style={styles.teamRouteSmallSecondaryBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.teamRoutePrimaryBtn} onPress={() => setTeamFlowScreen('dashboard')}>
                <Text style={styles.teamRoutePrimaryBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {screen === 'kpi_settings' ? (
            <>
              <View style={styles.teamRouteInfoBanner}>
                <Text style={styles.teamRouteInfoIcon}>i</Text>
                <Text style={styles.teamRouteInfoBannerText}>
                  Select the KPIs your team will be required to track. These KPIs will appear on every member's dashboard.
                </Text>
              </View>
              <View style={styles.teamRouteStack}>
                {teamKpiSettingRows.map((row, idx) => (
                  <View key={row.title} style={[styles.teamRouteKpiRow, idx > 0 && styles.teamRouteKpiRowDivider]}>
                    <View
                      style={[
                        styles.teamRouteKpiIconWrap,
                        row.tone === 'mint'
                          ? styles.teamRouteKpiIconMint
                          : row.tone === 'sand'
                            ? styles.teamRouteKpiIconSand
                            : row.tone === 'lavender'
                              ? styles.teamRouteKpiIconLavender
                              : row.tone === 'rose'
                                ? styles.teamRouteKpiIconRose
                                : styles.teamRouteKpiIconGray,
                      ]}
                    >
                      <Text style={styles.teamRouteKpiIconText}>
                        {row.tone === 'locked' ? '🔒' : row.tone === 'mint' ? '🎧' : row.tone === 'sand' ? '📖' : row.tone === 'lavender' ? '🤝' : '🏠'}
                      </Text>
                    </View>
                    <View style={styles.teamRouteCardRowCopy}>
                      <Text style={[styles.teamRouteCardRowTitle, row.tone === 'locked' && styles.teamRouteMutedText]}>{row.title}</Text>
                      <Text style={[styles.teamRouteCardRowSub, row.tone === 'locked' && styles.teamRouteMutedText]}>{row.sub}</Text>
                    </View>
                    {row.badge ? (
                      <View style={styles.teamRouteProBadge}>
                        <Text style={styles.teamRouteProBadgeText}>{row.badge}</Text>
                      </View>
                    ) : (
                      <View style={[styles.teamRouteToggle, row.enabled && styles.teamRouteToggleOn]}>
                        <View style={[styles.teamRouteToggleKnob, row.enabled && styles.teamRouteToggleKnobOn]} />
                      </View>
                    )}
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.teamRoutePrimaryBtn} onPress={() => setTeamFlowScreen('dashboard')}>
                <Text style={styles.teamRoutePrimaryBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {screen === 'pipeline' ? (
            <>
              <View style={[styles.teamRouteInfoBanner, styles.teamRouteInfoBannerLavender]}>
                <Text style={styles.teamRouteInfoIcon}>⚡</Text>
                <View style={styles.teamRouteCardRowCopy}>
                  <Text style={styles.teamRouteCardRowTitle}>14 Pending Deals</Text>
                  <Text style={styles.teamRouteCardRowSub}>Team Deal Closed</Text>
                </View>
              </View>
              <View style={styles.teamRouteStack}>
                {teamPipelineRows.map((row) => (
                  <View key={row.name} style={styles.teamRouteCardRow}>
                    <View style={styles.teamRouteAvatarCircle}>
                      <Text style={styles.teamRouteAvatarText}>
                        {row.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.teamRouteCardRowCopy}>
                      <Text style={styles.teamRouteCardRowTitle}>{row.name}</Text>
                      <Text style={styles.teamRouteCardRowSub}>{row.pending} Deals Pending</Text>
                      <Text style={styles.teamRouteCardRowSub}>{row.current} Current Deals</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {screen === 'team_challenges' ? (
            <>
              <View style={styles.teamChallengesHeroCard}>
                <View style={styles.teamChallengesHeroTopRow}>
                  <View style={styles.teamChallengesUpcomingIcon}>
                    <Text style={styles.teamChallengesUpcomingIconText}>🏁</Text>
                  </View>
                  <View style={styles.teamChallengesHeroCopy}>
                    <Text style={styles.teamChallengesHeroTitle}>Team Challenges</Text>
                    <Text style={styles.teamChallengesHeroSub}>
                      {teamChallengeUpcoming
                        ? `Upcoming starts ${fmtShortMonthDayYear(teamChallengeUpcoming.startAtIso)}`
                        : 'Track active and completed team challenges.'}
                    </Text>
                  </View>
                  <Text style={styles.teamChallengesUpcomingDate}>
                    {teamChallengeUpcoming ? fmtShortMonthDay(teamChallengeUpcoming.startAtIso) : 'No date'}
                  </Text>
                </View>
                <View style={styles.teamChallengesHeroStatsRow}>
                  <View style={[styles.teamChallengesStatCard, styles.teamParityStatCardGreen]}>
                    <Text style={styles.teamParityStatTitle}>Active</Text>
                    <Text style={styles.teamParityStatValue}>{String(teamChallengeActiveRows.length).padStart(2, '0')}</Text>
                    <Text style={styles.teamParityStatFoot}>Challenges</Text>
                  </View>
                  <View style={[styles.teamChallengesStatCard, styles.teamParityStatCardPurple]}>
                    <Text style={styles.teamParityStatTitle}>Completed</Text>
                    <Text style={styles.teamParityStatValue}>{String(teamChallengeCompletedRows.length).padStart(2, '0')}</Text>
                    <Text style={styles.teamParityStatFoot}>Challenges</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.teamChallengesCreateBtn} onPress={() => openChallengeFlowFromTeam('list')}>
                  <Text style={styles.teamChallengesCreateBtnText}>Open Full Challenge Hub</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.teamChallengesSegmentRow}>
                <TouchableOpacity
                  style={[styles.teamChallengesSegmentPill, teamChallengesSegment === 'active' && styles.teamChallengesSegmentPillActive]}
                  onPress={() => setTeamChallengesSegment('active')}
                >
                  <Text
                    style={[
                      styles.teamChallengesSegmentPillText,
                      teamChallengesSegment === 'active' && styles.teamChallengesSegmentPillTextActive,
                    ]}
                  >
                    Active
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.teamChallengesSegmentPill, teamChallengesSegment === 'completed' && styles.teamChallengesSegmentPillActive]}
                  onPress={() => setTeamChallengesSegment('completed')}
                >
                  <Text
                    style={[
                      styles.teamChallengesSegmentPillText,
                      teamChallengesSegment === 'completed' && styles.teamChallengesSegmentPillTextActive,
                    ]}
                  >
                    Completed
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.teamRouteStack}>
                {teamChallengeVisibleRows.length === 0 ? (
                  <View style={styles.teamChallengesEmptyCard}>
                    <Text style={styles.teamChallengesEmptyTitle}>No challenges in this state</Text>
                    <Text style={styles.teamChallengesEmptySub}>
                      {teamChallengesSegment === 'active'
                        ? 'Switch to Completed or open the challenge hub to create/join.'
                        : 'Completed team challenges will appear here.'}
                    </Text>
                  </View>
                ) : (
                  teamChallengeVisibleRows.map((row) => (
                    <TouchableOpacity
                      key={row.id}
                      style={styles.teamChallengesCard}
                      onPress={() => {
                        if (row.joined) {
                          openChallengeFlowFromTeam('details', row.id);
                          return;
                        }
                        setChallengePreviewItem(row);
                      }}
                    >
                      <View style={styles.teamChallengesCardTopRow}>
                        <View style={styles.teamRouteCardRowCopy}>
                          <Text style={styles.teamRouteCardRowTitle}>{row.title}</Text>
                          <Text numberOfLines={1} style={styles.teamRouteCardRowSub}>{row.subtitle}</Text>
                        </View>
                        <View
                          style={[
                            styles.teamChallengesActiveBadge,
                            row.bucket === 'completed' && styles.teamChallengesCompletedBadge,
                            row.bucket === 'upcoming' && styles.teamChallengesUpcomingBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.teamChallengesActiveBadgeText,
                              row.bucket === 'completed' && styles.teamChallengesCompletedBadgeText,
                              row.bucket === 'upcoming' && styles.teamChallengesUpcomingBadgeText,
                            ]}
                          >
                            {row.status}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.teamChallengesCardMetaRow}>
                        <Text style={styles.teamChallengesMetaStrong}>{row.timeframe}</Text>
                        <Text style={styles.teamRouteCardRowSub}>{row.daysLabel}</Text>
                      </View>
                      <View style={styles.teamChallengesProgressTrack}>
                        <View style={[styles.teamChallengesProgressFill, { width: `${Math.min(100, Math.max(0, row.progressPct))}%` }]} />
                      </View>
                      <Text style={styles.teamRouteCardRowSub}>Progress: {row.progressPct}%</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
              <Modal
                visible={challengePreviewItem !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setChallengePreviewItem(null)}
              >
                <Pressable style={styles.challengeDrawerBackdrop} onPress={() => setChallengePreviewItem(null)}>
                  <Pressable style={styles.challengeDrawerSheet} onPress={() => {}}>
                    <View style={styles.challengeDrawerHandle} />
                    {challengePreviewItem ? (
                      <>
                        <Text style={styles.challengeDrawerTitle}>{challengePreviewItem.title}</Text>
                        <Text style={styles.challengeDrawerSub}>{challengePreviewItem.subtitle}</Text>
                        <View style={styles.challengeDrawerMetaRow}>
                          <Text style={styles.challengeDrawerMetaText}>📅 {challengePreviewItem.timeframe}</Text>
                          <Text style={styles.challengeDrawerMetaText}>{challengePreviewItem.daysLabel}</Text>
                        </View>
                        <View style={styles.challengeDrawerDivider} />
                        <Text style={styles.challengeDrawerSectionTitle}>KPIs Tracked</Text>
                        <View style={styles.teamChallengesDrawerKpiList}>
                          {teamChallengePreviewKpis.length > 0 ? (
                            teamChallengePreviewKpis.map((kpiName) => (
                              <View key={`team-drawer-kpi-${kpiName}`} style={styles.teamChallengesDrawerKpiChip}>
                                <Text style={styles.teamChallengesDrawerKpiChipText}>{kpiName}</Text>
                              </View>
                            ))
                          ) : (
                            <View style={styles.teamChallengesDrawerKpiChip}>
                              <Text style={styles.teamChallengesDrawerKpiChipText}>KPI list available on live challenge data</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.challengeDrawerDivider} />
                        <View style={styles.challengeDrawerFootRow}>
                          <Text style={styles.challengeDrawerFootMeta}>
                            {challengePreviewItem.participants} participant
                            {challengePreviewItem.participants === 1 ? '' : 's'} · {challengePreviewItem.challengeModeLabel}
                          </Text>
                        </View>
                        {isApiBackedChallenge(challengePreviewItem) &&
                        !challengePreviewItem.joined &&
                        challengePreviewItem.bucket !== 'completed' ? (
                          <TouchableOpacity
                            style={[
                              styles.challengeDrawerJoinBtn,
                              challengeJoinSubmittingId === challengePreviewItem.id && styles.disabled,
                            ]}
                            disabled={challengeJoinSubmittingId === challengePreviewItem.id}
                            onPress={() => {
                              void joinChallenge(challengePreviewItem.id);
                              setChallengePreviewItem(null);
                            }}
                          >
                            <Text style={styles.challengeDrawerJoinBtnText}>
                              {challengeJoinSubmittingId === challengePreviewItem.id ? 'Joining…' : 'Join Challenge'}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.challengeDrawerViewBtn}
                            onPress={() => {
                              openChallengeFlowFromTeam('details', challengePreviewItem.id);
                              setChallengePreviewItem(null);
                            }}
                          >
                            <Text style={styles.challengeDrawerViewBtnText}>View Details</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    ) : null}
                  </Pressable>
                </Pressable>
              </Modal>
            </>
          ) : null}
        </View>
      );
    };

    if (teamFlowScreen !== 'dashboard') {
      return renderTeamRouteScreen(teamFlowScreen);
    }

    // ── No-team empty state ──
    if (teamMemberDirectory.length === 0 && !teamRosterName) {
      return (
        <View style={styles.noTeamWrap}>
          <View style={styles.noTeamHero}>
            <Text style={styles.noTeamEmoji}>🏟️</Text>
            <Text style={styles.noTeamTitle}>Build Your Team</Text>
            <Text style={styles.noTeamSub}>
              Create a team to track KPIs together, run team challenges, and keep everyone accountable.
            </Text>
          </View>
          <View style={styles.noTeamFeatures}>
            {[
              { icon: '📊', label: 'Shared KPI tracking', sub: 'Set focus KPIs your whole team logs daily' },
              { icon: '🏆', label: 'Team challenges', sub: 'Compete together with leaderboards and goals' },
              { icon: '💬', label: 'Team chat', sub: 'Built-in messaging for your whole roster' },
              { icon: '📈', label: 'Health dashboard', sub: 'See who\'s on track, who needs support' },
            ].map((f) => (
              <View key={f.label} style={styles.noTeamFeatureRow}>
                <Text style={styles.noTeamFeatureIcon}>{f.icon}</Text>
                <View style={styles.noTeamFeatureCopy}>
                  <Text style={styles.noTeamFeatureLabel}>{f.label}</Text>
                  <Text style={styles.noTeamFeatureSub}>{f.sub}</Text>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.noTeamCtaBtn} onPress={handleOpenInviteCodeEntry}>
            <Text style={styles.noTeamCtaBtnText}>Join a Team with Invite Code</Text>
          </TouchableOpacity>
          <Text style={styles.noTeamCtaHint}>
            Team creation requires a Teams subscription. Ask your team leader for an invite code to join an existing team.
          </Text>
        </View>
      );
    }

    return (
      <>
        {effectiveTeamPersonaVariant === 'member' ? (
          <View style={styles.teamMemberDashboardWrap}>
            {teamIdentityCard}

            <TouchableOpacity style={styles.teamMemberChallengeCard} activeOpacity={0.92} onPress={() => openChallengeFlowFromTeam('details')}>
              <View style={styles.teamMemberChallengeTopRow}>
                <Text style={styles.teamMemberChallengeLabel}>Active Challenge</Text>
                <Text style={styles.teamMemberChallengeLink}>Open</Text>
              </View>
              <Text style={styles.teamMemberChallengeTitle}>{teamPrimaryChallenge?.title ?? 'Team Challenge'}</Text>
              <Text style={styles.teamMemberChallengeSub}>
                {teamPrimaryChallenge?.daysLabel ?? 'Open team challenge details and leaderboard.'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.teamMemberSectionLabel}>Team Members</Text>
            <View style={styles.teamLeaderExpandableList}>
              {teamLeaderRows.map((row) => (
                <View key={`member-card-${row.id}`} style={styles.teamLeaderMemberCard}>
                  <View style={styles.teamLeaderMemberHeader}>
                    <TouchableOpacity
                      style={styles.teamParityMemberAvatar}
                      onPress={() => setTeamProfileMemberId(row.id)}
                    >
                      <Text style={styles.teamParityMemberAvatarText}>
                        {row.name
                          .split(' ')
                          .map((part) => part[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.teamParityMemberCopy}>
                      <Text style={styles.teamParityMemberName}>{row.name}</Text>
                      <Text style={styles.teamParityMemberSub}>{row.sub}</Text>
                    </View>
                    <TouchableOpacity style={styles.teamProfileLinkBtn} onPress={() => setTeamProfileMemberId(row.id)}>
                      <Text style={styles.teamProfileLinkBtnText}>Profile</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
            {teamLoggingBlock}
          </View>
        ) : (
          <View style={styles.teamLeaderOpsWrap}>
            {teamIdentityCard}
            <View style={styles.teamLeaderOpsHeader}>
              <Text style={styles.teamParityNavTitle}>Team Leader Ops</Text>
              {renderKnownLimitedDataChip('member KPI contracts')}
            </View>

            <View style={styles.teamLeaderTotalsRow}>
              <TouchableOpacity style={[styles.teamParityStatCard, styles.teamParityStatCardGreen]} onPress={() => setTeamFlowScreen('pipeline')}>
                <Text style={styles.teamParityStatTitle}>Deals in Escrow</Text>
                <Text style={styles.teamParityStatValue}>{teamLeaderEscrowDeals}</Text>
                <Text style={styles.teamParityStatFoot}>Open pipeline deals</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.teamParityStatCard, styles.teamParityStatCardPurple]} onPress={() => openChallengeFlowFromTeam('details')}>
                <Text style={styles.teamParityStatTitle}>Projected Revenue</Text>
                <Text style={styles.teamParityStatValue}>{fmtUsd(teamLeaderProjectedRevenue)}</Text>
                <Text style={styles.teamParityStatFoot}>Next 90 days</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.teamLeaderHealthSummaryCard}>
              <View style={styles.teamLeaderHealthSummaryHeaderRow}>
                <Text style={styles.teamLeaderHealthSummaryTitle}>Team Health Summary</Text>
                <View style={[styles.teamLeaderHealthSummaryToneChip, teamLeaderHealthLabelToneStyle]}>
                  <Text style={styles.teamLeaderHealthSummaryToneText}>{teamLeaderHealthLabel}</Text>
                </View>
              </View>
              <Text style={styles.teamLeaderHealthSummarySub}>
                At-a-glance team KPI health before member-level drilldown.
              </Text>
              <View style={styles.teamHealthMeterRow}>
                <View style={styles.teamHealthMeterTrack}>
                  <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentRed]} />
                  <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentOrange]} />
                  <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentYellow]} />
                  <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentGreen]} />
                  <View
                    style={[
                      styles.teamHealthMeterRemainingMask,
                      { left: `${Math.max(0, Math.min(100, teamOverallProgressPct))}%` },
                    ]}
                  />
                </View>
                <Text style={styles.teamHealthMeterPercentText}>{teamOverallProgressPct}%</Text>
              </View>
              <View style={styles.teamLeaderHealthSummaryStatsRow}>
                <View style={[styles.teamLeaderHealthSummaryStatChip, styles.teamLeaderHealthSummaryStatChipGood]}>
                  <Text style={styles.teamLeaderHealthSummaryStatText}>On Track {teamLeaderStatusCounts.onTrack}</Text>
                </View>
                <View style={[styles.teamLeaderHealthSummaryStatChip, styles.teamLeaderHealthSummaryStatChipWatch]}>
                  <Text style={styles.teamLeaderHealthSummaryStatText}>Watch {teamLeaderStatusCounts.watch}</Text>
                </View>
                <View style={[styles.teamLeaderHealthSummaryStatChip, styles.teamLeaderHealthSummaryStatChipRisk]}>
                  <Text style={styles.teamLeaderHealthSummaryStatText}>At Risk {teamLeaderStatusCounts.atRisk}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.teamMemberSectionLabel}>Team Members</Text>

            <View style={styles.teamLeaderExpandableList}>
              {teamLeaderRows.map((row) => {
                const isExpanded = teamLeaderExpandedMemberId === row.id;
                return (
                  <View key={row.id} style={styles.teamLeaderMemberCard}>
                    <View style={styles.teamLeaderMemberHeader}>
                      <TouchableOpacity
                        style={styles.teamParityMemberAvatar}
                        onPress={() => setTeamProfileMemberId(row.id)}
                      >
                        <Text style={styles.teamParityMemberAvatarText}>
                          {row.name
                            .split(' ')
                            .map((part) => part[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.teamParityMemberCopy}>
                        <Text style={styles.teamParityMemberName}>{row.name}</Text>
                        <Text style={styles.teamParityMemberSub}>{row.sub}</Text>
                        <View style={styles.teamHealthMeterRow}>
                          <View style={styles.teamHealthMeterTrack}>
                            <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentRed]} />
                            <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentOrange]} />
                            <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentYellow]} />
                            <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentGreen]} />
                            <View
                              style={[
                                styles.teamHealthMeterRemainingMask,
                                { left: `${Math.max(0, Math.min(100, row.average))}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.teamHealthMeterPercentText}>{row.average}%</Text>
                        </View>
                      </View>
                      <Text style={styles.teamLeaderMemberStatus}>{row.status.replace('_', ' ')}</Text>
                      <TouchableOpacity
                        style={styles.teamLeaderRowExpandBtn}
                        onPress={() => setTeamLeaderExpandedMemberId(isExpanded ? null : row.id)}
                      >
                        <Text style={styles.teamLeaderRowExpandBtnText}>{isExpanded ? '−' : '+'}</Text>
                      </TouchableOpacity>
                    </View>
                    {isExpanded ? (
                      <View style={styles.teamLeaderMemberExpandedBody}>
                        <Text style={styles.teamLeaderExpandedKpiRow}>
                          Average KPI Health: {row.average}% (PC {row.kpis.PC}% • GP {row.kpis.GP}% • VP {row.kpis.VP}%)
                        </Text>
                        {(() => {
                          const teamMandatedSet = new Set(teamMandatedKpiIdsOrdered);
                          const memberSelectedSet = new Set(
                            row.memberSelectedCandidateIds.filter((id) => selectableById.has(id))
                          );
                          const personalOnlyIds = row.memberSelectedCandidateIds.filter(
                            (id, idx, arr) =>
                              !teamMandatedSet.has(id) &&
                              arr.indexOf(id) === idx &&
                              selectableById.has(id)
                          );
                          const resolveOrderedKpis = (ids: string[]) =>
                            ids
                              .map((id) => selectableById.get(id))
                              .filter((kpi): kpi is DashboardPayload['loggable_kpis'][number] => kpi != null)
                              .filter((kpi) => kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP');
                          const orderByTypeAndName = (ids: string[]) => {
                            const resolved = resolveOrderedKpis(ids);
                            return orderedKpiTypes.flatMap((typeKey) =>
                              resolved
                                .filter((kpi) => kpi.type === typeKey)
                                .sort((a, b) => a.name.localeCompare(b.name))
                            );
                          };
                          // active = ordered(team_mandated_kpis) + ordered(user_selected_kpis - team_mandated_kpis)
                          const teamFocusActive = orderByTypeAndName(teamMandatedKpiIdsOrdered);
                          const personalActive = orderByTypeAndName(personalOnlyIds);
                          const renderBlock = (
                            blockLabel: 'Team Focus' | 'Personal',
                            rows: DashboardPayload['loggable_kpis'],
                            options?: { overlapSet?: Set<string> }
                          ) => (
                            <View style={styles.teamLeaderKpiBlock}>
                              <Text style={styles.teamLeaderKpiBlockLabel}>{blockLabel}</Text>
                              {orderedKpiTypes.map((typeKey) => {
                                const kpisForType = rows.filter((kpi) => kpi.type === typeKey);
                                if (kpisForType.length === 0) return null;
                                return (
                                  <View key={`${row.id}-${blockLabel}-${typeKey}`} style={styles.teamLeaderKpiTypeSection}>
                                    <Text style={styles.teamLeaderKpiTypeSectionTitle}>
                                      {typeKey === 'PC'
                                        ? 'Projection (PC)'
                                        : typeKey === 'GP'
                                          ? 'Growth (GP)'
                                          : 'Vitality (VP)'}
                                    </Text>
                                    {kpisForType.map((kpi) => {
                                      const kpiId = String(kpi.id);
                                      const isFocused = teamMandatedSet.has(kpiId);
                                      const alsoPersonal = Boolean(options?.overlapSet?.has(kpiId));
                                      const kpiTypeBase =
                                        typeKey === 'PC' ? row.kpis.PC : typeKey === 'GP' ? row.kpis.GP : row.kpis.VP;
                                      const kpiVariance =
                                        (kpiId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 9) - 4;
                                      const kpiProgress = Math.max(0, Math.min(100, Math.round(kpiTypeBase + kpiVariance)));
                                      return (
                                        <View
                                          key={`${row.id}-${blockLabel}-${kpiId}`}
                                          style={styles.teamLeaderKpiSelectionRow}
                                        >
                                          <View style={styles.teamLeaderKpiSelectionRowCopy}>
                                            <Text style={styles.teamLeaderKpiSelectionName}>{kpi.name}</Text>
                                            <Text style={styles.teamLeaderKpiSelectionSub}>👥 Team context</Text>
                                            <View style={styles.teamKpiMiniMeterRow}>
                                              <View style={styles.teamHealthMeterTrack}>
                                                <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentRed]} />
                                                <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentOrange]} />
                                                <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentYellow]} />
                                                <View style={[styles.teamHealthMeterSegment, styles.teamHealthMeterSegmentGreen]} />
                                                <View
                                                  style={[
                                                    styles.teamHealthMeterRemainingMask,
                                                    { left: `${kpiProgress}%` },
                                                  ]}
                                                />
                                              </View>
                                              <Text style={styles.teamHealthMeterPercentText}>{kpiProgress}%</Text>
                                            </View>
                                          </View>
                                          <View style={styles.teamLeaderKpiSelectionRowRight}>
                                            <Text
                                              style={
                                                isFocused
                                                  ? styles.teamLeaderKpiSelectionSelectedText
                                                  : styles.teamLeaderKpiSelectionUnselectedText
                                              }
                                            >
                                              {isFocused ? 'Focused' : 'Tracked'}
                                            </Text>
                                            {alsoPersonal ? (
                                              <View style={styles.teamLeaderOverlapChip}>
                                                <Text style={styles.teamLeaderOverlapChipText}>also personal</Text>
                                              </View>
                                            ) : null}
                                            <Text style={styles.teamLeaderKpiSelectionArrow}>•</Text>
                                          </View>
                                        </View>
                                      );
                                    })}
                                  </View>
                                );
                              })}
                            </View>
                          );
                          return (
                            <>
                              {renderBlock('Team Focus', teamFocusActive, { overlapSet: memberSelectedSet })}
                              {renderBlock('Personal', personalActive)}
                            </>
                          );
                        })()}
                        {row.concerns.length === 0 ? (
                          <Text style={styles.teamLeaderExpandedKpiRow}>No concern flags.</Text>
                        ) : (
                          row.concerns.map((concern) => (
                            <Text key={`${row.id}-${concern}`} style={styles.teamLeaderConcernBullet}>• {concern}</Text>
                          ))
                        )}
                        <View style={styles.teamLeaderExpandedActionsRow}>
                          <TouchableOpacity style={styles.teamRouteSmallPrimaryBtn} onPress={() => openChallengeFlowFromTeam('details')}>
                            <Text style={styles.teamRouteSmallPrimaryBtnText}>Challenge</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.teamRouteSmallSecondaryBtn} onPress={() => openTeamCommsHandoff('team_leader_dashboard')}>
                            <Text style={styles.teamRouteSmallSecondaryBtnText}>Comms</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
            {teamLoggingBlock}
          </View>
        )}
      </>
    );
  })()}
</View>
  );
}

const styles = StyleSheet.create({
  challengeDrawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 28, 44, 0.45)',
    justifyContent: 'flex-end',
  },
  challengeDrawerDivider: {
    height: 1,
    backgroundColor: '#e8edf5',
  },
  challengeDrawerFootMeta: {
    color: '#7b8697',
    fontSize: 11,
    fontWeight: '600',
  },
  challengeDrawerFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeDrawerHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d1d8e4',
    marginBottom: 6,
  },
  challengeDrawerJoinBtn: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: '#1f5fe2',
    paddingVertical: 14,
    alignItems: 'center',
  },
  challengeDrawerJoinBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  challengeDrawerMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeDrawerMetaText: {
    color: '#7b8697',
    fontSize: 11,
    fontWeight: '600',
  },
  challengeDrawerSectionTitle: {
    color: '#3d4e6a',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  challengeDrawerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 10,
    shadowColor: '#0d1b33',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  challengeDrawerSub: {
    color: '#5b6d8e',
    fontSize: 13,
    lineHeight: 18,
  },
  challengeDrawerTitle: {
    color: '#1e2a47',
    fontSize: 18,
    fontWeight: '800',
  },
  challengeDrawerViewBtn: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4dff3',
    backgroundColor: '#f8fbff',
    paddingVertical: 14,
    alignItems: 'center',
  },
  challengeDrawerViewBtnText: {
    color: '#35557f',
    fontSize: 14,
    fontWeight: '800',
  },
  challengeEmptyBadge: {
    borderRadius: 999,
    backgroundColor: '#eef4ff',
    borderWidth: 1,
    borderColor: '#d8e5ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  challengeEmptyBadgeText: {
    color: '#2d63e1',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  challengeEmptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfe7f2',
    padding: 16,
    gap: 10,
    alignItems: 'flex-start',
    shadowColor: '#233a61',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  challengeEmptyCta: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: '#1f5fe2',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  challengeEmptyCtaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  challengeEmptyText: {
    color: '#6f7888',
    fontSize: 13,
    lineHeight: 19,
  },
  challengeEmptyTitle: {
    color: '#2f3442',
    fontSize: 18,
    fontWeight: '800',
  },
  challengeSectionsWrap: {
    gap: 10,
  },
  challengeSurfaceWrap: {
    gap: 12,
  },
  disabled: {
    opacity: 0.55,
  },
  teamChallengesActiveBadge: {
    borderRadius: 999,
    backgroundColor: '#a7df5f',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },
  teamChallengesActiveBadgeText: {
    color: '#35451f',
    fontSize: 10,
    fontWeight: '800',
  },
  teamChallengesCard: {
    borderRadius: 12,
    backgroundColor: '#eef0f4',
    borderWidth: 1,
    borderColor: '#e2e7ef',
    padding: 12,
    gap: 7,
  },
  teamChallengesCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamChallengesCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamChallengesCompletedBadge: {
    backgroundColor: '#d6d2f8',
  },
  teamChallengesCompletedBadgeText: {
    color: '#4b3f7f',
  },
  teamChallengesCreateBtn: {
    borderRadius: 10,
    backgroundColor: '#1f5fe2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  teamChallengesCreateBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  teamChallengesDrawerKpiChip: {
    borderRadius: 999,
    backgroundColor: '#eff4ff',
    borderWidth: 1,
    borderColor: '#d6e2ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  teamChallengesDrawerKpiChipText: {
    color: '#4b5f84',
    fontSize: 11,
    fontWeight: '600',
  },
  teamChallengesDrawerKpiList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamChallengesEmptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e6ef',
    backgroundColor: '#f6f8fc',
    padding: 12,
    gap: 6,
  },
  teamChallengesEmptySub: {
    color: '#6e7d95',
    fontSize: 11,
    lineHeight: 15,
  },
  teamChallengesEmptyTitle: {
    color: '#3a4962',
    fontSize: 13,
    fontWeight: '700',
  },
  teamChallengesHeroCard: {
    borderRadius: 14,
    backgroundColor: '#eef3ff',
    borderWidth: 1,
    borderColor: '#dbe6ff',
    padding: 12,
    gap: 10,
  },
  teamChallengesHeroCopy: {
    flex: 1,
    gap: 2,
  },
  teamChallengesHeroStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamChallengesHeroSub: {
    color: '#5b6d8e',
    fontSize: 12,
    lineHeight: 16,
  },
  teamChallengesHeroTitle: {
    color: '#203452',
    fontSize: 15,
    fontWeight: '800',
  },
  teamChallengesHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamChallengesMetaStrong: {
    color: '#474f5f',
    fontSize: 12,
    fontWeight: '700',
  },
  teamChallengesProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#4fd15f',
  },
  teamChallengesProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#dde2e8',
    overflow: 'hidden',
  },
  teamChallengesSegmentPill: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  teamChallengesSegmentPillActive: {
    backgroundColor: '#1f5fe2',
  },
  teamChallengesSegmentPillText: {
    color: '#4e5c71',
    fontSize: 12,
    fontWeight: '700',
  },
  teamChallengesSegmentPillTextActive: {
    color: '#fff',
  },
  teamChallengesSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#eceff4',
    borderRadius: 999,
    padding: 3,
    gap: 4,
  },
  teamChallengesStatCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  teamChallengesUpcomingBadge: {
    backgroundColor: '#f7e8bf',
  },
  teamChallengesUpcomingBadgeText: {
    color: '#645222',
  },
  teamChallengesUpcomingDate: {
    color: '#203452',
    fontSize: 13,
    fontWeight: '800',
  },
  teamChallengesUpcomingIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#d7e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamChallengesUpcomingIconText: {
    fontSize: 13,
  },
  teamFocusDrawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 36, 44, 0.55)',
    justifyContent: 'flex-end',
  },
  teamFocusDrawerCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#c8d0de',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamFocusDrawerCheckActive: {
    borderColor: '#1f5fe2',
    backgroundColor: '#1f5fe2',
  },
  teamFocusDrawerCheckMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginTop: -1,
  },
  teamFocusDrawerChip: {
    borderWidth: 1.5,
    borderColor: '#d5dfef',
    backgroundColor: '#f6f8fc',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  teamFocusDrawerChipActive: {
    borderColor: '#1f5fe2',
    backgroundColor: '#1f5fe2',
  },
  teamFocusDrawerChipText: {
    color: '#5f6f89',
    fontSize: 13,
    fontWeight: '700',
  },
  teamFocusDrawerChipTextActive: {
    color: '#ffffff',
  },
  teamFocusDrawerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f2f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamFocusDrawerCloseBtnText: {
    color: '#5f6b7f',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -1,
  },
  teamFocusDrawerDoneBtn: {
    borderRadius: 14,
    backgroundColor: '#1f5fe2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    shadowColor: '#1a3fa0',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  teamFocusDrawerDoneBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  teamFocusDrawerEmpty: {
    color: '#8d95a5',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 24,
  },
  teamFocusDrawerFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  teamFocusDrawerHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d0d5dd',
    marginTop: 10,
    marginBottom: 14,
  },
  teamFocusDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  teamFocusDrawerList: {
    flexGrow: 0,
    marginBottom: 16,
  },
  teamFocusDrawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8edf5',
    backgroundColor: '#fafbfd',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
  },
  teamFocusDrawerRowName: {
    color: '#44526a',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  teamFocusDrawerRowNameActive: {
    color: '#1e3a6e',
    fontWeight: '700',
  },
  teamFocusDrawerRowSelected: {
    borderColor: '#c0d4f6',
    backgroundColor: '#eef4ff',
  },
  teamFocusDrawerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '72%',
  },
  teamFocusDrawerSub: {
    color: '#6b7a90',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 14,
  },
  teamFocusDrawerTitle: {
    color: '#1e2534',
    fontSize: 18,
    fontWeight: '800',
  },
  teamFocusHeaderEditBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d0dcf0',
  },
  teamFocusHeaderEditBtnText: {
    color: '#4d5a6c',
    fontSize: 14,
    fontWeight: '700',
  },
  teamHeaderBadge: {
    backgroundColor: '#eaf3ff',
    borderColor: '#cfe0fb',
  },
  teamHeaderBadgeText: {
    color: '#2764b3',
  },
  teamHealthMeterPercentText: {
    color: '#6e7787',
    fontSize: 10,
    fontWeight: '700',
    minWidth: 34,
    textAlign: 'right',
  },
  teamHealthMeterRemainingMask: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: '#e9edf3',
  },
  teamHealthMeterRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamHealthMeterSegment: {
    flex: 1,
    height: '100%',
  },
  teamHealthMeterSegmentGreen: {
    backgroundColor: '#55b867',
  },
  teamHealthMeterSegmentOrange: {
    backgroundColor: '#ea8a3d',
  },
  teamHealthMeterSegmentRed: {
    backgroundColor: '#dd524d',
  },
  teamHealthMeterSegmentYellow: {
    backgroundColor: '#e5c54d',
  },
  teamHealthMeterTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: '#f2f4f8',
  },
  teamIdentityCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d9e3f1',
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  teamHeroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 0,
  },
  teamHeroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  teamHeroStatHighlight: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0,0,0,0.08)',
    marginLeft: 2,
    paddingLeft: 2,
  },
  teamHeroStatDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginBottom: 1,
  },
  teamHeroStatValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e2a47',
  },
  teamHeroStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7fa0',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  teamIdentityCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  teamIdentityCardChatBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  teamIdentityCardChatBtnText: {
    color: '#2a3140',
    fontSize: 13,
    fontWeight: '700',
  },
  teamIdentityCardDetailsBtn: {
    width: 38,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  teamIdentityCardDetailsBtnText: {
    color: '#2a3140',
    fontSize: 15,
    fontWeight: '800',
  },
  teamIdentityCardInlineError: {
    marginTop: 6,
    fontSize: 11,
    color: '#b3261e',
    fontWeight: '600',
  },
  teamIdentityCardInlineNotice: {
    marginTop: 6,
    fontSize: 11,
    color: '#35568f',
    fontWeight: '600',
    lineHeight: 15,
  },
  teamIdentityControlDangerBtn: {
    borderRadius: 10,
    backgroundColor: '#c43a33',
    paddingVertical: 10,
    alignItems: 'center',
  },
  teamIdentityControlDangerBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  teamIdentityControlHint: {
    color: '#5a677d',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  teamIdentityControlPrimaryBtn: {
    borderRadius: 10,
    backgroundColor: '#2f67da',
    paddingVertical: 10,
    alignItems: 'center',
  },
  teamIdentityControlPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  teamIdentityControlSecondaryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a8bce4',
    backgroundColor: '#f3f7ff',
    paddingVertical: 10,
    alignItems: 'center',
  },
  teamIdentityControlSecondaryBtnText: {
    color: '#35568f',
    fontSize: 13,
    fontWeight: '700',
  },
  teamIdentityControlsHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d0d5dd',
    alignSelf: 'center',
    marginBottom: 6,
  },
  teamIdentityControlsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'flex-end',
  },
  teamIdentityControlsSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 10,
  },
  teamIdentityControlsTitle: {
    color: '#2a3140',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  teamIdentityCopy: {
    flex: 1,
  },
  teamIdentityEditActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  teamIdentityEditAvatarCell: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#f7f8fa',
    borderWidth: 2,
    borderColor: '#e8ecf0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamIdentityEditAvatarCellActive: {
    borderColor: '#2f67da',
    backgroundColor: '#eaf0ff',
    shadowColor: '#2f67da',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  teamIdentityEditAvatarEmoji: {
    fontSize: 22,
  },
  teamIdentityEditAvatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  teamIdentityEditCancelBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c8d5ea',
    backgroundColor: '#f8fbff',
    paddingVertical: 14,
    alignItems: 'center',
  },
  teamIdentityEditCancelBtnText: {
    color: '#4d5a6c',
    fontSize: 15,
    fontWeight: '700',
  },
  teamIdentityEditCategoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f2f4f7',
    borderWidth: 1,
    borderColor: '#e0e5ec',
  },
  teamIdentityEditCategoryChipActive: {
    backgroundColor: '#2f67da',
    borderColor: '#2f67da',
  },
  teamIdentityEditCategoryChipText: {
    color: '#4d5a6c',
    fontSize: 12,
    fontWeight: '600',
  },
  teamIdentityEditCategoryChipTextActive: {
    color: '#ffffff',
  },
  teamIdentityEditCategoryRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  teamIdentityEditChoiceCheck: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2f67da',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  teamIdentityEditChoiceCheckText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  teamIdentityEditColorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  teamIdentityEditColorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  teamIdentityEditColorSwatchActive: {
    borderWidth: 3,
    borderColor: '#2f67da',
    shadowColor: '#2f67da',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  teamIdentityEditColorSwatchCheck: {
    fontSize: 16,
    fontWeight: '800',
  },
  teamIdentityEditIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  teamIdentityEditIconText: {
    color: '#4d5a6c',
    fontSize: 14,
    fontWeight: '700',
  },
  teamIdentityEditNameInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cdd7e5',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    color: '#1e2430',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  teamIdentityEditOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  teamIdentityEditPreview: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  teamIdentityEditPreviewCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffffcc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  teamIdentityEditPreviewGlyph: {
    fontSize: 30,
  },
  teamIdentityEditPreviewName: {
    color: '#3d4655',
    fontSize: 16,
    fontWeight: '700',
  },
  teamIdentityEditSaveBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#2f67da',
    paddingVertical: 14,
    alignItems: 'center',
  },
  teamIdentityEditSaveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  teamIdentityEditScrollArea: {
    maxHeight: 340,
    marginBottom: 8,
  },
  teamIdentityEditSectionLabel: {
    color: '#4d5a6c',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  teamIdentityEditSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
    maxHeight: '88%',
  },
  teamIdentityEditSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d0d5dd',
    alignSelf: 'center',
    marginBottom: 12,
  },
  teamIdentityEditSheetTitle: {
    color: '#2a3140',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  teamIdentityIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffffcc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamIdentityIconText: {
    fontSize: 18,
  },
  teamIdentityName: {
    color: '#2a3140',
    fontSize: 15,
    fontWeight: '800',
  },
  teamIdentitySub: {
    color: '#677487',
    fontSize: 11,
    marginTop: 1,
  },
  teamIdentityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  teamKpiMiniMeterRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamLeaderConcernBullet: {
    color: '#6d4b4b',
    fontSize: 11,
    lineHeight: 15,
  },
  teamLeaderExpandableList: {
    gap: 8,
  },
  teamLeaderExpandedActionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  teamLeaderExpandedKpiRow: {
    color: '#516179',
    fontSize: 11,
  },
  teamLeaderHealthSummaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce5f4',
    backgroundColor: '#f7faff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  teamLeaderHealthSummaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamLeaderHealthSummaryStatChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamLeaderHealthSummaryStatChipGood: {
    borderColor: '#a8ddb0',
    backgroundColor: '#eff9ef',
  },
  teamLeaderHealthSummaryStatChipRisk: {
    borderColor: '#e9b3ae',
    backgroundColor: '#fff1ef',
  },
  teamLeaderHealthSummaryStatChipWatch: {
    borderColor: '#e7cf87',
    backgroundColor: '#fff8e7',
  },
  teamLeaderHealthSummaryStatText: {
    color: '#4c5e77',
    fontSize: 10,
    fontWeight: '700',
  },
  teamLeaderHealthSummaryStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  teamLeaderHealthSummarySub: {
    color: '#6f7c90',
    fontSize: 11,
    lineHeight: 15,
  },
  teamLeaderHealthSummaryTitle: {
    color: '#2f3f58',
    fontSize: 13,
    fontWeight: '800',
  },
  teamLeaderHealthSummaryToneChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamLeaderHealthSummaryToneGood: {
    backgroundColor: '#dff4df',
  },
  teamLeaderHealthSummaryToneRisk: {
    backgroundColor: '#ffe4e2',
  },
  teamLeaderHealthSummaryToneText: {
    color: '#3f4f65',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  teamLeaderHealthSummaryToneWatch: {
    backgroundColor: '#fff3d8',
  },
  teamLeaderKpiBlock: {
    gap: 6,
  },
  teamLeaderKpiBlockLabel: {
    color: '#4a5c78',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  teamLeaderKpiSelectionArrow: {
    color: '#4f6280',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
  },
  teamLeaderKpiSelectionName: {
    color: '#354661',
    fontSize: 12,
    fontWeight: '700',
  },
  teamLeaderKpiSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8edf7',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 8,
  },
  teamLeaderKpiSelectionRowCopy: {
    flex: 1,
    gap: 1,
  },
  teamLeaderKpiSelectionRowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  teamLeaderKpiSelectionSelectedText: {
    color: '#1f5fe2',
    fontSize: 10,
    fontWeight: '800',
  },
  teamLeaderKpiSelectionSub: {
    color: '#6e7c92',
    fontSize: 10,
  },
  teamLeaderKpiSelectionUnselectedText: {
    color: '#6e7c92',
    fontSize: 10,
    fontWeight: '700',
  },
  teamLeaderKpiTypeSection: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e9f5',
    backgroundColor: '#fbfdff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  teamLeaderKpiTypeSectionTitle: {
    color: '#40506a',
    fontSize: 11,
    fontWeight: '800',
  },
  teamLeaderMemberCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f4',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  teamLeaderMemberExpandedBody: {
    borderTopWidth: 1,
    borderTopColor: '#e7ecf5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
  },
  teamLeaderMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  teamLeaderMemberStatus: {
    color: '#4b5d79',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  teamLeaderOpsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamLeaderOpsWrap: {
    gap: 12,
  },
  teamLeaderOverlapChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7deea',
    backgroundColor: '#f4f7fc',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  teamLeaderOverlapChipText: {
    color: '#607089',
    fontSize: 9,
    fontWeight: '700',
  },
  teamLeaderRowExpandBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8e2f2',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7faff',
  },
  teamLeaderRowExpandBtnText: {
    color: '#415570',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: -1,
  },
  teamLeaderTotalsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamMemberChallengeCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dde7f4',
    backgroundColor: '#f8fbff',
    padding: 10,
    gap: 4,
  },
  teamMemberChallengeLabel: {
    color: '#50607a',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  teamMemberChallengeLink: {
    color: '#2b5fdd',
    fontSize: 11,
    fontWeight: '700',
  },
  teamMemberChallengeSub: {
    color: '#768399',
    fontSize: 11,
    lineHeight: 15,
  },
  teamMemberChallengeTitle: {
    color: '#2f3a4a',
    fontSize: 15,
    fontWeight: '800',
  },
  teamMemberChallengeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamMemberDashboardWrap: {
    gap: 12,
  },
  teamMemberSectionLabel: {
    color: '#444d5b',
    fontSize: 13,
    fontWeight: '700',
  },
  teamParityMemberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dce7f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamParityMemberAvatarText: {
    color: '#355483',
    fontSize: 11,
    fontWeight: '800',
  },
  teamParityMemberCopy: {
    flex: 1,
    minWidth: 0,
  },
  teamParityMemberName: {
    color: '#404857',
    fontSize: 13,
    fontWeight: '700',
  },
  teamParityMemberSub: {
    color: '#8d97a6',
    fontSize: 11,
  },
  teamParityNavTitle: {
    color: '#3a4250',
    fontSize: 16,
    fontWeight: '700',
  },
  teamParityStatCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  teamParityStatCardGreen: {
    backgroundColor: '#dff0da',
  },
  teamParityStatCardPurple: {
    backgroundColor: '#e2def6',
  },
  teamParityStatFoot: {
    color: '#6e7787',
    fontSize: 11,
  },
  teamParityStatTitle: {
    color: '#465063',
    fontSize: 11,
    fontWeight: '700',
  },
  teamParityStatValue: {
    color: '#3a4250',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  teamProfileLinkBtn: {
    borderWidth: 1,
    borderColor: '#d3ddec',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f7f9fd',
  },
  teamProfileLinkBtnText: {
    color: '#3f5f94',
    fontSize: 12,
    fontWeight: '700',
  },
  teamRouteAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dce7f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRouteAvatarText: {
    color: '#3c5e8f',
    fontSize: 10,
    fontWeight: '800',
  },
  teamRouteCardRow: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamRouteCardRowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  teamRouteCardRowSub: {
    color: '#858f9d',
    fontSize: 11,
    lineHeight: 13,
  },
  teamRouteCardRowTitle: {
    color: '#404858',
    fontSize: 13,
    fontWeight: '700',
  },
  teamRouteFieldLabel: {
    color: '#4f586a',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  teamRouteIconGhostBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRouteIconGhostBtnText: {
    color: '#4c5565',
    fontSize: 13,
    fontWeight: '700',
  },
  teamRouteInfoBanner: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  teamRouteInfoBannerLavender: {
    backgroundColor: '#e4e0f8',
    alignItems: 'center',
  },
  teamRouteInfoBannerText: {
    flex: 1,
    color: '#5f6878',
    fontSize: 11,
    lineHeight: 14,
  },
  teamRouteInfoIcon: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cdd5e3',
    color: '#47556c',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 1,
  },
  teamRouteInlineButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 42,
  },
  teamRouteInlineInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  teamRouteInputGhost: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#eef0f4',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  teamRouteInputGhostText: {
    color: '#9aa3b0',
    fontSize: 11,
  },
  teamRouteKpiIconGray: { backgroundColor: '#e9ebef' },
  teamRouteKpiIconLavender: { backgroundColor: '#e8e1f8' },
  teamRouteKpiIconMint: { backgroundColor: '#dff5ef' },
  teamRouteKpiIconRose: { backgroundColor: '#f7e1e3' },
  teamRouteKpiIconSand: { backgroundColor: '#f4ecd9' },
  teamRouteKpiIconText: {
    fontSize: 13,
  },
  teamRouteKpiIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRouteKpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  teamRouteKpiRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#e2e7ee',
  },
  teamRouteMutedText: {
    color: '#b0b5be',
  },
  teamRoutePendingCard: {
    borderRadius: 10,
    backgroundColor: '#eef0f4',
    padding: 10,
    gap: 8,
  },
  teamRoutePendingTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  teamRoutePrimaryBtn: {
    borderRadius: 8,
    backgroundColor: '#1f5fe2',
    paddingVertical: 10,
    alignItems: 'center',
  },
  teamRoutePrimaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  teamRouteProBadge: {
    borderRadius: 999,
    backgroundColor: '#b3b3b3',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamRouteProBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  teamRouteScreenBackBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRouteScreenBackBtnText: {
    color: '#2f3442',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '500',
    marginTop: -2,
  },
  teamRouteScreenNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamRouteScreenNavSpacer: {
    width: 28,
    height: 28,
  },
  teamRouteScreenNavTitle: {
    color: '#3a4250',
    fontSize: 16,
    fontWeight: '700',
  },
  teamRouteScreenWrap: {
    gap: 12,
  },
  teamRouteSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  teamRouteSectionLink: {
    color: '#5c6474',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  teamRouteSectionTitle: {
    color: '#666f7e',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
  },
  teamRouteSmallPrimaryBtn: {
    borderRadius: 8,
    backgroundColor: '#343c49',
    paddingHorizontal: 14,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 68,
  },
  teamRouteSmallPrimaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  teamRouteSmallSecondaryBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4d5562',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRouteSmallSecondaryBtnText: {
    color: '#4d5562',
    fontSize: 12,
    fontWeight: '700',
  },
  teamRouteStack: {
    gap: 10,
  },
  teamRouteStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },
  teamRouteStatusBadgeExpired: {
    backgroundColor: '#ffe4e4',
  },
  teamRouteStatusBadgePending: {
    backgroundColor: '#fff3e4',
  },
  teamRouteStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  teamRouteStatusBadgeTextExpired: {
    color: '#f14a4a',
  },
  teamRouteStatusBadgeTextPending: {
    color: '#f08a18',
  },
  teamRouteToggle: {
    width: 34,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#e1e5eb',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  teamRouteToggleKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  teamRouteToggleKnobOn: {
    alignSelf: 'flex-end',
  },
  teamRouteToggleOn: {
    backgroundColor: '#1f5fe2',
  },
  teamRouteTrailingActions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  noTeamWrap: {
    paddingHorizontal: 4,
    paddingTop: 8,
    gap: 20,
  },
  noTeamHero: {
    alignItems: 'center',
    backgroundColor: '#f0f6ff',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#d7e4f5',
  },
  noTeamEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  noTeamTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1e2a47',
    textAlign: 'center',
  },
  noTeamSub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#5b6d8e',
    textAlign: 'center',
  },
  noTeamFeatures: {
    gap: 14,
    paddingHorizontal: 4,
  },
  noTeamFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  noTeamFeatureIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  noTeamFeatureCopy: {
    flex: 1,
  },
  noTeamFeatureLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e2a47',
  },
  noTeamFeatureSub: {
    fontSize: 12,
    color: '#6b7fa0',
    marginTop: 1,
  },
  noTeamCtaBtn: {
    backgroundColor: '#2f5fd0',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  noTeamCtaBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  noTeamCtaHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#8d95a5',
    lineHeight: 17,
    paddingHorizontal: 16,
  },
});

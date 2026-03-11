import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminRouteGuard from '../components/AdminRouteGuard';
import { KpiIcon, KpiIconPicker } from '../components/kpi';
import { useAdminAuthz } from '../contexts/AdminAuthzContext';
import { useAuth } from '../contexts/AuthContext';
import AdminProjectionLabPanel from './admin-shell/AdminProjectionLabPanel';
import {
  createAdminChallengeTemplate,
  createAdminKpi,
  deactivateAdminChallengeTemplate,
  deactivateAdminKpi,
  fetchAdminChallengeTemplates,
  fetchAdminKpis,
  updateAdminChallengeTemplate,
  updateAdminKpi,
  type AdminChallengeTemplatePhase,
  type AdminChallengeTemplatePhaseKpiGoal,
  type AdminChallengeTemplateRow,
  type AdminChallengeTemplateWritePayload,
  type AdminKpiRow,
  type AdminKpiWritePayload,
} from '../lib/adminCatalogApi';
import {
  createAdminUser,
  fetchAdminUserCalibration,
  fetchAdminUserCalibrationEvents,
  fetchAdminUsers,
  reinitializeAdminUserCalibrationFromOnboarding,
  resetAdminUserCalibration,
  updateAdminUserRole,
  updateAdminUserStatus,
  updateAdminUserTier,
  type AdminUserCalibrationEvent,
  type AdminUserCalibrationRow,
  type AdminUserCalibrationSnapshot,
  type AdminUserCreatePayload,
  type AdminUserRow,
} from '../lib/adminUsersApi';
import {
  probeAdminAnalyticsOverview,
  probeAdminDetailedReports,
  type EndpointProbeStatus,
} from '../lib/adminReportsApi';
import {
  ADMIN_ROUTES,
  AdminRole,
  AdminRouteDefinition,
  AdminRouteKey,
  canAccessAdminRoute,
  getAdminRouteByKey,
  getAdminRouteByPath,
  getInitialAdminRouteKey,
  normalizeAdminRole,
} from '../lib/adminAuthz';
import { resolveKpiIcon } from '../lib/kpiIcons';
import {
  ADMIN_NOT_FOUND_PATH,
  ADMIN_UNAUTHORIZED_PATH,
  getAdminRouteStage,
  getAdminRouteStageTone,
} from '../lib/adminShellConfig';
import { API_URL } from '../lib/supabase';
import { colors, space } from '../theme/tokens';
import CompassMark from '../assets/brand/compass_mark.svg';

function formatRoles(roles: string[]) {
  if (roles.length === 0) return 'none found in session metadata';
  return roles.join(', ');
}

function PlaceholderScreen({
  route,
  rolesLabel,
}: {
  route: AdminRouteDefinition;
  rolesLabel: string;
}) {
  const stage = getAdminRouteStage(route.key);
  const tone = getAdminRouteStageTone(stage);
  return (
    <View style={styles.panel}>
      <View style={styles.panelTopRow}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.eyebrow}>{route.path}</Text>
          <Text style={styles.panelTitle}>{route.label}</Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Text style={[styles.stagePillText, { color: tone.text }]}>{stage}</Text>
        </View>
      </View>
      <Text style={styles.panelBody}>{route.description}</Text>
      <View style={styles.metaList}>
        <Text style={styles.metaRow}>Status: route available, feature panel pending</Text>
        <Text style={styles.metaRow}>Required roles: {route.requiredRoles.join(', ')}</Text>
        <Text style={styles.metaRow}>Detected session roles: {rolesLabel}</Text>
      </View>
      <View style={styles.placeholderGrid}>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderCardLabel}>Planned capability</Text>
          <Text style={styles.placeholderCardValue}>
            {stage === 'A1 now'
              ? 'Route access and navigation handling'
              : stage === 'A2 now'
                ? 'Catalog and template operations'
                : 'User operations and reporting tools'}
          </Text>
        </View>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderCardLabel}>API access</Text>
          <Text style={styles.placeholderCardValue}>Uses documented `/admin/*` endpoints only</Text>
        </View>
      </View>
    </View>
  );
}

function NotFoundState({ requestedPath }: { requestedPath: string }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>404</Text>
      <Text style={styles.panelTitle}>Admin route not found</Text>
      <Text style={styles.panelBody}>
        This admin path is not available in the current admin workspace. Use the left navigation to continue.
      </Text>
      <View style={styles.metaList}>
        <Text style={styles.metaRow}>Requested path: {requestedPath}</Text>
        <Text style={styles.metaRow}>Resolved shell state: {ADMIN_NOT_FOUND_PATH}</Text>
      </View>
    </View>
  );
}

function formatDateShort(value?: string | null) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleDateString();
}

async function confirmDangerAction(message: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(message);
  }
  return new Promise((resolve) => {
    Alert.alert('Confirm Action', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirm', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function sortRowsByUpdatedDesc<T extends { updated_at?: string | null; created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
}

type SortDirection = 'asc' | 'desc';

function compareStrings(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function compareNumbers(a: number, b: number) {
  return a - b;
}

function compareBooleans(a: boolean, b: boolean) {
  if (a === b) return 0;
  return a ? 1 : -1;
}

function compareDates(a?: string | null, b?: string | null) {
  const aTime = new Date(a ?? 0).getTime();
  const bTime = new Date(b ?? 0).getTime();
  const safeA = Number.isFinite(aTime) ? aTime : 0;
  const safeB = Number.isFinite(bTime) ? bTime : 0;
  return safeA - safeB;
}

function applySortDirection(value: number, direction: SortDirection) {
  return direction === 'asc' ? value : -value;
}

type AiSuggestionStatus = 'draft_pending_review' | 'pending_approval' | 'approved' | 'rejected';
type AiApprovalTier = 'self_review' | 'coach' | 'admin' | 'sponsor_admin';

type AdminAiAuditHistoryEntry = {
  id: string;
  at: string;
  actorLabel: string;
  action: 'requested' | 'edited' | 'submitted' | 'approved' | 'rejected';
  note?: string | null;
};

type AdminAiSuggestionQueueItem = {
  id: string;
  requesterLabel: string;
  requesterRole: string;
  targetScopeSummary: string;
  sourceSurface: string;
  requestIntent: string;
  status: AiSuggestionStatus;
  requiredApprovalTier: AiApprovalTier;
  disclaimerRequirements: string[];
  safetyFlags: string[];
  draftContent: string;
  editedContentIndicator: boolean;
  modelMeta: string;
  createdAt: string;
  updatedAt: string;
  executionLinkageRef: string | null;
  auditHistory: AdminAiAuditHistoryEntry[];
};

function getAiSuggestionStatusTone(status: AiSuggestionStatus) {
  switch (status) {
    case 'approved':
      return { bg: '#EFFCF4', border: '#BFE6CC', text: '#1D7A4D', label: 'Approved' };
    case 'rejected':
      return { bg: '#FFF4F2', border: '#F2C0B9', text: '#B2483A', label: 'Rejected' };
    case 'pending_approval':
      return { bg: '#FFF8E9', border: '#F2D89A', text: '#946300', label: 'Pending approval' };
    default:
      return { bg: '#EEF3FF', border: '#CEDBFF', text: '#204ECF', label: 'Draft pending review' };
  }
}

function formatAiStatusLabel(status: AiSuggestionStatus) {
  switch (status) {
    case 'draft_pending_review':
      return 'draft pending review';
    case 'pending_approval':
      return 'pending approval';
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    default:
      return status;
  }
}

function promptForAuditNote(actionLabel: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const input = window.prompt(`${actionLabel} note (optional; stored in local UI audit history for this session):`, '');
    if (input == null) return null;
    return input.trim();
  }
  return '';
}

function buildStubAiSuggestionQueue(): AdminAiSuggestionQueueItem[] {
  return [
    {
      id: 'aisug_w5_001',
      requesterLabel: 'Taylor Coach',
      requesterRole: 'coach',
      targetScopeSummary: 'Team Alpha leaders (broadcast draft)',
      sourceSurface: 'coach_broadcast_compose',
      requestIntent: 'draft_broadcast',
      status: 'pending_approval',
      requiredApprovalTier: 'admin',
      disclaimerRequirements: ['Human approval required before send', 'Audience scope must be reviewed'],
      safetyFlags: ['broad_audience_scope', 'sponsor_language_review'],
      draftContent:
        'Draft reminder for Team Alpha leaders to complete this week’s coaching check-in and submit one blocker for review in the channel thread.',
      editedContentIndicator: true,
      modelMeta: 'gpt-5-family (label only)',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      executionLinkageRef: null,
      auditHistory: [
        {
          id: 'h1',
          at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
          actorLabel: 'Taylor Coach',
          action: 'requested',
          note: 'Broadcast draft requested from approved coach surface.',
        },
        {
          id: 'h2',
          at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          actorLabel: 'Taylor Coach',
          action: 'edited',
          note: 'Shortened intro and clarified call to action.',
        },
      ],
    },
    {
      id: 'aisug_w5_002',
      requesterLabel: 'Jordan Leader',
      requesterRole: 'team_leader',
      targetScopeSummary: 'Channel #team-alpha-coaching reply',
      sourceSurface: 'channel_thread',
      requestIntent: 'draft_reply',
      status: 'approved',
      requiredApprovalTier: 'coach',
      disclaimerRequirements: ['Human send still required'],
      safetyFlags: ['none'],
      draftContent:
        'Suggested reply acknowledging the blocker, summarizing next steps, and inviting a follow-up check-in tomorrow.',
      editedContentIndicator: false,
      modelMeta: 'gpt-5-family (label only)',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      executionLinkageRef: 'channel_message:msg_3821',
      auditHistory: [
        {
          id: 'h3',
          at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
          actorLabel: 'Jordan Leader',
          action: 'requested',
          note: 'Requested tone-softening rewrite for coaching reply.',
        },
        {
          id: 'h4',
          at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          actorLabel: 'Sam Coach Reviewer',
          action: 'approved',
          note: 'Approved with no edits; human send required.',
        },
      ],
    },
    {
      id: 'aisug_w5_003',
      requesterLabel: 'Riley Coach',
      requesterRole: 'coach',
      targetScopeSummary: 'Journey lesson reflection prompt',
      sourceSurface: 'coaching_lesson_detail',
      requestIntent: 'reflection_prompt',
      status: 'rejected',
      requiredApprovalTier: 'coach',
      disclaimerRequirements: ['Advisory-only content', 'No progress mutation'],
      safetyFlags: ['kpi_action_language'],
      draftContent:
        'Prompt draft contained action wording that could be interpreted as KPI logging instruction instead of reflection guidance.',
      editedContentIndicator: false,
      modelMeta: 'gpt-5-family (label only)',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 13).toISOString(),
      executionLinkageRef: null,
      auditHistory: [
        {
          id: 'h5',
          at: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
          actorLabel: 'Riley Coach',
          action: 'requested',
          note: 'Lesson-context reflection prompt draft request.',
        },
        {
          id: 'h6',
          at: new Date(Date.now() - 1000 * 60 * 60 * 13).toISOString(),
          actorLabel: 'Admin Ops Reviewer',
          action: 'rejected',
          note: 'Rejected due to disallowed KPI mutation/action framing.',
        },
      ],
    },
  ];
}

function formatKpiRange(row: Pick<AdminKpiRow, 'delay_days' | 'hold_days' | 'ttc_definition' | 'ttc_days'>): string {
  if (row.delay_days != null && row.hold_days != null) {
    const start = row.delay_days;
    const end = row.delay_days + row.hold_days;
    return `${start}-${end}d`;
  }
  if (row.ttc_definition?.trim()) return row.ttc_definition.trim();
  if (row.ttc_days != null) return `${row.ttc_days}d`;
  return '-';
}

function getKpiTypeHelp(type: KpiFormDraft['type']) {
  switch (type) {
    case 'PC':
      return 'Projected contribution KPI. Requires PC weight, TTC days, and decay days.';
    case 'GP':
      return 'Gamification points input only. GP does not generate PC.';
    case 'VP':
      return 'Value-points/input KPI only. VP does not generate PC.';
    case 'Actual':
      return 'Realized outcome KPI (kept separate from projected contribution values).';
    case 'Pipeline_Anchor':
      return 'Forecast anchor input. Supports forecast interpretation, not direct PC generation.';
    case 'Custom':
      return 'Flexible KPI row for custom tracking/admin use.';
    default:
      return '';
  }
}

type KpiFormDraft = {
  id?: string;
  name: string;
  slug: string;
  type: AdminKpiWritePayload['type'];
  iconSource?: 'brand_asset' | 'vector_icon' | null;
  iconName?: string | null;
  requiresDirectValueInput: boolean;
  isActive: boolean;
  pcWeight: string;
  delayDays: string;
  holdDays: string;
  ttcDays: string;
  decayDays: string;
  gpValue: string;
  vpValue: string;
};

type TemplateBuilderStep = 'basics' | 'phases' | 'kpi_goals' | 'review';

type TemplatePhaseGoalDraft = {
  kpi_id: string;
  target_value: string;
  goal_scope: 'individual' | 'team';
};

type TemplatePhaseDraft = {
  phase_name: string;
  phase_days: string;
  kpi_goals: TemplatePhaseGoalDraft[];
};

type TemplateFormDraft = {
  id?: string;
  name: string;
  description: string;
  defaultChallengeName: string;
  durationDays: string;
  phases: TemplatePhaseDraft[];
  singlePhaseGoals: TemplatePhaseGoalDraft[];
  isActive: boolean;
  builderStep: TemplateBuilderStep;
  showForm: boolean;
};

type UserFormDraft = {
  id?: string;
  role: AdminUserRow['role'];
  tier: AdminUserRow['tier'];
  accountStatus: AdminUserRow['account_status'];
};

type CreateUserDraft = {
  email: string;
  password: string;
  role: AdminUserCreatePayload['role'];
  tier: AdminUserCreatePayload['tier'];
  accountStatus: NonNullable<AdminUserCreatePayload['account_status']>;
};

type KnownUserEmailMap = Record<string, string>;
type BulkUserStatusUpdateResult = {
  updatedCount: number;
  failedCount: number;
  failedIds: string[];
};

function emptyUserDraft(): UserFormDraft {
  return { role: 'agent', tier: 'free', accountStatus: 'active' };
}

function emptyCreateUserDraft(): CreateUserDraft {
  return {
    email: '',
    password: '',
    role: 'agent',
    tier: 'free',
    accountStatus: 'active',
  };
}

function userDraftFromRow(row: AdminUserRow): UserFormDraft {
  return {
    id: row.id,
    role: row.role,
    tier: row.tier,
    accountStatus: row.account_status,
  };
}

function formatDateTimeShort(value?: string | null) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function formatDiagnosticLabel(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDiagnosticValue(value: unknown) {
  if (value == null) return 'n/a';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatProbeStatus(status: EndpointProbeStatus): string {
  switch (status.kind) {
    case 'idle':
      return 'Not checked yet';
    case 'loading':
      return 'Checking...';
    case 'ready':
      return 'Endpoint responded';
    case 'not_implemented':
      return `Not implemented in current backend (${status.status})`;
    case 'forbidden':
      return `Forbidden (${status.status})`;
    case 'error':
      return status.message;
    default:
      return 'Unknown';
  }
}

function getProbeTone(status: EndpointProbeStatus) {
  switch (status.kind) {
    case 'ready':
      return { bg: '#E8FFF3', text: '#146C43', border: '#B6E6CB', label: 'Ready' };
    case 'forbidden':
      return { bg: '#FFF5E8', text: '#9A5A00', border: '#F5D9AA', label: 'Forbidden' };
    case 'not_implemented':
      return { bg: '#EEF3FF', text: '#204ECF', border: '#CEDBFF', label: 'Not implemented' };
    case 'error':
      return { bg: '#FFF0F0', text: '#B2483A', border: '#F2C0B9', label: 'Error' };
    case 'loading':
      return { bg: '#F4F7FD', text: '#52607A', border: '#DFE7F3', label: 'Checking' };
    case 'idle':
    default:
      return { bg: '#F4F7FD', text: '#52607A', border: '#DFE7F3', label: 'Not checked' };
  }
}

function emptyKpiDraft(): KpiFormDraft {
  return {
    name: '',
    slug: '',
    type: 'Custom',
    iconSource: null,
    iconName: null,
    requiresDirectValueInput: false,
    isActive: true,
    pcWeight: '',
    delayDays: '',
    holdDays: '',
    ttcDays: '',
    decayDays: '',
    gpValue: '',
    vpValue: '',
  };
}

function kpiDraftFromRow(row: AdminKpiRow): KpiFormDraft {
  const resolvedIcon = resolveKpiIcon(row);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? '',
    type: (row.type as KpiFormDraft['type']) ?? 'Custom',
    iconSource: resolvedIcon.kind === 'vector_icon' ? 'vector_icon' : 'brand_asset',
    iconName: resolvedIcon.kind === 'vector_icon' ? resolvedIcon.iconName : row.icon_name ?? row.icon_file ?? null,
    requiresDirectValueInput: Boolean(row.requires_direct_value_input),
    isActive: row.is_active,
    pcWeight: row.pc_weight == null ? '' : String(row.pc_weight),
    delayDays: row.delay_days == null ? '' : String(row.delay_days),
    holdDays: row.hold_days == null ? '' : String(row.hold_days),
    ttcDays: row.ttc_days == null ? '' : String(row.ttc_days),
    decayDays: row.decay_days == null ? '' : String(row.decay_days),
    gpValue: row.gp_value == null ? '' : String(row.gp_value),
    vpValue: row.vp_value == null ? '' : String(row.vp_value),
  };
}

function emptyTemplateDraft(): TemplateFormDraft {
  return {
    name: '',
    description: '',
    defaultChallengeName: '',
    durationDays: '',
    phases: [],
    singlePhaseGoals: [],
    isActive: true,
    builderStep: 'basics',
    showForm: true,
  };
}

function templateDraftFromRow(row: AdminChallengeTemplateRow): TemplateFormDraft {
  const totalDays = row.suggested_duration_days ?? 30;
  const isSinglePhaseMode = !!(row.template_payload as Record<string, unknown> | null)?.single_phase_mode;
  const rawPhases = (row.template_payload?.phases ?? [])
    .slice()
    .sort((a: AdminChallengeTemplatePhase, b: AdminChallengeTemplatePhase) => a.starts_at_week - b.starts_at_week);

  // If saved as single-phase, extract goals into singlePhaseGoals instead of explicit phases
  if (isSinglePhaseMode && rawPhases.length === 1) {
    const singlePhaseGoals: TemplatePhaseGoalDraft[] = (rawPhases[0].kpi_goals ?? []).map(
      (g: AdminChallengeTemplatePhaseKpiGoal) => ({
        kpi_id: g.kpi_id,
        target_value: String(g.target_value),
        goal_scope: g.goal_scope,
      })
    );
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      defaultChallengeName: row.default_challenge_name ?? '',
      durationDays: row.suggested_duration_days != null ? String(row.suggested_duration_days) : '',
      phases: [],
      singlePhaseGoals,
      isActive: row.is_active,
      builderStep: 'basics',
      showForm: true,
    };
  }

  const phases: TemplatePhaseDraft[] = rawPhases.map(
    (p: AdminChallengeTemplatePhase, i: number) => {
      const startDay = p.starts_at_week;
      const nextStart = i < rawPhases.length - 1 ? rawPhases[i + 1].starts_at_week : totalDays + 1;
      return {
        phase_name: p.phase_name,
        phase_days: String(nextStart - startDay),
        kpi_goals: (p.kpi_goals ?? []).map((g: AdminChallengeTemplatePhaseKpiGoal) => ({
          kpi_id: g.kpi_id,
          target_value: String(g.target_value),
          goal_scope: g.goal_scope,
        })),
      };
    }
  );
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    defaultChallengeName: row.default_challenge_name ?? '',
    durationDays: row.suggested_duration_days != null ? String(row.suggested_duration_days) : '',
    phases,
    singlePhaseGoals: [],
    isActive: row.is_active,
    builderStep: 'basics',
    showForm: true,
  };
}

function parseOptionalNumber(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function buildKpiPayloadFromDraft(draft: KpiFormDraft): { payload?: AdminKpiWritePayload; error?: string } {
  if (!draft.name.trim()) return { error: 'Name is required' };
  const payload: AdminKpiWritePayload = {
    name: draft.name.trim(),
    type: draft.type,
    requires_direct_value_input: draft.requiresDirectValueInput,
    is_active: draft.isActive,
  };
  if (draft.slug.trim()) payload.slug = draft.slug.trim();
  if (draft.iconSource === 'vector_icon') {
    if (!draft.iconName?.trim()) return { error: 'Vector icon requires a selected icon' };
    payload.icon_source = 'vector_icon';
    payload.icon_name = draft.iconName.trim();
  } else if (draft.iconSource === 'brand_asset') {
    if (!draft.iconName?.trim()) return { error: 'Brand asset icon requires a selected asset' };
    payload.icon_source = 'brand_asset';
    payload.icon_name = draft.iconName.trim();
  }

  if (draft.type === 'PC') {
    const pcWeight = parseOptionalNumber(draft.pcWeight);
    const delayDays = parseOptionalNumber(draft.delayDays);
    const holdDays = parseOptionalNumber(draft.holdDays);
    const ttcDays = parseOptionalNumber(draft.ttcDays);
    const decayDays = parseOptionalNumber(draft.decayDays);
    if (pcWeight == null) return { error: 'PC KPI requires numeric pc_weight' };
    if (delayDays == null) return { error: 'PC KPI requires numeric delay_days' };
    if (holdDays == null) return { error: 'PC KPI requires numeric hold_days' };
    if (decayDays == null) return { error: 'PC KPI requires numeric decay_days' };
    payload.pc_weight = pcWeight;
    payload.delay_days = delayDays;
    payload.hold_days = holdDays;
    payload.ttc_days = delayDays + holdDays;
    if (ttcDays != null && ttcDays !== delayDays + holdDays) {
      payload.ttc_days = ttcDays;
    }
    payload.decay_days = decayDays;
  }

  if (draft.type === 'GP') {
    const gpValue = parseOptionalNumber(draft.gpValue);
    if (gpValue === null) return { error: 'GP value must be numeric' };
    if (gpValue !== undefined) payload.gp_value = gpValue;
  }

  if (draft.type === 'VP') {
    const vpValue = parseOptionalNumber(draft.vpValue);
    if (vpValue === null) return { error: 'VP value must be numeric' };
    if (vpValue !== undefined) payload.vp_value = vpValue;
  }

  return { payload };
}

function buildTemplatePayloadFromDraft(
  draft: TemplateFormDraft
): { payload?: AdminChallengeTemplateWritePayload; error?: string } {
  if (!draft.name.trim()) return { error: 'Theme name is required' };
  const durationDays = draft.durationDays.trim() ? parseInt(draft.durationDays.trim(), 10) : undefined;
  if (durationDays !== undefined && (!Number.isFinite(durationDays) || durationDays < 1)) {
    return { error: 'Duration must be at least 1 day' };
  }

  // Validate phases if present
  const phases: AdminChallengeTemplatePhase[] = [];
  let singlePhaseMode = false;

  if (draft.phases.length > 0) {
    // Explicit multi-phase
    if (!durationDays || durationDays < 1) {
      return { error: 'Duration (days) is required when phases are defined' };
    }
    let runningStart = 1;
    for (let i = 0; i < draft.phases.length; i++) {
      const p = draft.phases[i];
      if (!p.phase_name.trim()) return { error: `Phase ${i + 1}: name is required` };
      const phaseDays = parseInt(p.phase_days, 10);
      if (!Number.isFinite(phaseDays) || phaseDays < 1) {
        return { error: `Phase ${i + 1}: days must be >= 1` };
      }
      if (p.kpi_goals.length === 0) {
        return { error: `Phase ${i + 1}: at least one KPI goal is required` };
      }
      const kpiGoals: AdminChallengeTemplatePhaseKpiGoal[] = [];
      for (let j = 0; j < p.kpi_goals.length; j++) {
        const g = p.kpi_goals[j];
        if (!g.kpi_id) return { error: `Phase ${i + 1}, Goal ${j + 1}: KPI is required` };
        const target = parseFloat(g.target_value);
        if (!Number.isFinite(target) || target <= 0) {
          return { error: `Phase ${i + 1}, Goal ${j + 1}: target must be a positive number` };
        }
        kpiGoals.push({ kpi_id: g.kpi_id, target_value: target, goal_scope: g.goal_scope });
      }
      phases.push({
        phase_order: i + 1,
        phase_name: p.phase_name.trim(),
        starts_at_week: runningStart,
        kpi_goals: kpiGoals,
      });
      runningStart += phaseDays;
    }
    const totalPhaseDays = draft.phases.reduce((s, p) => s + (parseInt(p.phase_days, 10) || 0), 0);
    if (totalPhaseDays > durationDays) {
      return { error: `Phase days (${totalPhaseDays}) exceed total duration (${durationDays})` };
    }
  } else if (draft.singlePhaseGoals.length > 0) {
    // Phaseless template with challenge-level goals → wrap in one implicit phase
    if (!durationDays || durationDays < 1) {
      return { error: 'Duration (days) is required when KPI goals are defined' };
    }
    singlePhaseMode = true;
    const kpiGoals: AdminChallengeTemplatePhaseKpiGoal[] = [];
    for (let j = 0; j < draft.singlePhaseGoals.length; j++) {
      const g = draft.singlePhaseGoals[j];
      if (!g.kpi_id) return { error: `Goal ${j + 1}: KPI is required` };
      const target = parseFloat(g.target_value);
      if (!Number.isFinite(target) || target <= 0) {
        return { error: `Goal ${j + 1}: target must be a positive number` };
      }
      kpiGoals.push({ kpi_id: g.kpi_id, target_value: target, goal_scope: g.goal_scope });
    }
    phases.push({
      phase_order: 1,
      phase_name: draft.name.trim() || 'Challenge',
      starts_at_week: 1,
      kpi_goals: kpiGoals,
    });
  }

  const payload: AdminChallengeTemplateWritePayload = {
    name: draft.name.trim(),
    description: draft.description,
    is_active: draft.isActive,
  };
  if (draft.defaultChallengeName.trim()) {
    payload.default_challenge_name = draft.defaultChallengeName.trim();
  } else {
    payload.default_challenge_name = null;
  }
  if (durationDays !== undefined) {
    payload.suggested_duration_days = durationDays;
  }
  if (phases.length > 0) {
    payload.phases = phases;
    if (singlePhaseMode) {
      (payload as Record<string, unknown>).single_phase_mode = true;
    }
  }
  return { payload };
}

function AdminKpiCatalogPanel({
  rows,
  loading,
  error,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  draft,
  onDraftChange,
  onSelectRow,
  onResetDraft,
  onSubmitCreate,
  onSubmitUpdate,
  onDeactivate,
  saving,
  saveError,
  successMessage,
}: {
  rows: AdminKpiRow[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (value: 'all' | 'active' | 'inactive') => void;
  typeFilter: 'all' | AdminKpiWritePayload['type'];
  onTypeFilterChange: (value: 'all' | AdminKpiWritePayload['type']) => void;
  draft: KpiFormDraft;
  onDraftChange: (patch: Partial<KpiFormDraft>) => void;
  onSelectRow: (row: AdminKpiRow) => void;
  onResetDraft: () => void;
  onSubmitCreate: () => void;
  onSubmitUpdate: () => void;
  onDeactivate: () => void;
  saving: boolean;
  saveError: string | null;
  successMessage: string | null;
}) {
  type KpiSortKey = 'kpi' | 'type' | 'pc_weight' | 'gp_value' | 'vp_value' | 'range' | 'ttc' | 'decay' | 'status' | 'updated';
  const [visibleRowCount, setVisibleRowCount] = useState(24);
  const [sortKey, setSortKey] = useState<KpiSortKey>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isCreating, setIsCreating] = useState(false);
  const editing = Boolean(draft.id);
  const selectedRowId = draft.id ?? null;
  const hasActiveFilters = Boolean(searchQuery.trim() || statusFilter !== 'all' || typeFilter !== 'all');
  const activeFilterCount =
    (searchQuery.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);
  const filteredRows = rows.filter((row) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      row.name.toLowerCase().includes(q) ||
      (row.slug ?? '').toLowerCase().includes(q) ||
      row.type.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? row.is_active : !row.is_active);
    const matchesType = typeFilter === 'all' || row.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });
  const sortedFilteredRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let result = 0;
      switch (sortKey) {
        case 'kpi':
          result =
            compareStrings(a.name, b.name) ||
            compareStrings(a.slug ?? a.id, b.slug ?? b.id);
          break;
        case 'type':
          result = compareStrings(a.type, b.type) || compareStrings(a.name, b.name);
          break;
        case 'pc_weight':
          result = compareNumbers(a.pc_weight ?? Number.NEGATIVE_INFINITY, b.pc_weight ?? Number.NEGATIVE_INFINITY);
          break;
        case 'gp_value':
          result = compareNumbers(a.gp_value ?? Number.NEGATIVE_INFINITY, b.gp_value ?? Number.NEGATIVE_INFINITY);
          break;
        case 'vp_value':
          result = compareNumbers(a.vp_value ?? Number.NEGATIVE_INFINITY, b.vp_value ?? Number.NEGATIVE_INFINITY);
          break;
        case 'range':
          result = compareStrings(formatKpiRange(a), formatKpiRange(b)) || compareStrings(a.name, b.name);
          break;
        case 'ttc':
          result = compareNumbers(a.ttc_days ?? Number.NEGATIVE_INFINITY, b.ttc_days ?? Number.NEGATIVE_INFINITY);
          break;
        case 'decay':
          result = compareNumbers(a.decay_days ?? Number.NEGATIVE_INFINITY, b.decay_days ?? Number.NEGATIVE_INFINITY);
          break;
        case 'status':
          result = compareBooleans(a.is_active, b.is_active) || compareStrings(a.name, b.name);
          break;
        case 'updated':
          result = compareDates(a.updated_at, b.updated_at) || compareStrings(a.name, b.name);
          break;
      }
      return applySortDirection(result, sortDirection);
    });
  }, [filteredRows, sortDirection, sortKey]);
  const selectedRow = selectedRowId ? rows.find((row) => row.id === selectedRowId) ?? null : null;
  const selectedRowInFilteredIndex = selectedRowId ? sortedFilteredRows.findIndex((row) => row.id === selectedRowId) : -1;
  const selectedRowHiddenByFilters = Boolean(selectedRowId && selectedRowInFilteredIndex === -1);
  const visibleRows = sortedFilteredRows.slice(0, visibleRowCount);

  const onSortHeaderPress = (nextKey: KpiSortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'updated' ? 'desc' : 'asc');
  };

  const kpiSortLabel = (key: KpiSortKey, label: string) =>
    `${label}${sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}`;

  useEffect(() => {
    if (selectedRowInFilteredIndex >= 0 && selectedRowInFilteredIndex >= visibleRowCount) {
      setVisibleRowCount(selectedRowInFilteredIndex + 1);
    }
  }, [selectedRowInFilteredIndex, visibleRowCount]);

  useEffect(() => {
    setVisibleRowCount(24);
  }, [searchQuery, statusFilter, typeFilter]);

  useEffect(() => {
    setVisibleRowCount(24);
  }, [rows]);

  return (
    <View style={styles.listDetailContainer}>
      {/* Left panel: search + filter + list */}
      <View style={styles.listPanel}>
        <View style={styles.listPanelHeader}>
          <Text style={styles.listPanelTitle}>KPI Catalog</Text>
          <TouchableOpacity style={styles.listPanelCreateBtn} onPress={() => { setIsCreating(true); onResetDraft(); }}>
            <Text style={styles.listPanelCreateBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          style={styles.listSearchInput}
          placeholder="Search KPIs..."
          placeholderTextColor="#94A3B8"
        />
        <View style={styles.listFilterRow}>
          {(['all', 'active', 'inactive'] as const).map((value) => {
            const sel = statusFilter === value;
            return (
              <Pressable
                key={value}
                onPress={() => onStatusFilterChange(value)}
                style={[styles.listFilterPill, sel && styles.listFilterPillSelected]}
              >
                <Text style={[styles.listFilterPillText, sel && styles.listFilterPillTextSelected]}>
                  {value === 'all' ? 'All' : value === 'active' ? 'Active' : 'Inactive'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.listFilterRow, { flexWrap: 'wrap', gap: 4, marginTop: 2 }]}>
          {(['all', 'PC', 'GP', 'VP', 'Actual', 'Pipeline_Anchor', 'Custom'] as const).map((value) => {
            const sel = typeFilter === value;
            return (
              <Pressable
                key={value}
                onPress={() => onTypeFilterChange(value as typeof typeFilter)}
                style={[styles.listFilterPill, sel && styles.listFilterPillSelected]}
              >
                <Text style={[styles.listFilterPillText, sel && styles.listFilterPillTextSelected]}>
                  {value === 'all' ? 'All Types' : value === 'Pipeline_Anchor' ? 'Anchor' : value}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.listCountText}>
          {filteredRows.length} of {rows.length}{typeFilter !== 'all' ? ` · ${typeFilter}` : ''}
        </Text>
        {loading ? <Text style={styles.listCountText}>Loading...</Text> : null}
        {error ? <Text style={[styles.listCountText, styles.errorText]}>Error: {error}</Text> : null}
        <ScrollView style={styles.listScrollView}>
          {visibleRows.map((row) => {
            const isSelected = selectedRowId === row.id;
            return (
              <Pressable
                key={row.id}
                style={[styles.listRow, isSelected && styles.listRowSelected]}
                onPress={() => { setIsCreating(false); onSelectRow(row); }}
                accessibilityRole="button"
              >
                <View style={{ marginRight: 12 }}>
                  <KpiIcon
                    kpi={row}
                    size={36}
                  />
                </View>
                <View style={{ flex: 1 }}>
                <Text style={[styles.listRowTitle, isSelected && styles.listRowTitleSelected]} numberOfLines={1}>{row.name}</Text>
                <View style={styles.listRowMeta}>
                  <Text style={styles.listRowBadge}>{row.type}</Text>
                  <View style={[styles.listRowDot, { backgroundColor: row.is_active ? '#22C55E' : '#EF4444' }]} />
                </View>
                </View>
              </Pressable>
            );
          })}
          {filteredRows.length > visibleRowCount ? (
            <TouchableOpacity style={styles.listShowMore} onPress={() => setVisibleRowCount((prev) => prev + 24)}>
              <Text style={styles.listShowMoreText}>Show more ({filteredRows.length - visibleRowCount})</Text>
            </TouchableOpacity>
          ) : null}
          {!loading && filteredRows.length === 0 ? (
            <View style={styles.listEmptyState}>
              <Text style={styles.listEmptyText}>{rows.length === 0 ? 'No KPIs loaded.' : 'No matches.'}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
      {/* Right panel: detail/edit form + reference table — single scroll */}
      <View style={[styles.detailPanel, { padding: 0 }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {(editing || isCreating) ? (
      <View style={{ padding: 20, paddingBottom: 8 }}>
      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>{editing ? 'Edit KPI' : 'Create New KPI'}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity style={styles.smallGhostButton} onPress={() => { setIsCreating(true); onResetDraft(); }}>
              <Text style={styles.smallGhostButtonText}>{editing ? 'New KPI' : 'Clear'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallGhostButton, { paddingHorizontal: 8 }]}
              onPress={() => { setIsCreating(false); onResetDraft(); }}
              accessibilityLabel="Close form"
            >
              <Text style={[styles.smallGhostButtonText, { fontSize: 16 }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
        {selectedRow ? (
          <View style={styles.selectedUserSummaryCard}>
            <View style={styles.formHeaderRow}>
              <View>
                <Text style={styles.formTitle}>Selected KPI</Text>
                <Text style={styles.metaRow}>{selectedRow.name}</Text>
              </View>
              <KpiIcon
                kpi={selectedRow}
                size={42}
              />
              <View style={styles.inlineToggleRow}>
                <View style={[styles.statusChip, { backgroundColor: '#F4F8FF', borderColor: '#D8E4FA' }]}>
                  <Text style={[styles.statusChipText, { color: '#345892' }]}>{selectedRow.type}</Text>
                </View>
                <View
                  style={[
                    styles.statusChip,
                    selectedRow.is_active
                      ? { backgroundColor: '#EFFCF4', borderColor: '#BFE6CC' }
                      : { backgroundColor: '#FFF4F2', borderColor: '#F2C0B9' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: selectedRow.is_active ? '#1D7A4D' : '#B2483A' },
                    ]}
                  >
                    {selectedRow.is_active ? 'active' : 'inactive'}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.metaRow}>Slug: {selectedRow.slug ?? selectedRow.id}</Text>
            {selectedRowHiddenByFilters ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeTitle}>Selected KPI is hidden by current filters</Text>
                <Text style={styles.noticeText}>
                  The edit form is still loaded for {selectedRow.name}, but the row is not visible in the table below.
                </Text>
                <View style={styles.formActionsRow}>
                  <TouchableOpacity
                    style={styles.noticeButton}
                    onPress={() => {
                      onSearchQueryChange('');
                      onStatusFilterChange('all');
                      onTypeFilterChange('all');
                    }}
                  >
                    <Text style={styles.noticeButtonText}>Reveal row</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallGhostButton} onPress={onResetDraft}>
                    <Text style={styles.smallGhostButtonText}>Start new KPI</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Name</Text>
            <TextInput value={draft.name} onChangeText={(name) => {
              const patch: Partial<typeof draft> = { name };
              if (!editing) {
                patch.slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
              }
              onDraftChange(patch);
            }} style={styles.input} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Slug</Text>
            <TextInput value={draft.slug} onChangeText={(slug) => onDraftChange({ slug })} style={styles.input} />
          </View>
          <View style={[styles.formField, styles.formFieldWide]}>
            <Text style={styles.formLabel}>Type</Text>
            <View style={styles.chipRow}>
              {(['PC', 'GP', 'VP', 'Actual', 'Pipeline_Anchor', 'Custom'] as const).map((type) => {
                const selected = draft.type === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => onDraftChange({ type })}
                    style={[styles.formChip, selected && styles.formChipSelected]}
                    accessibilityRole="button"
                    accessibilityHint={getKpiTypeHelp(type)}
                  >
                    <Text style={[styles.formChipText, selected && styles.formChipTextSelected]}>{type}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fieldHelpText}>{getKpiTypeHelp(draft.type)}</Text>
          </View>
          <View style={[styles.formField, styles.formFieldWide]}>
            <Text style={styles.formLabel}>Options</Text>
            <View style={styles.inlineToggleRow}>
              <Pressable
                onPress={() => onDraftChange({ isActive: !draft.isActive })}
                style={[styles.toggleChip, draft.isActive && styles.toggleChipOn]}
              >
                <Text style={[styles.toggleChipText, draft.isActive && styles.toggleChipTextOn]}>
                  {draft.isActive ? 'Active' : 'Inactive'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  onDraftChange({ requiresDirectValueInput: !draft.requiresDirectValueInput })
                }
                style={[styles.toggleChip, draft.requiresDirectValueInput && styles.toggleChipOn]}
              >
                <Text
                  style={[
                    styles.toggleChipText,
                    draft.requiresDirectValueInput && styles.toggleChipTextOn,
                  ]}
                >
                  Direct Value Input
                </Text>
              </Pressable>
            </View>
            <Text style={styles.fieldHelpText}>
              `Direct Value Input` means users enter the numeric value for this KPI event directly (not just a count/tap).
            </Text>
          </View>
          <View style={[styles.formField, styles.formFieldWide]}>
            <KpiIconPicker
              value={{
                icon_source: draft.iconSource ?? null,
                icon_name: draft.iconName ?? null,
                icon_emoji: null,
                icon_file: draft.iconSource === 'brand_asset' ? draft.iconName ?? null : null,
              }}
              onChange={(next) =>
                onDraftChange({
                  iconSource: next.icon_source ?? null,
                  iconName: next.icon_name ?? null,
                })
              }
              kpiType={draft.type}
            />
          </View>
          {draft.type === 'PC' ? (
            <>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>PC Weight</Text>
                <TextInput
                  value={draft.pcWeight}
                  onChangeText={(pcWeight) => onDraftChange({ pcWeight })}
                  style={styles.input}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldHelpText}>
                  Decimal weight. Match the scale used by existing PC KPIs in this catalog (for example `0.05` to `0.15`, not `0.35`).
                </Text>
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Delay Days</Text>
                <TextInput
                  value={draft.delayDays}
                  onChangeText={(delayDays) => onDraftChange({ delayDays })}
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="30"
                />
                <Text style={styles.fieldHelpText}>
                  Days before projected credit starts applying.
                </Text>
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Hold Days</Text>
                <TextInput
                  value={draft.holdDays}
                  onChangeText={(holdDays) => onDraftChange({ holdDays })}
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="30"
                />
                <Text style={styles.fieldHelpText}>
                  Duration of the credit window before decay begins.
                </Text>
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Decay Days</Text>
                <TextInput
                  value={draft.decayDays}
                  onChangeText={(decayDays) => onDraftChange({ decayDays })}
                  style={styles.input}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldHelpText}>Number of days for projected effect to decay after TTC/hold timing.</Text>
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Total TTC (derived)</Text>
                <View style={styles.readonlyValueBox}>
                  <Text style={styles.readonlyValueText}>
                    {(() => {
                      const d = Number(draft.delayDays);
                      const h = Number(draft.holdDays);
                      if (!Number.isFinite(d) || !Number.isFinite(h)) return 'Enter delay + hold';
                      return `${Math.max(0, d + h)} days`;
                    })()}
                  </Text>
                </View>
                <Text style={styles.fieldHelpText}>
                  Range view is `delay to delay+hold`. Example: `30` + `30` = range `30-60 days`.
                </Text>
              </View>
            </>
          ) : null}
          {draft.type === 'GP' ? (
            <View style={styles.formField}>
              <Text style={styles.formLabel}>GP Value</Text>
              <TextInput
                value={draft.gpValue}
                onChangeText={(gpValue) => onDraftChange({ gpValue })}
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
          ) : null}
          {draft.type === 'VP' ? (
            <View style={styles.formField}>
              <Text style={styles.formLabel}>VP Value</Text>
              <TextInput
                value={draft.vpValue}
                onChangeText={(vpValue) => onDraftChange({ vpValue })}
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
          ) : null}
        </View>
        {saveError ? <Text style={[styles.metaRow, styles.errorText]}>Error: {saveError}</Text> : null}
        {successMessage ? <Text style={[styles.metaRow, styles.successText]}>{successMessage}</Text> : null}
        <View style={styles.formActionsRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={editing ? onSubmitUpdate : onSubmitCreate}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create KPI'}
            </Text>
          </TouchableOpacity>
          {editing ? (
            <TouchableOpacity
              style={styles.warnButton}
              onPress={onDeactivate}
              disabled={saving}
            >
              <Text style={styles.warnButtonText}>{saving ? 'Working...' : 'Deactivate'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      </View>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={styles.detailEmptySubtitle}>Select a KPI to edit, or tap + New to create.</Text>
          </View>
        )}
      {/* ── Sortable reference table (always visible) ── */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.summaryLabel}>KPI Reference Table</Text>
          <Text style={styles.metaRow}>{sortedFilteredRows.length} items{hasActiveFilters ? ` (${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'})` : ''}</Text>
        </View>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
            <View style={{ flex: 1 }}>
              <View style={styles.tableHeaderRow}>
                <Pressable style={styles.colWide} onPress={() => onSortHeaderPress('kpi')}>
                  <Text style={[styles.tableHeaderCell, sortKey === 'kpi' && styles.tableHeaderCellActive]}>{kpiSortLabel('kpi', 'KPI')}</Text>
                </Pressable>
                <Pressable style={styles.colMd} onPress={() => onSortHeaderPress('type')}>
                  <Text style={[styles.tableHeaderCell, sortKey === 'type' && styles.tableHeaderCellActive]}>{kpiSortLabel('type', 'Type')}</Text>
                </Pressable>
                <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('pc_weight')}>
                  <Text style={[styles.tableHeaderCell, sortKey === 'pc_weight' && styles.tableHeaderCellActive]}>{kpiSortLabel('pc_weight', 'Weight')}</Text>
                </Pressable>
                <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('gp_value')}>
                  <Text style={[styles.tableHeaderCell, sortKey === 'gp_value' && styles.tableHeaderCellActive]}>{kpiSortLabel('gp_value', 'GP Val')}</Text>
                </Pressable>
                <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('vp_value')}>
                  <Text style={[styles.tableHeaderCell, sortKey === 'vp_value' && styles.tableHeaderCellActive]}>{kpiSortLabel('vp_value', 'VP Val')}</Text>
                </Pressable>
                <Pressable style={styles.colMd} onPress={() => onSortHeaderPress('range')}>
                  <Text style={[styles.tableHeaderCell, sortKey === 'range' && styles.tableHeaderCellActive]}>{kpiSortLabel('range', 'Range')}</Text>
                </Pressable>
                <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('ttc')}>
                  <Text style={[styles.tableHeaderCell, sortKey === 'ttc' && styles.tableHeaderCellActive]}>{kpiSortLabel('ttc', 'TTC')}</Text>
                </Pressable>
                <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('decay')}>
                  <Text style={[styles.tableHeaderCell, sortKey === 'decay' && styles.tableHeaderCellActive]}>{kpiSortLabel('decay', 'Decay')}</Text>
                </Pressable>
                <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('status')}>
                  <Text style={[styles.tableHeaderCell, sortKey === 'status' && styles.tableHeaderCellActive]}>{kpiSortLabel('status', 'Status')}</Text>
                </Pressable>
                <Pressable style={styles.colMd} onPress={() => onSortHeaderPress('updated')}>
                  <Text style={[styles.tableHeaderCell, sortKey === 'updated' && styles.tableHeaderCellActive]}>{kpiSortLabel('updated', 'Updated')}</Text>
                </Pressable>
              </View>
              {visibleRows.map((row) => {
                const isSelected = selectedRowId === row.id;
                return (
                  <Pressable
                    key={row.id}
                    style={[styles.tableDataRow, isSelected && styles.tableDataRowSelectedStrong]}
                    onPress={() => { setIsCreating(false); onSelectRow(row); }}
                    accessibilityRole="button"
                  >
                    <View style={styles.colWide}><Text style={styles.tableCell} numberOfLines={1}>{row.name}</Text></View>
                    <View style={styles.colMd}><Text style={styles.tableCell}>{row.type}</Text></View>
                    <View style={styles.colSm}><Text style={styles.tableCell}>{row.pc_weight != null ? String(row.pc_weight) : '—'}</Text></View>
                    <View style={styles.colSm}><Text style={styles.tableCell}>{row.gp_value != null ? String(row.gp_value) : '—'}</Text></View>
                    <View style={styles.colSm}><Text style={styles.tableCell}>{row.vp_value != null ? String(row.vp_value) : '—'}</Text></View>
                    <View style={styles.colMd}><Text style={styles.tableCell}>{formatKpiRange(row)}</Text></View>
                    <View style={styles.colSm}><Text style={styles.tableCell}>{row.ttc_days != null ? `${row.ttc_days}d` : '—'}</Text></View>
                    <View style={styles.colSm}><Text style={styles.tableCell}>{row.decay_days != null ? `${row.decay_days}d` : '—'}</Text></View>
                    <View style={styles.colSm}><Text style={[styles.tableCell, { color: row.is_active ? '#16A34A' : '#DC2626' }]}>{row.is_active ? 'Active' : 'Inactive'}</Text></View>
                    <View style={styles.colMd}><Text style={styles.tableCell}>{row.updated_at ? formatDateTimeShort(row.updated_at) : '—'}</Text></View>
                  </Pressable>
                );
              })}
              {sortedFilteredRows.length > visibleRowCount ? (
                <TouchableOpacity style={styles.listShowMore} onPress={() => setVisibleRowCount((prev) => prev + 24)}>
                  <Text style={styles.listShowMoreText}>Show more ({sortedFilteredRows.length - visibleRowCount})</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
      </ScrollView>
      </View>
    </View>
  );
}

function AdminChallengeTemplatesPanel({
  rows,
  kpiRows,
  loading,
  error,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  draft,
  onDraftChange,
  onSelectRow,
  onResetDraft,
  onSubmitCreate,
  onSubmitUpdate,
  onDeactivate,
  saving,
  saveError,
  successMessage,
}: {
  rows: AdminChallengeTemplateRow[];
  kpiRows: AdminKpiRow[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (value: 'all' | 'active' | 'inactive') => void;
  draft: TemplateFormDraft;
  onDraftChange: (patch: Partial<TemplateFormDraft>) => void;
  onSelectRow: (row: AdminChallengeTemplateRow) => void;
  onResetDraft: () => void;
  onSubmitCreate: () => void;
  onSubmitUpdate: () => void;
  onDeactivate: () => void;
  saving: boolean;
  saveError: string | null;
  successMessage: string | null;
}) {
  type TemplateSortKey = 'template' | 'status' | 'updated';
  const [visibleRowCount, setVisibleRowCount] = useState(24);
  const [sortKey, setSortKey] = useState<TemplateSortKey>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const editing = Boolean(draft.id);
  const selectedRowId = draft.id ?? null;
  const hasActiveFilters = Boolean(searchQuery.trim() || statusFilter !== 'all');
  const activeFilterCount = (searchQuery.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);
  const filteredRows = rows.filter((row) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      row.name.toLowerCase().includes(q) ||
      (row.description ?? '').toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? row.is_active : !row.is_active);
    return matchesSearch && matchesStatus;
  });
  const sortedFilteredRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let result = 0;
      switch (sortKey) {
        case 'template':
          result =
            compareStrings(a.name, b.name) ||
            compareStrings(a.description ?? '', b.description ?? '') ||
            compareStrings(a.id, b.id);
          break;
        case 'status':
          result = compareBooleans(a.is_active, b.is_active) || compareStrings(a.name, b.name);
          break;
        case 'updated':
          result = compareDates(a.updated_at, b.updated_at) || compareStrings(a.name, b.name);
          break;
      }
      return applySortDirection(result, sortDirection);
    });
  }, [filteredRows, sortDirection, sortKey]);
  const selectedRow = selectedRowId ? rows.find((row) => row.id === selectedRowId) ?? null : null;
  const selectedRowInFilteredIndex = selectedRowId ? sortedFilteredRows.findIndex((row) => row.id === selectedRowId) : -1;
  const selectedRowHiddenByFilters = Boolean(selectedRowId && selectedRowInFilteredIndex === -1);
  const visibleRows = sortedFilteredRows.slice(0, visibleRowCount);

  const activeKpis = useMemo(() => kpiRows.filter((k) => k.is_active), [kpiRows]);
  const kpiNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const k of kpiRows) map[k.id] = k.name;
    return map;
  }, [kpiRows]);

  const onSortHeaderPress = (nextKey: TemplateSortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'updated' ? 'desc' : 'asc');
  };

  const templateSortLabel = (key: TemplateSortKey, label: string) =>
    `${label}${sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}`;

  useEffect(() => {
    if (selectedRowInFilteredIndex >= 0 && selectedRowInFilteredIndex >= visibleRowCount) {
      setVisibleRowCount(selectedRowInFilteredIndex + 1);
    }
  }, [selectedRowInFilteredIndex, visibleRowCount]);

  useEffect(() => {
    setVisibleRowCount(24);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    setVisibleRowCount(24);
  }, [rows]);

  // Builder step navigation
  const builderSteps: TemplateBuilderStep[] = ['basics', 'phases', 'kpi_goals', 'review'];
  const stepLabels: Record<TemplateBuilderStep, string> = { basics: 'Basics', phases: 'Phases', kpi_goals: 'KPI Goals', review: 'Review' };
  const currentStepIndex = builderSteps.indexOf(draft.builderStep);
  const goToStep = (step: TemplateBuilderStep) => onDraftChange({ builderStep: step });
  const goNext = () => { if (currentStepIndex < builderSteps.length - 1) goToStep(builderSteps[currentStepIndex + 1]); };
  const goBack = () => { if (currentStepIndex > 0) goToStep(builderSteps[currentStepIndex - 1]); };

  // Phase helpers — phases tile contiguously across total duration
  const totalDays = parseInt(draft.durationDays, 10) || 0;
  const usedDays = draft.phases.reduce((sum, p) => sum + (parseInt(p.phase_days, 10) || 0), 0);
  const remainingDays = totalDays - usedDays;

  const addPhase = () => {
    const next = [...draft.phases];
    if (next.length > 0) {
      // New phase becomes the last phase and gets whatever remains
      const usedByExisting = next.reduce((s, p) => s + (parseInt(p.phase_days, 10) || 0), 0);
      const remaining = Math.max(0, totalDays - usedByExisting);
      next.push({ phase_name: `Phase ${next.length + 1}`, phase_days: String(remaining), kpi_goals: [] });
    } else {
      next.push({ phase_name: 'Phase 1', phase_days: totalDays > 0 ? String(totalDays) : '', kpi_goals: [] });
    }
    onDraftChange({ phases: next });
  };
  const removePhase = (index: number) => {
    const next = [...draft.phases];
    const removedDays = parseInt(next[index].phase_days, 10) || 0;
    next.splice(index, 1);
    // Give removed days to the last remaining phase
    if (next.length > 0) {
      const lastIdx = next.length - 1;
      const lastDays = parseInt(next[lastIdx].phase_days, 10) || 0;
      next[lastIdx] = { ...next[lastIdx], phase_days: String(lastDays + removedDays) };
    }
    onDraftChange({ phases: next });
  };
  const updatePhase = (index: number, patch: Partial<TemplatePhaseDraft>) => {
    const next = [...draft.phases];
    next[index] = { ...next[index], ...patch };
    // Auto-calculate last phase when any earlier phase's days change
    if ('phase_days' in patch && next.length > 1 && index < next.length - 1) {
      const nonLastUsed = next.slice(0, -1).reduce((s, p) => s + (parseInt(p.phase_days, 10) || 0), 0);
      const lastPhaseAuto = Math.max(0, totalDays - nonLastUsed);
      next[next.length - 1] = { ...next[next.length - 1], phase_days: String(lastPhaseAuto) };
    }
    onDraftChange({ phases: next });
  };
  const addGoalToPhase = (phaseIndex: number) => {
    const next = [...draft.phases];
    next[phaseIndex] = { ...next[phaseIndex], kpi_goals: [...next[phaseIndex].kpi_goals, { kpi_id: '', target_value: '', goal_scope: 'team' }] };
    onDraftChange({ phases: next });
  };
  const removeGoalFromPhase = (phaseIndex: number, goalIndex: number) => {
    const next = [...draft.phases];
    next[phaseIndex] = { ...next[phaseIndex], kpi_goals: next[phaseIndex].kpi_goals.filter((_, i) => i !== goalIndex) };
    onDraftChange({ phases: next });
  };
  const updateGoalInPhase = (phaseIndex: number, goalIndex: number, patch: Partial<TemplatePhaseGoalDraft>) => {
    const next = [...draft.phases];
    const nextGoals = [...next[phaseIndex].kpi_goals];
    nextGoals[goalIndex] = { ...nextGoals[goalIndex], ...patch };
    next[phaseIndex] = { ...next[phaseIndex], kpi_goals: nextGoals };
    onDraftChange({ phases: next });
  };

  // Single-phase (phaseless) goal helpers
  const addSinglePhaseGoal = () => {
    onDraftChange({ singlePhaseGoals: [...draft.singlePhaseGoals, { kpi_id: '', target_value: '', goal_scope: 'team' }] });
  };
  const removeSinglePhaseGoal = (goalIndex: number) => {
    onDraftChange({ singlePhaseGoals: draft.singlePhaseGoals.filter((_, i) => i !== goalIndex) });
  };
  const updateSinglePhaseGoal = (goalIndex: number, patch: Partial<TemplatePhaseGoalDraft>) => {
    const next = [...draft.singlePhaseGoals];
    next[goalIndex] = { ...next[goalIndex], ...patch };
    onDraftChange({ singlePhaseGoals: next });
  };

  // Compute phase start days for display (cumulative from phase durations)
  const phaseStartDays: number[] = [];
  {
    let running = 1;
    for (const p of draft.phases) {
      phaseStartDays.push(running);
      running += parseInt(p.phase_days, 10) || 0;
    }
  }

  // KPI type filter for step 3
  type KpiSectionFilter = 'all' | 'PC' | 'GP' | 'VP' | 'other';
  const [kpiSectionFilter, setKpiSectionFilter] = useState<KpiSectionFilter>('all');
  const kpiSectionLabel: Record<KpiSectionFilter, string> = { all: 'All', PC: 'Projection', GP: 'Growth', VP: 'Vitality', other: 'Other' };
  const filteredActiveKpis = useMemo(() => {
    if (kpiSectionFilter === 'all') return activeKpis;
    if (kpiSectionFilter === 'other') return activeKpis.filter((k) => !['PC', 'GP', 'VP'].includes(k.type));
    return activeKpis.filter((k) => k.type === kpiSectionFilter);
  }, [activeKpis, kpiSectionFilter]);

  // Review validation
  const reviewErrors: string[] = [];
  if (!draft.name.trim()) reviewErrors.push('Theme name is required');
  const dd = parseInt(draft.durationDays, 10);
  if (!draft.durationDays.trim() || !Number.isFinite(dd) || dd < 1) reviewErrors.push('Duration must be at least 1 day');
  if (draft.phases.length > 0 && remainingDays < 0) reviewErrors.push(`Phase days exceed total duration by ${Math.abs(remainingDays)}`);
  for (let i = 0; i < draft.phases.length; i++) {
    const p = draft.phases[i];
    if (!p.phase_name.trim()) reviewErrors.push(`Phase ${i + 1}: name required`);
    const pd = parseInt(p.phase_days, 10);
    if (!Number.isFinite(pd) || pd < 1) reviewErrors.push(`Phase ${i + 1}: days must be >= 1`);
    if (p.kpi_goals.length === 0) reviewErrors.push(`Phase ${i + 1}: needs at least 1 KPI goal`);
    for (let j = 0; j < p.kpi_goals.length; j++) {
      const g = p.kpi_goals[j];
      if (!g.kpi_id) reviewErrors.push(`Phase ${i + 1}, Goal ${j + 1}: KPI required`);
      const tv = parseFloat(g.target_value);
      if (!Number.isFinite(tv) || tv <= 0) reviewErrors.push(`Phase ${i + 1}, Goal ${j + 1}: target must be positive`);
    }
  }
  // Validate single-phase goals
  if (draft.phases.length === 0) {
    for (let j = 0; j < draft.singlePhaseGoals.length; j++) {
      const g = draft.singlePhaseGoals[j];
      if (!g.kpi_id) reviewErrors.push(`Goal ${j + 1}: KPI required`);
      const tv = parseFloat(g.target_value);
      if (!Number.isFinite(tv) || tv <= 0) reviewErrors.push(`Goal ${j + 1}: target must be positive`);
    }
  }

  return (
    <View style={styles.listDetailContainer}>
      {/* Left panel: search + filter + list */}
      <View style={styles.listPanel}>
        <View style={styles.listPanelHeader}>
          <Text style={styles.listPanelTitle}>Templates</Text>
          <TouchableOpacity style={styles.listPanelCreateBtn} onPress={onResetDraft}>
            <Text style={styles.listPanelCreateBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          style={styles.listSearchInput}
          placeholder="Search templates..."
          placeholderTextColor="#94A3B8"
        />
        <View style={styles.listFilterRow}>
          {(['all', 'active', 'inactive'] as const).map((value) => {
            const sel = statusFilter === value;
            return (
              <Pressable
                key={value}
                onPress={() => onStatusFilterChange(value)}
                style={[styles.listFilterPill, sel && styles.listFilterPillSelected]}
              >
                <Text style={[styles.listFilterPillText, sel && styles.listFilterPillTextSelected]}>
                  {value === 'all' ? 'All' : value === 'active' ? 'Active' : 'Inactive'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.listCountText}>
          {filteredRows.length} of {rows.length}
        </Text>
        {loading ? <Text style={styles.listCountText}>Loading...</Text> : null}
        {error ? <Text style={[styles.listCountText, styles.errorText]}>Error: {error}</Text> : null}
        <ScrollView style={styles.listScrollView}>
          {visibleRows.map((row) => {
            const isSelected = selectedRowId === row.id;
            const phaseCount = row.template_payload?.phases?.length ?? 0;
            const durLabel = row.suggested_duration_days != null ? `${row.suggested_duration_days}d` : '';
            return (
              <Pressable
                key={row.id}
                style={[styles.listRow, isSelected && styles.listRowSelected]}
                onPress={() => onSelectRow(row)}
                accessibilityRole="button"
              >
                <Text style={[styles.listRowTitle, isSelected && styles.listRowTitleSelected]} numberOfLines={1}>{row.name}</Text>
                <View style={styles.listRowMeta}>
                  <View style={[styles.listRowDot, { backgroundColor: row.is_active ? '#22C55E' : '#EF4444' }]} />
                  <Text style={styles.listRowBadge} numberOfLines={1}>
                    {[durLabel, phaseCount > 0 ? `${phaseCount} phase${phaseCount !== 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || row.description?.trim() || '(no description)'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          {filteredRows.length > visibleRowCount ? (
            <TouchableOpacity style={styles.listShowMore} onPress={() => setVisibleRowCount((prev) => prev + 24)}>
              <Text style={styles.listShowMoreText}>Show more ({filteredRows.length - visibleRowCount})</Text>
            </TouchableOpacity>
          ) : null}
          {!loading && filteredRows.length === 0 ? (
            <View style={styles.listEmptyState}>
              <Text style={styles.listEmptyText}>{rows.length === 0 ? 'No templates loaded.' : 'No matches.'}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
      {/* Right panel: multi-step builder */}
      <View style={styles.detailPanel}>
        {!editing && !draft.showForm ? (
          <View style={styles.detailEmptyState}>
            <Text style={styles.detailEmptyTitle}>Select a Template</Text>
            <Text style={styles.detailEmptySubtitle}>Choose from the list to view or edit, or tap + New.</Text>
          </View>
        ) : (
      <ScrollView contentContainerStyle={styles.detailScrollInner}>
      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>{editing ? 'Edit Template' : 'Create Template'}</Text>
          <TouchableOpacity style={styles.smallGhostButton} onPress={onResetDraft}>
            <Text style={styles.smallGhostButtonText}>{editing ? 'New Template' : 'Clear'}</Text>
          </TouchableOpacity>
        </View>

        {/* Step indicator */}
        <View style={{ flexDirection: 'row', marginBottom: 16, gap: 4 }}>
          {builderSteps.map((step, idx) => {
            const active = step === draft.builderStep;
            const completed = idx < currentStepIndex;
            return (
              <Pressable key={step} onPress={() => goToStep(step)} style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 6, backgroundColor: active ? '#1D4ED8' : completed ? '#DBEAFE' : '#F1F5F9', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: active ? '700' : '500', color: active ? '#FFFFFF' : completed ? '#1D4ED8' : '#64748B' }}>{idx + 1}. {stepLabels[step]}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Selected template summary (editing) */}
        {selectedRow ? (
          <View style={styles.selectedUserSummaryCard}>
            <View style={styles.formHeaderRow}>
              <View>
                <Text style={styles.formTitle}>Selected Template</Text>
                <Text style={styles.metaRow}>{selectedRow.name}</Text>
              </View>
              <View style={[styles.statusChip, selectedRow.is_active ? { backgroundColor: '#EFFCF4', borderColor: '#BFE6CC' } : { backgroundColor: '#FFF4F2', borderColor: '#F2C0B9' }]}>
                <Text style={[styles.statusChipText, { color: selectedRow.is_active ? '#1D7A4D' : '#B2483A' }]}>{selectedRow.is_active ? 'active' : 'inactive'}</Text>
              </View>
            </View>
            {selectedRowHiddenByFilters ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeTitle}>Selected template hidden by filters</Text>
                <View style={styles.formActionsRow}>
                  <TouchableOpacity style={styles.noticeButton} onPress={() => { onSearchQueryChange(''); onStatusFilterChange('all'); }}>
                    <Text style={styles.noticeButtonText}>Reveal row</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* === Step 1: Basics === */}
        {draft.builderStep === 'basics' ? (
          <View style={{ gap: 12 }}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Theme Name *</Text>
              <TextInput value={draft.name} onChangeText={(name) => onDraftChange({ name })} style={styles.input} placeholder="e.g. Hurry Up and Call" placeholderTextColor="#94A3B8" />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput value={draft.description} onChangeText={(description) => onDraftChange({ description })} style={[styles.input, styles.inputMultiline]} multiline placeholder="What this challenge template is about..." placeholderTextColor="#94A3B8" />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Default Challenge Name</Text>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Prefills the challenge name at creation. Falls back to theme name.</Text>
              <TextInput value={draft.defaultChallengeName} onChangeText={(v) => onDraftChange({ defaultChallengeName: v })} style={styles.input} placeholder="(uses theme name if empty)" placeholderTextColor="#94A3B8" />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.formLabel}>Duration (days) *</Text>
                <TextInput value={draft.durationDays} onChangeText={(v) => onDraftChange({ durationDays: v })} style={styles.input} keyboardType="number-pad" placeholder="e.g. 30" placeholderTextColor="#94A3B8" />
              </View>
              <View style={[styles.formField, { flex: 1 }]}>
                <Text style={styles.formLabel}>Status</Text>
                <Pressable onPress={() => onDraftChange({ isActive: !draft.isActive })} style={[styles.toggleChip, draft.isActive && styles.toggleChipOn, { marginTop: 2 }]}>
                  <Text style={[styles.toggleChipText, draft.isActive && styles.toggleChipTextOn]}>{draft.isActive ? 'Active' : 'Inactive'}</Text>
                </Pressable>
              </View>
            </View>
            {draft.durationDays.trim() && Number.isFinite(parseInt(draft.durationDays, 10)) && parseInt(draft.durationDays, 10) >= 1 ? (
              <View style={{ backgroundColor: '#F0F9FF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#BAE6FD' }}>
                <Text style={{ fontSize: 12, color: '#0369A1', fontWeight: '600' }}>{parseInt(draft.durationDays, 10)} day{parseInt(draft.durationDays, 10) !== 1 ? 's' : ''} ({Math.ceil(parseInt(draft.durationDays, 10) / 7)} week{Math.ceil(parseInt(draft.durationDays, 10) / 7) !== 1 ? 's' : ''})</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* === Step 2: Phase Plan === */}
        {draft.builderStep === 'phases' ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 12, color: '#64748B' }}>
              Optional — split the challenge into distinct phases with separate KPI goals.{'\n'}Skip this step for a simple single-phase challenge.
            </Text>
            {draft.phases.length === 0 ? (
              <View style={{ backgroundColor: '#F0F9FF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#BAE6FD' }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#0369A1', marginBottom: 2 }}>No phases — single-phase challenge</Text>
                <Text style={{ fontSize: 11, color: '#0C4A6E' }}>The entire {totalDays > 0 ? `${totalDays}-day` : ''} duration is one phase. KPI goals are set when the challenge is created. Tap Next to continue, or add phases below.</Text>
              </View>
            ) : null}
            {/* Duration bar */}
            {totalDays > 0 ? (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, color: '#0369A1', fontWeight: '600' }}>Total: {totalDays} days</Text>
                  {draft.phases.length > 0 ? (
                    <Text style={{ fontSize: 11, color: remainingDays < 0 ? '#DC2626' : remainingDays > 0 ? '#D97706' : '#16A34A', fontWeight: '600' }}>
                      {remainingDays === 0 ? 'Fully allocated' : remainingDays > 0 ? `${remainingDays}d unallocated` : `${Math.abs(remainingDays)}d over`}
                    </Text>
                  ) : null}
                </View>
                {draft.phases.length > 0 ? (
                  <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#E2E8F0' }}>
                    {draft.phases.map((phase, pi) => {
                      const pd = parseInt(phase.phase_days, 10) || 0;
                      const pct = totalDays > 0 ? (pd / totalDays) * 100 : 0;
                      const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#14B8A6'];
                      return <View key={pi} style={{ width: `${Math.min(pct, 100)}%` as unknown as number, backgroundColor: colors[pi % colors.length] }} />;
                    })}
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ backgroundColor: '#FFFBEB', borderRadius: 6, padding: 8, borderWidth: 1, borderColor: '#FDE68A' }}>
                <Text style={{ fontSize: 11, color: '#92400E' }}>Set a duration in Basics first.</Text>
              </View>
            )}
            {draft.phases.map((phase, pi) => {
              const pd = parseInt(phase.phase_days, 10) || 0;
              const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#14B8A6'];
              return (
                <View key={pi} style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', borderLeftWidth: 3, borderLeftColor: colors[pi % colors.length] }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>Phase {pi + 1}</Text>
                      <Text style={{ fontSize: 11, color: '#64748B' }}>day {phaseStartDays[pi]}–{phaseStartDays[pi] + pd - 1}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removePhase(pi)}><Text style={{ fontSize: 12, color: '#EF4444' }}>Remove</Text></TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={[styles.formField, { flex: 2 }]}>
                      <Text style={styles.formLabel}>Name</Text>
                      <TextInput value={phase.phase_name} onChangeText={(v) => updatePhase(pi, { phase_name: v })} style={styles.input} placeholder="e.g. Ramp-Up" placeholderTextColor="#94A3B8" />
                    </View>
                    <View style={[styles.formField, { flex: 1 }]}>
                      <Text style={styles.formLabel}>{pi === draft.phases.length - 1 && draft.phases.length > 1 ? 'Days (auto)' : 'Days'}</Text>
                      {pi === draft.phases.length - 1 && draft.phases.length > 1 ? (
                        <View style={[styles.input, { backgroundColor: '#F1F5F9', justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 14, color: '#475569', fontWeight: '600' }}>{phase.phase_days || '0'}</Text>
                        </View>
                      ) : (
                        <TextInput value={phase.phase_days} onChangeText={(v) => updatePhase(pi, { phase_days: v })} style={styles.input} keyboardType="number-pad" placeholder="7" placeholderTextColor="#94A3B8" />
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
            {draft.phases.length < 8 ? (
              <TouchableOpacity onPress={addPhase} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#EFF6FF', borderRadius: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BFDBFE' }}>
                <Text style={{ fontSize: 13, color: '#1D4ED8', fontWeight: '600' }}>+ Add Phase</Text>
              </TouchableOpacity>
            ) : <Text style={{ fontSize: 11, color: '#94A3B8' }}>Maximum 8 phases reached.</Text>}
          </View>
        ) : null}

        {/* === Step 3: KPI Goals === */}
        {draft.builderStep === 'kpi_goals' ? (
          <View style={{ gap: 14 }}>
            {draft.phases.length === 0 ? (
              /* ---- Single-phase (no explicit phases) ---- */
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>Challenge Goals</Text>
                  {totalDays > 0 ? <Text style={{ fontSize: 11, color: '#64748B' }}>{totalDays} days, single phase</Text> : null}
                </View>
                {draft.singlePhaseGoals.map((goal, gi) => {
                  const selectedKpiName = goal.kpi_id ? kpiNameById[goal.kpi_id] || '(unknown)' : '';
                  return (
                    <View key={gi} style={{ backgroundColor: '#F8FAFC', borderRadius: 6, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Goal {gi + 1}</Text>
                        <TouchableOpacity onPress={() => removeSinglePhaseGoal(gi)}><Text style={{ fontSize: 11, color: '#EF4444' }}>Remove</Text></TouchableOpacity>
                      </View>
                      <View style={styles.formField}>
                        <Text style={styles.formLabel}>KPI</Text>
                        {activeKpis.length === 0 ? (
                          <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 8 }}>No active KPIs found. Add KPIs in the KPIs tab first.</Text>
                        ) : (
                          <View style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
                            {goal.kpi_id ? (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#EFF6FF' }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#1D4ED8' }}>{selectedKpiName}</Text>
                                <TouchableOpacity onPress={() => updateSinglePhaseGoal(gi, { kpi_id: '' })}><Text style={{ fontSize: 11, color: '#64748B' }}>Change</Text></TouchableOpacity>
                              </View>
                            ) : (
                              <View>
                                <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                                  {(['all', 'PC', 'GP', 'VP', 'other'] as KpiSectionFilter[]).map((f) => {
                                    const sel = kpiSectionFilter === f;
                                    return (
                                      <Pressable key={f} onPress={() => setKpiSectionFilter(f)} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: sel ? '#3B82F6' : '#F1F5F9' }}>
                                        <Text style={{ fontSize: 10, fontWeight: '600', color: sel ? '#FFFFFF' : '#64748B' }}>{kpiSectionLabel[f]}</Text>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                                <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                                  {filteredActiveKpis.length === 0 ? (
                                    <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', padding: 10 }}>No KPIs in this category.</Text>
                                  ) : filteredActiveKpis.map((kpi) => (
                                    <Pressable key={kpi.id} onPress={() => updateSinglePhaseGoal(gi, { kpi_id: kpi.id })} style={{ paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                      <Text style={{ fontSize: 12, color: '#334155' }}>{kpi.name}</Text>
                                    </Pressable>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                        <View style={[styles.formField, { flex: 1 }]}>
                          <Text style={styles.formLabel}>Target / person</Text>
                          <TextInput value={goal.target_value} onChangeText={(v) => updateSinglePhaseGoal(gi, { target_value: v })} style={styles.input} keyboardType="numeric" placeholder="e.g. 10" placeholderTextColor="#94A3B8" />
                          <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                            {goal.goal_scope === 'team' ? 'Multiplied by team size at runtime' : 'Each member targets this individually'}
                          </Text>
                        </View>
                        <View style={[styles.formField, { flex: 1 }]}>
                          <Text style={styles.formLabel}>Scope</Text>
                          <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                            {(['team', 'individual'] as const).map((scope) => {
                              const sel = goal.goal_scope === scope;
                              return (
                                <Pressable key={scope} onPress={() => updateSinglePhaseGoal(gi, { goal_scope: scope })} style={[styles.listFilterPill, sel && styles.listFilterPillSelected, { flex: 1, alignItems: 'center' }]}>
                                  <Text style={[styles.listFilterPillText, sel && styles.listFilterPillTextSelected]}>{scope === 'individual' ? 'Indiv.' : 'Team'}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
                {draft.singlePhaseGoals.length < 12 ? (
                  <TouchableOpacity onPress={addSinglePhaseGoal} style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#F0FDF4', borderRadius: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BBF7D0', marginTop: 2 }}>
                    <Text style={{ fontSize: 12, color: '#166534', fontWeight: '600' }}>+ Add KPI Goal</Text>
                  </TouchableOpacity>
                ) : <Text style={{ fontSize: 11, color: '#94A3B8' }}>Max 12 KPI goals.</Text>}
              </View>
            ) : draft.phases.map((phase, pi) => (
              /* ---- Multi-phase: goals per phase ---- */
              <View key={pi}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>{phase.phase_name || `Phase ${pi + 1}`}</Text>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>day {phaseStartDays[pi]}–{phaseStartDays[pi] + (parseInt(phase.phase_days, 10) || 1) - 1}</Text>
                </View>
                {phase.kpi_goals.map((goal, gi) => {
                  const selectedKpiName = goal.kpi_id ? kpiNameById[goal.kpi_id] || '(unknown)' : '';
                  return (
                    <View key={gi} style={{ backgroundColor: '#F8FAFC', borderRadius: 6, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#E2E8F0' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>Goal {gi + 1}</Text>
                        <TouchableOpacity onPress={() => removeGoalFromPhase(pi, gi)}><Text style={{ fontSize: 11, color: '#EF4444' }}>Remove</Text></TouchableOpacity>
                      </View>
                      <View style={styles.formField}>
                        <Text style={styles.formLabel}>KPI</Text>
                        {activeKpis.length === 0 ? (
                          <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 8 }}>No active KPIs found. Add KPIs in the KPIs tab first.</Text>
                        ) : (
                          <View style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, backgroundColor: '#FFFFFF', overflow: 'hidden' }}>
                            {goal.kpi_id ? (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#EFF6FF' }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#1D4ED8' }}>{selectedKpiName}</Text>
                                <TouchableOpacity onPress={() => updateGoalInPhase(pi, gi, { kpi_id: '' })}><Text style={{ fontSize: 11, color: '#64748B' }}>Change</Text></TouchableOpacity>
                              </View>
                            ) : (
                              <View>
                                <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                                  {(['all', 'PC', 'GP', 'VP', 'other'] as KpiSectionFilter[]).map((f) => {
                                    const sel = kpiSectionFilter === f;
                                    return (
                                      <Pressable key={f} onPress={() => setKpiSectionFilter(f)} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: sel ? '#3B82F6' : '#F1F5F9' }}>
                                        <Text style={{ fontSize: 10, fontWeight: '600', color: sel ? '#FFFFFF' : '#64748B' }}>{kpiSectionLabel[f]}</Text>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                                <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                                  {filteredActiveKpis.length === 0 ? (
                                    <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', padding: 10 }}>No KPIs in this category.</Text>
                                  ) : filteredActiveKpis.map((kpi) => (
                                    <Pressable key={kpi.id} onPress={() => updateGoalInPhase(pi, gi, { kpi_id: kpi.id })} style={{ paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                      <Text style={{ fontSize: 12, color: '#334155' }}>{kpi.name}</Text>
                                    </Pressable>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                        <View style={[styles.formField, { flex: 1 }]}>
                          <Text style={styles.formLabel}>Target / person</Text>
                          <TextInput value={goal.target_value} onChangeText={(v) => updateGoalInPhase(pi, gi, { target_value: v })} style={styles.input} keyboardType="numeric" placeholder="e.g. 10" placeholderTextColor="#94A3B8" />
                          <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                            {goal.goal_scope === 'team' ? 'Multiplied by team size at runtime' : 'Each member targets this individually'}
                          </Text>
                        </View>
                        <View style={[styles.formField, { flex: 1 }]}>
                          <Text style={styles.formLabel}>Scope</Text>
                          <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
                            {(['team', 'individual'] as const).map((scope) => {
                              const sel = goal.goal_scope === scope;
                              return (
                                <Pressable key={scope} onPress={() => updateGoalInPhase(pi, gi, { goal_scope: scope })} style={[styles.listFilterPill, sel && styles.listFilterPillSelected, { flex: 1, alignItems: 'center' }]}>
                                  <Text style={[styles.listFilterPillText, sel && styles.listFilterPillTextSelected]}>{scope === 'individual' ? 'Indiv.' : 'Team'}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
                {phase.kpi_goals.length < 12 ? (
                  <TouchableOpacity onPress={() => addGoalToPhase(pi)} style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#F0FDF4', borderRadius: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BBF7D0', marginTop: 2 }}>
                    <Text style={{ fontSize: 12, color: '#166534', fontWeight: '600' }}>+ Add KPI Goal</Text>
                  </TouchableOpacity>
                ) : <Text style={{ fontSize: 11, color: '#94A3B8' }}>Max 12 KPI goals per phase.</Text>}
              </View>
            ))}
          </View>
        ) : null}

        {/* === Step 4: Review + Save === */}
        {draft.builderStep === 'review' ? (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 8 }}>Template Summary</Text>
              <Text style={{ fontSize: 12, color: '#475569', marginBottom: 3 }}>Theme: {draft.name || '(empty)'}</Text>
              {draft.description ? <Text style={{ fontSize: 12, color: '#475569', marginBottom: 3 }}>Description: {draft.description}</Text> : null}
              {draft.defaultChallengeName ? <Text style={{ fontSize: 12, color: '#475569', marginBottom: 3 }}>Default Name: {draft.defaultChallengeName}</Text> : null}
              <Text style={{ fontSize: 12, color: '#475569', marginBottom: 3 }}>Duration: {draft.durationDays || '?'} days</Text>
              <Text style={{ fontSize: 12, color: '#475569', marginBottom: 3 }}>Phases: {draft.phases.length > 0 ? draft.phases.length : 'Single phase'}</Text>
              <Text style={{ fontSize: 12, color: '#475569' }}>Status: {draft.isActive ? 'Active' : 'Inactive'}</Text>
            </View>
            {draft.phases.length > 0 ? (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B', marginBottom: 6 }}>Phase Timeline</Text>
                {draft.phases.map((phase, pi) => (
                  <View key={pi} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', marginRight: 8 }} />
                    <Text style={{ fontSize: 12, color: '#334155' }}>Day {phaseStartDays[pi]}–{phaseStartDays[pi] + (parseInt(phase.phase_days, 10) || 1) - 1}: {phase.phase_name || `Phase ${pi + 1}`} ({phase.phase_days || '?'}d) — {phase.kpi_goals.length} KPI goal{phase.kpi_goals.length !== 1 ? 's' : ''}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {draft.phases.length > 0 ? (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B', marginBottom: 6 }}>KPI Goals (per person)</Text>
                {draft.phases.map((phase, pi) => (
                  <View key={pi} style={{ marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569' }}>{phase.phase_name || `Phase ${pi + 1}`}</Text>
                    {phase.kpi_goals.map((g, gi) => (
                      <Text key={gi} style={{ fontSize: 11, color: '#64748B', marginLeft: 12 }}>
                        {kpiNameById[g.kpi_id] || g.kpi_id || '(no KPI)'}: {g.target_value || '?'}/person{g.goal_scope === 'team' ? ' × team size' : ' (individual)'}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            ) : draft.singlePhaseGoals.length > 0 ? (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B', marginBottom: 6 }}>Challenge Goals (per person)</Text>
                {draft.singlePhaseGoals.map((g, gi) => (
                  <Text key={gi} style={{ fontSize: 11, color: '#64748B', marginLeft: 12 }}>
                    {kpiNameById[g.kpi_id] || g.kpi_id || '(no KPI)'}: {g.target_value || '?'}/person{g.goal_scope === 'team' ? ' × team size' : ' (individual)'}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>No KPI goals added yet.</Text>
            )}
            {reviewErrors.length > 0 ? (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#FECACA' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#991B1B', marginBottom: 4 }}>Validation Issues</Text>
                {reviewErrors.map((err, i) => <Text key={i} style={{ fontSize: 12, color: '#991B1B', marginBottom: 2 }}>• {err}</Text>)}
              </View>
            ) : null}
            {saveError ? <Text style={[styles.metaRow, styles.errorText]}>Error: {saveError}</Text> : null}
            {successMessage ? <Text style={[styles.metaRow, styles.successText]}>{successMessage}</Text> : null}
          </View>
        ) : null}

        {/* Step navigation + save */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {currentStepIndex > 0 ? (
              <TouchableOpacity style={styles.smallGhostButton} onPress={goBack}><Text style={styles.smallGhostButtonText}>Back</Text></TouchableOpacity>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {draft.builderStep === 'review' ? (
              <>
                <TouchableOpacity style={[styles.primaryButton, reviewErrors.length > 0 && { opacity: 0.5 }]} onPress={editing ? onSubmitUpdate : onSubmitCreate} disabled={saving || reviewErrors.length > 0}>
                  <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Template'}</Text>
                </TouchableOpacity>
                {editing ? (
                  <TouchableOpacity style={styles.warnButton} onPress={onDeactivate} disabled={saving}>
                    <Text style={styles.warnButtonText}>{saving ? 'Working...' : 'Deactivate'}</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (() => {
              const phaseDaysInvalid = draft.builderStep === 'phases' && draft.phases.length > 0 && (remainingDays !== 0 || draft.phases.some((p) => (parseInt(p.phase_days, 10) || 0) < 1));
              return (
                <TouchableOpacity style={[styles.primaryButton, phaseDaysInvalid && { opacity: 0.5 }]} onPress={goNext} disabled={phaseDaysInvalid}>
                  <Text style={styles.primaryButtonText}>Next</Text>
                </TouchableOpacity>
              );
            })()}
          </View>
        </View>
      </View>
      </ScrollView>
        )}
      </View>
    </View>
  );
}

function AdminUsersPanel({
  rows,
  loading,
  error,
  searchQuery,
  onSearchQueryChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  selectedUser,
  userDraft,
  onSelectUser,
  onUserDraftChange,
  createUserDraft,
  onCreateUserDraftChange,
  onCreateUserSubmit,
  onCreateUserReset,
  devPreviewActive,
  onRefreshUsers,
  onSaveUser,
  onResetCalibration,
  onReinitializeCalibration,
  lastRefreshedAt,
  rowLimit,
  onShowMoreRows,
  onResetRowLimit,
  testUsersOnly,
  onToggleTestUsersOnly,
  showRecentFirst,
  onToggleShowRecentFirst,
  knownUserEmailsById,
  copyNotice,
  onCopyUserId,
  onCopyUserEmail,
  createUserSaving,
  createUserError,
  createUserSuccessMessage,
  userSaving,
  userSaveError,
  userSuccessMessage,
  calibrationLoading,
  calibrationError,
  calibrationSnapshot,
  calibrationEvents,
  calibrationActionLoading,
  onBulkStatusUpdate,
  bulkStatusUpdateLoading,
}: {
  rows: AdminUserRow[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  roleFilter: 'all' | 'agent' | 'team_leader' | 'admin' | 'super_admin';
  onRoleFilterChange: (value: 'all' | 'agent' | 'team_leader' | 'admin' | 'super_admin') => void;
  statusFilter: 'all' | 'active' | 'deactivated';
  onStatusFilterChange: (value: 'all' | 'active' | 'deactivated') => void;
  selectedUser: AdminUserRow | null;
  userDraft: UserFormDraft;
  onSelectUser: (row: AdminUserRow) => void;
  onUserDraftChange: (patch: Partial<UserFormDraft>) => void;
  createUserDraft: CreateUserDraft;
  onCreateUserDraftChange: (patch: Partial<CreateUserDraft>) => void;
  onCreateUserSubmit: () => void;
  onCreateUserReset: () => void;
  devPreviewActive: boolean;
  onRefreshUsers: () => void;
  onSaveUser: () => void;
  onResetCalibration: () => void;
  onReinitializeCalibration: () => void;
  lastRefreshedAt: string | null;
  rowLimit: number;
  onShowMoreRows: () => void;
  onResetRowLimit: () => void;
  testUsersOnly: boolean;
  onToggleTestUsersOnly: () => void;
  showRecentFirst: boolean;
  onToggleShowRecentFirst: () => void;
  knownUserEmailsById: KnownUserEmailMap;
  copyNotice: string | null;
  onCopyUserId: () => void;
  onCopyUserEmail: () => void;
  createUserSaving: boolean;
  createUserError: string | null;
  createUserSuccessMessage: string | null;
  userSaving: boolean;
  userSaveError: string | null;
  userSuccessMessage: string | null;
  calibrationLoading: boolean;
  calibrationError: string | null;
  calibrationSnapshot: AdminUserCalibrationSnapshot | null;
  calibrationEvents: AdminUserCalibrationEvent[];
  calibrationActionLoading: boolean;
  onBulkStatusUpdate: (userIds: string[], status: 'active' | 'deactivated') => Promise<BulkUserStatusUpdateResult>;
  bulkStatusUpdateLoading: boolean;
}) {
  type UserSortKey = 'user' | 'role' | 'tier' | 'status' | 'last_active' | 'user_id';
  const [showAllCalibrationRows, setShowAllCalibrationRows] = useState(false);
  const [showAllCalibrationEvents, setShowAllCalibrationEvents] = useState(false);
  const [userActivityFeed, setUserActivityFeed] = useState<Array<{ id: string; tone: 'success' | 'error' | 'info'; text: string; at: string }>>([]);
  const [sortKey, setSortKey] = useState<UserSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [quickActionsMenuOpen, setQuickActionsMenuOpen] = useState(false);
  const [calibrationMenuOpen, setCalibrationMenuOpen] = useState(false);
  const [calibrationDiagnosticsExpanded, setCalibrationDiagnosticsExpanded] = useState(false);
  const [bulkActionsMenuOpen, setBulkActionsMenuOpen] = useState(false);
  const [bulkActionNotice, setBulkActionNotice] = useState<string | null>(null);

  const pushUserActivity = (tone: 'success' | 'error' | 'info', text: string) => {
    setUserActivityFeed((prev) => {
      const next = [{ id: `${Date.now()}-${Math.random()}`, tone, text, at: new Date().toISOString() }, ...prev];
      return next.slice(0, 8);
    });
  };

  useEffect(() => {
    if (userSuccessMessage) pushUserActivity('success', userSuccessMessage);
  }, [userSuccessMessage]);

  useEffect(() => {
    if (userSaveError) pushUserActivity('error', userSaveError);
  }, [userSaveError]);

  useEffect(() => {
    if (createUserSuccessMessage) pushUserActivity('success', createUserSuccessMessage);
  }, [createUserSuccessMessage]);

  useEffect(() => {
    if (createUserError) pushUserActivity('error', createUserError);
  }, [createUserError]);

  useEffect(() => {
    if (copyNotice) pushUserActivity('info', copyNotice);
  }, [copyNotice]);

  useEffect(() => {
    if (calibrationError) pushUserActivity('error', `Calibration: ${calibrationError}`);
  }, [calibrationError]);

  const filteredRows = rows.filter((row) => {
    const q = searchQuery.trim().toLowerCase();
    const knownEmail = (row.email ?? knownUserEmailsById[row.id] ?? '').toLowerCase();
    const knownName = (row.name ?? '').toLowerCase();
    const isRecent =
      row.created_at != null && Date.now() - new Date(row.created_at).getTime() < 1000 * 60 * 60 * 24 * 7;
    const looksTest = knownEmail.includes('test') || row.id === selectedUser?.id || isRecent;
    const matchesSearch =
      !q ||
      row.id.toLowerCase().includes(q) ||
      knownName.includes(q) ||
      (row.role ?? '').toLowerCase().includes(q) ||
      (row.tier ?? '').toLowerCase().includes(q) ||
      knownEmail.includes(q);
    const matchesRole = roleFilter === 'all' || row.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || row.account_status === statusFilter;
    const matchesTestUsers = !testUsersOnly || looksTest;
    return matchesSearch && matchesRole && matchesStatus && matchesTestUsers;
  }).sort((a, b) => {
    if (!showRecentFirst) return 0;
    const aKnown = knownUserEmailsById[a.id] ?? '';
    const bKnown = knownUserEmailsById[b.id] ?? '';
    const aIsCreatedInSession = aKnown ? 1 : 0;
    const bIsCreatedInSession = bKnown ? 1 : 0;
    if (aIsCreatedInSession !== bIsCreatedInSession) return bIsCreatedInSession - aIsCreatedInSession;
    const aTime = new Date(a.created_at ?? a.updated_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? b.updated_at ?? 0).getTime();
    return bTime - aTime;
  });
  const sortedFilteredRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      let result = 0;
      switch (sortKey) {
        case 'user': {
          const aName = (a.name ?? '').trim();
          const bName = (b.name ?? '').trim();
          const aEmail = (a.email ?? knownUserEmailsById[a.id] ?? '').trim();
          const bEmail = (b.email ?? knownUserEmailsById[b.id] ?? '').trim();
          result = compareStrings(aName || aEmail || a.id, bName || bEmail || b.id);
          break;
        }
        case 'role':
          result = compareStrings(a.role ?? '', b.role ?? '') || compareStrings(a.id, b.id);
          break;
        case 'tier':
          result = compareStrings(a.tier ?? '', b.tier ?? '') || compareStrings(a.id, b.id);
          break;
        case 'status':
          result = compareStrings(a.account_status ?? '', b.account_status ?? '') || compareStrings(a.id, b.id);
          break;
        case 'last_active':
          result = compareDates(a.last_activity_timestamp, b.last_activity_timestamp) || compareStrings(a.id, b.id);
          break;
        case 'user_id':
          result = compareStrings(a.id, b.id);
          break;
      }

      if (result !== 0) return applySortDirection(result, sortDirection);

      if (showRecentFirst) {
        const aKnown = knownUserEmailsById[a.id] ?? '';
        const bKnown = knownUserEmailsById[b.id] ?? '';
        const aIsCreatedInSession = aKnown ? 1 : 0;
        const bIsCreatedInSession = bKnown ? 1 : 0;
        if (aIsCreatedInSession !== bIsCreatedInSession) return bIsCreatedInSession - aIsCreatedInSession;
      }
      return 0;
    });
  }, [filteredRows, knownUserEmailsById, showRecentFirst, sortDirection, sortKey]);
  const diagnostics = calibrationSnapshot?.diagnostics ?? null;
  const calibrationRows = calibrationSnapshot?.rows ?? [];
  const selectedVisibleRows = sortedFilteredRows.slice(0, rowLimit);
  const selectedVisibleRowIds = selectedVisibleRows.map((row) => row.id);
  const hasVisibleRowsForBulk = selectedVisibleRowIds.length > 0;
  const selectedUserEmail = selectedUser ? selectedUser.email ?? knownUserEmailsById[selectedUser.id] ?? null : null;
  const hasPendingUserChanges = Boolean(
    selectedUser &&
      (userDraft.role !== selectedUser.role ||
        userDraft.tier !== selectedUser.tier ||
        userDraft.accountStatus !== selectedUser.account_status)
  );
  const pendingUserChangeLabels = selectedUser
    ? [
        userDraft.role !== selectedUser.role ? `role: ${selectedUser.role} -> ${userDraft.role}` : null,
        userDraft.tier !== selectedUser.tier ? `tier: ${selectedUser.tier} -> ${userDraft.tier}` : null,
        userDraft.accountStatus !== selectedUser.account_status
          ? `status: ${selectedUser.account_status} -> ${userDraft.accountStatus}`
          : null,
      ].filter(Boolean) as string[]
    : [];
  const selectedUserLooksTest = Boolean(
    selectedUser &&
      ((selectedUser.email ?? knownUserEmailsById[selectedUser.id] ?? '').toLowerCase().includes('test') ||
        Boolean(selectedUser.created_at && Date.now() - new Date(selectedUser.created_at).getTime() < 1000 * 60 * 60 * 24 * 7))
  );
  const visibleCalibrationRows = showAllCalibrationRows ? calibrationRows : calibrationRows.slice(0, 5);
  const visibleCalibrationEvents = showAllCalibrationEvents ? calibrationEvents : calibrationEvents.slice(0, 4);
  const activeUserFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    (roleFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (testUsersOnly ? 1 : 0);
  const hasNoUserResults = !loading && !error && rows.length > 0 && filteredRows.length === 0;
  const selectedUserHiddenByFilters = Boolean(
    selectedUser && !sortedFilteredRows.some((row) => row.id === selectedUser.id)
  );
  const activeSortLabel = sortKey ? `${sortKey.replace('_', ' ')} (${sortDirection})` : (showRecentFirst ? 'recent-first heuristic' : 'default order');
  const clearUserFiltersAndRecovery = () => {
    onSearchQueryChange('');
    onRoleFilterChange('all');
    onStatusFilterChange('all');
    if (testUsersOnly) onToggleTestUsersOnly();
    if (!showRecentFirst) onToggleShowRecentFirst();
    onResetRowLimit();
  };
  const onUserSortHeaderPress = (nextKey: UserSortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(nextKey);
      setSortDirection(nextKey === 'last_active' ? 'desc' : 'asc');
    }
  };
  const userSortLabel = (key: UserSortKey, label: string) =>
    `${label}${sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}`;
  const runVisibleBulkStatusUpdate = async (nextStatus: 'active' | 'deactivated') => {
    if (!selectedVisibleRowIds.length) {
      setBulkActionNotice('No visible rows to update. Adjust filters or row window first.');
      return;
    }
    const confirmed = await confirmDangerAction(
      `Apply status "${nextStatus}" to ${selectedVisibleRowIds.length} visible user row(s)?`
    );
    if (!confirmed) return;
    const result = await onBulkStatusUpdate(selectedVisibleRowIds, nextStatus);
    if (result.failedCount > 0) {
      setBulkActionNotice(
        `Applied "${nextStatus}" to ${result.updatedCount} row(s); ${result.failedCount} failed (${result.failedIds.slice(0, 4).join(', ')}${result.failedCount > 4 ? ', ...' : ''}).`
      );
      return;
    }
    setBulkActionNotice(`Applied "${nextStatus}" to ${result.updatedCount} visible row(s).`);
  };

  useEffect(() => {
    onResetRowLimit();
  }, [searchQuery, roleFilter, statusFilter, testUsersOnly, showRecentFirst, sortKey, sortDirection]);

  return (
    <View style={styles.panel}>
      {copyNotice ? <Text style={[styles.metaRow, styles.successText, { paddingHorizontal: 16, paddingTop: 8 }]}>{copyNotice}</Text> : null}

      {userSaveError ? (
        <View style={styles.alertErrorBox}>
          <Text style={styles.alertErrorTitle}>User save error</Text>
          <Text style={styles.alertErrorText} selectable>{userSaveError}</Text>
        </View>
      ) : null}
      {userSuccessMessage ? (
        <View style={styles.alertSuccessBox}>
          <Text style={styles.alertSuccessTitle}>User action complete</Text>
          <Text style={styles.alertSuccessText}>{userSuccessMessage}</Text>
        </View>
      ) : null}
      {userActivityFeed.length ? (
        <View style={styles.activityFeedCard}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.formTitle}>Recent Operator Activity</Text>
            <Text style={styles.metaRow}>Latest {userActivityFeed.length}</Text>
          </View>
          {userActivityFeed.map((item) => (
            <View key={item.id} style={styles.activityFeedRow}>
              <View
                style={[
                  styles.activityFeedDot,
                  item.tone === 'success'
                    ? styles.activityFeedDotSuccess
                    : item.tone === 'error'
                      ? styles.activityFeedDotError
                      : styles.activityFeedDotInfo,
                ]}
              />
              <View style={styles.activityFeedCopy}>
                <Text style={styles.activityFeedText} selectable>{item.text}</Text>
                <Text style={styles.activityFeedMeta}>{formatDateTimeShort(item.at)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>Create Test User</Text>
          <TouchableOpacity style={styles.smallGhostButton} onPress={onCreateUserReset}>
            <Text style={styles.smallGhostButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.metaRow}>
          Create a non-super-admin account for A3 role/tier testing without risking the current super admin user.
        </Text>
        {devPreviewActive ? (
          <Text style={styles.fieldHelpText}>
            Dev AuthZ Preview only changes UI guards. Backend create-user permissions still use your live session role.
          </Text>
        ) : null}
        <View style={styles.formGrid}>
          <View style={[styles.formField, styles.formFieldWide]}>
            <Text style={styles.formLabel}>Email</Text>
            <TextInput
              value={createUserDraft.email}
              onChangeText={(email) => onCreateUserDraftChange({ email })}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="test.user+admin@compass.local"
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Temporary Password</Text>
            <TextInput
              value={createUserDraft.password}
              onChangeText={(password) => onCreateUserDraftChange({ password })}
              style={styles.input}
              secureTextEntry
              placeholder="Min 8 characters"
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Role</Text>
            <View style={styles.chipRow}>
              {(['agent', 'team_leader', 'admin'] as const).map((role) => {
                const selected = createUserDraft.role === role;
                return (
                  <Pressable
                    key={role}
                    onPress={() => onCreateUserDraftChange({ role })}
                    style={[styles.formChip, selected && styles.formChipSelected]}
                  >
                    <Text style={[styles.formChipText, selected && styles.formChipTextSelected]}>{role}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Tier</Text>
            <View style={styles.chipRow}>
              {(['free', 'basic', 'teams', 'enterprise'] as const).map((tier) => {
                const selected = createUserDraft.tier === tier;
                return (
                  <Pressable
                    key={tier}
                    onPress={() => onCreateUserDraftChange({ tier })}
                    style={[styles.formChip, selected && styles.formChipSelected]}
                  >
                    <Text style={[styles.formChipText, selected && styles.formChipTextSelected]}>{tier}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Account Status</Text>
            <View style={styles.inlineToggleRow}>
              {(['active', 'deactivated'] as const).map((status) => {
                const selected = createUserDraft.accountStatus === status;
                return (
                  <Pressable
                    key={status}
                    onPress={() => onCreateUserDraftChange({ accountStatus: status })}
                    style={[styles.toggleChip, selected && styles.toggleChipOn]}
                  >
                    <Text style={[styles.toggleChipText, selected && styles.toggleChipTextOn]}>{status}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
        {createUserError ? (
          <View style={styles.alertErrorBox}>
            <Text style={styles.alertErrorTitle}>Create user error</Text>
            <Text style={styles.alertErrorText} selectable>{createUserError}</Text>
          </View>
        ) : null}
        {createUserSuccessMessage ? (
          <View style={styles.alertSuccessBox}>
            <Text style={styles.alertSuccessTitle}>User created</Text>
            <Text style={styles.alertSuccessText} selectable>{createUserSuccessMessage}</Text>
          </View>
        ) : null}
        <View style={styles.formActionsRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={onCreateUserSubmit} disabled={createUserSaving}>
            <Text style={styles.primaryButtonText}>{createUserSaving ? 'Creating...' : 'Create User'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterBar}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>Find & Select User</Text>
          <Text style={styles.metaRow}>Filter and select an account to manage access and calibration.</Text>
        </View>
        <View style={styles.usersFilterSummaryRow}>
          <Text style={styles.metaRow}>
            {filteredRows.length} filtered / {rows.length} total
            {activeUserFilterCount ? ` • ${activeUserFilterCount} filter${activeUserFilterCount === 1 ? '' : 's'} active` : ' • no filters'}
            {showRecentFirst ? ' • recent-first sort' : ''}
            {sortKey ? ` • column sort: ${activeSortLabel}` : ''}
          </Text>
          <View style={styles.formActionsRow}>
            {activeUserFilterCount > 0 || !showRecentFirst ? (
              <TouchableOpacity style={styles.smallGhostButton} onPress={clearUserFiltersAndRecovery}>
                <Text style={styles.smallGhostButtonText}>Reset filters</Text>
              </TouchableOpacity>
            ) : null}
            {searchQuery.trim() ? (
              <TouchableOpacity style={styles.smallGhostButton} onPress={() => onSearchQueryChange('')}>
                <Text style={styles.smallGhostButtonText}>Clear search</Text>
              </TouchableOpacity>
            ) : null}
            {sortKey ? (
              <TouchableOpacity style={styles.smallGhostButton} onPress={() => setSortKey(null)}>
                <Text style={styles.smallGhostButtonText}>Reset sort</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <View style={[styles.formField, styles.formFieldWide]}>
          <Text style={styles.formLabel}>Search</Text>
          <TextInput
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            style={styles.input}
            placeholder="Search user id / name / email / role / tier"
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Role</Text>
          <View style={styles.inlineToggleRow}>
            {(['all', 'agent', 'team_leader', 'admin', 'super_admin'] as const).map((value) => {
              const selected = roleFilter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => onRoleFilterChange(value)}
                  style={[styles.toggleChip, selected && styles.toggleChipOn]}
                >
                  <Text style={[styles.toggleChipText, selected && styles.toggleChipTextOn]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Status</Text>
          <View style={styles.inlineToggleRow}>
            {(['all', 'active', 'deactivated'] as const).map((value) => {
              const selected = statusFilter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => onStatusFilterChange(value)}
                  style={[styles.toggleChip, selected && styles.toggleChipOn]}
                >
                  <Text style={[styles.toggleChipText, selected && styles.toggleChipTextOn]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Test User Focus</Text>
          <View style={styles.inlineToggleRow}>
            <Pressable
              onPress={onToggleTestUsersOnly}
              style={[styles.toggleChip, testUsersOnly && styles.toggleChipOn]}
            >
              <Text style={[styles.toggleChipText, testUsersOnly && styles.toggleChipTextOn]}>
                {testUsersOnly ? 'Test Users Only' : 'All Users'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onToggleShowRecentFirst}
              style={[styles.toggleChip, showRecentFirst && styles.toggleChipOn]}
            >
              <Text style={[styles.toggleChipText, showRecentFirst && styles.toggleChipTextOn]}>
                {showRecentFirst ? 'Recent First' : 'Default Sort'}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.fieldHelpText}>Uses recent accounts and known test-user emails to make QA users easier to find and reuse.</Text>
        </View>
      </View>

      <View style={styles.usersTopSplit}>
        <View style={[styles.tableWrap, { flex: 1, minWidth: 320 }]}>
          <View style={[styles.formHeaderRow, { paddingHorizontal: 12, paddingTop: 10 }]}>
            <Text style={styles.formTitle}>User List</Text>
            <View style={styles.formActionsRow}>
              <TouchableOpacity style={styles.smallGhostButton} onPress={onRefreshUsers}>
                <Text style={styles.smallGhostButtonText}>Refresh</Text>
              </TouchableOpacity>
              <View style={styles.menuWrap}>
                <TouchableOpacity
                  style={styles.smallGhostButton}
                  onPress={() => setBulkActionsMenuOpen((prev) => !prev)}
                  disabled={bulkStatusUpdateLoading}
                >
                  <Text style={styles.smallGhostButtonText}>
                    {bulkStatusUpdateLoading
                      ? 'Applying...'
                      : bulkActionsMenuOpen
                        ? 'Hide Bulk Actions'
                        : 'Bulk Actions'}
                  </Text>
                </TouchableOpacity>
                {bulkActionsMenuOpen ? (
                  <View style={styles.menuList}>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        void runVisibleBulkStatusUpdate('active');
                        setBulkActionsMenuOpen(false);
                      }}
                      disabled={!hasVisibleRowsForBulk || bulkStatusUpdateLoading}
                    >
                      <Text style={styles.menuItemText}>Set visible rows to active</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        void runVisibleBulkStatusUpdate('deactivated');
                        setBulkActionsMenuOpen(false);
                      }}
                      disabled={!hasVisibleRowsForBulk || bulkStatusUpdateLoading}
                    >
                      <Text style={styles.menuItemText}>Set visible rows to deactivated</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          <Text style={[styles.metaRow, { paddingHorizontal: 12 }]}>Click a user row to open access/tier controls and calibration details.</Text>
          <Text style={[styles.fieldHelpText, { paddingHorizontal: 12 }]}>
            Bulk actions apply to the current visible row window ({selectedVisibleRows.length} rows), so filters and Show more control the exact batch.
          </Text>
          {bulkActionNotice ? (
            <Text style={[styles.metaRow, styles.successText, { paddingHorizontal: 12 }]}>{bulkActionNotice}</Text>
          ) : null}
          {testUsersOnly ? (
            <Text style={[styles.fieldHelpText, { paddingHorizontal: 12, paddingBottom: 2 }]}>
              Test-user mode uses email/name heuristics and recent activity to prioritize QA accounts.
            </Text>
          ) : null}
          {loading ? <Text style={[styles.metaRow, { paddingHorizontal: 12 }]}>Loading users...</Text> : null}
          {error ? <Text style={[styles.metaRow, styles.errorText, { paddingHorizontal: 12 }]}>Error: {error}</Text> : null}
          {selectedUserHiddenByFilters ? (
            <View style={[styles.noticeBox, { marginHorizontal: 12, marginTop: 8 }]}>
              <Text style={styles.noticeTitle}>Selected user is hidden by current filters</Text>
              <Text style={styles.noticeText}>
                {selectedUser?.name?.trim() || selectedUser?.id} is still selected for the right-side panel, but the row is not visible in the list.
              </Text>
              <View style={styles.formActionsRow}>
                <TouchableOpacity style={styles.noticeButton} onPress={clearUserFiltersAndRecovery}>
                  <Text style={styles.noticeButtonText}>Show selected row</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {!loading && !error ? (
            <>
              <View style={[styles.formHeaderRow, { paddingHorizontal: 12 }]}>
                <Text style={styles.metaRow}>
                  {filteredRows.length === 0
                    ? (rows.length === 0 ? 'No user rows loaded yet.' : `No users match current filters (${rows.length} total loaded)`)
                    : `Showing ${selectedVisibleRows.length} of ${filteredRows.length} filtered rows (${rows.length} total loaded)`}
                </Text>
                <View style={styles.formActionsRow}>
                  {filteredRows.length > rowLimit ? (
                    <TouchableOpacity style={styles.smallGhostButton} onPress={onShowMoreRows}>
                      <Text style={styles.smallGhostButtonText}>
                        Show more ({Math.max(0, filteredRows.length - rowLimit)} left)
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {rowLimit > 16 ? (
                    <TouchableOpacity style={styles.smallGhostButton} onPress={onResetRowLimit}>
                      <Text style={styles.smallGhostButtonText}>Reset rows</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <View style={styles.tableHeaderRow}>
                <Pressable style={styles.colMd} onPress={() => onUserSortHeaderPress('user')} accessibilityRole="button">
                  <Text style={[styles.tableHeaderCell, sortKey === 'user' && styles.tableHeaderCellActive]}>
                    {userSortLabel('user', 'User')}
                  </Text>
                </Pressable>
                <Pressable style={styles.colMd} onPress={() => onUserSortHeaderPress('role')} accessibilityRole="button">
                  <Text style={[styles.tableHeaderCell, sortKey === 'role' && styles.tableHeaderCellActive]}>
                    {userSortLabel('role', 'Role')}
                  </Text>
                </Pressable>
                <Pressable style={styles.colSm} onPress={() => onUserSortHeaderPress('tier')} accessibilityRole="button">
                  <Text style={[styles.tableHeaderCell, sortKey === 'tier' && styles.tableHeaderCellActive]}>
                    {userSortLabel('tier', 'Tier')}
                  </Text>
                </Pressable>
                <Pressable style={styles.colSm} onPress={() => onUserSortHeaderPress('status')} accessibilityRole="button">
                  <Text style={[styles.tableHeaderCell, sortKey === 'status' && styles.tableHeaderCellActive]}>
                    {userSortLabel('status', 'Status')}
                  </Text>
                </Pressable>
                <Pressable style={styles.colSm} onPress={() => onUserSortHeaderPress('last_active')} accessibilityRole="button">
                  <Text style={[styles.tableHeaderCell, sortKey === 'last_active' && styles.tableHeaderCellActive]}>
                    {userSortLabel('last_active', 'Last Active')}
                  </Text>
                </Pressable>
                <Pressable style={styles.colMd} onPress={() => onUserSortHeaderPress('user_id')} accessibilityRole="button">
                  <Text style={[styles.tableHeaderCell, sortKey === 'user_id' && styles.tableHeaderCellActive]}>
                    {userSortLabel('user_id', 'User ID')}
                  </Text>
                </Pressable>
              </View>
              {selectedVisibleRows.map((row) => {
                const selected = selectedUser?.id === row.id;
                const rowEmail = row.email ?? knownUserEmailsById[row.id] ?? '';
                const rowLooksTest =
                  rowEmail.toLowerCase().includes('test') ||
                  Boolean(row.created_at && Date.now() - new Date(row.created_at).getTime() < 1000 * 60 * 60 * 24 * 7);
                return (
                  <Pressable
                    key={row.id}
                    style={[styles.tableDataRow, selected && styles.tableDataRowSelectedStrong]}
                    onPress={() => onSelectUser(row)}
                  >
                    <View style={[styles.tableCell, styles.colMd]}>
                      <Text numberOfLines={1} style={styles.tablePrimary}>{row.name?.trim() || '(no name)'}</Text>
                      <Text numberOfLines={1} style={styles.tableSecondary}>{rowEmail || '(email unavailable)'}</Text>
                      {rowLooksTest ? (
                        <View style={styles.rowBadgeLine}>
                          <View style={styles.rowMiniBadge}>
                            <Text style={styles.rowMiniBadgeText}>test/recent</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                    <View style={[styles.tableCell, styles.colMd]}>
                      <Text style={styles.tableCellText}>{row.role}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.colSm]}>
                      <Text style={styles.tableCellText}>{row.tier}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.colSm]}>
                      <Text style={styles.tableCellText}>{row.account_status}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.colSm]}>
                      <Text style={styles.tableCellText}>{formatDateShort(row.last_activity_timestamp)}</Text>
                    </View>
                    <View style={[styles.tableCell, styles.colMd]}>
                      <Text numberOfLines={1} style={styles.tableSecondary}>{row.id}</Text>
                      {(row.email ?? knownUserEmailsById[row.id]) ? (
                        <Text numberOfLines={1} style={styles.tableSecondary}>{row.email ?? knownUserEmailsById[row.id]}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              {filteredRows.length === 0 ? (
                <Text style={styles.tableFootnote}>
                  {rows.length === 0
                    ? 'No users are loaded yet. Refresh users or create a test user to continue.'
                    : 'No users match the current filters. Use Reset filters or Refresh users to restore the list.'}
                </Text>
              ) : filteredRows.length > rowLimit ? (
                <Text style={styles.tableFootnote}>
                  More users are available. Use “Show more” to continue browsing without losing the selected user panel.
                </Text>
              ) : (
                <Text style={styles.tableFootnote}>End of filtered user results.</Text>
              )}
              {hasNoUserResults ? (
                <View style={styles.usersNoResultsCard}>
                  <Text style={styles.usersNoResultsTitle}>No users match the current filters</Text>
                  <Text style={styles.usersNoResultsText}>
                    Try clearing search/filter chips or turn off Test User Focus to restore the full list.
                  </Text>
                  <View style={styles.formActionsRow}>
                    <TouchableOpacity style={styles.smallGhostButton} onPress={clearUserFiltersAndRecovery}>
                      <Text style={styles.smallGhostButtonText}>Reset filters</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.smallGhostButton} onPress={onRefreshUsers}>
                      <Text style={styles.smallGhostButtonText}>Refresh users</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={[styles.formCard, styles.usersOpsCard]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.formTitle}>User Access + Tier</Text>
            <Text style={styles.metaRow}>{selectedUser ? formatDateTimeShort(selectedUser.updated_at) : 'Select a user'}</Text>
          </View>
          {selectedUser ? (
            <>
              <View style={styles.selectedUserSummaryCard}>
                <View style={styles.formHeaderRow}>
                  <View>
                    <Text style={styles.formTitle}>Selected User Summary</Text>
                    <Text style={styles.metaRow}>{selectedUser.name?.trim() || '(no name)'}</Text>
                  </View>
                  <View style={styles.inlineToggleRow}>
                    {selectedUserLooksTest ? (
                      <View style={[styles.statusChip, { backgroundColor: '#EFFCF4', borderColor: '#BFE6CC' }]}>
                        <Text style={[styles.statusChipText, { color: '#1D7A4D' }]}>QA/Test</Text>
                      </View>
                    ) : null}
                    <View style={[styles.statusChip, { backgroundColor: '#F4F8FF', borderColor: '#D8E4FA' }]}>
                      <Text style={[styles.statusChipText, { color: '#345892' }]}>{selectedUser.role}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: '#F4F8FF', borderColor: '#D8E4FA' }]}>
                      <Text style={[styles.statusChipText, { color: '#345892' }]}>{selectedUser.tier}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusChip,
                        selectedUser.account_status === 'active'
                          ? { backgroundColor: '#EFFCF4', borderColor: '#BFE6CC' }
                          : { backgroundColor: '#FFF4F2', borderColor: '#F2C0B9' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          { color: selectedUser.account_status === 'active' ? '#1D7A4D' : '#B2483A' },
                        ]}
                      >
                        {selectedUser.account_status}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.metaRow}>User ID: {selectedUser.id}</Text>
                {selectedUserEmail ? <Text style={styles.metaRow}>Email: {selectedUserEmail}</Text> : null}
                <Text style={styles.metaRow}>
                  Created: {formatDateTimeShort(selectedUser.created_at)} • Last activity: {formatDateTimeShort(selectedUser.last_activity_timestamp)}
                </Text>
              </View>

              <View style={styles.userOpsSection}>
                <View style={styles.formHeaderRow}>
                  <Text style={styles.formTitle}>Quick Actions</Text>
                  <Text style={styles.metaRow}>Copy values for QA login/setup</Text>
                </View>
                <View style={styles.menuWrap}>
                  <TouchableOpacity
                    style={styles.smallGhostButton}
                    onPress={() => setQuickActionsMenuOpen((prev) => !prev)}
                  >
                    <Text style={styles.smallGhostButtonText}>{quickActionsMenuOpen ? 'Hide Quick Actions' : 'Open Quick Actions'}</Text>
                  </TouchableOpacity>
                  {quickActionsMenuOpen ? (
                    <View style={styles.menuList}>
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => {
                          onCopyUserId();
                          setQuickActionsMenuOpen(false);
                        }}
                      >
                        <Text style={styles.menuItemText}>Copy user ID</Text>
                      </TouchableOpacity>
                      {selectedUserEmail ? (
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={() => {
                            onCopyUserEmail();
                            setQuickActionsMenuOpen(false);
                          }}
                        >
                          <Text style={styles.menuItemText}>Copy user email</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.userOpsSection}>
                <View style={styles.formHeaderRow}>
                  <Text style={styles.formTitle}>Access Edits</Text>
                  {hasPendingUserChanges ? (
                    <View style={[styles.statusChip, { backgroundColor: '#FFF7E8', borderColor: '#FFE1AA' }]}>
                      <Text style={[styles.statusChipText, { color: '#8A5600' }]}>Unsaved changes</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusChip, { backgroundColor: '#EFFCF4', borderColor: '#BFE6CC' }]}>
                      <Text style={[styles.statusChipText, { color: '#1D7A4D' }]}>Saved state</Text>
                    </View>
                  )}
                </View>
                {hasPendingUserChanges ? (
                  <Text style={styles.fieldHelpText}>Pending changes: {pendingUserChangeLabels.join(' • ')}</Text>
                ) : (
                  <Text style={styles.fieldHelpText}>No pending access/tier/status changes.</Text>
                )}
                <Text style={styles.formLabel}>Access Controls</Text>
                <View style={styles.formGrid}>
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Role</Text>
                    <View style={styles.chipRow}>
                      {(['agent', 'team_leader', 'admin', 'super_admin'] as const).map((role) => {
                        const selected = userDraft.role === role;
                        return (
                          <Pressable
                            key={role}
                            onPress={() => onUserDraftChange({ role })}
                            style={[styles.formChip, selected && styles.formChipSelected]}
                          >
                            <Text style={[styles.formChipText, selected && styles.formChipTextSelected]}>{role}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Tier</Text>
                    <View style={styles.chipRow}>
                      {(['free', 'basic', 'teams', 'enterprise'] as const).map((tier) => {
                        const selected = userDraft.tier === tier;
                        return (
                          <Pressable
                            key={tier}
                            onPress={() => onUserDraftChange({ tier })}
                            style={[styles.formChip, selected && styles.formChipSelected]}
                          >
                            <Text style={[styles.formChipText, selected && styles.formChipTextSelected]}>{tier}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Account Status</Text>
                    <View style={styles.inlineToggleRow}>
                      {(['active', 'deactivated'] as const).map((status) => {
                        const selected = userDraft.accountStatus === status;
                        return (
                          <Pressable
                            key={status}
                            onPress={() => onUserDraftChange({ accountStatus: status })}
                            style={[styles.toggleChip, selected && styles.toggleChipOn]}
                          >
                            <Text style={[styles.toggleChipText, selected && styles.toggleChipTextOn]}>{status}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
                <View style={styles.formActionsRow}>
                  <TouchableOpacity
                    style={[styles.primaryButton, (userSaving || !hasPendingUserChanges) && styles.primaryButtonDisabled]}
                    onPress={onSaveUser}
                    disabled={userSaving || !hasPendingUserChanges}
                  >
                    <Text style={styles.primaryButtonText}>
                      {userSaving ? 'Saving...' : hasPendingUserChanges ? 'Save User Changes' : 'No Changes to Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.userOpsSection}>
                <View style={styles.formHeaderRow}>
                  <Text style={styles.formTitle}>Calibration Tools</Text>
                  <Text style={styles.metaRow}>Reset or reinitialize user-level calibration state</Text>
                </View>
                <View style={[styles.menuWrap, { marginTop: 2 }]}>
                  <TouchableOpacity
                    style={styles.smallGhostButton}
                    onPress={() => setCalibrationMenuOpen((prev) => !prev)}
                    disabled={calibrationActionLoading}
                  >
                    <Text style={styles.smallGhostButtonText}>
                      {calibrationActionLoading
                        ? 'Working...'
                        : calibrationMenuOpen
                          ? 'Hide Calibration Actions'
                          : 'Open Calibration Actions'}
                    </Text>
                  </TouchableOpacity>
                  {calibrationMenuOpen ? (
                    <View style={styles.menuList}>
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => {
                          onResetCalibration();
                          setCalibrationMenuOpen(false);
                        }}
                        disabled={calibrationActionLoading}
                      >
                        <Text style={styles.menuItemText}>Reset calibration</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => {
                          onReinitializeCalibration();
                          setCalibrationMenuOpen(false);
                        }}
                        disabled={calibrationActionLoading}
                      >
                        <Text style={styles.menuItemText}>Reinitialize from onboarding</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.fieldHelpText}>
                  Use these actions for QA resets when testing calibration behavior across repeated account changes.
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.panelBody}>Select a user row to edit access/tier/status and review calibration diagnostics.</Text>
          )}
        </View>
      </View>

      <Pressable
        style={styles.collapsibleHeader}
        onPress={() => setCalibrationDiagnosticsExpanded((p) => !p)}
        accessibilityRole="button"
      >
        <Text style={styles.collapsibleHeaderText}>Calibration Diagnostics</Text>
        <Text style={styles.collapsibleChevron}>{calibrationDiagnosticsExpanded ? '▾' : '▸'}</Text>
      </Pressable>
      {calibrationDiagnosticsExpanded ? (
      <View style={styles.usersDiagnosticsGrid}>
        <View style={[styles.summaryCard, { flex: 1 }]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.summaryLabel}>Calibration Diagnostics</Text>
            <Text style={styles.metaRow}>{diagnostics ? 'Grouped values' : 'No snapshot'}</Text>
          </View>
          {calibrationLoading ? <Text style={styles.metaRow}>Loading calibration...</Text> : null}
          {calibrationError ? <Text style={[styles.metaRow, styles.errorText]}>Error: {calibrationError}</Text> : null}
          {!calibrationLoading && !calibrationError ? (
            diagnostics ? (
              <>
                {Object.entries(diagnostics).map(([key, value]) => (
                  <View key={key} style={styles.keyValueRow}>
                    <Text style={styles.keyValueLabel}>{formatDiagnosticLabel(key)}</Text>
                    <Text style={styles.keyValueValue}>{formatDiagnosticValue(value)}</Text>
                  </View>
                ))}
                {!Object.keys(diagnostics).length ? <Text style={styles.metaRow}>No diagnostics values returned</Text> : null}
              </>
            ) : (
              <Text style={styles.metaRow}>Select a user to load calibration diagnostics.</Text>
            )
          ) : null}
        </View>
        <View style={[styles.summaryCard, { flex: 1 }]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.summaryLabel}>Calibration Rows</Text>
            <Text style={styles.metaRow}>Rows: {calibrationRows.length}</Text>
          </View>
          {visibleCalibrationRows.map((row) => (
            <View key={`${row.user_id}:${row.kpi_id}`} style={styles.compactDataCard}>
              <Text style={styles.compactDataTitle}>{row.kpi_name ?? row.kpi_id}</Text>
              <View style={styles.compactDataRow}>
                <Text style={styles.compactDataMeta}>Multiplier</Text>
                <Text style={styles.compactDataValue}>{formatDiagnosticValue(row.multiplier ?? 1)}</Text>
              </View>
              <View style={styles.compactDataRow}>
                <Text style={styles.compactDataMeta}>Sample Size</Text>
                <Text style={styles.compactDataValue}>{formatDiagnosticValue(row.sample_size ?? 0)}</Text>
              </View>
            </View>
          ))}
          {calibrationRows.length > 5 ? (
            <TouchableOpacity
              style={styles.smallGhostButton}
              onPress={() => setShowAllCalibrationRows((prev) => !prev)}
            >
              <Text style={styles.smallGhostButtonText}>
                {showAllCalibrationRows ? 'Show fewer rows' : `Show ${calibrationRows.length - 5} more rows`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={[styles.summaryCard, { flex: 1 }]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.summaryLabel}>Calibration Events</Text>
            <Text style={styles.metaRow}>Events: {calibrationEvents.length}</Text>
          </View>
          {visibleCalibrationEvents.map((event) => (
            <View key={event.id} style={styles.compactDataCard}>
              <View style={styles.compactDataRow}>
                <Text style={styles.compactDataMeta}>Time</Text>
                <Text style={styles.compactDataValue}>{formatDateTimeShort(event.created_at)}</Text>
              </View>
              <View style={styles.compactDataRow}>
                <Text style={styles.compactDataMeta}>Error Ratio</Text>
                <Text style={styles.compactDataValue}>{formatDiagnosticValue(event.error_ratio)}</Text>
              </View>
              <View style={styles.compactDataRow}>
                <Text style={styles.compactDataMeta}>Predicted Window</Text>
                <Text style={styles.compactDataValue}>{formatDiagnosticValue(event.predicted_gci_window)}</Text>
              </View>
              <View style={styles.compactDataRow}>
                <Text style={styles.compactDataMeta}>Actual GCI</Text>
                <Text style={styles.compactDataValue}>{formatDiagnosticValue(event.actual_gci)}</Text>
              </View>
            </View>
          ))}
          {calibrationEvents.length > 4 ? (
            <TouchableOpacity
              style={styles.smallGhostButton}
              onPress={() => setShowAllCalibrationEvents((prev) => !prev)}
            >
              <Text style={styles.smallGhostButtonText}>
                {showAllCalibrationEvents ? 'Show fewer events' : `Show ${calibrationEvents.length - 4} more events`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      ) : null}
    </View>
  );
}

type CoachingPortalSurfaceKey =
  | 'coachingUploads'
  | 'coachingLibrary'
  | 'coachingJourneys'
  | 'coachingCohorts'
  | 'coachingChannels';
const COACH_PORTAL_TRANSITION_ROUTE_KEYS: CoachingPortalSurfaceKey[] = [
  'coachingUploads',
  'coachingLibrary',
  'coachingJourneys',
  'coachingCohorts',
  'coachingChannels',
];
const COACH_PORTAL_NAV_ITEMS: Array<{ key: CoachingPortalSurfaceKey; label: string }> = [
  { key: 'coachingLibrary', label: 'Library' },
  { key: 'coachingJourneys', label: 'Journeys' },
  { key: 'coachingCohorts', label: 'Cohorts' },
  { key: 'coachingChannels', label: 'Channels' },
  { key: 'coachingUploads', label: 'Uploads' },
];
const COACH_PORTAL_ROUTE_BLURBS: Record<CoachingPortalSurfaceKey, string> = {
  coachingLibrary: 'Manage reusable lesson packs and campaign assets.',
  coachingJourneys: 'Shape step-by-step learning journeys and release pacing.',
  coachingCohorts: 'Group participants for targeted journey delivery.',
  coachingChannels: 'Run communication streams for cohorts and programs.',
  coachingUploads: 'Bring in new source content for review and publishing.',
};

function AdminCoachingPortalFoundationPanel({
  routeKey,
  effectiveRoles,
  onNavigate,
}: {
  routeKey: CoachingPortalSurfaceKey;
  effectiveRoles: AdminRole[];
  onNavigate: (next: CoachingPortalSurfaceKey) => void;
}) {
  const isCoach = effectiveRoles.includes('coach');
  const isTeamLeader = effectiveRoles.includes('team_leader');
  const isSponsor = effectiveRoles.includes('challenge_sponsor');
  const panelPortalLabel = isCoach ? 'Coach Portal' : isTeamLeader ? 'Team Portal' : isSponsor ? 'Sponsor Portal' : 'Coach Portal';

  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);

  const config: Record<
    CoachingPortalSurfaceKey,
    {
      path: string;
      title: string;
      summary: string;
      subheader: string;
      listTitle: string;
      listColumns: string[];
      listRows: { id: string; c1: string; c2: string; c3: string; c4: string }[];
      detailTitle: string;
      detailBody: string;
      primaryActionLabel: string;
      secondaryActionLabel: string;
    }
  > = {
    coachingUploads: {
      path: '/coach/uploads',
      title: 'Content Uploads',
      summary: 'Publish-ready upload intake for lessons, attachments, and campaign assets.',
      subheader: 'Upload flow is scoped by role and connected to Library + Journeys release pipelines.',
      listTitle: 'Recent Upload Batches',
      listColumns: ['Batch', 'Owner', 'Scope', 'Status'],
      listRows: [
        { id: 'up-301', c1: 'Open House Scripts', c2: 'Coach Avery', c3: 'Coach shared', c4: 'Ready' },
        { id: 'up-302', c1: 'Team Objection Cards', c2: 'Team Leader Jamie', c3: 'Team-scoped', c4: 'Review' },
        { id: 'up-303', c1: 'Sponsor CTA Pack', c2: 'Sponsor North', c3: 'Sponsor-scoped', c4: 'Ready' },
      ],
      detailTitle: 'Upload Batch Detail',
      detailBody: 'Review metadata, assign tags, and route approved assets into the coach library.',
      primaryActionLabel: 'Start New Upload',
      secondaryActionLabel: 'Open Library',
    },
    coachingLibrary: {
      path: '/coach/library',
      title: 'Content Library',
      summary: 'Discover and package approved coaching assets by audience and delivery context.',
      subheader: 'Library powers Journeys, Cohort programs, and Channel campaigns.',
      listTitle: 'Library Collection',
      listColumns: ['Asset', 'Category', 'Audience', 'Updated'],
      listRows: [
        { id: 'lib-410', c1: 'Buyer Follow-up Kit', c2: 'Lesson Pack', c3: 'All teams', c4: 'Today' },
        { id: 'lib-411', c1: 'Sponsor Event Promo', c2: 'Campaign', c3: 'Sponsor cohort', c4: 'Yesterday' },
        { id: 'lib-412', c1: 'New Agent Sprint', c2: 'Onboarding', c3: 'Cohort-based', c4: '2d ago' },
      ],
      detailTitle: 'Asset Detail',
      detailBody: 'Preview content metadata, active assignments, and linked journeys/channels.',
      primaryActionLabel: 'Create Collection',
      secondaryActionLabel: 'Open Journeys',
    },
    coachingJourneys: {
      path: '/coach/journeys',
      title: 'Journeys',
      summary: 'Design member progression paths with staged modules and release checkpoints.',
      subheader: 'Journeys consume library assets and target cohorts or channel segments.',
      listTitle: 'Journey Programs',
      listColumns: ['Journey', 'Audience', 'Modules', 'State'],
      listRows: [
        { id: 'jr-501', c1: '30-Day Listing Accelerator', c2: 'New listing cohort', c3: '8', c4: 'Live' },
        { id: 'jr-502', c1: 'Team Production Sprint', c2: 'Team-scoped', c3: '6', c4: 'Draft' },
        { id: 'jr-503', c1: 'Sponsor Lead Conversion', c2: 'Sponsor cohort', c3: '5', c4: 'Live' },
      ],
      detailTitle: 'Journey Detail',
      detailBody: 'Inspect module flow, release pacing, and linked cohort/channel destinations.',
      primaryActionLabel: 'Create Journey',
      secondaryActionLabel: 'Open Cohorts',
    },
    coachingCohorts: {
      path: '/coach/cohorts',
      title: 'Cohorts',
      summary: 'Plan audience segments for journey delivery, sponsor activations, and channel targeting.',
      subheader: 'Cohorts support both team and non-team participant groupings.',
      listTitle: 'Active Cohorts',
      listColumns: ['Cohort', 'Owner', 'Members', 'Program'],
      listRows: [
        { id: 'co-610', c1: 'Q1 Rising Agents', c2: 'Coach Avery', c3: '24', c4: 'Listing Accelerator' },
        { id: 'co-611', c1: 'Sponsor Elite Leads', c2: 'Sponsor North', c3: '19', c4: 'Lead Conversion' },
        { id: 'co-612', c1: 'Team Velocity', c2: 'Team Leader Jamie', c3: '11', c4: 'Production Sprint' },
      ],
      detailTitle: 'Cohort Detail',
      detailBody: 'Review cohort composition, assigned journeys, and active channel coverage.',
      primaryActionLabel: 'Create Cohort',
      secondaryActionLabel: 'Open Channels',
    },
    coachingChannels: {
      path: '/coach/channels',
      title: 'Channels',
      summary: 'Run scoped communication streams for journeys, cohorts, and sponsor campaigns.',
      subheader: 'Channel operations remain communication-only and do not expose KPI logging actions.',
      listTitle: 'Channel Operations',
      listColumns: ['Channel', 'Scope', 'Members', 'Last activity'],
      listRows: [
        { id: 'ch-720', c1: 'Listing Accelerator Hub', c2: 'Coach', c3: '42', c4: '2h ago' },
        { id: 'ch-721', c1: 'Sponsor Lead Briefing', c2: 'Sponsor-scoped', c3: '19', c4: '4h ago' },
        { id: 'ch-722', c1: 'Team Velocity Check-in', c2: 'Team-scoped', c3: '11', c4: '1d ago' },
      ],
      detailTitle: 'Channel Detail',
      detailBody: 'Inspect participant scope, message templates, and journey-linked prompts.',
      primaryActionLabel: 'Create Channel',
      secondaryActionLabel: 'Open Library',
    },
  };

  const surface = config[routeKey];
  const accessSummary = isCoach
    ? 'Coach workspace active: full section access enabled.'
    : isTeamLeader
      ? 'Team Leader scope active: uploads are team-scoped only.'
      : isSponsor
        ? 'Challenge Sponsor scope active: sponsor-scoped tools only.'
        : 'Access is limited to currently authorized coach portal sections.';
  const selectedRow = surface.listRows.find((row) => row.id === selectedDetailId) ?? surface.listRows[0] ?? null;

  return (
    <View style={styles.panel}>
      <View style={styles.panelTopRow}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.eyebrow}>{surface.path}</Text>
          <Text style={styles.panelTitle}>{panelPortalLabel} • {surface.title}</Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: '#E8FFF3', borderColor: '#B6E6CB' }]}>
          <Text style={[styles.stagePillText, { color: '#146C43' }]}>Standalone W11</Text>
        </View>
      </View>
      <Text style={styles.panelBody}>{surface.summary}</Text>
      <Text style={styles.metaRow}>{surface.subheader}</Text>
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Role scope</Text>
        <Text style={styles.noticeText}>{accessSummary}</Text>
      </View>
      <View style={styles.sectionNavRow}>
        {COACH_PORTAL_NAV_ITEMS.map((section) => {
          const selected = section.key === routeKey;
          return (
            <Pressable
              key={section.key}
              style={[styles.sectionNavPill, selected && styles.sectionNavPillSelected]}
              onPress={() => onNavigate(section.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.sectionNavPillText, selected && styles.sectionNavPillTextSelected]}>{section.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.usersTopSplit}>
        <View style={[styles.tableWrap, { flex: 1, minWidth: 380 }]}>
          <View style={[styles.formHeaderRow, { paddingHorizontal: 12, paddingTop: 10 }]}>
            <Text style={styles.formTitle}>{surface.listTitle}</Text>
            <Text style={styles.metaRow}>{surface.listRows.length} items</Text>
          </View>
          <View style={styles.tableHeaderRow}>
            <View style={styles.colMd}><Text style={styles.tableHeaderCell}>{surface.listColumns[0]}</Text></View>
            <View style={styles.colMd}><Text style={styles.tableHeaderCell}>{surface.listColumns[1]}</Text></View>
            <View style={styles.colMd}><Text style={styles.tableHeaderCell}>{surface.listColumns[2]}</Text></View>
            <View style={styles.colSm}><Text style={styles.tableHeaderCell}>{surface.listColumns[3]}</Text></View>
          </View>
          {surface.listRows.map((row) => {
            const selected = selectedRow?.id === row.id;
            return (
              <Pressable
                key={row.id}
                style={[styles.tableDataRow, selected && styles.tableDataRowSelectedStrong]}
                onPress={() => setSelectedDetailId(row.id)}
              >
                <View style={[styles.tableCell, styles.colMd]}>
                  <Text style={styles.tablePrimary} numberOfLines={1}>{row.c1}</Text>
                </View>
                <View style={[styles.tableCell, styles.colMd]}>
                  <Text style={styles.tableCellText} numberOfLines={1}>{row.c2}</Text>
                </View>
                <View style={[styles.tableCell, styles.colMd]}>
                  <Text style={styles.tableCellText} numberOfLines={1}>{row.c3}</Text>
                </View>
                <View style={[styles.tableCell, styles.colSm]}>
                  <Text style={styles.tableSecondary} numberOfLines={1}>{row.c4}</Text>
                </View>
              </Pressable>
            );
          })}
          <Text style={styles.tableFootnote}>Select a row to view quick details and recommended next actions.</Text>
        </View>
        <View style={[styles.formCard, styles.usersOpsCard]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.formTitle}>{surface.detailTitle}</Text>
            <Text style={styles.metaRow}>{selectedRow?.id ?? 'No selection'}</Text>
          </View>
          <Text style={styles.panelBody}>{surface.detailBody}</Text>
          {selectedRow ? (
            <>
              <View style={styles.selectedUserSummaryCard}>
                <Text style={styles.formTitle}>{selectedRow.c1}</Text>
                <Text style={styles.metaRow}>{selectedRow.c2}</Text>
                <Text style={styles.metaRow}>{selectedRow.c3}</Text>
                <Text style={styles.metaRow}>Status: {selectedRow.c4}</Text>
              </View>
              <View style={styles.formActionsRow}>
                <TouchableOpacity style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>{surface.primaryActionLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallGhostButton}
                  onPress={() =>
                    onNavigate(
                      routeKey === 'coachingUploads'
                        ? 'coachingLibrary'
                        : routeKey === 'coachingLibrary'
                          ? 'coachingJourneys'
                          : routeKey === 'coachingJourneys'
                            ? 'coachingCohorts'
                            : routeKey === 'coachingCohorts'
                              ? 'coachingChannels'
                              : 'coachingLibrary'
                    )
                  }
                >
                  <Text style={styles.smallGhostButtonText}>{surface.secondaryActionLabel}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
          <Text style={styles.fieldHelpText}>
            Sponsor access remains sponsor-scoped, Team Leader upload access remains team-scoped, and KPI logging actions remain excluded for sponsors.
          </Text>
          <Text style={styles.fieldHelpText}>
            Legacy `/admin/coaching/*` routes remain compatibility redirects to canonical `/coach/*` paths.
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ───────────────────────────────────────────────────────────────
 * AdminMediaLibraryPanel – real Uploads + Library surface
 * Replaces the stub for coachingUploads & coachingLibrary
 * ─────────────────────────────────────────────────────────────── */

type AdminMediaAsset = {
  id: string;
  title: string;
  category: string;
  scope: string;
  duration: string;
  owner_label: string;
  ownership_scope: 'mine' | 'team' | 'global';
  processing_status: string;
  created_at: string;
  updated_at: string;
  content_type?: string;
  source_journey_title?: string | null;
};

type AdminMediaCollection = {
  id: string;
  name: string;
  ownership_scope: string;
  asset_ids: string[];
};

type AdminMediaLibraryPayload = {
  assets?: Array<{
    id: string;
    title?: string;
    category?: string;
    scope?: string;
    duration?: string;
    owner_user_id?: string;
    owner_label?: string;
    ownership_scope?: 'mine' | 'team' | 'global';
    processing_status?: string;
    created_at?: string;
    updated_at?: string;
    content_type?: string;
    source_journey_title?: string | null;
  }>;
  collections?: Array<{
    id: string;
    name?: string;
    ownership_scope?: string;
    asset_ids?: string[];
  }>;
  access_context?: {
    role?: string;
    effective_roles?: string[];
    can_global_view?: boolean;
  };
};

function AdminMediaLibraryPanel({
  routeKey,
  effectiveRoles,
  onNavigate,
  accessToken,
}: {
  routeKey: 'coachingUploads' | 'coachingLibrary';
  effectiveRoles: AdminRole[];
  onNavigate: (next: CoachingPortalSurfaceKey) => void;
  accessToken: string;
}) {
  const [assets, setAssets] = useState<AdminMediaAsset[]>([]);
  const [collections, setCollections] = useState<AdminMediaCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'mine' | 'team' | 'global'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const fetchLibrary = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_URL}/api/coaching/library/assets`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(typeof body.error === 'string' ? body.error : `Request failed (${resp.status})`);
      }
      const payload = (await resp.json()) as AdminMediaLibraryPayload;
      const mappedAssets: AdminMediaAsset[] = (payload.assets ?? []).map((a) => ({
        id: a.id,
        title: a.title || `Asset ${a.id.slice(0, 8)}`,
        category: a.category || 'Resource',
        scope: a.scope || 'Global',
        duration: a.duration || '-',
        owner_label: a.owner_label || 'Unknown',
        ownership_scope: a.ownership_scope ?? 'global',
        processing_status: a.processing_status || 'unknown',
        created_at: a.created_at || '',
        updated_at: a.updated_at || '',
        content_type: a.content_type,
        source_journey_title: a.source_journey_title ?? null,
      }));
      const mappedCollections: AdminMediaCollection[] = (payload.collections ?? []).map((c) => ({
        id: c.id,
        name: c.name || 'Collection',
        ownership_scope: c.ownership_scope ?? 'global',
        asset_ids: c.asset_ids ?? [],
      }));
      setAssets(mappedAssets);
      setCollections(mappedCollections);
      if (mappedCollections.length > 0 && !selectedCollectionId) {
        setSelectedCollectionId(mappedCollections[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library assets');
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedCollectionId]);

  useEffect(() => {
    void fetchLibrary();
  }, [fetchLibrary]);

  /* ── file picker (web) ── */
  const handleUploadFile = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Upload', 'File upload is only supported in the web browser.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*,image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadBusy(true);
      setUploadError(null);
      setUploadSuccess(null);
      try {
        /* Step 1: get a signed upload URL from backend */
        const urlResp = await fetch(`${API_URL}/api/coaching/media/upload-url`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: file.name,
            content_type: file.type,
          }),
        });
        if (!urlResp.ok) {
          const body = await urlResp.json().catch(() => ({})) as { error?: string | { message?: string } };
          const msg = typeof body.error === 'string' ? body.error : typeof body.error === 'object' && body.error?.message ? body.error.message : `Upload URL request failed (${urlResp.status})`;
          throw new Error(msg);
        }
        const urlPayload = (await urlResp.json()) as {
          upload_url?: string;
          media_id?: string;
          file_url?: string;
        };
        if (!urlPayload.upload_url) throw new Error('No upload URL returned');

        /* Step 2: upload the file */
        const isImage = file.type.startsWith('image/');
        const headers: Record<string, string> = { 'Content-Type': file.type };
        if (isImage) headers['x-upsert'] = 'true';
        await fetch(urlPayload.upload_url, {
          method: 'PUT',
          headers,
          body: file,
        });

        setUploadSuccess(`Uploaded "${file.name}" successfully${urlPayload.media_id ? ` (${urlPayload.media_id.slice(0, 8)})` : ''}`);
        /* Refresh library */
        void fetchLibrary();
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploadBusy(false);
      }
    };
    input.click();
  }, [accessToken, fetchLibrary]);

  /* ── filtering ── */
  const filteredAssets = useMemo(() => {
    let list = assets;
    if (scopeFilter !== 'all') list = list.filter((a) => a.ownership_scope === scopeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) || a.owner_label.toLowerCase().includes(q));
    }
    return list;
  }, [assets, scopeFilter, searchQuery]);

  const selectedAsset = useMemo(() => assets.find((a) => a.id === selectedAssetId) ?? null, [assets, selectedAssetId]);
  const activeCollection = useMemo(() => collections.find((c) => c.id === selectedCollectionId) ?? null, [collections, selectedCollectionId]);

  /* ── helper: format relative date ── */
  const relDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return d.toLocaleDateString();
  };

  const statusColor = (s: string) => {
    if (s === 'ready') return { bg: '#ECFDF5', fg: '#065F46' };
    if (s === 'processing' || s === 'waiting') return { bg: '#FEF3C7', fg: '#92400E' };
    if (s === 'failed' || s === 'errored') return { bg: '#FEF2F2', fg: '#991B1B' };
    return { bg: '#F1F5F9', fg: '#475569' };
  };

  const isUploads = routeKey === 'coachingUploads';
  const mediaPortalLabel = effectiveRoles.includes('coach') ? 'Coach Portal'
    : effectiveRoles.includes('team_leader') ? 'Team Portal'
    : effectiveRoles.includes('challenge_sponsor') ? 'Sponsor Portal'
    : 'Coach Portal';

  return (
    <View style={styles.panel}>
      {/* Header */}
      <View style={styles.panelTopRow}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.eyebrow}>{isUploads ? '/coach/uploads' : '/coach/library'}</Text>
          <Text style={styles.panelTitle}>{mediaPortalLabel} • {isUploads ? 'Content Uploads' : 'Content Library'}</Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: '#E8FFF3', borderColor: '#B6E6CB' }]}>
          <Text style={[styles.stagePillText, { color: '#146C43' }]}>Live</Text>
        </View>
      </View>
      <Text style={styles.panelBody}>
        {isUploads
          ? 'Upload images and videos to the coaching media library. Assets are scoped by role and connected to Library + Journeys pipelines.'
          : 'Browse and manage approved coaching assets grouped by ownership scope. Library assets feed Journeys, Cohort programs, and Channel campaigns.'}
      </Text>

      {/* Nav pills */}
      <View style={styles.sectionNavRow}>
        {COACH_PORTAL_NAV_ITEMS.map((section) => {
          const selected = section.key === routeKey;
          return (
            <Pressable
              key={section.key}
              style={[styles.sectionNavPill, selected && styles.sectionNavPillSelected]}
              onPress={() => onNavigate(section.key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.sectionNavPillText, selected && styles.sectionNavPillTextSelected]}>{section.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Upload bar (visible on both surfaces) */}
      {isUploads ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <TouchableOpacity
            style={[styles.primaryButton, uploadBusy && { opacity: 0.6 }]}
            onPress={() => void handleUploadFile()}
            disabled={uploadBusy}
          >
            <Text style={styles.primaryButtonText}>{uploadBusy ? 'Uploading…' : '+ Upload File'}</Text>
          </TouchableOpacity>
          {uploadSuccess ? <Text style={{ color: '#065F46', fontSize: 13 }}>{uploadSuccess}</Text> : null}
          {uploadError ? <Text style={{ color: '#991B1B', fontSize: 13 }}>{uploadError}</Text> : null}
        </View>
      ) : null}

      {/* Toolbar: scope + search */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {(['all', 'mine', 'team', 'global'] as const).map((s) => {
          const active = scopeFilter === s;
          return (
            <Pressable
              key={s}
              onPress={() => setScopeFilter(s)}
              style={[styles.sectionNavPill, active && styles.sectionNavPillSelected, { paddingHorizontal: 10, paddingVertical: 4 }]}
            >
              <Text style={[styles.sectionNavPillText, active && styles.sectionNavPillTextSelected, { fontSize: 12 }]}>
                {s === 'all' ? 'All' : s === 'mine' ? 'Mine' : s === 'team' ? 'Team' : 'Global'}
              </Text>
            </Pressable>
          );
        })}
        <TextInput
          style={[styles.listSearchInput, { flex: 1, minWidth: 180, maxWidth: 320, marginHorizontal: 0, marginBottom: 0 }]}
          placeholder="Search assets…"
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.smallGhostButton}
          onPress={() => void fetchLibrary()}
          disabled={loading}
        >
          <Text style={styles.smallGhostButtonText}>{loading ? 'Loading…' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.noticeBox}>
          <Text style={[styles.noticeTitle, { color: '#991B1B' }]}>Error</Text>
          <Text style={styles.noticeText}>{error}</Text>
        </View>
      ) : null}

      {loading && assets.length === 0 ? (
        <ActivityIndicator size="small" color="#64748B" style={{ marginVertical: 20 }} />
      ) : null}

      {/* Main split: list + detail */}
      <View style={styles.usersTopSplit}>
        {/* Asset table */}
        <View style={[styles.tableWrap, { flex: 1, minWidth: 420 }]}>
          <View style={[styles.formHeaderRow, { paddingHorizontal: 12, paddingTop: 10 }]}>
            <Text style={styles.formTitle}>{isUploads ? 'Uploaded Assets' : 'Library Assets'}</Text>
            <Text style={styles.metaRow}>{filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.tableHeaderRow}>
            <View style={styles.colMd}><Text style={styles.tableHeaderCell}>Title</Text></View>
            <View style={styles.colSm}><Text style={styles.tableHeaderCell}>Type</Text></View>
            <View style={styles.colSm}><Text style={styles.tableHeaderCell}>Owner</Text></View>
            <View style={styles.colSm}><Text style={styles.tableHeaderCell}>Status</Text></View>
            <View style={styles.colSm}><Text style={styles.tableHeaderCell}>Updated</Text></View>
          </View>
          {filteredAssets.length === 0 && !loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={styles.metaRow}>
                {assets.length === 0 ? 'No assets found. Upload content to get started.' : 'No assets match the current filter.'}
              </Text>
            </View>
          ) : null}
          {filteredAssets.map((asset) => {
            const selected = selectedAssetId === asset.id;
            const sc = statusColor(asset.processing_status);
            return (
              <Pressable
                key={asset.id}
                style={[styles.tableDataRow, selected && styles.tableDataRowSelectedStrong]}
                onPress={() => setSelectedAssetId(asset.id)}
              >
                <View style={[styles.tableCell, styles.colMd]}>
                  <Text style={styles.tablePrimary} numberOfLines={1}>{asset.title}</Text>
                </View>
                <View style={[styles.tableCell, styles.colSm]}>
                  <Text style={styles.tableCellText} numberOfLines={1}>{asset.category}</Text>
                </View>
                <View style={[styles.tableCell, styles.colSm]}>
                  <Text style={styles.tableCellText} numberOfLines={1}>{asset.owner_label}</Text>
                </View>
                <View style={[styles.tableCell, styles.colSm]}>
                  <View style={{ backgroundColor: sc.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' }}>
                    <Text style={{ color: sc.fg, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{asset.processing_status}</Text>
                  </View>
                </View>
                <View style={[styles.tableCell, styles.colSm]}>
                  <Text style={styles.tableSecondary} numberOfLines={1}>{relDate(asset.updated_at || asset.created_at)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Detail card */}
        <View style={[styles.formCard, styles.usersOpsCard]}>
          {selectedAsset ? (
            <>
              <View style={styles.formHeaderRow}>
                <Text style={styles.formTitle}>Asset Detail</Text>
                <Text style={styles.metaRow}>{selectedAsset.id.slice(0, 12)}…</Text>
              </View>
              <View style={styles.selectedUserSummaryCard}>
                <Text style={styles.formTitle}>{selectedAsset.title}</Text>
                <Text style={styles.metaRow}>Category: {selectedAsset.category} · Scope: {selectedAsset.scope}</Text>
                {selectedAsset.content_type ? <Text style={styles.metaRow}>Content type: {selectedAsset.content_type}</Text> : null}
                <Text style={styles.metaRow}>Owner: {selectedAsset.owner_label}</Text>
                <Text style={styles.metaRow}>Processing: {selectedAsset.processing_status}</Text>
                {selectedAsset.source_journey_title ? (
                  <Text style={styles.metaRow}>Journey: {selectedAsset.source_journey_title}</Text>
                ) : null}
                <Text style={styles.metaRow}>Created: {relDate(selectedAsset.created_at)}</Text>
                <Text style={styles.metaRow}>Updated: {relDate(selectedAsset.updated_at)}</Text>
              </View>
              <View style={styles.formActionsRow}>
                {isUploads ? (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => void handleUploadFile()}
                    disabled={uploadBusy}
                  >
                    <Text style={styles.primaryButtonText}>Upload Another</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.smallGhostButton}
                  onPress={() => onNavigate(isUploads ? 'coachingLibrary' : 'coachingJourneys')}
                >
                  <Text style={styles.smallGhostButtonText}>
                    {isUploads ? 'Open Library' : 'Open Journeys'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.formHeaderRow}>
                <Text style={styles.formTitle}>{isUploads ? 'Upload Info' : 'Collection Browser'}</Text>
              </View>
              {isUploads ? (
                <Text style={styles.panelBody}>
                  Select an asset from the list to view its details. Use the Upload button to add new images or videos to the coaching library.
                </Text>
              ) : (
                <>
                  <Text style={[styles.metaRow, { marginBottom: 8 }]}>{collections.length} collection{collections.length !== 1 ? 's' : ''}</Text>
                  {collections.map((coll) => {
                    const isActive = selectedCollectionId === coll.id;
                    return (
                      <Pressable
                        key={coll.id}
                        style={[
                          {
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            marginBottom: 4,
                            backgroundColor: isActive ? '#EFF6FF' : '#F8FAFC',
                            borderWidth: 1,
                            borderColor: isActive ? '#93C5FD' : '#E2E8F0',
                          },
                        ]}
                        onPress={() => setSelectedCollectionId(coll.id)}
                      >
                        <Text style={{ fontWeight: isActive ? '700' : '500', color: '#1E293B', fontSize: 13 }}>{coll.name}</Text>
                        <Text style={{ color: '#64748B', fontSize: 11 }}>{coll.asset_ids.length} asset{coll.asset_ids.length !== 1 ? 's' : ''} · {coll.ownership_scope}</Text>
                      </Pressable>
                    );
                  })}
                  {activeCollection ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.formTitle}>{activeCollection.name}</Text>
                      <Text style={styles.metaRow}>{activeCollection.asset_ids.length} asset{activeCollection.asset_ids.length !== 1 ? 's' : ''}</Text>
                      {activeCollection.asset_ids.slice(0, 10).map((assetId) => {
                        const a = assets.find((x) => x.id === assetId);
                        return (
                          <Pressable
                            key={assetId}
                            style={{ paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                            onPress={() => setSelectedAssetId(assetId)}
                          >
                            <Text style={{ fontSize: 12, color: '#334155' }}>{a?.title || assetId.slice(0, 12)}</Text>
                            <Text style={{ fontSize: 10, color: '#94A3B8' }}>{a?.category || ''} · {a?.processing_status || ''}</Text>
                          </Pressable>
                        );
                      })}
                      {activeCollection.asset_ids.length > 10 ? (
                        <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                          + {activeCollection.asset_ids.length - 10} more
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function AdminCoachingAuditPanel({
  effectiveRoles,
}: {
  effectiveRoles: AdminRole[];
}) {
  type AuditSortKey = 'status' | 'requester' | 'scope' | 'surface' | 'updated';
  const [rows, setRows] = useState<AdminAiSuggestionQueueItem[]>(() => buildStubAiSuggestionQueue());
  const [statusFilter, setStatusFilter] = useState<'all' | AiSuggestionStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<AuditSortKey>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleRowCount, setVisibleRowCount] = useState(12);
  const [notice, setNotice] = useState<string | null>(null);
  const isSuperAdmin = effectiveRoles.includes('super_admin');
  const canModerateQueue = isSuperAdmin;

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesSearch =
        !q ||
        row.id.toLowerCase().includes(q) ||
        row.requesterLabel.toLowerCase().includes(q) ||
        row.targetScopeSummary.toLowerCase().includes(q) ||
        row.sourceSurface.toLowerCase().includes(q) ||
        row.requestIntent.toLowerCase().includes(q) ||
        row.safetyFlags.join(' ').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [rows, searchQuery, statusFilter]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let result = 0;
      switch (sortKey) {
        case 'status':
          result = compareStrings(formatAiStatusLabel(a.status), formatAiStatusLabel(b.status));
          break;
        case 'requester':
          result = compareStrings(a.requesterLabel, b.requesterLabel) || compareStrings(a.requesterRole, b.requesterRole);
          break;
        case 'scope':
          result = compareStrings(a.targetScopeSummary, b.targetScopeSummary);
          break;
        case 'surface':
          result = compareStrings(a.sourceSurface, b.sourceSurface) || compareStrings(a.requestIntent, b.requestIntent);
          break;
        case 'updated':
          result = compareDates(a.updatedAt, b.updatedAt);
          break;
      }
      return applySortDirection(result || compareStrings(a.id, b.id), sortDirection);
    });
  }, [filteredRows, sortDirection, sortKey]);

  const visibleRows = sortedRows.slice(0, visibleRowCount);
  const selectedRow = selectedId ? rows.find((row) => row.id === selectedId) ?? null : null;
  const selectedRowInFilteredIndex = selectedId ? sortedRows.findIndex((row) => row.id === selectedId) : -1;
  const selectedRowHiddenByFilters = Boolean(selectedId && selectedRowInFilteredIndex === -1);

  useEffect(() => {
    setVisibleRowCount(12);
  }, [searchQuery, statusFilter, sortKey, sortDirection]);

  useEffect(() => {
    if (!selectedId && rows.length) setSelectedId(rows[0]?.id ?? null);
  }, [rows, selectedId]);

  useEffect(() => {
    if (selectedRowInFilteredIndex >= 0 && selectedRowInFilteredIndex >= visibleRowCount) {
      setVisibleRowCount(selectedRowInFilteredIndex + 1);
    }
  }, [selectedRowInFilteredIndex, visibleRowCount]);

  const onSortHeaderPress = (nextKey: AuditSortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'updated' ? 'desc' : 'asc');
  };
  const sortLabel = (key: AuditSortKey, label: string) =>
    `${label}${sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}`;

  const appendAuditEvent = (
    rowId: string,
    entry: Omit<AdminAiAuditHistoryEntry, 'id' | 'at'>,
    nextStatus?: AiSuggestionStatus
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const now = new Date().toISOString();
        return {
          ...row,
          status: nextStatus ?? row.status,
          updatedAt: now,
          auditHistory: [{ id: `${rowId}:${Date.now()}`, at: now, ...entry }, ...row.auditHistory],
        };
      })
    );
  };

  const handleApprove = async () => {
    if (!selectedRow) return;
    if (!canModerateQueue) {
      setNotice('Queue state changes are limited to super admin for this troubleshooting surface.');
      return;
    }
    const confirmed = await confirmDangerAction(`Approve AI suggestion ${selectedRow.id}? Human send/publish remains required.`);
    if (!confirmed) return;
    const note = promptForAuditNote('Approve');
    if (note === null) return;
    appendAuditEvent(selectedRow.id, {
      actorLabel: 'Super admin (local UI troubleshooting)',
      action: 'approved',
      note: note || 'Approved in UI queue. Execution remains human-triggered via existing runtime paths.',
    }, 'approved');
    setNotice(`Approved ${selectedRow.id} (queue-only action; no send/publish performed).`);
  };

  const handleReject = async () => {
    if (!selectedRow) return;
    if (!canModerateQueue) {
      setNotice('Queue state changes are limited to super admin for this troubleshooting surface.');
      return;
    }
    const confirmed = await confirmDangerAction(`Reject AI suggestion ${selectedRow.id}?`);
    if (!confirmed) return;
    const note = promptForAuditNote('Reject');
    if (note === null) return;
    appendAuditEvent(selectedRow.id, {
      actorLabel: 'Super admin (local UI troubleshooting)',
      action: 'rejected',
      note: note || 'Rejected during policy/safety review in admin audit queue.',
    }, 'rejected');
    setNotice(`Rejected ${selectedRow.id}; audit history updated.`);
  };

  const handleReturnToPending = () => {
    if (!selectedRow) return;
    if (!canModerateQueue) {
      setNotice('Queue state changes are limited to super admin for this troubleshooting surface.');
      return;
    }
    appendAuditEvent(selectedRow.id, {
      actorLabel: 'Super admin (local UI troubleshooting)',
      action: 'submitted',
      note: 'Returned to pending approval after follow-up review.',
    }, 'pending_approval');
    setNotice(`Returned ${selectedRow.id} to pending approval.`);
  };

  const copySelectedAuditSummary = async () => {
    if (!selectedRow) return;
    const text = [
      `Suggestion ID: ${selectedRow.id}`,
      `Status: ${formatAiStatusLabel(selectedRow.status)}`,
      `Requester: ${selectedRow.requesterLabel} (${selectedRow.requesterRole})`,
      `Scope: ${selectedRow.targetScopeSummary}`,
      `Source: ${selectedRow.sourceSurface}`,
      `Intent: ${selectedRow.requestIntent}`,
      `Required approval tier: ${selectedRow.requiredApprovalTier}`,
      `Safety flags: ${selectedRow.safetyFlags.join(', ')}`,
      `Disclaimers: ${selectedRow.disclaimerRequirements.join(' | ')}`,
    ].join('\n');
    const ok = await copyTextToClipboard(text);
    setNotice(ok ? `Copied audit summary for ${selectedRow.id}` : 'Could not copy audit summary (clipboard unavailable)');
  };

  const aiPolicyGuardrails = [
    'Exception-only troubleshooting surface. Coach-primary AI workflows stay in /coach runtime surfaces.',
    'No KPI log / forecast / challenge mutation actions are exposed in this surface.',
    'Approve/Reject updates queue state + audit history only (approval-first UI workflow).',
    'No autonomous send/publish paths; execution remains human-triggered elsewhere.',
  ];

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>AI Troubleshooting Queue</Text>
      <View style={styles.alertErrorBox}>
        <Text style={styles.alertErrorTitle}>Disallowed actions preserved</Text>
        {aiPolicyGuardrails.map((line) => (
          <Text key={line} style={styles.alertErrorText}>{line}</Text>
        ))}
      </View>
      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Access boundary</Text>
        <Text style={styles.noticeText}>
          Super admin can update queue status for exception handling. Platform admins have limited read-only troubleshooting access.
        </Text>
      </View>

      <View style={styles.filterBar}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>Queue Filters</Text>
          <Text style={styles.metaRow}>
            {filteredRows.length} filtered / {rows.length} total • sort {sortKey} ({sortDirection})
          </Text>
        </View>
        {notice ? <Text style={[styles.metaRow, styles.successText]}>{notice}</Text> : null}
        <Text style={styles.fieldHelpText}>
          Backend queue/read-model fields may be stubbed during W5 sequencing. This panel uses local sample data when backend shaping is unavailable.
        </Text>
        <View style={[styles.formField, styles.formFieldWide]}>
          <Text style={styles.formLabel}>Search</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.input}
            placeholder="Search suggestion id / requester / scope / surface / flags"
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Status</Text>
          <View style={styles.inlineToggleRow}>
            {(['all', 'draft_pending_review', 'pending_approval', 'approved', 'rejected'] as const).map((value) => {
              const selected = statusFilter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setStatusFilter(value)}
                  style={[styles.toggleChip, selected && styles.toggleChipOn]}
                >
                  <Text style={[styles.toggleChipText, selected && styles.toggleChipTextOn]}>
                    {value === 'all' ? 'all' : formatAiStatusLabel(value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.usersTopSplit}>
        <View style={[styles.tableWrap, { flex: 1, minWidth: 360 }]}>
          <View style={[styles.formHeaderRow, { paddingHorizontal: 12, paddingTop: 10 }]}>
            <Text style={styles.formTitle}>Approval Queue</Text>
            <View style={styles.formActionsRow}>
              {(searchQuery.trim() || statusFilter !== 'all') ? (
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => { setSearchQuery(''); setStatusFilter('all'); }}>
                  <Text style={styles.smallGhostButtonText}>Reset filters</Text>
                </TouchableOpacity>
              ) : null}
              {(sortKey !== 'updated' || sortDirection !== 'desc') ? (
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => { setSortKey('updated'); setSortDirection('desc'); }}>
                  <Text style={styles.smallGhostButtonText}>Reset sort</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <Text style={[styles.metaRow, { paddingHorizontal: 12 }]}>Select a suggestion row to inspect troubleshooting context, safety flags, and audit history.</Text>
          {selectedRowHiddenByFilters ? (
            <View style={[styles.noticeBox, { marginHorizontal: 12, marginTop: 8 }]}>
              <Text style={styles.noticeTitle}>Selected suggestion is hidden by current filters</Text>
              <Text style={styles.noticeText}>{selectedRow?.id} remains open in detail view but is filtered out of the queue list.</Text>
              <View style={styles.formActionsRow}>
                <TouchableOpacity style={styles.noticeButton} onPress={() => { setSearchQuery(''); setStatusFilter('all'); }}>
                  <Text style={styles.noticeButtonText}>Show selected row</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          <View style={[styles.formHeaderRow, { paddingHorizontal: 12, paddingTop: 8 }]}>
            <Text style={styles.metaRow}>
              {filteredRows.length === 0
                ? `No AI queue rows match current filters (${rows.length} total)`
                : `Showing ${visibleRows.length} of ${filteredRows.length} filtered rows (${rows.length} total)`}
            </Text>
            <View style={styles.formActionsRow}>
              {filteredRows.length > visibleRowCount ? (
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => setVisibleRowCount((prev) => prev + 12)}>
                  <Text style={styles.smallGhostButtonText}>Show more ({Math.max(0, filteredRows.length - visibleRowCount)} left)</Text>
                </TouchableOpacity>
              ) : null}
              {visibleRowCount > 12 ? (
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => setVisibleRowCount(12)}>
                  <Text style={styles.smallGhostButtonText}>Reset rows</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <View style={styles.tableHeaderRow}>
            <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('status')} accessibilityRole="button">
              <Text style={[styles.tableHeaderCell, sortKey === 'status' && styles.tableHeaderCellActive]}>{sortLabel('status', 'Status')}</Text>
            </Pressable>
            <Pressable style={styles.colMd} onPress={() => onSortHeaderPress('requester')} accessibilityRole="button">
              <Text style={[styles.tableHeaderCell, sortKey === 'requester' && styles.tableHeaderCellActive]}>{sortLabel('requester', 'Requester')}</Text>
            </Pressable>
            <Pressable style={styles.colWide} onPress={() => onSortHeaderPress('scope')} accessibilityRole="button">
              <Text style={[styles.tableHeaderCell, sortKey === 'scope' && styles.tableHeaderCellActive]}>{sortLabel('scope', 'Scope')}</Text>
            </Pressable>
            <Pressable style={styles.colMd} onPress={() => onSortHeaderPress('surface')} accessibilityRole="button">
              <Text style={[styles.tableHeaderCell, sortKey === 'surface' && styles.tableHeaderCellActive]}>{sortLabel('surface', 'Source')}</Text>
            </Pressable>
            <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('updated')} accessibilityRole="button">
              <Text style={[styles.tableHeaderCell, sortKey === 'updated' && styles.tableHeaderCellActive]}>{sortLabel('updated', 'Updated')}</Text>
            </Pressable>
          </View>
          {visibleRows.map((row) => {
            const selected = row.id === selectedId;
            const tone = getAiSuggestionStatusTone(row.status);
            return (
              <Pressable key={row.id} style={[styles.tableDataRow, selected && styles.tableDataRowSelectedStrong]} onPress={() => setSelectedId(row.id)}>
                <View style={[styles.tableCell, styles.colSm]}>
                  <View style={[styles.statusChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                    <Text style={[styles.statusChipText, { color: tone.text }]}>{tone.label}</Text>
                  </View>
                </View>
                <View style={[styles.tableCell, styles.colMd]}>
                  <Text numberOfLines={1} style={styles.tablePrimary}>{row.requesterLabel}</Text>
                  <Text numberOfLines={1} style={styles.tableSecondary}>{row.requesterRole}</Text>
                </View>
                <View style={[styles.tableCell, styles.colWide]}>
                  <Text numberOfLines={2} style={styles.tablePrimary}>{row.targetScopeSummary}</Text>
                  <Text numberOfLines={1} style={styles.tableSecondary}>{row.requestIntent}</Text>
                </View>
                <View style={[styles.tableCell, styles.colMd]}>
                  <Text numberOfLines={1} style={styles.tableCellText}>{row.sourceSurface}</Text>
                  <Text numberOfLines={1} style={styles.tableSecondary}>{row.requiredApprovalTier}</Text>
                </View>
                <View style={[styles.tableCell, styles.colSm]}>
                  <Text style={styles.tableCellText}>{formatDateShort(row.updatedAt)}</Text>
                  <Text numberOfLines={1} style={styles.tableSecondary}>{row.id}</Text>
                </View>
              </Pressable>
            );
          })}
          {filteredRows.length === 0 ? (
            <Text style={styles.tableFootnote}>No queue rows match the current filters. Clear filters to continue moderation review.</Text>
          ) : filteredRows.length > visibleRowCount ? (
            <Text style={styles.tableFootnote}>More AI queue rows are available. Use “Show more” to continue browsing the approval queue.</Text>
          ) : (
            <Text style={styles.tableFootnote}>End of filtered AI queue results.</Text>
          )}
        </View>
        <View style={[styles.formCard, styles.usersOpsCard]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.formTitle}>Troubleshooting Detail</Text>
            <Text style={styles.metaRow}>{selectedRow ? formatDateTimeShort(selectedRow.updatedAt) : 'Select a suggestion'}</Text>
          </View>
          {selectedRow ? (
            <>
              <View style={styles.selectedUserSummaryCard}>
                <View style={styles.formHeaderRow}>
                  <View>
                    <Text style={styles.formTitle}>Selected AI Suggestion</Text>
                    <Text style={styles.metaRow}>{selectedRow.id}</Text>
                  </View>
                  <View style={styles.inlineToggleRow}>
                    {(() => {
                      const tone = getAiSuggestionStatusTone(selectedRow.status);
                      return (
                        <View style={[styles.statusChip, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                          <Text style={[styles.statusChipText, { color: tone.text }]}>{tone.label}</Text>
                        </View>
                      );
                    })()}
                    <View style={[styles.statusChip, { backgroundColor: '#F4F8FF', borderColor: '#D8E4FA' }]}>
                      <Text style={[styles.statusChipText, { color: '#345892' }]}>approval: {selectedRow.requiredApprovalTier}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.metaRow}>Requester: {selectedRow.requesterLabel} ({selectedRow.requesterRole})</Text>
                <Text style={styles.metaRow}>Source: {selectedRow.sourceSurface} • Intent: {selectedRow.requestIntent}</Text>
                <Text style={styles.metaRow}>Scope: {selectedRow.targetScopeSummary}</Text>
                <Text style={styles.metaRow}>Execution linkage: {selectedRow.executionLinkageRef ?? 'none (not executed / not linked)'}</Text>
              </View>
              <View style={styles.userOpsSection}>
                <View style={styles.formHeaderRow}>
                  <Text style={styles.formTitle}>Draft Content (Advisory Only)</Text>
                  <Text style={styles.metaRow}>{selectedRow.editedContentIndicator ? 'edited before review' : 'original draft'}</Text>
                </View>
                <View style={styles.codePreviewBox}>
                  <Text style={styles.codePreviewText} selectable>{selectedRow.draftContent}</Text>
                </View>
                <Text style={styles.fieldHelpText}>
                  Review actions here do not send messages, publish coaching content, or mutate KPI/forecast/challenge state.
                </Text>
              </View>
              <View style={styles.usersDiagnosticsGrid}>
                <View style={[styles.summaryCard, { flex: 1 }]}>
                  <View style={styles.formHeaderRow}>
                    <Text style={styles.summaryLabel}>Disclaimers + Safety Flags</Text>
                    <Text style={styles.metaRow}>{selectedRow.safetyFlags.length} flags</Text>
                  </View>
                  <Text style={styles.summaryNote}>Model meta: {selectedRow.modelMeta}</Text>
                  <View style={styles.chipRow}>
                    {selectedRow.disclaimerRequirements.map((item) => (
                      <View key={item} style={[styles.formChip, { backgroundColor: '#FFF8E9', borderColor: '#F0D59A' }]}>
                        <Text style={[styles.formChipText, { color: '#8E6400' }]}>{item}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.chipRow}>
                    {selectedRow.safetyFlags.map((flag) => (
                      <View key={flag} style={[styles.formChip, { backgroundColor: '#FFF4F2', borderColor: '#F2C0B9' }]}>
                        <Text style={[styles.formChipText, { color: '#B2483A' }]}>{flag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={[styles.summaryCard, { flex: 1.2 }]}>
                  <View style={styles.formHeaderRow}>
                    <Text style={styles.summaryLabel}>Audit History</Text>
                    <Text style={styles.metaRow}>{selectedRow.auditHistory.length} events</Text>
                  </View>
                  {selectedRow.auditHistory.map((event) => (
                    <View key={event.id} style={styles.activityFeedRow}>
                      <View
                        style={[
                          styles.activityFeedDot,
                          event.action === 'approved'
                            ? styles.activityFeedDotSuccess
                            : event.action === 'rejected'
                              ? styles.activityFeedDotError
                              : styles.activityFeedDotInfo,
                        ]}
                      />
                      <View style={styles.activityFeedCopy}>
                        <Text style={styles.activityFeedText}>{event.actorLabel} • {event.action}</Text>
                        {event.note ? <Text style={styles.activityFeedMeta}>{event.note}</Text> : null}
                        <Text style={styles.activityFeedMeta}>{formatDateTimeShort(event.at)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.formActionsRow}>
                {canModerateQueue ? (
                  <>
                    <TouchableOpacity style={styles.primaryButton} onPress={handleApprove}>
                      <Text style={styles.primaryButtonText}>Approve (Queue Only)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.warnButton} onPress={handleReject}>
                      <Text style={styles.warnButtonText}>Reject (Queue Only)</Text>
                    </TouchableOpacity>
                    {(selectedRow.status === 'approved' || selectedRow.status === 'rejected') ? (
                      <TouchableOpacity style={styles.smallGhostButton} onPress={handleReturnToPending}>
                        <Text style={styles.smallGhostButtonText}>Return to Pending</Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                ) : (
                  <Text style={[styles.metaRow, { flex: 1 }]}>Read-only mode for non-super-admin troubleshooting sessions.</Text>
                )}
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => void copySelectedAuditSummary()}>
                  <Text style={styles.smallGhostButtonText}>Copy Audit Summary</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.panelBody}>Select an AI queue row to inspect approval requirements, troubleshooting context, and audit history.</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function AdminReportsPanel({
  overviewStatus,
  detailedStatus,
  lastCheckedAt,
  onRefresh,
  onRefreshOverview,
  onRefreshDetailed,
  loading,
}: {
  overviewStatus: EndpointProbeStatus;
  detailedStatus: EndpointProbeStatus;
  lastCheckedAt: string | null;
  onRefresh: () => void;
  onRefreshOverview?: () => void;
  onRefreshDetailed?: () => void;
  loading: boolean;
}) {
  const [expandedOverview, setExpandedOverview] = useState(false);
  const [expandedDetailed, setExpandedDetailed] = useState(false);
  const [selectedEndpointKey, setSelectedEndpointKey] = useState<'overview' | 'detailed'>('overview');
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);
  const [reportsCopyNotice, setReportsCopyNotice] = useState<string | null>(null);
  const overviewTone = getProbeTone(overviewStatus);
  const detailedTone = getProbeTone(detailedStatus);
  const hasOverviewPreview = overviewStatus.kind === 'ready';
  const hasDetailedPreview = detailedStatus.kind === 'ready';
  const overallLabel =
    loading || overviewStatus.kind === 'loading' || detailedStatus.kind === 'loading'
      ? 'Checking'
      : overviewStatus.kind === 'error' || detailedStatus.kind === 'error'
        ? 'Attention'
        : overviewStatus.kind === 'ready' || detailedStatus.kind === 'ready'
          ? 'Ready'
          : overviewStatus.kind === 'forbidden' || detailedStatus.kind === 'forbidden'
            ? 'Forbidden'
            : overviewStatus.kind === 'not_implemented' && detailedStatus.kind === 'not_implemented'
              ? 'Unavailable'
              : 'Idle';
  const endpointOpsRows = [
    {
      key: 'overview',
      label: 'Overview analytics',
      path: 'GET /admin/analytics/overview',
      status: overviewStatus,
      tone: overviewTone,
    },
    {
      key: 'detailed',
      label: 'Detailed reports',
      path: 'GET /admin/analytics/detailed-reports',
      status: detailedStatus,
      tone: detailedTone,
    },
  ] as const;
  const selectedEndpoint = endpointOpsRows.find((row) => row.key === selectedEndpointKey) ?? endpointOpsRows[0];
  const selectedStatus = selectedEndpoint.key === 'overview' ? overviewStatus : detailedStatus;
  const selectedHasPreview = selectedEndpoint.key === 'overview' ? hasOverviewPreview : hasDetailedPreview;
  const selectedExpanded = selectedEndpoint.key === 'overview' ? expandedOverview : expandedDetailed;
  const selectedDescription =
    selectedEndpoint.key === 'overview'
      ? 'Checks live backend availability for the overview analytics endpoint.'
      : 'Checks live backend availability for the detailed reports endpoint. Endpoint not available yet (404) is shown as an explicit unavailable state.';
  const operatorNextStep =
    loading || endpointOpsRows.some((row) => row.status.kind === 'loading')
      ? 'Wait for endpoint checks to complete.'
      : endpointOpsRows.some((row) => row.status.kind === 'error')
        ? 'Retry the failed endpoint and copy details for backend triage.'
        : endpointOpsRows.some((row) => row.status.kind === 'forbidden')
          ? 'Confirm admin authz/session role before retrying.'
          : endpointOpsRows.every((row) => row.status.kind === 'not_implemented')
            ? 'Endpoints are unavailable (expected pre-A3 backend coverage). Capture status and proceed.'
            : 'Copy endpoint details and continue operator verification.';

  const copyProbeDetails = async (label: string, status: EndpointProbeStatus) => {
    const text = `${label}\n${formatProbeStatus(status)}${
      status.kind === 'ready' ? `\n\n${status.bodyPreview}` : ''
    }`;
    const ok = await copyTextToClipboard(text);
    setReportsCopyNotice(ok ? `Copied ${label} details` : 'Could not copy report details (clipboard unavailable)');
  };
  const copyAllProbeSummary = async () => {
    const text = endpointOpsRows
      .map((row) => `${row.path}\n${formatProbeStatus(row.status)}`)
      .join('\n\n');
    const ok = await copyTextToClipboard(text);
    setReportsCopyNotice(ok ? 'Copied all probe statuses' : 'Could not copy probe statuses (clipboard unavailable)');
  };
  const runSelectedRecheck = () => {
    if (selectedEndpoint.key === 'overview') {
      onRefreshOverview?.() ?? onRefresh();
      return;
    }
    onRefreshDetailed?.() ?? onRefresh();
  };
  const toggleSelectedPreview = () => {
    if (!selectedHasPreview) return;
    if (selectedEndpoint.key === 'overview') {
      setExpandedOverview((prev) => !prev);
      return;
    }
    setExpandedDetailed((prev) => !prev);
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Analytics + Reports</Text>
      <View style={styles.endpointStatusBanner}>
        <View style={styles.endpointStatusBannerCopy}>
          <Text style={styles.endpointStatusBannerLabel}>{overallLabel}</Text>
          <Text style={styles.endpointStatusBannerNote}>
            {lastCheckedAt ? `Checked ${formatDateTimeShort(lastCheckedAt)}` : 'Not checked yet'}
          </Text>
        </View>
      </View>
      {reportsCopyNotice ? <Text style={[styles.metaRow, styles.successText]}>{reportsCopyNotice}</Text> : null}
      <View style={styles.formActionsRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={onRefresh} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Checking...' : 'Recheck All Endpoints'}</Text>
        </TouchableOpacity>
        <View style={styles.menuWrap}>
          <TouchableOpacity style={styles.smallGhostButton} onPress={() => setReportsMenuOpen((prev) => !prev)}>
            <Text style={styles.smallGhostButtonText}>{reportsMenuOpen ? 'Hide Actions' : 'More Actions'}</Text>
          </TouchableOpacity>
          {reportsMenuOpen ? (
            <View style={styles.menuList}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  runSelectedRecheck();
                  setReportsMenuOpen(false);
                }}
                disabled={loading}
              >
                <Text style={styles.menuItemText}>Recheck selected endpoint</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  void copyProbeDetails(selectedEndpoint.path, selectedStatus);
                  setReportsMenuOpen(false);
                }}
              >
                <Text style={styles.menuItemText}>Copy selected endpoint details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  void copyAllProbeSummary();
                  setReportsMenuOpen(false);
                }}
              >
                <Text style={styles.menuItemText}>Copy all endpoint statuses</Text>
              </TouchableOpacity>
              {selectedHasPreview ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    toggleSelectedPreview();
                    setReportsMenuOpen(false);
                  }}
                >
                  <Text style={styles.menuItemText}>{selectedExpanded ? 'Collapse selected preview' : 'Expand selected preview'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
      <Text style={styles.fieldHelpText}>
        Select an endpoint row first, then use More Actions for selected-endpoint recheck and copy operations.
      </Text>
      <View style={styles.reportsOpsSummaryCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>Operator Probe Summary</Text>
          <Text style={styles.metaRow}>{endpointOpsRows.filter((row) => row.status.kind === 'ready').length} ready</Text>
        </View>
        <View style={styles.tableWrap}>
          <View style={styles.tableHeaderRow}>
            <View style={styles.colWide}>
              <Text style={styles.tableHeaderCell}>Endpoint</Text>
            </View>
            <View style={styles.colWide}>
              <Text style={styles.tableHeaderCell}>Path</Text>
            </View>
            <View style={styles.colSm}>
              <Text style={styles.tableHeaderCell}>Status</Text>
            </View>
          </View>
          {endpointOpsRows.map((row) => (
            <Pressable
              key={row.key}
              style={[styles.tableDataRow, selectedEndpoint.key === row.key && styles.tableDataRowSelectedStrong]}
              onPress={() => setSelectedEndpointKey(row.key)}
            >
              <View style={[styles.tableCell, styles.colWide]}>
                <Text style={styles.tablePrimary}>{row.label}</Text>
              </View>
              <View style={[styles.tableCell, styles.colWide]}>
                <Text style={styles.tableCellText}>{row.path}</Text>
              </View>
              <View style={[styles.tableCell, styles.colSm]}>
                <View style={[styles.statusChip, { backgroundColor: row.tone.bg, borderColor: row.tone.border }]}>
                  <Text style={[styles.statusChipText, { color: row.tone.text }]}>{row.tone.label}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
        <Text style={styles.fieldHelpText}>{operatorNextStep}</Text>
      </View>
      <View style={[styles.summaryRow, styles.summaryRowCompact]}>
        <View style={styles.summaryCard}>
          <View style={styles.endpointHeaderRow}>
            <Text style={styles.summaryLabel}>{selectedEndpoint.path}</Text>
            <View style={[styles.statusChip, { backgroundColor: selectedEndpoint.tone.bg, borderColor: selectedEndpoint.tone.border }]}>
              <Text style={[styles.statusChipText, { color: selectedEndpoint.tone.text }]}>{selectedEndpoint.tone.label}</Text>
            </View>
          </View>
          <Text style={styles.summaryValue} selectable>{formatProbeStatus(selectedStatus)}</Text>
          {selectedHasPreview ? (
            <>
              <View style={styles.codePreviewBox}>
                <Text style={styles.codePreviewText} selectable numberOfLines={selectedExpanded ? undefined : 8}>
                  {selectedStatus.kind === 'ready' ? selectedStatus.bodyPreview : ''}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.summaryNote} selectable>
              {selectedDescription}
            </Text>
          )}
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>POST /admin/data-exports</Text>
          <Text style={styles.summaryValue}>Export action not enabled in this panel</Text>
          <Text style={styles.summaryNote}>
            This panel shows the export endpoint used for reporting exports, but does not run export requests from this screen.
          </Text>
          <Text style={styles.summaryNote}>Use this screen to confirm availability/status only.</Text>
        </View>
      </View>
    </View>
  );
}

function UnauthorizedState({
  title,
  message,
  rolesLabel,
  debugLines,
  devOverrideLabel,
  onResetDevPreview,
}: {
  title: string;
  message: string;
  rolesLabel: string;
  debugLines: string[];
  devOverrideLabel?: string;
  onResetDevPreview?: () => void;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.eyebrow}>403</Text>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelBody}>{message}</Text>
      <Text style={styles.metaRow}>Detected session roles: {rolesLabel}</Text>
      {devOverrideLabel ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Dev preview is overriding your real role</Text>
          <Text style={styles.noticeText}>Current preview: {devOverrideLabel}</Text>
          {onResetDevPreview ? (
            <TouchableOpacity onPress={onResetDevPreview} style={styles.noticeButton} accessibilityRole="button">
              <Text style={styles.noticeButtonText}>Use live role</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {__DEV__ ? (
        <View style={styles.debugBox}>
          <Text style={styles.debugTitle}>Dev debug (session role metadata)</Text>
          {debugLines.map((line) => (
            <Text key={line} style={styles.debugLine}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AdminAuthzPanel({
  effectiveRoles,
  backendRole,
  backendRoleLoading,
  backendRoleError,
}: {
  effectiveRoles: AdminRole[];
  backendRole: string | null;
  backendRoleLoading: boolean;
  backendRoleError: string | null;
}) {
  type AuthzTab = 'route_access' | 'session_roles';
  type AuthzSortKey = 'route' | 'required_roles' | 'access';
  const [activeTab, setActiveTab] = useState<AuthzTab>('route_access');
  const [selectedRouteKey, setSelectedRouteKey] = useState<AdminRouteKey>('authz');
  const [sortKey, setSortKey] = useState<AuthzSortKey>('route');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const adminRoutes = useMemo(
    () => ADMIN_ROUTES.filter((route) => route.path.startsWith('/admin')),
    []
  );
  const sortedRows = useMemo(() => {
    return [...adminRoutes].sort((a, b) => {
      let result = 0;
      switch (sortKey) {
        case 'route':
          result = compareStrings(a.path, b.path);
          break;
        case 'required_roles':
          result = compareStrings(a.requiredRoles.join(','), b.requiredRoles.join(','));
          break;
        case 'access':
          result = compareBooleans(
            canAccessAdminRoute(effectiveRoles, a),
            canAccessAdminRoute(effectiveRoles, b)
          );
          break;
      }
      return applySortDirection(result || compareStrings(a.path, b.path), sortDirection);
    });
  }, [adminRoutes, effectiveRoles, sortDirection, sortKey]);
  const selectedRoute =
    sortedRows.find((row) => row.key === selectedRouteKey) ??
    sortedRows.find((row) => row.key === 'authz') ??
    sortedRows[0] ??
    null;
  const routeSortLabel = (key: AuthzSortKey, label: string) =>
    `${label}${sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}`;

  const onSortHeaderPress = (nextKey: AuthzSortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'access' ? 'desc' : 'asc');
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Authorization Matrix</Text>
      <View style={styles.sectionNavRow}>
        <Pressable
          style={[styles.sectionNavPill, activeTab === 'route_access' && styles.sectionNavPillSelected]}
          onPress={() => setActiveTab('route_access')}
        >
          <Text style={[styles.sectionNavPillText, activeTab === 'route_access' && styles.sectionNavPillTextSelected]}>
            Route Access
          </Text>
        </Pressable>
        <Pressable
          style={[styles.sectionNavPill, activeTab === 'session_roles' && styles.sectionNavPillSelected]}
          onPress={() => setActiveTab('session_roles')}
        >
          <Text style={[styles.sectionNavPillText, activeTab === 'session_roles' && styles.sectionNavPillTextSelected]}>
            Session Roles
          </Text>
        </Pressable>
      </View>

      {activeTab === 'route_access' ? (
        <View style={styles.usersTopSplit}>
          <View style={[styles.tableWrap, { flex: 1, minWidth: 360 }]}>
            <Text style={[styles.tableFootnote, { backgroundColor: '#F5F8FF' }]}>
              Select a route row to inspect role requirements and current access state.
            </Text>
            <View style={styles.tableHeaderRow}>
              <Pressable style={styles.colWide} onPress={() => onSortHeaderPress('route')}>
                <Text style={[styles.tableHeaderCell, sortKey === 'route' && styles.tableHeaderCellActive]}>
                  {routeSortLabel('route', 'Route')}
                </Text>
              </Pressable>
              <Pressable style={styles.colWide} onPress={() => onSortHeaderPress('required_roles')}>
                <Text style={[styles.tableHeaderCell, sortKey === 'required_roles' && styles.tableHeaderCellActive]}>
                  {routeSortLabel('required_roles', 'Required Roles')}
                </Text>
              </Pressable>
              <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('access')}>
                <Text style={[styles.tableHeaderCell, sortKey === 'access' && styles.tableHeaderCellActive]}>
                  {routeSortLabel('access', 'Access')}
                </Text>
              </Pressable>
            </View>
            {sortedRows.map((row) => {
              const allowed = canAccessAdminRoute(effectiveRoles, row);
              return (
                <Pressable
                  key={row.key}
                  style={[styles.tableDataRow, selectedRoute?.key === row.key && styles.tableDataRowSelectedStrong]}
                  onPress={() => setSelectedRouteKey(row.key)}
                >
                  <View style={[styles.tableCell, styles.colWide]}>
                    <Text style={styles.tablePrimary}>{row.label}</Text>
                    <Text style={styles.tableSecondary}>{row.path}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.colWide]}>
                    <Text style={styles.tableCellText}>{row.requiredRoles.join(', ')}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.colSm]}>
                    <View
                      style={[
                        styles.statusChip,
                        allowed
                          ? { backgroundColor: '#EFFCF4', borderColor: '#BFE6CC' }
                          : { backgroundColor: '#FFF4F2', borderColor: '#F2C0B9' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          { color: allowed ? '#1D7A4D' : '#B2483A' },
                        ]}
                      >
                        {allowed ? 'allowed' : 'blocked'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.formCard, styles.usersOpsCard]}>
            <View style={styles.formHeaderRow}>
              <Text style={styles.formTitle}>Selected Route Detail</Text>
              <Text style={styles.metaRow}>{selectedRoute?.key ?? 'none'}</Text>
            </View>
            {selectedRoute ? (
              <>
                <Text style={styles.metaRow}>Path: {selectedRoute.path}</Text>
                <Text style={styles.metaRow}>Description: {selectedRoute.description}</Text>
                <Text style={styles.metaRow}>Required roles: {selectedRoute.requiredRoles.join(', ')}</Text>
                <View
                  style={[
                    styles.statusChip,
                    canAccessAdminRoute(effectiveRoles, selectedRoute)
                      ? { backgroundColor: '#EFFCF4', borderColor: '#BFE6CC' }
                      : { backgroundColor: '#FFF4F2', borderColor: '#F2C0B9' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      {
                        color: canAccessAdminRoute(effectiveRoles, selectedRoute)
                          ? '#1D7A4D'
                          : '#B2483A',
                      },
                    ]}
                  >
                    {canAccessAdminRoute(effectiveRoles, selectedRoute) ? 'session can access' : 'session cannot access'}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.metaRow}>No route selected.</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.usersDiagnosticsGrid}>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryLabel}>Session Resolved Roles</Text>
            <Text style={styles.summaryValue}>{effectiveRoles.length ? effectiveRoles.join(', ') : 'none'}</Text>
          </View>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryLabel}>Backend Reported Role</Text>
            {backendRoleLoading ? (
              <Text style={styles.summaryValue}>Loading role...</Text>
            ) : backendRoleError ? (
              <Text style={[styles.summaryValue, styles.errorText]}>{backendRoleError}</Text>
            ) : (
              <Text style={styles.summaryValue}>{backendRole ?? 'none returned'}</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}


export default function AdminShellScreen() {
  const { session, signOut } = useAuth();
  const {
    resolvedRoles,
    backendRole,
    backendRoleError,
    backendRoleLoading,
    hasAdminAccess,
    canAccessRoute,
    debugLines,
  } = useAdminAuthz();
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [activeRouteKey, setActiveRouteKey] = useState<AdminRouteKey>(() =>
    getInitialAdminRouteKey(process.env.EXPO_PUBLIC_ADMIN_INITIAL_ROUTE)
  );
  const [devRolePreview, setDevRolePreview] = useState<
    'live' | 'super_admin' | 'admin' | 'coach' | 'team_leader' | 'sponsor' | 'agent'
  >('live');
  const [showImplementationNotes, setShowImplementationNotes] = useState(false);
  const [unknownAdminPath, setUnknownAdminPath] = useState<string | null>(null);
  const [lastNavPushPath, setLastNavPushPath] = useState<string | null>(null);
  const [kpiRows, setKpiRows] = useState<AdminKpiRow[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [kpiSearchQuery, setKpiSearchQuery] = useState('');
  const [kpiStatusFilter, setKpiStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [kpiTypeFilter, setKpiTypeFilter] = useState<'all' | AdminKpiWritePayload['type']>('all');
  const [kpiDraft, setKpiDraft] = useState<KpiFormDraft>(emptyKpiDraft);
  const [kpiSaving, setKpiSaving] = useState(false);
  const [kpiSaveError, setKpiSaveError] = useState<string | null>(null);
  const [kpiSuccessMessage, setKpiSuccessMessage] = useState<string | null>(null);
  const [templateRows, setTemplateRows] = useState<AdminChallengeTemplateRow[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [templateStatusFilter, setTemplateStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [templateDraft, setTemplateDraft] = useState<TemplateFormDraft>(() => ({ ...emptyTemplateDraft(), showForm: false }));
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);
  const [templateSuccessMessage, setTemplateSuccessMessage] = useState<string | null>(null);
  const [userRows, setUserRows] = useState<AdminUserRow[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userLastRefreshedAt, setUserLastRefreshedAt] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'agent' | 'team_leader' | 'admin' | 'super_admin'>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'deactivated'>('all');
  const [userTestUsersOnly, setUserTestUsersOnly] = useState(false);
  const [userShowRecentFirst, setUserShowRecentFirst] = useState(true);
  const [userRowLimit, setUserRowLimit] = useState(16);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [knownUserEmailsById, setKnownUserEmailsById] = useState<KnownUserEmailMap>({});
  const [userCopyNotice, setUserCopyNotice] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState<UserFormDraft>(emptyUserDraft);
  const [createUserDraft, setCreateUserDraft] = useState<CreateUserDraft>(emptyCreateUserDraft);
  const [createUserSaving, setCreateUserSaving] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserSuccessMessage, setCreateUserSuccessMessage] = useState<string | null>(null);
  const [userSaving, setUserSaving] = useState(false);
  const [userSaveError, setUserSaveError] = useState<string | null>(null);
  const [userSuccessMessage, setUserSuccessMessage] = useState<string | null>(null);
  const [calibrationLoading, setCalibrationLoading] = useState(false);
  const [calibrationError, setCalibrationError] = useState<string | null>(null);
  const [calibrationSnapshot, setCalibrationSnapshot] = useState<AdminUserCalibrationSnapshot | null>(null);
  const [calibrationEvents, setCalibrationEvents] = useState<AdminUserCalibrationEvent[]>([]);
  const [calibrationActionLoading, setCalibrationActionLoading] = useState(false);
  const [reportsProbeLoading, setReportsProbeLoading] = useState(false);
  const [reportsLastCheckedAt, setReportsLastCheckedAt] = useState<string | null>(null);
  const [analyticsOverviewStatus, setAnalyticsOverviewStatus] = useState<EndpointProbeStatus>({ kind: 'idle' });
  const [analyticsDetailedStatus, setAnalyticsDetailedStatus] = useState<EndpointProbeStatus>({ kind: 'idle' });
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const effectiveRoles = useMemo(() => {
    if (!__DEV__ || devRolePreview === 'live') return resolvedRoles;
    const normalized = normalizeAdminRole(devRolePreview);
    return normalized ? [normalized] : resolvedRoles;
  }, [devRolePreview, resolvedRoles]);
  const rolesLabel = formatRoles(effectiveRoles);
  const devOverrideActive = __DEV__ && devRolePreview !== 'live';
  const effectiveHasAdminAccess = effectiveRoles.includes('platform_admin') || effectiveRoles.includes('super_admin');
  const hasCoachRole = effectiveRoles.includes('coach');
  const hasTeamLeaderRole = effectiveRoles.includes('team_leader');
  const hasSponsorRole = effectiveRoles.includes('challenge_sponsor');
  const hasSuperAdminRole = effectiveRoles.includes('super_admin');
  const hasCoachFacingRole = hasCoachRole || hasTeamLeaderRole || hasSponsorRole;
  const activeRoute = getAdminRouteByKey(activeRouteKey);
  const canOpenActiveRoute = canAccessAdminRoute(effectiveRoles, activeRoute);
  const a1Routes = ADMIN_ROUTES.filter((route) => getAdminRouteStage(route.key) === 'A1 now').length;
  const blockedRoutes = ADMIN_ROUTES.filter((route) => !canAccessAdminRoute(effectiveRoles, route)).length;
  const coachingTransitionRoutes = useMemo(
    () =>
      ADMIN_ROUTES.filter(
        (route) =>
          COACH_PORTAL_TRANSITION_ROUTE_KEYS.includes(route.key as CoachingPortalSurfaceKey) &&
          canAccessAdminRoute(effectiveRoles, route)
      ),
    [effectiveRoles]
  );
  const isCoachingTransitionRoute = COACH_PORTAL_TRANSITION_ROUTE_KEYS.includes(activeRoute.key as CoachingPortalSurfaceKey);
  const showCoachPortalExperience = hasCoachFacingRole && !effectiveHasAdminAccess && isCoachingTransitionRoute;
  const usePersistentAccountDock = !showCoachPortalExperience && hasSuperAdminRole;
  const visibleRoutes = showCoachPortalExperience ? coachingTransitionRoutes : ADMIN_ROUTES;
  const accountInitial = (session?.user?.email?.trim().charAt(0) || backendRole?.trim().charAt(0) || 'A').toUpperCase();
  const accountLabel = session?.user?.email || 'Signed-in account';
  const backendRoleLabel = backendRole ? `Backend role: ${backendRole}` : 'Role source: session metadata';

  const renderAccountMenu = (coachTone = false) => (
    <View style={styles.accountMenuWrap}>
      <Pressable
        style={[
          styles.avatarButton,
          coachTone && styles.avatarButtonCoach,
          accountMenuOpen && styles.avatarButtonOpen,
        ]}
        onPress={() => setAccountMenuOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel="Open account menu"
      >
        <Text style={styles.avatarButtonText}>{accountInitial}</Text>
        <Text style={styles.avatarChevron}>▾</Text>
      </Pressable>
      {accountMenuOpen ? (
        <View style={styles.accountDropdown}>
          <Text style={styles.accountMenuLabel}>Account</Text>
          <Text style={styles.accountMenuValue} numberOfLines={1}>
            {accountLabel}
          </Text>
          <Text style={styles.accountMenuRole}>{backendRoleLabel}</Text>
          {hasSuperAdminRole ? (
            <TouchableOpacity
              style={styles.accountMenuSwitchSurface}
              onPress={() => {
                setAccountMenuOpen(false);
                if (Platform.OS !== 'web' || typeof window === 'undefined') return;
                const nextPath = showCoachPortalExperience ? '/admin/users' : '/coach/journeys';
                if (window.location.pathname === nextPath) return;
                window.history.pushState({}, '', nextPath);
                setLastNavPushPath(nextPath);
                const nextRoute = getAdminRouteByPath(nextPath);
                if (nextRoute) {
                  setUnknownAdminPath(null);
                  setActiveRouteKey(nextRoute.key);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={showCoachPortalExperience ? 'Switch to admin panel' : `Switch to ${portalTitle.toLowerCase()}`}
            >
              <Text style={styles.accountMenuSwitchSurfaceText}>
                {showCoachPortalExperience ? 'Switch to Admin Panel' : `Switch to ${portalTitle}`}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.accountMenuSignOut}
            onPress={() => {
              setAccountMenuOpen(false);
              void signOut();
            }}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={styles.accountMenuSignOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const syncFromLocation = () => {
      const pathname = window.location.pathname;
      if (pathname === ADMIN_UNAUTHORIZED_PATH || pathname === ADMIN_NOT_FOUND_PATH) {
        return;
      }

      const match = getAdminRouteByPath(pathname);
      if (!match) {
        if (pathname.startsWith('/admin')) {
          setUnknownAdminPath(pathname);
        } else {
          setUnknownAdminPath(null);
        }
        return;
      }
      setUnknownAdminPath(null);
      setActiveRouteKey((prev) => (prev === match.key ? prev : match.key));
    };

    syncFromLocation();
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    if (!pathname.startsWith('/admin')) {
      setUnknownAdminPath(null);
      return;
    }
    if (pathname === ADMIN_UNAUTHORIZED_PATH || pathname === ADMIN_NOT_FOUND_PATH) {
      return;
    }

    setUnknownAdminPath(getAdminRouteByPath(pathname) ? null : pathname);
  }, [activeRouteKey, canOpenActiveRoute]);

  useEffect(() => {
    if (effectiveHasAdminAccess) return;
    if (!hasCoachFacingRole) return;
    if (canOpenActiveRoute) return;
    const firstCoachRoute = coachingTransitionRoutes[0];
    if (!firstCoachRoute) return;
    if (firstCoachRoute.key !== activeRouteKey) {
      setUnknownAdminPath(null);
      setActiveRouteKey(firstCoachRoute.key);
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname !== firstCoachRoute.path) {
        window.history.replaceState({}, '', firstCoachRoute.path);
      }
    }
  }, [
    activeRouteKey,
    canOpenActiveRoute,
    coachingTransitionRoutes,
    effectiveHasAdminAccess,
    hasCoachFacingRole,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    const route = getAdminRouteByKey(activeRouteKey);
    const shouldShowUnauthorized = !canOpenActiveRoute;
    const nextPath = shouldShowUnauthorized
      ? ADMIN_UNAUTHORIZED_PATH
      : unknownAdminPath
        ? ADMIN_NOT_FOUND_PATH
        : route.path;
    if (window.location.pathname === nextPath) return;
    if (lastNavPushPath && nextPath === lastNavPushPath) {
      setLastNavPushPath(null);
      return;
    }
    window.history.replaceState({}, '', nextPath);
  }, [activeRouteKey, canOpenActiveRoute, lastNavPushPath, unknownAdminPath]);

  const refreshKpis = async () => {
    if (!session?.access_token) return;
    setKpiLoading(true);
    setKpiError(null);
    try {
      const rows = await fetchAdminKpis(session.access_token);
      setKpiRows(sortRowsByUpdatedDesc(rows));
    } catch (error) {
      setKpiError(error instanceof Error ? error.message : 'Failed to load KPIs');
    } finally {
      setKpiLoading(false);
    }
  };

  const refreshTemplates = async () => {
    if (!session?.access_token) return;
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const rows = await fetchAdminChallengeTemplates(session.access_token);
      setTemplateRows(sortRowsByUpdatedDesc(rows));
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Failed to load templates');
    } finally {
      setTemplateLoading(false);
    }
  };

  const refreshUsers = async (): Promise<AdminUserRow[]> => {
    if (!session?.access_token) return [];
    setUserLoading(true);
    setUserError(null);
    try {
      const rows = await fetchAdminUsers(session.access_token);
      const sorted = sortRowsByUpdatedDesc(rows);
      setUserRows(sorted);
      setUserLastRefreshedAt(new Date().toISOString());
      setSelectedUser((prev) => {
        if (!prev) return sorted[0] ?? null;
        return sorted.find((row) => row.id === prev.id) ?? null;
      });
      return sorted;
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'Failed to load users');
      return [];
    } finally {
      setUserLoading(false);
    }
  };

  const refreshSelectedUserCalibration = async (userId: string) => {
    if (!session?.access_token) return;
    setCalibrationLoading(true);
    setCalibrationError(null);
    try {
      const [snapshot, events] = await Promise.all([
        fetchAdminUserCalibration(session.access_token, userId),
        fetchAdminUserCalibrationEvents(session.access_token, userId),
      ]);
      setCalibrationSnapshot(snapshot);
      setCalibrationEvents(events);
    } catch (error) {
      setCalibrationError(error instanceof Error ? error.message : 'Failed to load calibration');
    } finally {
      setCalibrationLoading(false);
    }
  };

  const probeReportsEndpoints = async () => {
    if (!session?.access_token) return;
    setReportsProbeLoading(true);
    setAnalyticsOverviewStatus({ kind: 'loading' });
    setAnalyticsDetailedStatus({ kind: 'loading' });
    try {
      const [overview, detailed] = await Promise.all([
        probeAdminAnalyticsOverview(session.access_token),
        probeAdminDetailedReports(session.access_token),
      ]);
      setAnalyticsOverviewStatus(overview);
      setAnalyticsDetailedStatus(detailed);
      setReportsLastCheckedAt(new Date().toISOString());
    } finally {
      setReportsProbeLoading(false);
    }
  };

  const probeReportsOverviewOnly = async () => {
    if (!session?.access_token) return;
    setReportsProbeLoading(true);
    setAnalyticsOverviewStatus({ kind: 'loading' });
    try {
      const overview = await probeAdminAnalyticsOverview(session.access_token);
      setAnalyticsOverviewStatus(overview);
      setReportsLastCheckedAt(new Date().toISOString());
    } finally {
      setReportsProbeLoading(false);
    }
  };

  const probeReportsDetailedOnly = async () => {
    if (!session?.access_token) return;
    setReportsProbeLoading(true);
    setAnalyticsDetailedStatus({ kind: 'loading' });
    try {
      const detailed = await probeAdminDetailedReports(session.access_token);
      setAnalyticsDetailedStatus(detailed);
      setReportsLastCheckedAt(new Date().toISOString());
    } finally {
      setReportsProbeLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!session?.access_token) return;
    if (activeRouteKey !== 'kpis' && activeRouteKey !== 'challengeTemplates') return;
    if (!effectiveHasAdminAccess) return;

    void refreshKpis().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeRouteKey, effectiveHasAdminAccess, session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) return;
    if (activeRouteKey !== 'users') return;
    if (!effectiveHasAdminAccess) return;
    void refreshUsers().catch(() => {});
  }, [activeRouteKey, effectiveHasAdminAccess, session?.access_token]);

  useEffect(() => {
    if (activeRouteKey !== 'users') return;
    setUserRowLimit(16);
  }, [activeRouteKey, userSearchQuery, userRoleFilter, userStatusFilter, userTestUsersOnly]);

  useEffect(() => {
    if (!session?.access_token) return;
    if (!selectedUser?.id) {
      setCalibrationSnapshot(null);
      setCalibrationEvents([]);
      setCalibrationError(null);
      return;
    }
    if (activeRouteKey !== 'users') return;
    if (!effectiveHasAdminAccess) return;
    void refreshSelectedUserCalibration(selectedUser.id).catch(() => {});
  }, [activeRouteKey, effectiveHasAdminAccess, selectedUser?.id, session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) return;
    if (activeRouteKey !== 'reports') return;
    if (!effectiveHasAdminAccess) return;
    void probeReportsEndpoints().catch(() => {});
  }, [activeRouteKey, effectiveHasAdminAccess, session?.access_token]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.access_token) return;
    if (activeRouteKey !== 'challengeTemplates') return;
    if (!effectiveHasAdminAccess) return;

    void refreshTemplates().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeRouteKey, effectiveHasAdminAccess, session?.access_token]);

  const handleKpiCreate = async () => {
    if (!session?.access_token) return;
    const built = buildKpiPayloadFromDraft(kpiDraft);
    if (!built.payload) {
      setKpiSaveError(built.error ?? 'Invalid KPI form');
      return;
    }
    setKpiSaving(true);
    setKpiSaveError(null);
    setKpiSuccessMessage(null);
    try {
      const created = await createAdminKpi(session.access_token, built.payload);
      setKpiRows((prev) => sortRowsByUpdatedDesc([created, ...prev.filter((row) => row.id !== created.id)]));
      setKpiDraft(kpiDraftFromRow(created));
      setKpiSuccessMessage(`KPI created: ${created.name}`);
      await refreshKpis();
    } catch (error) {
      setKpiSaveError(error instanceof Error ? error.message : 'Failed to create KPI');
    } finally {
      setKpiSaving(false);
    }
  };

  const handleKpiUpdate = async () => {
    if (!session?.access_token || !kpiDraft.id) return;
    const built = buildKpiPayloadFromDraft(kpiDraft);
    if (!built.payload) {
      setKpiSaveError(built.error ?? 'Invalid KPI form');
      return;
    }
    setKpiSaving(true);
    setKpiSaveError(null);
    setKpiSuccessMessage(null);
    try {
      const updated = await updateAdminKpi(session.access_token, kpiDraft.id, built.payload);
      setKpiRows((prev) => sortRowsByUpdatedDesc([updated, ...prev.filter((row) => row.id !== updated.id)]));
      setKpiDraft(kpiDraftFromRow(updated));
      setKpiSuccessMessage(`KPI updated: ${updated.name}`);
      await refreshKpis();
    } catch (error) {
      setKpiSaveError(error instanceof Error ? error.message : 'Failed to update KPI');
    } finally {
      setKpiSaving(false);
    }
  };

  const handleKpiDeactivate = async () => {
    if (!session?.access_token || !kpiDraft.id) return;
    const confirmed = await confirmDangerAction(
      `Deactivate KPI "${kpiDraft.name || 'this KPI'}"? This marks it inactive.`
    );
    if (!confirmed) return;
    setKpiSaving(true);
    setKpiSaveError(null);
    setKpiSuccessMessage(null);
    try {
      const deactivated = await deactivateAdminKpi(session.access_token, kpiDraft.id);
      setKpiRows((prev) =>
        sortRowsByUpdatedDesc([deactivated, ...prev.filter((row) => row.id !== deactivated.id)])
      );
      setKpiDraft(emptyKpiDraft());
      setKpiSuccessMessage(`KPI deactivated: ${deactivated.name ?? 'updated row'}`);
      await refreshKpis();
    } catch (error) {
      setKpiSaveError(error instanceof Error ? error.message : 'Failed to deactivate KPI');
    } finally {
      setKpiSaving(false);
    }
  };

  const handleTemplateCreate = async () => {
    if (!session?.access_token) return;
    const built = buildTemplatePayloadFromDraft(templateDraft);
    if (!built.payload) {
      setTemplateSaveError(built.error ?? 'Invalid template form');
      return;
    }
    setTemplateSaving(true);
    setTemplateSaveError(null);
    setTemplateSuccessMessage(null);
    try {
      const created = await createAdminChallengeTemplate(session.access_token, built.payload);
      setTemplateRows((prev) =>
        sortRowsByUpdatedDesc([created, ...prev.filter((row) => row.id !== created.id)])
      );
      setTemplateDraft(templateDraftFromRow(created));
      setTemplateSuccessMessage(`Template created: ${created.name}`);
      await refreshTemplates();
    } catch (error) {
      setTemplateSaveError(error instanceof Error ? error.message : String(error) || 'Failed to create template');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleTemplateUpdate = async () => {
    if (!session?.access_token || !templateDraft.id) return;
    const built = buildTemplatePayloadFromDraft(templateDraft);
    if (!built.payload) {
      setTemplateSaveError(built.error ?? 'Invalid template form');
      return;
    }
    setTemplateSaving(true);
    setTemplateSaveError(null);
    setTemplateSuccessMessage(null);
    try {
      const updated = await updateAdminChallengeTemplate(session.access_token, templateDraft.id, built.payload);
      setTemplateRows((prev) =>
        sortRowsByUpdatedDesc([updated, ...prev.filter((row) => row.id !== updated.id)])
      );
      setTemplateDraft(templateDraftFromRow(updated));
      setTemplateSuccessMessage(`Template updated: ${updated.name}`);
      await refreshTemplates();
    } catch (error) {
      setTemplateSaveError(error instanceof Error ? error.message : 'Failed to update template');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleTemplateDeactivate = async () => {
    if (!session?.access_token || !templateDraft.id) return;
    const confirmed = await confirmDangerAction(
      `Deactivate template "${templateDraft.name || 'this template'}"? This marks it inactive.`
    );
    if (!confirmed) return;
    setTemplateSaving(true);
    setTemplateSaveError(null);
    setTemplateSuccessMessage(null);
    try {
      const deactivated = await deactivateAdminChallengeTemplate(session.access_token, templateDraft.id);
      setTemplateRows((prev) =>
        sortRowsByUpdatedDesc([deactivated, ...prev.filter((row) => row.id !== deactivated.id)])
      );
      setTemplateDraft(emptyTemplateDraft());
      setTemplateSuccessMessage(`Template deactivated: ${deactivated.name ?? 'updated row'}`);
      await refreshTemplates();
    } catch (error) {
      setTemplateSaveError(error instanceof Error ? error.message : 'Failed to deactivate template');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleUserSave = async () => {
    if (!session?.access_token || !selectedUser?.id) return;
    const original = selectedUser;
    const userId = original.id;
    setUserSaving(true);
    setUserSaveError(null);
    setUserSuccessMessage(null);
    const appliedChanges: string[] = [];
    try {
      let latestRow: AdminUserRow = original;
      if (userDraft.role !== original.role) {
        const updated = await updateAdminUserRole(session.access_token, userId, userDraft.role);
        latestRow = { ...latestRow, ...updated };
        appliedChanges.push(`role -> ${updated.role}`);
      }
      if (userDraft.tier !== original.tier) {
        const updated = await updateAdminUserTier(session.access_token, userId, userDraft.tier);
        latestRow = { ...latestRow, ...updated };
        appliedChanges.push(`tier -> ${updated.tier}`);
      }
      if (userDraft.accountStatus !== original.account_status) {
        if (userDraft.accountStatus === 'deactivated') {
          const confirmed = await confirmDangerAction(`Deactivate user ${userId}?`);
          if (!confirmed) {
            return;
          }
        }
        const updated = await updateAdminUserStatus(session.access_token, userId, userDraft.accountStatus);
        latestRow = { ...latestRow, ...updated };
        appliedChanges.push(`status -> ${updated.account_status}`);
      }

      if (appliedChanges.length === 0) {
        setUserSuccessMessage('No user changes to save');
        return;
      }

      setUserRows((prev) =>
        sortRowsByUpdatedDesc(
          prev.map((row) =>
            row.id === userId ? { ...row, ...latestRow, updated_at: new Date().toISOString() } : row
          )
        )
      );
      setSelectedUser((prev) => (prev?.id === userId ? { ...prev, ...latestRow, updated_at: new Date().toISOString() } : prev));
      setUserSuccessMessage(`Saved user changes (${appliedChanges.join(', ')})`);
      await refreshUsers();
    } catch (error) {
      const baseMessage = error instanceof Error ? error.message : 'Failed to update user';
      const partialMessage =
        appliedChanges.length > 0
          ? `Partial save applied (${appliedChanges.join(', ')}), then failed: ${baseMessage}`
          : baseMessage;
      setUserSaveError(partialMessage);
      const refreshed = await refreshUsers();
      const refreshedRow = refreshed.find((row) => row.id === userId) ?? null;
      if (refreshedRow) {
        setSelectedUser(refreshedRow);
        setUserDraft(userDraftFromRow(refreshedRow));
      }
    } finally {
      setUserSaving(false);
    }
  };

  const handleBulkUserStatusUpdate = async (
    userIds: string[],
    status: 'active' | 'deactivated'
  ): Promise<BulkUserStatusUpdateResult> => {
    if (!session?.access_token || !userIds.length) {
      return { updatedCount: 0, failedCount: 0, failedIds: [] };
    }
    setUserSaving(true);
    setUserSaveError(null);
    setUserSuccessMessage(null);
    const failedIds: string[] = [];
    let updatedCount = 0;
    const uniqueIds = Array.from(new Set(userIds));
    try {
      for (const userId of uniqueIds) {
        try {
          const updated = await updateAdminUserStatus(session.access_token, userId, status);
          updatedCount += 1;
          setUserRows((prev) =>
            sortRowsByUpdatedDesc(
              prev.map((row) =>
                row.id === userId ? { ...row, ...updated, updated_at: new Date().toISOString() } : row
              )
            )
          );
          setSelectedUser((prev) =>
            prev?.id === userId ? { ...prev, ...updated, updated_at: new Date().toISOString() } : prev
          );
          setUserDraft((prev) =>
            prev.id === userId ? { ...prev, accountStatus: updated.account_status } : prev
          );
        } catch {
          failedIds.push(userId);
        }
      }
      if (updatedCount > 0) {
        setUserSuccessMessage(
          `Bulk status update complete: ${updatedCount} user${updatedCount === 1 ? '' : 's'} set to ${status}`
        );
      }
      if (failedIds.length > 0) {
        setUserSaveError(
          `Bulk status update failed for ${failedIds.length} user${failedIds.length === 1 ? '' : 's'} (${failedIds.slice(0, 5).join(', ')}${failedIds.length > 5 ? ', ...' : ''})`
        );
      }
      await refreshUsers();
      return { updatedCount, failedCount: failedIds.length, failedIds };
    } finally {
      setUserSaving(false);
    }
  };

  const handleCreateUser = async () => {
    if (!session?.access_token) return;
    const email = createUserDraft.email.trim().toLowerCase();
    const password = createUserDraft.password;
    if (!email) {
      setCreateUserError('Email is required');
      return;
    }
    if (password.length < 8) {
      setCreateUserError('Temporary password must be at least 8 characters');
      return;
    }

    setCreateUserSaving(true);
    setCreateUserError(null);
    setCreateUserSuccessMessage(null);
    try {
      const created = await createAdminUser(session.access_token, {
        email,
        password,
        role: createUserDraft.role,
        tier: createUserDraft.tier,
        account_status: createUserDraft.accountStatus,
      });
      setCreateUserSuccessMessage(
        `${created.email} created (${created.user.id}) • role=${created.user.role} • tier=${created.user.tier} • status=${created.user.account_status}`
      );
      setKnownUserEmailsById((prev) => ({ ...prev, [created.user.id]: created.email }));
      setUserTestUsersOnly(true);
      setUserShowRecentFirst(true);
      setCreateUserDraft(emptyCreateUserDraft());
      const refreshed = await refreshUsers();
      const createdRow = refreshed.find((row) => row.id === created.user.id) ?? created.user;
      setSelectedUser(createdRow);
      setUserDraft(userDraftFromRow(createdRow));
    } catch (error) {
      setCreateUserError(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setCreateUserSaving(false);
    }
  };

  const handleCopySelectedUserId = async () => {
    if (!selectedUser?.id) return;
    const ok = await copyTextToClipboard(selectedUser.id);
    setUserCopyNotice(ok ? 'Copied user ID' : 'Could not copy user ID (clipboard unavailable)');
  };

  const handleCopySelectedUserEmail = async () => {
    if (!selectedUser) return;
    const email = selectedUser.email ?? knownUserEmailsById[selectedUser.id];
    if (!email) return;
    const ok = await copyTextToClipboard(email);
    setUserCopyNotice(ok ? 'Copied user email' : 'Could not copy email (clipboard unavailable)');
  };

  const handleResetCalibration = async () => {
    if (!session?.access_token || !selectedUser?.id) return;
    const confirmed = await confirmDangerAction(`Reset all KPI calibration rows for user ${selectedUser.id}?`);
    if (!confirmed) return;
    setCalibrationActionLoading(true);
    setUserSaveError(null);
    setUserSuccessMessage(null);
    try {
      const result = await resetAdminUserCalibration(session.access_token, selectedUser.id);
      setUserSuccessMessage(`Calibration reset for ${result.rows.length} row(s)`);
      await refreshSelectedUserCalibration(selectedUser.id);
    } catch (error) {
      setUserSaveError(error instanceof Error ? error.message : 'Failed to reset calibration');
    } finally {
      setCalibrationActionLoading(false);
    }
  };

  const handleReinitializeCalibration = async () => {
    if (!session?.access_token || !selectedUser?.id) return;
    const confirmed = await confirmDangerAction(
      `Reinitialize calibration from onboarding metadata for user ${selectedUser.id}?`
    );
    if (!confirmed) return;
    setCalibrationActionLoading(true);
    setUserSaveError(null);
    setUserSuccessMessage(null);
    try {
      const result = await reinitializeAdminUserCalibrationFromOnboarding(session.access_token, selectedUser.id);
      setUserSuccessMessage(`Reinitialized ${result.reinitialized_rows} calibration row(s) from onboarding`);
      await refreshSelectedUserCalibration(selectedUser.id);
    } catch (error) {
      setUserSaveError(error instanceof Error ? error.message : 'Failed to reinitialize calibration');
    } finally {
      setCalibrationActionLoading(false);
    }
  };

  const checklistItems = [
    { label: 'Admin shell layout + navigation scaffold', status: 'done' },
    { label: 'Auth/session wiring (reuse Supabase session)', status: 'done' },
    { label: 'AuthZ role checks + route guards', status: 'done' },
    { label: 'Unauthorized state + /admin/unauthorized path flow', status: 'done' },
    { label: 'Unknown /admin/* path handling + not-found state', status: 'done' },
    { label: 'A1 placeholder screens for admin routes', status: 'done' },
    { label: 'A2/A3 route placeholders clearly marked as upcoming', status: 'done' },
    { label: 'Manual authz acceptance pass (admin vs non-admin)', status: 'done' },
  ] as const;
  const coachScopeLabel = hasCoachRole ? 'Coach' : hasTeamLeaderRole ? 'Team Leader' : hasSponsorRole ? 'Sponsor' : 'Scoped';
  const portalTitle = hasCoachRole ? 'Coach Portal' : hasTeamLeaderRole ? 'Team Portal' : hasSponsorRole ? 'Sponsor Portal' : 'Coach Portal';
  const portalEyebrow = hasCoachRole ? 'Compass Coach' : hasTeamLeaderRole ? 'Compass Team Leader' : hasSponsorRole ? 'Compass Sponsor' : 'Compass Coach';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={[styles.shell, isCompact && styles.shellCompact]}>
        {!showCoachPortalExperience ? (
          <View style={[styles.sidebar, isCompact && styles.sidebarCompact]}>
            <View style={styles.sidebarHeader}>
              <CompassMark width={28} height={28} />
              <Text style={styles.sidebarTitle}>Admin</Text>
            </View>

            <ScrollView
              horizontal={isCompact}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.navList, isCompact && styles.navListCompact]}
              style={styles.navScroll}
            >
              {visibleRoutes
                .filter((route) => !COACH_PORTAL_TRANSITION_ROUTE_KEYS.includes(route.key as CoachingPortalSurfaceKey))
                .map((route) => {
                const selected = route.key === activeRouteKey;
                const allowed = canAccessAdminRoute(effectiveRoles, route);
                return (
                  <Pressable
                    key={route.key}
                    style={[
                      styles.navItem,
                      selected && styles.navItemSelected,
                      !allowed && styles.navItemDisabled,
                      isCompact && styles.navItemCompact,
                    ]}
                    onPress={() => {
                      setUnknownAdminPath(null);
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        const nextPath = route.path;
                        if (window.location.pathname !== nextPath) {
                          window.history.pushState({}, '', nextPath);
                          setLastNavPushPath(nextPath);
                        }
                      }
                      setActiveRouteKey(route.key);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: !allowed }}
                  >
                    <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{route.label}</Text>
                  </Pressable>
                );
              })}
              {/* Single consolidated Coach Portal link */}
              {hasSuperAdminRole ? (
                <Pressable
                  key="coachPortalLink"
                  style={[
                    styles.navItem,
                    COACH_PORTAL_TRANSITION_ROUTE_KEYS.includes(activeRoute.key as CoachingPortalSurfaceKey) && styles.navItemSelected,
                    isCompact && styles.navItemCompact,
                  ]}
                  onPress={() => {
                    setUnknownAdminPath(null);
                    const nextPath = '/coach/journeys';
                    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname !== nextPath) {
                      window.history.pushState({}, '', nextPath);
                      setLastNavPushPath(nextPath);
                    }
                    setActiveRouteKey('coachingJourneys');
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: COACH_PORTAL_TRANSITION_ROUTE_KEYS.includes(activeRoute.key as CoachingPortalSurfaceKey) }}
                >
                  <Text style={[styles.navLabel, COACH_PORTAL_TRANSITION_ROUTE_KEYS.includes(activeRoute.key as CoachingPortalSurfaceKey) && styles.navLabelSelected]}>{portalTitle}</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        <View style={[styles.contentColumn, showCoachPortalExperience && styles.contentColumnCoach]}>
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={[
              styles.contentScrollInner,
              (activeRoute.key === 'kpis' || activeRoute.key === 'challengeTemplates' || activeRoute.key === 'projectionLab') && { flex: 1 },
            ]}
            scrollEnabled={activeRoute.key !== 'kpis' && activeRoute.key !== 'challengeTemplates' && activeRoute.key !== 'projectionLab'}
            showsVerticalScrollIndicator
          >
            {showCoachPortalExperience ? (
              <View style={styles.coachStandaloneHeader}>
                <View style={styles.coachStandaloneHeaderCopy}>
                  <Text style={styles.coachStandaloneEyebrow}>{portalEyebrow}</Text>
                  <Text style={styles.coachStandaloneTitle}>{portalTitle}</Text>
                  <Text style={styles.coachStandaloneSubtitle}>
                    Publish content, manage journeys, coordinate cohorts, and run channels from a dedicated coach workspace.
                  </Text>
                </View>
                <View style={styles.coachStandaloneHeaderActions}>
                  <View style={[styles.roleBadge, styles.roleBadgeCoach]}>
                    {backendRoleLoading ? <ActivityIndicator size="small" color="#1F4EBF" /> : null}
                    <Text style={styles.roleBadgeText}>
                      {backendRole ? `Role: ${backendRole}` : `Scope: ${coachScopeLabel}`}
                    </Text>
                  </View>
                  {renderAccountMenu(true)}
                </View>
              </View>
            ) : (
              <View style={styles.header}>
                <Text style={styles.headerTitle}>{activeRoute.label}</Text>
                <View style={styles.headerActions}>
                  {renderAccountMenu()}
                </View>
              </View>
            )}
            {showCoachPortalExperience ? (
              <View style={[styles.coachTopNavCard, styles.coachTopNavCardStandalone]}>
                <View style={styles.formHeaderRow}>
                  <Text style={styles.summaryLabel}>Coach Product Navigation</Text>
                  <Text style={styles.metaRow}>Canonical coach routes: /coach/*</Text>
                </View>
                <View style={styles.sectionNavRow}>
                  {COACH_PORTAL_NAV_ITEMS.map((item) => {
                    const selected = activeRoute.key === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        style={[styles.sectionNavPill, selected && styles.sectionNavPillSelected]}
                        onPress={() => {
                          const nextRoute = getAdminRouteByKey(item.key);
                          setUnknownAdminPath(null);
                          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname !== nextRoute.path) {
                            window.history.pushState({}, '', nextRoute.path);
                            setLastNavPushPath(nextRoute.path);
                          }
                          setActiveRouteKey(item.key);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.sectionNavPillText, selected && styles.sectionNavPillTextSelected]}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.metaRow}>
                  {COACH_PORTAL_ROUTE_BLURBS[activeRoute.key as CoachingPortalSurfaceKey] ??
                    'Role-scoped coach route access is active for this section.'}
                </Text>
              </View>
            ) : null}
            {showCoachPortalExperience ? (
              <View style={styles.coachStandaloneContextCard}>
                <Text style={styles.summaryLabel}>Coach Route Context</Text>
                <Text style={styles.summaryValue}>{coachScopeLabel} scope active for this portal session.</Text>
                <Text style={styles.summaryNote}>
                  Legacy `/admin/coaching/*` paths remain compatibility redirects to canonical `/coach/*` routes.
                </Text>
              </View>
            ) : null}

            {!showCoachPortalExperience && activeRoute.key === 'overview' ? (
              <View style={styles.welcomeCard}>
                <Text style={styles.welcomeTitle}>Admin Dashboard</Text>
                <Text style={styles.welcomeSubtitle}>
                  {effectiveHasAdminAccess
                    ? `Signed in as ${rolesLabel}. ${ADMIN_ROUTES.filter((r) => canAccessAdminRoute(effectiveRoles, r)).length} sections available.`
                    : 'Select a section from the sidebar to get started.'}
                </Text>
              </View>
            ) : null}

            {__DEV__ && !showCoachPortalExperience ? (
              <View style={styles.devPanel}>
                <View style={styles.devPanelHeader}>
                  <Text style={styles.devPanelTitle}>Dev AuthZ Preview</Text>
                  <Text style={styles.devPanelSubtitle}>UI-only role simulation for A1 guard testing</Text>
                </View>
                <View style={[styles.devChipsRow, isCompact && styles.devChipsRowCompact]}>
                  {([
                    ['live', 'Use live role'],
                    ['super_admin', 'Preview super admin'],
                    ['admin', 'Preview admin'],
                    ['coach', 'Preview coach'],
                    ['team_leader', 'Preview team leader'],
                    ['sponsor', 'Preview sponsor'],
                    ['agent', 'Preview non-admin'],
                  ] as const).map(([value, label]) => {
                    const selected = devRolePreview === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setDevRolePreview(value)}
                        style={[styles.devChip, selected && styles.devChipSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.devChipText, selected && styles.devChipTextSelected]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={[styles.content, (activeRoute.key === 'kpis' || activeRoute.key === 'challengeTemplates' || activeRoute.key === 'projectionLab') && { flex: 1 }]}>
              <AdminRouteGuard
                route={activeRoute}
                rolesOverride={effectiveRoles}
                fallback={({ reason, route }) => (
                  <UnauthorizedState
                    title={reason === 'not_admin' ? 'Unauthorized admin access' : 'Route access denied'}
                    message={
                      reason === 'not_admin'
                        ? 'This admin surface requires a platform or super admin role in the current session metadata.'
                        : `Your current role does not meet the guard for ${route.path}.`
                    }
                    rolesLabel={rolesLabel}
                    debugLines={debugLines}
                    devOverrideLabel={devOverrideActive ? devRolePreview : undefined}
                    onResetDevPreview={devOverrideActive ? () => setDevRolePreview('live') : undefined}
                  />
                )}
              >
                {unknownAdminPath ? (
                  <NotFoundState requestedPath={unknownAdminPath} />
                ) : activeRoute.key === 'kpis' ? (
                  <AdminKpiCatalogPanel
                    rows={kpiRows}
                    loading={kpiLoading}
                    error={kpiError}
                    searchQuery={kpiSearchQuery}
                    onSearchQueryChange={setKpiSearchQuery}
                    statusFilter={kpiStatusFilter}
                    onStatusFilterChange={setKpiStatusFilter}
                    typeFilter={kpiTypeFilter}
                    onTypeFilterChange={setKpiTypeFilter}
                    draft={kpiDraft}
                    onDraftChange={(patch) => {
                      setKpiSaveError(null);
                      setKpiSuccessMessage(null);
                      setKpiDraft((prev) => ({ ...prev, ...patch }));
                    }}
                    onSelectRow={(row) => {
                      setKpiSaveError(null);
                      setKpiSuccessMessage(null);
                      setKpiDraft(kpiDraftFromRow(row));
                    }}
                    onResetDraft={() => {
                      setKpiSaveError(null);
                      setKpiSuccessMessage(null);
                      setKpiDraft(emptyKpiDraft());
                    }}
                    onSubmitCreate={handleKpiCreate}
                    onSubmitUpdate={handleKpiUpdate}
                    onDeactivate={handleKpiDeactivate}
                    saving={kpiSaving}
                    saveError={kpiSaveError}
                    successMessage={kpiSuccessMessage}
                  />
                ) : activeRoute.key === 'challengeTemplates' ? (
                  <AdminChallengeTemplatesPanel
                    rows={templateRows}
                    kpiRows={kpiRows}
                    loading={templateLoading}
                    error={templateError}
                    searchQuery={templateSearchQuery}
                    onSearchQueryChange={setTemplateSearchQuery}
                    statusFilter={templateStatusFilter}
                    onStatusFilterChange={setTemplateStatusFilter}
                    draft={templateDraft}
                    onDraftChange={(patch) => {
                      setTemplateSaveError(null);
                      setTemplateSuccessMessage(null);
                      setTemplateDraft((prev) => ({ ...prev, ...patch }));
                    }}
                    onSelectRow={(row) => {
                      setTemplateSaveError(null);
                      setTemplateSuccessMessage(null);
                      setTemplateDraft(templateDraftFromRow(row));
                    }}
                    onResetDraft={() => {
                      setTemplateSaveError(null);
                      setTemplateSuccessMessage(null);
                      setTemplateDraft(emptyTemplateDraft());
                    }}
                    onSubmitCreate={handleTemplateCreate}
                    onSubmitUpdate={handleTemplateUpdate}
                    onDeactivate={handleTemplateDeactivate}
                    saving={templateSaving}
                    saveError={templateSaveError}
                    successMessage={templateSuccessMessage}
                  />
                ) : activeRoute.key === 'users' ? (
                  <AdminUsersPanel
                    rows={userRows}
                    loading={userLoading}
                    error={userError}
                    searchQuery={userSearchQuery}
                    onSearchQueryChange={setUserSearchQuery}
                    roleFilter={userRoleFilter}
                    onRoleFilterChange={setUserRoleFilter}
                    statusFilter={userStatusFilter}
                    onStatusFilterChange={setUserStatusFilter}
                    selectedUser={selectedUser}
                    userDraft={userDraft}
                    onSelectUser={(row) => {
                      setSelectedUser(row);
                      setUserDraft(userDraftFromRow(row));
                    }}
                    onUserDraftChange={(patch) => {
                      setUserSaveError(null);
                      setUserSuccessMessage(null);
                      setUserDraft((prev) => ({ ...prev, ...patch }));
                    }}
                    createUserDraft={createUserDraft}
                    onCreateUserDraftChange={(patch) => {
                      setCreateUserError(null);
                      setCreateUserSuccessMessage(null);
                      setCreateUserDraft((prev) => ({ ...prev, ...patch }));
                    }}
                    onCreateUserSubmit={handleCreateUser}
                    onCreateUserReset={() => {
                      setCreateUserError(null);
                      setCreateUserSuccessMessage(null);
                      setCreateUserDraft(emptyCreateUserDraft());
                    }}
                    devPreviewActive={devOverrideActive}
                    onRefreshUsers={() => {
                      void refreshUsers();
                    }}
                    onSaveUser={handleUserSave}
                    onResetCalibration={handleResetCalibration}
                    onReinitializeCalibration={handleReinitializeCalibration}
                    lastRefreshedAt={userLastRefreshedAt}
                    rowLimit={userRowLimit}
                    onShowMoreRows={() => setUserRowLimit((prev) => prev + 16)}
                    onResetRowLimit={() => setUserRowLimit(16)}
                    testUsersOnly={userTestUsersOnly}
                    onToggleTestUsersOnly={() => setUserTestUsersOnly((prev) => !prev)}
                    showRecentFirst={userShowRecentFirst}
                    onToggleShowRecentFirst={() => setUserShowRecentFirst((prev) => !prev)}
                    knownUserEmailsById={knownUserEmailsById}
                    copyNotice={userCopyNotice}
                    onCopyUserId={() => {
                      void handleCopySelectedUserId();
                    }}
                    onCopyUserEmail={() => {
                      void handleCopySelectedUserEmail();
                    }}
                    createUserSaving={createUserSaving}
                    createUserError={createUserError}
                    createUserSuccessMessage={createUserSuccessMessage}
                    userSaving={userSaving}
                    userSaveError={userSaveError}
                    userSuccessMessage={userSuccessMessage}
                    calibrationLoading={calibrationLoading}
                    calibrationError={calibrationError}
                    calibrationSnapshot={calibrationSnapshot}
                    calibrationEvents={calibrationEvents}
                    calibrationActionLoading={calibrationActionLoading}
                    onBulkStatusUpdate={handleBulkUserStatusUpdate}
                    bulkStatusUpdateLoading={userSaving}
                  />
                ) : activeRoute.key === 'authz' ? (
                  <AdminAuthzPanel
                    effectiveRoles={effectiveRoles}
                    backendRole={backendRole}
                    backendRoleLoading={backendRoleLoading}
                    backendRoleError={backendRoleError}
                  />
                ) : activeRoute.key === 'reports' ? (
                  <AdminReportsPanel
                    overviewStatus={analyticsOverviewStatus}
                    detailedStatus={analyticsDetailedStatus}
                    lastCheckedAt={reportsLastCheckedAt}
                    onRefresh={() => {
                      void probeReportsEndpoints();
                    }}
                    onRefreshOverview={() => {
                      void probeReportsOverviewOnly();
                    }}
                    onRefreshDetailed={() => {
                      void probeReportsDetailedOnly();
                    }}
                    loading={reportsProbeLoading}
                  />
                ) : activeRoute.key === 'coachingAudit' ? (
                  <AdminCoachingAuditPanel effectiveRoles={effectiveRoles} />
                ) : activeRoute.key === 'coachingUploads' ||
                  activeRoute.key === 'coachingLibrary' ? (
                  <AdminMediaLibraryPanel
                    routeKey={activeRoute.key}
                    effectiveRoles={effectiveRoles}
                    accessToken={session?.access_token ?? ''}
                    onNavigate={(next) => {
                      const nextRoute = getAdminRouteByKey(next);
                      setUnknownAdminPath(null);
                      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname !== nextRoute.path) {
                        window.history.pushState({}, '', nextRoute.path);
                        setLastNavPushPath(nextRoute.path);
                      }
                      setActiveRouteKey(next);
                    }}
                  />
                ) : activeRoute.key === 'coachingJourneys' ||
                  activeRoute.key === 'coachingCohorts' ||
                  activeRoute.key === 'coachingChannels' ? (
                  <AdminCoachingPortalFoundationPanel
                    routeKey={activeRoute.key}
                    effectiveRoles={effectiveRoles}
                    onNavigate={(next) => {
                      const nextRoute = getAdminRouteByKey(next);
                      setUnknownAdminPath(null);
                      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname !== nextRoute.path) {
                        window.history.pushState({}, '', nextRoute.path);
                        setLastNavPushPath(nextRoute.path);
                      }
                      setActiveRouteKey(next);
                    }}
                  />
                ) : activeRoute.key === 'projectionLab' ? (
                  <AdminProjectionLabPanel adminUser={session?.user?.email ?? 'admin'} catalogKpis={kpiRows} />
                ) : (
                  <PlaceholderScreen route={activeRoute} rolesLabel={rolesLabel} />
                )}
              </AdminRouteGuard>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  backgroundOrbOne: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#E2E8F0',
    top: -60,
    right: -40,
    opacity: 0.55,
  },
  backgroundOrbOneCoach: {
    backgroundColor: '#CFEBDD',
  },
  backgroundOrbTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#DBEAFE',
    bottom: 40,
    left: -60,
    opacity: 0.5,
  },
  backgroundOrbTwoCoach: {
    backgroundColor: '#E4F4D8',
  },
  shell: {
    flex: 1,
    flexDirection: 'row',
    gap: 0,
    padding: 0,
  },
  shellCompact: {
    flexDirection: 'column',
    gap: 0,
  },
  sidebar: {
    width: 260,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  sidebarCoach: {
    width: 300,
  },
  sidebarCompact: {
    width: '100%',
    flexDirection: 'row' as const,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  sidebarHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 16,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  sidebarTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 200,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandLogoWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#172554',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  brandLogoWrapCoach: {
    backgroundColor: '#10251D',
    borderColor: '#3B705D',
  },
  brandCopy: {
    flex: 1,
  },
  brandTag: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  brandTagCoach: {
    color: '#B6EACD',
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  brandTitleCoach: {
    color: '#F3FFF9',
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  brandSubtitleCoach: {
    color: '#D0E8DC',
  },
  brandMetricsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  brandMetricCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brandMetricCardCoach: {
    backgroundColor: '#214337',
    borderColor: '#406E5B',
  },
  brandMetricLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '700',
  },
  brandMetricLabelCoach: {
    color: '#CBE8D9',
  },
  brandMetricValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  brandFootnote: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  brandFootnoteCoach: {
    color: '#CAE6D7',
  },
  navScroll: {
    flex: 1,
  },
  navList: {
    gap: 2,
  },
  navListCompact: {
    gap: 10,
    paddingRight: 8,
  },
  navItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  navItemCoach: {
    backgroundColor: '#F6FCF8',
    borderColor: '#D3E9DB',
  },
  navItemCompact: {
    width: 220,
  },
  navItemSelected: {
    borderLeftColor: '#3B82F6',
    backgroundColor: '#334155',
  },
  navItemCoachSelected: {
    borderColor: '#2D8A62',
    backgroundColor: '#EAF8F0',
  },
  navItemDisabled: {
    opacity: 0.65,
  },
  navLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  navLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  navTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  navStagePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  navStageText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  navPath: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  navFooterCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  navFooterCardCoach: {
    backgroundColor: '#F3FBF6',
    borderColor: '#D6EBDC',
  },
  navFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navFooterCopy: {
    flex: 1,
  },
  navFooterTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  navFooterText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  navFooterTextCoach: {
    color: '#4A6D5D',
  },
  contentColumn: {
    flex: 1,
    minWidth: 0,
  },
  contentColumnCoach: {
    maxWidth: 1180,
    alignSelf: 'center',
    width: '100%',
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollInner: {
    gap: 14,
    paddingBottom: 24,
  },
  /* ── List-Detail shared layout (KPI Catalog, Challenge Templates) ── */
  listDetailContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  listPanel: {
    width: 340,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
  },
  listPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  listPanelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  listPanelCreateBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  listPanelCreateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  listSearchInput: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#334155',
  },
  listFilterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  listFilterPillSelected: {
    backgroundColor: '#3B82F6',
  },
  listFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  listFilterPillTextSelected: {
    color: '#FFFFFF',
  },
  listCountText: {
    fontSize: 12,
    color: '#94A3B8',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listScrollView: {
    flex: 1,
  },
  listRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listRowSelected: {
    borderLeftColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  listRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  listRowTitleSelected: {
    color: '#1E40AF',
  },
  listRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  listRowBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  listRowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listShowMore: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  listShowMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  listEmptyState: {
    padding: 24,
    alignItems: 'center',
  },
  listEmptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  detailPanel: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  detailEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  detailEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  detailEmptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  detailScrollInner: {
    gap: 16,
    paddingBottom: 24,
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCoach: {
    backgroundColor: 'rgba(245,252,247,0.96)',
    borderColor: '#D4EBDD',
  },
  coachStandaloneHeader: {
    backgroundColor: 'rgba(244,251,247,0.98)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D4EBDD',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  coachStandaloneHeaderCopy: {
    flex: 1,
    minWidth: 260,
  },
  coachStandaloneHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  coachStandaloneEyebrow: {
    color: '#3E7B61',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  coachStandaloneTitle: {
    color: '#21342A',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  coachStandaloneSubtitle: {
    color: '#506A5C',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    zIndex: 30,
  },
  persistentAccountDock: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 120,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  signOutButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  signOutButtonCoach: {
    backgroundColor: '#F5FAF7',
    borderColor: '#D4E7DA',
  },
  signOutButtonText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 14,
  },
  accountMenuWrap: {
    position: 'relative',
    alignItems: 'flex-end',
  },
  avatarButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  avatarButtonCoach: {
    borderColor: '#CAE8D8',
    backgroundColor: '#ECF8F1',
  },
  avatarButtonOpen: {
    borderColor: '#2563EB',
  },
  avatarButtonText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  avatarChevron: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  accountDropdown: {
    position: 'absolute',
    top: 42,
    right: 0,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    minWidth: 220,
    padding: 10,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
    zIndex: 40,
  },
  accountMenuLabel: {
    color: '#64748B',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  accountMenuValue: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '600',
  },
  accountMenuRole: {
    color: '#64748B',
    fontSize: 11,
  },
  accountMenuSignOut: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
  },
  accountMenuSwitchSurface: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
  },
  accountMenuSwitchSurfaceText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  accountMenuSignOutText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 320,
  },
  roleBadgeCoach: {
    backgroundColor: '#ECF8F1',
    borderColor: '#CAE8D8',
  },
  roleBadgeText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  summaryRowCompact: {
    flexDirection: 'column',
  },
  usersTopSplit: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  usersOpsCard: {
    flex: 1,
    minWidth: 320,
    alignSelf: 'stretch',
  },
  usersWorkflowBanner: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  usersWorkflowBannerCopy: {
    flex: 1,
    minWidth: 220,
    gap: 2,
  },
  usersWorkflowBannerTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  usersWorkflowBannerText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  usersFilterSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  usersNoResultsCard: {
    marginTop: 10,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 8,
  },
  usersNoResultsTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  usersNoResultsText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  activityFeedCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 8,
  },
  activityFeedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  activityFeedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  activityFeedDotSuccess: {
    backgroundColor: '#1FA56B',
  },
  activityFeedDotError: {
    backgroundColor: '#C14A3A',
  },
  activityFeedDotInfo: {
    backgroundColor: '#3E6FD8',
  },
  activityFeedCopy: {
    flex: 1,
    gap: 2,
  },
  activityFeedText: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 17,
  },
  activityFeedMeta: {
    color: '#64748B',
    fontSize: 11,
  },
  selectedUserSummaryCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    gap: 6,
  },
  userOpsSection: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
  },
  usersDiagnosticsGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 8,
  },
  collapsibleHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  collapsibleChevron: {
    fontSize: 14,
    color: '#94A3B8',
  },
  summaryCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  endpointHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  summaryValue: {
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 6,
  },
  summaryNote: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 6,
  },
  endpointStatusBanner: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  endpointStatusBannerCopy: {
    flex: 1,
    gap: 2,
  },
  endpointStatusBannerLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  endpointStatusBannerValue: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  endpointStatusBannerNote: {
    color: '#64748B',
    fontSize: 12,
  },
  reportsOpsSummaryCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 8,
  },
  reportsOpsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reportsOpsSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  reportsOpsSummaryLabel: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  reportsOpsSummaryPath: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  codePreviewBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
  },
  codePreviewText: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
  },
  checklistCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  checklistHeader: {
    gap: 4,
  },
  checklistTitle: {
    color: '#202B3E',
    fontSize: 15,
    fontWeight: '700',
  },
  checklistSubtitle: {
    color: '#748198',
    fontSize: 12,
  },
  checklistList: {
    gap: 8,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checklistDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checklistDotDone: {
    backgroundColor: '#1FA56B',
  },
  checklistDotPending: {
    backgroundColor: '#D4A64F',
  },
  checklistText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  checklistTextDone: {
    color: '#243248',
    fontWeight: '600',
  },
  checklistTextPending: {
    color: '#6E5A2D',
    fontWeight: '600',
  },
  devPanel: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  devPanelHeader: {
    gap: 2,
  },
  devPanelTitle: {
    color: '#202B3E',
    fontSize: 14,
    fontWeight: '700',
  },
  devPanelSubtitle: {
    color: '#748198',
    fontSize: 12,
  },
  devChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  devChipsRowCompact: {
    flexDirection: 'column',
  },
  devChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8E3F7',
    backgroundColor: '#F4F8FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  devChipSelected: {
    borderColor: '#7FA7FF',
    backgroundColor: '#E7F0FF',
  },
  devChipText: {
    color: '#35538A',
    fontSize: 12,
    fontWeight: '600',
  },
  devChipTextSelected: {
    color: '#1B49B4',
  },
  content: {
    minHeight: 260,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    gap: 10,
    minHeight: 260,
  },
  panelTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  panelTitleBlock: {
    flex: 1,
  },
  eyebrow: {
    color: '#5e78b5',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  panelTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '700',
  },
  panelBody: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  metaList: {
    marginTop: space.sm,
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  metaRow: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  stagePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stagePillText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  placeholderGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  placeholderCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 6,
  },
  placeholderCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6E7E9A',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  placeholderCardValue: {
    fontSize: 13,
    lineHeight: 18,
    color: '#0F172A',
    fontWeight: '600',
  },
  formCard: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 10,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  formTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  smallGhostButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
  },
  smallGhostButtonText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  formField: {
    gap: 5,
    minWidth: 180,
    flex: 1,
  },
  formFieldWide: {
    minWidth: 280,
    flex: 1.5,
  },
  formLabel: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  readonlyValueBox: {
    borderWidth: 1,
    borderColor: '#E1E8F5',
    borderRadius: 10,
    backgroundColor: '#F7FAFF',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  readonlyValueText: {
    color: '#32435C',
    fontSize: 13,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  sectionNavPill: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFF',
  },
  sectionNavPillSelected: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  sectionNavPillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionNavPillTextSelected: {
    color: '#1D4ED8',
  },
  formChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
  },
  formChipSelected: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  formChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  formChipTextSelected: {
    color: '#1D4ED8',
  },
  inlineToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fieldHelpText: {
    color: '#6F7D95',
    fontSize: 11,
    lineHeight: 16,
  },
  coachTopNavCard: {
    borderWidth: 1,
    borderColor: '#DDE8FA',
    borderRadius: 12,
    backgroundColor: '#F8FBFF',
    padding: 12,
    gap: 8,
  },
  coachTopNavCardStandalone: {
    borderColor: '#D3E9DB',
    backgroundColor: '#F4FBF7',
  },
  coachStandaloneContextCard: {
    borderWidth: 1,
    borderColor: '#D7EBDD',
    borderRadius: 12,
    backgroundColor: '#F7FCF9',
    padding: 12,
    gap: 6,
  },
  filterBar: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 10,
  },
  toggleChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
  },
  toggleChipOn: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  toggleChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleChipTextOn: {
    color: '#1D4ED8',
  },
  formActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  menuList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    minWidth: 220,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  menuItemText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  alertSuccessBox: {
    borderWidth: 1,
    borderColor: '#B6E6CB',
    backgroundColor: '#EFFFF6',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  alertSuccessTitle: {
    color: '#146C43',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertSuccessText: {
    color: '#1E5F43',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  alertErrorBox: {
    borderWidth: 1,
    borderColor: '#F2C0B9',
    backgroundColor: '#FFF5F2',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  alertErrorTitle: {
    color: '#B2483A',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertErrorText: {
    color: '#8E3D32',
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  warnButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  warnButtonText: {
    color: '#B2483A',
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#B33A3A',
  },
  successText: {
    color: '#1C7A4C',
    fontWeight: '600',
  },
  tableWrap: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeaderCell: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableHeaderCellActive: {
    color: '#1D4ED8',
  },
  tableDataRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableDataRowSelectedStrong: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  tableCellText: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#334155',
    fontSize: 12,
  },
  tablePrimary: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  tableSecondary: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  colWide: {
    flex: 1.6,
  },
  colMd: {
    flex: 0.8,
  },
  colSm: {
    flex: 0.7,
  },
  tableFootnote: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#64748B',
    fontSize: 11,
    backgroundColor: '#F8FAFC',
  },
  rowBadgeLine: {
    marginTop: 3,
    flexDirection: 'row',
  },
  rowMiniBadge: {
    borderWidth: 1,
    borderColor: '#CFE0FF',
    backgroundColor: '#EEF4FF',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rowMiniBadgeText: {
    color: '#2D58AA',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  keyValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF3FA',
    paddingVertical: 6,
  },
  keyValueLabel: {
    flex: 1,
    color: '#5F6F88',
    fontSize: 12,
  },
  keyValueValue: {
    color: '#23324A',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  compactDataCard: {
    borderWidth: 1,
    borderColor: '#E6EDF9',
    borderRadius: 10,
    backgroundColor: '#FBFDFF',
    padding: 8,
    gap: 5,
    marginTop: 6,
  },
  compactDataTitle: {
    color: '#223149',
    fontSize: 12,
    fontWeight: '700',
  },
  compactDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  compactDataMeta: {
    color: '#6E7E99',
    fontSize: 11,
  },
  compactDataValue: {
    color: '#31445F',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  debugBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e8edf5',
    paddingTop: 10,
    gap: 4,
  },
  noticeBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFE1AA',
    backgroundColor: '#FFF7E8',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  noticeTitle: {
    color: '#8A5600',
    fontSize: 12,
    fontWeight: '700',
  },
  noticeText: {
    color: '#815F26',
    fontSize: 12,
  },
  noticeButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBC57F',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  noticeButtonText: {
    color: '#8A5600',
    fontSize: 12,
    fontWeight: '700',
  },
  debugTitle: {
    color: '#6b2f2f',
    fontWeight: '700',
    fontSize: 12,
  },
  debugLine: {
    color: '#5f6675',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Courier',
  },
});

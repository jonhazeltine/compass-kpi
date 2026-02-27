import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useAdminAuthz } from '../contexts/AdminAuthzContext';
import { useAuth } from '../contexts/AuthContext';
import {
  createAdminChallengeTemplate,
  createAdminKpi,
  deactivateAdminChallengeTemplate,
  deactivateAdminKpi,
  fetchAdminChallengeTemplates,
  fetchAdminKpis,
  updateAdminChallengeTemplate,
  updateAdminKpi,
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
import {
  ADMIN_NOT_FOUND_PATH,
  ADMIN_UNAUTHORIZED_PATH,
  getAdminRouteStage,
  getAdminRouteStageTone,
} from '../lib/adminShellConfig';
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

type TemplateFormDraft = {
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
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
  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? '',
    type: (row.type as KpiFormDraft['type']) ?? 'Custom',
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
  return { name: '', description: '', isActive: true };
}

function templateDraftFromRow(row: AdminChallengeTemplateRow): TemplateFormDraft {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    isActive: row.is_active,
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
  if (!draft.name.trim()) return { error: 'Name is required' };
  return {
    payload: {
      name: draft.name.trim(),
      description: draft.description,
      is_active: draft.isActive,
    },
  };
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
  type KpiSortKey = 'kpi' | 'type' | 'pc_weight' | 'range' | 'ttc' | 'decay' | 'status' | 'updated';
  const [visibleRowCount, setVisibleRowCount] = useState(24);
  const [sortKey, setSortKey] = useState<KpiSortKey>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
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
    <View style={styles.panel}>
      <View style={styles.panelTopRow}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.eyebrow}>/admin/kpis</Text>
          <Text style={styles.panelTitle}>KPI Catalog</Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: '#EEF3FF', borderColor: '#CEDBFF' }]}>
          <Text style={[styles.stagePillText, { color: '#204ECF' }]}>A2 Now</Text>
        </View>
      </View>
      <Text style={styles.panelBody}>
        Manage KPI definitions for admin operations with search, filtering, and create/edit/deactivate controls.
      </Text>
      <View style={styles.filterBar}>
        <View style={[styles.formField, styles.formFieldWide]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.metaRow}>
              {filteredRows.length} filtered / {rows.length} total
              {activeFilterCount
                ? ` • ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
                : ' • no filters'}
            </Text>
            <View style={styles.formActionsRow}>
              {statusFilter !== 'all' || typeFilter !== 'all' ? (
                <TouchableOpacity
                  style={styles.smallGhostButton}
                  onPress={() => {
                    onStatusFilterChange('all');
                    onTypeFilterChange('all');
                  }}
                >
                  <Text style={styles.smallGhostButtonText}>Reset filters</Text>
                </TouchableOpacity>
              ) : null}
              {searchQuery.trim() ? (
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => onSearchQueryChange('')}>
                  <Text style={styles.smallGhostButtonText}>Clear search</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
        <View style={[styles.formField, styles.formFieldWide]}>
          <Text style={styles.formLabel}>Search</Text>
          <TextInput
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            style={styles.input}
            placeholder="Search name, slug, type"
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Status</Text>
          <View style={styles.inlineToggleRow}>
            {(['all', 'active', 'inactive'] as const).map((value) => {
              const selected = statusFilter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => onStatusFilterChange(value)}
                  style={[styles.toggleChip, selected && styles.toggleChipOn]}
                >
                  <Text style={[styles.toggleChipText, selected && styles.toggleChipTextOn]}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={[styles.formField, styles.formFieldWide]}>
          <Text style={styles.formLabel}>Type Filter</Text>
          <View style={styles.chipRow}>
            {(['all', 'PC', 'GP', 'VP', 'Actual', 'Pipeline_Anchor', 'Custom'] as const).map((value) => {
              const selected = typeFilter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => onTypeFilterChange(value)}
                  style={[styles.formChip, selected && styles.formChipSelected]}
                >
                  <Text style={[styles.formChipText, selected && styles.formChipTextSelected]}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>{editing ? 'Edit KPI' : 'Create KPI'}</Text>
          <TouchableOpacity style={styles.smallGhostButton} onPress={onResetDraft}>
            <Text style={styles.smallGhostButtonText}>{editing ? 'New KPI' : 'Clear'}</Text>
          </TouchableOpacity>
        </View>
        {selectedRow ? (
          <View style={styles.selectedUserSummaryCard}>
            <View style={styles.formHeaderRow}>
              <View>
                <Text style={styles.formTitle}>Selected KPI</Text>
                <Text style={styles.metaRow}>{selectedRow.name}</Text>
              </View>
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
            <TextInput value={draft.name} onChangeText={(name) => onDraftChange({ name })} style={styles.input} />
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
      {loading ? <Text style={styles.metaRow}>Loading KPI catalog...</Text> : null}
      {error ? <Text style={[styles.metaRow, styles.errorText]}>Error: {error}</Text> : null}
      {!loading && !error ? (
        <>
          <View style={styles.formHeaderRow}>
            <Text style={styles.metaRow}>
              {filteredRows.length === 0
                ? rows.length === 0
                  ? 'No KPI rows loaded yet.'
                  : `No KPI rows match current search/filter (${rows.length} total loaded)`
                : `Showing ${visibleRows.length} of ${filteredRows.length} filtered rows (${rows.length} total loaded)`}
            </Text>
            <View style={styles.formActionsRow}>
              {filteredRows.length > visibleRowCount ? (
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => setVisibleRowCount((prev) => prev + 24)}>
                  <Text style={styles.smallGhostButtonText}>
                    Show more ({Math.max(0, filteredRows.length - visibleRowCount)} left)
                  </Text>
                </TouchableOpacity>
              ) : null}
              {visibleRowCount > 24 ? (
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => setVisibleRowCount(24)}>
                  <Text style={styles.smallGhostButtonText}>Reset rows</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <View style={styles.tableWrap}>
            <Text style={styles.tableFootnote}>
              Click a row to load it into the form above for editing. The selected row stays highlighted.
            </Text>
            <View style={styles.tableHeaderRow}>
              <Pressable style={styles.colWide} onPress={() => onSortHeaderPress('kpi')} accessibilityRole="button">
                <Text style={[styles.tableHeaderCell, sortKey === 'kpi' && styles.tableHeaderCellActive]}>
                  {kpiSortLabel('kpi', 'KPI')}
                </Text>
              </Pressable>
              <Pressable style={styles.colMd} onPress={() => onSortHeaderPress('type')} accessibilityRole="button">
                <Text style={[styles.tableHeaderCell, sortKey === 'type' && styles.tableHeaderCellActive]}>
                  {kpiSortLabel('type', 'Type')}
                </Text>
              </Pressable>
              <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('pc_weight')} accessibilityRole="button">
                <Text style={[styles.tableHeaderCell, sortKey === 'pc_weight' && styles.tableHeaderCellActive]}>
                  {kpiSortLabel('pc_weight', 'PC Wt')}
                </Text>
              </Pressable>
              <Pressable style={styles.colMd} onPress={() => onSortHeaderPress('range')} accessibilityRole="button">
                <Text style={[styles.tableHeaderCell, sortKey === 'range' && styles.tableHeaderCellActive]}>
                  {kpiSortLabel('range', 'Range')}
                </Text>
              </Pressable>
              <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('ttc')} accessibilityRole="button">
                <Text style={[styles.tableHeaderCell, sortKey === 'ttc' && styles.tableHeaderCellActive]}>
                  {kpiSortLabel('ttc', 'TTC')}
                </Text>
              </Pressable>
              <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('decay')} accessibilityRole="button">
                <Text style={[styles.tableHeaderCell, sortKey === 'decay' && styles.tableHeaderCellActive]}>
                  {kpiSortLabel('decay', 'Decay')}
                </Text>
              </Pressable>
              <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('status')} accessibilityRole="button">
                <Text style={[styles.tableHeaderCell, sortKey === 'status' && styles.tableHeaderCellActive]}>
                  {kpiSortLabel('status', 'Status')}
                </Text>
              </Pressable>
              <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('updated')} accessibilityRole="button">
                <Text style={[styles.tableHeaderCell, sortKey === 'updated' && styles.tableHeaderCellActive]}>
                  {kpiSortLabel('updated', 'Updated')}
                </Text>
              </Pressable>
            </View>
            {visibleRows.map((row) => (
              <Pressable
                key={row.id}
                style={[styles.tableDataRow, selectedRowId === row.id && styles.tableDataRowSelectedStrong]}
                onPress={() => onSelectRow(row)}
                accessibilityRole="button"
                accessibilityHint={`Load ${row.name} into the KPI form for editing`}
              >
                <View style={[styles.tableCell, styles.colWide]}>
                  <Text style={styles.tablePrimary}>{row.name}</Text>
                  <Text style={styles.tableSecondary}>{row.slug ?? row.id}</Text>
                </View>
                <Text style={[styles.tableCellText, styles.colMd]}>{row.type}</Text>
                <Text style={[styles.tableCellText, styles.colSm]}>
                  {row.pc_weight == null ? '-' : String(row.pc_weight)}
                </Text>
                <Text style={[styles.tableCellText, styles.colMd]}>{formatKpiRange(row)}</Text>
                <Text style={[styles.tableCellText, styles.colSm]}>
                  {row.ttc_days != null ? `${row.ttc_days}d` : '-'}
                </Text>
                <Text style={[styles.tableCellText, styles.colSm]}>
                  {row.decay_days == null ? '-' : `${row.decay_days}d`}
                </Text>
                <Text style={[styles.tableCellText, styles.colSm]}>{row.is_active ? 'active' : 'inactive'}</Text>
                <Text style={[styles.tableCellText, styles.colSm]}>{formatDateShort(row.updated_at)}</Text>
              </Pressable>
            ))}
            {filteredRows.length === 0 ? (
              <>
                <Text style={styles.tableFootnote}>
                  {rows.length === 0
                    ? 'No KPI definitions are loaded yet. Use the create form above to add the first KPI.'
                    : 'No KPI rows match the current search/filter. Adjust filters or clear search to continue browsing.'}
                </Text>
                {hasActiveFilters ? (
                  <View style={[styles.formActionsRow, { paddingHorizontal: 10, paddingBottom: 10, backgroundColor: '#FBFCFF' }]}>
                    {searchQuery.trim() ? (
                      <TouchableOpacity style={styles.smallGhostButton} onPress={() => onSearchQueryChange('')}>
                        <Text style={styles.smallGhostButtonText}>Clear search</Text>
                      </TouchableOpacity>
                    ) : null}
                    {(statusFilter !== 'all' || typeFilter !== 'all') ? (
                      <TouchableOpacity
                        style={styles.smallGhostButton}
                        onPress={() => {
                          onStatusFilterChange('all');
                          onTypeFilterChange('all');
                        }}
                      >
                        <Text style={styles.smallGhostButtonText}>Reset filters</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : filteredRows.length > visibleRowCount ? (
              <Text style={styles.tableFootnote}>
                More KPI rows are available. Use “Show more” to continue browsing without leaving the current edit form.
              </Text>
            ) : (
              <Text style={styles.tableFootnote}>End of filtered KPI results.</Text>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

function AdminChallengeTemplatesPanel({
  rows,
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

  return (
    <View style={styles.panel}>
      <View style={styles.panelTopRow}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.eyebrow}>/admin/challenge-templates</Text>
          <Text style={styles.panelTitle}>Challenge Templates</Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: '#EEF3FF', borderColor: '#CEDBFF' }]}>
          <Text style={[styles.stagePillText, { color: '#204ECF' }]}>A2 Now</Text>
        </View>
      </View>
      <Text style={styles.panelBody}>
        Manage challenge templates with search, filtering, and create/edit/deactivate controls for admin operations.
      </Text>
      <View style={styles.filterBar}>
        <View style={[styles.formField, styles.formFieldWide]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.metaRow}>
              {filteredRows.length} filtered / {rows.length} total
              {activeFilterCount
                ? ` • ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
                : ' • no filters'}
            </Text>
            <View style={styles.formActionsRow}>
              {statusFilter !== 'all' ? (
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => onStatusFilterChange('all')}>
                  <Text style={styles.smallGhostButtonText}>Reset filters</Text>
                </TouchableOpacity>
              ) : null}
              {searchQuery.trim() ? (
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => onSearchQueryChange('')}>
                  <Text style={styles.smallGhostButtonText}>Clear search</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
        <View style={[styles.formField, styles.formFieldWide]}>
          <Text style={styles.formLabel}>Search</Text>
          <TextInput
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            style={styles.input}
            placeholder="Search name or description"
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Status</Text>
          <View style={styles.inlineToggleRow}>
            {(['all', 'active', 'inactive'] as const).map((value) => {
              const selected = statusFilter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => onStatusFilterChange(value)}
                  style={[styles.toggleChip, selected && styles.toggleChipOn]}
                >
                  <Text style={[styles.toggleChipText, selected && styles.toggleChipTextOn]}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={styles.formCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>{editing ? 'Edit Template' : 'Create Template'}</Text>
          <TouchableOpacity style={styles.smallGhostButton} onPress={onResetDraft}>
            <Text style={styles.smallGhostButtonText}>{editing ? 'New Template' : 'Clear'}</Text>
          </TouchableOpacity>
        </View>
        {selectedRow ? (
          <View style={styles.selectedUserSummaryCard}>
            <View style={styles.formHeaderRow}>
              <View>
                <Text style={styles.formTitle}>Selected Template</Text>
                <Text style={styles.metaRow}>{selectedRow.name}</Text>
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
            <Text style={styles.metaRow} numberOfLines={2}>
              {selectedRow.description?.trim() || '(no description)'}
            </Text>
            <Text style={styles.metaRow}>Template ID: {selectedRow.id}</Text>
            {selectedRowHiddenByFilters ? (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeTitle}>Selected template is hidden by current filters</Text>
                <Text style={styles.noticeText}>
                  The edit form is still loaded for {selectedRow.name}, but the row is not visible in the table below.
                </Text>
                <View style={styles.formActionsRow}>
                  <TouchableOpacity
                    style={styles.noticeButton}
                    onPress={() => {
                      onSearchQueryChange('');
                      onStatusFilterChange('all');
                    }}
                  >
                    <Text style={styles.noticeButtonText}>Reveal row</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallGhostButton} onPress={onResetDraft}>
                    <Text style={styles.smallGhostButtonText}>Start new template</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Name</Text>
          <TextInput value={draft.name} onChangeText={(name) => onDraftChange({ name })} style={styles.input} />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Description</Text>
          <TextInput
            value={draft.description}
            onChangeText={(description) => onDraftChange({ description })}
            style={[styles.input, styles.inputMultiline]}
            multiline
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Status</Text>
          <Pressable
            onPress={() => onDraftChange({ isActive: !draft.isActive })}
            style={[styles.toggleChip, draft.isActive && styles.toggleChipOn]}
          >
            <Text style={[styles.toggleChipText, draft.isActive && styles.toggleChipTextOn]}>
              {draft.isActive ? 'Active' : 'Inactive'}
            </Text>
          </Pressable>
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
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Template'}
            </Text>
          </TouchableOpacity>
          {editing ? (
            <TouchableOpacity style={styles.warnButton} onPress={onDeactivate} disabled={saving}>
              <Text style={styles.warnButtonText}>{saving ? 'Working...' : 'Deactivate'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {loading ? <Text style={styles.metaRow}>Loading challenge templates...</Text> : null}
      {error ? <Text style={[styles.metaRow, styles.errorText]}>Error: {error}</Text> : null}
      {!loading && !error ? (
        <>
          <View style={styles.formHeaderRow}>
            <Text style={styles.metaRow}>
              {filteredRows.length === 0
                ? rows.length === 0
                  ? 'No challenge template rows loaded yet.'
                  : `No template rows match current search/filter (${rows.length} total loaded)`
                : `Showing ${visibleRows.length} of ${filteredRows.length} filtered rows (${rows.length} total loaded)`}
            </Text>
            <View style={styles.formActionsRow}>
              {filteredRows.length > visibleRowCount ? (
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => setVisibleRowCount((prev) => prev + 24)}>
                  <Text style={styles.smallGhostButtonText}>
                    Show more ({Math.max(0, filteredRows.length - visibleRowCount)} left)
                  </Text>
                </TouchableOpacity>
              ) : null}
              {visibleRowCount > 24 ? (
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => setVisibleRowCount(24)}>
                  <Text style={styles.smallGhostButtonText}>Reset rows</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <View style={styles.tableWrap}>
            <Text style={styles.tableFootnote}>
              Click a row to load it into the form above for editing. The selected row stays highlighted.
            </Text>
            <View style={styles.tableHeaderRow}>
              <Pressable style={styles.colWide} onPress={() => onSortHeaderPress('template')} accessibilityRole="button">
                <Text style={[styles.tableHeaderCell, sortKey === 'template' && styles.tableHeaderCellActive]}>
                  {templateSortLabel('template', 'Template')}
                </Text>
              </Pressable>
              <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('status')} accessibilityRole="button">
                <Text style={[styles.tableHeaderCell, sortKey === 'status' && styles.tableHeaderCellActive]}>
                  {templateSortLabel('status', 'Status')}
                </Text>
              </Pressable>
              <Pressable style={styles.colSm} onPress={() => onSortHeaderPress('updated')} accessibilityRole="button">
                <Text style={[styles.tableHeaderCell, sortKey === 'updated' && styles.tableHeaderCellActive]}>
                  {templateSortLabel('updated', 'Updated')}
                </Text>
              </Pressable>
            </View>
            {visibleRows.map((row) => (
              <Pressable
                key={row.id}
                style={[styles.tableDataRow, selectedRowId === row.id && styles.tableDataRowSelectedStrong]}
                onPress={() => onSelectRow(row)}
                accessibilityRole="button"
                accessibilityHint={`Load ${row.name} into the challenge template form for editing`}
              >
                <View style={[styles.tableCell, styles.colWide]}>
                  <Text style={styles.tablePrimary}>{row.name}</Text>
                  <Text numberOfLines={1} style={styles.tableSecondary}>
                    {row.description?.trim() || '(no description)'}
                  </Text>
                  <Text numberOfLines={1} style={styles.tableSecondary}>
                    ID: {row.id}
                  </Text>
                </View>
                <Text style={[styles.tableCellText, styles.colSm]}>{row.is_active ? 'active' : 'inactive'}</Text>
                <Text style={[styles.tableCellText, styles.colSm]}>{formatDateShort(row.updated_at)}</Text>
              </Pressable>
            ))}
            {filteredRows.length === 0 ? (
              <>
                <Text style={styles.tableFootnote}>
                  {rows.length === 0
                    ? 'No challenge templates are loaded yet. Use the create form above to add the first template.'
                    : 'No templates match the current search/filter. Adjust filters or clear search to continue browsing.'}
                </Text>
                {hasActiveFilters ? (
                  <View style={[styles.formActionsRow, { paddingHorizontal: 10, paddingBottom: 10, backgroundColor: '#FBFCFF' }]}>
                    {searchQuery.trim() ? (
                      <TouchableOpacity style={styles.smallGhostButton} onPress={() => onSearchQueryChange('')}>
                        <Text style={styles.smallGhostButtonText}>Clear search</Text>
                      </TouchableOpacity>
                    ) : null}
                    {statusFilter !== 'all' ? (
                      <TouchableOpacity style={styles.smallGhostButton} onPress={() => onStatusFilterChange('all')}>
                        <Text style={styles.smallGhostButtonText}>Reset filters</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : filteredRows.length > visibleRowCount ? (
              <Text style={styles.tableFootnote}>
                More templates are available. Use “Show more” to continue browsing without leaving the current edit form.
              </Text>
            ) : (
              <Text style={styles.tableFootnote}>End of filtered template results.</Text>
            )}
          </View>
        </>
      ) : null}
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
}) {
  type UserSortKey = 'user' | 'role' | 'tier' | 'status' | 'last_active' | 'user_id';
  const [showAllCalibrationRows, setShowAllCalibrationRows] = useState(false);
  const [showAllCalibrationEvents, setShowAllCalibrationEvents] = useState(false);
  const [userActivityFeed, setUserActivityFeed] = useState<Array<{ id: string; tone: 'success' | 'error' | 'info'; text: string; at: string }>>([]);
  const [sortKey, setSortKey] = useState<UserSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

  useEffect(() => {
    onResetRowLimit();
  }, [searchQuery, roleFilter, statusFilter, testUsersOnly, showRecentFirst, sortKey, sortDirection]);

  return (
    <View style={styles.panel}>
      <View style={styles.panelTopRow}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.eyebrow}>/admin/users</Text>
          <Text style={styles.panelTitle}>Users</Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: '#FFF5E6', borderColor: '#F5D9AA' }]}>
          <Text style={[styles.stagePillText, { color: '#9A5A00' }]}>A3 Now</Text>
        </View>
      </View>
      <Text style={styles.panelBody}>
        Manage user access, subscription tier, status, and calibration diagnostics for admin QA and support workflows.
      </Text>
      <View style={styles.metaList}>
        <Text style={styles.metaRow}>Last refreshed: {lastRefreshedAt ? formatDateTimeShort(lastRefreshedAt) : 'Not yet loaded'}</Text>
        <Text style={styles.metaRow}>
          Selected user: {selectedUser ? `${selectedUser.name ?? selectedUser.id} (${selectedUser.role} / ${selectedUser.tier} / ${selectedUser.account_status})` : 'none'}
        </Text>
        {selectedUser && selectedUserEmail ? (
          <View style={styles.inlineToggleRow}>
            <View style={[styles.statusChip, { backgroundColor: '#EAF1FF', borderColor: '#C8DAFF' }]}>
              <Text style={[styles.statusChipText, { color: '#1E4FBE' }]}>{selectedUserLooksTest ? 'Selected test user' : 'Selected user'}</Text>
            </View>
            <Text style={styles.metaRow}>{selectedUserEmail}</Text>
          </View>
        ) : null}
        {copyNotice ? <Text style={[styles.metaRow, styles.successText]}>{copyNotice}</Text> : null}
      </View>

      <View style={styles.usersWorkflowBanner}>
        <View style={styles.usersWorkflowBannerCopy}>
          <Text style={styles.usersWorkflowBannerTitle}>Test-user workflow</Text>
          <Text style={styles.usersWorkflowBannerText}>
            Create a test user, keep “Recent First” on, then select the row to manage access and run calibration checks.
          </Text>
        </View>
        <View style={styles.inlineToggleRow}>
          {testUsersOnly ? (
            <View style={[styles.statusChip, { backgroundColor: '#EFFCF4', borderColor: '#BFE6CC' }]}>
              <Text style={[styles.statusChipText, { color: '#1D7A4D' }]}>Test-user mode</Text>
            </View>
          ) : null}
          {showRecentFirst ? (
            <View style={[styles.statusChip, { backgroundColor: '#F4F8FF', borderColor: '#D8E4FA' }]}>
              <Text style={[styles.statusChipText, { color: '#345892' }]}>Recent first</Text>
            </View>
          ) : null}
        </View>
      </View>

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
            <TouchableOpacity style={styles.smallGhostButton} onPress={onRefreshUsers}>
              <Text style={styles.smallGhostButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.metaRow, { paddingHorizontal: 12 }]}>Click a user row to open access/tier controls and calibration details.</Text>
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
                <View style={styles.formActionsRow}>
                  <TouchableOpacity style={styles.smallGhostButton} onPress={onCopyUserId}>
                    <Text style={styles.smallGhostButtonText}>Copy User ID</Text>
                  </TouchableOpacity>
                  {selectedUserEmail ? (
                    <TouchableOpacity style={styles.smallGhostButton} onPress={onCopyUserEmail}>
                      <Text style={styles.smallGhostButtonText}>Copy Email</Text>
                    </TouchableOpacity>
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
              <View style={[styles.formActionsRow, { marginTop: 2 }]}>
                  <TouchableOpacity
                    style={styles.smallGhostButton}
                    onPress={onResetCalibration}
                    disabled={calibrationActionLoading}
                  >
                    <Text style={styles.smallGhostButtonText}>
                      {calibrationActionLoading ? 'Working...' : 'Reset Calibration'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.smallGhostButton}
                    onPress={onReinitializeCalibration}
                    disabled={calibrationActionLoading}
                  >
                    <Text style={styles.smallGhostButtonText}>Reinitialize From Onboarding</Text>
                  </TouchableOpacity>
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
          <Text style={styles.panelTitle}>Coach Portal • {surface.title}</Text>
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

function AdminCoachingAuditPanel() {
  type AuditSortKey = 'status' | 'requester' | 'scope' | 'surface' | 'updated';
  type NotificationChannelKey = 'in_app_list' | 'badge' | 'banner' | 'push_placeholder' | 'email_placeholder';
  type NotificationClassKey =
    | 'coaching_assignment'
    | 'coaching_reminder'
    | 'coaching_progress'
    | 'channel_message'
    | 'broadcast_outcome'
    | 'ai_review_queue'
    | 'ai_approval_outcome'
    | 'package_access_change'
    | 'policy_alert';
  const [rows, setRows] = useState<AdminAiSuggestionQueueItem[]>(() => buildStubAiSuggestionQueue());
  const [statusFilter, setStatusFilter] = useState<'all' | AiSuggestionStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<AuditSortKey>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleRowCount, setVisibleRowCount] = useState(12);
  const [notice, setNotice] = useState<string | null>(null);
  const [prefsPersona, setPrefsPersona] = useState<'team_leader' | 'team_member' | 'solo_user' | 'coach' | 'admin_operator'>('team_leader');
  const [prefsChannels, setPrefsChannels] = useState<Record<NotificationChannelKey, boolean>>({
    in_app_list: true,
    badge: true,
    banner: true,
    push_placeholder: false,
    email_placeholder: false,
  });
  const [prefsClasses, setPrefsClasses] = useState<Record<NotificationClassKey, boolean>>({
    coaching_assignment: true,
    coaching_reminder: true,
    coaching_progress: true,
    channel_message: true,
    broadcast_outcome: true,
    ai_review_queue: true,
    ai_approval_outcome: true,
    package_access_change: true,
    policy_alert: true,
  });

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
    const confirmed = await confirmDangerAction(`Approve AI suggestion ${selectedRow.id}? Human send/publish remains required.`);
    if (!confirmed) return;
    const note = promptForAuditNote('Approve');
    if (note === null) return;
    appendAuditEvent(selectedRow.id, {
      actorLabel: 'Admin operator (local UI)',
      action: 'approved',
      note: note || 'Approved in UI queue. Execution remains human-triggered via existing runtime paths.',
    }, 'approved');
    setNotice(`Approved ${selectedRow.id} (queue-only action; no send/publish performed).`);
  };

  const handleReject = async () => {
    if (!selectedRow) return;
    const confirmed = await confirmDangerAction(`Reject AI suggestion ${selectedRow.id}?`);
    if (!confirmed) return;
    const note = promptForAuditNote('Reject');
    if (note === null) return;
    appendAuditEvent(selectedRow.id, {
      actorLabel: 'Admin operator (local UI)',
      action: 'rejected',
      note: note || 'Rejected during policy/safety review in admin audit queue.',
    }, 'rejected');
    setNotice(`Rejected ${selectedRow.id}; audit history updated.`);
  };

  const handleReturnToPending = () => {
    if (!selectedRow) return;
    appendAuditEvent(selectedRow.id, {
      actorLabel: 'Admin operator (local UI)',
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
    'No KPI log / forecast / challenge mutation actions are exposed in this surface.',
    'Approve/Reject updates queue state + audit history only (approval-first UI workflow).',
    'No autonomous send/publish paths; execution remains human-triggered elsewhere.',
  ];

  const notificationVisibilityRows = [
    {
      id: 'notif_evt_001',
      cls: 'ai_review_queue',
      channel: 'in_app_list',
      audience: 'Admin operator',
      status: 'visible',
      reason: 'Approval queue pending admin review',
      route: '/admin/coaching/audit',
      dispatchedAt: null,
    },
    {
      id: 'notif_evt_002',
      cls: 'ai_approval_outcome',
      channel: 'banner',
      audience: 'Coach reviewer',
      status: 'suppressed',
      reason: 'Pref shell toggle off for banner in local preview',
      route: 'coach_ops_audit companion',
      dispatchedAt: null,
    },
    {
      id: 'notif_evt_003',
      cls: 'broadcast_outcome',
      channel: 'in_app_list',
      audience: 'Team Leader',
      status: 'visible',
      reason: 'Existing runtime visibility only; no dispatch control',
      route: 'inbox_channels / channel_thread',
      dispatchedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    },
    {
      id: 'notif_evt_004',
      cls: 'policy_alert',
      channel: 'badge',
      audience: 'Admin operator',
      status: 'visible',
      reason: 'Ops governance alert in admin companion view',
      route: '/admin/coaching/audit',
      dispatchedAt: null,
    },
  ] as const;

  const visibilityCounts = notificationVisibilityRows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.status === 'visible') acc.visible += 1;
      if (row.status === 'suppressed') acc.suppressed += 1;
      if (row.dispatchedAt) acc.outcomes += 1;
      return acc;
    },
    { total: 0, visible: 0, suppressed: 0, outcomes: 0 }
  );

  const toggleChannelPref = (key: NotificationChannelKey) => {
    setPrefsChannels((prev) => ({ ...prev, [key]: !prev[key] }));
    setNotice('Updated notification channel preference shell (local UI only; no persistence/write performed).');
  };
  const toggleClassPref = (key: NotificationClassKey) => {
    setPrefsClasses((prev) => ({ ...prev, [key]: !prev[key] }));
    setNotice('Updated notification class preference shell (local UI only; no persistence/write performed).');
  };

  const channelLabels: Record<NotificationChannelKey, string> = {
    in_app_list: 'In-app list',
    badge: 'Badge',
    banner: 'Banner',
    push_placeholder: 'Push (placeholder)',
    email_placeholder: 'Email (placeholder)',
  };
  const classLabels: Record<NotificationClassKey, string> = {
    coaching_assignment: 'Coaching assignment',
    coaching_reminder: 'Coaching reminder',
    coaching_progress: 'Progress update',
    channel_message: 'Channel message',
    broadcast_outcome: 'Broadcast outcome',
    ai_review_queue: 'AI review queue',
    ai_approval_outcome: 'AI approval outcome',
    package_access_change: 'Package access change',
    policy_alert: 'Policy alert',
  };

  return (
    <View style={styles.panel}>
      <View style={styles.panelTopRow}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.eyebrow}>/admin/coaching/audit</Text>
          <Text style={styles.panelTitle}>Coach Ops Audit + AI Approvals</Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: '#FFF5E6', borderColor: '#F5D9AA' }]}>
          <Text style={[styles.stagePillText, { color: '#9A5A00' }]}>W5 Approval-First</Text>
        </View>
      </View>
      <Text style={styles.panelBody}>
        Admin/coach governance companion surface for AI suggestion approval queue review, rejection, and audit history inspection.
      </Text>
      <View style={styles.alertErrorBox}>
        <Text style={styles.alertErrorTitle}>Disallowed actions preserved</Text>
        {aiPolicyGuardrails.map((line) => (
          <Text key={line} style={styles.alertErrorText}>{line}</Text>
        ))}
      </View>
      <View style={styles.usersDiagnosticsGrid}>
        <View style={[styles.summaryCard, { flex: 1.05 }]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.summaryLabel}>Notification Prefs Shell (W6)</Text>
            <Text style={styles.metaRow}>UI-only / stub-safe</Text>
          </View>
          <Text style={styles.fieldHelpText}>
            Preference controls are represented here as a coach/admin visibility and policy-check companion. No persistence or dispatch authority is changed in this pass.
          </Text>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Persona Preview</Text>
            <View style={styles.chipRow}>
              {(['team_leader', 'team_member', 'solo_user', 'coach', 'admin_operator'] as const).map((value) => {
                const selected = prefsPersona === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setPrefsPersona(value)}
                    style={[styles.formChip, selected && styles.formChipSelected]}
                  >
                    <Text style={[styles.formChipText, selected && styles.formChipTextSelected]}>{value}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Text style={styles.formLabel}>Channels</Text>
          <View style={styles.inlineToggleRow}>
            {(Object.keys(channelLabels) as NotificationChannelKey[]).map((key) => {
              const enabled = prefsChannels[key];
              return (
                <Pressable key={key} onPress={() => toggleChannelPref(key)} style={[styles.toggleChip, enabled && styles.toggleChipOn]}>
                  <Text style={[styles.toggleChipText, enabled && styles.toggleChipTextOn]}>
                    {enabled ? 'On' : 'Off'} • {channelLabels[key]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={[styles.summaryCard, { flex: 1.15 }]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.summaryLabel}>Notification Class Preferences</Text>
            <Text style={styles.metaRow}>{Object.values(prefsClasses).filter(Boolean).length} enabled</Text>
          </View>
          <Text style={styles.fieldHelpText}>
            W6 shell covers visibility preference intent only. Delivery execution and queue/dispatch ownership remain on existing runtime/backend controls.
          </Text>
          <View style={styles.chipRow}>
            {(Object.keys(classLabels) as NotificationClassKey[]).map((key) => {
              const enabled = prefsClasses[key];
              return (
                <Pressable
                  key={key}
                  onPress={() => toggleClassPref(key)}
                  style={[styles.formChip, enabled && styles.formChipSelected]}
                >
                  <Text style={[styles.formChipText, enabled && styles.formChipTextSelected]}>
                    {enabled ? 'On' : 'Off'} • {classLabels[key]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
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
          <Text style={[styles.metaRow, { paddingHorizontal: 12 }]}>Click a suggestion row to open approval details, flags, and audit history.</Text>
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
            <Text style={styles.formTitle}>Audit Detail + Review</Text>
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
                <TouchableOpacity style={styles.smallGhostButton} onPress={() => void copySelectedAuditSummary()}>
                  <Text style={styles.smallGhostButtonText}>Copy Audit Summary</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.panelBody}>Select an AI queue row to inspect approval requirements, safety flags, and audit history.</Text>
          )}
        </View>
      </View>

      <View style={styles.usersDiagnosticsGrid}>
        <View style={[styles.summaryCard, { flex: 1 }]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.summaryLabel}>Notification Visibility Companion</Text>
            <Text style={styles.metaRow}>{visibilityCounts.visible} visible / {visibilityCounts.total}</Text>
          </View>
          <Text style={styles.summaryNote}>
            Ops-facing visibility summary for coaching/AI-relevant notification states in the `coach_ops_audit` companion route (no dispatch controls).
          </Text>
          <View style={styles.keyValueRow}>
            <Text style={styles.keyValueLabel}>Visible</Text>
            <Text style={styles.keyValueValue}>{visibilityCounts.visible}</Text>
          </View>
          <View style={styles.keyValueRow}>
            <Text style={styles.keyValueLabel}>Suppressed</Text>
            <Text style={styles.keyValueValue}>{visibilityCounts.suppressed}</Text>
          </View>
          <View style={styles.keyValueRow}>
            <Text style={styles.keyValueLabel}>Dispatch outcomes visible</Text>
            <Text style={styles.keyValueValue}>{visibilityCounts.outcomes}</Text>
          </View>
          <Text style={styles.fieldHelpText}>
            This surface reports visibility/queue context only. Dispatch ownership remains outside this admin companion and is unchanged.
          </Text>
        </View>
        <View style={[styles.summaryCard, { flex: 1.35 }]}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.summaryLabel}>Ops Queue / Outcome Rows</Text>
            <Text style={styles.metaRow}>Preview rows</Text>
          </View>
          {notificationVisibilityRows.map((row) => (
            <View key={row.id} style={styles.compactDataCard}>
              <View style={styles.formHeaderRow}>
                <Text style={styles.compactDataTitle}>{row.cls}</Text>
                <View
                  style={[
                    styles.statusChip,
                    row.status === 'visible'
                      ? { backgroundColor: '#EFFCF4', borderColor: '#BFE6CC' }
                      : { backgroundColor: '#FFF4F2', borderColor: '#F2C0B9' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      { color: row.status === 'visible' ? '#1D7A4D' : '#B2483A' },
                    ]}
                  >
                    {row.status}
                  </Text>
                </View>
              </View>
              <View style={styles.compactDataRow}>
                <Text style={styles.compactDataMeta}>Audience / channel</Text>
                <Text style={styles.compactDataValue}>{row.audience} • {row.channel}</Text>
              </View>
              <View style={styles.compactDataRow}>
                <Text style={styles.compactDataMeta}>Reason</Text>
                <Text style={styles.compactDataValue}>{row.reason}</Text>
              </View>
              <View style={styles.compactDataRow}>
                <Text style={styles.compactDataMeta}>Route</Text>
                <Text style={styles.compactDataValue}>{row.route}</Text>
              </View>
              <View style={styles.compactDataRow}>
                <Text style={styles.compactDataMeta}>Dispatch outcome ref</Text>
                <Text style={styles.compactDataValue}>{row.dispatchedAt ? formatDateTimeShort(row.dispatchedAt) : 'not dispatched / not shown'}</Text>
              </View>
            </View>
          ))}
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

  return (
    <View style={styles.panel}>
      <View style={styles.panelTopRow}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.eyebrow}>/admin/reports</Text>
          <Text style={styles.panelTitle}>Analytics + Reports</Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: '#FFF5E6', borderColor: '#F5D9AA' }]}>
          <Text style={[styles.stagePillText, { color: '#9A5A00' }]}>A3 Now</Text>
        </View>
      </View>
      <Text style={styles.panelBody}>
        Reporting tools check live backend availability for analytics endpoints and show readable status and response details.
      </Text>
      <View style={styles.metaList}>
        <View style={styles.endpointStatusBanner}>
          <View style={styles.endpointStatusBannerCopy}>
            <Text style={styles.endpointStatusBannerLabel}>Current probe state</Text>
            <Text style={styles.endpointStatusBannerValue}>{overallLabel}</Text>
            <Text style={styles.endpointStatusBannerNote}>
              Last checked: {lastCheckedAt ? formatDateTimeShort(lastCheckedAt) : 'Not checked yet'}
            </Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: '#EEF4FF', borderColor: '#D3E1FF' }]}>
            <Text style={[styles.statusChipText, { color: '#1E4FBE' }]}>
              {lastCheckedAt ? 'State loaded' : 'Awaiting check'}
            </Text>
          </View>
        </View>
        {reportsCopyNotice ? <Text style={[styles.metaRow, styles.successText]}>{reportsCopyNotice}</Text> : null}
      </View>
      <View style={styles.formActionsRow}>
        <TouchableOpacity style={styles.primaryButton} onPress={onRefresh} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Checking...' : 'Recheck All Endpoints'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallGhostButton} onPress={() => void copyAllProbeSummary()}>
          <Text style={styles.smallGhostButtonText}>Copy All Probe Status</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.reportsOpsSummaryCard}>
        <View style={styles.formHeaderRow}>
          <Text style={styles.formTitle}>Operator Probe Summary</Text>
          <Text style={styles.metaRow}>{endpointOpsRows.filter((row) => row.status.kind === 'ready').length} ready</Text>
        </View>
        {endpointOpsRows.map((row) => (
          <View key={row.key} style={styles.reportsOpsSummaryRow}>
            <View style={styles.reportsOpsSummaryCopy}>
              <Text style={styles.reportsOpsSummaryLabel}>{row.label}</Text>
              <Text style={styles.reportsOpsSummaryPath}>{row.path}</Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: row.tone.bg, borderColor: row.tone.border }]}>
              <Text style={[styles.statusChipText, { color: row.tone.text }]}>{row.tone.label}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.fieldHelpText}>{operatorNextStep}</Text>
      </View>
      <View style={[styles.summaryRow, styles.summaryRowCompact]}>
        <View style={styles.summaryCard}>
          <View style={styles.endpointHeaderRow}>
            <Text style={styles.summaryLabel}>GET /admin/analytics/overview</Text>
            <View style={[styles.statusChip, { backgroundColor: overviewTone.bg, borderColor: overviewTone.border }]}>
              <Text style={[styles.statusChipText, { color: overviewTone.text }]}>{overviewTone.label}</Text>
            </View>
          </View>
          <Text style={styles.summaryValue} selectable>{formatProbeStatus(overviewStatus)}</Text>
          <View style={styles.formActionsRow}>
            <TouchableOpacity style={styles.smallGhostButton} onPress={onRefreshOverview ?? onRefresh} disabled={loading}>
              <Text style={styles.smallGhostButtonText}>Recheck</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallGhostButton}
              onPress={() => {
                void copyProbeDetails('GET /admin/analytics/overview', overviewStatus);
              }}
            >
              <Text style={styles.smallGhostButtonText}>Copy Details</Text>
            </TouchableOpacity>
          </View>
          {hasOverviewPreview ? (
            <>
              <TouchableOpacity
                style={styles.smallGhostButton}
                onPress={() => setExpandedOverview((prev) => !prev)}
              >
                <Text style={styles.smallGhostButtonText}>{expandedOverview ? 'Collapse preview' : 'Expand preview'}</Text>
              </TouchableOpacity>
              <View style={styles.codePreviewBox}>
                <Text style={styles.codePreviewText} selectable numberOfLines={expandedOverview ? undefined : 8}>
                  {overviewStatus.bodyPreview}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.summaryNote} selectable>
              Checks live backend availability for the overview analytics endpoint.
            </Text>
          )}
        </View>
        <View style={styles.summaryCard}>
          <View style={styles.endpointHeaderRow}>
            <Text style={styles.summaryLabel}>GET /admin/analytics/detailed-reports</Text>
            <View style={[styles.statusChip, { backgroundColor: detailedTone.bg, borderColor: detailedTone.border }]}>
              <Text style={[styles.statusChipText, { color: detailedTone.text }]}>{detailedTone.label}</Text>
            </View>
          </View>
          <Text style={styles.summaryValue} selectable>{formatProbeStatus(detailedStatus)}</Text>
          <View style={styles.formActionsRow}>
            <TouchableOpacity style={styles.smallGhostButton} onPress={onRefreshDetailed ?? onRefresh} disabled={loading}>
              <Text style={styles.smallGhostButtonText}>Recheck</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallGhostButton}
              onPress={() => {
                void copyProbeDetails('GET /admin/analytics/detailed-reports', detailedStatus);
              }}
            >
              <Text style={styles.smallGhostButtonText}>Copy Details</Text>
            </TouchableOpacity>
          </View>
          {hasDetailedPreview ? (
            <>
              <TouchableOpacity
                style={styles.smallGhostButton}
                onPress={() => setExpandedDetailed((prev) => !prev)}
              >
                <Text style={styles.smallGhostButtonText}>{expandedDetailed ? 'Collapse preview' : 'Expand preview'}</Text>
              </TouchableOpacity>
              <View style={styles.codePreviewBox}>
                <Text style={styles.codePreviewText} selectable numberOfLines={expandedDetailed ? undefined : 8}>
                  {detailedStatus.bodyPreview}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.summaryNote} selectable>
              Checks live backend availability for the detailed reports endpoint. Endpoint not available yet (404) is shown as an explicit unavailable state.
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
  const [templateDraft, setTemplateDraft] = useState<TemplateFormDraft>(emptyTemplateDraft);
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
  const visibleRoutes = showCoachPortalExperience ? coachingTransitionRoutes : ADMIN_ROUTES;

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
    if (activeRouteKey !== 'kpis') return;
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
      setTemplateSaveError(error instanceof Error ? error.message : 'Failed to create template');
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

  return (
    <SafeAreaView style={styles.screen}>
      <View style={[styles.backgroundOrbOne, showCoachPortalExperience && styles.backgroundOrbOneCoach]} />
      <View style={[styles.backgroundOrbTwo, showCoachPortalExperience && styles.backgroundOrbTwoCoach]} />
      <View style={[styles.shell, isCompact && styles.shellCompact]}>
        <View style={[styles.sidebar, isCompact && styles.sidebarCompact, showCoachPortalExperience && styles.sidebarCoach]}>
          <View style={[styles.brandCard, showCoachPortalExperience && styles.brandCardCoach]}>
            <View style={styles.brandRow}>
              <View style={[styles.brandLogoWrap, showCoachPortalExperience && styles.brandLogoWrapCoach]}>
                <CompassMark width={42} height={42} />
              </View>
              <View style={styles.brandCopy}>
                <Text style={[styles.brandTag, showCoachPortalExperience && styles.brandTagCoach]}>
                  {showCoachPortalExperience ? 'COACH' : 'A1'}
                </Text>
                <Text style={[styles.brandTitle, showCoachPortalExperience && styles.brandTitleCoach]}>
                  {showCoachPortalExperience ? 'Compass Coach Portal' : 'Admin Shell'}
                </Text>
                <Text style={[styles.brandSubtitle, showCoachPortalExperience && styles.brandSubtitleCoach]}>
                  {showCoachPortalExperience
                    ? 'Coach product workspace for publishing content, managing journeys, running cohorts, and channel communication.'
                    : 'User Ops, Catalog, and Reporting tools'}
                </Text>
              </View>
            </View>
            <View style={styles.brandMetricsRow}>
              <View style={[styles.brandMetricCard, showCoachPortalExperience && styles.brandMetricCardCoach]}>
                <Text style={[styles.brandMetricLabel, showCoachPortalExperience && styles.brandMetricLabelCoach]}>
                  {showCoachPortalExperience ? 'Sections' : 'A1 routes'}
                </Text>
                <Text style={styles.brandMetricValue}>{showCoachPortalExperience ? coachingTransitionRoutes.length : a1Routes}</Text>
              </View>
              <View style={[styles.brandMetricCard, showCoachPortalExperience && styles.brandMetricCardCoach]}>
                <Text style={[styles.brandMetricLabel, showCoachPortalExperience && styles.brandMetricLabelCoach]}>
                  {showCoachPortalExperience ? 'Current scope' : 'Blocked now'}
                </Text>
                <Text style={styles.brandMetricValue}>
                  {showCoachPortalExperience
                    ? hasCoachRole
                      ? 'Coach'
                      : hasTeamLeaderRole
                        ? 'Team'
                        : hasSponsorRole
                          ? 'Sponsor'
                          : 'N/A'
                    : blockedRoutes}
                </Text>
              </View>
            </View>
            <Text style={[styles.brandFootnote, showCoachPortalExperience && styles.brandFootnoteCoach]}>
              {showCoachPortalExperience
                ? 'Admin compatibility routes remain active, while coach views keep workflow language and actions customer-facing.'
                : 'Styled from Compass export palette (navy + blue gradient) while keeping A1 scope to shell/authz only.'}
            </Text>
          </View>

          <ScrollView
            horizontal={isCompact}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.navList, isCompact && styles.navListCompact]}
            style={styles.navScroll}
          >
            {visibleRoutes.map((route) => {
              const selected = route.key === activeRouteKey;
              const allowed = canAccessAdminRoute(effectiveRoles, route);
              const stage = getAdminRouteStage(route.key);
              const tone = getAdminRouteStageTone(stage);
              return (
                <Pressable
                  key={route.key}
                  style={[
                    styles.navItem,
                    selected && styles.navItemSelected,
                    !allowed && styles.navItemDisabled,
                    isCompact && styles.navItemCompact,
                    showCoachPortalExperience && styles.navItemCoach,
                    showCoachPortalExperience && selected && styles.navItemCoachSelected,
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
                  <View style={styles.navTopRow}>
                    <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{route.label}</Text>
                    {!showCoachPortalExperience ? (
                      <View style={[styles.navStagePill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                        <Text style={[styles.navStageText, { color: tone.text }]}>{stage.replace(' later', '')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.navPath}>
                    {showCoachPortalExperience
                      ? COACH_PORTAL_ROUTE_BLURBS[route.key as CoachingPortalSurfaceKey] ?? route.path
                      : route.path}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={[styles.navFooterCard, showCoachPortalExperience && styles.navFooterCardCoach]}>
            <View style={styles.navFooterRow}>
              <View style={styles.navFooterCopy}>
                <Text style={styles.navFooterTitle}>{showCoachPortalExperience ? 'Coach workspace routing' : 'Admin workspace routes'}</Text>
                <Text style={[styles.navFooterText, showCoachPortalExperience && styles.navFooterTextCoach]}>
                  {showCoachPortalExperience
                    ? 'Only role-allowed coach routes are visible here. Legacy /admin/coaching/* URLs stay live as compatibility redirects to /coach/*.'
                    : 'Use the left navigation to move between available admin tools. Routes that are not available yet are labeled in the list.'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.contentColumn}>
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentScrollInner}
            showsVerticalScrollIndicator
          >
            <View style={[styles.header, showCoachPortalExperience && styles.headerCoach]}>
              <View>
                <Text style={styles.headerTitle}>{showCoachPortalExperience ? 'Compass KPI Coach Portal' : 'Compass KPI Admin'}</Text>
                <Text style={styles.headerSubtitle}>
                  {showCoachPortalExperience
                    ? 'Plan content, launch learning journeys, organize cohorts, and guide channel conversations from one coach product surface.'
                    : 'Operator tools for user access, KPI catalog, templates, and reporting checks'}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <View style={[styles.roleBadge, showCoachPortalExperience && styles.roleBadgeCoach]}>
                  {backendRoleLoading ? <ActivityIndicator size="small" color="#1F4EBF" /> : null}
                  <Text style={styles.roleBadgeText}>
                    {backendRole ? `Backend role: ${backendRole}` : 'Role source: session metadata'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.signOutButton, showCoachPortalExperience && styles.signOutButtonCoach]}
                  onPress={() => {
                    void signOut();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                >
                  <Text style={styles.signOutButtonText}>Sign out</Text>
                </TouchableOpacity>
              </View>
            </View>
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
              </View>
            ) : null}

            {!showCoachPortalExperience ? (
              <>
                <View style={[styles.summaryRow, isCompact && styles.summaryRowCompact]}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>AuthZ Source</Text>
                    <Text style={styles.summaryValue}>
                      {backendRole ? 'Supabase session + backend /me fallback' : 'Supabase session metadata first'}
                    </Text>
                    <Text style={styles.summaryNote}>
                      {__DEV__ && devRolePreview !== 'live'
                        ? `Dev preview override active: ${devRolePreview}`
                        : 'No new endpoint family introduced'}
                    </Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Admin Workspace</Text>
                    <Text style={styles.summaryValue}>User ops, KPI catalog, templates, and reporting checks in one admin surface</Text>
                    <Text style={styles.summaryNote}>Use the left navigation to move between admin workflows</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Navigation</Text>
                    <Text style={styles.summaryValue}>
                      {Platform.OS === 'web'
                        ? `Path sync enabled (${
                            !canOpenActiveRoute ? ADMIN_UNAUTHORIZED_PATH : unknownAdminPath ? ADMIN_NOT_FOUND_PATH : activeRoute.path
                          })`
                        : 'Path sync inactive outside web runtime'}
                    </Text>
                    <Text style={styles.summaryNote}>Browser back/forward tracks admin route changes, unauthorized, and not-found states</Text>
                  </View>
                </View>

                <View style={styles.checklistCard}>
                  <Pressable style={styles.formHeaderRow} onPress={() => setShowImplementationNotes((prev) => !prev)}>
                    <View style={styles.checklistHeader}>
                      <Text style={styles.checklistTitle}>Implementation Status</Text>
                      <Text style={styles.checklistSubtitle}>Internal readiness notes and debug context for admin maintenance</Text>
                    </View>
                    <Text style={styles.smallGhostButtonText}>{showImplementationNotes ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                  {showImplementationNotes ? (
                    <View style={styles.checklistList}>
                      <Text style={styles.metaRow}>Historic A1 shell/authz baseline checklist (completed; kept for traceability)</Text>
                      {checklistItems.map((item) => {
                        const done = item.status === 'done';
                        return (
                          <View key={item.label} style={styles.checklistRow}>
                            <View style={[styles.checklistDot, done ? styles.checklistDotDone : styles.checklistDotPending]} />
                            <Text style={[styles.checklistText, done ? styles.checklistTextDone : styles.checklistTextPending]}>
                              {done ? '[done]' : '[next]'} {item.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </>
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

            <View style={styles.content}>
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
                  <AdminCoachingAuditPanel />
                ) : activeRoute.key === 'coachingUploads' ||
                  activeRoute.key === 'coachingLibrary' ||
                  activeRoute.key === 'coachingJourneys' ||
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
    backgroundColor: '#EDF2FA',
  },
  backgroundOrbOne: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#CFE0FF',
    top: -60,
    right: -40,
    opacity: 0.7,
  },
  backgroundOrbOneCoach: {
    backgroundColor: '#CFEBDD',
  },
  backgroundOrbTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#DCEBFF',
    bottom: 40,
    left: -60,
    opacity: 0.75,
  },
  backgroundOrbTwoCoach: {
    backgroundColor: '#E4F4D8',
  },
  shell: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  shellCompact: {
    flexDirection: 'column',
    gap: 12,
  },
  sidebar: {
    width: 320,
    gap: 12,
  },
  sidebarCoach: {
    width: 300,
  },
  sidebarCompact: {
    width: '100%',
  },
  brandCard: {
    backgroundColor: '#12203A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#20365F',
  },
  brandCardCoach: {
    backgroundColor: '#163328',
    borderColor: '#2B5A48',
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
    backgroundColor: '#0E1830',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2D4478',
  },
  brandLogoWrapCoach: {
    backgroundColor: '#10251D',
    borderColor: '#3B705D',
  },
  brandCopy: {
    flex: 1,
  },
  brandTag: {
    color: '#9eb6ff',
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
    color: '#c5d0e6',
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
    backgroundColor: '#172A4E',
    borderWidth: 1,
    borderColor: '#294171',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brandMetricCardCoach: {
    backgroundColor: '#214337',
    borderColor: '#406E5B',
  },
  brandMetricLabel: {
    color: '#B9C7E4',
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
    color: '#B6C2DB',
    fontSize: 12,
    lineHeight: 17,
  },
  brandFootnoteCoach: {
    color: '#CAE6D7',
  },
  navScroll: {
    flexGrow: 0,
    maxHeight: 340,
  },
  navList: {
    gap: 10,
  },
  navListCompact: {
    gap: 10,
    paddingRight: 8,
  },
  navItem: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dee6f2',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  navItemCoach: {
    backgroundColor: '#F6FCF8',
    borderColor: '#D3E9DB',
  },
  navItemCompact: {
    width: 220,
  },
  navItemSelected: {
    borderColor: '#2f67e8',
    backgroundColor: '#edf3ff',
  },
  navItemCoachSelected: {
    borderColor: '#2D8A62',
    backgroundColor: '#EAF8F0',
  },
  navItemDisabled: {
    opacity: 0.65,
  },
  navLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  navLabelSelected: {
    color: '#1f4ebf',
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
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  navFooterCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDE6F5',
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
    color: '#23314A',
    fontSize: 13,
    fontWeight: '700',
  },
  navFooterText: {
    color: '#70809D',
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
  contentScroll: {
    flex: 1,
  },
  contentScrollInner: {
    gap: 12,
    paddingBottom: 24,
  },
  header: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dee6f2',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  headerCoach: {
    backgroundColor: 'rgba(245,252,247,0.96)',
    borderColor: '#D4EBDD',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#202838',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#697488',
    marginTop: 4,
  },
  signOutButton: {
    backgroundColor: '#F4F7FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9e1ef',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  signOutButtonCoach: {
    backgroundColor: '#F5FAF7',
    borderColor: '#D4E7DA',
  },
  signOutButtonText: {
    color: '#293548',
    fontWeight: '600',
    fontSize: 14,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D6E2FF',
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
    color: '#2B4C9A',
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
    borderColor: '#DCE6F8',
    borderRadius: 12,
    backgroundColor: '#F6FAFF',
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
    color: '#20304A',
    fontSize: 13,
    fontWeight: '700',
  },
  usersWorkflowBannerText: {
    color: '#5B6A84',
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
    borderColor: '#DFE7F3',
    borderRadius: 12,
    backgroundColor: '#FAFCFF',
    padding: 12,
    gap: 8,
  },
  usersNoResultsTitle: {
    color: '#20314a',
    fontSize: 13,
    fontWeight: '700',
  },
  usersNoResultsText: {
    color: '#667792',
    fontSize: 12,
    lineHeight: 17,
  },
  activityFeedCard: {
    borderWidth: 1,
    borderColor: '#E3EBF8',
    borderRadius: 12,
    backgroundColor: '#FAFCFF',
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
    color: '#2A3953',
    fontSize: 12,
    lineHeight: 17,
  },
  activityFeedMeta: {
    color: '#7A869B',
    fontSize: 11,
  },
  selectedUserSummaryCard: {
    borderWidth: 1,
    borderColor: '#DCE7FA',
    borderRadius: 12,
    backgroundColor: '#F7FAFF',
    padding: 10,
    gap: 6,
  },
  userOpsSection: {
    borderWidth: 1,
    borderColor: '#E5ECF8',
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
  summaryCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFE7F3',
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
    color: '#6A768D',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  summaryValue: {
    color: '#202B3E',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 6,
  },
  summaryNote: {
    color: '#748198',
    fontSize: 12,
    marginTop: 6,
  },
  endpointStatusBanner: {
    borderWidth: 1,
    borderColor: '#E1E9F7',
    borderRadius: 12,
    backgroundColor: '#F8FBFF',
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
    color: '#6A768D',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  endpointStatusBannerValue: {
    color: '#243248',
    fontSize: 16,
    fontWeight: '700',
  },
  endpointStatusBannerNote: {
    color: '#5E6D86',
    fontSize: 12,
  },
  reportsOpsSummaryCard: {
    borderWidth: 1,
    borderColor: '#E1E9F7',
    borderRadius: 12,
    backgroundColor: '#F8FBFF',
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
    color: '#23314A',
    fontSize: 12,
    fontWeight: '700',
  },
  reportsOpsSummaryPath: {
    color: '#6E7B92',
    fontSize: 11,
    marginTop: 2,
  },
  codePreviewBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E1E9F7',
    borderRadius: 10,
    backgroundColor: '#F7FAFF',
    padding: 10,
  },
  codePreviewText: {
    color: '#2A3953',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
  },
  checklistCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFE7F3',
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFE7F3',
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
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dee6f2',
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
    color: '#1e2738',
    fontSize: 22,
    fontWeight: '700',
  },
  panelBody: {
    color: '#52607a',
    fontSize: 15,
    lineHeight: 22,
  },
  metaList: {
    marginTop: space.sm,
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e8edf5',
  },
  metaRow: {
    color: '#4a556c',
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
    backgroundColor: '#F6F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1EAF8',
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
    color: '#243248',
    fontWeight: '600',
  },
  formCard: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#E3EBF8',
    borderRadius: 12,
    backgroundColor: '#FAFCFF',
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
    color: '#20304A',
    fontSize: 14,
    fontWeight: '700',
  },
  smallGhostButton: {
    borderWidth: 1,
    borderColor: '#D8E4FA',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
  },
  smallGhostButtonText: {
    color: '#345892',
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
    color: '#66758F',
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDE7F7',
    borderRadius: 10,
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#243248',
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
    borderColor: '#D7E3FA',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFF',
  },
  sectionNavPillSelected: {
    borderColor: '#8EB4FF',
    backgroundColor: '#EAF1FF',
  },
  sectionNavPillText: {
    color: '#3F5884',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionNavPillTextSelected: {
    color: '#1E4FBE',
  },
  formChip: {
    borderWidth: 1,
    borderColor: '#D7E3FA',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
  },
  formChipSelected: {
    borderColor: '#7EA7FF',
    backgroundColor: '#EAF1FF',
  },
  formChipText: {
    color: '#38517E',
    fontSize: 12,
    fontWeight: '600',
  },
  formChipTextSelected: {
    color: '#1E4FBE',
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
  filterBar: {
    borderWidth: 1,
    borderColor: '#E3EBF8',
    borderRadius: 12,
    backgroundColor: '#FAFCFF',
    padding: 12,
    gap: 10,
  },
  toggleChip: {
    borderWidth: 1,
    borderColor: '#D9E4F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF',
  },
  toggleChipOn: {
    borderColor: '#9FD4B8',
    backgroundColor: '#EFFCF4',
  },
  toggleChipText: {
    color: '#4C607F',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleChipTextOn: {
    color: '#1D7A4D',
  },
  formActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    backgroundColor: '#2158D5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  warnButton: {
    backgroundColor: '#FFF4F2',
    borderWidth: 1,
    borderColor: '#F2C0B9',
    borderRadius: 10,
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
    borderColor: '#E1E9F7',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F8FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E9F7',
  },
  tableHeaderCell: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#60718F',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableHeaderCellActive: {
    color: '#204ECF',
  },
  tableDataRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F9',
  },
  tableDataRowSelectedStrong: {
    backgroundColor: '#EAF1FF',
    borderLeftWidth: 3,
    borderLeftColor: '#2F67E8',
  },
  tableCell: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  tableCellText: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#314055',
    fontSize: 12,
  },
  tablePrimary: {
    color: '#223149',
    fontSize: 13,
    fontWeight: '600',
  },
  tableSecondary: {
    color: '#76849D',
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
    color: '#73819A',
    fontSize: 11,
    backgroundColor: '#FBFCFF',
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

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
  ADMIN_ROUTES,
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
        <Text style={styles.metaRow}>Status: placeholder (A1 shell scaffold)</Text>
        <Text style={styles.metaRow}>Required roles: {route.requiredRoles.join(', ')}</Text>
        <Text style={styles.metaRow}>Detected session roles: {rolesLabel}</Text>
      </View>
      <View style={styles.placeholderGrid}>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderCardLabel}>Next implementation</Text>
          <Text style={styles.placeholderCardValue}>
            {stage === 'A1 now' ? 'Guard + nav behavior' : stage === 'A2 later' ? 'CRUD screens + API wiring' : 'Ops views + reports'}
          </Text>
        </View>
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderCardLabel}>Contract policy</Text>
          <Text style={styles.placeholderCardValue}>Reuse documented `/admin/*` endpoints only</Text>
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
        This admin path is not part of the current A1 shell scaffold. Use the left navigation to continue.
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

function sortRowsByUpdatedDesc<T extends { updated_at?: string | null; created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
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
  const editing = Boolean(draft.id);
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
  return (
    <View style={styles.panel}>
      <View style={styles.panelTopRow}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.eyebrow}>/admin/kpis</Text>
          <Text style={styles.panelTitle}>KPI Catalog</Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: '#EEF3FF', borderColor: '#CEDBFF' }]}>
          <Text style={[styles.stagePillText, { color: '#204ECF' }]}>A2 Later</Text>
        </View>
      </View>
      <Text style={styles.panelBody}>
        A2 KPI catalog baseline wired to existing admin endpoints with create/edit/deactivate controls.
      </Text>
      <View style={styles.filterBar}>
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
          <Text style={styles.metaRow}>Rows shown: {filteredRows.length} of {rows.length}</Text>
          <View style={styles.tableWrap}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.colWide]}>KPI</Text>
              <Text style={[styles.tableHeaderCell, styles.colMd]}>Type</Text>
              <Text style={[styles.tableHeaderCell, styles.colSm]}>PC Wt</Text>
              <Text style={[styles.tableHeaderCell, styles.colMd]}>Range</Text>
              <Text style={[styles.tableHeaderCell, styles.colSm]}>TTC</Text>
              <Text style={[styles.tableHeaderCell, styles.colSm]}>Decay</Text>
              <Text style={[styles.tableHeaderCell, styles.colSm]}>Status</Text>
              <Text style={[styles.tableHeaderCell, styles.colSm]}>Updated</Text>
            </View>
            {filteredRows.slice(0, 12).map((row) => (
              <Pressable key={row.id} style={styles.tableDataRow} onPress={() => onSelectRow(row)}>
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
            {filteredRows.length > 12 ? <Text style={styles.tableFootnote}>Showing first 12 filtered rows for A2 baseline UI (pagination later).</Text> : null}
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
  const editing = Boolean(draft.id);
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
  return (
    <View style={styles.panel}>
      <View style={styles.panelTopRow}>
        <View style={styles.panelTitleBlock}>
          <Text style={styles.eyebrow}>/admin/challenge-templates</Text>
          <Text style={styles.panelTitle}>Challenge Templates</Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: '#EEF3FF', borderColor: '#CEDBFF' }]}>
          <Text style={[styles.stagePillText, { color: '#204ECF' }]}>A2 Later</Text>
        </View>
      </View>
      <Text style={styles.panelBody}>
        A2 challenge template baseline wired to existing admin endpoints with create/edit/deactivate controls.
      </Text>
      <View style={styles.filterBar}>
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
          <Text style={styles.metaRow}>Rows shown: {filteredRows.length} of {rows.length}</Text>
          <View style={styles.tableWrap}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, styles.colWide]}>Template</Text>
              <Text style={[styles.tableHeaderCell, styles.colSm]}>Status</Text>
              <Text style={[styles.tableHeaderCell, styles.colSm]}>Updated</Text>
            </View>
            {filteredRows.slice(0, 12).map((row) => (
              <Pressable key={row.id} style={styles.tableDataRow} onPress={() => onSelectRow(row)}>
                <View style={[styles.tableCell, styles.colWide]}>
                  <Text style={styles.tablePrimary}>{row.name}</Text>
                  <Text numberOfLines={1} style={styles.tableSecondary}>
                    {row.description?.trim() || '(no description)'}
                  </Text>
                </View>
                <Text style={[styles.tableCellText, styles.colSm]}>{row.is_active ? 'active' : 'inactive'}</Text>
                <Text style={[styles.tableCellText, styles.colSm]}>{formatDateShort(row.updated_at)}</Text>
              </Pressable>
            ))}
            {filteredRows.length > 12 ? <Text style={styles.tableFootnote}>Showing first 12 filtered rows for A2 baseline UI (pagination later).</Text> : null}
          </View>
        </>
      ) : null}
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
  const [showUpcomingRoutes, setShowUpcomingRoutes] = useState(false);
  const [devRolePreview, setDevRolePreview] = useState<'live' | 'super_admin' | 'admin' | 'agent'>('live');
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

  const effectiveRoles = useMemo(() => {
    if (!__DEV__ || devRolePreview === 'live') return resolvedRoles;
    const normalized = normalizeAdminRole(devRolePreview);
    return normalized ? [normalized] : resolvedRoles;
  }, [devRolePreview, resolvedRoles]);
  const rolesLabel = formatRoles(effectiveRoles);
  const devOverrideActive = __DEV__ && devRolePreview !== 'live';
  const effectiveHasAdminAccess = effectiveRoles.includes('platform_admin') || effectiveRoles.includes('super_admin');
  const activeRoute = getAdminRouteByKey(activeRouteKey);
  const canOpenActiveRoute = canAccessAdminRoute(effectiveRoles, activeRoute);
  const a1Routes = ADMIN_ROUTES.filter((route) => getAdminRouteStage(route.key) === 'A1 now').length;
  const blockedRoutes = ADMIN_ROUTES.filter((route) => !canAccessRoute(route)).length;
  const visibleRoutes = ADMIN_ROUTES.filter(
    (route) => {
      const stage = getAdminRouteStage(route.key);
      if (stage === 'A1 now' || stage === 'A2 later') return true;
      return showUpcomingRoutes;
    }
  );

  useEffect(() => {
    if (showUpcomingRoutes) return;
    const stage = getAdminRouteStage(activeRouteKey);
    if (stage === 'A1 now' || stage === 'A2 later') return;
    setActiveRouteKey('overview');
  }, [activeRouteKey, showUpcomingRoutes]);

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
  }, [activeRouteKey, canOpenActiveRoute, effectiveHasAdminAccess]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    const route = getAdminRouteByKey(activeRouteKey);
    const shouldShowUnauthorized = !effectiveHasAdminAccess || !canOpenActiveRoute;
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
  }, [activeRouteKey, canOpenActiveRoute, effectiveHasAdminAccess, lastNavPushPath, unknownAdminPath]);

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

  const checklistItems = [
    { label: 'Admin shell layout + navigation scaffold', status: 'done' },
    { label: 'Auth/session wiring (reuse Supabase session)', status: 'done' },
    { label: 'AuthZ role checks + route guards', status: 'done' },
    { label: 'Unauthorized state + /admin/unauthorized path flow', status: 'done' },
    { label: 'Unknown /admin/* path handling + not-found state', status: 'done' },
    { label: 'A1 placeholder screens for admin routes', status: 'done' },
    { label: 'A2/A3 route placeholders clearly marked as upcoming', status: 'done' },
    { label: 'Manual authz acceptance pass (admin vs non-admin)', status: 'pending' },
  ] as const;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.backgroundOrbOne} />
      <View style={styles.backgroundOrbTwo} />
      <View style={[styles.shell, isCompact && styles.shellCompact]}>
        <View style={[styles.sidebar, isCompact && styles.sidebarCompact]}>
          <View style={styles.brandCard}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogoWrap}>
                <CompassMark width={42} height={42} />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandTag}>A1</Text>
                <Text style={styles.brandTitle}>Admin Shell</Text>
                <Text style={styles.brandSubtitle}>AuthZ scaffold + route placeholders</Text>
              </View>
            </View>
            <View style={styles.brandMetricsRow}>
              <View style={styles.brandMetricCard}>
                <Text style={styles.brandMetricLabel}>A1 routes</Text>
                <Text style={styles.brandMetricValue}>{a1Routes}</Text>
              </View>
              <View style={styles.brandMetricCard}>
                <Text style={styles.brandMetricLabel}>Blocked now</Text>
                <Text style={styles.brandMetricValue}>{blockedRoutes}</Text>
              </View>
            </View>
            <Text style={styles.brandFootnote}>
              Styled from Compass export palette (navy + blue gradient) while keeping A1 scope to shell/authz only.
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
                    <View style={[styles.navStagePill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                      <Text style={[styles.navStageText, { color: tone.text }]}>{stage.replace(' later', '')}</Text>
                    </View>
                  </View>
                  <Text style={styles.navPath}>{route.path}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.navFooterCard}>
            <View style={styles.navFooterRow}>
              <View style={styles.navFooterCopy}>
                <Text style={styles.navFooterTitle}>Show A3 routes</Text>
                <Text style={styles.navFooterText}>A1/A2 stay visible. Toggle reveals A3 placeholders only.</Text>
              </View>
              <Switch
                value={showUpcomingRoutes}
                onValueChange={setShowUpcomingRoutes}
                trackColor={{ false: '#CFDAEF', true: '#94B5FF' }}
                thumbColor={showUpcomingRoutes ? '#1F56DA' : '#F8FBFF'}
              />
            </View>
          </View>
        </View>

        <View style={styles.contentColumn}>
          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentScrollInner}
            showsVerticalScrollIndicator
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>Compass KPI Admin</Text>
                <Text style={styles.headerSubtitle}>Session-bound admin surface (A1 foundation)</Text>
              </View>
              <View style={styles.headerActions}>
                <View style={styles.roleBadge}>
                  {backendRoleLoading ? <ActivityIndicator size="small" color="#1F4EBF" /> : null}
                  <Text style={styles.roleBadgeText}>
                    {backendRole ? `Backend role: ${backendRole}` : 'Role source: session metadata'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.signOutButton}
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
                <Text style={styles.summaryLabel}>A1 Coverage</Text>
                <Text style={styles.summaryValue}>Shell layout, route guards, 403 state, placeholders</Text>
                <Text style={styles.summaryNote}>A2/A3 routes intentionally scaffold-only</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Web Routing</Text>
                <Text style={styles.summaryValue}>
                  {Platform.OS === 'web'
                    ? `Path sync enabled (${
                        !effectiveHasAdminAccess || !canOpenActiveRoute
                          ? ADMIN_UNAUTHORIZED_PATH
                          : unknownAdminPath
                            ? ADMIN_NOT_FOUND_PATH
                            : activeRoute.path
                      })`
                    : 'Path sync inactive outside web runtime'}
                </Text>
                <Text style={styles.summaryNote}>
                  Browser history/back button now tracks active admin, unauthorized, and not-found states
                </Text>
              </View>
            </View>

            <View style={styles.checklistCard}>
              <View style={styles.checklistHeader}>
                <Text style={styles.checklistTitle}>A1 Checklist</Text>
                <Text style={styles.checklistSubtitle}>Progress snapshot for this thread (kept in scope)</Text>
              </View>
              <View style={styles.checklistList}>
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
            </View>

            {__DEV__ ? (
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
  brandTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  brandSubtitle: {
    color: '#c5d0e6',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
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
  brandMetricLabel: {
    color: '#B9C7E4',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontWeight: '700',
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
  navItemCompact: {
    width: 220,
  },
  navItemSelected: {
    borderColor: '#2f67e8',
    backgroundColor: '#edf3ff',
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
  summaryCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFE7F3',
    padding: 14,
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
  tableDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F9',
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

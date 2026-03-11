/**
 * BroadcastTargetHeader — Audience selector for broadcast campaigns.
 *
 * Renders above the standard ThreadComposer so the broadcast tab
 * looks identical to a normal chat thread, with a target selector
 * at the top (scope buttons, entity chips, recipient count).
 *
 * The parent (CommsHub) composes this header with the existing
 * ThreadComposer at the bottom — same UX as normal messaging.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  commsColors as C,
  commsRadii as R,
  commsType as T,
} from './commsTokens';
import type {
  BroadcastScopeType,
  BroadcastTarget,
} from '../../lib/broadcastCampaignApi';

/* ================================================================
   TYPES
   ================================================================ */

export interface TargetOption {
  scope_type: BroadcastScopeType;
  scope_id: string;
  label: string;
}

export interface BroadcastTargetHeaderProps {
  /** Available target entities (channels, teams, cohorts) */
  availableTargets: TargetOption[];
  /** Currently selected targets */
  selectedTargets: BroadcastTarget[];
  onChangeTargets: (targets: BroadcastTarget[]) => void;
  /** Deduped audience count */
  audienceCount: number | null;
  audienceLoading: boolean;
  /** Error / success banners */
  error: string | null;
  successNote: string | null;
  /** Submission state (disables interaction) */
  submitting: boolean;
}

const SCOPE_LABELS: Record<BroadcastScopeType, string> = {
  channel: 'Channels',
  team: 'Teams',
  cohort: 'Cohorts',
};

const SCOPE_ORDER: BroadcastScopeType[] = ['channel', 'team', 'cohort'];

/* ================================================================
   COMPONENT
   ================================================================ */

export default function BroadcastTargetHeader(props: BroadcastTargetHeaderProps) {
  const {
    availableTargets,
    selectedTargets,
    onChangeTargets,
    audienceCount,
    audienceLoading,
    error,
    successNote,
    submitting,
  } = props;

  const [expandedScope, setExpandedScope] = useState<BroadcastScopeType | null>(null);

  // ── Helpers ──
  const isTargetSelected = (t: TargetOption) =>
    selectedTargets.some((s) => s.scope_type === t.scope_type && s.scope_id === t.scope_id);

  const toggleTarget = (t: TargetOption) => {
    if (submitting) return;
    if (isTargetSelected(t)) {
      onChangeTargets(selectedTargets.filter((s) => !(s.scope_type === t.scope_type && s.scope_id === t.scope_id)));
    } else {
      onChangeTargets([...selectedTargets, { scope_type: t.scope_type, scope_id: t.scope_id, label: t.label }]);
    }
  };

  const removeTarget = (t: BroadcastTarget) => {
    if (submitting) return;
    onChangeTargets(selectedTargets.filter((s) => !(s.scope_type === t.scope_type && s.scope_id === t.scope_id)));
  };

  const targetsForScope = (scope: BroadcastScopeType) =>
    availableTargets.filter((t) => t.scope_type === scope);

  const recipientLabel = audienceLoading
    ? '...'
    : audienceCount !== null
      ? String(audienceCount)
      : '--';

  return (
    <View style={st.root}>
      {/* Header row */}
      <View style={st.headerRow}>
        <Text style={st.headerTitle}>Broadcast</Text>
        {selectedTargets.length > 0 && (
          <View style={st.recipientBadge}>
            {audienceLoading ? (
              <ActivityIndicator size="small" color={C.brand} />
            ) : null}
            <Text style={st.recipientBadgeText}>
              {recipientLabel} recipient{audienceCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Scope category buttons */}
      <View style={st.scopeRow}>
        {SCOPE_ORDER.map((scope) => {
          const items = targetsForScope(scope);
          if (items.length === 0) return null;
          const isExpanded = expandedScope === scope;
          const selectedCount = selectedTargets.filter((s) => s.scope_type === scope).length;
          return (
            <Pressable
              key={scope}
              style={[st.scopeBtn, isExpanded && st.scopeBtnActive]}
              onPress={() => setExpandedScope(isExpanded ? null : scope)}
            >
              <Text style={[st.scopeBtnText, isExpanded && st.scopeBtnTextActive]}>
                {SCOPE_LABELS[scope]}
                {selectedCount > 0 ? ` (${selectedCount})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Expanded scope list */}
      {expandedScope && targetsForScope(expandedScope).length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.targetList}>
          {targetsForScope(expandedScope).map((t) => {
            const selected = isTargetSelected(t);
            return (
              <Pressable
                key={`${t.scope_type}-${t.scope_id}`}
                style={[st.targetItem, selected && st.targetItemSelected]}
                onPress={() => toggleTarget(t)}
              >
                <Text style={[st.targetItemText, selected && st.targetItemTextSelected]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Selected targets chips */}
      {selectedTargets.length > 0 && (
        <View style={st.chipRow}>
          {selectedTargets.map((t) => (
            <View key={`${t.scope_type}-${t.scope_id}`} style={st.chip}>
              <Text style={st.chipText}>{t.label ?? t.scope_id}</Text>
              <Pressable onPress={() => removeTarget(t)} hitSlop={8}>
                <Text style={st.chipDismiss}>x</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Error / success banners */}
      {error ? (
        <View style={st.alert}>
          <Text style={st.alertTextError}>{error}</Text>
        </View>
      ) : null}
      {successNote ? (
        <View style={[st.alert, st.alertSuccess]}>
          <Text style={st.alertTextSuccess}>{successNote}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ================================================================
   STYLES
   ================================================================ */

const st = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.divider,
    backgroundColor: C.cardBg,
  },

  /* ─── header row ─── */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPrimary,
    letterSpacing: -0.3,
  },

  /* ─── recipient badge ─── */
  recipientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  recipientBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
  },

  /* ─── scope category buttons ─── */
  scopeRow: { flexDirection: 'row', gap: 6 },
  scopeBtn: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.divider,
    backgroundColor: C.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scopeBtnActive: {
    borderColor: C.brand,
    backgroundColor: C.brandLight,
  },
  scopeBtnText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  scopeBtnTextActive: { color: C.brand, fontWeight: '700' },

  /* ─── target list ─── */
  targetList: { maxHeight: 40 },
  targetItem: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.divider,
    backgroundColor: C.cardBg,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginRight: 6,
  },
  targetItemSelected: {
    borderColor: C.brand,
    backgroundColor: C.brandMuted,
  },
  targetItemText: { fontSize: 13, color: C.textSecondary },
  targetItemTextSelected: { color: C.brand, fontWeight: '600' },

  /* ─── selected chips ─── */
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 14,
    backgroundColor: C.brandMuted,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: C.brand },
  chipDismiss: { fontSize: 11, fontWeight: '700', color: C.brand, opacity: 0.6 },

  /* ─── alerts ─── */
  alert: { borderRadius: 8, padding: 10, backgroundColor: C.errorBg },
  alertSuccess: { backgroundColor: C.successBg },
  alertTextError: { fontSize: 13, fontWeight: '500', color: C.error },
  alertTextSuccess: { fontSize: 13, fontWeight: '500', color: C.success },
});

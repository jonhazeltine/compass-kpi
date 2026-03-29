/**
 * WizardKpiSelection — Step 2: Pick KPIs grouped by type with scope + target.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { kpiTypeColor, wiz } from './wizardTheme';
import type { ChallengeWizardGoalDraft } from '../../../screens/kpi-dashboard/types';
import type { DashboardPayload } from '../../../screens/kpi-dashboard/types';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface Props {
  goals: ChallengeWizardGoalDraft[];
  setGoals: (v: ChallengeWizardGoalDraft[]) => void;
  allSelectableKpis: DashboardPayload['loggable_kpis'];
  onNext: () => void;
}

type KpiGroup = { type: string; label: string; kpis: DashboardPayload['loggable_kpis'] };

const TYPE_META: Record<string, { label: string; order: number }> = {
  PC: { label: 'Projection KPIs', order: 0 },
  GP: { label: 'Growth Plan KPIs', order: 1 },
  VP: { label: 'Vitality KPIs', order: 2 },
};

export default function WizardKpiSelection({ goals, setGoals, allSelectableKpis, onNext }: Props) {
  const [showMore, setShowMore] = useState(false);

  const selectedIds = useMemo(() => new Set(goals.map((g) => g.kpi_id)), [goals]);

  const availableKpis = useMemo(
    () => allSelectableKpis.filter((k) => k.type === 'PC' || k.type === 'GP' || k.type === 'VP'),
    [allSelectableKpis],
  );

  const groups: KpiGroup[] = useMemo(() => {
    const byType = new Map<string, DashboardPayload['loggable_kpis']>();
    availableKpis.forEach((kpi) => {
      const list = byType.get(kpi.type) ?? [];
      list.push(kpi);
      byType.set(kpi.type, list);
    });
    return Array.from(byType.entries())
      .map(([type, kpis]) => ({
        type,
        label: TYPE_META[type]?.label ?? type,
        kpis,
      }))
      .sort((a, b) => (TYPE_META[a.type]?.order ?? 9) - (TYPE_META[b.type]?.order ?? 9));
  }, [availableKpis]);

  const unselectedKpis = useMemo(
    () => availableKpis.filter((k) => !selectedIds.has(k.id)),
    [availableKpis, selectedIds],
  );

  const toggleKpi = useCallback(
    (kpi: DashboardPayload['loggable_kpis'][number]) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (selectedIds.has(kpi.id)) {
        setGoals(goals.filter((g) => g.kpi_id !== kpi.id));
      } else {
        setGoals([
          ...goals,
          {
            kpi_id: kpi.id,
            label: kpi.name,
            goal_scope: kpi.type === 'PC' ? 'team' : 'individual',
            goal_target: '',
            display_order: goals.length,
            kpi_type: kpi.type,
            suggested: false,
          },
        ]);
      }
    },
    [goals, selectedIds, setGoals],
  );

  const updateGoal = useCallback(
    (kpiId: string, patch: Partial<ChallengeWizardGoalDraft>) => {
      setGoals(goals.map((g) => (g.kpi_id === kpiId ? { ...g, ...patch } : g)));
    },
    [goals, setGoals],
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.headline}>Choose your KPIs</Text>
      <Text style={styles.subline}>Select the activities you want to track in this challenge.</Text>

      {/* Selected Goals */}
      {goals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected ({goals.length})</Text>
          {goals.map((goal) => {
            const colors = kpiTypeColor(goal.kpi_type ?? 'PC');
            return (
              <View key={goal.kpi_id} style={[styles.goalRow, { borderLeftColor: colors.bg }]}>
                <View style={styles.goalHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: colors.light }]}>
                    <Text style={[styles.typeBadgeText, { color: colors.bg }]}>{goal.kpi_type}</Text>
                  </View>
                  <Text style={styles.goalName} numberOfLines={1}>{goal.label}</Text>
                  {goal.suggested && <Text style={styles.suggestedPill}>Suggested</Text>}
                  <TouchableOpacity onPress={() => toggleKpi({ id: goal.kpi_id, name: goal.label, type: goal.kpi_type ?? 'PC' } as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.goalControls}>
                  {/* Scope toggle */}
                  <TouchableOpacity
                    style={[styles.scopeChip, goal.goal_scope === 'team' && styles.scopeChipActive]}
                    onPress={() => updateGoal(goal.kpi_id, { goal_scope: 'team' })}
                  >
                    <Text style={[styles.scopeChipText, goal.goal_scope === 'team' && styles.scopeChipTextActive]}>Team</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.scopeChip, goal.goal_scope === 'individual' && styles.scopeChipActive]}
                    onPress={() => updateGoal(goal.kpi_id, { goal_scope: 'individual' })}
                  >
                    <Text style={[styles.scopeChipText, goal.goal_scope === 'individual' && styles.scopeChipTextActive]}>Individual</Text>
                  </TouchableOpacity>
                  {/* Target input */}
                  <TextInput
                    style={styles.targetInput}
                    value={goal.goal_target}
                    onChangeText={(v) => updateGoal(goal.kpi_id, { goal_target: v.replace(/[^0-9]/g, '') })}
                    placeholder="Target"
                    placeholderTextColor={wiz.textMuted}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Add More KPIs */}
      {unselectedKpis.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.addMoreHeader}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowMore(!showMore);
            }}
          >
            <Text style={styles.addMoreText}>
              {showMore ? 'Hide available KPIs' : `Add more KPIs (${unselectedKpis.length} available)`}
            </Text>
            <Text style={styles.addMoreArrow}>{showMore ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showMore &&
            groups.map((group) => {
              const unselected = group.kpis.filter((k) => !selectedIds.has(k.id));
              if (unselected.length === 0) return null;
              const colors = kpiTypeColor(group.type);
              return (
                <View key={group.type} style={styles.groupSection}>
                  <View style={[styles.groupHeader, { backgroundColor: colors.light }]}>
                    <Text style={[styles.groupLabel, { color: colors.bg }]}>{group.label}</Text>
                  </View>
                  {unselected.map((kpi) => (
                    <TouchableOpacity key={kpi.id} style={styles.addKpiRow} onPress={() => toggleKpi(kpi)}>
                      <Text style={styles.addKpiName}>{kpi.name}</Text>
                      <Text style={styles.addKpiPlus}>+</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
        </View>
      )}

      {/* Continue */}
      <TouchableOpacity
        style={[styles.continueBtn, goals.length === 0 && styles.continueBtnDisabled]}
        onPress={goals.length > 0 ? onNext : undefined}
        activeOpacity={0.8}
      >
        <Text style={styles.continueBtnText}>Continue to Invite</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: wiz.pagePadding, paddingBottom: 40 },
  headline: { fontSize: 22, fontWeight: '900', color: wiz.textPrimary, marginBottom: 4 },
  subline: { fontSize: 14, color: wiz.textSecondary, marginBottom: 20 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: wiz.textSecondary, marginBottom: 8 },
  goalRow: {
    backgroundColor: wiz.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: wiz.surfaceBorder,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 8,
  },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  typeBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, fontWeight: '800' },
  goalName: { flex: 1, fontSize: 14, fontWeight: '700', color: wiz.textPrimary },
  suggestedPill: { fontSize: 10, fontWeight: '700', color: wiz.accent, backgroundColor: wiz.accentLight, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  removeBtn: { fontSize: 14, color: wiz.textMuted, fontWeight: '700' },
  goalControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scopeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: wiz.chipRadius, borderWidth: 1, borderColor: wiz.surfaceBorder },
  scopeChipActive: { backgroundColor: wiz.primary, borderColor: wiz.primary },
  scopeChipText: { fontSize: 12, fontWeight: '700', color: wiz.textSecondary },
  scopeChipTextActive: { color: wiz.textOnPrimary },
  targetInput: {
    flex: 1,
    backgroundColor: wiz.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: wiz.surfaceBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: wiz.textPrimary,
    textAlign: 'center',
    maxWidth: 80,
  },
  addMoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  addMoreText: { fontSize: 14, fontWeight: '700', color: wiz.primary },
  addMoreArrow: { fontSize: 12, color: wiz.primary },
  groupSection: { marginBottom: 12 },
  groupHeader: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 6 },
  groupLabel: { fontSize: 12, fontWeight: '800' },
  addKpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: wiz.surfaceBorder,
  },
  addKpiName: { fontSize: 14, fontWeight: '600', color: wiz.textPrimary },
  addKpiPlus: { fontSize: 18, fontWeight: '800', color: wiz.primary },
  continueBtn: { backgroundColor: wiz.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { fontSize: 16, fontWeight: '800', color: wiz.textOnPrimary },
});

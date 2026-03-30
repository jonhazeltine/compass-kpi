/**
 * WizardPhaseTimeline — Visual phase blocks for phased challenge templates.
 * Shows proportionally-sized colored blocks with phase names and week ranges.
 * Tap a phase block to rename it inline.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { phaseColor, wiz } from './wizardTheme';
import type { ChallengeTemplatePhase } from '../../../screens/kpi-dashboard/types';

interface Props {
  phases: ChallengeTemplatePhase[];
  totalDays: number;
  onRenamephase?: (phaseOrder: number, name: string) => void;
}

export default function WizardPhaseTimeline({ phases, totalDays, onRenamephase }: Props) {
  const [editingOrder, setEditingOrder] = useState<number | null>(null);

  if (phases.length === 0 || totalDays <= 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Challenge Phases {onRenamephase ? <Text style={styles.labelHint}>(tap to rename)</Text> : null}</Text>
      <View style={styles.track}>
        {phases.map((phase, idx) => {
          const nextStart = idx < phases.length - 1 ? phases[idx + 1].starts_at_week * 7 : totalDays;
          const startDay = phase.starts_at_week * 7;
          const phaseDays = Math.max(1, nextStart - startDay);
          const widthPct = (phaseDays / totalDays) * 100;

          return (
            <TouchableOpacity
              key={`phase-${idx}`}
              activeOpacity={onRenamephase ? 0.7 : 1}
              onPress={() => {
                if (onRenamephase) setEditingOrder(phase.phase_order);
              }}
              style={[
                styles.block,
                {
                  width: `${widthPct}%` as any,
                  backgroundColor: phaseColor(idx),
                },
                idx === 0 && styles.blockFirst,
                idx === phases.length - 1 && styles.blockLast,
              ]}
            >
              <Text style={styles.blockName} numberOfLines={1}>
                {phase.phase_name}
              </Text>
              <Text style={styles.blockWeeks}>
                W{phase.starts_at_week + 1}–W{Math.ceil(nextStart / 7)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {editingOrder != null && onRenamephase && (
        <View style={styles.renameRow}>
          <TextInput
            style={styles.renameInput}
            value={phases.find((p) => p.phase_order === editingOrder)?.phase_name ?? ''}
            onChangeText={(v) => onRenamephase(editingOrder, v)}
            onBlur={() => setEditingOrder(null)}
            onSubmitEditing={() => setEditingOrder(null)}
            autoFocus
            selectTextOnFocus
            placeholder="Phase name"
            placeholderTextColor={wiz.textMuted}
            returnKeyType="done"
          />
          <TouchableOpacity onPress={() => setEditingOrder(null)}>
            <Text style={styles.renameDone}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: wiz.textSecondary,
    marginBottom: 8,
  },
  labelHint: {
    fontWeight: '500',
    color: wiz.textMuted,
    fontSize: 11,
  },
  track: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    height: 52,
  },
  block: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  blockFirst: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  blockLast: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  blockName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  blockWeeks: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  renameInput: {
    flex: 1,
    backgroundColor: wiz.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: wiz.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: wiz.textPrimary,
  },
  renameDone: {
    fontSize: 14,
    fontWeight: '700',
    color: wiz.primary,
  },
});

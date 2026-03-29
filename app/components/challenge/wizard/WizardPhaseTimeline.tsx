/**
 * WizardPhaseTimeline — Visual phase blocks for phased challenge templates.
 * Shows proportionally-sized colored blocks with phase names and week ranges.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { phaseColor, wiz } from './wizardTheme';
import type { ChallengeTemplatePhase } from '../../../screens/kpi-dashboard/types';

interface Props {
  phases: ChallengeTemplatePhase[];
  totalDays: number;
}

export default function WizardPhaseTimeline({ phases, totalDays }: Props) {
  if (phases.length === 0 || totalDays <= 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Challenge Phases</Text>
      <View style={styles.track}>
        {phases.map((phase, idx) => {
          const nextStart = idx < phases.length - 1 ? phases[idx + 1].starts_at_week * 7 : totalDays;
          const startDay = phase.starts_at_week * 7;
          const phaseDays = Math.max(1, nextStart - startDay);
          const widthPct = (phaseDays / totalDays) * 100;

          return (
            <View
              key={`phase-${idx}`}
              style={[
                styles.block,
                {
                  width: `${widthPct}%`,
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
            </View>
          );
        })}
      </View>
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
});

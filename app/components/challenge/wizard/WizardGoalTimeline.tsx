/**
 * WizardGoalTimeline — Step 1: Challenge name, duration, phase preview.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { wiz } from './wizardTheme';
import WizardPhaseTimeline from './WizardPhaseTimeline';
import type { ChallengeTemplatePhase } from '../../../screens/kpi-dashboard/types';

const DURATION_OPTIONS = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '3 weeks', days: 21 },
  { label: '30 days', days: 30 },
];

interface Props {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  startAt: string;
  setStartAt: (v: string) => void;
  endAt: string;
  setEndAt: (v: string) => void;
  phases: ChallengeTemplatePhase[];
  onNext: () => void;
}

export default function WizardGoalTimeline({
  name,
  setName,
  description,
  setDescription,
  startAt,
  setStartAt,
  endAt,
  setEndAt,
  phases,
  onNext,
}: Props) {
  const durationDays = useMemo(() => {
    if (!startAt || !endAt) return 0;
    const s = new Date(startAt);
    const e = new Date(endAt);
    return Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  }, [startAt, endAt]);

  const activeDurationOption = DURATION_OPTIONS.find((opt) => opt.days === durationDays) ?? null;

  const handleDurationPick = useCallback(
    (days: number) => {
      const start = startAt ? new Date(startAt) : new Date();
      if (!startAt) {
        start.setDate(start.getDate() + 1);
        setStartAt(start.toISOString().slice(0, 10));
      }
      const end = new Date(start);
      end.setDate(end.getDate() + days);
      setEndAt(end.toISOString().slice(0, 10));
    },
    [startAt, setStartAt, setEndAt],
  );

  const START_OFFSETS = [
    { label: 'Tomorrow', days: 1 },
    { label: 'In 3 days', days: 3 },
    { label: 'Next Monday', days: (() => { const d = new Date(); return ((8 - d.getDay()) % 7) || 7; })() },
  ];

  const handleStartPick = useCallback((offsetDays: number) => {
    const start = new Date();
    start.setDate(start.getDate() + offsetDays);
    const startIso = start.toISOString().slice(0, 10);
    setStartAt(startIso);
    // Re-apply duration to keep end date consistent
    if (durationDays > 0) {
      const end = new Date(start);
      end.setDate(end.getDate() + durationDays);
      setEndAt(end.toISOString().slice(0, 10));
    }
  }, [durationDays, setStartAt, setEndAt]);

  const formatDateDisplay = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  const handleDatePickerChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') setShowPicker(null);
      if (!selectedDate) return;
      const iso = selectedDate.toISOString().slice(0, 10);
      if (showPicker === 'start') {
        setStartAt(iso);
        // Keep duration consistent
        if (endAt) {
          const currentDuration = Math.round(
            (new Date(endAt + 'T00:00:00').getTime() - new Date(startAt + 'T00:00:00').getTime()) / 86400000
          );
          if (currentDuration > 0) {
            const newEnd = new Date(selectedDate);
            newEnd.setDate(newEnd.getDate() + currentDuration);
            setEndAt(newEnd.toISOString().slice(0, 10));
          }
        }
      } else if (showPicker === 'end') {
        setEndAt(iso);
      }
      if (Platform.OS === 'ios') setShowPicker(null);
    },
    [showPicker, startAt, endAt, setStartAt, setEndAt],
  );

  const canProceed = name.trim().length > 0 && startAt.length > 0 && endAt.length > 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.headline}>Set the stage</Text>
      <Text style={styles.subline}>Name your challenge and pick your timeline.</Text>

      {/* Challenge Name */}
      <Text style={styles.fieldLabel}>Challenge Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. The Hungry Agent"
        placeholderTextColor={wiz.textMuted}
        maxLength={80}
      />

      {/* Description (optional) */}
      <Text style={styles.fieldLabel}>Description <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="What's this challenge about?"
        placeholderTextColor={wiz.textMuted}
        multiline
        maxLength={300}
      />

      {/* Duration Chips */}
      <Text style={styles.fieldLabel}>Duration</Text>
      <View style={styles.chipRow}>
        {DURATION_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.days}
            style={[styles.chip, activeDurationOption?.days === opt.days && styles.chipActive]}
            onPress={() => handleDurationPick(opt.days)}
          >
            <Text style={[styles.chipText, activeDurationOption?.days === opt.days && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Start date chips */}
      <Text style={styles.fieldLabel}>Start Date</Text>
      <View style={styles.chipRow}>
        {START_OFFSETS.map((opt) => {
          const d = new Date();
          d.setDate(d.getDate() + opt.days);
          const iso = d.toISOString().slice(0, 10);
          return (
            <TouchableOpacity
              key={opt.label}
              style={[styles.chip, startAt === iso && styles.chipActive]}
              onPress={() => handleStartPick(opt.days)}
            >
              <Text style={[styles.chipText, startAt === iso && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Date summary — tap to pick custom date */}
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateBlock} onPress={() => setShowPicker('start')} activeOpacity={0.7}>
          <Text style={styles.dateLabel}>Starts</Text>
          <Text style={styles.dateValue}>{formatDateDisplay(startAt)}</Text>
          <Text style={styles.dateTapHint}>tap to change</Text>
        </TouchableOpacity>
        <View style={styles.dateArrow}>
          <Text style={styles.dateArrowText}>→</Text>
        </View>
        <TouchableOpacity style={styles.dateBlock} onPress={() => setShowPicker('end')} activeOpacity={0.7}>
          <Text style={styles.dateLabel}>Ends</Text>
          <Text style={styles.dateValue}>{formatDateDisplay(endAt)}</Text>
          <Text style={styles.dateTapHint}>tap to change</Text>
        </TouchableOpacity>
      </View>

      {showPicker ? (
        <DateTimePicker
          value={new Date((showPicker === 'start' ? startAt : endAt) + 'T00:00:00')}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={showPicker === 'end' && startAt ? new Date(startAt + 'T00:00:00') : new Date()}
          onChange={handleDatePickerChange}
        />
      ) : null}

      {durationDays > 0 && (
        <Text style={styles.durationSummary}>{durationDays} days</Text>
      )}

      {/* Phase timeline (if template has phases) */}
      {phases.length > 0 && (
        <WizardPhaseTimeline phases={phases} totalDays={durationDays} />
      )}

      {/* Continue */}
      <TouchableOpacity
        style={[styles.continueBtn, !canProceed && styles.continueBtnDisabled]}
        onPress={canProceed ? onNext : undefined}
        activeOpacity={0.8}
      >
        <Text style={styles.continueBtnText}>Continue to KPIs</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    padding: wiz.pagePadding,
    paddingBottom: 40,
  },
  headline: {
    fontSize: 22,
    fontWeight: '900',
    color: wiz.textPrimary,
    marginBottom: 4,
  },
  subline: {
    fontSize: 14,
    color: wiz.textSecondary,
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: wiz.textSecondary,
    marginBottom: 6,
    marginTop: 16,
  },
  optional: {
    fontWeight: '400',
    color: wiz.textMuted,
  },
  input: {
    backgroundColor: wiz.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: wiz.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: wiz.textPrimary,
  },
  inputMultiline: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: wiz.chipRadius,
    backgroundColor: wiz.surface,
    borderWidth: 1,
    borderColor: wiz.surfaceBorder,
  },
  chipActive: {
    backgroundColor: wiz.primary,
    borderColor: wiz.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: wiz.textSecondary,
  },
  chipTextActive: {
    color: wiz.textOnPrimary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  dateBlock: {
    flex: 1,
    backgroundColor: wiz.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: wiz.surfaceBorder,
    padding: 12,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: wiz.textMuted,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '800',
    color: wiz.textPrimary,
  },
  dateTapHint: {
    fontSize: 10,
    color: wiz.accent,
    fontWeight: '600',
    marginTop: 2,
  },
  dateArrow: {
    paddingHorizontal: 4,
  },
  dateArrowText: {
    fontSize: 18,
    color: wiz.textMuted,
  },
  durationSummary: {
    fontSize: 13,
    fontWeight: '600',
    color: wiz.primary,
    textAlign: 'center',
    marginTop: 8,
  },
  continueBtn: {
    backgroundColor: wiz.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: wiz.textOnPrimary,
  },
});

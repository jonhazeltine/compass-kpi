/**
 * ChallengeWizard — Full-screen, 4-step challenge creation experience.
 *
 * Steps:
 *   0: Template Gallery (pick a template or start from scratch)
 *   1: Goal & Timeline (name, duration, phases preview)
 *   2: KPI Selection (grouped by type, scope + target per KPI)
 *   3: Invite & Launch (invite members, review summary, launch)
 *
 * Uses core RN Animated API for horizontal slide transitions.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { wiz } from './wizardTheme';
import WizardProgressBar from './WizardProgressBar';
import WizardTemplateGallery from './WizardTemplateGallery';
import WizardGoalTimeline from './WizardGoalTimeline';
import WizardKpiSelection from './WizardKpiSelection';
import WizardInviteLaunch from './WizardInviteLaunch';
import type { ChallengeWizardGoalDraft, ChallengeTemplatePhase } from '../../../screens/kpi-dashboard/types';
import type { ChallengeTemplateDefaultRow } from '../../../screens/kpi-dashboard/defaultChallengeTemplates';
import type { DashboardPayload } from '../../../screens/kpi-dashboard/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STEP_COUNT = 4;

// ── Props ────────────────────────────────────────────────────────

export interface ChallengeWizardProps {
  visible: boolean;
  onClose: () => void;

  // Templates
  templates: ChallengeTemplateDefaultRow[];
  loadingTemplates: boolean;

  // KPIs available for selection
  allSelectableKpis: DashboardPayload['loggable_kpis'];

  // Wizard state (from useChallengeWorkflow)
  wizardName: string;
  setWizardName: (v: string) => void;
  wizardDescription: string;
  setWizardDescription: (v: string) => void;
  wizardStartAt: string;
  setWizardStartAt: (v: string) => void;
  wizardEndAt: string;
  setWizardEndAt: (v: string) => void;
  wizardGoals: ChallengeWizardGoalDraft[];
  setWizardGoals: (v: ChallengeWizardGoalDraft[]) => void;
  wizardInviteUserIds: string[];
  setWizardInviteUserIds: (v: string[]) => void;
  wizardTemplateId: string | null;
  setWizardTemplateId: (v: string | null) => void;

  // Team context
  teamMemberDirectory: Array<{ userId: string | null; name: string }>;
  isSoloPersona: boolean;
  hasTeamTier: boolean;
  challengeInviteLimit: number;

  // Submit
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;

  // Paywall
  showPaywall?: (title: string, message: string, plan: string) => void;
}

// ── Component ────────────────────────────────────────────────────

export default function ChallengeWizard({
  visible,
  onClose,
  templates,
  loadingTemplates,
  allSelectableKpis,
  wizardName,
  setWizardName,
  wizardDescription,
  setWizardDescription,
  wizardStartAt,
  setWizardStartAt,
  wizardEndAt,
  setWizardEndAt,
  wizardGoals,
  setWizardGoals,
  wizardInviteUserIds,
  setWizardInviteUserIds,
  wizardTemplateId,
  setWizardTemplateId,
  teamMemberDirectory,
  isSoloPersona,
  hasTeamTier,
  challengeInviteLimit,
  onSubmit,
  submitting,
  submitError,
  showPaywall,
}: ChallengeWizardProps) {
  const [step, setStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ── Navigation ──────────────────────────────────────────────
  const animateToStep = useCallback(
    (nextStep: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      Animated.timing(slideAnim, {
        toValue: -nextStep * SCREEN_WIDTH,
        duration: wiz.stepTransitionMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setStep(nextStep);
      });
    },
    [slideAnim],
  );

  const goNext = useCallback(() => {
    if (step < STEP_COUNT - 1) animateToStep(step + 1);
  }, [step, animateToStep]);

  const goBack = useCallback(() => {
    if (step > 0) animateToStep(step - 1);
  }, [step, animateToStep]);

  const handleClose = useCallback(() => {
    setStep(0);
    slideAnim.setValue(0);
    onClose();
  }, [onClose, slideAnim]);

  // ── Template selection handler ──────────────────────────────
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === wizardTemplateId) ?? null,
    [templates, wizardTemplateId],
  );

  const phases: ChallengeTemplatePhase[] = useMemo(() => {
    if (!selectedTemplate) return [];
    // Read phases from template (works for both API and fallback templates)
    const raw = (selectedTemplate as any).phases;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map((p: any) => ({
      phase_order: p.phase_order ?? 0,
      phase_name: p.phase_name ?? '',
      starts_at_week: p.starts_at_week ?? 0,
      kpi_goals: p.kpi_goals ?? [],
    }));
  }, [selectedTemplate]);

  const handleSelectTemplate = useCallback(
    (template: ChallengeTemplateDefaultRow) => {
      setWizardTemplateId(template.id);
      setWizardName(template.default_challenge_name ?? template.title);

      // Set dates
      const start = new Date();
      start.setDate(start.getDate() + 1);
      const end = new Date(start);
      end.setDate(end.getDate() + template.suggested_duration_days);
      setWizardStartAt(start.toISOString().slice(0, 10));
      setWizardEndAt(end.toISOString().slice(0, 10));

      // Set KPI goals from template
      const goals: ChallengeWizardGoalDraft[] = template.kpi_defaults.map((kd) => {
        const kpi = allSelectableKpis.find((k) => k.id === kd.kpi_id);
        return {
          kpi_id: kd.kpi_id,
          label: kd.label,
          goal_scope: kd.goal_scope_default,
          goal_target: kd.suggested_target != null ? String(kd.suggested_target) : '',
          display_order: kd.display_order,
          kpi_type: kpi?.type,
          suggested: true,
        };
      });
      setWizardGoals(goals);

      // Auto-advance to Goal & Timeline
      setTimeout(() => animateToStep(1), 150);
    },
    [allSelectableKpis, animateToStep, setWizardEndAt, setWizardGoals, setWizardName, setWizardStartAt, setWizardTemplateId],
  );

  const handleStartFromScratch = useCallback(() => {
    setWizardTemplateId(null);
    setWizardName('');

    // Default: start tomorrow, 3 weeks
    const start = new Date();
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 21);
    setWizardStartAt(start.toISOString().slice(0, 10));
    setWizardEndAt(end.toISOString().slice(0, 10));

    // Pre-fill with top 4 KPIs
    const goals: ChallengeWizardGoalDraft[] = allSelectableKpis
      .filter((k) => k.type === 'PC' || k.type === 'GP' || k.type === 'VP')
      .slice(0, 4)
      .map((kpi, idx) => ({
        kpi_id: kpi.id,
        label: kpi.name,
        goal_scope: kpi.type === 'PC' ? 'team' as const : 'individual' as const,
        goal_target: '',
        display_order: idx,
        kpi_type: kpi.type,
        suggested: false,
      }));
    setWizardGoals(goals);

    setTimeout(() => animateToStep(1), 150);
  }, [allSelectableKpis, animateToStep, setWizardEndAt, setWizardGoals, setWizardName, setWizardStartAt, setWizardTemplateId]);

  // ── Render ──────────────────────────────────────────────────
  if (!visible) return null;

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={step === 0 ? handleClose : goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.headerBack}>{step === 0 ? 'Cancel' : '← Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Challenge</Text>
        <View style={{ width: 60 }} />
      </View>

      <WizardProgressBar currentStep={step} />

      {/* Steps — horizontal scroll via translateX */}
      <Animated.View
        style={[
          styles.stepsTrack,
          { width: SCREEN_WIDTH * STEP_COUNT, transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Step 0: Template Gallery */}
        <View style={[styles.stepPage, { width: SCREEN_WIDTH }]}>
          <WizardTemplateGallery
            templates={templates}
            loading={loadingTemplates}
            selectedId={wizardTemplateId}
            onSelectTemplate={handleSelectTemplate}
            onStartFromScratch={handleStartFromScratch}
          />
        </View>

        {/* Step 1: Goal & Timeline */}
        <View style={[styles.stepPage, { width: SCREEN_WIDTH }]}>
          <WizardGoalTimeline
            name={wizardName}
            setName={setWizardName}
            description={wizardDescription}
            setDescription={setWizardDescription}
            startAt={wizardStartAt}
            setStartAt={setWizardStartAt}
            endAt={wizardEndAt}
            setEndAt={setWizardEndAt}
            phases={phases}
            onNext={goNext}
          />
        </View>

        {/* Step 2: KPI Selection */}
        <View style={[styles.stepPage, { width: SCREEN_WIDTH }]}>
          <WizardKpiSelection
            goals={wizardGoals}
            setGoals={setWizardGoals}
            allSelectableKpis={allSelectableKpis}
            onNext={goNext}
          />
        </View>

        {/* Step 3: Invite & Launch */}
        <View style={[styles.stepPage, { width: SCREEN_WIDTH }]}>
          <WizardInviteLaunch
            name={wizardName}
            startAt={wizardStartAt}
            endAt={wizardEndAt}
            goals={wizardGoals}
            inviteUserIds={wizardInviteUserIds}
            setInviteUserIds={setWizardInviteUserIds}
            teamMemberDirectory={teamMemberDirectory}
            isSoloPersona={isSoloPersona}
            hasTeamTier={hasTeamTier}
            challengeInviteLimit={challengeInviteLimit}
            onSubmit={onSubmit}
            submitting={submitting}
            submitError={submitError}
            showPaywall={showPaywall}
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: wiz.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wiz.pagePadding,
    paddingVertical: 12,
  },
  headerBack: {
    fontSize: 15,
    fontWeight: '600',
    color: wiz.primary,
    width: 60,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: wiz.textPrimary,
    textAlign: 'center',
  },
  stepsTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  stepPage: {
    height: '100%',
  },
});

/**
 * VPTreeScreen — Vitality Points living tree visualization.
 *
 * Procedurally generated tree driven by VP data.
 * Mock data + test buttons for development.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useSharedValue,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { TreeCanvas } from '../components/vp-tree/TreeCanvas';
import { generateTree } from '../components/vp-tree/treeGen';
import {
  getStage,
  getNextThreshold,
  getDecayProgress,
  VP_STAGES,
  MICRO_STEP_TYPES,
  type GrowthStage,
  type MicroStepType,
} from '../components/vp-tree/constants';
import { colors, space, radii } from '../theme/tokens';
import { createMicroStepPicker, computeProgress, pickZoomTarget } from '../components/shared/animationUtils';
import { useZoomAnimation } from '../components/shared/useZoomAnimation';

// ── Micro-step pool (no immediate repeat) ──────────────────────────────────────

function createTreeMicroPicker() {
  const picker = createMicroStepPicker(MICRO_STEP_TYPES);
  return (hasLeaves: boolean): MicroStepType => {
    return picker((t) => {
      if (!hasLeaves) return t === 'trunkGlow' || t === 'branchExtend';
      return true;
    });
  };
}

const TIER_THRESHOLDS = VP_STAGES.map(s => s.min);

// ── Component ──────────────────────────────────────────────────────────────────

interface VPTreeScreenProps {
  onBack?: () => void;
}

export default function VPTreeScreen({ onBack }: VPTreeScreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ── Mock data state ──────────────────────────────────────────────────────────

  const [vpTotal, setVpTotal] = useState(0);
  const [vpStreak, setVpStreak] = useState(0);
  const [lastLoggedAt, setLastLoggedAt] = useState<Date | null>(new Date());
  const [seed] = useState(() => Math.floor(Math.random() * 99999));
  const [isAnimating, setIsAnimating] = useState(false);

  // Micro-step rendering state
  const [newLeafIdx, setNewLeafIdx] = useState(-1);
  const [flowerIdx, setFlowerIdx] = useState(-1);

  const pickMicro = useRef(createTreeMicroPicker()).current;
  const logsSinceZoomRef = useRef(0);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const stage = getStage(vpTotal) as GrowthStage;
  const stageConfig = VP_STAGES[stage];
  const decay = getDecayProgress(lastLoggedAt);
  const nextThreshold = getNextThreshold(vpTotal);

  // Canvas dimensions
  const headerHeight = 80;
  const controlsHeight = 150;
  const canvasWidth = screenWidth;
  const canvasHeight = screenHeight - insets.top - headerHeight - controlsHeight - insets.bottom;

  // Tree data (regenerates on stage or canvas size change)
  const treeData = useMemo(
    () => generateTree(seed, stageConfig.maxDepth, stageConfig.leafDensity, canvasWidth, canvasHeight, stageConfig.trunkScale, stageConfig.spreadScale, stageConfig.horizontalBias),
    [seed, stage, canvasWidth, canvasHeight],
  );

  // ── Zoom hook ───────────────────────────────────────────────────────────────
  const { zoomTransform, zoomOriginX, zoomOriginY, zoomTo, isZooming } = useZoomAnimation(canvasWidth, canvasHeight);

  // ── Shared values ────────────────────────────────────────────────────────────

  const decayShared = useSharedValue(decay);
  const orbProgress = useSharedValue(0);
  const orbOpacity = useSharedValue(0);
  const trunkGlowOpacity = useSharedValue(0);
  const newLeafScale = useSharedValue(0);
  const rustleOffsetX = useSharedValue(0);
  const rustleOffsetY = useSharedValue(0);
  const butterflyProgress = useSharedValue(0);
  const flowerScale = useSharedValue(0);
  const particleProgress = useSharedValue(0);
  const particleOpacity = useSharedValue(0);
  const tierFlashOpacity = useSharedValue(0);
  const tierScale = useSharedValue(1);

  // Sync decay
  React.useEffect(() => {
    decayShared.value = withTiming(decay, { duration: 2000 });
  }, [decay]);

  // ── Animation: Micro-steps ───────────────────────────────────────────────────

  const finishAnimation = useCallback(() => setIsAnimating(false), []);

  const playMicroStep = useCallback(
    (type: MicroStepType) => {
      const ease = { duration: 300, easing: Easing.out(Easing.cubic) };

      switch (type) {
        case 'leafUnfurl': {
          if (treeData.leaves.length === 0) { finishAnimation(); return; }
          const idx = Math.floor(Math.random() * treeData.leaves.length);
          setNewLeafIdx(idx);
          newLeafScale.value = 0;
          newLeafScale.value = withSpring(
            treeData.leaves[idx].size,
            { damping: 8, stiffness: 120 },
            (fin) => { if (fin) runOnJS(setNewLeafIdx)(-1); runOnJS(finishAnimation)(); },
          );
          break;
        }

        case 'canopyRustle': {
          rustleOffsetX.value = withSequence(
            withTiming(3.5, { duration: 120 }),
            withTiming(-3, { duration: 120 }),
            withTiming(2, { duration: 100 }),
            withTiming(-1, { duration: 80 }),
            withTiming(0, { duration: 80 }),
          );
          rustleOffsetY.value = withSequence(
            withTiming(-2.5, { duration: 120 }),
            withTiming(2, { duration: 120 }),
            withTiming(-1, { duration: 100 }),
            withTiming(0, ease, (fin) => { if (fin) runOnJS(finishAnimation)(); }),
          );
          break;
        }

        case 'trunkGlow': {
          trunkGlowOpacity.value = withSequence(
            withTiming(0.8, { duration: 250 }),
            withTiming(0.25, { duration: 180 }),
            withTiming(0.6, { duration: 180 }),
            withTiming(0, { duration: 500 }, (fin) => { if (fin) runOnJS(finishAnimation)(); }),
          );
          break;
        }

        case 'butterfly': {
          butterflyProgress.value = 0;
          butterflyProgress.value = withTiming(
            1,
            { duration: 2200, easing: Easing.inOut(Easing.cubic) },
            (fin) => {
              butterflyProgress.value = 0;
              if (fin) runOnJS(finishAnimation)();
            },
          );
          break;
        }

        case 'flowerBud': {
          if (treeData.leaves.length === 0) { finishAnimation(); return; }
          const idx = Math.floor(Math.random() * treeData.leaves.length);
          setFlowerIdx(idx);
          flowerScale.value = 0;
          flowerScale.value = withSpring(6, { damping: 7, stiffness: 100 }, () => {
            flowerScale.value = withDelay(
              600,
              withTiming(0, { duration: 600 }, (fin) => {
                runOnJS(setFlowerIdx)(-1);
                if (fin) runOnJS(finishAnimation)();
              }),
            );
          });
          break;
        }

        case 'branchExtend': {
          // Trunk glow + upward sway combo
          trunkGlowOpacity.value = withSequence(
            withTiming(0.5, { duration: 200 }),
            withTiming(0, { duration: 400 }),
          );
          rustleOffsetY.value = withSequence(
            withTiming(-4, { duration: 300 }),
            withTiming(0, ease, (fin) => { if (fin) runOnJS(finishAnimation)(); }),
          );
          break;
        }
      }
    },
    [treeData],
  );

  // ── Animation: Orb ───────────────────────────────────────────────────────────

  const playOrb = useCallback(
    (onAbsorb: () => void) => {
      // Reset
      orbProgress.value = 0;
      particleProgress.value = 0;

      // Orb travels up
      orbOpacity.value = withSequence(
        withTiming(1, { duration: 80 }),
        withDelay(1050, withTiming(0, { duration: 250 })),
      );
      orbProgress.value = withTiming(1, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      });

      // Trunk glow on absorption
      trunkGlowOpacity.value = withDelay(
        1100,
        withSequence(
          withTiming(0.7, { duration: 150 }),
          withTiming(0, { duration: 500 }),
        ),
      );

      // Particles burst on absorption
      particleOpacity.value = withDelay(1100, withSequence(
        withTiming(1, { duration: 40 }),
        withDelay(350, withTiming(0, { duration: 250 })),
      ));
      particleProgress.value = withDelay(1100, withTiming(1, { duration: 500 }));

      // Fire micro-step callback after absorption
      setTimeout(() => onAbsorb(), 1400);
    },
    [],
  );

  // ── Animation: Tier reveal ───────────────────────────────────────────────────

  const playTierReveal = useCallback(() => {
    tierFlashOpacity.value = withSequence(
      withTiming(0.75, { duration: 180 }),
      withTiming(0, { duration: 900 }),
    );
    tierScale.value = withSequence(
      withTiming(1.1, { duration: 350, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 6, stiffness: 90 }, (fin) => {
        if (fin) runOnJS(finishAnimation)();
      }),
    );
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const logVP = useCallback(
    (amount: number) => {
      if (isAnimating) return;
      setIsAnimating(true);

      const prevStage = stage;
      const newTotal = vpTotal + amount;
      const newStage = getStage(newTotal);

      // Compute progress
      const progress = computeProgress(vpTotal, newTotal, TIER_THRESHOLDS, logsSinceZoomRef.current, 5);
      logsSinceZoomRef.current += 1;

      setVpTotal(newTotal);
      setVpStreak((s) => s + 1);
      setLastLoggedAt(new Date());

      playOrb(() => {
        // ALWAYS play micro-step
        const micro = pickMicro(treeData.leaves.length > 0);
        playMicroStep(micro);

        if (progress.shouldTriggerTier && newStage > prevStage) {
          // TIER REVEAL — cinematic, takes priority
          setTimeout(() => playTierReveal(), 900);
          logsSinceZoomRef.current = 0;
        } else if (progress.shouldTriggerZoom) {
          // ZOOM ANIMATION — pick a target, zoom in, play detail, zoom out
          const target = pickZoomTarget(treeData.zoomTargets);
          if (target) {
            setTimeout(() => {
              zoomTo(
                target,
                () => {
                  // onHold: play another micro at zoomed level
                  const zoomMicro = pickMicro(treeData.leaves.length > 0);
                  playMicroStep(zoomMicro);
                },
                () => finishAnimation(),
              );
            }, 800);
            logsSinceZoomRef.current = 0;
          } else {
            // No zoom targets — just finish
          }
        }
      });
    },
    [isAnimating, vpTotal, stage, treeData, playOrb, playMicroStep, playTierReveal, zoomTo],
  );

  const triggerMicroOnly = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    const micro = pickMicro(treeData.leaves.length > 0);
    playMicroStep(micro);
  }, [isAnimating, treeData, playMicroStep]);

  const triggerTierOnly = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    playTierReveal();
  }, [isAnimating, playTierReveal]);

  const jumpToNextTier = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);

    const target = getNextThreshold(vpTotal);
    if (target <= vpTotal) { setIsAnimating(false); return; }

    setVpTotal(target);
    setVpStreak((s) => s + 1);
    setLastLoggedAt(new Date());

    playOrb(() => {
      const micro = pickMicro(true);
      playMicroStep(micro);
      setTimeout(() => playTierReveal(), 900);
    });
  }, [isAnimating, vpTotal, playOrb, playMicroStep, playTierReveal]);

  const resetAll = useCallback(() => {
    setVpTotal(0);
    setVpStreak(0);
    setLastLoggedAt(new Date());
    setIsAnimating(false);
    setNewLeafIdx(-1);
    setFlowerIdx(-1);
  }, []);

  const setDecayLevel = useCallback((hours: number) => {
    if (hours === 0) {
      setLastLoggedAt(new Date());
    } else {
      setLastLoggedAt(new Date(Date.now() - hours * 60 * 60 * 1000));
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 4 }]}>
        <View style={styles.headerRow}>
          {onBack && (
            <Pressable onPress={onBack} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          )}
          <Text style={styles.headerTitle}>VP Tree</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Stats bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}>
          <StatPill label="VP" value={vpTotal} />
          <StatPill label="Stage" value={`${stage} — ${stageConfig.label}`} />
          <StatPill label="Streak" value={`${vpStreak}d`} />
          <StatPill label="Next" value={nextThreshold} />
          <StatPill label="Decay" value={`${Math.round(decay * 100)}%`} />
        </ScrollView>
      </View>

      {/* Canvas */}
      <View style={styles.canvasWrap}>
        <TreeCanvas
          width={canvasWidth}
          height={canvasHeight}
          treeData={treeData}
          stage={stage}
          decayProgress={decayShared}
          orbProgress={orbProgress}
          orbOpacity={orbOpacity}
          trunkGlowOpacity={trunkGlowOpacity}
          rustleOffsetX={rustleOffsetX}
          rustleOffsetY={rustleOffsetY}
          newLeafScale={newLeafScale}
          newLeafIndex={newLeafIdx}
          flowerScale={flowerScale}
          flowerIndex={flowerIdx}
          butterflyProgress={butterflyProgress}
          particleProgress={particleProgress}
          particleOpacity={particleOpacity}
          tierFlashOpacity={tierFlashOpacity}
          tierScale={tierScale}
          zoomTransform={zoomTransform}
          zoomOriginX={zoomOriginX}
          zoomOriginY={zoomOriginY}
          isZooming={isZooming}
        />
      </View>

      {/* Stage stepper controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 8 }]}>
        {/* Stage nav — big prev/next */}
        <View style={styles.stageNav}>
          <Pressable
            onPress={() => { if (stage > 0) setVpTotal(VP_STAGES[stage - 1].min); }}
            style={[styles.navArrow, stage === 0 && styles.navDisabled]}
            disabled={stage === 0}
          >
            <Text style={styles.navArrowText}>◀</Text>
          </Pressable>
          <View style={styles.stageInfo}>
            <Text style={styles.stageNum}>Stage {stage}</Text>
            <Text style={styles.stageName}>{stageConfig.label}</Text>
            <Text style={styles.stageVp}>{vpTotal} VP (min {stageConfig.min})</Text>
          </View>
          <Pressable
            onPress={() => { if (stage < 5) setVpTotal(VP_STAGES[stage + 1].min); }}
            style={[styles.navArrow, stage >= 5 && styles.navDisabled]}
            disabled={stage >= 5}
          >
            <Text style={styles.navArrowText}>▶</Text>
          </Pressable>
        </View>

        {/* Quick jump row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
          {VP_STAGES.map((s, i) => (
            <Btn
              key={i}
              label={`S${i}`}
              color={i === stage ? '#1976D2' : '#90A4AE'}
              onPress={() => setVpTotal(s.min)}
            />
          ))}
        </ScrollView>

        {/* Action row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
          <Btn label="+10 VP" color="#4CAF50" onPress={() => logVP(10)} disabled={isAnimating} />
          <Btn label="Micro" color="#9C27B0" onPress={triggerMicroOnly} disabled={isAnimating} />
          <Btn label="Tier FX" color="#E91E63" onPress={triggerTierOnly} disabled={isAnimating} />
          <Btn label="No Decay" color="#8BC34A" onPress={() => setDecayLevel(0)} />
          <Btn label="Full Decay" color="#795548" onPress={() => setDecayLevel(192)} />
        </ScrollView>
      </View>
    </View>
  );
}

// ── Small reusable components ──────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{String(value)}</Text>
    </View>
  );
}

function Btn({
  label,
  color,
  onPress,
  disabled,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.testBtn, { backgroundColor: color, opacity: disabled ? 0.4 : 1 }]}
    >
      <Text style={styles.testBtnText}>{label}</Text>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  header: {
    paddingHorizontal: space.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
    width: 60,
  },
  backText: {
    fontSize: 15,
    color: colors.brand,
    fontWeight: '600',
  },
  statsRow: {
    marginBottom: 4,
  },
  statPill: {
    backgroundColor: '#fff',
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  canvasWrap: {
    flex: 1,
  },
  controls: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  stageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  navArrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDisabled: {
    backgroundColor: '#CFD8DC',
  },
  navArrowText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
  },
  stageInfo: {
    alignItems: 'center',
    flex: 1,
  },
  stageNum: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  stageName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  stageVp: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 3,
  },
  testBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.sm,
  },
  testBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

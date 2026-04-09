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
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  withRepeat,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { TreeCanvas } from '../components/vp-tree/TreeCanvas';
import { PreRenderedTreeCanvas } from '../components/vp-tree/PreRenderedTreeCanvas';
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

// Lottie assets — require() at module level for Metro bundling
const LOTTIE_BIRDS = require('../assets/lottie/butterfly.json'); // birds-flying removed, using butterfly
const LOTTIE_BUTTERFLY = require('../assets/lottie/butterfly.json');
const LOTTIE_LEAF = require('../assets/lottie/sparkle.json'); // leaf-falling removed, using sparkle
const LOTTIE_MAGIC = require('../assets/lottie/magic-particles.json');
const LOTTIE_SPARKLE = require('../assets/lottie/sparkle.json');

// ── Animated Lottie wrappers ──────────────────────────────────────────────────

function FlyingBird({ source, canvasWidth, canvasHeight }: { source: any; canvasWidth: number; canvasHeight: number }) {
  const translateX = useSharedValue(-120);
  React.useEffect(() => {
    translateX.value = -120;
    translateX.value = withRepeat(
      withTiming(canvasWidth + 120, { duration: 12000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [canvasWidth]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: canvasHeight * 0.06,
    left: 0,
    width: 100,
    height: 60,
    transform: [{ translateX: translateX.value }],
  }));
  return (
    <Animated.View style={style}>
      <LottieView source={source} autoPlay loop speed={1} style={{ width: 100, height: 60 }} />
    </Animated.View>
  );
}

function FloatingButterfly({ source, canvasWidth, canvasHeight }: { source: any; canvasWidth: number; canvasHeight: number }) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  React.useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(40, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-40, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    );
    translateY.value = withRepeat(
      withSequence(
        withTiming(-25, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(25, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: canvasHeight * 0.22,
    right: canvasWidth * 0.15,
    width: 55,
    height: 55,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));
  return (
    <Animated.View style={style}>
      <LottieView source={source} autoPlay loop speed={0.8} style={{ width: 55, height: 55 }} />
    </Animated.View>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface VPTreeScreenProps {
  onBack?: () => void;
  onOpenGallery?: () => void;
  onOpenUnityTree?: () => void;
  /** Rendered on top of the canvas area — used for Unity overlay */
  unityOverlay?: React.ReactNode;
}

export default function VPTreeScreen({ onBack, onOpenGallery, onOpenUnityTree, unityOverlay }: VPTreeScreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ── Mock data state ──────────────────────────────────────────────────────────

  const [vpTotal, setVpTotal] = useState(0);
  const [vpStreak, setVpStreak] = useState(0);
  const [lastLoggedAt, setLastLoggedAt] = useState<Date | null>(new Date());
  const [seed] = useState(() => Math.floor(Math.random() * 99999));
  const [isAnimating, setIsAnimating] = useState(false);
  const [usePreRendered, setUsePreRendered] = useState(true); // toggle between renderers
  const [renderMode, setRenderMode] = useState<'bg' | 'transparent' | 'silhouette'>('bg');
  const [imageStage, setImageStage] = useState(0); // 0-9 for image-based rendering

  // Micro-step rendering state
  const [newLeafIdx, setNewLeafIdx] = useState(-1);
  const [flowerIdx, setFlowerIdx] = useState(-1);

  const pickMicro = useRef(createTreeMicroPicker()).current;
  const logsSinceZoomRef = useRef(0);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const stage = getStage(vpTotal) as GrowthStage;
  const stageConfig = VP_STAGES[stage];

  // Sync image stage directly to VP stage (0-5 maps to 0-9 with x2 scaling)
  React.useEffect(() => {
    const target = Math.min(stage * 2, 9);
    setImageStage(target);
  }, [stage]);
  const decay = getDecayProgress(lastLoggedAt);
  const nextThreshold = getNextThreshold(vpTotal);

  // Canvas dimensions — derived from log screen layout (computed in render section)
  const navBarH_ = 72 + Math.max(insets.bottom, 10);
  const availableH_ = screenHeight - navBarH_;
  const canvasWidth = screenWidth;
  const canvasHeight = Math.round(availableH_ * 0.55);

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

  // ── Continuous wind sway (gentle breathing) ─────────────────────────────────
  React.useEffect(() => {
    if (stage < 1) return; // no sway on dormant sprout
    const swayAmount = 1.5 + stage * 0.5;
    rustleOffsetX.value = withRepeat(
      withSequence(
        withTiming(swayAmount, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-swayAmount, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    rustleOffsetY.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [stage]);

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
      const progress = computeProgress(vpTotal, newTotal, TIER_THRESHOLDS, logsSinceZoomRef.current);
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

  // ── Layout matching UnityLogScreen ───────────────────────────────────────────
  // Tree view: top 55% of available space (above nav bar)
  // Overlay: bottom 45% — translucent with tabs + controls
  // Nav bar: 72px + safe area at very bottom

  const navBarH = 72 + Math.max(insets.bottom, 10);
  const availableH = screenHeight - navBarH;
  const TREE_RATIO = 0.55;
  const treeViewH = Math.round(availableH * TREE_RATIO);
  const overlayH = availableH - treeViewH;

  // Canvas dimensions for PreRenderedTreeCanvas (fills the tree view area)
  const treeCanvasW = screenWidth;
  const treeCanvasH = treeViewH;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Tree view — top 55%, black background */}
      <View style={[styles.treeView, { height: treeViewH }]}>
        {usePreRendered ? (
          <>
            <PreRenderedTreeCanvas
              width={treeCanvasW}
              height={treeCanvasH}
              stage={stage}
              imageStage={imageStage}
              renderMode={renderMode}
              decayProgress={decayShared}
              orbProgress={orbProgress}
              orbOpacity={orbOpacity}
              trunkGlowOpacity={trunkGlowOpacity}
              rustleOffsetX={rustleOffsetX}
              rustleOffsetY={rustleOffsetY}
              particleProgress={particleProgress}
              particleOpacity={particleOpacity}
              tierFlashOpacity={tierFlashOpacity}
              tierScale={tierScale}
            />
            {/* Lottie overlay */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {stage >= 2 && <FlyingBird source={LOTTIE_BIRDS} canvasWidth={treeCanvasW} canvasHeight={treeCanvasH} />}
              {stage >= 3 && <FloatingButterfly source={LOTTIE_BUTTERFLY} canvasWidth={treeCanvasW} canvasHeight={treeCanvasH} />}
              {stage >= 3 && (
                <LottieView source={LOTTIE_LEAF} autoPlay loop speed={0.5}
                  style={{ position: 'absolute', top: treeCanvasH * 0.15, left: treeCanvasW * 0.25, width: 120, height: 250 }} />
              )}
              {stage >= 4 && (
                <LottieView source={LOTTIE_LEAF} autoPlay loop speed={0.35}
                  style={{ position: 'absolute', top: treeCanvasH * 0.05, left: treeCanvasW * 0.55, width: 90, height: 200 }} />
              )}
              {stage >= 4 && (
                <LottieView source={LOTTIE_MAGIC} autoPlay loop speed={0.4}
                  style={{ position: 'absolute', top: treeCanvasH * 0.08, left: treeCanvasW * 0.05, width: treeCanvasW * 0.9, height: treeCanvasH * 0.55 }} />
              )}
              {stage >= 5 && (
                <LottieView source={LOTTIE_SPARKLE} autoPlay loop speed={0.5}
                  style={{ position: 'absolute', top: treeCanvasH * 0.12, left: treeCanvasW * 0.1, width: treeCanvasW * 0.8, height: treeCanvasH * 0.45 }} />
              )}
            </View>
          </>
        ) : (
          <TreeCanvas
            width={treeCanvasW}
            height={treeCanvasH}
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
        )}
      </View>

      {/* Overlay panel — bottom 45%, translucent like UnityLogScreen */}
      <View style={[styles.overlay, { height: overlayH }]}>
        {/* Mode tabs — matching UnityLogScreen tab strip */}
        <View style={styles.tabStrip}>
          <Pressable style={styles.tab} onPress={() => setRenderMode('transparent')}>
            <Text style={[styles.tabText, renderMode === 'transparent' && styles.tabTextActive]}>TRANS</Text>
            {renderMode === 'transparent' && <View style={[styles.tabUnderline, { backgroundColor: '#2ecc71' }]} />}
          </Pressable>
          <Pressable style={styles.tab} onPress={() => setRenderMode('bg')}>
            <Text style={[styles.tabText, renderMode === 'bg' && styles.tabTextActive]}>BG</Text>
            {renderMode === 'bg' && <View style={[styles.tabUnderline, { backgroundColor: '#3b82f6' }]} />}
          </Pressable>
          <Pressable style={styles.tab} onPress={() => setUsePreRendered((v) => !v)}>
            <Text style={[styles.tabText, !usePreRendered && styles.tabTextActive]}>{usePreRendered ? 'PRE' : 'PROC'}</Text>
          </Pressable>
        </View>

        {/* Controls scroll area */}
        <ScrollView style={styles.controlsScroll} showsVerticalScrollIndicator={false}>
          {/* Image stage stepper (0-9) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
            {Array.from({ length: 10 }, (_, i) => (
              <Btn key={`img-${i}`} label={`${i}`}
                color={i === imageStage ? '#2ecc71' : '#444'}
                onPress={() => setImageStage(i)} />
            ))}
          </ScrollView>

          {/* VP stage quick jump */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
            {VP_STAGES.map((s, i) => (
              <Btn key={i} label={`S${i}`}
                color={i === stage ? '#3b82f6' : '#444'}
                onPress={() => setVpTotal(s.min)} />
            ))}
            <Btn label="+10" color="#2ecc71" onPress={() => logVP(10)} disabled={isAnimating} />
          </ScrollView>

          {/* Effects row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.btnRow}>
            <Btn label="Micro" color="#9C27B0" onPress={triggerMicroOnly} disabled={isAnimating} />
            <Btn label="Tier FX" color="#E91E63" onPress={triggerTierOnly} disabled={isAnimating} />
            <Btn label="No Decay" color="#4a5568" onPress={() => setDecayLevel(0)} />
            <Btn label="Full Decay" color="#4a5568" onPress={() => setDecayLevel(192)} />
          </ScrollView>

          {/* Stage info */}
          <View style={styles.stageInfoRow}>
            <Text style={styles.stageInfoText}>
              Stage {stage} — {stageConfig.label} | {vpTotal} VP | Image {imageStage} | Decay {Math.round(decay * 100)}%
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Nav bar — matching UnityLogScreen */}
      <View style={[styles.navBar, { height: navBarH, paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable style={styles.navItem} onPress={onBack}>
          <Text style={styles.navLabel}>← Back</Text>
        </Pressable>
        <View style={styles.navLogOuter}>
          <View style={styles.navLogBtn}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>LOG</Text>
          </View>
        </View>
        <Pressable style={styles.navItem} onPress={onOpenGallery}>
          <Text style={styles.navLabel}>Gallery</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Small reusable components ──────────────────────────────────────────────────

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
    backgroundColor: '#000',
  },
  treeView: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  // ── Overlay (matching UnityLogScreen) ──
  overlay: {
    backgroundColor: 'rgba(13,17,23,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  tabStrip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabText: {
    color: '#8d95a5',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#fff',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
  },
  controlsScroll: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  stageInfoRow: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  stageInfoText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  // ── Nav bar (matching UnityLogScreen) ──
  navBar: {
    backgroundColor: '#0d1117',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  navLogOuter: {
    alignItems: 'center',
  },
  navLogBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2ecc71',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  navLabel: {
    color: '#8d95a5',
    fontSize: 11,
    fontWeight: '500',
  },
  navDisabled: {
    opacity: 0.4,
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

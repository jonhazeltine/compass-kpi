/**
 * VPTreeInline — Skia tree embedded in the dashboard Vitality card.
 * Reacts to VP logs via `pulseKey` (increment to trigger glow + growth).
 *
 * Stage component unlocks:
 *   0 — bare stick
 *   1 — soil sparkles
 *   2 — fireflies
 *   3 — roots + falling leaves
 *   4 — sun rays + ground flora + bird with wing-flap
 *   5 — aurora, floating blossoms, crown/halo, butterflies, rune veins, stars, bloom
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import {
  Canvas,
  Circle,
  Path,
  Rect,
  Group,
  LinearGradient,
  BlurMask,
  vec,
  Skia,
  Line,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withSequence,
  withSpring,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { generateTree } from './treeGen';
import { getStage, getDecayProgress, VP_STAGES, TREE_COLORS } from './constants';
import { Squirrel } from './creatures/Squirrel';
import { BirdNest } from './creatures/BirdNest';
import { Owl } from './creatures/Owl';
import { Deer } from './creatures/Deer';
import { Wisps } from './creatures/Wisps';
import { PhoenixBird } from './creatures/PhoenixBird';
import { ProgressBars } from '../shared/ProgressBars';

interface VPTreeInlineProps {
  width: number;
  height: number;
  vpTotal?: number;
  vpStreak?: number;
  lastLoggedAt?: Date | null;
  seed?: number;
  /** Increment this number each time a VP KPI is logged to trigger the pulse animation */
  pulseKey?: number;
}

// ── Sub-components (each owns its own hooks) ────────────────────────────────────

function Particle({
  angle, baseCx, baseCy, progress, opacity,
}: {
  angle: number; baseCx: number; baseCy: number;
  progress: SharedValue<number>; opacity: SharedValue<number>;
}) {
  const cx = useDerivedValue(() => baseCx + Math.cos(angle) * progress.value * 35);
  const cy = useDerivedValue(() => baseCy + Math.sin(angle) * progress.value * 35 - progress.value * 15);
  const r = useDerivedValue(() => 2 * (1 - progress.value * 0.7));
  return <Circle cx={cx} cy={cy} r={r} color={TREE_COLORS.particle} opacity={opacity} />;
}

function OrbElement({
  baseX, startY, endY, progress, opacity,
}: {
  baseX: number; startY: number; endY: number;
  progress: SharedValue<number>; opacity: SharedValue<number>;
}) {
  const cx = useDerivedValue(() => baseX + Math.sin(progress.value * Math.PI * 3) * 6);
  const cy = useDerivedValue(() => startY + (endY - startY) * progress.value);
  const r = useDerivedValue(() => 8 + Math.sin(progress.value * Math.PI * 5) * 1.5);
  const innerR = useDerivedValue(() => (8 + Math.sin(progress.value * Math.PI * 5) * 1.5) * 0.45);
  return (
    <Group opacity={opacity}>
      <Circle cx={cx} cy={cy} r={r} color={TREE_COLORS.orbGlow}><BlurMask blur={10} style="normal" /></Circle>
      <Circle cx={cx} cy={cy} r={r} color={TREE_COLORS.orbCore} />
      <Circle cx={cx} cy={cy} r={innerR} color={TREE_COLORS.orbGold} />
    </Group>
  );
}

// Stage 1 — Soil sparkle
function SoilSparkle({
  baseX, y, offset, shimmer,
}: {
  baseX: number; y: number; offset: number; shimmer: SharedValue<number>;
}) {
  const op = useDerivedValue(() => 0.3 + Math.sin(shimmer.value * Math.PI * 2 + offset) * 0.5);
  const r = useDerivedValue(() => 1.2 + Math.sin(shimmer.value * Math.PI * 2 + offset + 1) * 0.6);
  return (
    <Group>
      <Circle cx={baseX} cy={y} r={r} color={TREE_COLORS.sparkle} opacity={op} />
      <Circle cx={baseX} cy={y} r={useDerivedValue(() => r.value * 2)} color={TREE_COLORS.sparkleGlow} opacity={useDerivedValue(() => op.value * 0.4)}>
        <BlurMask blur={4} style="normal" />
      </Circle>
    </Group>
  );
}

// Stage 2 — Firefly
function Firefly({
  cx: baseCx, cy: baseCy, phase, drift,
}: {
  cx: number; cy: number; phase: number; drift: SharedValue<number>;
}) {
  const x = useDerivedValue(() => baseCx + Math.sin(drift.value * Math.PI * 2 + phase) * 18);
  const y = useDerivedValue(() => baseCy + Math.cos(drift.value * Math.PI * 2 + phase * 1.3) * 12);
  const op = useDerivedValue(() => 0.4 + Math.sin(drift.value * Math.PI * 4 + phase) * 0.4);
  return (
    <Group>
      <Circle cx={x} cy={y} r={5} color={TREE_COLORS.fireflyGlow} opacity={op}><BlurMask blur={6} style="normal" /></Circle>
      <Circle cx={x} cy={y} r={1.5} color={TREE_COLORS.fireflyCore} opacity={op} />
    </Group>
  );
}

// Stage 3 — Falling leaf
function FallingLeaf({
  startX, startY, groundY, progress, leafOp,
}: {
  startX: number; startY: number; groundY: number;
  progress: SharedValue<number>; leafOp: SharedValue<number>;
}) {
  const x = useDerivedValue(() => startX + Math.sin(progress.value * Math.PI * 2) * 15);
  const y = useDerivedValue(() => startY + (groundY - startY) * progress.value);
  return <Circle cx={x} cy={y} r={2.5} color={TREE_COLORS.leaf} opacity={leafOp} />;
}

// Stage 5 — Floating blossom
function FloatingBlossom({
  startX, startY, phase, drift,
}: {
  startX: number; startY: number; phase: number; drift: SharedValue<number>;
}) {
  const x = useDerivedValue(() => startX + Math.sin(drift.value * Math.PI * 2 + phase) * 25);
  const y = useDerivedValue(() => startY - drift.value * 40 + Math.sin(drift.value * Math.PI * 3 + phase) * 8);
  const op = useDerivedValue(() => {
    const t = (drift.value + phase / (Math.PI * 2)) % 1;
    return t < 0.1 ? t * 10 : t > 0.8 ? (1 - t) * 5 : 1;
  });
  const r = useDerivedValue(() => 2 + Math.sin(drift.value * Math.PI * 5 + phase) * 0.8);
  const color = phase % 2 < 1 ? TREE_COLORS.blossomPink : TREE_COLORS.blossomWhite;
  return <Circle cx={x} cy={y} r={r} color={color} opacity={op} />;
}

// Stage 5 — Star twinkle
function StarTwinkle({
  cx: sx, cy: sy, phase, twinkle,
}: {
  cx: number; cy: number; phase: number; twinkle: SharedValue<number>;
}) {
  const op = useDerivedValue(() => 0.2 + Math.sin(twinkle.value * Math.PI * 2 + phase) * 0.6);
  const r = useDerivedValue(() => 0.8 + Math.sin(twinkle.value * Math.PI * 3 + phase) * 0.4);
  return <Circle cx={sx} cy={sy} r={r} color={TREE_COLORS.starBright} opacity={op} />;
}

// Stage 5 — Butterfly (orbiting figure-8)
function ButterflyOrbit({
  centerX, centerY, phase, orbitR, progress,
}: {
  centerX: number; centerY: number; phase: number; orbitR: number;
  progress: SharedValue<number>;
}) {
  const bodyX = useDerivedValue(() => centerX + Math.sin(progress.value * Math.PI * 2 + phase) * orbitR);
  const bodyY = useDerivedValue(() => centerY + Math.sin(progress.value * Math.PI * 4 + phase) * orbitR * 0.5);
  const wingOff = useDerivedValue(() => Math.abs(Math.sin(progress.value * Math.PI * 16 + phase)) * 4);
  const leftX = useDerivedValue(() => bodyX.value - wingOff.value);
  const rightX = useDerivedValue(() => bodyX.value + wingOff.value);
  const wingY = useDerivedValue(() => bodyY.value - 2);
  return (
    <Group>
      <Circle cx={leftX} cy={wingY} r={3.5} color={TREE_COLORS.butterfly} />
      <Circle cx={rightX} cy={wingY} r={3.5} color={TREE_COLORS.butterfly} />
      <Circle cx={bodyX} cy={bodyY} r={1.2} color="#4A148C" />
    </Group>
  );
}

const PARTICLE_ANGLES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

// Pre-computed sparkle positions (relative offsets from trunk base)
const SPARKLE_OFFSETS = [-50, -40, -30, -20, -12, -4, 4, 12, 20, 30, 40, 50];
// Firefly seed positions (relative to canopy center) — more for wider canopy
const FIREFLY_SEEDS = [
  { dx: -50, dy: -10, phase: 0 },
  { dx: -20, dy: -30, phase: 1.5 },
  { dx: 20, dy: -25, phase: 2.1 },
  { dx: 45, dy: 5, phase: 4.2 },
  { dx: -10, dy: 15, phase: 1.0 },
  { dx: 35, dy: -15, phase: 3.3 },
];
// Stars (relative to canvas)
const STAR_SEEDS = Array.from({ length: 16 }, (_, i) => ({
  xFrac: 0.04 + (i * 0.061) % 0.92,
  yFrac: 0.02 + ((i * 0.137 + 0.08) % 0.32),
  phase: i * 1.1,
}));
// Blossoms — more for wider canopy
const BLOSSOM_SEEDS = Array.from({ length: 12 }, (_, i) => ({
  dxFrac: (i / 12 - 0.5) * 0.8,
  phase: i * 0.52,
}));

export function VPTreeInline({
  width,
  height,
  vpTotal = 0,
  vpStreak = 0,
  lastLoggedAt = new Date(),
  seed = 42,
  pulseKey = 0,
}: VPTreeInlineProps) {
  const stage = getStage(vpTotal);
  const stageConfig = VP_STAGES[stage];
  const decay = getDecayProgress(lastLoggedAt);
  const decayShared = useSharedValue(decay);

  useEffect(() => {
    decayShared.value = withTiming(decay, { duration: 1500 });
  }, [decay]);

  const treeData = useMemo(
    () => generateTree(seed, stageConfig.maxDepth, stageConfig.leafDensity, width, height, stageConfig.trunkScale, stageConfig.spreadScale, stageConfig.horizontalBias),
    [seed, stage, width, height],
  );

  // ── Branch paths grouped by depth ──────────────────────────────────────────
  const branchGroups = useMemo(() => {
    const byDepth = new Map<number, (typeof treeData.branches)[number][]>();
    for (const b of treeData.branches) {
      const arr = byDepth.get(b.depth) ?? [];
      arr.push(b);
      byDepth.set(b.depth, arr);
    }
    return [...byDepth.values()].map((branches) => {
      const p = Skia.Path.Make();
      for (const b of branches) {
        p.moveTo(b.x1, b.y1);
        p.quadTo(b.cx, b.cy, b.x2, b.y2);
      }
      return { path: p, thickness: branches[0].thickness };
    });
  }, [treeData]);

  const glowGroups = useMemo(() => branchGroups.filter((_, i) => i <= 1), [branchGroups]);

  const leafPath = useMemo(() => {
    const p = Skia.Path.Make();
    for (const l of treeData.leaves) p.addCircle(l.x, l.y, l.size);
    return p;
  }, [treeData]);

  // Root paths (stage 3+)
  const rootPath = useMemo(() => {
    const p = Skia.Path.Make();
    for (const r of treeData.roots) {
      p.moveTo(r.x1, r.y1);
      p.quadTo(r.cx, r.cy, r.x2, r.y2);
    }
    return p;
  }, [treeData]);

  // Rune vein paths (stage 5) — glow lines along trunk & first branches
  const runeVeinPath = useMemo(() => {
    const p = Skia.Path.Make();
    const trunkBranches = treeData.branches.filter(b => b.depth <= 1);
    for (const b of trunkBranches) {
      // Offset slightly for a "vein alongside trunk" look
      const off = 1.5;
      p.moveTo(b.x1 + off, b.y1);
      p.quadTo(b.cx + off, b.cy, b.x2 + off, b.y2);
      p.moveTo(b.x1 - off, b.y1);
      p.quadTo(b.cx - off, b.cy, b.x2 - off, b.y2);
    }
    return p;
  }, [treeData]);

  // Sun ray data (stage 4+)
  const sunRays = useMemo(() => {
    if (stage < 4) return [];
    const rays: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const cx = treeData.canopyCenter.x;
    const cy = treeData.canopyCenter.y - 15;
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI * 0.7 + (i / 4) * Math.PI * 0.4;
      rays.push({
        x1: cx + Math.cos(angle) * 20,
        y1: cy + Math.sin(angle) * 20,
        x2: cx + Math.cos(angle) * 80,
        y2: cy + Math.sin(angle) * 80,
      });
    }
    return rays;
  }, [stage, treeData]);

  const groundY = height * 0.85;

  // ── Continuous ambient animations ──────────────────────────────────────────
  const shimmer = useSharedValue(0);
  const fireflyDrift = useSharedValue(0);
  const fallingLeafProgress = useSharedValue(0);
  const fallingLeafOp = useSharedValue(0);
  const blossomDrift = useSharedValue(0);
  const starTwinkle = useSharedValue(0);
  const butterflyLoop = useSharedValue(0);
  const auroraShift = useSharedValue(0);
  const runePulse = useSharedValue(0);
  const birdWingFlap = useSharedValue(0);
  const sunRayPulse = useSharedValue(0);
  const crownPulse = useSharedValue(0);

  // Creature ambient animations (always created — hooks must be stable)
  const squirrelTail = useSharedValue(0);
  const nestRock = useSharedValue(0);
  const owlBlink = useSharedValue(0);
  const deerBob = useSharedValue(0);
  const wispDrift = useSharedValue(0);
  const phoenixOrbit = useSharedValue(0);

  // Creature visibility — animate in smoothly (entrance animation)
  const squirrelVis = useSharedValue(0);
  const nestVis = useSharedValue(0);
  const owlVis = useSharedValue(0);
  const deerVis = useSharedValue(0);
  const wispsVis = useSharedValue(0);
  const phoenixVis = useSharedValue(0);

  // Creature entrance offsets (animate from off-position to final position)
  const squirrelEntrance = useSharedValue(30);   // scurries up from below
  const owlEntrance = useSharedValue(-40);       // flies down from above
  const deerEntrance = useSharedValue(-50);      // walks in from left
  const nestScale = useSharedValue(0);           // builds up from nothing

  // Progress bars
  const fastBarProgress = useSharedValue(0);
  const slowBarProgress = useSharedValue(0);

  useEffect(() => {
    // Stage 1+ sparkle shimmer
    if (stageConfig.hasSparkles) {
      shimmer.value = 0;
      shimmer.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false);
    }
    // Stage 2+ firefly drift
    if (stageConfig.hasFireflies) {
      fireflyDrift.value = 0;
      fireflyDrift.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    }
    // Stage 3+ falling leaf cycle
    if (stageConfig.hasFallingLeaves) {
      const runCycle = () => {
        fallingLeafProgress.value = 0;
        fallingLeafOp.value = withSequence(
          withTiming(1, { duration: 200 }),
          withTiming(1, { duration: 3500 }),
          withTiming(0, { duration: 300 }),
        );
        fallingLeafProgress.value = withTiming(1, { duration: 4000, easing: Easing.linear });
      };
      runCycle();
      const interval = setInterval(runCycle, 5500);
      return () => clearInterval(interval);
    }
  }, [stage]);

  useEffect(() => {
    // Stage 4+ sun ray pulse
    if (stageConfig.hasSunRays) {
      sunRayPulse.value = 0;
      sunRayPulse.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
    }
    // Stage 4+ bird wing flap
    if (stageConfig.hasWildlife) {
      birdWingFlap.value = 0;
      birdWingFlap.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false);
    }
  }, [stage]);

  useEffect(() => {
    // Stage 5 ambient loops
    if (stageConfig.hasBlossoms) {
      blossomDrift.value = 0;
      blossomDrift.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false);
    }
    if (stageConfig.hasStars) {
      starTwinkle.value = 0;
      starTwinkle.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false);
    }
    if (stageConfig.hasButterflies) {
      butterflyLoop.value = 0;
      butterflyLoop.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1, false);
    }
    if (stageConfig.hasAurora) {
      auroraShift.value = 0;
      auroraShift.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.linear }), -1, false);
    }
    if (stageConfig.hasRuneVeins) {
      runePulse.value = 0;
      runePulse.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1, false);
    }
    if (stageConfig.hasCrown) {
      crownPulse.value = 0;
      crownPulse.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
    }
    // Creature entrances — animate visibility + position when unlocked
    if (stageConfig.hasSquirrel && squirrelVis.value === 0) {
      squirrelEntrance.value = 30;
      squirrelVis.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
      squirrelEntrance.value = withTiming(0, { duration: 1200, easing: Easing.out(Easing.cubic) });
    }
    if (stageConfig.hasNest && nestVis.value === 0) {
      nestScale.value = 0;
      nestVis.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
      nestScale.value = withSpring(1, { damping: 8, stiffness: 100 });
    }
    if (stageConfig.hasOwl && owlVis.value === 0) {
      owlEntrance.value = -40;
      owlVis.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
      owlEntrance.value = withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) });
    }
    if (stageConfig.hasDeer && deerVis.value === 0) {
      deerEntrance.value = -50;
      deerVis.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });
      deerEntrance.value = withTiming(0, { duration: 1500, easing: Easing.out(Easing.cubic) });
    }
    if (stageConfig.hasWisps && wispsVis.value === 0) {
      wispsVis.value = withTiming(1, { duration: 2000, easing: Easing.out(Easing.cubic) });
    }
    if (stageConfig.hasPhoenix && phoenixVis.value === 0) {
      phoenixVis.value = withTiming(1, { duration: 2500, easing: Easing.out(Easing.cubic) });
    }
    // Reset visibility when stage drops (e.g., stepper goes backwards)
    if (!stageConfig.hasSquirrel) squirrelVis.value = 0;
    if (!stageConfig.hasNest) nestVis.value = 0;
    if (!stageConfig.hasOwl) owlVis.value = 0;
    if (!stageConfig.hasDeer) deerVis.value = 0;
    if (!stageConfig.hasWisps) wispsVis.value = 0;
    if (!stageConfig.hasPhoenix) phoenixVis.value = 0;

    // Creature ambient loops
    if (stageConfig.hasSquirrel) {
      squirrelTail.value = 0;
      squirrelTail.value = withRepeat(withTiming(1, { duration: 2500, easing: Easing.linear }), -1, false);
    }
    if (stageConfig.hasNest) {
      nestRock.value = 0;
      nestRock.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
    }
    if (stageConfig.hasOwl) {
      owlBlink.value = 0;
      owlBlink.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false);
    }
    if (stageConfig.hasDeer) {
      deerBob.value = 0;
      deerBob.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false);
    }
    if (stageConfig.hasWisps) {
      wispDrift.value = 0;
      wispDrift.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    }
    if (stageConfig.hasPhoenix) {
      phoenixOrbit.value = 0;
      phoenixOrbit.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
    }
  }, [stage]);

  // ── Pulse animation shared values ──────────────────────────────────────────
  const trunkGlowOpacity = useSharedValue(0);
  const orbProgress = useSharedValue(0);
  const orbOpacity = useSharedValue(0);
  const particleProgress = useSharedValue(0);
  const particleOpacity = useSharedValue(0);
  const treeScale = useSharedValue(1);
  const newLeafScale = useSharedValue(0);

  const leafTargetRef = useRef(-1);
  const prevPulseKey = useRef(pulseKey);

  useEffect(() => {
    if (pulseKey === prevPulseKey.current) return;
    prevPulseKey.current = pulseKey;

    if (treeData.leaves.length > 0) {
      leafTargetRef.current = Math.floor(Math.random() * treeData.leaves.length);
    }

    orbProgress.value = 0;
    orbOpacity.value = withSequence(
      withTiming(1, { duration: 60 }),
      withTiming(1, { duration: 800 }),
      withTiming(0, { duration: 200 }),
    );
    orbProgress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });

    trunkGlowOpacity.value = withSequence(
      withTiming(0, { duration: 800 }),
      withTiming(0.8, { duration: 180 }),
      withTiming(0.2, { duration: 150 }),
      withTiming(0.5, { duration: 150 }),
      withTiming(0, { duration: 450 }),
    );

    particleProgress.value = 0;
    particleOpacity.value = withSequence(
      withTiming(0, { duration: 850 }),
      withTiming(1, { duration: 30 }),
      withTiming(1, { duration: 300 }),
      withTiming(0, { duration: 200 }),
    );
    particleProgress.value = withSequence(
      withTiming(0, { duration: 850 }),
      withTiming(1, { duration: 500 }),
    );

    treeScale.value = withSequence(
      withTiming(1, { duration: 900 }),
      withTiming(1.04, { duration: 200 }),
      withSpring(1, { damping: 8, stiffness: 120 }),
    );

    if (treeData.leaves.length > 0) {
      newLeafScale.value = 0;
      newLeafScale.value = withSequence(
        withTiming(0, { duration: 950 }),
        withSpring(treeData.leaves[leafTargetRef.current]?.size ?? 4, { damping: 8, stiffness: 100 }),
      );
    }
  }, [pulseKey, treeData]);

  // ── Derived transforms ─────────────────────────────────────────────────────
  const treeTransform = useDerivedValue(() => [{ scale: treeScale.value * treeData.fitScale }]);

  // Aurora opacity animation
  const auroraOp1 = useDerivedValue(() => 0.08 + Math.sin(auroraShift.value * Math.PI * 2) * 0.06);
  const auroraOp2 = useDerivedValue(() => 0.06 + Math.sin(auroraShift.value * Math.PI * 2 + 2) * 0.05);
  const auroraOp3 = useDerivedValue(() => 0.05 + Math.sin(auroraShift.value * Math.PI * 2 + 4) * 0.04);

  // Rune vein glow
  const runeOp = useDerivedValue(() => 0.3 + Math.sin(runePulse.value * Math.PI * 2) * 0.4);

  // Sun ray opacity
  const sunOp = useDerivedValue(() => 0.12 + Math.sin(sunRayPulse.value * Math.PI * 2) * 0.06);

  // Crown halo
  const crownOp = useDerivedValue(() => 0.4 + Math.sin(crownPulse.value * Math.PI * 2) * 0.25);
  const crownR = useDerivedValue(() => 35 + Math.sin(crownPulse.value * Math.PI * 2) * 5);
  const crownInnerR = useDerivedValue(() => crownR.value * 0.7);
  const crownInnerOp = useDerivedValue(() => crownOp.value * 0.5);
  const runeGlowOp = useDerivedValue(() => runeOp.value * 0.5);

  // Bird wing flap offset
  const birdWingY = useDerivedValue(() => Math.abs(Math.sin(birdWingFlap.value * Math.PI * 6)) * 4);

  // Falling leaf start position (pick a random leaf-ish spot)
  const fallingLeafX = treeData.canopyCenter.x + 8;
  const fallingLeafStartY = treeData.canopyCenter.y;

  // ── Render ─────────────────────────────────────────────────────────────────
  const targetLeaf = leafTargetRef.current >= 0 && leafTargetRef.current < treeData.leaves.length
    ? treeData.leaves[leafTargetRef.current]
    : null;

  // Bird path with animated wings
  const birdBranch = stage >= 4 && treeData.branches.length >= 5 ? treeData.branches[4] : null;

  return (
    <View style={{ width, height, borderRadius: 10, overflow: 'hidden' }}>
      <Canvas style={{ width, height }}>
        {/* Sky */}
        <Rect x={0} y={0} width={width} height={groundY}>
          <LinearGradient start={vec(0, 0)} end={vec(0, groundY)} colors={[TREE_COLORS.skyTop, TREE_COLORS.skyBottom]} />
        </Rect>
        <Rect x={0} y={0} width={width} height={groundY} color={TREE_COLORS.skyDecayTop} opacity={decayShared} />

        {/* Stage 5 — Stars */}
        {stageConfig.hasStars && STAR_SEEDS.map((s, i) => (
          <StarTwinkle
            key={`star-${i}`}
            cx={s.xFrac * width}
            cy={s.yFrac * height}
            phase={s.phase}
            twinkle={starTwinkle}
          />
        ))}

        {/* Stage 5 — Aurora bands (behind everything) */}
        {stageConfig.hasAurora && (
          <Group>
            <Rect x={0} y={height * 0.02} width={width} height={height * 0.25} color={TREE_COLORS.auroraTop} opacity={auroraOp1}>
              <BlurMask blur={30} style="normal" />
            </Rect>
            <Rect x={width * 0.1} y={height * 0.1} width={width * 0.8} height={height * 0.2} color={TREE_COLORS.auroraMid} opacity={auroraOp2}>
              <BlurMask blur={25} style="normal" />
            </Rect>
            <Rect x={width * 0.15} y={height * 0.18} width={width * 0.7} height={height * 0.15} color={TREE_COLORS.auroraBottom} opacity={auroraOp3}>
              <BlurMask blur={20} style="normal" />
            </Rect>
          </Group>
        )}

        {/* Stage 4+ — Sun rays */}
        {stageConfig.hasSunRays && sunRays.map((ray, i) => (
          <Line
            key={`ray-${i}`}
            p1={vec(ray.x1, ray.y1)}
            p2={vec(ray.x2, ray.y2)}
            color={TREE_COLORS.sunRay}
            style="stroke"
            strokeWidth={8 + i * 2}
            opacity={sunOp}
          >
            <BlurMask blur={12} style="normal" />
          </Line>
        ))}

        {/* Ground */}
        <Rect x={0} y={groundY} width={width} height={height - groundY} color={TREE_COLORS.grass} />
        <Rect x={0} y={groundY} width={width} height={height - groundY} color={TREE_COLORS.grassDecay} opacity={decayShared} />
        <Rect x={0} y={groundY} width={width} height={3} color={TREE_COLORS.ground} />

        {/* Stage 3+ — Roots (below ground line) */}
        {stageConfig.hasRoots && treeData.roots.map((rt, i) => {
          const p = Skia.Path.Make();
          p.moveTo(rt.x1, rt.y1);
          p.quadTo(rt.cx, rt.cy, rt.x2, rt.y2);
          return (
            <Group key={`root-${i}`}>
              <Path path={p} style="stroke" strokeWidth={rt.thickness} color={TREE_COLORS.root} strokeCap="round" />
              <Path path={p} style="stroke" strokeWidth={rt.thickness * 0.5} color={TREE_COLORS.rootLight} strokeCap="round" />
            </Group>
          );
        })}

        {/* Stage 4+ — Ground flora */}
        {stageConfig.hasGroundFlora && treeData.groundFlora.map((f, i) => (
          f.kind === 'mushroom' ? (
            <Group key={`flora-${i}`}>
              <Rect x={f.x - f.size * 0.5} y={f.y - f.size * 0.3} width={f.size} height={f.size * 0.3} color={TREE_COLORS.mushroom} />
              <Circle cx={f.x} cy={f.y - f.size * 0.3} r={f.size * 0.6} color={TREE_COLORS.mushroomCap} />
            </Group>
          ) : (
            <Group key={`flora-${i}`}>
              <Circle cx={f.x} cy={f.y - f.size * 0.5} r={f.size * 0.45} color={TREE_COLORS.groundFlower} />
              <Circle cx={f.x} cy={f.y - f.size * 0.5} r={f.size * 0.2} color={TREE_COLORS.groundFlowerCenter} />
            </Group>
          )
        ))}

        {/* Stage 1+ — Soil sparkles */}
        {stageConfig.hasSparkles && SPARKLE_OFFSETS.map((off, i) => (
          <SoilSparkle
            key={`sp-${i}`}
            baseX={treeData.trunkBase.x + off}
            y={groundY + 4 + (i % 3) * 3}
            offset={i * 0.8}
            shimmer={shimmer}
          />
        ))}

        {/* Bloom glow (stage 5) */}
        {stageConfig.hasBloom && (
          <Circle cx={treeData.canopyCenter.x} cy={treeData.canopyCenter.y} r={60} color={TREE_COLORS.bloomGlow}>
            <BlurMask blur={30} style="normal" />
          </Circle>
        )}

        {/* Stage 5 — Crown / halo above canopy */}
        {stageConfig.hasCrown && (
          <Group>
            <Circle cx={treeData.canopyCenter.x} cy={treeData.canopyCenter.y - 30} r={crownR} color={TREE_COLORS.crownGlow} opacity={crownOp}>
              <BlurMask blur={18} style="normal" />
            </Circle>
            <Circle cx={treeData.canopyCenter.x} cy={treeData.canopyCenter.y - 30} r={crownInnerR} color={TREE_COLORS.crownGold} opacity={crownInnerOp}>
              <BlurMask blur={10} style="normal" />
            </Circle>
          </Group>
        )}

        {/* Tree group with pulse scale */}
        <Group transform={treeTransform} origin={vec(treeData.trunkBase.x, treeData.trunkBase.y)}>
          {/* Branches */}
          {branchGroups.map((g, i) => (
            <Path key={`b-${i}`} path={g.path} style="stroke" strokeWidth={g.thickness} color={TREE_COLORS.trunk} strokeCap="round" />
          ))}
          {branchGroups.map((g, i) => (
            <Path key={`bd-${i}`} path={g.path} style="stroke" strokeWidth={g.thickness} color={TREE_COLORS.trunkDecay} strokeCap="round" opacity={decayShared} />
          ))}

          {/* Stage 5 — Rune veins (glowing lines along trunk) */}
          {stageConfig.hasRuneVeins && (
            <Group>
              <Path path={runeVeinPath} style="stroke" strokeWidth={1.5} color={TREE_COLORS.runeVein} strokeCap="round" opacity={runeOp} />
              <Path path={runeVeinPath} style="stroke" strokeWidth={3} color={TREE_COLORS.runeGlow} strokeCap="round" opacity={runeGlowOp}>
                <BlurMask blur={4} style="normal" />
              </Path>
            </Group>
          )}

          {/* Trunk glow */}
          {glowGroups.map((g, i) => (
            <Path key={`glow-${i}`} path={g.path} style="stroke" strokeWidth={g.thickness + 3} color={TREE_COLORS.trunkGlow} strokeCap="round" opacity={trunkGlowOpacity}>
              <BlurMask blur={5} style="normal" />
            </Path>
          ))}

          {/* Leaves */}
          <Path path={leafPath} color={TREE_COLORS.leaf} />
          <Path path={leafPath} color={TREE_COLORS.leafDecay} opacity={decayShared} />

          {/* New leaf unfurl (micro-step) */}
          {targetLeaf && (
            <Circle cx={targetLeaf.x} cy={targetLeaf.y} r={newLeafScale} color={TREE_COLORS.leafLight} />
          )}

          {/* Bird (stage 4+) with wing-flap */}
          {birdBranch && (() => {
            const bx = birdBranch.x2;
            const by = birdBranch.y2;
            return (
              <Group>
                <Circle cx={bx} cy={by - 4} r={2} color={TREE_COLORS.bird} />
                <Line p1={vec(bx - 5, by - 4)} p2={vec(bx - 1, by - 4)} color={TREE_COLORS.bird} style="stroke" strokeWidth={1.5} strokeCap="round" />
                <Line p1={vec(bx + 1, by - 4)} p2={vec(bx + 5, by - 4)} color={TREE_COLORS.bird} style="stroke" strokeWidth={1.5} strokeCap="round" />
              </Group>
            );
          })()}
        </Group>

        {/* Stage 2+ — Fireflies */}
        {stageConfig.hasFireflies && FIREFLY_SEEDS.map((f, i) => (
          <Firefly
            key={`ff-${i}`}
            cx={treeData.canopyCenter.x + f.dx}
            cy={treeData.canopyCenter.y + f.dy}
            phase={f.phase}
            drift={fireflyDrift}
          />
        ))}

        {/* Stage 3+ — Falling leaf */}
        {stageConfig.hasFallingLeaves && (
          <FallingLeaf
            startX={fallingLeafX}
            startY={fallingLeafStartY}
            groundY={groundY}
            progress={fallingLeafProgress}
            leafOp={fallingLeafOp}
          />
        )}

        {/* Stage 5 — Floating blossoms */}
        {stageConfig.hasBlossoms && BLOSSOM_SEEDS.map((b, i) => (
          <FloatingBlossom
            key={`bl-${i}`}
            startX={treeData.canopyCenter.x + b.dxFrac * width}
            startY={treeData.canopyCenter.y + 10}
            phase={b.phase}
            drift={blossomDrift}
          />
        ))}

        {/* Stage 5 — Butterflies */}
        {stageConfig.hasButterflies && (
          <Group>
            <ButterflyOrbit centerX={treeData.canopyCenter.x} centerY={treeData.canopyCenter.y} phase={0} orbitR={35} progress={butterflyLoop} />
            <ButterflyOrbit centerX={treeData.canopyCenter.x + 15} centerY={treeData.canopyCenter.y - 10} phase={2.1} orbitR={25} progress={butterflyLoop} />
          </Group>
        )}

        {/* Orb */}
        <OrbElement
          baseX={treeData.trunkBase.x}
          startY={height + 15}
          endY={treeData.trunkBase.y}
          progress={orbProgress}
          opacity={orbOpacity}
        />

        {/* Particles on absorption */}
        {PARTICLE_ANGLES.map((angle, i) => (
          <Particle key={`p-${i}`} angle={angle} baseCx={treeData.trunkBase.x} baseCy={treeData.trunkBase.y} progress={particleProgress} opacity={particleOpacity} />
        ))}

        {/* ── Creatures (always mounted, opacity-gated by stage) ── */}
        {treeData.creatures.squirrel && (
          <Squirrel x={treeData.creatures.squirrel.x} y={treeData.creatures.squirrel.y} visible={squirrelVis} tailWag={squirrelTail} entranceY={squirrelEntrance} />
        )}
        {treeData.creatures.nest && (
          <BirdNest x={treeData.creatures.nest.x} y={treeData.creatures.nest.y} visible={nestVis} eggRock={nestRock} />
        )}
        {treeData.creatures.owl && (
          <Owl x={treeData.creatures.owl.x} y={treeData.creatures.owl.y} visible={owlVis} blink={owlBlink} entranceY={owlEntrance} />
        )}
        <Deer x={treeData.creatures.deer.x} y={treeData.creatures.deer.y} visible={deerVis} headBob={deerBob} entranceX={deerEntrance} />
        <Wisps centers={treeData.creatures.wispCenters} drift={wispDrift} visible={wispsVis} />
        <PhoenixBird
          centerX={treeData.canopyCenter.x}
          centerY={treeData.canopyCenter.y}
          orbitRx={50}
          orbitRy={25}
          orbit={phoenixOrbit}
          visible={phoenixVis}
        />

        {/* ── Progress bars ── */}
        <ProgressBars width={width} fastProgress={fastBarProgress} slowProgress={slowBarProgress} />
      </Canvas>
    </View>
  );
}

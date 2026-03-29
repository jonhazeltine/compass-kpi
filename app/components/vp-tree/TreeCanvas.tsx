/**
 * TreeCanvas — Skia rendering layer for the standalone VP Tree screen.
 *
 * Receives tree data + Reanimated shared values, renders everything.
 * No state management — purely a renderer.
 *
 * Stage component unlocks match VPTreeInline:
 *   0 — bare stick
 *   1 — soil sparkles
 *   2 — fireflies
 *   3 — roots + falling leaves
 *   4 — sun rays + ground flora + bird
 *   5 — aurora, blossoms, crown, butterflies, rune veins, stars, bloom
 */
import React, { useEffect, useMemo } from 'react';
import {
  Canvas,
  Circle,
  Path,
  Rect,
  Group,
  LinearGradient,
  BlurMask,
  Line,
  vec,
  Skia,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import {
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import type { TreeData } from './treeGen';
import type { GrowthStage } from './constants';
import { VP_STAGES, TREE_COLORS } from './constants';
import { Squirrel } from './creatures/Squirrel';
import { BirdNest } from './creatures/BirdNest';
import { Owl } from './creatures/Owl';
import { Deer } from './creatures/Deer';
import { Wisps } from './creatures/Wisps';
import { PhoenixBird } from './creatures/PhoenixBird';
import { ProgressBars } from '../shared/ProgressBars';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TreeCanvasProps {
  width: number;
  height: number;
  treeData: TreeData;
  stage: GrowthStage;

  // Shared values driven by VPTreeScreen
  decayProgress: SharedValue<number>;
  orbProgress: SharedValue<number>;
  orbOpacity: SharedValue<number>;
  trunkGlowOpacity: SharedValue<number>;
  rustleOffsetX: SharedValue<number>;
  rustleOffsetY: SharedValue<number>;
  newLeafScale: SharedValue<number>;
  newLeafIndex: number;
  flowerScale: SharedValue<number>;
  flowerIndex: number;
  butterflyProgress: SharedValue<number>;
  particleProgress: SharedValue<number>;
  particleOpacity: SharedValue<number>;
  tierFlashOpacity: SharedValue<number>;
  tierScale: SharedValue<number>;
  /** Optional zoom transform — wraps entire scene when provided */
  zoomTransform?: SharedValue<any>;
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function OrbElement({
  baseX, startY, endY, progress, opacity,
}: {
  baseX: number; startY: number; endY: number;
  progress: SharedValue<number>; opacity: SharedValue<number>;
}) {
  const cx = useDerivedValue(() => baseX + Math.sin(progress.value * Math.PI * 4) * 8);
  const cy = useDerivedValue(() => startY + (endY - startY) * progress.value);
  const r = useDerivedValue(() => 12 + Math.sin(progress.value * Math.PI * 6) * 2);
  const innerR = useDerivedValue(() => (12 + Math.sin(progress.value * Math.PI * 6) * 2) * 0.5);
  return (
    <Group opacity={opacity}>
      <Circle cx={cx} cy={cy} r={r} color={TREE_COLORS.orbGlow}><BlurMask blur={12} style="normal" /></Circle>
      <Circle cx={cx} cy={cy} r={r} color={TREE_COLORS.orbCore} />
      <Circle cx={cx} cy={cy} r={innerR} color={TREE_COLORS.orbGold} />
    </Group>
  );
}

function ParticleElement({
  angle, baseCx, baseCy, progress, opacity,
}: {
  angle: number; baseCx: number; baseCy: number;
  progress: SharedValue<number>; opacity: SharedValue<number>;
}) {
  const cx = useDerivedValue(() => baseCx + Math.cos(angle) * progress.value * 45);
  const cy = useDerivedValue(() => baseCy + Math.sin(angle) * progress.value * 45 - progress.value * 20);
  const r = useDerivedValue(() => 2.5 * (1 - progress.value * 0.6));
  return <Circle cx={cx} cy={cy} r={r} color={TREE_COLORS.particle} opacity={opacity} />;
}

function ButterflyElement({
  canvasWidth, canopyY, progress,
}: {
  canvasWidth: number; canopyY: number; progress: SharedValue<number>;
}) {
  const bodyX = useDerivedValue(() => canvasWidth * 0.1 + progress.value * canvasWidth * 0.8);
  const bodyY = useDerivedValue(() => canopyY + Math.sin(progress.value * Math.PI * 3) * 25);
  const leftX = useDerivedValue(() => bodyX.value - 5);
  const rightX = useDerivedValue(() => bodyX.value + 5);
  const wingY = useDerivedValue(() => bodyY.value - Math.abs(Math.sin(progress.value * Math.PI * 16)) * 5);
  const vis = useDerivedValue(() => (progress.value > 0.01 && progress.value < 0.99 ? 1 : 0));
  return (
    <Group opacity={vis}>
      <Circle cx={leftX} cy={wingY} r={4} color={TREE_COLORS.butterfly} />
      <Circle cx={rightX} cy={wingY} r={4} color={TREE_COLORS.butterfly} />
      <Circle cx={bodyX} cy={bodyY} r={1.5} color="#4A148C" />
    </Group>
  );
}

function SoilSparkle({
  baseX, y, offset, shimmer,
}: {
  baseX: number; y: number; offset: number; shimmer: SharedValue<number>;
}) {
  const op = useDerivedValue(() => 0.3 + Math.sin(shimmer.value * Math.PI * 2 + offset) * 0.5);
  const r = useDerivedValue(() => 1.5 + Math.sin(shimmer.value * Math.PI * 2 + offset + 1) * 0.8);
  return (
    <Group>
      <Circle cx={baseX} cy={y} r={r} color={TREE_COLORS.sparkle} opacity={op} />
      <Circle cx={baseX} cy={y} r={useDerivedValue(() => r.value * 2)} color={TREE_COLORS.sparkleGlow} opacity={useDerivedValue(() => op.value * 0.4)}>
        <BlurMask blur={4} style="normal" />
      </Circle>
    </Group>
  );
}

function Firefly({
  cx: baseCx, cy: baseCy, phase, drift,
}: {
  cx: number; cy: number; phase: number; drift: SharedValue<number>;
}) {
  const x = useDerivedValue(() => baseCx + Math.sin(drift.value * Math.PI * 2 + phase) * 22);
  const y = useDerivedValue(() => baseCy + Math.cos(drift.value * Math.PI * 2 + phase * 1.3) * 15);
  const op = useDerivedValue(() => 0.4 + Math.sin(drift.value * Math.PI * 4 + phase) * 0.4);
  return (
    <Group>
      <Circle cx={x} cy={y} r={6} color={TREE_COLORS.fireflyGlow} opacity={op}><BlurMask blur={8} style="normal" /></Circle>
      <Circle cx={x} cy={y} r={2} color={TREE_COLORS.fireflyCore} opacity={op} />
    </Group>
  );
}

function FallingLeaf({
  startX, startY, groundY, progress, leafOp,
}: {
  startX: number; startY: number; groundY: number;
  progress: SharedValue<number>; leafOp: SharedValue<number>;
}) {
  const x = useDerivedValue(() => startX + Math.sin(progress.value * Math.PI * 2) * 20);
  const y = useDerivedValue(() => startY + (groundY - startY) * progress.value);
  return <Circle cx={x} cy={y} r={3} color={TREE_COLORS.leaf} opacity={leafOp} />;
}

function FloatingBlossom({
  startX, startY, phase, drift,
}: {
  startX: number; startY: number; phase: number; drift: SharedValue<number>;
}) {
  const x = useDerivedValue(() => startX + Math.sin(drift.value * Math.PI * 2 + phase) * 30);
  const y = useDerivedValue(() => startY - drift.value * 50 + Math.sin(drift.value * Math.PI * 3 + phase) * 10);
  const op = useDerivedValue(() => {
    const t = (drift.value + phase / (Math.PI * 2)) % 1;
    return t < 0.1 ? t * 10 : t > 0.8 ? (1 - t) * 5 : 1;
  });
  const r = useDerivedValue(() => 2.5 + Math.sin(drift.value * Math.PI * 5 + phase) * 1);
  const color = phase % 2 < 1 ? TREE_COLORS.blossomPink : TREE_COLORS.blossomWhite;
  return <Circle cx={x} cy={y} r={r} color={color} opacity={op} />;
}

function StarTwinkle({
  cx: sx, cy: sy, phase, twinkle,
}: {
  cx: number; cy: number; phase: number; twinkle: SharedValue<number>;
}) {
  const op = useDerivedValue(() => 0.2 + Math.sin(twinkle.value * Math.PI * 2 + phase) * 0.6);
  const r = useDerivedValue(() => 1 + Math.sin(twinkle.value * Math.PI * 3 + phase) * 0.5);
  return <Circle cx={sx} cy={sy} r={r} color={TREE_COLORS.starBright} opacity={op} />;
}

function ButterflyOrbit({
  centerX, centerY, phase, orbitR, progress,
}: {
  centerX: number; centerY: number; phase: number; orbitR: number;
  progress: SharedValue<number>;
}) {
  const bodyX = useDerivedValue(() => centerX + Math.sin(progress.value * Math.PI * 2 + phase) * orbitR);
  const bodyY = useDerivedValue(() => centerY + Math.sin(progress.value * Math.PI * 4 + phase) * orbitR * 0.5);
  const wingOff = useDerivedValue(() => Math.abs(Math.sin(progress.value * Math.PI * 16 + phase)) * 5);
  const leftX = useDerivedValue(() => bodyX.value - wingOff.value);
  const rightX = useDerivedValue(() => bodyX.value + wingOff.value);
  const wingY = useDerivedValue(() => bodyY.value - 2);
  return (
    <Group>
      <Circle cx={leftX} cy={wingY} r={4} color={TREE_COLORS.butterfly} />
      <Circle cx={rightX} cy={wingY} r={4} color={TREE_COLORS.butterfly} />
      <Circle cx={bodyX} cy={bodyY} r={1.5} color="#4A148C" />
    </Group>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PARTICLE_ANGLES = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);
const SPARKLE_OFFSETS = [-35, -24, -14, -5, 5, 14, 24, 35];
const FIREFLY_SEEDS = [
  { dx: -40, dy: -15, phase: 0 },
  { dx: 20, dy: -35, phase: 2.1 },
  { dx: 35, dy: 8, phase: 4.2 },
  { dx: -15, dy: 20, phase: 1.0 },
];
const STAR_SEEDS = Array.from({ length: 15 }, (_, i) => ({
  xFrac: 0.05 + (i * 0.0787) % 0.9,
  yFrac: 0.03 + ((i * 0.137 + 0.1) % 0.35),
  phase: i * 1.3,
}));
const BLOSSOM_SEEDS = Array.from({ length: 10 }, (_, i) => ({
  dxFrac: (i / 10 - 0.5) * 0.7,
  phase: i * 0.78,
}));

// ── Main TreeCanvas ────────────────────────────────────────────────────────────

export function TreeCanvas({
  width,
  height,
  treeData,
  stage,
  decayProgress,
  orbProgress,
  orbOpacity,
  trunkGlowOpacity,
  rustleOffsetX,
  rustleOffsetY,
  newLeafScale,
  newLeafIndex,
  flowerScale,
  flowerIndex,
  butterflyProgress,
  particleProgress,
  particleOpacity,
  tierFlashOpacity,
  tierScale,
  zoomTransform,
}: TreeCanvasProps) {
  const groundY = height * 0.85;
  const stageConfig = VP_STAGES[stage];

  // ── Ambient animation shared values ──────────────────────────────────────────
  const shimmer = useSharedValue(0);
  const fireflyDrift = useSharedValue(0);
  const fallingLeafProgress = useSharedValue(0);
  const fallingLeafOp = useSharedValue(0);
  const blossomDrift = useSharedValue(0);
  const starTwinkle = useSharedValue(0);
  const butterflyLoop = useSharedValue(0);
  const auroraShift = useSharedValue(0);
  const runePulse = useSharedValue(0);
  const sunRayPulse = useSharedValue(0);
  const crownPulse = useSharedValue(0);

  // Creature ambient
  const squirrelTail = useSharedValue(0);
  const nestRock = useSharedValue(0);
  const owlBlink = useSharedValue(0);
  const deerBob = useSharedValue(0);
  const wispDrift = useSharedValue(0);
  const phoenixOrbit = useSharedValue(0);
  const squirrelVis = useDerivedValue((): number => stageConfig.hasSquirrel ? 1 : 0);
  const nestVis = useDerivedValue((): number => stageConfig.hasNest ? 1 : 0);
  const owlVis = useDerivedValue((): number => stageConfig.hasOwl ? 1 : 0);
  const deerVis = useDerivedValue((): number => stageConfig.hasDeer ? 1 : 0);
  const wispsVis = useDerivedValue((): number => stageConfig.hasWisps ? 1 : 0);
  const phoenixVis = useDerivedValue((): number => stageConfig.hasPhoenix ? 1 : 0);
  const fastBarProgress = useSharedValue(0);
  const slowBarProgress = useSharedValue(0);

  useEffect(() => {
    if (stageConfig.hasSparkles) {
      shimmer.value = 0;
      shimmer.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false);
    }
    if (stageConfig.hasFireflies) {
      fireflyDrift.value = 0;
      fireflyDrift.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    }
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
    if (stageConfig.hasSunRays) {
      sunRayPulse.value = 0;
      sunRayPulse.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
    }
  }, [stage]);

  useEffect(() => {
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
    // Creature loops
    if (stageConfig.hasSquirrel) { squirrelTail.value = 0; squirrelTail.value = withRepeat(withTiming(1, { duration: 2500, easing: Easing.linear }), -1, false); }
    if (stageConfig.hasNest) { nestRock.value = 0; nestRock.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false); }
    if (stageConfig.hasOwl) { owlBlink.value = 0; owlBlink.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false); }
    if (stageConfig.hasDeer) { deerBob.value = 0; deerBob.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false); }
    if (stageConfig.hasWisps) { wispDrift.value = 0; wispDrift.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false); }
    if (stageConfig.hasPhoenix) { phoenixOrbit.value = 0; phoenixOrbit.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false); }
  }, [stage]);

  // ── Pre-computed Skia paths ──────────────────────────────────────────────────

  const branchGroups = useMemo(() => {
    const groups: { path: ReturnType<typeof Skia.Path.Make>; thickness: number }[] = [];
    const byDepth = new Map<number, typeof treeData.branches>();
    for (const b of treeData.branches) {
      const arr = byDepth.get(b.depth) ?? [];
      arr.push(b);
      byDepth.set(b.depth, arr);
    }
    for (const [, branches] of byDepth) {
      const p = Skia.Path.Make();
      for (const b of branches) { p.moveTo(b.x1, b.y1); p.quadTo(b.cx, b.cy, b.x2, b.y2); }
      groups.push({ path: p, thickness: branches[0].thickness });
    }
    return groups;
  }, [treeData]);

  const glowGroups = useMemo(() => branchGroups.filter((_, i) => i <= 1), [branchGroups]);

  const leafPath = useMemo(() => {
    const p = Skia.Path.Make();
    treeData.leaves.forEach((l, i) => { if (i !== newLeafIndex) p.addCircle(l.x, l.y, l.size); });
    return p;
  }, [treeData, newLeafIndex]);

  const decayLeafPath = useMemo(() => {
    const p = Skia.Path.Make();
    for (const l of treeData.leaves) p.addCircle(l.x, l.y, l.size);
    return p;
  }, [treeData]);

  const rootPath = useMemo(() => {
    const p = Skia.Path.Make();
    for (const r of treeData.roots) { p.moveTo(r.x1, r.y1); p.quadTo(r.cx, r.cy, r.x2, r.y2); }
    return p;
  }, [treeData]);

  const runeVeinPath = useMemo(() => {
    const p = Skia.Path.Make();
    const trunkBranches = treeData.branches.filter(b => b.depth <= 1);
    for (const b of trunkBranches) {
      p.moveTo(b.x1 + 2, b.y1); p.quadTo(b.cx + 2, b.cy, b.x2 + 2, b.y2);
      p.moveTo(b.x1 - 2, b.y1); p.quadTo(b.cx - 2, b.cy, b.x2 - 2, b.y2);
    }
    return p;
  }, [treeData]);

  const sunRays = useMemo(() => {
    if (stage < 4) return [];
    const cx = treeData.canopyCenter.x;
    const cy = treeData.canopyCenter.y - 20;
    return Array.from({ length: 6 }, (_, i) => {
      const angle = -Math.PI * 0.7 + (i / 5) * Math.PI * 0.4;
      return {
        x1: cx + Math.cos(angle) * 25, y1: cy + Math.sin(angle) * 25,
        x2: cx + Math.cos(angle) * 100, y2: cy + Math.sin(angle) * 100,
      };
    });
  }, [stage, treeData]);

  const birdPath = useMemo(() => {
    const p = Skia.Path.Make();
    if (stage < 4 || treeData.branches.length < 5) return p;
    const branch = treeData.branches[Math.min(4, treeData.branches.length - 1)];
    const bx = branch.x2;
    const by = branch.y2;
    p.moveTo(bx - 6, by - 2); p.lineTo(bx - 1, by - 7); p.lineTo(bx, by - 5);
    p.lineTo(bx + 1, by - 7); p.lineTo(bx + 6, by - 2);
    return p;
  }, [stage, treeData]);

  // ── Derived transforms ───────────────────────────────────────────────────────

  const treeTransform = useDerivedValue(() => [{ scale: tierScale.value * treeData.fitScale }]);
  const rustleTransform = useDerivedValue(() => [
    { translateX: rustleOffsetX.value }, { translateY: rustleOffsetY.value },
  ]);

  const auroraOp1 = useDerivedValue(() => 0.08 + Math.sin(auroraShift.value * Math.PI * 2) * 0.06);
  const auroraOp2 = useDerivedValue(() => 0.06 + Math.sin(auroraShift.value * Math.PI * 2 + 2) * 0.05);
  const auroraOp3 = useDerivedValue(() => 0.05 + Math.sin(auroraShift.value * Math.PI * 2 + 4) * 0.04);
  const runeOp = useDerivedValue(() => 0.3 + Math.sin(runePulse.value * Math.PI * 2) * 0.4);
  const sunOp = useDerivedValue(() => 0.12 + Math.sin(sunRayPulse.value * Math.PI * 2) * 0.06);
  const crownOp = useDerivedValue(() => 0.4 + Math.sin(crownPulse.value * Math.PI * 2) * 0.25);
  const crownR = useDerivedValue(() => 45 + Math.sin(crownPulse.value * Math.PI * 2) * 8);
  const crownInnerR = useDerivedValue(() => crownR.value * 0.7);
  const crownInnerOp = useDerivedValue(() => crownOp.value * 0.5);
  const runeGlowOp = useDerivedValue(() => runeOp.value * 0.5);
  const flowerCenterR = useDerivedValue(() => flowerScale.value * 0.4);

  // ── Render ───────────────────────────────────────────────────────────────────

  const newLeaf = newLeafIndex >= 0 && newLeafIndex < treeData.leaves.length ? treeData.leaves[newLeafIndex] : null;
  const flowerLeaf = flowerIndex >= 0 && flowerIndex < treeData.leaves.length ? treeData.leaves[flowerIndex] : null;
  const fallingLeafX = treeData.canopyCenter.x + 10;
  const fallingLeafStartY = treeData.canopyCenter.y;

  return (
    <Canvas style={{ width, height }}>
      {/* Zoom wrapper — scales entire scene when zoom is active */}
      <Group transform={zoomTransform ?? [{ scale: 1 }]}>
      {/* Sky */}
      <Rect x={0} y={0} width={width} height={groundY}>
        <LinearGradient start={vec(0, 0)} end={vec(0, groundY)} colors={[TREE_COLORS.skyTop, TREE_COLORS.skyBottom]} />
      </Rect>
      <Rect x={0} y={0} width={width} height={groundY} color={TREE_COLORS.skyDecayTop} opacity={decayProgress} />

      {/* Stage 5 — Stars */}
      {stageConfig.hasStars && STAR_SEEDS.map((s, i) => (
        <StarTwinkle key={`star-${i}`} cx={s.xFrac * width} cy={s.yFrac * height} phase={s.phase} twinkle={starTwinkle} />
      ))}

      {/* Stage 5 — Aurora */}
      {stageConfig.hasAurora && (
        <Group>
          <Rect x={0} y={height * 0.02} width={width} height={height * 0.25} color={TREE_COLORS.auroraTop} opacity={auroraOp1}><BlurMask blur={30} style="normal" /></Rect>
          <Rect x={width * 0.1} y={height * 0.1} width={width * 0.8} height={height * 0.2} color={TREE_COLORS.auroraMid} opacity={auroraOp2}><BlurMask blur={25} style="normal" /></Rect>
          <Rect x={width * 0.15} y={height * 0.18} width={width * 0.7} height={height * 0.15} color={TREE_COLORS.auroraBottom} opacity={auroraOp3}><BlurMask blur={20} style="normal" /></Rect>
        </Group>
      )}

      {/* Stage 4+ — Sun rays */}
      {stageConfig.hasSunRays && sunRays.map((ray, i) => (
        <Line key={`ray-${i}`} p1={vec(ray.x1, ray.y1)} p2={vec(ray.x2, ray.y2)}
          color={TREE_COLORS.sunRay} style="stroke" strokeWidth={10 + i * 3} opacity={sunOp}>
          <BlurMask blur={14} style="normal" />
        </Line>
      ))}

      {/* Ground */}
      <Rect x={0} y={groundY} width={width} height={height - groundY} color={TREE_COLORS.grass} />
      <Rect x={0} y={groundY} width={width} height={height - groundY} color={TREE_COLORS.grassDecay} opacity={decayProgress} />
      <Rect x={0} y={groundY} width={width} height={3} color={TREE_COLORS.ground} />

      {/* Stage 3+ — Roots */}
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
        <SoilSparkle key={`sp-${i}`} baseX={treeData.trunkBase.x + off} y={groundY + 5 + (i % 3) * 4} offset={i * 0.8} shimmer={shimmer} />
      ))}

      {/* Bloom glow (stage 5) */}
      {stageConfig.hasBloom && (
        <Circle cx={treeData.canopyCenter.x} cy={treeData.canopyCenter.y} r={80} color={TREE_COLORS.bloomGlow}>
          <BlurMask blur={40} style="normal" />
        </Circle>
      )}

      {/* Stage 5 — Crown / halo */}
      {stageConfig.hasCrown && (
        <Group>
          <Circle cx={treeData.canopyCenter.x} cy={treeData.canopyCenter.y - 35} r={crownR} color={TREE_COLORS.crownGlow} opacity={crownOp}>
            <BlurMask blur={20} style="normal" />
          </Circle>
          <Circle cx={treeData.canopyCenter.x} cy={treeData.canopyCenter.y - 35} r={crownInnerR} color={TREE_COLORS.crownGold} opacity={crownInnerOp}>
            <BlurMask blur={12} style="normal" />
          </Circle>
        </Group>
      )}

      {/* Tree group (with tier scale) */}
      <Group transform={treeTransform} origin={vec(treeData.trunkBase.x, treeData.trunkBase.y)}>
        {/* Branches */}
        {branchGroups.map((g, i) => (
          <Path key={`b-${i}`} path={g.path} style="stroke" strokeWidth={g.thickness} color={TREE_COLORS.trunk} strokeCap="round" />
        ))}
        {branchGroups.map((g, i) => (
          <Path key={`bd-${i}`} path={g.path} style="stroke" strokeWidth={g.thickness} color={TREE_COLORS.trunkDecay} strokeCap="round" opacity={decayProgress} />
        ))}

        {/* Stage 5 — Rune veins */}
        {stageConfig.hasRuneVeins && (
          <Group>
            <Path path={runeVeinPath} style="stroke" strokeWidth={2} color={TREE_COLORS.runeVein} strokeCap="round" opacity={runeOp} />
            <Path path={runeVeinPath} style="stroke" strokeWidth={4} color={TREE_COLORS.runeGlow} strokeCap="round" opacity={runeGlowOp}>
              <BlurMask blur={5} style="normal" />
            </Path>
          </Group>
        )}

        {/* Trunk glow overlay */}
        {glowGroups.map((g, i) => (
          <Path key={`glow-${i}`} path={g.path} style="stroke" strokeWidth={g.thickness + 3} color={TREE_COLORS.trunkGlow} strokeCap="round" opacity={trunkGlowOpacity}>
            <BlurMask blur={6} style="normal" />
          </Path>
        ))}

        {/* Leaves with rustle offset */}
        <Group transform={rustleTransform}>
          <Path path={leafPath} color={TREE_COLORS.leaf} />
          {newLeaf && <Circle cx={newLeaf.x} cy={newLeaf.y} r={newLeafScale} color={TREE_COLORS.leafLight} />}
        </Group>

        {/* Leaf decay overlay */}
        <Path path={decayLeafPath} color={TREE_COLORS.leafDecay} opacity={decayProgress} />

        {/* Flower bud (micro-step) */}
        {flowerLeaf && (
          <>
            <Circle cx={flowerLeaf.x} cy={flowerLeaf.y - 5} r={flowerScale} color={TREE_COLORS.flower} />
            <Circle cx={flowerLeaf.x} cy={flowerLeaf.y - 5} r={flowerCenterR} color={TREE_COLORS.flowerCenter} />
          </>
        )}

        {/* Bird (stage 4+) */}
        {stage >= 4 && (
          <Path path={birdPath} style="stroke" strokeWidth={2} color={TREE_COLORS.bird} strokeCap="round" />
        )}
      </Group>

      {/* Stage 2+ — Fireflies */}
      {stageConfig.hasFireflies && FIREFLY_SEEDS.map((f, i) => (
        <Firefly key={`ff-${i}`} cx={treeData.canopyCenter.x + f.dx} cy={treeData.canopyCenter.y + f.dy} phase={f.phase} drift={fireflyDrift} />
      ))}

      {/* Stage 3+ — Falling leaf */}
      {stageConfig.hasFallingLeaves && (
        <FallingLeaf startX={fallingLeafX} startY={fallingLeafStartY} groundY={groundY} progress={fallingLeafProgress} leafOp={fallingLeafOp} />
      )}

      {/* Stage 5 — Floating blossoms */}
      {stageConfig.hasBlossoms && BLOSSOM_SEEDS.map((b, i) => (
        <FloatingBlossom key={`bl-${i}`} startX={treeData.canopyCenter.x + b.dxFrac * width} startY={treeData.canopyCenter.y + 10} phase={b.phase} drift={blossomDrift} />
      ))}

      {/* Stage 5 — Butterflies (ambient orbit) */}
      {stageConfig.hasButterflies && (
        <Group>
          <ButterflyOrbit centerX={treeData.canopyCenter.x} centerY={treeData.canopyCenter.y} phase={0} orbitR={45} progress={butterflyLoop} />
          <ButterflyOrbit centerX={treeData.canopyCenter.x + 20} centerY={treeData.canopyCenter.y - 15} phase={2.1} orbitR={30} progress={butterflyLoop} />
        </Group>
      )}

      {/* Butterfly (micro-step, driven by VPTreeScreen) */}
      <ButterflyElement canvasWidth={width} canopyY={treeData.canopyCenter.y} progress={butterflyProgress} />

      {/* Orb */}
      <OrbElement baseX={treeData.trunkBase.x} startY={height + 20} endY={treeData.trunkBase.y} progress={orbProgress} opacity={orbOpacity} />

      {/* Particles (on absorption) */}
      {PARTICLE_ANGLES.map((angle, i) => (
        <ParticleElement key={`p-${i}`} angle={angle} baseCx={treeData.trunkBase.x} baseCy={treeData.trunkBase.y} progress={particleProgress} opacity={particleOpacity} />
      ))}

      {/* ── Creatures ── */}
      {treeData.creatures.squirrel && (
        <Squirrel x={treeData.creatures.squirrel.x} y={treeData.creatures.squirrel.y} visible={squirrelVis} tailWag={squirrelTail} />
      )}
      {treeData.creatures.nest && (
        <BirdNest x={treeData.creatures.nest.x} y={treeData.creatures.nest.y} visible={nestVis} eggRock={nestRock} />
      )}
      {treeData.creatures.owl && (
        <Owl x={treeData.creatures.owl.x} y={treeData.creatures.owl.y} visible={owlVis} blink={owlBlink} />
      )}
      <Deer x={treeData.creatures.deer.x} y={treeData.creatures.deer.y} visible={deerVis} headBob={deerBob} />
      <Wisps centers={treeData.creatures.wispCenters} drift={wispDrift} visible={wispsVis} />
      <PhoenixBird centerX={treeData.canopyCenter.x} centerY={treeData.canopyCenter.y} orbitRx={60} orbitRy={30} orbit={phoenixOrbit} visible={phoenixVis} />

      </Group>{/* end zoom wrapper */}

      {/* Progress bars (outside zoom — always visible at top) */}
      <ProgressBars width={width} fastProgress={fastBarProgress} slowProgress={slowBarProgress} />

      {/* Tier flash */}
      <Rect x={0} y={0} width={width} height={height} color="white" opacity={tierFlashOpacity} />
    </Canvas>
  );
}

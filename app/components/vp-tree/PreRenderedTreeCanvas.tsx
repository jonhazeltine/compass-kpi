/**
 * PreRenderedTreeCanvas — Pre-rendered image + Skia effects compositor.
 *
 * Renders a base tree image (per-stage) with layered Skia effects on top:
 *   - Atmospheric glow / bloom around canopy
 *   - Floating particle systems (orbs, sparkles, fireflies)
 *   - Pulse burst reaction on KPI log
 *   - Decay desaturation via ColorMatrix
 *   - Stage crossfade transitions
 *
 * Drop-in replacement for TreeCanvas — same shared-value interface.
 *
 * IMAGE SETUP:
 *   Place stage PNGs in app/assets/vp-tree/:
 *     stage_0.png, stage_1.png, ... stage_5.png
 *   Until real assets exist, the component renders beautiful gradient
 *   silhouette trees as placeholders.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { TreeReveal } from './TreeReveal';
import {
  Canvas,
  Circle,
  Group,
  Rect,
  Path,
  LinearGradient,
  BlurMask,
  vec,
  Skia,
  ColorMatrix,
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
import type { GrowthStage } from './constants';
import { VP_STAGES } from './constants';

// ── Stage images ──────────────────────────────────────────────────────────────
const STAGE_IMAGES = [
  require('../../assets/vp-tree/stage_0.png'),
  require('../../assets/vp-tree/stage_1.png'),
  require('../../assets/vp-tree/stage_2.png'),
  require('../../assets/vp-tree/stage_3.png'),
  require('../../assets/vp-tree/stage_4.png'),
  require('../../assets/vp-tree/stage_5.png'),
  require('../../assets/vp-tree/stage_6.png'),
  require('../../assets/vp-tree/stage_7.png'),
  require('../../assets/vp-tree/stage_8.png'),
  require('../../assets/vp-tree/stage_9.png'),
];

// ── Stage color palettes ──────────────────────────────────────────────────────

const STAGE_PALETTES = [
  // 0 — Dormant: grey-brown, bare
  { sky: ['#2a2a3d', '#1a1a2e'], ground: '#2d2418', trunk: '#4a3728', canopy: '#3a4a3a', canopyLight: '#4a5a4a', accent: '#5a6a5a', glow: 'rgba(90,106,90,0.0)' },
  // 1 — Sapling: first greens, dawn sky
  { sky: ['#3d4a6b', '#1e2d4f'], ground: '#2e3218', trunk: '#5d4037', canopy: '#4a7a3a', canopyLight: '#6a9a4a', accent: '#8BC34A', glow: 'rgba(139,195,74,0.15)' },
  // 2 — Growing: warm greens, firefly gold
  { sky: ['#1a2744', '#0f1a33'], ground: '#2a3015', trunk: '#5d4037', canopy: '#4a9e4a', canopyLight: '#6abb5a', accent: '#FFD54F', glow: 'rgba(255,213,79,0.2)' },
  // 3 — Full Canopy: rich forest, deep sky
  { sky: ['#1a2744', '#0a1225'], ground: '#1e2810', trunk: '#5d4037', canopy: '#3d8e3d', canopyLight: '#5aaa4a', accent: '#66BB6A', glow: 'rgba(102,187,106,0.25)' },
  // 4 — Mature: golden hour, lush
  { sky: ['#2a1a44', '#1a0f33'], ground: '#1a2510', trunk: '#795548', canopy: '#4a8e3a', canopyLight: '#5eaa3e', accent: '#FFB74D', glow: 'rgba(255,183,77,0.3)' },
  // 5 — Ancient: mystical purple, bloom
  { sky: ['#1a0a33', '#0a0518'], ground: '#150f20', trunk: '#8D6E63', canopy: '#1a5a3a', canopyLight: '#2a7a4a', accent: '#CE93D8', glow: 'rgba(206,147,216,0.35)' },
] as const;

// ── Silhouette tree paths (per stage) ──────────────────────────────────────────

function buildTreeSilhouette(stage: GrowthStage, w: number, h: number) {
  const cx = w / 2;
  const groundY = h * 0.88;
  const config = VP_STAGES[stage];
  const scale = 0.6 + stage * 0.08;

  // Trunk
  const trunkW = (8 + stage * 4) * scale;
  const trunkH = (h * 0.18 + stage * h * 0.04) * scale;
  const trunkTop = groundY - trunkH;

  const trunkPath = Skia.Path.Make();
  // Tapered trunk
  trunkPath.moveTo(cx - trunkW * 0.6, groundY);
  trunkPath.lineTo(cx - trunkW * 0.35, trunkTop + trunkH * 0.15);
  trunkPath.lineTo(cx - trunkW * 0.25, trunkTop);
  trunkPath.lineTo(cx + trunkW * 0.25, trunkTop);
  trunkPath.lineTo(cx + trunkW * 0.35, trunkTop + trunkH * 0.15);
  trunkPath.lineTo(cx + trunkW * 0.6, groundY);
  trunkPath.close();

  // Canopy — built as separate paths to avoid even-odd fill cancellation
  const canopyPaths: ReturnType<typeof Skia.Path.Make>[] = [];
  let canopyW = 0;
  let canopyH = 0;
  let canopyY = trunkTop;

  if (stage === 0) {
    const bud = Skia.Path.Make();
    bud.addOval({ x: cx - 12, y: trunkTop - 8, width: 24, height: 16 });
    canopyPaths.push(bud);
  } else {
    canopyW = (50 + stage * 30) * scale;
    canopyH = (40 + stage * 25) * scale;
    canopyY = trunkTop - canopyH * 0.6;

    // Main ellipse
    const main = Skia.Path.Make();
    main.addOval({ x: cx - canopyW / 2, y: canopyY, width: canopyW, height: canopyH });
    canopyPaths.push(main);

    // Side lobes for fullness (stages 2+)
    if (stage >= 2) {
      const lobeW = canopyW * 0.55;
      const lobeH = canopyH * 0.7;
      const leftLobe = Skia.Path.Make();
      leftLobe.addOval({ x: cx - canopyW * 0.55, y: canopyY + canopyH * 0.15, width: lobeW, height: lobeH });
      canopyPaths.push(leftLobe);
      const rightLobe = Skia.Path.Make();
      rightLobe.addOval({ x: cx + canopyW * 0.55 - lobeW, y: canopyY + canopyH * 0.15, width: lobeW, height: lobeH });
      canopyPaths.push(rightLobe);
    }

    // Extra top crown (stages 4+)
    if (stage >= 4) {
      const crown = Skia.Path.Make();
      crown.addOval({ x: cx - canopyW * 0.3, y: canopyY - canopyH * 0.2, width: canopyW * 0.6, height: canopyH * 0.5 });
      canopyPaths.push(crown);
    }
  }

  // Legacy single-path reference for edge glow stroke
  const canopyPath = Skia.Path.Make();
  if (stage === 0) {
    canopyPath.addOval({ x: cx - 12, y: trunkTop - 8, width: 24, height: 16 });
  } else {
    canopyPath.addOval({ x: cx - canopyW / 2, y: canopyY, width: canopyW, height: canopyH });
  }

  // Roots (stages 3+)
  const rootPaths: ReturnType<typeof Skia.Path.Make>[] = [];
  if (stage >= 3) {
    const numRoots = 3 + stage;
    for (let i = 0; i < numRoots; i++) {
      const rp = Skia.Path.Make();
      const spread = (i / (numRoots - 1) - 0.5) * 2;
      const rootEndX = cx + spread * (60 + stage * 15) * scale;
      const rootEndY = groundY + 8 + Math.abs(spread) * 12;
      const cpX = cx + spread * (30 + stage * 8) * scale;
      const cpY = groundY + 3;
      rp.moveTo(cx + spread * trunkW * 0.4, groundY);
      rp.quadTo(cpX, cpY, rootEndX, rootEndY);
      rootPaths.push(rp);
    }
  }

  // Canopy center for glow/particle positioning
  const canopyCenter = {
    x: cx,
    y: stage === 0 ? trunkTop - 4 : trunkTop - (40 + stage * 25) * scale * 0.3,
  };

  return { trunkPath, canopyPath, canopyPaths, rootPaths, trunkTop, groundY, canopyCenter, trunkW };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PreRenderedTreeCanvasProps {
  width: number;
  height: number;
  stage: GrowthStage;
  /** 0-9 stage index for image-based rendering (overrides stage for image selection) */
  imageStage?: number;
  /** 'bg' = painted backgrounds, 'transparent' = tree only, 'silhouette' = gradient blobs */
  renderMode?: 'bg' | 'transparent' | 'silhouette';

  // Shared values driven by VPTreeScreen
  decayProgress: SharedValue<number>;
  orbProgress: SharedValue<number>;
  orbOpacity: SharedValue<number>;
  trunkGlowOpacity: SharedValue<number>;
  rustleOffsetX: SharedValue<number>;
  rustleOffsetY: SharedValue<number>;
  particleProgress: SharedValue<number>;
  particleOpacity: SharedValue<number>;
  tierFlashOpacity: SharedValue<number>;
  tierScale: SharedValue<number>;
}

// ── Floating particles (ambient) ──────────────────────────────────────────────

// ── Single ambient particle (own component so hooks are safe) ─────────────────

function AmbientParticle({
  cx, cy, spread, color, glowColor, clock,
  offsetAngle, radiusFactor, speedFactor, size, phaseOffset,
}: {
  cx: number; cy: number; spread: number;
  color: string; glowColor: string;
  clock: SharedValue<number>;
  offsetAngle: number; radiusFactor: number; speedFactor: number;
  size: number; phaseOffset: number;
}) {
  const px = useDerivedValue(() => {
    const t = (clock.value + phaseOffset) % 1;
    const angle = offsetAngle + t * Math.PI * 2 * speedFactor;
    const noise = Math.sin(t * Math.PI * 7.3 + offsetAngle * 3) * 10;
    return cx + Math.cos(angle) * spread * radiusFactor + noise;
  });
  const py = useDerivedValue(() => {
    const t = (clock.value + phaseOffset) % 1;
    const angle = offsetAngle + t * Math.PI * 2 * speedFactor;
    const drift = Math.sin(t * Math.PI * 3) * 15;
    const noise = Math.cos(t * Math.PI * 5.7 + offsetAngle * 2) * 8;
    return cy + Math.sin(angle) * spread * radiusFactor * 0.6 + drift + noise;
  });
  const opacity = useDerivedValue(() => {
    const t = (clock.value + phaseOffset) % 1;
    return 0.35 + Math.sin(t * Math.PI * 2) * 0.5;
  });

  return (
    <Group opacity={opacity}>
      <Circle cx={px} cy={py} r={size + 4} color={glowColor}>
        <BlurMask blur={8} style="normal" />
      </Circle>
      <Circle cx={px} cy={py} r={size} color={color} />
    </Group>
  );
}

function AmbientParticles({
  cx, cy, spread, count, color, glowColor, stage,
}: {
  cx: number; cy: number; spread: number; count: number;
  color: string; glowColor: string; stage: GrowthStage;
}) {
  const clock = useSharedValue(0);

  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      offsetAngle: (i / count) * Math.PI * 2,
      radiusFactor: 0.3 + (((i * 7 + 13) % 17) / 17) * 0.7,
      speedFactor: 0.5 + (((i * 11 + 3) % 13) / 13) * 0.5,
      size: 1.5 + (((i * 5 + 7) % 11) / 11) * 2.5,
      phaseOffset: (i * 0.37) % 1,
    })),
    [count],
  );

  return (
    <>
      {particles.map((p, i) => (
        <AmbientParticle
          key={i} cx={cx} cy={cy} spread={spread}
          color={color} glowColor={glowColor} clock={clock}
          {...p}
        />
      ))}
    </>
  );
}

// ── Single firefly (own component so hooks are safe) ──────────────────────────

function Firefly({
  cx, cy, clock,
  baseAngle, radius, blinkPhase, size,
}: {
  cx: number; cy: number; clock: SharedValue<number>;
  baseAngle: number; radius: number; blinkPhase: number; size: number;
}) {
  const fx = useDerivedValue(() => {
    const t = clock.value;
    return cx + Math.cos(baseAngle + t * Math.PI * 1.5) * radius
      + Math.sin(t * Math.PI * 4 + blinkPhase * 10) * 8;
  });
  const fy = useDerivedValue(() => {
    const t = clock.value;
    return cy + Math.sin(baseAngle + t * Math.PI * 1.2) * radius * 0.5
      + Math.cos(t * Math.PI * 3 + blinkPhase * 7) * 6;
  });
  const op = useDerivedValue(() => {
    const t = (clock.value + blinkPhase) % 1;
    const blink = Math.sin(t * Math.PI * 6);
    return blink > 0.3 ? blink : 0;
  });

  return (
    <Group opacity={op}>
      <Circle cx={fx} cy={fy} r={size + 6} color="rgba(255,238,88,0.25)">
        <BlurMask blur={10} style="normal" />
      </Circle>
      <Circle cx={fx} cy={fy} r={size} color="#FFEE58" />
    </Group>
  );
}

function Fireflies({ cx, cy, spread, count }: { cx: number; cy: number; spread: number; count: number }) {
  const clock = useSharedValue(0);

  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const flies = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      baseAngle: (i / count) * Math.PI * 2 + i * 0.7,
      radius: spread * (0.4 + (((i * 13 + 5) % 11) / 11) * 0.6),
      blinkPhase: (i * 0.29) % 1,
      size: 2 + (((i * 7 + 3) % 9) / 9) * 1.5,
    })),
    [count, spread],
  );

  return (
    <>
      {flies.map((f, i) => (
        <Firefly key={i} cx={cx} cy={cy} clock={clock} {...f} />
      ))}
    </>
  );
}

// ── Pulse burst (on KPI log) ──────────────────────────────────────────────────

function BurstParticle({ cx, cy, progress, angle, speed, size, color }: {
  cx: number; cy: number; progress: SharedValue<number>;
  angle: number; speed: number; size: number; color: string;
}) {
  const px = useDerivedValue(() => cx + Math.cos(angle) * progress.value * speed);
  const py = useDerivedValue(() => cy + Math.sin(angle) * progress.value * speed - progress.value * 15);
  const r = useDerivedValue(() => size * (1 - progress.value * 0.7));
  return <Circle cx={px} cy={py} r={r} color={color} />;
}

function PulseBurst({
  cx, cy, progress, opacity, color,
}: {
  cx: number; cy: number;
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
  color: string;
}) {
  const flashR = useDerivedValue(() => 20 + progress.value * 40);
  const BURST_COUNT = 12;
  const particles = useMemo(() =>
    Array.from({ length: BURST_COUNT }, (_, i) => ({
      angle: (i / BURST_COUNT) * Math.PI * 2,
      speed: 35 + (i % 3) * 15,
      size: 2 + (i % 4),
    })),
    [],
  );

  return (
    <Group opacity={opacity}>
      {/* Central flash */}
      <Circle cx={cx} cy={cy} r={flashR} color={color}>
        <BlurMask blur={25} style="normal" />
      </Circle>
      {/* Burst particles */}
      {particles.map((p, i) => (
        <BurstParticle key={i} cx={cx} cy={cy} progress={progress} angle={p.angle} speed={p.speed} size={p.size} color={color} />
      ))}
    </Group>
  );
}

// ── Rising orb (from ground to canopy) ────────────────────────────────────────

function RisingOrb({
  baseX, startY, endY, progress, opacity,
}: {
  baseX: number; startY: number; endY: number;
  progress: SharedValue<number>; opacity: SharedValue<number>;
}) {
  const cx = useDerivedValue(() => baseX + Math.sin(progress.value * Math.PI * 3) * 12);
  const cy = useDerivedValue(() => startY + (endY - startY) * progress.value);
  const r = useDerivedValue(() => 10 + Math.sin(progress.value * Math.PI * 4) * 3);
  const trailOp = useDerivedValue(() => opacity.value * 0.4);

  return (
    <Group opacity={opacity}>
      {/* Trail */}
      <Circle cx={cx} cy={useDerivedValue(() => cy.value + 12)} r={6} color="rgba(102,187,106,0.3)">
        <BlurMask blur={8} style="normal" />
      </Circle>
      {/* Glow */}
      <Circle cx={cx} cy={cy} r={useDerivedValue(() => r.value + 10)} color="rgba(102,187,106,0.25)">
        <BlurMask blur={15} style="normal" />
      </Circle>
      {/* Core */}
      <Circle cx={cx} cy={cy} r={r} color="#66BB6A" />
      {/* Bright center */}
      <Circle cx={cx} cy={cy} r={useDerivedValue(() => r.value * 0.4)} color="#FFD700" />
    </Group>
  );
}

// ── Light rays (stage 4+) ────────────────────────────────────────────────────

function LightRay({ clock, ray, index, cx, topY, width, height }: {
  clock: SharedValue<number>; ray: { angle: number; widthFactor: number; phaseOffset: number };
  index: number; cx: number; topY: number; width: number; height: number;
}) {
  const op = useDerivedValue(() => {
    const t = (clock.value + ray.phaseOffset) % 1;
    return 0.04 + Math.sin(t * Math.PI * 2) * 0.03;
  });
  const rayPath = useMemo(() => {
    const p = Skia.Path.Make();
    const topW = 8 * ray.widthFactor;
    const bottomW = (80 + index * 20) * ray.widthFactor;
    const rayTopY = topY - 20;
    const rayBottomY = topY + height * 0.7;
    const offsetX = cx + ray.angle * width * 0.4;
    p.moveTo(offsetX - topW, rayTopY);
    p.lineTo(offsetX + topW, rayTopY);
    p.lineTo(offsetX + bottomW, rayBottomY);
    p.lineTo(offsetX - bottomW, rayBottomY);
    p.close();
    return p;
  }, [cx, topY, width, height]);

  return (
    <Group opacity={op}>
      <Path path={rayPath} color="rgba(255,236,179,0.5)">
        <BlurMask blur={20} style="normal" />
      </Path>
    </Group>
  );
}

function LightRays({ cx, topY, width, height }: { cx: number; topY: number; width: number; height: number }) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 12000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const rays = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      angle: -0.3 + i * 0.15,
      widthFactor: 0.5 + (i % 3) * 0.3,
      phaseOffset: i * 0.2,
    })),
    [],
  );

  return (
    <>
      {rays.map((ray, i) => (
        <LightRay key={i} clock={clock} ray={ray} index={i} cx={cx} topY={topY} width={width} height={height} />
      ))}
    </>
  );
}

// ── Canopy Shimmer (breathing glow orbs across canopy) ──────────────────────

function ShimmerOrb({ x, y, radius, phase, speed, color, clock }: {
  x: number; y: number; radius: number; phase: number; speed: number;
  color: string; clock: SharedValue<number>;
}) {
  const op = useDerivedValue(() => {
    const t = (clock.value * speed + phase) % 1;
    return 0.08 + Math.sin(t * Math.PI * 2) * 0.14;
  });
  const r = useDerivedValue(() => {
    const t = (clock.value * speed + phase) % 1;
    return radius + Math.sin(t * Math.PI * 2 + 1.5) * radius * 0.3;
  });
  return (
    <Group opacity={op}>
      <Circle cx={x} cy={y} r={r} color={color}>
        <BlurMask blur={radius * 0.7} style="normal" />
      </Circle>
    </Group>
  );
}

function CanopyShimmer({
  cx, cy, width, height, stage, glowColor, accentColor,
}: {
  cx: number; cy: number; width: number; height: number;
  stage: GrowthStage; glowColor: string; accentColor: string;
}) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 5000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const orbs = useMemo(() => {
    const count = 8 + stage * 3;
    const spreadX = width * (0.2 + stage * 0.05);
    const spreadY = height * (0.1 + stage * 0.03);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + i * 0.3;
      const dist = 0.3 + ((i * 17 + 7) % 13) / 13 * 0.7;
      return {
        x: cx + Math.cos(angle) * spreadX * dist,
        y: cy + Math.sin(angle) * spreadY * dist * 0.6 - height * 0.05,
        radius: height * 0.07 + ((i * 11 + 3) % 7) * height * 0.025,
        phase: (i * 0.17) % 1,
        speed: 0.4 + ((i * 7 + 5) % 11) / 11 * 0.6,
        color: i % 3 === 0 ? accentColor : glowColor,
      };
    });
  }, [cx, cy, width, height, stage, glowColor, accentColor]);

  return (
    <Group>
      {orbs.map((orb, i) => (
        <ShimmerOrb key={i} {...orb} clock={clock} />
      ))}
    </Group>
  );
}

// ── Mist Layers (drifting atmospheric fog) ──────────────────────────────────

function MistBand({ y, width, height, phase, speed, baseOpacity, clock }: {
  y: number; width: number; height: number; phase: number; speed: number;
  baseOpacity: number; clock: SharedValue<number>;
}) {
  const bandH = height * 0.12;
  const x = useDerivedValue(() => {
    const t = (clock.value * speed + phase) % 1;
    return -width * 0.3 + Math.sin(t * Math.PI * 2) * width * 0.15;
  });
  const op = useDerivedValue(() => {
    const t = (clock.value * speed * 0.7 + phase + 0.3) % 1;
    return baseOpacity * (0.6 + Math.sin(t * Math.PI * 2) * 0.4);
  });

  return (
    <Group opacity={op}>
      <Rect x={x} y={y - bandH / 2} width={width * 1.6} height={bandH}
        color="rgba(200,220,255,0.1)">
        <BlurMask blur={bandH * 0.8} style="normal" />
      </Rect>
    </Group>
  );
}

function MistLayers({ width, height, stage }: {
  width: number; height: number; stage: GrowthStage;
}) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 15000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const bands = useMemo(() => [
    { y: height * 0.3, phase: 0, speed: 0.3, baseOpacity: 0.15 + stage * 0.04 },
    { y: height * 0.5, phase: 0.25, speed: 0.5, baseOpacity: 0.2 + stage * 0.05 },
    { y: height * 0.65, phase: 0.5, speed: 0.2, baseOpacity: 0.12 + stage * 0.03 },
    { y: height * 0.8, phase: 0.75, speed: 0.4, baseOpacity: 0.18 + stage * 0.04 },
  ], [height, stage]);

  return (
    <Group>
      {bands.map((band, i) => (
        <MistBand key={i} {...band} width={width} height={height} clock={clock} />
      ))}
    </Group>
  );
}

// ── Bokeh Field (large soft background lights) ──────────────────────────────

function BokehOrb({ x, y, radius, phase, color, clock }: {
  x: number; y: number; radius: number; phase: number;
  color: string; clock: SharedValue<number>;
}) {
  const bx = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    return x + Math.sin(t * Math.PI * 2) * 12;
  });
  const by = useDerivedValue(() => {
    const t = (clock.value + phase * 1.3) % 1;
    return y + Math.cos(t * Math.PI * 2) * 10;
  });
  const op = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    return 0.05 + Math.sin(t * Math.PI * 2) * 0.05;
  });

  return (
    <Group opacity={op}>
      <Circle cx={bx} cy={by} r={radius} color={color}>
        <BlurMask blur={radius * 0.6} style="normal" />
      </Circle>
    </Group>
  );
}

function BokehField({ width, height, stage, accentColor, glowColor }: {
  width: number; height: number; stage: GrowthStage;
  accentColor: string; glowColor: string;
}) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 20000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const orbs = useMemo(() => {
    const count = 5 + Math.floor(stage * 1.5);
    return Array.from({ length: count }, (_, i) => ({
      x: ((i * 137.5 + 42) % width),
      y: ((i * 97.3 + height * 0.1) % (height * 0.8)) + height * 0.1,
      radius: height * 0.1 + ((i * 13 + 7) % 5) * height * 0.05,
      phase: (i * 0.23) % 1,
      color: i % 2 === 0 ? accentColor : glowColor,
    }));
  }, [width, height, stage, accentColor, glowColor]);

  return (
    <Group>
      {orbs.map((orb, i) => (
        <BokehOrb key={i} {...orb} clock={clock} />
      ))}
    </Group>
  );
}

// ── Pollen Drift (tiny rising particles) ────────────────────────────────────

function PollenMote({ x, startY, speed, drift, size, height, clock }: {
  x: number; startY: number; speed: number; drift: number;
  size: number; height: number; clock: SharedValue<number>;
}) {
  const px = useDerivedValue(() => {
    const t = (clock.value * speed + drift) % 1;
    return x + Math.sin(t * Math.PI * 4 + drift * 10) * 18;
  });
  const py = useDerivedValue(() => {
    const t = (clock.value * speed + drift) % 1;
    return startY - t * height * 0.6;
  });
  const op = useDerivedValue(() => {
    const t = (clock.value * speed + drift) % 1;
    const fadeIn = Math.min(t * 5, 1);
    const fadeOut = Math.min((1 - t) * 3, 1);
    return fadeIn * fadeOut * 0.7;
  });

  return (
    <Group opacity={op}>
      <Circle cx={px} cy={py} r={size + 2} color="rgba(255,255,200,0.3)">
        <BlurMask blur={3} style="normal" />
      </Circle>
      <Circle cx={px} cy={py} r={size} color="rgba(255,255,220,0.9)" />
    </Group>
  );
}

function PollenDrift({ width, height, stage }: {
  width: number; height: number; stage: GrowthStage;
}) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 10000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const motes = useMemo(() => {
    const count = 12 + stage * 4;
    return Array.from({ length: count }, (_, i) => ({
      x: ((i * 47.7 + 15) % width),
      startY: height * 0.55 + ((i * 31.3) % (height * 0.35)),
      speed: 0.3 + ((i * 7 + 3) % 11) / 11 * 0.4,
      drift: (i * 0.31) % 1,
      size: 1 + ((i * 5 + 2) % 3) * 0.5,
    }));
  }, [width, height, stage]);

  return (
    <Group>
      {motes.map((m, i) => (
        <PollenMote key={i} {...m} height={height} clock={clock} />
      ))}
    </Group>
  );
}

// ── Leaf Scatter (arcing burst on KPI log) ──────────────────────────────────

function ScatterLeaf({
  cx, cy, angle, speed, progress, opacity, color, height,
}: {
  cx: number; cy: number; angle: number; speed: number;
  progress: SharedValue<number>; opacity: SharedValue<number>;
  color: string; height: number;
}) {
  const px = useDerivedValue(() => {
    const t = progress.value;
    return cx + Math.cos(angle) * t * speed;
  });
  const py = useDerivedValue(() => {
    const t = progress.value;
    const upward = Math.sin(angle) * t * speed * 0.5;
    const gravity = t * t * height * 0.5;
    return cy + upward + gravity;
  });
  const r = useDerivedValue(() => 2.5 + (1 - progress.value) * 2);

  return (
    <Group opacity={opacity}>
      <Circle cx={px} cy={py} r={r} color={color} />
    </Group>
  );
}

function LeafScatter({
  cx, cy, progress, opacity, height, leafColors,
}: {
  cx: number; cy: number;
  progress: SharedValue<number>; opacity: SharedValue<number>;
  height: number; leafColors: string[];
}) {
  const leaves = useMemo(() => {
    const count = 18;
    return Array.from({ length: count }, (_, i) => ({
      angle: -Math.PI * 0.8 + (i / count) * Math.PI * 1.6 + ((i * 3 + 1) % 5) * 0.08,
      speed: 45 + ((i * 11 + 5) % 7) * 18,
      color: leafColors[i % leafColors.length],
    }));
  }, [leafColors]);

  return (
    <Group>
      {leaves.map((leaf, i) => (
        <ScatterLeaf
          key={i} cx={cx} cy={cy} angle={leaf.angle} speed={leaf.speed}
          progress={progress} opacity={opacity} color={leaf.color} height={height}
        />
      ))}
    </Group>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PreRenderedTreeCanvas({
  width,
  height,
  stage,
  imageStage,
  renderMode = 'bg',
  decayProgress,
  orbProgress,
  orbOpacity,
  trunkGlowOpacity,
  rustleOffsetX,
  rustleOffsetY,
  particleProgress,
  particleOpacity,
  tierFlashOpacity,
  tierScale,
}: PreRenderedTreeCanvasProps) {
  const palette = STAGE_PALETTES[Math.min(stage, 5)];
  const imgIdx = Math.min(imageStage ?? stage, 9);
  const useImageMode = renderMode !== 'silhouette';
  const imgSource = STAGE_IMAGES[imgIdx];

  // Build silhouette geometry (used for effect positioning even in image mode)
  const tree = useMemo(
    () => buildTreeSilhouette(stage, width, height),
    [stage, width, height],
  );

  // Decay color matrix: desaturate + darken
  const decayMatrix = useDerivedValue(() => {
    const d = decayProgress.value;
    const sat = 1 - d * 0.8; // desaturate
    const bright = 1 - d * 0.3; // darken
    // Saturation matrix blended with brightness
    const s = sat;
    const sr = (1 - s) * 0.2126 * bright;
    const sg = (1 - s) * 0.7152 * bright;
    const sb = (1 - s) * 0.0722 * bright;
    return [
      sr + s * bright, sg, sb, 0, 0,
      sr, sg + s * bright, sb, 0, 0,
      sr, sg, sb + s * bright, 0, 0,
      0, 0, 0, 1, 0,
    ];
  });

  // Sway transform for canopy rustle
  const canopyTransform = useDerivedValue(() => [
    { translateX: rustleOffsetX.value },
    { translateY: rustleOffsetY.value },
  ]);

  // Tier flash scale
  const scaleTransform = useDerivedValue(() => {
    const s = tierScale.value;
    return [
      { translateX: width / 2 * (1 - s) },
      { translateY: height / 2 * (1 - s) },
      { scaleX: s },
      { scaleY: s },
    ];
  });

  // Canopy glow pulse (reacts to trunk glow)
  const glowRadius = useDerivedValue(() => 60 + stage * 20 + trunkGlowOpacity.value * 30);
  const glowOpacity = useDerivedValue(() => {
    const base = stage >= 1 ? 0.15 + stage * 0.05 : 0;
    return base + trunkGlowOpacity.value * 0.4;
  });

  // Trunk highlight opacity (must be called unconditionally)
  const trunkHighlightOp = useDerivedValue(() => 0.15 + trunkGlowOpacity.value * 0.6);

  return (
    <View style={{ width, height }}>
      {/* Tree image layer — behind the Skia canvas, with reveal animation */}
      {useImageMode && (
        <TreeReveal
          source={imgSource}
          stageIndex={imgIdx}
          width={width}
          height={height}
          useVideoTransition={renderMode === 'transparent'}
        />
      )}

      <Canvas style={[StyleSheet.absoluteFill, { width, height }]}>
      {/* Decay + tier scale wrapper */}
      <Group transform={scaleTransform}>
        <Group>
          <ColorMatrix matrix={decayMatrix} />

          {!useImageMode ? (
            /* ── Silhouette fallback rendering ── */
            <>
              {/* Sky gradient */}
              <Rect x={0} y={0} width={width} height={height}>
                <LinearGradient
                  start={vec(width / 2, 0)}
                  end={vec(width / 2, height)}
                  colors={[palette.sky[0], palette.sky[1]]}
                />
              </Rect>

              {stage >= 5 && <Stars width={width} height={height * 0.4} />}

              {stage >= 4 && (
                <LightRays cx={tree.canopyCenter.x} topY={tree.canopyCenter.y - 40} width={width} height={height} />
              )}

              {stage >= 1 && (
                <Group opacity={glowOpacity}>
                  <Circle cx={tree.canopyCenter.x} cy={tree.canopyCenter.y} r={glowRadius} color={palette.glow}>
                    <BlurMask blur={40} style="normal" />
                  </Circle>
                </Group>
              )}

              <Rect x={0} y={tree.groundY - 2} width={width} height={height - tree.groundY + 2}>
                <LinearGradient start={vec(width / 2, tree.groundY - 2)} end={vec(width / 2, height)} colors={[palette.ground, '#000000']} />
              </Rect>

              <Group transform={canopyTransform}>
                {tree.rootPaths.map((rp, i) => (
                  <Path key={`root-${i}`} path={rp} color={palette.trunk} style="stroke" strokeWidth={3 - i * 0.2} />
                ))}
                <Path path={tree.trunkPath} color={palette.trunk} />
                <Group opacity={trunkHighlightOp}>
                  <Path path={tree.trunkPath} color={palette.accent}><BlurMask blur={6} style="normal" /></Path>
                </Group>
                {tree.canopyPaths.map((cp, i) => (
                  <Path key={`canopy-${i}`} path={cp} color={palette.canopy} />
                ))}
                <Group opacity={0.6}>
                  {tree.canopyPaths.map((cp, i) => (
                    <Path key={`canopy-light-${i}`} path={cp} color={palette.canopyLight}><BlurMask blur={12} style="normal" /></Path>
                  ))}
                </Group>
                <Group opacity={0.2}>
                  <Path path={tree.canopyPath} color={palette.accent} style="stroke" strokeWidth={2}><BlurMask blur={4} style="normal" /></Path>
                </Group>
              </Group>

              {stage >= 4 && <GroundGlow cx={tree.canopyCenter.x} groundY={tree.groundY} width={width} />}
            </>
          ) : null}

        </Group>
      </Group>

      {/* ── Effects layer — MAXED OUT (not affected by decay) ── */}

      {/* Atmospheric mist — deepest layer */}
      {stage >= 1 && (
        <MistLayers width={width} height={height} stage={stage} />
      )}

      {/* Bokeh depth orbs — large soft background lights */}
      {stage >= 2 && (
        <BokehField
          width={width} height={height} stage={stage}
          accentColor={palette.accent} glowColor={palette.glow}
        />
      )}

      {/* Canopy glow (breathing — works in image mode) */}
      {stage >= 1 && (
        <Group opacity={glowOpacity}>
          <Circle cx={tree.canopyCenter.x} cy={tree.canopyCenter.y} r={glowRadius} color={palette.glow}>
            <BlurMask blur={40} style="normal" />
          </Circle>
        </Group>
      )}

      {/* Canopy shimmer — breathing glow orbs across canopy */}
      {stage >= 1 && (
        <CanopyShimmer
          cx={tree.canopyCenter.x} cy={tree.canopyCenter.y}
          width={width} height={height} stage={stage}
          glowColor={palette.glow} accentColor={palette.accent}
        />
      )}

      {/* Pollen drift — tiny rising particles */}
      {stage >= 1 && (
        <PollenDrift width={width} height={height} stage={stage} />
      )}

      {/* Ambient particles — 3x density */}
      {stage >= 1 && (
        <AmbientParticles
          cx={tree.canopyCenter.x}
          cy={tree.canopyCenter.y}
          spread={width * 0.15 + stage * height * 0.04}
          count={12 + stage * 6}
          color={palette.accent}
          glowColor={palette.glow}
          stage={stage}
        />
      )}

      {/* Fireflies — 2.5x density */}
      {stage >= 2 && (
        <Fireflies
          cx={tree.canopyCenter.x}
          cy={tree.canopyCenter.y + height * 0.08}
          spread={width * 0.2 + stage * height * 0.03}
          count={8 + stage * 4}
        />
      )}

      {/* Rising orb on pulse */}
      <RisingOrb
        baseX={tree.canopyCenter.x}
        startY={tree.groundY}
        endY={tree.canopyCenter.y}
        progress={orbProgress}
        opacity={orbOpacity}
      />

      {/* Pulse burst at canopy */}
      <PulseBurst
        cx={tree.canopyCenter.x}
        cy={tree.canopyCenter.y}
        progress={particleProgress}
        opacity={particleOpacity}
        color={palette.accent}
      />

      {/* Leaf scatter on pulse — arcing particles with gravity */}
      <LeafScatter
        cx={tree.canopyCenter.x}
        cy={tree.canopyCenter.y}
        progress={particleProgress}
        opacity={particleOpacity}
        height={height}
        leafColors={[palette.canopy, palette.canopyLight, palette.accent, '#FFD54F', '#FF8A65']}
      />

      {/* Tier flash overlay */}
      <Group opacity={tierFlashOpacity}>
        <Rect x={0} y={0} width={width} height={height} color="rgba(255,255,255,0.6)">
          <BlurMask blur={30} style="normal" />
        </Rect>
      </Group>
    </Canvas>
    </View>
  );
}

// ── Stars (stage 5) ──────────────────────────────────────────────────────────

function Star({ x, y, size, phase, clock }: {
  x: number; y: number; size: number; phase: number; clock: SharedValue<number>;
}) {
  const op = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    return 0.3 + Math.sin(t * Math.PI * 2) * 0.5;
  });
  return (
    <Group opacity={op}>
      <Circle cx={x} cy={y} r={size + 2} color="rgba(255,255,255,0.15)">
        <BlurMask blur={3} style="normal" />
      </Circle>
      <Circle cx={x} cy={y} r={size} color="#E1F5FE" />
    </Group>
  );
}

function Stars({ width, height }: { width: number; height: number }) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 10000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const stars = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      x: ((i * 137.5) % width),
      y: ((i * 97.3 + 23) % height),
      size: 1 + (i % 3) * 0.5,
      phase: (i * 0.13) % 1,
    })),
    [width, height],
  );

  return (
    <>
      {stars.map((s, i) => (
        <Star key={i} x={s.x} y={s.y} size={s.size} phase={s.phase} clock={clock} />
      ))}
    </>
  );
}

// ── Ground glow (stage 4+) ───────────────────────────────────────────────────

function GroundGlow({ cx, groundY, width }: { cx: number; groundY: number; width: number }) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 5000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const op = useDerivedValue(() => 0.15 + Math.sin(clock.value * Math.PI * 2) * 0.1);

  return (
    <Group opacity={op}>
      {/* Warm ground glow under tree */}
      <Circle cx={cx} cy={groundY} r={80} color="rgba(255,183,77,0.15)">
        <BlurMask blur={30} style="normal" />
      </Circle>
      {/* Small mushroom-like glows */}
      <Circle cx={cx - 45} cy={groundY + 3} r={4} color="rgba(255,213,79,0.4)" />
      <Circle cx={cx + 38} cy={groundY + 5} r={3} color="rgba(248,187,208,0.4)" />
      <Circle cx={cx - 20} cy={groundY + 4} r={3.5} color="rgba(255,238,88,0.3)" />
    </Group>
  );
}

/**
 * PreRenderedCityCanvas — Pre-rendered city image + Skia effects compositor.
 *
 * City-specific effects layered over AI-generated diorama images:
 *   - Window flicker (randomized warm lights blinking)
 *   - Street glow (warm pools of light at ground level)
 *   - Chimney smoke / steam (rising soft particles)
 *   - Neon signs (pulsing colored glows)
 *   - Searchlights (sweeping beams at higher stages)
 *   - Construction sparks (burst on GP log)
 *   - Ambient city haze (soft atmospheric bands)
 *   - Bokeh city lights (large soft orbs)
 *   - Traffic lights (tiny colored dots at street level)
 *
 * Drop-in for the GP dashboard card. Same shared-value interface pattern as VP tree.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { CityReveal } from './CityReveal';
import {
  Canvas,
  Circle,
  Group,
  Rect,
  BlurMask,
  vec,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import {
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { CityTier } from './constants';

// ── Stage images ──────────────────────────────────────────────────────────────
const STAGE_IMAGES = [
  require('../../assets/gp-city/stage_0.png'),
  require('../../assets/gp-city/stage_1.png'),
  require('../../assets/gp-city/stage_2.png'),
  require('../../assets/gp-city/stage_3.png'),
  require('../../assets/gp-city/stage_4.png'),
  require('../../assets/gp-city/stage_5.png'),
  require('../../assets/gp-city/stage_6.png'),
  require('../../assets/gp-city/stage_7.png'),
  require('../../assets/gp-city/stage_8.png'),
  require('../../assets/gp-city/stage_9.png'),
];

// ── Stage color palettes (city-themed) ───────────────────────────────────────

const CITY_PALETTES = [
  // 0 — Barren: dusty, muted
  { ambient: 'rgba(120,100,80,0.0)', accent: '#8D6E63', glow: 'rgba(141,110,99,0.1)', neon: '#FFB74D', smoke: 'rgba(160,140,120,0.2)' },
  // 1 — Camp: warm firelight
  { ambient: 'rgba(255,183,77,0.1)', accent: '#FFB74D', glow: 'rgba(255,183,77,0.15)', neon: '#FF8A65', smoke: 'rgba(180,160,140,0.25)' },
  // 2 — Homestead: golden warmth
  { ambient: 'rgba(255,213,79,0.12)', accent: '#FFD54F', glow: 'rgba(255,213,79,0.18)', neon: '#FFF176', smoke: 'rgba(200,190,170,0.25)' },
  // 3 — Village: cozy evening
  { ambient: 'rgba(255,224,130,0.15)', accent: '#FFE082', glow: 'rgba(255,224,130,0.2)', neon: '#FF8A65', smoke: 'rgba(180,180,190,0.3)' },
  // 4 — Small Town: neon signs
  { ambient: 'rgba(251,191,36,0.18)', accent: '#FBBF24', glow: 'rgba(251,191,36,0.22)', neon: '#EF4444', smoke: 'rgba(160,170,185,0.3)' },
  // 5 — Growing Town: construction amber
  { ambient: 'rgba(245,158,11,0.2)', accent: '#F59E0B', glow: 'rgba(245,158,11,0.25)', neon: '#F97316', smoke: 'rgba(150,160,180,0.35)' },
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────

interface PreRenderedCityCanvasProps {
  width: number;
  height: number;
  tier: CityTier;
  /** 0-9 image stage index (overrides tier for image selection) */
  imageStage?: number;
  /** Enable video transitions */
  useVideoTransition?: boolean;

  // Shared values driven by dashboard / GP city screen
  pulseProgress: SharedValue<number>;
  pulseOpacity: SharedValue<number>;
  decayProgress: SharedValue<number>;
}

// ── Window Flicker (randomized warm lights) ─────────────────────────────────

function FlickerWindow({ x, y, size, phase, warmth, clock }: {
  x: number; y: number; size: number; phase: number;
  warmth: number; clock: SharedValue<number>;
}) {
  const op = useDerivedValue(() => {
    const t = (clock.value * 0.8 + phase) % 1;
    const flicker = Math.sin(t * Math.PI * 8 + phase * 20);
    // Most windows stay lit, occasional flicker
    return flicker > -0.3 ? 0.4 + warmth * 0.3 : 0.05;
  });
  const color = warmth > 0.5 ? 'rgba(251,191,36,0.9)' : 'rgba(226,232,240,0.7)';

  return (
    <Group opacity={op}>
      <Rect x={x} y={y} width={size} height={size} color={color} />
      <Rect x={x - 1} y={y - 1} width={size + 2} height={size + 2} color={color}>
        <BlurMask blur={4} style="normal" />
      </Rect>
    </Group>
  );
}

function WindowLights({ width, height, tier }: {
  width: number; height: number; tier: CityTier;
}) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const windows = useMemo(() => {
    if (tier < 1) return [];
    // City grows from bottom — windows in lower 60% of frame
    const count = 8 + tier * 8;
    const cityTop = height * (0.45 - tier * 0.05); // city grows upward
    const cityBottom = height * 0.88;
    return Array.from({ length: count }, (_, i) => ({
      x: ((i * 47.3 + 15) % (width * 0.7)) + width * 0.15,
      y: cityTop + ((i * 31.7 + 23) % (cityBottom - cityTop)),
      size: 2 + ((i * 3 + 1) % 3),
      phase: (i * 0.17) % 1,
      warmth: ((i * 7 + 3) % 10) / 10,
    }));
  }, [width, height, tier]);

  return (
    <Group>
      {windows.map((w, i) => (
        <FlickerWindow key={i} {...w} clock={clock} />
      ))}
    </Group>
  );
}

// ── Street Glow (warm pools at ground level) ────────────────────────────────

function StreetLamp({ x, y, radius, phase, clock }: {
  x: number; y: number; radius: number; phase: number; clock: SharedValue<number>;
}) {
  const op = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    return 0.08 + Math.sin(t * Math.PI * 2) * 0.04;
  });
  return (
    <Group opacity={op}>
      <Circle cx={x} cy={y} r={radius} color="rgba(253,230,138,0.3)">
        <BlurMask blur={radius * 0.6} style="normal" />
      </Circle>
    </Group>
  );
}

function StreetGlow({ width, height, tier }: {
  width: number; height: number; tier: CityTier;
}) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 7000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const lights = useMemo(() => {
    if (tier < 1) return [];
    const count = 4 + tier * 2;
    const groundY = height * 0.85;
    return Array.from({ length: count }, (_, i) => ({
      x: width * 0.1 + ((i * 67.3 + 20) % (width * 0.8)),
      y: groundY + ((i * 11 + 3) % 5) * 2 - 5,
      radius: 15 + ((i * 7 + 2) % 5) * 5,
      phase: (i * 0.23) % 1,
    }));
  }, [width, height, tier]);

  return (
    <Group>
      {lights.map((l, i) => (
        <StreetLamp key={i} {...l} clock={clock} />
      ))}
    </Group>
  );
}

// ── Smoke / Steam (rising soft particles) ───────────────────────────────────

function SmokePuff({ x, startY, speed, drift, size, color, clock }: {
  x: number; startY: number; speed: number; drift: number;
  size: number; color: string; clock: SharedValue<number>;
}) {
  const px = useDerivedValue(() => {
    const t = (clock.value * speed + drift) % 1;
    return x + Math.sin(t * Math.PI * 3 + drift * 8) * 12;
  });
  const py = useDerivedValue(() => {
    const t = (clock.value * speed + drift) % 1;
    return startY - t * startY * 0.3;
  });
  const op = useDerivedValue(() => {
    const t = (clock.value * speed + drift) % 1;
    const fadeIn = Math.min(t * 4, 1);
    const fadeOut = Math.min((1 - t) * 2, 1);
    return fadeIn * fadeOut * 0.4;
  });
  const r = useDerivedValue(() => {
    const t = (clock.value * speed + drift) % 1;
    return size * (1 + t * 1.5); // expands as it rises
  });

  return (
    <Group opacity={op}>
      <Circle cx={px} cy={py} r={r} color={color}>
        <BlurMask blur={size * 1.2} style="normal" />
      </Circle>
    </Group>
  );
}

function SmokeAndSteam({ width, height, tier, smokeColor }: {
  width: number; height: number; tier: CityTier; smokeColor: string;
}) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const puffs = useMemo(() => {
    if (tier < 1) return [];
    const count = 6 + tier * 3;
    const cityTop = height * (0.45 - tier * 0.05);
    return Array.from({ length: count }, (_, i) => ({
      x: width * 0.12 + ((i * 53.7 + 10) % (width * 0.76)),
      startY: cityTop + ((i * 23.3 + 7) % (height * 0.2)),
      speed: 0.25 + ((i * 7 + 3) % 9) / 9 * 0.3,
      drift: (i * 0.29) % 1,
      size: 5 + ((i * 5 + 2) % 4) * 3,
    }));
  }, [width, height, tier]);

  return (
    <Group>
      {puffs.map((p, i) => (
        <SmokePuff key={i} {...p} color={smokeColor} clock={clock} />
      ))}
    </Group>
  );
}

// ── Neon Pulse (pulsing colored accent glows) ───────────────────────────────

function NeonGlow({ x, y, radius, phase, color, clock }: {
  x: number; y: number; radius: number; phase: number;
  color: string; clock: SharedValue<number>;
}) {
  const op = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    const pulse = Math.sin(t * Math.PI * 2);
    return 0.1 + pulse * 0.15;
  });
  const r = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    return radius + Math.sin(t * Math.PI * 2) * radius * 0.2;
  });

  return (
    <Group opacity={op}>
      <Circle cx={x} cy={y} r={r} color={color}>
        <BlurMask blur={radius * 0.7} style="normal" />
      </Circle>
    </Group>
  );
}

function NeonSigns({ width, height, tier, neonColor }: {
  width: number; height: number; tier: CityTier; neonColor: string;
}) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const signs = useMemo(() => {
    if (tier < 2) return [];
    const count = 3 + tier * 2;
    const cityTop = height * (0.4 - tier * 0.05);
    const cityBottom = height * 0.82;
    const colors = [neonColor, '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];
    return Array.from({ length: count }, (_, i) => ({
      x: width * 0.15 + ((i * 61.3 + 30) % (width * 0.7)),
      y: cityTop + ((i * 37.7 + 15) % (cityBottom - cityTop)),
      radius: 10 + ((i * 7 + 2) % 5) * 4,
      phase: (i * 0.19) % 1,
      color: colors[i % colors.length],
    }));
  }, [width, height, tier, neonColor]);

  return (
    <Group>
      {signs.map((s, i) => (
        <NeonGlow key={i} {...s} clock={clock} />
      ))}
    </Group>
  );
}

// ── City Haze (atmospheric fog bands) ───────────────────────────────────────

function HazeBand({ y, width, height, phase, speed, baseOpacity, clock }: {
  y: number; width: number; height: number; phase: number; speed: number;
  baseOpacity: number; clock: SharedValue<number>;
}) {
  const bandH = height * 0.1;
  const x = useDerivedValue(() => {
    const t = (clock.value * speed + phase) % 1;
    return -width * 0.2 + Math.sin(t * Math.PI * 2) * width * 0.1;
  });
  const op = useDerivedValue(() => {
    const t = (clock.value * speed * 0.6 + phase + 0.3) % 1;
    return baseOpacity * (0.6 + Math.sin(t * Math.PI * 2) * 0.4);
  });

  return (
    <Group opacity={op}>
      <Rect x={x} y={y - bandH / 2} width={width * 1.4} height={bandH}
        color="rgba(180,190,210,0.06)">
        <BlurMask blur={bandH * 0.7} style="normal" />
      </Rect>
    </Group>
  );
}

function CityHaze({ width, height, tier }: {
  width: number; height: number; tier: CityTier;
}) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 18000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const bands = useMemo(() => {
    if (tier < 1) return [];
    return [
      { y: height * 0.35, phase: 0, speed: 0.25, baseOpacity: 0.12 + tier * 0.03 },
      { y: height * 0.55, phase: 0.3, speed: 0.4, baseOpacity: 0.15 + tier * 0.04 },
      { y: height * 0.72, phase: 0.6, speed: 0.2, baseOpacity: 0.1 + tier * 0.03 },
    ];
  }, [height, tier]);

  return (
    <Group>
      {bands.map((band, i) => (
        <HazeBand key={i} {...band} width={width} height={height} clock={clock} />
      ))}
    </Group>
  );
}

// ── City Bokeh (large soft background lights) ───────────────────────────────

function CityBokeh({ x, y, radius, phase, color, clock }: {
  x: number; y: number; radius: number; phase: number;
  color: string; clock: SharedValue<number>;
}) {
  const bx = useDerivedValue(() => x + Math.sin((clock.value + phase) * Math.PI * 2) * 8);
  const by = useDerivedValue(() => y + Math.cos((clock.value + phase * 1.3) * Math.PI * 2) * 6);
  const op = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    return 0.04 + Math.sin(t * Math.PI * 2) * 0.04;
  });

  return (
    <Group opacity={op}>
      <Circle cx={bx} cy={by} r={radius} color={color}>
        <BlurMask blur={radius * 0.6} style="normal" />
      </Circle>
    </Group>
  );
}

function CityBokehField({ width, height, tier, accentColor, glowColor }: {
  width: number; height: number; tier: CityTier;
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
    if (tier < 2) return [];
    const count = 4 + tier * 2;
    return Array.from({ length: count }, (_, i) => ({
      x: ((i * 97.3 + 30) % (width * 0.8)) + width * 0.1,
      y: height * 0.2 + ((i * 67.7 + 15) % (height * 0.6)),
      radius: height * 0.08 + ((i * 11 + 5) % 5) * height * 0.03,
      phase: (i * 0.21) % 1,
      color: i % 2 === 0 ? accentColor : glowColor,
    }));
  }, [width, height, tier, accentColor, glowColor]);

  return (
    <Group>
      {orbs.map((orb, i) => (
        <CityBokeh key={i} {...orb} clock={clock} />
      ))}
    </Group>
  );
}

// ── Construction Spark Burst (on GP log pulse) ──────────────────────────────

function SparkParticle({ cx, cy, angle, speed, progress, color }: {
  cx: number; cy: number; angle: number; speed: number;
  progress: SharedValue<number>; color: string;
}) {
  const px = useDerivedValue(() => cx + Math.cos(angle) * progress.value * speed);
  const py = useDerivedValue(() => {
    const t = progress.value;
    return cy + Math.sin(angle) * t * speed * 0.5 + t * t * 40; // gravity
  });
  const r = useDerivedValue(() => 2.5 * (1 - progress.value * 0.6));

  return <Circle cx={px} cy={py} r={r} color={color} />;
}

function ConstructionBurst({
  cx, cy, progress, opacity, width, height,
}: {
  cx: number; cy: number;
  progress: SharedValue<number>; opacity: SharedValue<number>;
  width: number; height: number;
}) {
  const flashR = useDerivedValue(() => 15 + progress.value * 30);
  const sparks = useMemo(() => {
    const count = 16;
    const colors = ['#FBBF24', '#F59E0B', '#FF8A65', '#FFD54F', '#FFFFFF'];
    return Array.from({ length: count }, (_, i) => ({
      angle: (i / count) * Math.PI * 2,
      speed: 30 + ((i * 11 + 3) % 7) * 12,
      color: colors[i % colors.length],
    }));
  }, []);

  return (
    <Group opacity={opacity}>
      {/* Central flash */}
      <Circle cx={cx} cy={cy} r={flashR} color="rgba(251,191,36,0.5)">
        <BlurMask blur={20} style="normal" />
      </Circle>
      {sparks.map((s, i) => (
        <SparkParticle
          key={i} cx={cx} cy={cy} angle={s.angle} speed={s.speed}
          progress={progress} color={s.color}
        />
      ))}
    </Group>
  );
}

// ── Traffic Lights (tiny colored dots at street level) ──────────────────────

function TrafficDot({ x, y, phase, clock }: {
  x: number; y: number; phase: number; clock: SharedValue<number>;
}) {
  const color = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    const cycle = Math.floor(t * 3); // 0=red, 1=yellow, 2=green
    if (cycle === 0) return 'rgba(239,68,68,0.8)';
    if (cycle === 1) return 'rgba(251,191,36,0.8)';
    return 'rgba(34,197,94,0.8)';
  });
  // Just draw all three and use opacity trick — simpler with Skia
  const rOp = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    return Math.floor(t * 3) === 0 ? 0.8 : 0.1;
  });
  const gOp = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    return Math.floor(t * 3) === 2 ? 0.8 : 0.1;
  });

  return (
    <Group>
      <Group opacity={rOp}>
        <Circle cx={x} cy={y} r={2} color="#EF4444" />
        <Circle cx={x} cy={y} r={5} color="rgba(239,68,68,0.3)">
          <BlurMask blur={4} style="normal" />
        </Circle>
      </Group>
      <Group opacity={gOp}>
        <Circle cx={x} cy={y + 5} r={2} color="#22C55E" />
        <Circle cx={x} cy={y + 5} r={5} color="rgba(34,197,94,0.3)">
          <BlurMask blur={4} style="normal" />
        </Circle>
      </Group>
    </Group>
  );
}

function TrafficLights({ width, height, tier }: {
  width: number; height: number; tier: CityTier;
}) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const dots = useMemo(() => {
    if (tier < 3) return [];
    const count = 2 + tier;
    const groundY = height * 0.82;
    return Array.from({ length: count }, (_, i) => ({
      x: width * 0.15 + ((i * 73.3 + 25) % (width * 0.7)),
      y: groundY - 10 - ((i * 17 + 3) % 10),
      phase: (i * 0.33) % 1,
    }));
  }, [width, height, tier]);

  return (
    <Group>
      {dots.map((d, i) => (
        <TrafficDot key={i} {...d} clock={clock} />
      ))}
    </Group>
  );
}

// ── Searchlights (sweeping beams, tier 4+) ──────────────────────────────────

function Searchlight({ x, y, width, height, phase, clock }: {
  x: number; y: number; width: number; height: number;
  phase: number; clock: SharedValue<number>;
}) {
  // Beam sweeps left-right via x offset at top
  const beamTopX = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    return x + Math.sin(t * Math.PI * 2) * width * 0.15;
  });
  const op = useDerivedValue(() => {
    const t = (clock.value + phase) % 1;
    return 0.03 + Math.sin(t * Math.PI * 2 + 1) * 0.02;
  });

  // Simple approximation: just a glowing circle that moves
  return (
    <Group opacity={op}>
      <Circle cx={beamTopX} cy={y - height * 0.2} r={height * 0.15} color="rgba(255,255,255,0.08)">
        <BlurMask blur={30} style="normal" />
      </Circle>
    </Group>
  );
}

function Searchlights({ width, height, tier }: {
  width: number; height: number; tier: CityTier;
}) {
  const clock = useSharedValue(0);
  React.useEffect(() => {
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 10000, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  const beams = useMemo(() => [
    { x: width * 0.3, y: height * 0.3, phase: 0 },
    { x: width * 0.7, y: height * 0.25, phase: 0.5 },
  ], [width, height]);

  if (tier < 4) return null;

  return (
    <Group>
      {beams.map((b, i) => (
        <Searchlight key={i} {...b} width={width} height={height} clock={clock} />
      ))}
    </Group>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PreRenderedCityCanvas({
  width,
  height,
  tier,
  imageStage,
  useVideoTransition = true,
  pulseProgress,
  pulseOpacity,
  decayProgress,
}: PreRenderedCityCanvasProps) {
  const palette = CITY_PALETTES[Math.min(tier, 5)];
  const imgIdx = Math.min(imageStage ?? tier, 9);
  const imgSource = STAGE_IMAGES[imgIdx];

  // City center for burst effects — bottom-center since city is bottom-anchored
  const cityCenterX = width / 2;
  const cityCenterY = height * (0.65 - tier * 0.03);

  // Ambient glow that grows with tier
  const ambientOp = useDerivedValue(() => {
    const base = tier >= 1 ? 0.1 + tier * 0.04 : 0;
    return base * (1 - decayProgress.value * 0.5);
  });
  const ambientR = height * 0.2 + tier * height * 0.04;

  return (
    <View style={{ width, height }}>
      {/* City image layer */}
      <CityReveal
        source={imgSource}
        stageIndex={imgIdx}
        width={width}
        height={height}
        useVideoTransition={useVideoTransition}
      />

      <Canvas style={[StyleSheet.absoluteFill, { width, height }]}>
        {/* ── Effects layer ── */}

        {/* City haze — atmospheric depth */}
        <CityHaze width={width} height={height} tier={tier} />

        {/* Bokeh city lights */}
        <CityBokehField
          width={width} height={height} tier={tier}
          accentColor={palette.accent} glowColor={palette.glow}
        />

        {/* Ambient city glow */}
        {tier >= 1 && (
          <Group opacity={ambientOp}>
            <Circle cx={cityCenterX} cy={cityCenterY} r={ambientR} color={palette.ambient}>
              <BlurMask blur={50} style="normal" />
            </Circle>
          </Group>
        )}

        {/* Smoke / steam rising */}
        <SmokeAndSteam width={width} height={height} tier={tier} smokeColor={palette.smoke} />

        {/* Window flicker */}
        <WindowLights width={width} height={height} tier={tier} />

        {/* Street glow */}
        <StreetGlow width={width} height={height} tier={tier} />

        {/* Neon signs */}
        <NeonSigns width={width} height={height} tier={tier} neonColor={palette.neon} />

        {/* Traffic lights */}
        <TrafficLights width={width} height={height} tier={tier} />

        {/* Searchlights (tier 4+) */}
        <Searchlights width={width} height={height} tier={tier} />

        {/* Construction spark burst on GP log */}
        <ConstructionBurst
          cx={cityCenterX}
          cy={cityCenterY}
          progress={pulseProgress}
          opacity={pulseOpacity}
          width={width}
          height={height}
        />
      </Canvas>
    </View>
  );
}

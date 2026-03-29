/**
 * GPCityInline — Skia city embedded in the dashboard Growth card.
 * Reacts to GP logs via `pulseKey`.
 *
 * Tier unlocks:
 *   0 — empty lot, fence, construction sign, lamppost, road
 *   1 — small buildings, chimney smoke, flickering OPEN signs
 *   2 — scaffolding, water tower, pigeons, cranes
 *   3 — helicopter patrol, billboard glow, steam vents, traffic
 *   4 — monorail, searchlights, rooftop pools, ambient glow
 *   5 — FUTURE CITY: flying saucers, holo-billboards, energy dome,
 *       orbital ring, floating platforms, neon rain, dynamic lighting
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import {
  Canvas,
  Circle,
  Rect,
  Group,
  LinearGradient,
  BlurMask,
  Line,
  vec,
  Skia,
  Path,
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
import { generateCity } from './cityGen';
import { getTier, getCityDecayProgress, GP_TIERS, CITY_COLORS } from './constants';

interface GPCityInlineProps {
  width: number; height: number;
  gpTotal?: number; gpStreak?: number;
  lastLoggedAt?: Date | null; seed?: number; pulseKey?: number;
}

// ── Sub-components (each owns hooks) ────────────────────────────────────────

function Particle({ angle, baseCx, baseCy, progress, opacity }: {
  angle: number; baseCx: number; baseCy: number;
  progress: SharedValue<number>; opacity: SharedValue<number>;
}) {
  const cx = useDerivedValue(() => baseCx + Math.cos(angle) * progress.value * 30);
  const cy = useDerivedValue(() => baseCy - progress.value * 25 + Math.sin(angle) * progress.value * 15);
  const r = useDerivedValue(() => 2 * (1 - progress.value * 0.7));
  return <Circle cx={cx} cy={cy} r={r} color={CITY_COLORS.particle} opacity={opacity} />;
}

function WindowRect({ x, y, w, h, lit, flicker }: {
  x: number; y: number; w: number; h: number; lit: boolean; flicker: SharedValue<number>;
}) {
  const op = useDerivedValue(() => lit ? 0.7 + Math.sin(flicker.value * Math.PI * 2 + x * 0.1 + y * 0.07) * 0.2 : 0.15);
  return <Rect x={x} y={y} width={w} height={h} color={lit ? CITY_COLORS.windowLit : CITY_COLORS.windowDark} opacity={op} />;
}

function StreetLightElement({ x, groundY, height, glow }: {
  x: number; groundY: number; height: number; glow: SharedValue<number>;
}) {
  const glowOp = useDerivedValue(() => 0.3 + Math.sin(glow.value * Math.PI * 2 + x * 0.05) * 0.15);
  return (
    <Group>
      <Line p1={vec(x, groundY)} p2={vec(x, groundY - height)} color={CITY_COLORS.lampPost} style="stroke" strokeWidth={1.5} />
      <Circle cx={x} cy={groundY - height} r={2} color={CITY_COLORS.lampGlow} />
      <Circle cx={x} cy={groundY - height} r={8} color={CITY_COLORS.lampGlowHalo} opacity={glowOp}><BlurMask blur={6} style="normal" /></Circle>
    </Group>
  );
}

function CraneElement({ x, baseY, height, armLength, armAngle, swing }: {
  x: number; baseY: number; height: number; armLength: number; armAngle: number; swing: SharedValue<number>;
}) {
  const topY = baseY - height;
  const armPath = useDerivedValue(() => {
    const a = armAngle + Math.sin(swing.value * Math.PI * 2) * 0.15;
    const p = Skia.Path.Make();
    p.moveTo(x, topY);
    p.lineTo(x + Math.cos(a) * armLength, topY + Math.sin(a) * armLength);
    return p;
  });
  return (
    <Group>
      <Line p1={vec(x, baseY)} p2={vec(x, topY)} color={CITY_COLORS.craneSteel} style="stroke" strokeWidth={2} />
      <Path path={armPath} color={CITY_COLORS.craneSteel} style="stroke" strokeWidth={1.5} />
    </Group>
  );
}

function CarElement({ x: startX, y, width, direction, drift }: {
  x: number; y: number; width: number; direction: 1 | -1; drift: SharedValue<number>;
}) {
  const cx = useDerivedValue(() => startX + drift.value * 80 * direction);
  const headX = useDerivedValue(() => cx.value + (direction > 0 ? width : 0));
  const tailX = useDerivedValue(() => cx.value + (direction > 0 ? 0 : width));
  return (
    <Group>
      <Rect x={cx} y={y} width={width} height={4} color={CITY_COLORS.carBody} />
      <Circle cx={headX} cy={y + 2} r={1.5} color={CITY_COLORS.headlight} />
      <Circle cx={tailX} cy={y + 2} r={1} color={CITY_COLORS.taillight} />
    </Group>
  );
}

// Tier 1 — Chimney smoke puff
function SmokeParticle({ x, baseY, phase, drift }: {
  x: number; baseY: number; phase: number; drift: SharedValue<number>;
}) {
  const cy = useDerivedValue(() => baseY - 8 - drift.value * 20 - phase * 5);
  const cx = useDerivedValue(() => x + Math.sin(drift.value * Math.PI * 2 + phase) * 4);
  const op = useDerivedValue(() => Math.max(0, 0.4 - drift.value * 0.5 - phase * 0.1));
  const r = useDerivedValue(() => 2 + drift.value * 3 + phase * 1.5);
  return <Circle cx={cx} cy={cy} r={r} color={CITY_COLORS.smoke} opacity={op}><BlurMask blur={3} style="normal" /></Circle>;
}

// Tier 1 — Flickering OPEN sign
function OpenSign({ x, y, flicker }: { x: number; y: number; flicker: SharedValue<number>; }) {
  const op = useDerivedValue(() => 0.5 + Math.sin(flicker.value * Math.PI * 6 + x * 0.2) * 0.4);
  return (
    <Group>
      <Rect x={x} y={y} width={12} height={5} color={CITY_COLORS.openSign} opacity={op} />
      <Rect x={x} y={y} width={12} height={5} color={CITY_COLORS.openSignGlow} opacity={op}><BlurMask blur={4} style="normal" /></Rect>
    </Group>
  );
}

// Tier 2 — Pigeon
function Pigeon({ x, y, phase, drift }: {
  x: number; y: number; phase: number; drift: SharedValue<number>;
}) {
  const px = useDerivedValue(() => x + Math.sin(drift.value * Math.PI * 2 + phase) * 6);
  const py = useDerivedValue(() => y + Math.cos(drift.value * Math.PI * 3 + phase) * 2);
  return <Circle cx={px} cy={py} r={1.5} color={CITY_COLORS.pigeon} />;
}

// Tier 3 — Helicopter
function Helicopter({ canvasWidth, skyY, progress }: {
  canvasWidth: number; skyY: number; progress: SharedValue<number>;
}) {
  const hx = useDerivedValue(() => canvasWidth * 0.1 + progress.value * canvasWidth * 0.8);
  const hy = useDerivedValue(() => skyY + Math.sin(progress.value * Math.PI * 4) * 8);
  const rotorW = useDerivedValue(() => 8 + Math.abs(Math.sin(progress.value * Math.PI * 30)) * 4);
  const blinkOp = useDerivedValue(() => Math.sin(progress.value * Math.PI * 20) > 0 ? 0.8 : 0.1);
  const bodyX = useDerivedValue(() => hx.value - 5);
  const rotorX = useDerivedValue(() => hx.value - rotorW.value / 2);
  const rotorY = useDerivedValue(() => hy.value - 2);
  const lightCx = useDerivedValue(() => hx.value + 4);
  const lightCy = useDerivedValue(() => hy.value + 4);
  return (
    <Group>
      <Rect x={bodyX} y={hy} width={10} height={5} color={CITY_COLORS.heliBody} />
      <Rect x={rotorX} y={rotorY} width={rotorW} height={1} color={CITY_COLORS.heliRotor} />
      <Circle cx={lightCx} cy={lightCy} r={1} color={CITY_COLORS.heliLight} opacity={blinkOp} />
    </Group>
  );
}

// Tier 3 — Steam vent
function SteamVent({ x, groundY, phase, drift }: {
  x: number; groundY: number; phase: number; drift: SharedValue<number>;
}) {
  const cy = useDerivedValue(() => groundY - 2 - drift.value * 15 - phase * 3);
  const op = useDerivedValue(() => Math.max(0, 0.3 - drift.value * 0.4));
  const r = useDerivedValue(() => 1.5 + drift.value * 4);
  return <Circle cx={x} cy={cy} r={r} color={CITY_COLORS.steam} opacity={op}><BlurMask blur={3} style="normal" /></Circle>;
}

// Tier 4 — Searchlight beam
function Searchlight({ x, groundY, phase, sweep }: {
  x: number; groundY: number; phase: number; sweep: SharedValue<number>;
}) {
  const beamPath = useDerivedValue(() => {
    const angle = -Math.PI / 2 + Math.sin(sweep.value * Math.PI * 2 + phase) * 0.4;
    const len = 70;
    const p = Skia.Path.Make();
    p.moveTo(x, groundY - 5);
    p.lineTo(x + Math.cos(angle - 0.08) * len, groundY - 5 + Math.sin(angle - 0.08) * len);
    p.lineTo(x + Math.cos(angle + 0.08) * len, groundY - 5 + Math.sin(angle + 0.08) * len);
    p.close();
    return p;
  });
  return <Path path={beamPath} color={CITY_COLORS.searchlight}><BlurMask blur={8} style="normal" /></Path>;
}

// Tier 5 — Flying saucer
function FlyingSaucer({ centerX, centerY, phase, orbitR, progress }: {
  centerX: number; centerY: number; phase: number; orbitR: number; progress: SharedValue<number>;
}) {
  const sx = useDerivedValue(() => centerX + Math.sin(progress.value * Math.PI * 2 + phase) * orbitR);
  const sy = useDerivedValue(() => centerY + Math.cos(progress.value * Math.PI * 2 + phase) * orbitR * 0.3);
  const beamOp = useDerivedValue(() => 0.08 + Math.sin(progress.value * Math.PI * 6 + phase) * 0.04);
  const saucerGlowOp = useDerivedValue(() => 0.4 + Math.sin(progress.value * Math.PI * 8) * 0.2);
  const beamX = useDerivedValue(() => sx.value - 4);
  return (
    <Group>
      <Circle cx={sx} cy={sy} r={5} color={CITY_COLORS.saucerBody} />
      <Circle cx={sx} cy={sy} r={8} color={CITY_COLORS.saucerGlow} opacity={saucerGlowOp}>
        <BlurMask blur={6} style="normal" />
      </Circle>
      <Rect x={beamX} y={sy} width={8} height={40} color={CITY_COLORS.saucerBeam} opacity={beamOp}>
        <BlurMask blur={5} style="normal" />
      </Rect>
    </Group>
  );
}

// Tier 5 — Holo-billboard
function HoloBillboard({ x, y, w, h, phase, pulse }: {
  x: number; y: number; w: number; h: number; phase: number; pulse: SharedValue<number>;
}) {
  const glowOp = useDerivedValue(() => 0.15 + Math.sin(pulse.value * Math.PI * 2 + phase) * 0.1);
  const scanY = useDerivedValue(() => y + (pulse.value * h * 3 + phase * h) % h);
  return (
    <Group>
      <Rect x={x} y={y} width={w} height={h} color={CITY_COLORS.holoFrame} />
      <Rect x={x} y={y} width={w} height={h} color={phase % 2 < 1 ? CITY_COLORS.holoGlow1 : CITY_COLORS.holoGlow2} opacity={glowOp}>
        <BlurMask blur={6} style="normal" />
      </Rect>
      {/* Scanline */}
      <Rect x={x} y={scanY} width={w} height={1.5} color={CITY_COLORS.holoScanline} />
    </Group>
  );
}

// Tier 5 — Neon rain drop
function NeonRainDrop({ x, startY, endY, phase, drift }: {
  x: number; startY: number; endY: number; phase: number; drift: SharedValue<number>;
}) {
  const cy = useDerivedValue(() => startY + ((drift.value + phase) % 1) * (endY - startY));
  const op = useDerivedValue(() => 0.15 + Math.sin(drift.value * Math.PI * 4 + phase * 3) * 0.1);
  return <Line p1={vec(x, cy.value)} p2={vec(x, cy.value + 4)} color={CITY_COLORS.neonRainDrop} style="stroke" strokeWidth={1} opacity={op} />;
}

// Tier 5 — Floating platform
function FloatingPlatform({ x, baseY, phase, hover }: {
  x: number; baseY: number; phase: number; hover: SharedValue<number>;
}) {
  const py = useDerivedValue(() => baseY + Math.sin(hover.value * Math.PI * 2 + phase) * 5);
  const beaconOp = useDerivedValue(() => 0.4 + Math.sin(hover.value * Math.PI * 4 + phase) * 0.3);
  const platGlowY = useDerivedValue(() => py.value + 3);
  const platGlowOp = useDerivedValue(() => 0.3);
  const beaconCy = useDerivedValue(() => py.value - 2);
  return (
    <Group>
      <Rect x={x - 8} y={py} width={16} height={3} color={CITY_COLORS.platformBase} />
      <Rect x={x - 8} y={platGlowY} width={16} height={3} color={CITY_COLORS.platformGlow} opacity={platGlowOp}>
        <BlurMask blur={4} style="normal" />
      </Rect>
      <Circle cx={x} cy={beaconCy} r={1.5} color={CITY_COLORS.platformBeacon} opacity={beaconOp} />
    </Group>
  );
}

// ── Seed data for ambient elements ──────────────────────────────────────────

const PARTICLE_ANGLES = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);
const PIGEON_SEEDS = [{ dx: -20, dy: -8, p: 0 }, { dx: 10, dy: -12, p: 1.5 }, { dx: 30, dy: -5, p: 3 }, { dx: -5, dy: -15, p: 4.5 }];
const STEAM_SEEDS = [{ dxFrac: 0.2, p: 0 }, { dxFrac: 0.5, p: 1.2 }, { dxFrac: 0.75, p: 2.5 }];
const NEON_RAIN_SEEDS = Array.from({ length: 20 }, (_, i) => ({ xFrac: 0.03 + (i * 0.049) % 0.94, phase: i * 0.37 }));
const SAUCER_SEEDS = [{ phase: 0, r: 60 }, { phase: 2.1, r: 40 }, { phase: 4.2, r: 50 }];
const PLATFORM_SEEDS = [{ xFrac: 0.15, yFrac: 0.25, p: 0 }, { xFrac: 0.7, yFrac: 0.2, p: 1.5 }, { xFrac: 0.4, yFrac: 0.15, p: 3 }];

// ── Main Component ──────────────────────────────────────────────────────────

export function GPCityInline({
  width, height, gpTotal = 0, gpStreak = 0,
  lastLoggedAt = new Date(), seed = 42, pulseKey = 0,
}: GPCityInlineProps) {
  const tier = getTier(gpTotal);
  const tierConfig = GP_TIERS[tier];
  const decay = getCityDecayProgress(lastLoggedAt);
  const decayShared = useSharedValue(decay);

  useEffect(() => { decayShared.value = withTiming(decay, { duration: 1500 }); }, [decay]);

  const cityData = useMemo(
    () => generateCity(seed, tierConfig.buildingCount, tierConfig.maxFloors, tierConfig.windowDensity, width, height),
    [seed, tier, width, height],
  );

  // ── Ambient animation shared values (all hoisted, always created) ────────
  const windowFlicker = useSharedValue(0);
  const lampGlow = useSharedValue(0);
  const craneSwing = useSharedValue(0);
  const trafficDrift = useSharedValue(0);
  const smokeDrift = useSharedValue(0);
  const pigeonDrift = useSharedValue(0);
  const heliProgress = useSharedValue(0);
  const steamDrift = useSharedValue(0);
  const searchlightSweep = useSharedValue(0);
  const monorailProgress = useSharedValue(0);
  const neonPulse = useSharedValue(0);
  const saucerOrbit = useSharedValue(0);
  const holoPulse = useSharedValue(0);
  const neonRainDrift = useSharedValue(0);
  const platformHover = useSharedValue(0);
  const orbitalSpin = useSharedValue(0);

  useEffect(() => {
    windowFlicker.value = 0;
    windowFlicker.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
    lampGlow.value = 0;
    lampGlow.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false);
    if (tierConfig.hasCranes) { craneSwing.value = 0; craneSwing.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasTraffic) { trafficDrift.value = 0; trafficDrift.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasChimneySmoke) { smokeDrift.value = 0; smokeDrift.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasPigeons) { pigeonDrift.value = 0; pigeonDrift.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasHelicopter) { heliProgress.value = 0; heliProgress.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasSteamVents) { steamDrift.value = 0; steamDrift.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasSearchlights) { searchlightSweep.value = 0; searchlightSweep.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasMonorail) { monorailProgress.value = 0; monorailProgress.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasDynamicLighting) { neonPulse.value = 0; neonPulse.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasFlyingSaucers) { saucerOrbit.value = 0; saucerOrbit.value = withRepeat(withTiming(1, { duration: 12000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasHoloBillboards) { holoPulse.value = 0; holoPulse.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasNeonRain) { neonRainDrift.value = 0; neonRainDrift.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasFloatingPlatforms) { platformHover.value = 0; platformHover.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false); }
    if (tierConfig.hasOrbitalRing) { orbitalSpin.value = 0; orbitalSpin.value = withRepeat(withTiming(1, { duration: 15000, easing: Easing.linear }), -1, false); }
  }, [tier]);

  // ── Pulse animations ────────────────────────────────────────────────────
  const pulseGlowOp = useSharedValue(0);
  const particleProgress = useSharedValue(0);
  const particleOpacity = useSharedValue(0);
  const cityScale = useSharedValue(1);
  const prevPulseKey = useRef(pulseKey);

  useEffect(() => {
    if (pulseKey === prevPulseKey.current) return;
    prevPulseKey.current = pulseKey;
    pulseGlowOp.value = withSequence(withTiming(0.6, { duration: 200 }), withTiming(0.15, { duration: 150 }), withTiming(0.4, { duration: 150 }), withTiming(0, { duration: 500 }));
    particleProgress.value = 0;
    particleOpacity.value = withSequence(withTiming(1, { duration: 50 }), withTiming(1, { duration: 350 }), withTiming(0, { duration: 200 }));
    particleProgress.value = withTiming(1, { duration: 600 });
    cityScale.value = withSequence(withTiming(1.03, { duration: 200 }), withSpring(1, { damping: 8, stiffness: 120 }));
  }, [pulseKey]);

  // ── Derived values (all hoisted — no hooks in JSX) ──────────────────────
  const cityTransform = useDerivedValue(() => [{ scale: cityScale.value }]);
  const neonOp1 = useDerivedValue(() => 0.08 + Math.sin(neonPulse.value * Math.PI * 2) * 0.06);
  const neonOp2 = useDerivedValue(() => 0.06 + Math.sin(neonPulse.value * Math.PI * 2 + 2) * 0.05);
  const neonOp3 = useDerivedValue(() => 0.05 + Math.sin(neonPulse.value * Math.PI * 2 + 4) * 0.04);
  // Orbital ring
  const orbitalOp = useDerivedValue(() => 0.1 + Math.sin(orbitalSpin.value * Math.PI * 2) * 0.05);
  // Energy dome
  const domeOp = useDerivedValue(() => 0.04 + Math.sin(neonPulse.value * Math.PI * 2) * 0.03);
  const domeEdgeOp = useDerivedValue(() => domeOp.value * 1.5);
  // Orbital ring dot
  const orbDotCx = useDerivedValue(() => width / 2 + Math.cos(orbitalSpin.value * Math.PI * 2) * width * 0.3);
  const orbDotCy = useDerivedValue(() => height * 0.12 + Math.sin(orbitalSpin.value * Math.PI * 2) * width * 0.08);
  // Monorail Y
  const monoY = useDerivedValue(() => groundY - 62);
  // Monorail position
  const monoX = useDerivedValue(() => -20 + monorailProgress.value * (width + 40));
  const monoGlowOp = useDerivedValue(() => 0.15 + Math.sin(monorailProgress.value * Math.PI * 6) * 0.08);

  const groundY = cityData.groundY;
  const roadHeight = height * 0.08;
  const tallest = cityData.buildings.length > 0 ? cityData.buildings.reduce((a, b) => a.height > b.height ? a : b) : null;
  const pulseCx = tallest ? tallest.x + tallest.width / 2 : width / 2;
  const pulseCy = tallest ? tallest.y : groundY - 30;

  // Pick buildings for chimney smoke and open signs
  const chimneyBuildings = useMemo(() => cityData.buildings.filter((_, i) => i % 3 === 0).slice(0, 3), [cityData]);
  const signBuildings = useMemo(() => cityData.buildings.filter(b => b.layer === 'fg').slice(0, 2), [cityData]);
  // Pick buildings for holo-billboards and rooftop pools
  const holoBuildingIndices = useMemo(() => cityData.buildings.length > 3 ? [1, 4, 8].filter(i => i < cityData.buildings.length) : [], [cityData]);
  const poolBuildings = useMemo(() => cityData.buildings.filter(b => b.height > 60).slice(0, 2), [cityData]);
  // Searchlight positions
  const searchlightPositions = useMemo(() => cityData.buildings.filter(b => b.height > 80).slice(0, 2).map(b => b.x + b.width / 2), [cityData]);

  return (
    <View style={{ width, height, borderRadius: 10, overflow: 'hidden' }}>
      <Canvas style={{ width, height }}>
        {/* Sky */}
        <Rect x={0} y={0} width={width} height={groundY}>
          <LinearGradient start={vec(0, 0)} end={vec(0, groundY)} colors={[CITY_COLORS.skyTop, CITY_COLORS.skyMid, CITY_COLORS.skyBottom]} />
        </Rect>

        {/* Tier 5 — Energy dome (behind everything) */}
        {tierConfig.hasEnergyDome && (
          <Group>
            <Circle cx={width / 2} cy={groundY} r={width * 0.45} color={CITY_COLORS.domeGlow} opacity={domeOp}><BlurMask blur={30} style="normal" /></Circle>
            <Circle cx={width / 2} cy={groundY} r={width * 0.45} color={CITY_COLORS.domeEdge} opacity={domeEdgeOp} style="stroke" strokeWidth={1} />
          </Group>
        )}

        {/* Tier 5 — Orbital ring */}
        {tierConfig.hasOrbitalRing && (
          <Group>
            <Circle cx={width / 2} cy={height * 0.12} r={width * 0.3} color={CITY_COLORS.orbitalRing} opacity={orbitalOp} style="stroke" strokeWidth={2}>
              <BlurMask blur={4} style="normal" />
            </Circle>
            {/* Orbiting dot */}
            <Circle cx={orbDotCx} cy={orbDotCy} r={2.5} color={CITY_COLORS.orbitalDot} />
          </Group>
        )}

        {/* Tier 5 — Neon rain */}
        {tierConfig.hasNeonRain && NEON_RAIN_SEEDS.map((nr, i) => (
          <NeonRainDrop key={`nr-${i}`} x={nr.xFrac * width} startY={0} endY={groundY} phase={nr.phase} drift={neonRainDrift} />
        ))}

        {/* Tier 5 — Neon glow bands */}
        {tierConfig.hasDynamicLighting && (
          <Group>
            <Rect x={0} y={height * 0.1} width={width} height={height * 0.2} color={CITY_COLORS.neonPink} opacity={neonOp1}><BlurMask blur={25} style="normal" /></Rect>
            <Rect x={width * 0.2} y={height * 0.15} width={width * 0.6} height={height * 0.15} color={CITY_COLORS.neonBlue} opacity={neonOp2}><BlurMask blur={20} style="normal" /></Rect>
            <Rect x={width * 0.3} y={height * 0.05} width={width * 0.4} height={height * 0.1} color={CITY_COLORS.neonPurple} opacity={neonOp3}><BlurMask blur={18} style="normal" /></Rect>
          </Group>
        )}

        {/* Tier 4+ — Ambient skyline glow */}
        {tierConfig.hasAmbientGlow && (
          <Rect x={0} y={groundY - 60} width={width} height={65} color={CITY_COLORS.skylineGlow}><BlurMask blur={20} style="normal" /></Rect>
        )}

        {/* Tier 4 — Searchlights */}
        {tierConfig.hasSearchlights && searchlightPositions.map((slx, i) => (
          <Searchlight key={`slt-${i}`} x={slx} groundY={groundY - 50} phase={i * 1.5} sweep={searchlightSweep} />
        ))}

        {/* Tier 5 — Floating platforms */}
        {tierConfig.hasFloatingPlatforms && PLATFORM_SEEDS.map((pl, i) => (
          <FloatingPlatform key={`fp-${i}`} x={pl.xFrac * width} baseY={pl.yFrac * height} phase={pl.p} hover={platformHover} />
        ))}

        {/* Tier 0 — Empty lot: fence + sign */}
        {tier === 0 && (
          <Group>
            {Array.from({ length: 6 }, (_, i) => {
              const fx = width * 0.2 + i * (width * 0.6 / 5);
              return (
                <Group key={`fence-${i}`}>
                  <Line p1={vec(fx, groundY)} p2={vec(fx, groundY - 15)} color="#8B7355" style="stroke" strokeWidth={1.5} />
                  {i < 5 && <Line p1={vec(fx, groundY - 12)} p2={vec(fx + width * 0.6 / 5, groundY - 12)} color="#8B7355" style="stroke" strokeWidth={1} />}
                  {i < 5 && <Line p1={vec(fx, groundY - 6)} p2={vec(fx + width * 0.6 / 5, groundY - 6)} color="#8B7355" style="stroke" strokeWidth={1} />}
                </Group>
              );
            })}
            <Rect x={width * 0.38} y={groundY - 32} width={width * 0.24} height={14} color="#f59e0b" />
            <Rect x={width * 0.39} y={groundY - 31} width={width * 0.22} height={12} color="#92400e" />
            <Line p1={vec(width * 0.5, groundY - 18)} p2={vec(width * 0.5, groundY)} color="#6b7280" style="stroke" strokeWidth={2} />
          </Group>
        )}

        {/* City group with pulse scale */}
        <Group transform={cityTransform} origin={vec(width / 2, groundY)}>
          {/* Buildings */}
          {cityData.buildings.map((b, i) => (
            <Group key={`bld-${i}`}>
              <Rect x={b.x} y={b.y} width={b.width} height={b.height}
                color={b.layer === 'bg' ? CITY_COLORS.buildingDark : b.layer === 'mid' ? CITY_COLORS.buildingMid : CITY_COLORS.buildingLight} />
              <Rect x={b.x} y={b.y} width={b.width} height={b.height} color={CITY_COLORS.buildingDecay} opacity={decayShared} />
              {b.windows.map((w, wi) => (
                <WindowRect key={`w-${i}-${wi}`} x={w.x} y={w.y} w={w.w} h={w.h} lit={w.lit} flicker={windowFlicker} />
              ))}
            </Group>
          ))}

          {/* Tier 5 — Holo-billboards on building facades */}
          {tierConfig.hasHoloBillboards && holoBuildingIndices.map((bi, i) => {
            const b = cityData.buildings[bi];
            if (!b) return null;
            return <HoloBillboard key={`holo-${i}`} x={b.x + 2} y={b.y + 5} w={b.width - 4} h={12} phase={i * 2} pulse={holoPulse} />;
          })}

          {/* Tier 4 — Rooftop pools */}
          {tierConfig.hasRooftopPools && poolBuildings.map((b, i) => (
            <Rect key={`pool-${i}`} x={b.x + b.width * 0.2} y={b.y + 2} width={b.width * 0.6} height={4} color={CITY_COLORS.poolWater} />
          ))}

          {/* Tier 2 — Water tower (on tallest building) */}
          {tierConfig.hasWaterTower && tallest && (
            <Group>
              <Line p1={vec(tallest.x + tallest.width * 0.35, tallest.y)} p2={vec(tallest.x + tallest.width * 0.35, tallest.y - 8)} color={CITY_COLORS.waterTowerLegs} style="stroke" strokeWidth={1} />
              <Line p1={vec(tallest.x + tallest.width * 0.65, tallest.y)} p2={vec(tallest.x + tallest.width * 0.65, tallest.y - 8)} color={CITY_COLORS.waterTowerLegs} style="stroke" strokeWidth={1} />
              <Rect x={tallest.x + tallest.width * 0.25} y={tallest.y - 14} width={tallest.width * 0.5} height={6} color={CITY_COLORS.waterTower} />
            </Group>
          )}

          {/* Tier 1 — Chimney smoke */}
          {tierConfig.hasChimneySmoke && chimneyBuildings.map((b, bi) => (
            <Group key={`smoke-${bi}`}>
              {[0, 0.3, 0.6].map((phase, pi) => (
                <SmokeParticle key={`sp-${bi}-${pi}`} x={b.x + b.width * 0.7} baseY={b.y} phase={phase} drift={smokeDrift} />
              ))}
            </Group>
          ))}

          {/* Tier 1 — Open signs */}
          {tierConfig.hasOpenSign && signBuildings.map((b, i) => (
            <OpenSign key={`open-${i}`} x={b.x + b.width * 0.3} y={b.y + b.height - 8} flicker={windowFlicker} />
          ))}

          {/* Cranes */}
          {tierConfig.hasCranes && cityData.cranes.map((c, i) => (
            <CraneElement key={`crane-${i}`} {...c} swing={craneSwing} />
          ))}

          {/* Tier 2 — Scaffolding on rightmost building */}
          {tierConfig.hasScaffolding && cityData.buildings.length > 2 && (() => {
            const b = cityData.buildings[cityData.buildings.length - 1];
            return (
              <Group>
                {Array.from({ length: Math.min(4, b.floors) }, (_, i) => {
                  const sy = b.y + i * (b.height / b.floors);
                  return <Line key={`scaf-${i}`} p1={vec(b.x + b.width, sy)} p2={vec(b.x + b.width + 5, sy)} color={CITY_COLORS.scaffold} style="stroke" strokeWidth={1} />;
                })}
                <Line p1={vec(b.x + b.width + 2.5, b.y)} p2={vec(b.x + b.width + 2.5, b.y + b.height)} color={CITY_COLORS.scaffold} style="stroke" strokeWidth={1} />
              </Group>
            );
          })()}
        </Group>

        {/* Ground / Road */}
        <Rect x={0} y={groundY} width={width} height={height - groundY} color={CITY_COLORS.ground} />
        {tierConfig.hasRoads && (
          <Group>
            <Rect x={0} y={groundY + 2} width={width} height={roadHeight} color={CITY_COLORS.road} />
            <Line p1={vec(0, groundY + 2 + roadHeight / 2)} p2={vec(width, groundY + 2 + roadHeight / 2)} color={CITY_COLORS.roadLine} style="stroke" strokeWidth={1} />
            <Rect x={0} y={groundY + 2 + roadHeight} width={width} height={2} color={CITY_COLORS.sidewalk} />
          </Group>
        )}

        {/* Street lights */}
        {tierConfig.hasStreetlights && cityData.streetLights.map((sl, i) => (
          <StreetLightElement key={`sl-${i}`} {...sl} glow={lampGlow} />
        ))}

        {/* Traffic */}
        {tierConfig.hasTraffic && cityData.cars.map((car, i) => (
          <CarElement key={`car-${i}`} {...car} drift={trafficDrift} />
        ))}

        {/* Tier 3 — Steam vents from road */}
        {tierConfig.hasSteamVents && STEAM_SEEDS.map((sv, i) => (
          <SteamVent key={`stm-${i}`} x={sv.dxFrac * width} groundY={groundY} phase={sv.p} drift={steamDrift} />
        ))}

        {/* Tier 2 — Pigeons near rooftops */}
        {tierConfig.hasPigeons && PIGEON_SEEDS.map((pg, i) => (
          <Pigeon key={`pgn-${i}`} x={width * 0.3 + pg.dx} y={groundY - 40 + pg.dy} phase={pg.p} drift={pigeonDrift} />
        ))}

        {/* Tier 3 — Helicopter */}
        {tierConfig.hasHelicopter && <Helicopter canvasWidth={width} skyY={height * 0.15} progress={heliProgress} />}

        {/* Tier 3 — Billboard */}
        {tierConfig.hasBillboard && (
          <Group>
            <Rect x={width * 0.05} y={groundY - 45} width={30} height={18} color={CITY_COLORS.billboardFrame} />
            <Rect x={width * 0.05 + 2} y={groundY - 43} width={26} height={14} color={CITY_COLORS.billboardGlow}>
              <BlurMask blur={3} style="normal" />
            </Rect>
            <Line p1={vec(width * 0.05 + 15, groundY - 27)} p2={vec(width * 0.05 + 15, groundY)} color={CITY_COLORS.billboardFrame} style="stroke" strokeWidth={2} />
          </Group>
        )}

        {/* Tier 4 — Monorail */}
        {tierConfig.hasMonorail && (
          <Group>
            <Line p1={vec(0, groundY - 55)} p2={vec(width, groundY - 55)} color={CITY_COLORS.monorailTrack} style="stroke" strokeWidth={1.5} />
            <Rect x={monoX} y={monoY} width={20} height={7} color={CITY_COLORS.monorailCar} />
            <Rect x={monoX} y={monoY} width={20} height={7} color={CITY_COLORS.monorailGlow} opacity={monoGlowOp}>
              <BlurMask blur={4} style="normal" />
            </Rect>
          </Group>
        )}

        {/* Tier 5 — Flying saucers */}
        {tierConfig.hasFlyingSaucers && SAUCER_SEEDS.map((s, i) => (
          <FlyingSaucer key={`ufo-${i}`} centerX={width / 2} centerY={height * 0.2} phase={s.phase} orbitR={s.r} progress={saucerOrbit} />
        ))}

        {/* Pulse glow */}
        <Rect x={0} y={groundY - 80} width={width} height={85} color={CITY_COLORS.pulseGlow} opacity={pulseGlowOp}><BlurMask blur={15} style="normal" /></Rect>

        {/* Particles */}
        {PARTICLE_ANGLES.map((angle, i) => (
          <Particle key={`p-${i}`} angle={angle} baseCx={pulseCx} baseCy={pulseCy} progress={particleProgress} opacity={particleOpacity} />
        ))}

        {/* Decay overlay */}
        <Rect x={0} y={0} width={width} height={height} color={CITY_COLORS.decayOverlay} opacity={decayShared} />
      </Canvas>
    </View>
  );
}

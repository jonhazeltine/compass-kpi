/**
 * PhoenixBird — Stage 5 creature. Flame-colored energy bird orbiting the canopy.
 * Trailing glow particles behind it.
 */
import React from 'react';
import { Circle, Group, BlurMask, Path } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';

interface PhoenixBirdProps {
  centerX: number;
  centerY: number;
  orbitRx: number;
  orbitRy: number;
  orbit: SharedValue<number>;
  visible: SharedValue<number>;
}

export function PhoenixBird({
  centerX, centerY, orbitRx, orbitRy, orbit, visible,
}: PhoenixBirdProps) {
  // Body position on elliptical orbit
  const bx = useDerivedValue(() => centerX + Math.cos(orbit.value * Math.PI * 2) * orbitRx);
  const by = useDerivedValue(() => centerY + Math.sin(orbit.value * Math.PI * 2) * orbitRy);

  // Wing spread — pulsing
  const wingSpread = useDerivedValue(() => 5 + Math.sin(orbit.value * Math.PI * 12) * 2);

  // Trail particles (3 behind the body)
  const t1x = useDerivedValue(() => centerX + Math.cos((orbit.value - 0.03) * Math.PI * 2) * orbitRx);
  const t1y = useDerivedValue(() => centerY + Math.sin((orbit.value - 0.03) * Math.PI * 2) * orbitRy);
  const t2x = useDerivedValue(() => centerX + Math.cos((orbit.value - 0.06) * Math.PI * 2) * orbitRx);
  const t2y = useDerivedValue(() => centerY + Math.sin((orbit.value - 0.06) * Math.PI * 2) * orbitRy);
  const t3x = useDerivedValue(() => centerX + Math.cos((orbit.value - 0.09) * Math.PI * 2) * orbitRx);
  const t3y = useDerivedValue(() => centerY + Math.sin((orbit.value - 0.09) * Math.PI * 2) * orbitRy);

  // Flame glow
  const flameOp = useDerivedValue(() => (0.5 + Math.sin(orbit.value * Math.PI * 8) * 0.2) * visible.value);
  const bodyOp = useDerivedValue(() => 0.9 * visible.value);

  return (
    <Group>
      {/* Flame glow halo */}
      <Circle cx={bx} cy={by} r={12} color="rgba(255, 152, 0, 0.3)" opacity={flameOp}>
        <BlurMask blur={10} style="normal" />
      </Circle>

      {/* Body */}
      <Circle cx={bx} cy={by} r={3.5} color="#FF6F00" opacity={bodyOp} />
      {/* Hot core */}
      <Circle cx={bx} cy={by} r={1.8} color="#FFAB00" opacity={bodyOp} />

      {/* Wings — left and right offset from body */}
      <Circle cx={useDerivedValue(() => bx.value - wingSpread.value)} cy={by} r={2.5} color="#FF8F00" opacity={flameOp} />
      <Circle cx={useDerivedValue(() => bx.value + wingSpread.value)} cy={by} r={2.5} color="#FF8F00" opacity={flameOp} />

      {/* Trail particles — decreasing opacity and size */}
      <Circle cx={t1x} cy={t1y} r={2.5} color="#FFB300" opacity={useDerivedValue(() => 0.6 * visible.value)} />
      <Circle cx={t2x} cy={t2y} r={1.8} color="#FFC107" opacity={useDerivedValue(() => 0.35 * visible.value)} />
      <Circle cx={t3x} cy={t3y} r={1.2} color="#FFD54F" opacity={useDerivedValue(() => 0.15 * visible.value)} />
    </Group>
  );
}

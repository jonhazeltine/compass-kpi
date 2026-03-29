/**
 * Wisps — Stage 5 creature. 3-5 golden power orbs floating in the canopy.
 * Idle: float + pulse glow.
 */
import React from 'react';
import { Circle, Group, BlurMask } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';

interface WispProps {
  cx: number;
  cy: number;
  phase: number;
  drift: SharedValue<number>;
  visible: SharedValue<number>;
}

function Wisp({ cx: baseCx, cy: baseCy, phase, drift, visible }: WispProps) {
  const x = useDerivedValue(() => baseCx + Math.sin(drift.value * Math.PI * 2 + phase) * 15);
  const y = useDerivedValue(() => baseCy + Math.cos(drift.value * Math.PI * 2 + phase * 1.3) * 10);
  const coreR = useDerivedValue(() => 2.5 + Math.sin(drift.value * Math.PI * 3 + phase) * 0.8);
  const glowR = useDerivedValue(() => 8 + Math.sin(drift.value * Math.PI * 2 + phase) * 3);
  const glowOp = useDerivedValue(() => (0.25 + Math.sin(drift.value * Math.PI * 4 + phase) * 0.15) * visible.value);
  const coreOp = useDerivedValue(() => (0.8 + Math.sin(drift.value * Math.PI * 3 + phase) * 0.15) * visible.value);

  return (
    <Group>
      {/* Outer glow */}
      <Circle cx={x} cy={y} r={glowR} color="#FFD54F" opacity={glowOp}>
        <BlurMask blur={8} style="normal" />
      </Circle>
      {/* Core */}
      <Circle cx={x} cy={y} r={coreR} color="#FFECB3" opacity={coreOp} />
      {/* Hot center */}
      <Circle cx={x} cy={y} r={useDerivedValue(() => coreR.value * 0.4)} color="#FFFFFF" opacity={coreOp} />
    </Group>
  );
}

interface WispsProps {
  centers: { x: number; y: number }[];
  drift: SharedValue<number>;
  visible: SharedValue<number>;
}

export function Wisps({ centers, drift, visible }: WispsProps) {
  return (
    <Group>
      {centers.map((c, i) => (
        <Wisp key={`wisp-${i}`} cx={c.x} cy={c.y} phase={i * 1.3} drift={drift} visible={visible} />
      ))}
    </Group>
  );
}

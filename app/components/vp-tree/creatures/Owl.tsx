/**
 * Owl — Stage 3+ creature. Flies down from above on entrance.
 * Idle: periodic blink.
 */
import React from 'react';
import { Circle, Line, Group, vec } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';

interface OwlProps {
  x: number;
  y: number;
  visible: SharedValue<number>;
  blink: SharedValue<number>;
  /** Entrance offset — flies down from above (negative = above) */
  entranceY?: SharedValue<number>;
}

export function Owl({ x, y, visible, blink, entranceY }: OwlProps) {
  const ay = useDerivedValue(() => y + (entranceY ? entranceY.value : 0));
  const eyeR = useDerivedValue(() => {
    const t = blink.value % 1;
    if (t > 0.45 && t < 0.55) return 0.3;
    return 1.5;
  });
  const eyeLeftY = useDerivedValue(() => ay.value - 1.5);
  const eyeRightY = useDerivedValue(() => ay.value - 1.5);
  const beakY = useDerivedValue(() => ay.value + 0.5);
  const bellyY = useDerivedValue(() => ay.value + 1.5);
  const earTopY = useDerivedValue(() => ay.value - 8);
  const earBaseY = useDerivedValue(() => ay.value - 4);

  return (
    <Group opacity={visible}>
      <Circle cx={x} cy={ay} r={5} color="#6D4C2A" />
      <Circle cx={x} cy={bellyY} r={3.5} color="#8B6914" />
      <Circle cx={x - 2} cy={eyeLeftY} r={2} color="#FFF8DC" />
      <Circle cx={x - 2} cy={eyeLeftY} r={eyeR} color="#1a1a1a" />
      <Circle cx={x + 2} cy={eyeRightY} r={2} color="#FFF8DC" />
      <Circle cx={x + 2} cy={eyeRightY} r={eyeR} color="#1a1a1a" />
      <Circle cx={x} cy={beakY} r={1} color="#D4A017" />
      <Line p1={vec(x - 3, y - 4)} p2={vec(x - 4.5, y - 8)} color="#6D4C2A" style="stroke" strokeWidth={1.5} strokeCap="round" />
      <Line p1={vec(x + 3, y - 4)} p2={vec(x + 4.5, y - 8)} color="#6D4C2A" style="stroke" strokeWidth={1.5} strokeCap="round" />
    </Group>
  );
}

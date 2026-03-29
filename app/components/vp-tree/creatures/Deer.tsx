/**
 * Deer — Stage 4+ creature. Walks in from the left on entrance.
 * Idle: breathing pulse.
 */
import React from 'react';
import { Circle, Line, Group, Rect, vec } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';

interface DeerProps {
  x: number;
  y: number;
  visible: SharedValue<number>;
  headBob: SharedValue<number>;
  /** Entrance offset — walks in from left (negative = offscreen left) */
  entranceX?: SharedValue<number>;
}

export function Deer({ x, y, visible, headBob, entranceX }: DeerProps) {
  const ax = useDerivedValue(() => x + (entranceX ? entranceX.value : 0));
  const bodyOp = useDerivedValue(() => (0.85 + Math.sin(headBob.value * Math.PI * 2) * 0.1) * visible.value);
  const headX = useDerivedValue(() => ax.value + 8);
  const headY = y - 14;

  return (
    <Group opacity={bodyOp}>
      <Rect x={useDerivedValue(() => ax.value - 5)} y={y - 9} width={12} height={8} color="#6D4C2A" />
      <Line p1={vec(x - 3, y - 1)} p2={vec(x - 3, y + 4)} color="#5D3A1A" style="stroke" strokeWidth={1.5} />
      <Line p1={vec(x + 0, y - 1)} p2={vec(x + 0, y + 4)} color="#5D3A1A" style="stroke" strokeWidth={1.5} />
      <Line p1={vec(x + 3, y - 1)} p2={vec(x + 3, y + 4)} color="#5D3A1A" style="stroke" strokeWidth={1.5} />
      <Line p1={vec(x + 6, y - 1)} p2={vec(x + 6, y + 4)} color="#5D3A1A" style="stroke" strokeWidth={1.5} />
      <Circle cx={headX} cy={headY} r={3} color="#7D5C3A" />
      <Circle cx={useDerivedValue(() => headX.value + 1.5)} cy={headY - 0.5} r={0.7} color="#1a1a1a" />
      <Circle cx={useDerivedValue(() => headX.value + 3)} cy={headY} r={1} color="#4A3520" />
      {/* Antlers */}
      <Line p1={vec(x + 7, headY - 3)} p2={vec(x + 4, headY - 8)} color="#A0782C" style="stroke" strokeWidth={1} strokeCap="round" />
      <Line p1={vec(x + 4, headY - 8)} p2={vec(x + 2, headY - 6)} color="#A0782C" style="stroke" strokeWidth={1} strokeCap="round" />
      <Line p1={vec(x + 9, headY - 3)} p2={vec(x + 12, headY - 8)} color="#A0782C" style="stroke" strokeWidth={1} strokeCap="round" />
      <Line p1={vec(x + 12, headY - 8)} p2={vec(x + 14, headY - 6)} color="#A0782C" style="stroke" strokeWidth={1} strokeCap="round" />
    </Group>
  );
}

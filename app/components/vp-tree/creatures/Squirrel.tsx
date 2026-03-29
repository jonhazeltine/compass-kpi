/**
 * Squirrel — Stage 1+ creature. Scurries up from below branch on entrance.
 * Idle: tail oscillation.
 */
import React from 'react';
import { Circle, Path, Group } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import { Skia } from '@shopify/react-native-skia';

interface SquirrelProps {
  x: number;
  y: number;
  visible: SharedValue<number>;
  tailWag: SharedValue<number>;
  /** Entrance offset — scurries up from below (positive = below) */
  entranceY?: SharedValue<number>;
}

export function Squirrel({ x, y, visible, tailWag, entranceY }: SquirrelProps) {
  const offsetY = useDerivedValue(() => (entranceY ? entranceY.value : 0));
  const actualY = useDerivedValue(() => y + offsetY.value);
  const headCy = useDerivedValue(() => actualY.value - 3);
  const eyeCy = useDerivedValue(() => actualY.value - 4);

  const tailPath = useDerivedValue(() => {
    const ay = actualY.value;
    const wagOffset = Math.sin(tailWag.value * Math.PI * 2) * 4;
    const p = Skia.Path.Make();
    p.moveTo(x - 2, ay);
    p.quadTo(x - 8, ay - 6 + wagOffset, x - 5, ay - 12 + wagOffset * 0.5);
    return p;
  });

  return (
    <Group opacity={visible}>
      <Circle cx={x} cy={actualY} r={3} color="#8B6914" />
      <Circle cx={x + 4} cy={headCy} r={2.5} color="#A0782C" />
      <Circle cx={x + 5.5} cy={eyeCy} r={0.8} color="#1a1a1a" />
      <Path path={tailPath} color="#8B6914" style="stroke" strokeWidth={2} strokeCap="round" />
    </Group>
  );
}

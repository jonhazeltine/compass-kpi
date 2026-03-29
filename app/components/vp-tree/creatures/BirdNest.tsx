/**
 * BirdNest — Stage 2+ creature. Half-circle bowl with 2-3 eggs.
 * Idle: gentle egg rock.
 */
import React from 'react';
import { Circle, Path, Group } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import { Skia } from '@shopify/react-native-skia';

interface BirdNestProps {
  x: number;
  y: number;
  visible: SharedValue<number>;
  eggRock: SharedValue<number>;
}

export function BirdNest({ x, y, visible, eggRock }: BirdNestProps) {
  // Nest bowl — half-circle arc of interwoven lines
  const nestPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    p.moveTo(x - 8, y - 2);
    p.quadTo(x - 8, y + 5, x, y + 6);
    p.quadTo(x + 8, y + 5, x + 8, y - 2);
    // Cross-hatching
    p.moveTo(x - 6, y + 1);
    p.quadTo(x, y + 4, x + 6, y + 1);
    p.moveTo(x - 5, y + 3);
    p.quadTo(x, y + 5, x + 5, y + 3);
    return p;
  });

  // Eggs with gentle rocking
  const egg1X = useDerivedValue(() => x - 2.5 + Math.sin(eggRock.value * Math.PI * 2) * 0.5);
  const egg2X = useDerivedValue(() => x + 2.5 + Math.sin(eggRock.value * Math.PI * 2 + 1) * 0.5);
  const egg3X = useDerivedValue(() => x + Math.sin(eggRock.value * Math.PI * 2 + 2) * 0.3);

  return (
    <Group opacity={visible}>
      {/* Nest */}
      <Path path={nestPath} color="#8B7355" style="stroke" strokeWidth={1.5} strokeCap="round" />
      {/* Eggs */}
      <Circle cx={egg1X} cy={y + 1} r={2} color="#E8DCC8" />
      <Circle cx={egg2X} cy={y + 1} r={2} color="#F0E6D2" />
      <Circle cx={egg3X} cy={y - 0.5} r={1.8} color="#E8DCC8" />
    </Group>
  );
}

/**
 * ProgressBars — dual Skia progress bars rendered at the top of the canvas.
 *
 * Fast bar (gold): progress toward next zoom/micro milestone, resets often.
 * Slow bar (blue-purple): continuous progress toward next tier threshold.
 */
import React from 'react';
import { Rect, LinearGradient, vec } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';

interface ProgressBarsProps {
  width: number;
  fastProgress: SharedValue<number>;
  slowProgress: SharedValue<number>;
  /** Y offset from top (default 0) */
  y?: number;
}

const BAR_HEIGHT = 3;
const GAP = 1;
const TRACK_ALPHA = 0.15;

export function ProgressBars({
  width,
  fastProgress,
  slowProgress,
  y = 0,
}: ProgressBarsProps) {
  const fastWidth = useDerivedValue(() => Math.max(0, Math.min(1, fastProgress.value)) * width);
  const slowWidth = useDerivedValue(() => Math.max(0, Math.min(1, slowProgress.value)) * width);

  const fastY = y;
  const slowY = y + BAR_HEIGHT + GAP;

  return (
    <>
      {/* Fast bar track */}
      <Rect x={0} y={fastY} width={width} height={BAR_HEIGHT} color="rgba(255, 255, 255, 0.08)" />
      {/* Fast bar fill (gold gradient) */}
      <Rect x={0} y={fastY} width={fastWidth} height={BAR_HEIGHT}>
        <LinearGradient
          start={vec(0, fastY)}
          end={vec(width, fastY)}
          colors={['#f59e0b', '#fbbf24', '#fde68a']}
        />
      </Rect>

      {/* Slow bar track */}
      <Rect x={0} y={slowY} width={width} height={BAR_HEIGHT} color="rgba(255, 255, 255, 0.08)" />
      {/* Slow bar fill (blue-purple gradient) */}
      <Rect x={0} y={slowY} width={slowWidth} height={BAR_HEIGHT}>
        <LinearGradient
          start={vec(0, slowY)}
          end={vec(width, slowY)}
          colors={['#6366f1', '#8b5cf6', '#a78bfa']}
        />
      </Rect>
    </>
  );
}

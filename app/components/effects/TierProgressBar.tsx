/**
 * TierProgressBar — Animated progress meter showing distance to next tier.
 *
 * Sits below each viz card (VP tree / GP city). Shows current tier label,
 * progress fill, and next tier label. Fill animates smoothly when deposits
 * arrive via the deploy phase.
 *
 * The bar exposes its screen position via onPositionMeasured so the deploy
 * animation can target it.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

export type TierType = 'VP' | 'GP';

interface TierProgressBarProps {
  type: TierType;
  /** 0..1 progress within current tier */
  progress: number;
  /** Current tier name (e.g. "Young Sapling") */
  currentTierName: string;
  /** Next tier name (e.g. "Growing Tree"), or null if maxed */
  nextTierName: string | null;
  /** Called with measured screen position for deploy targeting */
  onPositionMeasured?: (x: number, y: number, w: number, h: number) => void;
}

const COLORS = {
  VP: {
    track: 'rgba(74, 222, 128, 0.15)',
    fill: ['#15803d', '#22c55e', '#86efac'],
    glow: '#4ade80',
    text: '#4ade80',
  },
  GP: {
    track: 'rgba(96, 165, 250, 0.15)',
    fill: ['#1e40af', '#3b82f6', '#93c5fd'],
    glow: '#60a5fa',
    text: '#60a5fa',
  },
} as const;

const BAR_HEIGHT = 8;
const BORDER_RADIUS = 4;

export function TierProgressBar({
  type,
  progress,
  currentTierName,
  nextTierName,
  onPositionMeasured,
}: TierProgressBarProps) {
  const barRef = useRef<View>(null);
  const fillAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const colors = COLORS[type];

  // Animate fill toward target progress
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width interpolation needs layout
    }).start();
  }, [progress]);

  // Pulse when progress changes significantly (deploy landing)
  useEffect(() => {
    if (progress > 0.05) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [Math.round(progress * 20)]); // trigger on ~5% increments

  const handleLayout = useCallback(() => {
    barRef.current?.measureInWindow?.((x, y, w, h) => {
      onPositionMeasured?.(x, y, w, h);
    });
  }, [onPositionMeasured]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const glowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const pctText = `${Math.round(progress * 100)}%`;

  return (
    <Animated.View
      ref={barRef}
      onLayout={handleLayout}
      style={[styles.container, { transform: [{ scaleX: pulseScale }] }]}
    >
      {/* Labels row */}
      <View style={styles.labelsRow}>
        <Text style={[styles.tierLabel, { color: colors.text }]} numberOfLines={1}>
          {currentTierName}
        </Text>
        <Text style={[styles.pctLabel, { color: colors.text }]}>{pctText}</Text>
        {nextTierName && (
          <Text style={[styles.tierLabel, styles.nextLabel, { color: 'rgba(255,255,255,0.4)' }]} numberOfLines={1}>
            {nextTierName}
          </Text>
        )}
      </View>

      {/* Bar */}
      <View style={[styles.track, { backgroundColor: colors.track }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: fillAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: colors.fill[1],
            },
          ]}
        >
          {/* Inner gradient shimmer */}
          <View style={[styles.fillHighlight, { backgroundColor: colors.fill[2] }]} />
        </Animated.View>

        {/* Glow pulse overlay */}
        <Animated.View
          style={[
            styles.glowOverlay,
            {
              backgroundColor: colors.glow,
              opacity: glowOpacity,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  labelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tierLabel: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  pctLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginHorizontal: 8,
  },
  nextLabel: {
    textAlign: 'right',
  },
  track: {
    height: BAR_HEIGHT,
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
  },
  fillHighlight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '30%',
    height: '50%',
    borderRadius: BORDER_RADIUS,
    opacity: 0.4,
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS,
  },
});

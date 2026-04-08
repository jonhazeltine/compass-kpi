/**
 * BankAccumulator — Central hub where vortex coins land.
 *
 * Shows accumulated dollar value with a fill-level bar that grows as coins
 * arrive. Pulses on each deposit. After 2s idle, triggers overflow → deploy
 * to VP tree / GP city viz.
 *
 * Exposes its screen position via onLayout + measureInWindow so the vortex
 * engine can target coins to this component.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BankAccumulatorProps {
  /** Current accumulated dollar value */
  value: number;
  /** Number of coin deposits this session (drives fill level) */
  depositCount: number;
  /** Max deposits before overflow (e.g. 50) */
  overflowThreshold: number;
  /** Whether the bank is visible */
  visible: boolean;
  /** Called when overflow triggers (2s idle or threshold hit) */
  onOverflow?: (value: number) => void;
  /** Called after layout with screen position for vortex targeting */
  onPositionMeasured?: (x: number, y: number, w: number, h: number) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BankAccumulator({
  value,
  depositCount,
  overflowThreshold,
  visible,
  onOverflow,
  onPositionMeasured,
}: BankAccumulatorProps) {
  const containerRef = useRef<View>(null);
  const showAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;
  const prevDepositCount = useRef(0);
  const overflowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show/hide animation
  useEffect(() => {
    Animated.timing(showAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 250 : 300,
      easing: visible ? Easing.out(Easing.back(1.4)) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  // Pulse when deposit count increases
  useEffect(() => {
    if (depositCount > prevDepositCount.current && depositCount > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevDepositCount.current = depositCount;
  }, [depositCount]);

  // Fill level animation
  useEffect(() => {
    const fill = Math.min(depositCount / overflowThreshold, 1);
    Animated.timing(fillAnim, {
      toValue: fill,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width % can't use native driver
    }).start();
  }, [depositCount, overflowThreshold]);

  // Overflow timer: 2s after last deposit
  useEffect(() => {
    if (overflowTimer.current) clearTimeout(overflowTimer.current);

    if (depositCount > 0 && visible) {
      // Check threshold
      if (depositCount >= overflowThreshold) {
        onOverflow?.(value);
        return;
      }
      // 2s idle timer
      overflowTimer.current = setTimeout(() => {
        onOverflow?.(value);
      }, 2000);
    }

    return () => {
      if (overflowTimer.current) clearTimeout(overflowTimer.current);
    };
  }, [depositCount, visible, overflowThreshold, value, onOverflow]);

  // Measure position for vortex targeting
  const handleLayout = useCallback(() => {
    containerRef.current?.measureInWindow?.((x, y, w, h) => {
      onPositionMeasured?.(x, y, w, h);
    });
  }, [onPositionMeasured]);

  const containerScale = Animated.multiply(
    showAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.7, 1],
    }),
    pulseAnim,
  );

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Fill color shifts from gold → orange → red as it approaches overflow
  const fillColor = fillAnim.interpolate({
    inputRange: [0, 0.5, 0.85, 1],
    outputRange: ['#f5b40f', '#f5a00f', '#f57b0f', '#f5400f'],
  });

  return (
    <View style={styles.wrapper}>
      <Animated.View
        ref={containerRef}
        onLayout={handleLayout}
        style={[
          styles.container,
          {
            opacity: showAnim,
            transform: [{ scale: containerScale }],
          },
        ]}
      >
        {/* Fill bar (behind content) */}
        <Animated.View
          style={[
            styles.fillBar,
            {
              width: fillWidth as any,
              backgroundColor: fillColor as any,
            },
          ]}
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Coin icon */}
          <View style={styles.coinIcon}>
            <Text style={styles.coinDollar}>$</Text>
          </View>

          {/* Value */}
          <Text style={styles.valueText} numberOfLines={1} adjustsFontSizeToFit>
            {fmtUsd(value)}
          </Text>

          {/* Deposit count badge */}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{depositCount}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginVertical: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: 'rgba(245, 180, 15, 0.25)',
    overflow: 'hidden',
    minWidth: 160,
  },
  fillBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.2,
    borderRadius: 22,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  coinIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#c8960c',
    borderWidth: 2,
    borderColor: '#8a6508',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinDollar: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffd45a',
    marginTop: -1,
  },
  valueText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    minWidth: 70,
  },
  countBadge: {
    backgroundColor: 'rgba(245, 180, 15, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f5b40f',
  },
});

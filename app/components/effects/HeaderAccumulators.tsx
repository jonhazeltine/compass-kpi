/**
 * HeaderAccumulators — Three tiny icons in the header that collect vortex coins.
 *
 * 🪙 (PC) | 🌳 (VP) | 🏙️ (GP)
 *
 * Each shows a count badge when deposits > 0. Coins from KPI taps spiral
 * up to the matching icon. On deploy trigger, coins spray back down to
 * fill the corresponding progress bar.
 *
 * Exposes measured positions via onPositionsMeasured so the vortex engine
 * knows where to target each KPI type.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

// ── Types ────────────────────────────────────────────────────────────────────

export type AccumulatorType = 'PC' | 'VP' | 'GP';

export interface AccumulatorPositions {
  PC: { x: number; y: number; w: number; h: number } | null;
  VP: { x: number; y: number; w: number; h: number } | null;
  GP: { x: number; y: number; w: number; h: number } | null;
}

export interface HeaderAccumulatorsProps {
  /** Deposit counts per type */
  deposits: { PC: number; VP: number; GP: number };
  /** Whether the accumulators strip is visible */
  visible: boolean;
  /** Called with measured screen positions for vortex targeting */
  onPositionsMeasured?: (positions: AccumulatorPositions) => void;
}

// ── Single accumulator icon ─────────────────────────────────────────────────

interface AccIconProps {
  type: AccumulatorType;
  count: number;
  onMeasured?: (x: number, y: number, w: number, h: number) => void;
}

const ICONS: Record<AccumulatorType, string> = {
  PC: '$',
  VP: '🌳',
  GP: '🏙️',
};

const COLORS: Record<AccumulatorType, string> = {
  PC: '#f5b40f',
  VP: '#4ade80',
  GP: '#60a5fa',
};

function AccIcon({ type, count, onMeasured }: AccIconProps) {
  const iconRef = useRef<View>(null);
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(0);

  // Bounce when count increases
  useEffect(() => {
    if (count > prevCount.current && count > 0) {
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.3,
          duration: 80,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevCount.current = count;
  }, [count]);

  const handleLayout = useCallback(() => {
    iconRef.current?.measureInWindow?.((x, y, w, h) => {
      onMeasured?.(x, y, w, h);
    });
  }, [onMeasured]);

  const color = COLORS[type];

  return (
    <Animated.View
      ref={iconRef}
      onLayout={handleLayout}
      style={[
        styles.iconContainer,
        { borderColor: count > 0 ? color : 'rgba(255,255,255,0.15)' },
        { transform: [{ scale: bounceAnim }] },
      ]}
    >
      <Text style={[styles.iconText, type === 'PC' && styles.pcIcon]}>
        {ICONS[type]}
      </Text>

      {/* Count badge */}
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Animated.View>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function HeaderAccumulators({
  deposits,
  visible,
  onPositionsMeasured,
}: HeaderAccumulatorsProps) {
  const positionsRef = useRef<AccumulatorPositions>({ PC: null, VP: null, GP: null });
  const showAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(showAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const makeMeasureHandler = useCallback((type: AccumulatorType) => {
    return (x: number, y: number, w: number, h: number) => {
      positionsRef.current[type] = { x, y, w, h };
      onPositionsMeasured?.({ ...positionsRef.current });
    };
  }, [onPositionsMeasured]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: showAnim,
          transform: [{
            translateY: showAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            }),
          }],
        },
      ]}
    >
      <AccIcon type="PC" count={deposits.PC} onMeasured={makeMeasureHandler('PC')} />
      <AccIcon type="VP" count={deposits.VP} onMeasured={makeMeasureHandler('VP')} />
      <AccIcon type="GP" count={deposits.GP} onMeasured={makeMeasureHandler('GP')} />
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 6,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1f2e',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
  },
  pcIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f5b40f',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1a1f2e',
  },
});

/**
 * CoinAccumulator — Central counter that appears when KPIs are tapped,
 * accumulates coin value, then disappears after disbursement.
 *
 * Uses core RN Animated API (no Reanimated) for native module compatibility.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

export interface CoinAccumulatorProps {
  /** The displayed dollar value (formatted string like "$12,450") */
  displayValue: string;
  /** Animated.Value 0-1 that drives the pop/pulse when coins land */
  pulseAnim: Animated.Value;
  /** Animated.Value tracking total accumulated this session (for glow intensity) */
  sessionTotal: Animated.Value;
  /** Whether the accumulator is visible */
  visible: boolean;
  /** Ref for measuring position (coin flight target) */
  accumulatorRef?: React.RefObject<View | null>;
  /** Called after layout so parent can cache position */
  onLayout?: () => void;
}

export default function CoinAccumulator({
  displayValue,
  pulseAnim,
  sessionTotal,
  visible,
  accumulatorRef,
  onLayout,
}: CoinAccumulatorProps) {
  const showAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(showAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 200 : 350,
      easing: visible ? Easing.out(Easing.back(1.5)) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, showAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });

  const containerScale = Animated.multiply(
    showAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 1],
    }),
    pulseScale,
  );

  return (
    <View style={styles.wrapper}>
      <Animated.View
        ref={accumulatorRef as any}
        onLayout={onLayout}
        style={[
          styles.container,
          {
            opacity: showAnim,
            transform: [{ scale: containerScale }],
          },
        ]}
      >
        <View style={styles.innerContent}>
          {/* Coin icon */}
          <View style={styles.coinIcon}>
            <View style={styles.coinIconInner} />
            <Text style={styles.coinIconDollar}>$</Text>
          </View>

          {/* Value */}
          <Text style={styles.valueText} numberOfLines={1} adjustsFontSizeToFit>
            {displayValue}
          </Text>
        </View>

        {/* Sparkle dots */}
        <View style={[styles.sparkle, styles.sparkle1]} />
        <View style={[styles.sparkle, styles.sparkle2]} />
        <View style={[styles.sparkle, styles.sparkle3]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginVertical: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f2e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: 'rgba(245, 180, 15, 0.3)',
    shadowColor: '#f5b40f',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    overflow: 'visible',
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5b40f',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#d19406',
    shadowColor: '#f5b40f',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  coinIconInner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffd45a',
    borderWidth: 1,
    borderColor: '#efc43d',
  },
  coinIconDollar: {
    fontSize: 14,
    fontWeight: '900',
    color: '#8b6914',
    zIndex: 1,
  },
  valueText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    minWidth: 80,
  },
  sparkle: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 212, 90, 0.7)',
  },
  sparkle1: {
    top: -2,
    right: 12,
  },
  sparkle2: {
    bottom: -1,
    left: 18,
    width: 4,
    height: 4,
  },
  sparkle3: {
    top: 4,
    right: -2,
    width: 3,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});

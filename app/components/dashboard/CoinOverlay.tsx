/**
 * CoinOverlay — Renders flying coins on top of everything.
 *
 * Two coin types:
 *   - incoming: KPI tile → accumulator (phase 1, on tap)
 *   - outgoing: accumulator → bar chart (phase 2, after 2s idle)
 *
 * Must be rendered at the ROOT level of the screen (not nested in ScrollViews)
 * since coins use absolute page coordinates.
 */
import React, { useEffect, useRef, memo } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { ActiveCoin, IncomingCoin, OutgoingCoin } from '../../hooks/useCoinFlight';

interface CoinOverlayProps {
  coins: ActiveCoin[];
}

/** Incoming coin: tile → accumulator */
const IncomingFlyingCoin = memo(function IncomingFlyingCoin({ coin }: { coin: IncomingCoin }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      delay: coin.delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const style = {
    left: coin.startX - 14,
    top: coin.startY - 14,
    opacity: anim.interpolate({
      inputRange: [0, 0.08, 0.7, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      {
        translateX: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, coin.deltaX],
        }),
      },
      {
        translateY: anim.interpolate({
          inputRange: [0, 0.35, 1],
          outputRange: [0, -coin.arcLift, coin.deltaY],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 0.2, 0.6, 1],
          outputRange: [0.5 * coin.scale, 1.15 * coin.scale, 1.1 * coin.scale, 0.7 * coin.scale],
        }),
      },
      { rotate: `${coin.rotation}deg` },
    ],
  };

  return (
    <Animated.View pointerEvents="none" style={[styles.coinWrap, style]}>
      <CoinVisual size={22} />
    </Animated.View>
  );
});

/** Outgoing coin: accumulator → bar chart */
const OutgoingFlyingCoin = memo(function OutgoingFlyingCoin({ coin }: { coin: OutgoingCoin }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      delay: coin.delay,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const style = {
    left: coin.startX - 11,
    top: coin.startY - 11,
    opacity: anim.interpolate({
      inputRange: [0, 0.05, 0.7, 1],
      outputRange: [0, 1, 0.9, 0],
    }),
    transform: [
      {
        translateX: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, coin.deltaX],
        }),
      },
      {
        translateY: anim.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0, -coin.arcLift, coin.deltaY],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0.85 * coin.scale, 1.0 * coin.scale, 0.5 * coin.scale],
        }),
      },
      { rotate: `${coin.rotation}deg` },
    ],
  };

  return (
    <Animated.View pointerEvents="none" style={[styles.coinWrap, style]}>
      <CoinVisual size={18} />
    </Animated.View>
  );
});

/** The actual coin graphic — golden circle with highlight */
function CoinVisual({ size }: { size: number }) {
  const innerSize = Math.round(size * 0.55);
  return (
    <View
      style={[
        styles.coinOuter,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <View
        style={[
          styles.coinInner,
          { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
        ]}
      />
      <View style={styles.coinHighlight} />
    </View>
  );
}

export default function CoinOverlay({ coins }: CoinOverlayProps) {
  if (coins.length === 0) return null;
  return (
    <View style={styles.overlay} pointerEvents="none">
      {coins.map((coin) =>
        coin.type === 'incoming' ? (
          <IncomingFlyingCoin key={coin.id} coin={coin} />
        ) : (
          <OutgoingFlyingCoin key={coin.id} coin={coin} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
  },
  coinWrap: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinOuter: {
    backgroundColor: '#f5b40f',
    borderWidth: 1.5,
    borderColor: '#d19406',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f5b40f',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  coinInner: {
    backgroundColor: '#ffd45a',
    borderWidth: 1,
    borderColor: '#efc43d',
  },
  coinHighlight: {
    position: 'absolute',
    top: '18%',
    left: '20%',
    width: '28%',
    height: '14%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});

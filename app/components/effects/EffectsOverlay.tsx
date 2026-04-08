/**
 * EffectsOverlay — Vortex coin engine using React Native Animated API.
 *
 * Mounted at app root (App.tsx) above SafeAreaView so coordinates from
 * measureInWindow are correct and z-index is above everything.
 *
 * Each coin gets its own Animated.Value with useNativeDriver: true.
 * Spiral keyframes are pre-computed and sent to native once — zero JS
 * cost during animation.
 */
import React, { useEffect, useRef, memo, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { ParticleSlot } from './EffectsContext';

// ── Per-type particle configs ────────────────────────────────────────────────

// color string doubles as type key: 'PC' | 'VP' | 'GP'
const TYPE_CONFIGS = {
  PC: {
    spiralTurns: 2.5,
    spiralRadius: 55,
    size: 18,
  },
  VP: {
    spiralTurns: 3,        // tighter mystical spiral
    spiralRadius: 45,      // narrower — focused energy
    size: 14,              // smaller orbs
  },
  GP: {
    spiralTurns: 2,        // wider, more architectural sweep
    spiralRadius: 65,      // broad arc
    size: 12,              // compact shards
  },
} as const;

function getTypeConfig(color: string) {
  if (color === 'VP') return TYPE_CONFIGS.VP;
  if (color === 'GP') return TYPE_CONFIGS.GP;
  return TYPE_CONFIGS.PC;
}

export const VORTEX_CONFIG = {
  SPIRAL_TURNS: 2.5,
  MAX_SPIRAL_RADIUS: 60,
  COIN_SIZE: 18,
};

// ── Per-type particle visuals ───────────────────────────────────────────────

function ParticleVisual({ type, size }: { type: string; size: number }) {
  if (type === 'VP') {
    // Mystical green life orb — glowing core, soft green outer
    const core = Math.round(size * 0.5);
    return (
      <View style={[typeStyles.vpOuter, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[typeStyles.vpCore, { width: core, height: core, borderRadius: core / 2 }]} />
        <View style={typeStyles.vpShine} />
      </View>
    );
  }

  if (type === 'GP') {
    // Blue crystal/energy shard — electric blue, sharp feel
    const core = Math.round(size * 0.45);
    return (
      <View style={[typeStyles.gpOuter, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[typeStyles.gpCore, { width: core, height: core, borderRadius: core / 2 }]} />
      </View>
    );
  }

  // PC — metallic gold coin with $ embossed
  const inner = Math.round(size * 0.7);
  const fontSize = Math.round(size * 0.45);
  return (
    <View style={[typeStyles.pcOuter, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[typeStyles.pcRim, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        <Text style={[typeStyles.pcSymbol, { fontSize, lineHeight: fontSize + 2 }]}>$</Text>
      </View>
    </View>
  );
}

// ── Single vortex coin (native-driven, zero JS during animation) ────────────

interface VortexCoinProps {
  slot: ParticleSlot;
  id: number;
  onComplete: (id: number) => void;
}

const VortexCoin = memo(function VortexCoin({ slot, id, onComplete }: VortexCoinProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const typeCfg = getTypeConfig(slot.color);

  // Pre-compute spiral keyframes for native interpolation
  const STEPS = 20;
  const inputRange: number[] = [];
  const xOutput: number[] = [];
  const yOutput: number[] = [];
  const scaleOutput: number[] = [];

  const dx = slot.tx - slot.sx;
  const dy = slot.ty - slot.sy;

  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    inputRange.push(t);

    const eased = 1 - (1 - t) * (1 - t) * (1 - t);

    const lx = dx * eased;
    const ly = dy * eased;

    const spiralAngle = slot.angle0 + t * typeCfg.spiralTurns * Math.PI * 2;
    const spiralDecay = (1 - eased) * slot.radius;
    const ox = Math.cos(spiralAngle) * typeCfg.spiralRadius * spiralDecay;
    const oy = Math.sin(spiralAngle) * typeCfg.spiralRadius * spiralDecay;

    xOutput.push(lx + ox);
    yOutput.push(ly + oy);

    let s = 1;
    if (t < 0.15) s = t / 0.15;
    else if (t > 0.8) s = 1 - (t - 0.8) / 0.2;
    scaleOutput.push(s * (slot.size / 8));
  }

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: slot.duration / slot.speed,
      delay: slot.delay,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => onComplete(id));
  }, []);

  const coinSize = typeCfg.size;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.coinWrap,
        {
          left: slot.sx - coinSize / 2,
          top: slot.sy - coinSize / 2,
          opacity: anim.interpolate({
            inputRange: [0, 0.08, 0.7, 1],
            outputRange: [0, 1, 1, 0],
          }),
          transform: [
            { translateX: anim.interpolate({ inputRange, outputRange: xOutput }) },
            { translateY: anim.interpolate({ inputRange, outputRange: yOutput }) },
            { scale: anim.interpolate({ inputRange, outputRange: scaleOutput }) },
          ],
        },
      ]}
    >
      <ParticleVisual type={slot.color} size={coinSize} />
    </Animated.View>
  );
});

// ── Handle ──────────────────────────────────────────────────────────────────

export interface EffectsOverlayHandle {
  startLoop: () => void;
}

interface EffectsOverlayProps {
  pool: React.RefObject<ParticleSlot[]>;
}

// ── Overlay ─────────────────────────────────────────────────────────────────

export const EffectsOverlay = forwardRef<EffectsOverlayHandle, EffectsOverlayProps>(
  function EffectsOverlay({ pool }, ref) {
    const [activeCoins, setActiveCoins] = React.useState<{ slot: ParticleSlot; id: number }[]>([]);
    const nextIdRef = useRef(0);

    const startLoop = useCallback(() => {
      const slots = pool.current;
      if (!slots) return;

      const newCoins: { slot: ParticleSlot; id: number }[] = [];
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].active) {
          newCoins.push({ slot: { ...slots[i] }, id: nextIdRef.current++ });
          slots[i].active = false;
        }
      }

      if (newCoins.length > 0) {
        setActiveCoins((prev) => [...prev, ...newCoins]);
      }
    }, [pool]);

    useImperativeHandle(ref, () => ({ startLoop }), [startLoop]);

    const handleComplete = useCallback((id: number) => {
      setActiveCoins((prev) => prev.filter((c) => c.id !== id));
    }, []);

    if (activeCoins.length === 0) return null;

    return (
      <View style={styles.overlay} pointerEvents="none">
        {activeCoins.map((coin) => (
          <VortexCoin
            key={coin.id}
            slot={coin.slot}
            id={coin.id}
            onComplete={handleComplete}
          />
        ))}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  coinWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const typeStyles = StyleSheet.create({
  // ── PC: metallic gold coin ──
  pcOuter: {
    backgroundColor: '#c8960c',
    borderWidth: 2,
    borderColor: '#8a6508',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pcRim: {
    backgroundColor: '#e8b30e',
    borderWidth: 1.5,
    borderColor: '#d4a00c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pcSymbol: {
    color: '#8a6508',
    fontWeight: '900',
    textAlign: 'center',
    marginTop: -1,
  },

  // ── VP: mystical green life orb ──
  vpOuter: {
    backgroundColor: '#15803d',
    borderWidth: 1.5,
    borderColor: '#0a5c2a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  vpCore: {
    backgroundColor: '#86efac',
    borderWidth: 0.5,
    borderColor: '#4ade80',
  },
  vpShine: {
    position: 'absolute',
    top: '15%',
    left: '20%',
    width: '30%',
    height: '20%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },

  // ── GP: blue energy crystal ──
  gpOuter: {
    backgroundColor: '#1e40af',
    borderWidth: 1.5,
    borderColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  gpCore: {
    backgroundColor: '#93c5fd',
    borderWidth: 0.5,
    borderColor: '#60a5fa',
  },
});

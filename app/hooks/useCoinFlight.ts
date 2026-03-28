/**
 * useCoinFlight — Collect-then-disburse coin animation.
 *
 * Flow:
 *   1. KPI tile tapped → coins stream from tile to accumulator counter
 *   2. Coins accumulate — counter grows, accumulator visible
 *   3. After 2s of no taps → all coins disburse from accumulator to month bars
 *   4. Accumulator disappears after disbursement
 *
 * Coin count scales with KPI value:
 *   - $0-50:    3 coins
 *   - $50-200:  5 coins
 *   - $200-500: 8 coins
 *   - $500+:   12 coins
 */
import { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// ── Types ────────────────────────────────────────────────────────

export interface CoinFlightConfig {
  sourceX: number;
  sourceY: number;
  accumulatorX: number;
  accumulatorY: number;
  barX: number;
  barY: number;
  dollarValue: number;
  monthIndex: number;
}

/** Coin flying from KPI tile to accumulator */
export interface IncomingCoin {
  id: number;
  type: 'incoming';
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  arcLift: number;
  scale: number;
  rotation: number;
  delay: number;
}

/** Coin flying from accumulator to a bar */
export interface OutgoingCoin {
  id: number;
  type: 'outgoing';
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  arcLift: number;
  scale: number;
  rotation: number;
  delay: number;
  monthIndex: number;
}

export type ActiveCoin = IncomingCoin | OutgoingCoin;

export interface CoinFlightResult {
  coins: ActiveCoin[];
  accumulatorPulse: Animated.Value;
  accumulatorSessionTotal: Animated.Value;
  accumulatorDisplayValue: number;
  accumulatorVisible: boolean;
  barBumps: Map<number, Animated.Value>;
  launchCoinBurst: (config: CoinFlightConfig) => void;
  resetSession: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────

function coinCountForValue(dollars: number): number {
  if (dollars <= 0) return 3;
  if (dollars <= 50) return 3;
  if (dollars <= 200) return 5;
  if (dollars <= 500) return 8;
  return 12;
}

function staggerDelay(coinIndex: number, totalCoins: number): number {
  const baseDelay = totalCoins > 8 ? 22 : totalCoins > 5 ? 30 : 40;
  return coinIndex * baseDelay;
}

function vary(base: number, spread: number): number {
  return base + (Math.random() - 0.5) * spread * 2;
}

let nextCoinId = 1;

/** How long to wait after last tap before disbursing (ms) */
const DISBURSE_DELAY = 2000;
/** How long incoming coin flight takes (ms) */
const INCOMING_FLIGHT_MS = 300;
/** How long outgoing coin flight takes (ms) */
const OUTGOING_FLIGHT_MS = 350;

// ── Hook ─────────────────────────────────────────────────────────

export function useCoinFlight(): CoinFlightResult {
  const [coins, setCoins] = useState<ActiveCoin[]>([]);
  const [accumulatorDisplayValue, setAccumulatorDisplayValue] = useState(0);
  const [accumulatorVisible, setAccumulatorVisible] = useState(false);

  const accumulatorPulse = useRef(new Animated.Value(0)).current;
  const accumulatorSessionTotal = useRef(new Animated.Value(0)).current;

  const barBumpsRef = useRef(new Map<number, Animated.Value>());
  const disburseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pending disbursements: monthIndex → { dollarValue, barX, barY, count }
  const pendingRef = useRef<Map<number, { dollarValue: number; barX: number; barY: number; count: number }>>(new Map());
  // Accumulator position (updated each burst for disbursement)
  const accPositionRef = useRef({ x: 190, y: 200 });

  const getOrCreateBarBump = useCallback((monthIndex: number): Animated.Value => {
    let av = barBumpsRef.current.get(monthIndex);
    if (!av) {
      av = new Animated.Value(0);
      barBumpsRef.current.set(monthIndex, av);
    }
    return av;
  }, []);

  const fireHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, []);

  const fireHeavyHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  }, []);

  // ── Disburse: send coins from accumulator to bars ──────────
  const disburse = useCallback(() => {
    const pending = new Map(pendingRef.current);
    pendingRef.current.clear();

    if (pending.size === 0) {
      setAccumulatorVisible(false);
      return;
    }

    const accX = accPositionRef.current.x;
    const accY = accPositionRef.current.y;

    // Heavy haptic at start of disbursement
    fireHeavyHaptic();

    const outgoingCoins: OutgoingCoin[] = [];
    let globalDelay = 0;

    pending.forEach(({ dollarValue, barX, barY, count }, monthIndex) => {
      const numCoins = Math.min(count, 6); // Cap outgoing per month for performance
      const dx = barX - accX;
      const dy = barY - accY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const arcLiftBase = Math.max(25, Math.min(60, dist * 0.18));

      for (let i = 0; i < numCoins; i++) {
        outgoingCoins.push({
          id: nextCoinId++,
          type: 'outgoing',
          startX: accX + vary(0, 6),
          startY: accY + vary(0, 6),
          deltaX: dx + vary(0, 10),
          deltaY: dy + vary(0, 8),
          arcLift: arcLiftBase + vary(0, 12),
          scale: vary(0.9, 0.1),
          rotation: vary(0, 25),
          delay: globalDelay + i * 35,
          monthIndex,
        });
      }
      globalDelay += 40; // Stagger between months
    });

    setCoins((prev) => [...prev, ...outgoingCoins]);

    // Schedule bar bumps + haptics for each month's coins landing
    outgoingCoins.forEach((coin) => {
      const barBumpAnim = getOrCreateBarBump(coin.monthIndex);

      setTimeout(() => {
        fireHaptic();
      }, coin.delay);

      // Land time
      setTimeout(() => {
        barBumpAnim.stopAnimation();
        barBumpAnim.setValue(8);
        Animated.spring(barBumpAnim, {
          toValue: 0,
          friction: 5,
          tension: 180,
          useNativeDriver: false,
        }).start();
      }, coin.delay + OUTGOING_FLIGHT_MS);
    });

    // Final heavy haptic when all coins have landed
    const maxDelay = Math.max(...outgoingCoins.map((c) => c.delay));
    setTimeout(() => {
      fireHeavyHaptic();
    }, maxDelay + OUTGOING_FLIGHT_MS + 50);

    // Clean up outgoing coins and hide accumulator after all animations done
    setTimeout(() => {
      setCoins((prev) => prev.filter((c) => c.type !== 'outgoing'));
      setAccumulatorVisible(false);
      setAccumulatorDisplayValue(0);
      accumulatorSessionTotal.setValue(0);
    }, maxDelay + OUTGOING_FLIGHT_MS + 300);
  }, [accumulatorSessionTotal, fireHaptic, fireHeavyHaptic, getOrCreateBarBump]);

  // ── Launch incoming coins (tile → accumulator) ──────────────
  const launchCoinBurst = useCallback(
    (config: CoinFlightConfig) => {
      const {
        sourceX, sourceY,
        accumulatorX, accumulatorY,
        barX, barY,
        dollarValue, monthIndex,
      } = config;

      // Show accumulator
      setAccumulatorVisible(true);

      // Cache accumulator position for disbursement
      accPositionRef.current = { x: accumulatorX, y: accumulatorY };

      // Reset disburse timer (restarts 2s countdown)
      if (disburseTimerRef.current) {
        clearTimeout(disburseTimerRef.current);
      }
      disburseTimerRef.current = setTimeout(disburse, DISBURSE_DELAY);

      // Track pending disbursement for this month
      const existing = pendingRef.current.get(monthIndex);
      if (existing) {
        existing.dollarValue += dollarValue;
        existing.barX = barX;
        existing.barY = barY;
        existing.count += coinCountForValue(dollarValue);
      } else {
        pendingRef.current.set(monthIndex, {
          dollarValue,
          barX,
          barY,
          count: coinCountForValue(dollarValue),
        });
      }

      // Create incoming coins (tile → accumulator)
      const numCoins = coinCountForValue(dollarValue);
      const dx = accumulatorX - sourceX;
      const dy = accumulatorY - sourceY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const arcLiftBase = Math.max(30, Math.min(80, dist * 0.2));

      const newCoins: IncomingCoin[] = [];
      for (let i = 0; i < numCoins; i++) {
        const delay = staggerDelay(i, numCoins);
        newCoins.push({
          id: nextCoinId++,
          type: 'incoming',
          startX: sourceX + vary(0, 8),
          startY: sourceY + vary(0, 8),
          deltaX: dx + vary(0, 12),
          deltaY: dy + vary(0, 8),
          arcLift: arcLiftBase + vary(0, 15),
          scale: vary(1, 0.15),
          rotation: vary(0, 20),
          delay,
        });
      }

      // Add coins
      setCoins((prev) => {
        const combined = [...prev, ...newCoins];
        return combined.length > 60 ? combined.slice(combined.length - 60) : combined;
      });

      // Schedule haptics + accumulator updates for each coin landing
      const perCoinValue = dollarValue / numCoins;

      newCoins.forEach((coin) => {
        // Launch haptic
        setTimeout(() => {
          fireHaptic();
        }, coin.delay);

        // Land at accumulator
        setTimeout(() => {
          setAccumulatorDisplayValue((prev) => prev + Math.round(perCoinValue));

          // Pulse accumulator
          accumulatorPulse.stopAnimation();
          accumulatorPulse.setValue(0);
          Animated.sequence([
            Animated.timing(accumulatorPulse, {
              toValue: 1,
              duration: 60,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(accumulatorPulse, {
              toValue: 0,
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start();

          fireHaptic();
        }, coin.delay + INCOMING_FLIGHT_MS);

        // Remove incoming coin after landing
        setTimeout(() => {
          setCoins((prev) => prev.filter((c) => c.id !== coin.id));
        }, coin.delay + INCOMING_FLIGHT_MS + 100);
      });
    },
    [accumulatorPulse, disburse, fireHaptic],
  );

  const resetSession = useCallback(() => {
    if (disburseTimerRef.current) {
      clearTimeout(disburseTimerRef.current);
      disburseTimerRef.current = null;
    }
    pendingRef.current.clear();
    setCoins([]);
    setAccumulatorDisplayValue(0);
    setAccumulatorVisible(false);
    accumulatorSessionTotal.setValue(0);
    barBumpsRef.current.forEach((av) => av.setValue(0));
    barBumpsRef.current.clear();
  }, [accumulatorSessionTotal]);

  return {
    coins,
    accumulatorPulse,
    accumulatorSessionTotal,
    accumulatorDisplayValue,
    accumulatorVisible,
    barBumps: barBumpsRef.current,
    launchCoinBurst,
    resetSession,
  };
}

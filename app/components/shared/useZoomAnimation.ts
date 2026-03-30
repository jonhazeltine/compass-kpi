/**
 * useZoomAnimation — zoom-in/zoom-out on Skia Canvas.
 *
 * Wrap canvas content in: Group transform={zoomTransform}
 * Trigger with: zoomTo(target, onHold, onComplete)
 */
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useCallback, useRef } from 'react';
import type { ZoomTarget } from './animationUtils';

interface ZoomAnimationResult {
  /** Transform array to apply to a Skia Group */
  zoomTransform: SharedValue<any>;
  /** Animated origin point — pass to Skia Group origin prop */
  zoomOriginX: SharedValue<number>;
  zoomOriginY: SharedValue<number>;
  /** Trigger a zoom-in to a target point, then zoom back out */
  zoomTo: (target: ZoomTarget, onHold?: () => void, onComplete?: () => void) => void;
  /** 1 during zoom, 0 otherwise */
  isZooming: SharedValue<number>;
  /** Current zoom scale */
  zoomScale: SharedValue<number>;
}

const ZOOM_IN_MS = 600;
const ZOOM_HOLD_MS = 1800;
const ZOOM_OUT_MS = 800;
const ZOOM_SCALE_FACTOR = 2.2;
const PADDING = 30;
const SAFETY_TIMEOUT_MS = 6000;

export function useZoomAnimation(
  canvasWidth: number,
  canvasHeight: number,
): ZoomAnimationResult {
  const zoomScale = useSharedValue(1);
  const zoomOriginX = useSharedValue(canvasWidth / 2);
  const zoomOriginY = useSharedValue(canvasHeight / 2);
  const isZooming = useSharedValue(0);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transform: scale around (originX, originY).
  // Equivalent to: translate(-ox,-oy) → scale(s) → translate(ox,oy)
  // Which in Skia transform array order is:
  //   translate(ox*(1-s), oy*(1-s)) then scale(s)
  const zoomTransform = useDerivedValue(() => {
    const s = zoomScale.value;
    if (s <= 1.001) return [{ scale: 1 }];
    const ox = zoomOriginX.value;
    const oy = zoomOriginY.value;
    return [
      { translateX: ox * (1 - s) },
      { translateY: oy * (1 - s) },
      { scale: s },
    ];
  });

  const zoomTo = useCallback((
    target: ZoomTarget,
    onHold?: () => void,
    onComplete?: () => void,
  ) => {
    // Clamp target to safe canvas bounds so we don't zoom off-screen
    const clampedX = Math.max(PADDING, Math.min(canvasWidth - PADDING, target.x));
    const clampedY = Math.max(PADDING, Math.min(canvasHeight - PADDING, target.y));

    zoomOriginX.value = clampedX;
    zoomOriginY.value = clampedY;
    isZooming.value = 1;

    // Clear any previous safety timer
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);

    // Zoom in → hold → zoom out
    zoomScale.value = withSequence(
      withTiming(ZOOM_SCALE_FACTOR, { duration: ZOOM_IN_MS, easing: Easing.inOut(Easing.cubic) }),
      withDelay(ZOOM_HOLD_MS, withTiming(1, { duration: ZOOM_OUT_MS, easing: Easing.inOut(Easing.cubic) })),
    );

    // Fire onHold when zoom-in completes (detail micro plays at zoomed level)
    if (onHold) {
      setTimeout(onHold, ZOOM_IN_MS + 100);
    }

    // Fire onComplete when fully zoomed out
    const totalMs = ZOOM_IN_MS + ZOOM_HOLD_MS + ZOOM_OUT_MS + 50;
    setTimeout(() => {
      isZooming.value = 0;
      if (onComplete) onComplete();
    }, totalMs);

    // Safety timeout — force reset if something goes wrong
    safetyTimerRef.current = setTimeout(() => {
      if (isZooming.value === 1) {
        zoomScale.value = withTiming(1, { duration: 300 });
        isZooming.value = 0;
      }
    }, SAFETY_TIMEOUT_MS);
  }, [canvasWidth, canvasHeight]);

  return { zoomTransform, zoomOriginX, zoomOriginY, zoomTo, isZooming, zoomScale };
}

/**
 * useZoomAnimation — custom hook for zoom-in/zoom-out on Skia Canvas.
 *
 * Usage:
 *   const { zoomTransform, zoomTo, isZooming } = useZoomAnimation(canvasWidth, canvasHeight);
 *   // Wrap canvas content:  <Group transform={zoomTransform}> ... </Group>
 *   // Trigger:              zoomTo({ x: 150, y: 80, label: 'building' }, onComplete)
 */
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useCallback } from 'react';
import type { ZoomTarget } from './animationUtils';

interface ZoomAnimationResult {
  /** Derived transform array to apply to a Skia Group */
  zoomTransform: SharedValue<any>;
  /** Trigger a zoom-in to a target point, then zoom back out */
  zoomTo: (target: ZoomTarget, onHold?: () => void, onComplete?: () => void) => void;
  /** 1 during zoom, 0 otherwise */
  isZooming: SharedValue<number>;
  /** Current zoom scale (for other components to react) */
  zoomScale: SharedValue<number>;
}

const ZOOM_IN_MS = 600;
const ZOOM_HOLD_MS = 1800;
const ZOOM_OUT_MS = 800;
const ZOOM_SCALE = 2.2;

export function useZoomAnimation(
  canvasWidth: number,
  canvasHeight: number,
): ZoomAnimationResult {
  const zoomScale = useSharedValue(1);
  const zoomOriginX = useSharedValue(canvasWidth / 2);
  const zoomOriginY = useSharedValue(canvasHeight / 2);
  const isZooming = useSharedValue(0);

  // Compute transform: scale around the zoom origin point
  // The Skia Group `origin` prop handles the transform origin,
  // but since origin must be static we compute translate manually.
  const zoomTransform = useDerivedValue(() => {
    const s = zoomScale.value;
    if (s === 1) return [{ scale: 1 }];
    // To zoom into (ox, oy): translate so (ox, oy) maps to canvas center, then scale
    const tx = (canvasWidth / 2 - zoomOriginX.value) * (s - 1) / s;
    const ty = (canvasHeight / 2 - zoomOriginY.value) * (s - 1) / s;
    return [
      { translateX: tx },
      { translateY: ty },
      { scale: s },
    ];
  });

  const zoomTo = useCallback((
    target: ZoomTarget,
    onHold?: () => void,
    onComplete?: () => void,
  ) => {
    // Set origin to target
    zoomOriginX.value = target.x;
    zoomOriginY.value = target.y;
    isZooming.value = 1;

    // Zoom in
    zoomScale.value = withSequence(
      withTiming(ZOOM_SCALE, { duration: ZOOM_IN_MS, easing: Easing.inOut(Easing.cubic) }),
      // Hold at zoom level
      withDelay(ZOOM_HOLD_MS, withTiming(1, { duration: ZOOM_OUT_MS, easing: Easing.inOut(Easing.cubic) })),
    );

    // Fire onHold callback when zoom-in completes (detail micro plays here)
    if (onHold) {
      setTimeout(onHold, ZOOM_IN_MS + 100);
    }

    // Fire onComplete when fully zoomed out
    const totalMs = ZOOM_IN_MS + ZOOM_HOLD_MS + ZOOM_OUT_MS + 50;
    setTimeout(() => {
      isZooming.value = 0;
      if (onComplete) onComplete();
    }, totalMs);
  }, [canvasWidth, canvasHeight]);

  return { zoomTransform, zoomTo, isZooming, zoomScale };
}

/**
 * useBottomNavAnimation — Drives the bottom-nav hide/show transition for thread mode.
 *
 * When `isThreadMode` flips to true, the nav translates down and fades out.
 * When it flips back to false, the nav slides up and fades in.
 *
 * Returns:
 *   - animatedStyle: { transform, opacity } to spread on the nav <Animated.View>
 *   - isNavVisible: boolean — true while the nav is fully or partially visible
 *   - composerBottomInset: the inset to pass to CommsHub's composer when nav is hidden (0)
 *       or visible (measured nav height + lift + gap)
 */
import { useRef, useEffect } from 'react';
import { Animated, Easing, Keyboard, Platform } from 'react-native';

const ANIM_DURATION_MS = 260;

export interface BottomNavAnimationConfig {
  /** true when the comms screen is in a channel_thread or similar full-screen thread */
  isThreadMode: boolean;
  /** measured height of the bottom-nav bar via onLayout */
  navLayoutHeight: number;
  /** lift offset from safe-area bottom */
  navLift: number;
  /** extra padding bottom inside the nav pill */
  navPadBottom: number;
}

export interface BottomNavAnimationResult {
  /** Animated style to apply to the nav wrapper: translateY + opacity */
  animatedStyle: {
    transform: { translateY: Animated.AnimatedInterpolation<number> }[];
    opacity: Animated.AnimatedInterpolation<number>;
  };
  /** Whether the nav is currently visible (use for pointer-events / hit-testing) */
  isNavHidden: boolean;
  /** Composer bottom inset: 0 when nav is hidden, measured value when visible */
  composerBottomInset: number;
}

export function useBottomNavAnimation(config: BottomNavAnimationConfig): BottomNavAnimationResult {
  const { isThreadMode, navLayoutHeight, navLift, navPadBottom } = config;
  // 0 = nav visible, 1 = nav hidden
  const hideAnim = useRef(new Animated.Value(isThreadMode ? 1 : 0)).current;
  const keyboardLiftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(hideAnim, {
      toValue: isThreadMode ? 1 : 0,
      duration: ANIM_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isThreadMode, hideAnim]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      if (isThreadMode) {
        keyboardLiftAnim.setValue(0);
        return;
      }
      const lift = Math.max(0, (event.endCoordinates?.height ?? 0) - navLift);
      Animated.timing(keyboardLiftAnim, {
        toValue: -lift,
        duration: event.duration ?? 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (event) => {
      Animated.timing(keyboardLiftAnim, {
        toValue: 0,
        duration: event.duration ?? 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [isThreadMode, keyboardLiftAnim, navLift]);

  const slideDistance = navLayoutHeight > 0 ? navLayoutHeight + navLift + 20 : 120;

  const animatedStyle = {
    transform: [
      {
        translateY: hideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, slideDistance],
        }),
      },
      {
        translateY: keyboardLiftAnim,
      },
    ],
    opacity: hideAnim.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [1, 0.3, 0],
    }),
  };

  // When nav is hidden, composer sits at the screen edge (0)
  // When visible, composer sits above the nav pill
  const visibleInset = navLayoutHeight > 0
    ? navLift + navLayoutHeight + 36
    : navLift + navPadBottom + 96;

  const composerBottomInset = isThreadMode ? 0 : visibleInset;

  return {
    animatedStyle,
    isNavHidden: isThreadMode,
    composerBottomInset,
  };
}

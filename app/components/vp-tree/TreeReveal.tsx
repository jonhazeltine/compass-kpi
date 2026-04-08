/**
 * TreeReveal — Stage transition with video growth animations.
 *
 * When stage advances by 1: plays the growth transition video, then reveals new image.
 * When stage jumps multiple steps or goes backward: simple crossfade.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image as RNImage, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useVideoPlayer, VideoView } from 'expo-video';

// Transition videos keyed by "from_to"
const TRANSITION_VIDEOS: Record<string, any> = {
  '0_1': require('../../assets/vp-tree/transitions/growth_0_to_1.mp4'),
  '1_2': require('../../assets/vp-tree/transitions/growth_1_to_2.mp4'),
  '2_3': require('../../assets/vp-tree/transitions/growth_2_to_3.mp4'),
  '3_4': require('../../assets/vp-tree/transitions/growth_3_to_4.mp4'),
  '4_5': require('../../assets/vp-tree/transitions/growth_4_to_5.mp4'),
  '5_6': require('../../assets/vp-tree/transitions/growth_5_to_6.mp4'),
  '6_7': require('../../assets/vp-tree/transitions/growth_6_to_7.mp4'),
  '7_8': require('../../assets/vp-tree/transitions/growth_7_to_8.mp4'),
  '8_9': require('../../assets/vp-tree/transitions/growth_8_to_9.mp4'),
};

// ── Video overlay (isolated component for hook safety) ──────────────────────

function VideoOverlay({
  videoSource,
  width,
  height,
  onComplete,
}: {
  videoSource: any;
  width: number;
  height: number;
  onComplete: () => void;
}) {
  const opacity = useSharedValue(0);
  const completedRef = useRef(false);

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
    p.muted = true;
  });

  useEffect(() => {
    completedRef.current = false;
    // Fade in over 600ms
    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });

    player.currentTime = 0;
    player.play();

    const sub = player.addListener('playToEnd', () => {
      if (completedRef.current) return;
      completedRef.current = true;
      // Hard cut — no fade, just switch immediately
      opacity.value = 0;
      runOnJS(onComplete)();
    });

    // Safety timeout
    const timeout = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        opacity.value = withTiming(0, { duration: 600 }, (fin) => {
          if (fin) runOnJS(onComplete)();
        });
      }
    }, 12000);

    return () => {
      sub.remove();
      clearTimeout(timeout);
    };
  }, [videoSource]);

  const style = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    opacity: opacity.value,
    backgroundColor: '#000',
  }));

  return (
    <Animated.View style={[style, { overflow: 'hidden' }]}>
      <VideoView
        player={player}
        style={{ width, height }}
        nativeControls={false}
        contentFit="contain"
      />
    </Animated.View>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface TreeRevealProps {
  source: any;
  stageIndex: number;
  width: number;
  height: number;
  useVideoTransition?: boolean;
}

export function TreeReveal({ source, stageIndex, width, height, useVideoTransition = true }: TreeRevealProps) {
  const [displayedSource, setDisplayedSource] = useState(source);
  const [prevSource, setPrevSource] = useState<any>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [videoSource, setVideoSource] = useState<any>(null);
  const prevStageRef = useRef(stageIndex);

  const oldOpacity = useSharedValue(0);
  const newOpacity = useSharedValue(1);
  const flashOpacity = useSharedValue(0);

  const finishReveal = useCallback(() => {
    setIsAnimating(false);
    setPrevSource(null);
    setVideoSource(null);
  }, []);

  // Video completed — show new image immediately
  const onVideoComplete = useCallback(() => {
    newOpacity.value = 1;
    finishReveal();
  }, []);

  useEffect(() => {
    if (stageIndex === prevStageRef.current) return;
    const fromStage = prevStageRef.current;
    const toStage = stageIndex;
    const goingUp = toStage > fromStage;
    prevStageRef.current = stageIndex;

    setPrevSource(displayedSource);
    setDisplayedSource(source);
    setIsAnimating(true);

    // Check for video (single step forward only)
    const videoKey = `${fromStage}_${toStage}`;
    const hasVideo = useVideoTransition && goingUp && (toStage - fromStage === 1) && TRANSITION_VIDEOS[videoKey];

    if (hasVideo) {
      // Video mode
      setVideoSource(TRANSITION_VIDEOS[videoKey]);
      oldOpacity.value = 1;
      newOpacity.value = 0;
      oldOpacity.value = withTiming(0, { duration: 300 });
      flashOpacity.value = withSequence(
        withTiming(0.2, { duration: 80 }),
        withTiming(0, { duration: 200 }),
      );
    } else {
      // Simple crossfade (no video)
      setVideoSource(null);
      oldOpacity.value = 1;
      newOpacity.value = 0;
      flashOpacity.value = withSequence(
        withTiming(0.3, { duration: 100 }),
        withTiming(0, { duration: 300 }),
      );
      oldOpacity.value = withTiming(0, { duration: 600 });
      newOpacity.value = withDelay(200, withTiming(1, { duration: 600 }, (fin) => {
        if (fin) runOnJS(finishReveal)();
      }));
    }
  }, [source, stageIndex]);

  const oldTreeStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: 0, right: 0, top: 0, bottom: 0,
    opacity: oldOpacity.value,
  }));

  const newTreeStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: 0, right: 0, top: 0, bottom: 0,
    opacity: newOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,220,130,0.5)',
    opacity: flashOpacity.value,
  }));

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      {/* Old tree */}
      {prevSource && isAnimating && (
        <Animated.View style={oldTreeStyle}>
          <RNImage source={prevSource} style={{ width, height }} resizeMode="contain" />
        </Animated.View>
      )}

      {/* New tree */}
      {isAnimating ? (
        <Animated.View style={newTreeStyle}>
          <RNImage source={displayedSource} style={{ width, height }} resizeMode="contain" />
        </Animated.View>
      ) : (
        <View style={StyleSheet.absoluteFill}>
          <RNImage source={displayedSource} style={{ width, height }} resizeMode="contain" />
        </View>
      )}

      {/* Video overlay */}
      {videoSource && isAnimating && (
        <VideoOverlay
          videoSource={videoSource}
          width={width}
          height={height}
          onComplete={onVideoComplete}
        />
      )}

      {/* Flash */}
      <Animated.View style={flashStyle} pointerEvents="none" />
    </View>
  );
}

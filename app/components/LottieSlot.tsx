import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';

type Props = {
  source?: object | number | null;
  size?: number;
  loop?: boolean;
  autoPlay?: boolean;
  fallbackEmoji?: string;
};

export default function LottieSlot({
  source,
  size = 120,
  loop = true,
  autoPlay = true,
  fallbackEmoji = '✨',
}: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {source ? (
        <LottieView source={source as any} autoPlay={autoPlay} loop={loop} style={styles.anim} />
      ) : (
        <Text style={[styles.emoji, { fontSize: Math.round(size * 0.42) }]}>{fallbackEmoji}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  anim: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    lineHeight: 52,
  },
});

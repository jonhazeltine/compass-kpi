/**
 * WizardProgressBar — Animated 4-step progress indicator for Challenge Wizard.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { wiz } from './wizardTheme';

const STEP_LABELS = ['Templates', 'Goal', 'KPIs', 'Launch'];

interface Props {
  currentStep: number; // 0-3
}

export default function WizardProgressBar({ currentStep }: Props) {
  const anim = useRef(new Animated.Value(currentStep)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: currentStep,
      duration: wiz.stepTransitionMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentStep, anim]);

  const progressWidth = anim.interpolate({
    inputRange: [0, STEP_LABELS.length - 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: progressWidth }]} />
      </View>
      <View style={styles.labels}>
        {STEP_LABELS.map((label, idx) => (
          <Text
            key={label}
            style={[
              styles.label,
              idx <= currentStep && styles.labelActive,
              idx === currentStep && styles.labelCurrent,
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: wiz.pagePadding,
    paddingTop: 8,
    paddingBottom: 4,
  },
  track: {
    height: 4,
    backgroundColor: wiz.surfaceBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    backgroundColor: wiz.primary,
    borderRadius: 2,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: wiz.textMuted,
  },
  labelActive: {
    color: wiz.textSecondary,
  },
  labelCurrent: {
    color: wiz.primary,
    fontWeight: '800',
  },
});

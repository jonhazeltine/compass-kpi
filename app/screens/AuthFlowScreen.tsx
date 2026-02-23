import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoginScreen from './LoginScreen';
import OnboardingFlowScreen from './OnboardingFlowScreen';
import {
  colors,
  fontScale,
  lineHeights,
  radii,
  space,
  type,
} from '../theme/tokens';

type AuthStep = 'welcome' | 'projection' | 'measure' | 'onboarding' | 'login' | 'forgot';

const heroAssets = {
  logo: require('../assets/figma/heroes/compass_logo_v1.png'),
  projection: require('../assets/figma/heroes/projection_hero_v1.png'),
  measure: require('../assets/figma/heroes/measure_hero_v1.png'),
} as const;

function ScaledText(props: TextProps) {
  return <Text allowFontScaling maxFontSizeMultiplier={fontScale.maxMultiplier} {...props} />;
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.primaryBtn} onPress={onPress}>
      <ScaledText style={styles.primaryBtnText}>{label}</ScaledText>
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.secondaryBtn} onPress={onPress}>
      <ScaledText style={styles.secondaryBtnText}>{label}</ScaledText>
    </TouchableOpacity>
  );
}

function HeroGraphic({ variant }: { variant: 'welcome' | 'projection' | 'measure' }) {
  if (variant === 'welcome') {
    return (
      <View style={styles.heroArea}>
        <View style={[styles.bubble, styles.bubbleA]} />
        <View style={[styles.bubble, styles.bubbleB]} />
        <View style={[styles.bubble, styles.bubbleC]} />
        <View style={[styles.bubble, styles.bubbleD]} />
        <Image source={heroAssets.logo} style={styles.logoImage} resizeMode="contain" />
      </View>
    );
  }

  return (
    <View style={styles.heroArea}>
      <Image
        source={heroAssets[variant]}
        style={styles.heroImage}
        resizeMode="contain"
      />
    </View>
  );
}

export default function AuthFlowScreen() {
  const [step, setStep] = useState<AuthStep>('welcome');
  const [loginBackStep, setLoginBackStep] = useState<AuthStep>('welcome');

  const openLogin = (backStep: AuthStep) => {
    setLoginBackStep(backStep);
    setStep('login');
  };

  if (step === 'onboarding') {
    return (
      <OnboardingFlowScreen
        onBack={() => setStep('measure')}
        onComplete={() => openLogin('onboarding')}
        onAlreadyHaveAccount={() => openLogin('onboarding')}
      />
    );
  }

  if (step === 'login') {
    return (
      <LoginScreen
        mode="login"
        onBack={() => setStep(loginBackStep)}
        onForgotPassword={() => setStep('forgot')}
      />
    );
  }

  if (step === 'forgot') {
    return <LoginScreen mode="forgot" onBack={() => setStep('login')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {step === 'welcome' ? (
          <View style={styles.stepWrapper}>
            <View>
              <HeroGraphic variant="welcome" />
              <View style={styles.content}>
                <ScaledText style={styles.headline}>What if the work you do today,</ScaledText>
                <ScaledText style={styles.headline}>
                  Could predict the success you will have tomorrow?
                </ScaledText>
              </View>
            </View>
            <View style={styles.footer}>
              <PrimaryButton label="Predict Success" onPress={() => setStep('projection')} />
              <SecondaryButton
                label="Already have an account? Log In"
                onPress={() => openLogin('welcome')}
              />
            </View>
          </View>
        ) : null}

        {step === 'projection' ? (
          <View style={styles.stepWrapper}>
            <View>
              <View style={styles.topRow}>
                <TouchableOpacity onPress={() => setStep('welcome')}>
                  <ScaledText style={styles.backArrow}>‹</ScaledText>
                </TouchableOpacity>
              </View>
              <HeroGraphic variant="projection" />
              <View style={styles.content}>
                <ScaledText style={styles.headline}>
                  To see how your performance creates a projection,
                </ScaledText>
                <ScaledText style={styles.bodyText}>
                  let's start with some basic financial info and your current pipeline.
                </ScaledText>
              </View>
            </View>
            <View style={styles.footer}>
              <PrimaryButton label="Let's Begin" onPress={() => setStep('measure')} />
            </View>
          </View>
        ) : null}

        {step === 'measure' ? (
          <View style={styles.stepWrapper}>
            <View>
              <View style={styles.topRow}>
                <TouchableOpacity onPress={() => setStep('projection')}>
                  <ScaledText style={styles.backArrow}>‹</ScaledText>
                </TouchableOpacity>
              </View>
              <HeroGraphic variant="measure" />
              <View style={styles.content}>
                <ScaledText style={styles.headline}>Measure What Matters</ScaledText>
                <ScaledText style={styles.bodyText}>
                  Many desktop publishing packages and web page editors now use
                </ScaledText>
              </View>
            </View>
            <View style={styles.footer}>
              <PrimaryButton
                label="Personalize Your Performance"
                onPress={() => setStep('onboarding')}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  stepWrapper: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: space.lg,
  },
  topRow: {
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 34,
    color: colors.textPrimary,
    lineHeight: 34,
  },
  heroArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 290,
    marginBottom: 6,
  },
  bubble: {
    position: 'absolute',
    borderRadius: radii.pill,
    opacity: 0.72,
  },
  bubbleA: { top: 24, left: 8, width: 140, height: 140, backgroundColor: '#efe8cf' },
  bubbleB: { top: 16, right: 12, width: 144, height: 144, backgroundColor: '#f3d9d9' },
  bubbleC: { bottom: 28, left: 8, width: 128, height: 128, backgroundColor: '#ded8f5' },
  bubbleD: { bottom: 44, right: 30, width: 92, height: 92, backgroundColor: '#d9efee' },
  logoImage: {
    width: 228,
    height: 108,
  },
  heroImage: {
    width: 300,
    height: 300,
  },
  content: {
    paddingHorizontal: space.xl,
    gap: 8,
    marginBottom: 12,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: type.h1,
    lineHeight: lineHeights.h1,
    fontWeight: '700',
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: type.body,
    lineHeight: lineHeights.body,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: type.button,
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: colors.darkButton,
    borderRadius: radii.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: type.bodySm,
    fontWeight: '600',
  },
});

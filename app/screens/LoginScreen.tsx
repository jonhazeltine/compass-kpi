import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import {
  colors,
  fontScale,
  lineHeights,
  radii,
  space,
  type,
} from '../theme/tokens';

type Props = {
  mode?: 'login' | 'forgot';
  onBack?: () => void;
  onForgotPassword?: () => void;
};

const loginHero = require('../assets/figma/heroes/login_illustration_v1.png');
const logo = require('../assets/figma/heroes/compass_logo_v1.png');

function ScaledText(props: TextProps) {
  return <Text allowFontScaling maxFontSizeMultiplier={fontScale.maxMultiplier} {...props} />;
}

export default function LoginScreen({ mode = 'login', onBack, onForgotPassword }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, resetPassword } = useAuth();

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Email and password required');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign in failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Email required');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      Alert.alert('Check your email', 'Password reset instructions sent.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Reset failed';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <ScaledText style={styles.backText}>← Back</ScaledText>
          </TouchableOpacity>
        ) : null}

        <View>
          {mode === 'login' ? (
            <View style={styles.heroWrap}>
              <Image source={logo} style={styles.logoImage} resizeMode="contain" />
              <Image source={loginHero} style={styles.heroImage} resizeMode="contain" />
            </View>
          ) : null}
          <ScaledText style={styles.title}>
            {mode === 'login' ? 'Login to your account' : 'Forgot password'}
          </ScaledText>
          <ScaledText style={styles.subtitle}>Enter credential to login account</ScaledText>

          <TextInput
            style={styles.input}
            maxFontSizeMultiplier={fontScale.maxMultiplier}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {mode === 'login' ? (
            <>
              <TextInput
                style={styles.input}
                maxFontSizeMultiplier={fontScale.maxMultiplier}
                placeholder="Password"
                placeholderTextColor="#6b7280"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              {onForgotPassword ? (
                <TouchableOpacity onPress={onForgotPassword} style={styles.linkRow}>
                  <ScaledText style={styles.linkText}>Forgot Password?</ScaledText>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <View style={styles.infoRow}>
              <ScaledText style={styles.infoText}>
                Password reset link will be sent to this email
              </ScaledText>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={mode === 'login' ? handleSignIn : handleReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ScaledText style={styles.buttonText}>
              {mode === 'login' ? 'Login' : 'Reset Password'}
            </ScaledText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: 48,
    paddingBottom: 24,
  },
  backBtn: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.textPrimary,
    fontSize: type.body,
    fontWeight: '600',
  },
  title: {
    fontSize: type.title,
    lineHeight: lineHeights.title,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  logoImage: {
    width: 220,
    height: 96,
    marginBottom: 8,
  },
  heroImage: {
    width: 280,
    height: 220,
  },
  subtitle: {
    fontSize: type.body,
    lineHeight: lineHeights.body,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.inputBg,
    padding: 15,
    fontSize: type.body,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  linkRow: {
    alignItems: 'flex-end',
    marginBottom: 18,
  },
  linkText: {
    color: colors.textPrimary,
    textDecorationLine: 'underline',
    fontSize: type.bodySm,
  },
  infoRow: {
    borderRadius: radii.lg,
    backgroundColor: colors.inputBg,
    padding: 14,
    marginBottom: 18,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: type.bodySm,
    lineHeight: lineHeights.bodySm,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radii.lg,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: type.button,
    fontWeight: '600',
  },
});

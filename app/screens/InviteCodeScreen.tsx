import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../lib/supabase';

type InviteType = 'team' | 'coach' | 'challenge';
type RouteTarget = {
  tab?: 'team' | 'coach' | 'challenge';
  screen?: string;
  target_id?: string;
};

type InviteRedeemResult = {
  success: boolean;
  invite_type: InviteType;
  target_id: string;
  route_target?: RouteTarget | null;
  already_joined?: boolean;
};

type Props = {
  onBack: () => void;
  onRedeemSuccess: (result: InviteRedeemResult) => void;
};

export default function InviteCodeScreen({ onBack, onRedeemSuccess }: Props) {
  const { session } = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const onRedeem = async () => {
    if (!session?.access_token) {
      Alert.alert('Invite', 'You are not signed in.');
      return;
    }
    if (!normalizedCode) {
      Alert.alert('Invite', 'Enter an invite code.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/invites/redeem`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: normalizedCode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to redeem invite');
      onRedeemSuccess(body as InviteRedeemResult);
      Alert.alert('Invite redeemed', body.already_joined ? 'You are already connected. Opening destination.' : 'Invite redeemed successfully.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unable to redeem invite';
      setError(message);
      Alert.alert('Invite failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Enter Invite Code</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.helpText}>
          Enter a team, coach, or challenge invite code to join the correct destination automatically.
        </Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="TEAM-XXXX-XXXX"
          style={styles.input}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={onRedeem} disabled={submitting}>
          <Text style={styles.submitText}>{submitting ? 'Redeeming…' : 'Redeem Code'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8edf3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { fontSize: 16, color: '#1f2937', fontWeight: '600' },
  title: { fontSize: 18, color: '#111827', fontWeight: '700' },
  headerSpacer: { width: 44 },
  content: { flex: 1, padding: 20 },
  helpText: { color: '#475569', fontSize: 14, lineHeight: 21, marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#d8dee8',
    borderRadius: 12,
    minHeight: 52,
    fontSize: 18,
    letterSpacing: 0.9,
    fontWeight: '600',
    color: '#1f2937',
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  errorText: { marginTop: 10, color: '#b91c1c', fontSize: 13 },
  submitBtn: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

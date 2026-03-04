import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../lib/supabase';

type Props = {
  onBack: () => void;
};

type LoadState = 'loading' | 'ready' | 'error';

type GoalsDraft = {
  average_price_point: string;
  commission_rate_percent: string;
  last_year_gci: string;
  ytd_gci: string;
  goal_gci_365_days: string;
  goal_deals_closed_365_days: string;
};

const DEFAULT_DRAFT: GoalsDraft = {
  average_price_point: '300000',
  commission_rate_percent: '2.5',
  last_year_gci: '',
  ytd_gci: '',
  goal_gci_365_days: '',
  goal_deals_closed_365_days: '',
};

export default function GoalsScreen({ onBack }: Props) {
  const { session } = useAuth();
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<GoalsDraft>(DEFAULT_DRAFT);

  const loadGoals = useCallback(async () => {
    if (!session?.access_token) {
      setState('error');
      setError('Missing session token.');
      return;
    }
    setState('loading');
    setError(null);
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Failed to load goals');
      const metadata = (body.user_metadata ?? {}) as Record<string, unknown>;
      const toText = (value: unknown, fallback = '') =>
        value === null || value === undefined ? fallback : String(value);
      setDraft({
        average_price_point: toText(metadata.average_price_point, '300000'),
        commission_rate_percent: toText(metadata.commission_rate_percent, '2.5'),
        last_year_gci: toText(metadata.last_year_gci, ''),
        ytd_gci: toText(metadata.ytd_gci, ''),
        goal_gci_365_days: toText(metadata.goal_gci_365_days, ''),
        goal_deals_closed_365_days: toText(metadata.goal_deals_closed_365_days, ''),
      });
      setState('ready');
    } catch (e: unknown) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Failed to load goals');
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  const payload = useMemo(() => {
    const parseNum = (value: string) => {
      if (!value.trim()) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    return {
      average_price_point: parseNum(draft.average_price_point),
      commission_rate_percent: parseNum(draft.commission_rate_percent),
      last_year_gci: parseNum(draft.last_year_gci),
      ytd_gci: parseNum(draft.ytd_gci),
      goal_gci_365_days: parseNum(draft.goal_gci_365_days),
      goal_deals_closed_365_days: parseNum(draft.goal_deals_closed_365_days),
    };
  }, [draft]);

  const onSave = async () => {
    if (!session?.access_token) return;
    if (payload.average_price_point === undefined || payload.average_price_point < 0) {
      Alert.alert('Invalid value', 'Average price point must be a non-negative number.');
      return;
    }
    if (payload.commission_rate_percent === undefined || payload.commission_rate_percent < 0) {
      Alert.alert('Invalid value', 'Commission rate must be a non-negative number.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Failed to save goals');
      Alert.alert('Saved', 'Goals updated.');
      await loadGoals();
    } catch (e: unknown) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Unable to save goals.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Goals</Text>
        <View style={styles.headerSpacer} />
      </View>

      {state === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : null}

      {state === 'error' ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Unable to load goals.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadGoals}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {state === 'ready' ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Average Price Point (USD)</Text>
          <TextInput
            keyboardType="numeric"
            value={draft.average_price_point}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, average_price_point: value }))}
            style={styles.input}
          />

          <Text style={styles.label}>Commission Rate (%)</Text>
          <TextInput
            keyboardType="decimal-pad"
            value={draft.commission_rate_percent}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, commission_rate_percent: value }))}
            style={styles.input}
          />

          <Text style={styles.label}>Last Year GCI</Text>
          <TextInput
            keyboardType="numeric"
            value={draft.last_year_gci}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, last_year_gci: value }))}
            style={styles.input}
            placeholder="Optional"
          />

          <Text style={styles.label}>YTD GCI</Text>
          <TextInput
            keyboardType="numeric"
            value={draft.ytd_gci}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, ytd_gci: value }))}
            style={styles.input}
            placeholder="Optional"
          />

          <Text style={styles.label}>GCI Goal (365 days)</Text>
          <TextInput
            keyboardType="numeric"
            value={draft.goal_gci_365_days}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, goal_gci_365_days: value }))}
            style={styles.input}
            placeholder="Optional"
          />

          <Text style={styles.label}>Deals Closed Goal (365 days)</Text>
          <TextInput
            keyboardType="numeric"
            value={draft.goal_deals_closed_365_days}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, goal_deals_closed_365_days: value }))}
            style={styles.input}
            placeholder="Optional"
          />

          <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={onSave} disabled={saving}>
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Goals'}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  errorText: { color: '#b91c1c', textAlign: 'center' },
  retryBtn: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  content: { padding: 20, paddingBottom: 28 },
  label: { fontSize: 13, color: '#334155', marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#d8dee8',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f8fafc',
    marginBottom: 14,
  },
  saveBtn: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.65 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

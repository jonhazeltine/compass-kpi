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
  onBack?: () => void;
  showHeader?: boolean;
};

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

type ProfileDraft = {
  full_name: string;
  average_price_point: string;
  commission_rate_percent: string;
  last_year_gci: string;
  ytd_gci: string;
  goal_gci_365_days: string;
  goal_deals_closed_365_days: string;
};

const DEFAULT_DRAFT: ProfileDraft = {
  full_name: '',
  average_price_point: '300000',
  commission_rate_percent: '2.5',
  last_year_gci: '',
  ytd_gci: '',
  goal_gci_365_days: '',
  goal_deals_closed_365_days: '',
};

function toDraft(metadata: Record<string, unknown> | null | undefined): ProfileDraft {
  const source = metadata ?? {};
  const toText = (value: unknown, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value);
  };
  return {
    full_name: toText(source.full_name, ''),
    average_price_point: toText(source.average_price_point, '300000'),
    commission_rate_percent: toText(source.commission_rate_percent, '2.5'),
    last_year_gci: toText(source.last_year_gci, ''),
    ytd_gci: toText(source.ytd_gci, ''),
    goal_gci_365_days: toText(source.goal_gci_365_days, ''),
    goal_deals_closed_365_days: toText(source.goal_deals_closed_365_days, ''),
  };
}

export default function ProfileSettingsScreen({ onBack, showHeader = true }: Props) {
  const { session } = useAuth();
  const [state, setState] = useState<LoadState>('loading');
  const [draft, setDraft] = useState<ProfileDraft>(DEFAULT_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const loadProfile = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setState('error');
      setError('Missing session token.');
      return;
    }
    setState('loading');
    setError(null);
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to load profile');
      }
      const metadata = (payload.user_metadata ?? {}) as Record<string, unknown>;
      setDraft(toDraft(metadata));
      const hasContent = Object.keys(metadata).length > 0;
      setState(hasContent ? 'ready' : 'empty');
    } catch (e: unknown) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoadedOnce(true);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!loadedOnce && state === 'loading') {
      void loadProfile();
    }
  }, [loadedOnce, loadProfile, state]);

  const parsedPayload = useMemo(() => {
    const numberOrUndefined = (value: string) => {
      if (!value.trim()) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    return {
      full_name: draft.full_name.trim(),
      average_price_point: numberOrUndefined(draft.average_price_point),
      commission_rate_percent: numberOrUndefined(draft.commission_rate_percent),
      last_year_gci: numberOrUndefined(draft.last_year_gci),
      ytd_gci: numberOrUndefined(draft.ytd_gci),
      goal_gci_365_days: numberOrUndefined(draft.goal_gci_365_days),
      goal_deals_closed_365_days: numberOrUndefined(draft.goal_deals_closed_365_days),
    };
  }, [draft]);

  const onSave = async () => {
    if (!session?.access_token) {
      Alert.alert('Unable to save', 'You are not authenticated.');
      return;
    }
    if (!parsedPayload.full_name) {
      Alert.alert('Missing name', 'Please enter your name.');
      return;
    }
    if (parsedPayload.average_price_point === undefined || parsedPayload.average_price_point < 0) {
      Alert.alert('Invalid average price', 'Enter a valid average price point.');
      return;
    }
    if (
      parsedPayload.commission_rate_percent === undefined ||
      parsedPayload.commission_rate_percent < 0
    ) {
      Alert.alert('Invalid commission', 'Enter a valid commission rate.');
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
        body: JSON.stringify(parsedPayload),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save profile');
      }
      await loadProfile();
      Alert.alert('Saved', 'Profile and goals updated.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save profile';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {showHeader ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Profile & Goals</Text>
          <View style={styles.headerSpacer} />
        </View>
      ) : null}

      {state === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.meta}>Loading profile…</Text>
        </View>
      ) : null}

      {state === 'error' ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Unknown error'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadProfile}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {(state === 'ready' || state === 'empty') ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {state === 'empty' ? (
            <View style={styles.emptyBanner}>
              <Text style={styles.emptyText}>
                No saved profile values yet. Defaults are loaded, then saved when you continue.
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={draft.full_name}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, full_name: value }))}
            placeholder="Your name"
          />

          <Text style={styles.label}>Average Price Point (USD)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={draft.average_price_point}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, average_price_point: value }))}
            placeholder="300000"
          />

          <Text style={styles.label}>Commission Rate (%)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.commission_rate_percent}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, commission_rate_percent: value }))}
            placeholder="2.5"
          />

          <Text style={styles.label}>Last Year's Total GCI</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={draft.last_year_gci}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, last_year_gci: value }))}
            placeholder="Optional"
          />

          <Text style={styles.label}>Current Year-to-Date GCI (Pre-App Baseline)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={draft.ytd_gci}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, ytd_gci: value }))}
            placeholder="Optional"
          />
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>
              Used only to seed initial projections before app usage. Ongoing performance is tracked from logged KPI activity and closings.
            </Text>
          </View>

          <Text style={styles.label}>GCI Goal (next 365 days)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={draft.goal_gci_365_days}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, goal_gci_365_days: value }))}
            placeholder="Optional"
          />

          <Text style={styles.label}>Deals Closed Goal (next 365 days)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={draft.goal_deals_closed_365_days}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, goal_deals_closed_365_days: value }))}
            placeholder="Optional"
          />

          <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={onSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
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
  headerSpacer: { width: 44 },
  back: { fontSize: 16, color: '#1f2937', fontWeight: '600' },
  title: { fontSize: 18, color: '#111827', fontWeight: '700' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  meta: { color: '#4b5563', fontSize: 14 },
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  content: { padding: 20, paddingBottom: 28 },
  emptyBanner: {
    borderRadius: 10,
    backgroundColor: '#eef3ff',
    borderWidth: 1,
    borderColor: '#d8e4ff',
    padding: 10,
    marginBottom: 14,
  },
  emptyText: { color: '#334155', fontSize: 13, lineHeight: 18 },
  infoBanner: {
    borderRadius: 10,
    backgroundColor: '#f6f8fc',
    borderWidth: 1,
    borderColor: '#d8dee8',
    padding: 10,
    marginBottom: 14,
    marginTop: -4,
  },
  infoText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 17,
  },
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
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

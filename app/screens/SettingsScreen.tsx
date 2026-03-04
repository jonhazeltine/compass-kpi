import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../lib/supabase';

type Props = {
  onBack: () => void;
};

type ThemeOption = 'system' | 'light' | 'dark';

export default function SettingsScreen({ onBack }: Props) {
  const { session, signOut, resetUserScopedCaches, devToolsEnabled } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsPushEnabled, setSettingsPushEnabled] = useState(true);
  const [settingsEmailDigest, setSettingsEmailDigest] = useState(false);
  const [settingsTheme, setSettingsTheme] = useState<ThemeOption>('system');

  const loadSettings = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load settings');
      const metadata = (body.user_metadata ?? {}) as Record<string, unknown>;
      setSettingsPushEnabled(metadata.settings_push_enabled === undefined ? true : Boolean(metadata.settings_push_enabled));
      setSettingsEmailDigest(Boolean(metadata.settings_email_digest));
      const theme = String(metadata.settings_theme ?? 'system') as ThemeOption;
      setSettingsTheme(theme === 'light' || theme === 'dark' ? theme : 'system');
    } catch {
      // keep defaults when settings fetch fails
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSettings = async (next?: Partial<{ push: boolean; email: boolean; theme: ThemeOption }>) => {
    if (!session?.access_token) return;
    const push = next?.push ?? settingsPushEnabled;
    const email = next?.email ?? settingsEmailDigest;
    const theme = next?.theme ?? settingsTheme;
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/me`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settings_push_enabled: push,
          settings_email_digest: email,
          settings_theme: theme,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Failed to save settings');
    } catch (e: unknown) {
      Alert.alert('Settings', e instanceof Error ? e.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleThemePress = async (theme: ThemeOption) => {
    setSettingsTheme(theme);
    await saveSettings({ theme });
  };

  const onTogglePush = async (value: boolean) => {
    setSettingsPushEnabled(value);
    await saveSettings({ push: value });
  };

  const onToggleEmailDigest = async (value: boolean) => {
    setSettingsEmailDigest(value);
    await saveSettings({ email: value });
  };

  const onClearCaches = async () => {
    await resetUserScopedCaches();
    Alert.alert('Settings', 'Cached app data cleared.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Push Notifications</Text>
              <Text style={styles.settingSub}>Enable push notifications for activity and messages.</Text>
            </View>
            <Switch value={settingsPushEnabled} onValueChange={onTogglePush} disabled={saving} />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Email Digest</Text>
              <Text style={styles.settingSub}>Receive summary digests by email.</Text>
            </View>
            <Switch value={settingsEmailDigest} onValueChange={onToggleEmailDigest} disabled={saving} />
          </View>

          <Text style={styles.sectionTitle}>Theme</Text>
          <View style={styles.themeRow}>
            {(['system', 'light', 'dark'] as ThemeOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.themeChip, settingsTheme === option ? styles.themeChipActive : null]}
                onPress={() => handleThemePress(option)}
              >
                <Text style={[styles.themeChipLabel, settingsTheme === option ? styles.themeChipLabelActive : null]}>
                  {option[0].toUpperCase()}
                  {option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Runtime</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onClearCaches}>
            <Text style={styles.secondaryBtnText}>Clear Cached App Data</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutBtn} onPress={() => void signOut()}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          {devToolsEnabled ? (
            <View style={styles.devSection}>
              <Text style={styles.devTitle}>Developer Mode</Text>
              <Text style={styles.devSub}>Long-press the LOG button for 3 seconds to open Developer Tools.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 36, gap: 14 },
  settingRow: {
    borderWidth: 1,
    borderColor: '#d9e2ef',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingCopy: { flex: 1, gap: 3 },
  settingTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  settingSub: { fontSize: 13, color: '#64748b' },
  sectionTitle: { fontSize: 13, color: '#475569', fontWeight: '700', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d7deea',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  themeChipActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eef4ff',
  },
  themeChipLabel: { color: '#475569', fontWeight: '600' },
  themeChipLabelActive: { color: '#1d4ed8' },
  secondaryBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d5eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fbff',
  },
  secondaryBtnText: { color: '#1d4ed8', fontWeight: '700', fontSize: 15 },
  signOutBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  signOutText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  devSection: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1d1a2',
    backgroundColor: '#fff7eb',
    padding: 12,
    gap: 4,
  },
  devTitle: { fontSize: 14, color: '#9a3f03', fontWeight: '700' },
  devSub: { fontSize: 13, color: '#92400e', lineHeight: 18 },
});

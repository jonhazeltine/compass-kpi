import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  DevSettings,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL, PERSONA_CREDENTIALS } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type ProbeResult = {
  userEmail: string | null;
  userId: string | null;
  effectiveRole: string | null;
  jwtRoleClaim: string | null;
  rlsProbe: 'pass' | 'fail';
  detail: string;
};

function decodeJwtRoleClaim(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  if (typeof globalThis.atob !== 'function') return null;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(
      globalThis.atob(normalized)
    ) as { role?: unknown; user_metadata?: { role?: unknown } };
    if (typeof payload.role === 'string' && payload.role) return payload.role;
    if (typeof payload.user_metadata?.role === 'string' && payload.user_metadata.role) return payload.user_metadata.role;
    return null;
  } catch {
    return null;
  }
}

export default function DeveloperToolsModal({ visible, onClose }: Props) {
  const {
    session,
    knownPersonaKeys,
    signInAndCachePersonaSession,
    switchPersonaSession,
    cacheCurrentPersonaSession,
    clearPersonaSessions,
    resetUserScopedCaches,
  } = useAuth();

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string>('Ready');
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);

  const personaKeys = useMemo(() => knownPersonaKeys, [knownPersonaKeys]);

  const setAction = useCallback(async (label: string, action: () => Promise<void>) => {
    setBusyAction(label);
    setActionStatus(`Running: ${label}`);
    try {
      await action();
      setActionStatus(`Done: ${label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setActionStatus(`Failed: ${label} (${message})`);
      Alert.alert('Developer tools', message);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const runAuthProbe = useCallback(async () => {
    await setAction('Auth + RLS probe', async () => {
      const [{ data: userData, error: userError }, meResponse, rlsResponse] = await Promise.all([
        supabase.auth.getUser(),
        fetch(`${API_URL}/me`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        }),
        supabase.from('profiles').select('id').limit(1),
      ]);
      if (userError) throw userError;
      const mePayload = (await meResponse.json().catch(() => ({}))) as { role?: string };
      const rlsProbe = rlsResponse.error ? 'fail' : 'pass';
      setProbeResult({
        userEmail: userData.user?.email ?? null,
        userId: userData.user?.id ?? null,
        effectiveRole: mePayload.role ?? null,
        jwtRoleClaim: decodeJwtRoleClaim(session?.access_token),
        rlsProbe,
        detail: rlsResponse.error?.message ?? `rows=${rlsResponse.data?.length ?? 0}`,
      });
    });
  }, [session?.access_token, setAction]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Developer Tools</Text>
              <Text style={styles.badge}>DEV MODE</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.statusText}>{actionStatus}</Text>
          <Text style={styles.metaText}>Current user: {session?.user?.email ?? 'none'}</Text>
          <ScrollView style={styles.scroller} contentContainerStyle={styles.scrollerInner}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Persona Sessions</Text>
              {personaKeys.map((personaKey) => (
                <View key={personaKey} style={styles.personaCard}>
                  <View style={styles.personaTop}>
                    <Text style={styles.personaName}>{personaKey}</Text>
                    <Text style={styles.personaCred}>
                      {PERSONA_CREDENTIALS[personaKey] ? 'credentials ready' : 'no credentials'}
                    </Text>
                  </View>
                  <View style={styles.personaButtons}>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      disabled={busyAction !== null}
                      onPress={() => void setAction(`Sign in + Cache ${personaKey}`, () => signInAndCachePersonaSession(personaKey))}
                    >
                      <Text style={styles.primaryBtnText}>Sign in + Cache</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      disabled={busyAction !== null}
                      onPress={() => void setAction(`Switch to ${personaKey}`, () => switchPersonaSession(personaKey))}
                    >
                      <Text style={styles.secondaryBtnText}>Switch to</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      disabled={busyAction !== null}
                      onPress={() => void setAction(`Cache current as ${personaKey}`, () => cacheCurrentPersonaSession(personaKey))}
                    >
                      <Text style={styles.secondaryBtnText}>Cache current</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Runtime Utilities</Text>
              <View style={styles.utilityRow}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  disabled={busyAction !== null}
                  onPress={() => void setAction('Clear persona vault', () => clearPersonaSessions())}
                >
                  <Text style={styles.secondaryBtnText}>Clear persona vault</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  disabled={busyAction !== null}
                  onPress={() => void setAction('Clear caches', () => resetUserScopedCaches())}
                >
                  <Text style={styles.secondaryBtnText}>Clear caches</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  disabled={busyAction !== null}
                  onPress={() => void runAuthProbe()}
                >
                  <Text style={styles.secondaryBtnText}>Run whoami probe</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  disabled={busyAction !== null}
                  onPress={() => {
                    setActionStatus('Reloading app...');
                    DevSettings.reload();
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Reload app</Text>
                </TouchableOpacity>
              </View>
            </View>

            {probeResult ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Probe Result</Text>
                <Text style={styles.metaText}>Email: {probeResult.userEmail ?? 'none'}</Text>
                <Text style={styles.metaText}>User ID: {probeResult.userId ?? 'none'}</Text>
                <Text style={styles.metaText}>Role (/me): {probeResult.effectiveRole ?? 'unknown'}</Text>
                <Text style={styles.metaText}>Role (JWT): {probeResult.jwtRoleClaim ?? 'unknown'}</Text>
                <Text style={[styles.metaText, probeResult.rlsProbe === 'pass' ? styles.passText : styles.failText]}>
                  RLS probe: {probeResult.rlsProbe.toUpperCase()} ({probeResult.detail})
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '88%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  badge: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  closeBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  statusText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  metaText: {
    marginTop: 6,
    fontSize: 12,
    color: '#475569',
  },
  scroller: {
    marginTop: 10,
    flex: 1,
  },
  scrollerInner: {
    gap: 14,
    paddingBottom: 30,
  },
  section: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: '#f8fafc',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  personaCard: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 10,
    gap: 8,
  },
  personaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personaName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'capitalize',
  },
  personaCred: {
    fontSize: 11,
    color: '#64748b',
  },
  personaButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  utilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  passText: {
    color: '#15803d',
  },
  failText: {
    color: '#b91c1c',
  },
});

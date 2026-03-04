import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../lib/supabase';

type Props = {
  onBack: () => void;
};

type LoadState = 'loading' | 'ready' | 'error';

type ProfileDraft = {
  full_name: string;
  avatar_url: string;
  avatar_preset_id: string;
};

const AVATAR_PRESETS = [
  { id: 'preset_compass_blue', label: 'Compass Blue', tone: '#dbeafe' },
  { id: 'preset_compass_green', label: 'Compass Green', tone: '#dcfce7' },
  { id: 'preset_compass_gold', label: 'Compass Gold', tone: '#fef3c7' },
  { id: 'preset_compass_rose', label: 'Compass Rose', tone: '#ffe4e6' },
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ProfileScreen({ onBack }: Props) {
  const { session } = useAuth();
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft>({
    full_name: '',
    avatar_url: '',
    avatar_preset_id: AVATAR_PRESETS[0].id,
  });

  const loadProfile = useCallback(async () => {
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
      if (!response.ok) throw new Error(body.error ?? 'Failed to load profile');
      const metadata = (body.user_metadata ?? {}) as Record<string, unknown>;
      const fullName =
        typeof metadata.full_name === 'string' && metadata.full_name.trim()
          ? metadata.full_name.trim()
          : (session.user.user_metadata?.full_name as string | undefined) ?? '';
      const avatarPreset =
        typeof metadata.avatar_preset_id === 'string' && metadata.avatar_preset_id.trim()
          ? metadata.avatar_preset_id.trim()
          : AVATAR_PRESETS[0].id;
      const avatarUrl =
        typeof body.avatar_url === 'string' && body.avatar_url.trim()
          ? body.avatar_url.trim()
          : typeof metadata.avatar_url === 'string' && metadata.avatar_url.trim()
            ? metadata.avatar_url.trim()
            : '';
      setDraft({
        full_name: fullName,
        avatar_url: avatarUrl,
        avatar_preset_id: avatarPreset,
      });
      setState('ready');
    } catch (e: unknown) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Failed to load profile');
    }
  }, [session?.access_token, session?.user?.user_metadata?.full_name]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const selectedPresetTone = useMemo(() => {
    return AVATAR_PRESETS.find((preset) => preset.id === draft.avatar_preset_id)?.tone ?? '#dbeafe';
  }, [draft.avatar_preset_id]);

  const onSave = async () => {
    if (!session?.access_token) return;
    if (!draft.full_name.trim()) {
      Alert.alert('Missing name', 'Please enter your full name.');
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
        body: JSON.stringify({
          full_name: draft.full_name.trim(),
          avatar_url: draft.avatar_url.trim() || undefined,
          avatar_preset_id: draft.avatar_preset_id,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Failed to save profile');
      Alert.alert('Saved', 'Profile updated.');
      await loadProfile();
    } catch (e: unknown) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const onUploadAvatar = async () => {
    if (!session?.access_token) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow photo library access to upload an avatar.');
      return;
    }
    const selection = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (selection.canceled || !selection.assets[0]) return;

    const asset = selection.assets[0];
    const fileName = asset.fileName || `avatar-${Date.now()}.jpg`;
    const contentType = asset.mimeType || 'image/jpeg';
    const contentLength = typeof asset.fileSize === 'number' ? asset.fileSize : 0;

    setUploading(true);
    try {
      const uploadSessionResponse = await fetch(`${API_URL}/api/profile/avatar/upload-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_name: fileName,
          content_type: contentType,
          content_length_bytes: contentLength,
        }),
      });
      const uploadSessionBody = await uploadSessionResponse.json();
      if (!uploadSessionResponse.ok) {
        throw new Error(uploadSessionBody.error ?? 'Unable to request avatar upload URL');
      }

      const uploadUrl = String(uploadSessionBody.upload_url ?? '');
      const fileUrl = String(uploadSessionBody.file_url ?? '');
      if (!uploadUrl || !fileUrl) throw new Error('Avatar upload URL payload incomplete');

      const fileResp = await fetch(asset.uri);
      const blob = await fileResp.blob();
      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: blob,
      });
      if (!uploadResp.ok) {
        throw new Error(`Avatar upload failed (${uploadResp.status})`);
      }

      setDraft((prev) => ({ ...prev, avatar_url: fileUrl }));
      Alert.alert('Avatar ready', 'Tap Save to persist your new avatar.');
    } catch (e: unknown) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Unable to upload avatar.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {state === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : null}

      {state === 'error' ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Failed to load profile.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadProfile}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {state === 'ready' ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarSection}>
            <View style={[styles.avatarCircle, { backgroundColor: selectedPresetTone }]}>
              {draft.avatar_url ? (
                <Image source={{ uri: draft.avatar_url }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initialsFromName(draft.full_name)}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.uploadBtn} onPress={onUploadAvatar} disabled={uploading}>
              <Text style={styles.uploadText}>{uploading ? 'Uploading…' : 'Upload Photo'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Avatar Preset</Text>
          <View style={styles.presetRow}>
            {AVATAR_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetChip,
                  draft.avatar_preset_id === preset.id ? styles.presetChipActive : null,
                ]}
                onPress={() => setDraft((prev) => ({ ...prev, avatar_preset_id: preset.id }))}
              >
                <View style={[styles.presetTone, { backgroundColor: preset.tone }]} />
                <Text style={styles.presetLabel}>{preset.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            value={draft.full_name}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, full_name: value }))}
            placeholder="Your full name"
            style={styles.input}
          />

          <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={onSave} disabled={saving}>
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Profile'}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
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
  content: { padding: 20, paddingBottom: 28 },
  errorText: { color: '#b91c1c', textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: { color: '#fff', fontWeight: '700' },
  avatarSection: { alignItems: 'center', marginBottom: 14, gap: 10 },
  avatarCircle: {
    width: 94,
    height: 94,
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 94,
    height: 94,
  },
  avatarInitials: {
    fontSize: 34,
    color: '#1f2937',
    fontWeight: '700',
  },
  uploadBtn: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#b8cae9',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fbff',
  },
  uploadText: { color: '#1d4ed8', fontWeight: '700' },
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
  presetRow: { gap: 8, marginBottom: 14 },
  presetChip: {
    borderWidth: 1,
    borderColor: '#d7deea',
    borderRadius: 12,
    minHeight: 42,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
  },
  presetChipActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  presetTone: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#c4d0e4',
  },
  presetLabel: { color: '#1f2937', fontWeight: '600' },
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

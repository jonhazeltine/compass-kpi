/**
 * LiveSetupSheet — Confirmation sheet before starting a live broadcast.
 *
 * Shows the destination channel name and a "Go Live" button.
 * On confirm → calls `onConfirm()` which starts the session via
 * the useLiveSession hook and opens LiveBroadcastScreen.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LiveProviderMode } from '../../lib/liveSessionTypes';

export interface LiveSetupSheetProps {
  visible: boolean;
  channelName: string;
  providerMode: LiveProviderMode | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LiveSetupSheet({
  visible,
  channelName,
  providerMode,
  busy,
  onConfirm,
  onCancel,
}: LiveSetupSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={st.backdrop} onPress={onCancel}>
        <View />
      </Pressable>
      <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={st.handle} />

        <Text style={st.heading}>Go Live</Text>
        <Text style={st.subtext}>
          You'll start broadcasting to{' '}
          <Text style={st.channelName}>{channelName || 'this channel'}</Text>.
        </Text>

        {providerMode === 'mock' && (
          <View style={st.mockBanner}>
            <Text style={st.mockBannerText}>Mock mode — no real broadcast will be sent</Text>
          </View>
        )}

        <Pressable
          style={[st.goLiveBtn, busy && st.goLiveBtnDisabled]}
          disabled={busy}
          onPress={onConfirm}
        >
          <Text style={st.goLiveBtnText}>{busy ? 'Starting…' : '🔴  Go Live'}</Text>
        </Pressable>

        <Pressable style={st.cancelBtn} onPress={onCancel} disabled={busy}>
          <Text style={st.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    marginBottom: 4,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  channelName: {
    fontWeight: '600',
    color: '#374151',
  },
  mockBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'center',
  },
  mockBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  goLiveBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  goLiveBtnDisabled: {
    opacity: 0.5,
  },
  goLiveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
});

/**
 * ThreadComposer — Modern single-sheet composer for chat threads.
 *
 * Replaces the legacy multi-panel (tools / attach / media / live) system in ThreadView
 * with a streamlined add-sheet that reveals three actions:
 *   1. Photo / Video — native image picker (iOS/Android) or web file input
 *   2. File          — native document picker (iOS/Android) or noop on web
 *   3. Go Live       — starts a live session card in the thread
 *
 * KeyboardAvoidingView lives in the PARENT (CommsHub ThreadView) wrapping
 * the entire scroll+composer region, so the whole chat lifts above the keyboard.
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  commsColors as C,
  commsRadii as R,
  commsType as T,
} from './commsTokens';
import { useThreadPickers } from './useThreadPickers';
import type { PickedFile } from './useThreadPickers';

/* ================================================================
   TYPES
   ================================================================ */

export interface ThreadComposerProps {
  /* ── core ── */
  messageDraft: string;
  onChangeMessageDraft: (text: string) => void;
  onSend: () => void;
  sendDisabled: boolean;
  messageSubmitting: boolean;

  /* ── upload progress ── */
  pendingUpload: {
    fileName: string;
    progress: number;
    status: 'picking' | 'uploading' | 'processing' | 'ready' | 'error';
    error?: string;
    uri?: string;
    contentType?: string;
    thumbnailUri?: string;
    sent?: boolean;
  } | null;
  onSendUploadedMedia: () => void;
  onCancelUpload: () => void;

  /* ── gate ── */
  gateBlocksActions: boolean;

  /* ── file picked callback (parent handles upload pipeline) ── */
  onPickMediaFile?: (file: PickedFile) => void;

  /* ── live session ── */
  onStartLiveSession?: () => void;

  /* ── layout ── */
  bottomInset?: number;
}

/* ================================================================
   COMPONENT
   ================================================================ */

export default function ThreadComposer(props: ThreadComposerProps) {
  const {
    messageDraft, onChangeMessageDraft, onSend, sendDisabled, messageSubmitting,
    pendingUpload, onSendUploadedMedia, onCancelUpload,
    gateBlocksActions, onPickMediaFile, onStartLiveSession,
    bottomInset = 0,
  } = props;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [mediaSending, setMediaSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pickers = useThreadPickers();

  // Reset mediaSending when upload clears
  React.useEffect(() => {
    if (!pendingUpload) setMediaSending(false);
  }, [pendingUpload]);

  const toggleSheet = useCallback(() => setSheetOpen((v) => !v), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  /** Attach — ActionSheet with Photo Library + Files choices */
  const handleAttach = useCallback(() => {
    closeSheet();
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
      return;
    }
    const pickPhoto = async () => {
      const file = await pickers.pickPhotoVideo();
      if (file && onPickMediaFile) onPickMediaFile(file);
    };
    const pickFile = async () => {
      const file = await pickers.pickDocument();
      if (file && onPickMediaFile) onPickMediaFile(file);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Photo Library', 'Files'], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) void pickPhoto(); else if (idx === 2) void pickFile(); },
      );
    } else {
      Alert.alert('Attach', 'Choose a source', [
        { text: 'Photo Library', onPress: () => void pickPhoto() },
        { text: 'Files', onPress: () => void pickFile() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [closeSheet, pickers, onPickMediaFile]);

  /** Camera — launch native camera for photo/video capture */
  const handleCamera = useCallback(async () => {
    closeSheet();
    if (Platform.OS === 'web') return;
    const file = await pickers.launchCamera();
    if (file && onPickMediaFile) onPickMediaFile(file);
  }, [closeSheet, pickers, onPickMediaFile]);

  /** Go Live — triggers live session creation via parent callback */
  const handleGoLive = useCallback(() => {
    closeSheet();
    if (onStartLiveSession) {
      onStartLiveSession();
    } else {
      Alert.alert('Go Live', 'Live streaming is not available right now.');
    }
  }, [closeSheet, onStartLiveSession]);

  const handleSendPress = useCallback(() => {
    closeSheet();
    onSend();
  }, [closeSheet, onSend]);

  const canSend = !sendDisabled && !messageSubmitting && !gateBlocksActions && messageDraft.trim().length > 0;

  return (
    <View style={[st.root, bottomInset > 0 && { paddingBottom: bottomInset }]}>
      {/* ── Upload progress banner ── */}
      {pendingUpload && !pendingUpload.sent ? (() => {
        const isMedia = (pendingUpload.contentType?.startsWith('image/') || pendingUpload.contentType?.startsWith('video/')) && pendingUpload.uri;
        return (
          <View style={st.uploadBanner}>
            {/* ✕ dismiss */}
            <Pressable style={st.uploadDismiss} onPress={onCancelUpload} hitSlop={8}>
              <Text style={st.uploadDismissText}>✕</Text>
            </Pressable>
            {isMedia ? (
              <Image source={{ uri: pendingUpload.thumbnailUri || pendingUpload.uri }} style={st.uploadPreview} resizeMode="cover" />
            ) : (
              <View style={st.uploadRow}>
                <Text style={st.uploadIcon}>
                  {pendingUpload.status === 'uploading' ? '⬆' : pendingUpload.status === 'ready' ? '✓' : pendingUpload.status === 'error' ? '✗' : '⏳'}
                </Text>
                <Text style={st.uploadFileName} numberOfLines={1}>{pendingUpload.fileName}</Text>
              </View>
            )}
            {pendingUpload.status === 'uploading' ? (
              <View style={st.uploadBarTrack}>
                <View style={[st.uploadBarFill, { width: `${Math.round(pendingUpload.progress * 100)}%` as any }]} />
              </View>
            ) : null}
            {pendingUpload.error ? (
              <Text style={st.uploadError}>{pendingUpload.error}</Text>
            ) : null}
            {pendingUpload.status === 'ready' ? (
              <Pressable
                style={[st.uploadSendBtn, mediaSending && st.uploadSendBtnSending]}
                disabled={mediaSending}
                onPress={() => {
                  if (mediaSending) return;
                  setMediaSending(true);
                  onSendUploadedMedia();
                  closeSheet();
                }}
              >
                <Text style={st.uploadSendBtnText}>
                  {mediaSending ? 'Sending…' : 'Send to Thread'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })() : null}

      {/* ── Vertical action menu ── */}
      {sheetOpen ? (
        <View style={st.actionMenu}>
          <Pressable
            style={[st.actionMenuItem, gateBlocksActions && st.actionMenuItemDisabled]}
            disabled={gateBlocksActions}
            onPress={handleAttach}
          >
            <Text style={st.actionMenuIcon}>📎</Text>
            <Text style={st.actionMenuLabel}>Attach</Text>
          </Pressable>
          <Pressable
            style={[st.actionMenuItem, gateBlocksActions && st.actionMenuItemDisabled]}
            disabled={gateBlocksActions}
            onPress={handleCamera}
          >
            <Text style={st.actionMenuIcon}>📷</Text>
            <Text style={st.actionMenuLabel}>Camera</Text>
          </Pressable>
          <Pressable
            style={[st.actionMenuItem, gateBlocksActions && st.actionMenuItemDisabled]}
            disabled={gateBlocksActions}
            onPress={handleGoLive}
          >
            <Text style={st.actionMenuIcon}>📡</Text>
            <Text style={st.actionMenuLabel}>Go Live</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Primary input row: [+] [TextInput] [Send] ── */}
      <View style={st.inputRow}>
        <Pressable
          style={[st.plusBtn, sheetOpen && st.plusBtnActive]}
          onPress={toggleSheet}
          disabled={gateBlocksActions}
        >
          <Text style={[st.plusBtnText, sheetOpen && st.plusBtnTextActive]}>
            {sheetOpen ? '×' : '+'}
          </Text>
        </Pressable>
        <View style={st.inputWrap}>
          <TextInput
            value={messageDraft}
            onChangeText={onChangeMessageDraft}
            placeholder="Write a message…"
            placeholderTextColor={C.textTertiary}
            multiline
            style={st.input}
            editable={!gateBlocksActions && !messageSubmitting}
          />
        </View>
        <Pressable
          style={[st.sendBtn, !canSend && st.sendBtnDisabled]}
          disabled={!canSend}
          onPress={handleSendPress}
        >
          <Text style={st.sendBtnText}>
            {messageSubmitting ? '…' : '➤'}
          </Text>
        </Pressable>
      </View>

      {/* ── Hidden web file input ── */}
      {Platform.OS === 'web' ? (
        <input
          ref={(el) => { fileInputRef.current = el; }}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file && onPickMediaFile) {
              const uri = URL.createObjectURL(file);
              onPickMediaFile({ name: file.name, type: file.type, size: file.size, uri });
            }
            (e.target as HTMLInputElement).value = '';
          }}
        />
      ) : null}
    </View>
  );
}

/* ================================================================
   STYLES
   ================================================================ */

const st = StyleSheet.create({
  root: {
    backgroundColor: C.cardBg,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },

  /* ── input row ── */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBtnActive: {
    backgroundColor: C.brand,
  },
  plusBtnText: {
    fontSize: 22,
    fontWeight: '600',
    color: C.textSecondary,
    lineHeight: 26,
  },
  plusBtnTextActive: {
    color: C.textOnBrand,
  },
  inputWrap: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    borderRadius: R.composer,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: 14,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  input: {
    ...T.composerInput,
    color: C.textPrimary,
    padding: 0,
    margin: 0,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
  sendBtnText: {
    fontSize: 18,
    color: C.textOnBrand,
    fontWeight: '700',
  },

  /* ── floating popover menu ── */
  actionMenu: {
    position: 'absolute',
    bottom: 52,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionMenuItemDisabled: {
    opacity: 0.35,
  },
  actionMenuIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  actionMenuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: C.textPrimary,
  },

  /* ── upload banner ── */
  uploadBanner: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    gap: 6,
    overflow: 'hidden',
  },
  uploadDismiss: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadDismissText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 15,
  },
  uploadPreview: {
    width: '100%' as any,
    aspectRatio: 4 / 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploadIcon: {
    fontSize: 14,
  },
  uploadFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textPrimary,
    flex: 1,
  },
  uploadStatus: {
    fontSize: 11,
    color: C.textTertiary,
  },
  uploadBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  uploadBarFill: {
    height: '100%',
    backgroundColor: C.brand,
    borderRadius: 2,
  },
  uploadError: {
    fontSize: 12,
    color: C.error,
  },
  uploadSendBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.brand,
  },
  uploadSendBtnSending: {
    opacity: 0.5,
  },
  uploadSendBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textOnBrand,
  },
});

/**
 * LiveBroadcastScreen — Full-screen camera broadcast modal.
 *
 * Uses @api.video/react-native-livestream to push an RTMP stream
 * to Mux (or displays a mock camera preview in mock mode).
 *
 * Props:
 *   - streamKey / rtmpUrl: Mux RTMP credentials from the live session
 *   - providerMode: 'mock' → skip real streaming
 *   - channelName: displayed in the top bar
 *   - onEnd: callback when user ends the broadcast
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LiveProviderMode } from '../../lib/liveSessionTypes';

// ── Conditionally import native livestream view ──────────────────────
// On web or when the native module isn't available, we fall back to mock.
let ApiVideoLiveStreamView: React.ComponentType<any> | null = null;
try {
  if (Platform.OS !== 'web') {
    ApiVideoLiveStreamView =
      require('@api.video/react-native-livestream').ApiVideoLiveStreamView;
  }
} catch {
  // Native module not linked — fallback to mock UI
}

export interface LiveBroadcastScreenProps {
  visible: boolean;
  streamKey: string | null;
  rtmpUrl: string | null;
  providerMode: LiveProviderMode | null;
  channelName: string;
  busy: boolean;
  onEnd: () => void;
}

export default function LiveBroadcastScreen({
  visible,
  streamKey,
  rtmpUrl,
  providerMode,
  channelName,
  busy,
  onEnd,
}: LiveBroadcastScreenProps) {
  const insets = useSafeAreaInsets();
  const liveStreamRef = useRef<any>(null);
  const [camera, setCamera] = useState<'front' | 'back'>('front');
  const [isStreaming, setIsStreaming] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMock = providerMode === 'mock' || !ApiVideoLiveStreamView;

  // ── Timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isStreaming) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStreaming]);

  // ── Start streaming on mount (when visible + credentials ready) ───
  useEffect(() => {
    if (!visible || !streamKey) return;
    if (isMock) {
      setIsStreaming(true);
      return;
    }

    // Small delay to let the native camera initialise
    const timeout = setTimeout(() => {
      if (liveStreamRef.current && streamKey) {
        // rtmpUrl from Mux: rtmps://global-live.mux.com:443/app
        // startStreaming expects (streamKey, rtmpUrl?)
        liveStreamRef.current
          .startStreaming(streamKey, rtmpUrl ?? undefined)
          .then(() => setIsStreaming(true))
          .catch((err: unknown) => {
            console.warn('[LiveBroadcast] startStreaming failed:', err);
            setIsStreaming(true); // still show UI so user can end
          });
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [visible, streamKey, rtmpUrl, isMock]);

  // ── End broadcast ──────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    if (!isMock && liveStreamRef.current) {
      try {
        liveStreamRef.current.stopStreaming();
      } catch {
        // ignore
      }
    }
    setIsStreaming(false);
    if (timerRef.current) clearInterval(timerRef.current);
    onEnd();
  }, [isMock, onEnd]);

  // ── Flip camera ────────────────────────────────────────────────────
  const flipCamera = useCallback(() => {
    setCamera((c) => (c === 'front' ? 'back' : 'front'));
  }, []);

  // ── Format elapsed time ────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={st.container}>
        {/* Camera preview / mock placeholder */}
        {isMock ? (
          <View style={st.mockCamera}>
            <Text style={st.mockCameraText}>📷 Mock Camera Preview</Text>
            <Text style={st.mockCameraSubtext}>No real broadcast in mock mode</Text>
          </View>
        ) : ApiVideoLiveStreamView ? (
          <ApiVideoLiveStreamView
            ref={liveStreamRef}
            style={st.cameraPreview}
            camera={camera}
            video={{ fps: 30, resolution: '720p', bitrate: 2_000_000 }}
            audio={{ bitrate: 128_000, sampleRate: 44100, isStereo: true }}
            isMuted={false}
            onConnectionSuccess={() => console.log('[LiveBroadcast] RTMP connected')}
            onConnectionFailed={(code: string) =>
              console.warn('[LiveBroadcast] RTMP connection failed:', code)
            }
            onDisconnect={() => console.log('[LiveBroadcast] RTMP disconnected')}
          />
        ) : null}

        {/* ── Top bar ────────────────────────────────────────────── */}
        <View style={[st.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={st.topBarLeft}>
            {isStreaming && (
              <View style={st.liveBadge}>
                <View style={st.liveDot} />
                <Text style={st.liveBadgeText}>LIVE</Text>
              </View>
            )}
            <Text style={st.elapsedText}>{formatTime(elapsed)}</Text>
          </View>
          <Text style={st.channelLabel} numberOfLines={1}>
            {channelName}
          </Text>
        </View>

        {/* ── Bottom bar ─────────────────────────────────────────── */}
        <View style={[st.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {/* Flip camera */}
          <Pressable style={st.flipBtn} onPress={flipCamera}>
            <Text style={st.flipBtnText}>🔄</Text>
          </Pressable>

          {/* End broadcast */}
          <Pressable
            style={[st.endBtn, busy && st.endBtnDisabled]}
            disabled={busy}
            onPress={handleEnd}
          >
            <Text style={st.endBtnText}>{busy ? 'Ending…' : 'End Broadcast'}</Text>
          </Pressable>

          {/* Spacer to balance layout */}
          <View style={st.flipBtn} />
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  mockCamera: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mockCameraText: {
    fontSize: 24,
    color: '#fff',
  },
  mockCameraSubtext: {
    fontSize: 13,
    color: '#94a3b8',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  elapsedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  channelLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 180,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  flipBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipBtnText: {
    fontSize: 22,
  },
  endBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  endBtnDisabled: {
    opacity: 0.5,
  },
  endBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

/**
 * LiveThreadCard — Structured in-thread card for live sessions.
 *
 * Renders as a thread message bubble showing live session status
 * with contextual actions based on caller role:
 *   - Host: sees stream key / RTMP info, End button
 *   - Viewer: sees Watch button → inline HLS player
 *   - Unknown role: sees Refresh to get role assignment
 *
 * After session ends, shows "Save Replay" button for the host.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { commsColors as C } from './commsTokens';

// expo-video for inline HLS playback
let VideoView: React.ComponentType<any> | null = null;
let useVideoPlayer: ((source: string | null, setup?: (p: any) => void) => any) | null = null;
try {
  if (Platform.OS !== 'web') {
    const expoVideo = require('expo-video');
    VideoView = expoVideo.VideoView;
    useVideoPlayer = expoVideo.useVideoPlayer;
  }
} catch {
  // expo-video not available
}

export interface LiveThreadCardProps {
  /** Session status label from backend or local state */
  status: string | null;
  /** Whether the current user can host (and therefore end) sessions */
  canHost: boolean;
  /** The caller's role in the live session (host = broadcaster, viewer = watcher) */
  callerRole: 'host' | 'viewer' | null;
  /** HLS playback URL for viewers */
  playbackUrl: string | null;
  /** RTMP stream key for the host (shown as masked info) */
  streamKey: string | null;
  /** Provider mode (mock, mux, unavailable) */
  providerMode: 'mock' | 'mux' | 'unavailable' | null;
  /** Whether a live action is currently in progress */
  busy: boolean;
  /** Gate from package visibility */
  gateBlocksActions: boolean;
  /** Session status string from backend */
  sessionStatus?: 'scheduled' | 'live' | 'ended' | 'cancelled' | null;
  onWatch: () => void;
  onEnd: () => void;
  onRefresh: () => void;
  /** Replay */
  onPublishReplay?: () => void;
  replayBusy?: boolean;
  replayPublished?: boolean;
}

/** Wrapper to use the hook conditionally (only when we have an HLS URL to play) */
function InlineLivePlayer({ url }: { url: string }) {
  if (!useVideoPlayer || !VideoView) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const player = useVideoPlayer(url, (instance: any) => {
    instance.loop = false;
  });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    try { player.play(); } catch { /* ignore autoplay failures */ }
  }, [player]);

  return (
    <VideoView
      player={player}
      style={st.inlinePlayer}
      nativeControls
      contentFit="cover"
    />
  );
}

export default function LiveThreadCard(props: LiveThreadCardProps) {
  const {
    status, canHost, callerRole, playbackUrl, streamKey, providerMode,
    busy, gateBlocksActions, sessionStatus,
    onWatch, onEnd, onRefresh,
    onPublishReplay, replayBusy = false, replayPublished = false,
  } = props;
  const disabled = busy || gateBlocksActions;
  const statusText = status ?? 'No active live session';
  const isActive = status != null && /active|live|started|streaming|broadcast|ready/i.test(status);
  const isHost = callerRole === 'host';
  const isViewer = callerRole === 'viewer';
  const isEnded = sessionStatus === 'ended' || (status != null && /ended/i.test(status));

  const [showPlayer, setShowPlayer] = useState(false);

  const handleWatch = useCallback(() => {
    if (playbackUrl && useVideoPlayer && VideoView) {
      setShowPlayer(true);
    } else {
      onWatch();
    }
  }, [playbackUrl, onWatch]);

  return (
    <View style={st.card}>
      <View style={st.header}>
        <View style={[st.dot, isActive && st.dotActive, isEnded && st.dotEnded]} />
        <Text style={st.title}>
          {isHost ? 'Live Broadcast (Host)' : isViewer ? 'Live Broadcast' : 'Live Session'}
        </Text>
        {providerMode === 'mux' ? (
          <View style={st.providerBadge}><Text style={st.providerBadgeText}>Mux</Text></View>
        ) : providerMode === 'mock' ? (
          <View style={[st.providerBadge, st.providerBadgeMock]}><Text style={st.providerBadgeText}>Mock</Text></View>
        ) : null}
      </View>
      <Text style={st.status}>{statusText}</Text>

      {/* Host info: stream key (masked) */}
      {isHost && streamKey ? (
        <View style={st.hostInfo}>
          <Text style={st.hostInfoLabel}>Stream Key:</Text>
          <Text style={st.hostInfoValue}>{streamKey.slice(0, 6)}…{streamKey.slice(-4)}</Text>
        </View>
      ) : null}

      {/* Inline HLS player for viewers */}
      {showPlayer && playbackUrl ? (
        <View style={st.playerContainer}>
          <InlineLivePlayer url={playbackUrl} />
        </View>
      ) : null}

      <View style={st.actions}>
        {/* Viewer: Watch button (enables inline player or falls back to external) */}
        {(isViewer || (!isHost && !canHost)) && !isEnded ? (
          <Pressable
            style={[st.btn, st.btnWatch, disabled && st.btnDisabled]}
            disabled={disabled}
            onPress={handleWatch}
          >
            <Text style={st.btnWatchText}>{showPlayer ? '▶ Playing' : playbackUrl ? '▶ Watch' : 'Watch'}</Text>
          </Pressable>
        ) : null}

        {/* Refresh */}
        {!isEnded ? (
          <Pressable style={[st.btn, disabled && st.btnDisabled]} disabled={disabled} onPress={onRefresh}>
            <Text style={st.btnText}>Refresh</Text>
          </Pressable>
        ) : null}

        {/* Host: End button */}
        {canHost && !isEnded ? (
          <Pressable style={[st.btn, st.btnEnd, disabled && st.btnDisabled]} disabled={disabled} onPress={onEnd}>
            <Text style={[st.btnText, st.btnEndText]}>End</Text>
          </Pressable>
        ) : null}

        {/* Save Replay — shown after session ends, for host */}
        {isEnded && canHost && onPublishReplay ? (
          replayPublished ? (
            <View style={[st.btn, st.btnReplayDone]}>
              <Text style={st.btnReplayDoneText}>✓ Replay Saved</Text>
            </View>
          ) : (
            <Pressable
              style={[st.btn, st.btnReplay, replayBusy && st.btnDisabled]}
              disabled={replayBusy}
              onPress={onPublishReplay}
            >
              {replayBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={st.btnReplayText}>Save Replay</Text>
              )}
            </Pressable>
          )
        ) : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: '#f0f7ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
    gap: 8,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
  },
  dotActive: {
    backgroundColor: '#22c55e',
  },
  dotEnded: {
    backgroundColor: '#94a3b8',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e40af',
  },
  providerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#dbeafe',
  },
  providerBadgeMock: {
    backgroundColor: '#fef3c7',
  },
  providerBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
  },
  status: {
    fontSize: 12,
    color: '#475569',
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hostInfoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  hostInfoValue: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#334155',
  },
  playerContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  inlinePlayer: {
    width: '100%',
    height: 200,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
  },
  btnWatch: {
    backgroundColor: C.brand,
  },
  btnEnd: {
    backgroundColor: '#fee2e2',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
  btnWatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  btnEndText: {
    color: '#dc2626',
  },
  btnReplay: {
    backgroundColor: '#7c3aed',
  },
  btnReplayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  btnReplayDone: {
    backgroundColor: '#d1fae5',
  },
  btnReplayDoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
});

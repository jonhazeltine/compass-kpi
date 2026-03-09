/**
 * LiveThreadCard — Structured in-thread card for live sessions.
 *
 * Renders as a thread message bubble showing live session status
 * with contextual actions based on caller role:
 *   - Host: sees stream key / RTMP info, End button
 *   - Viewer: sees Watch button to open HLS playback
 *   - Unknown role: sees Refresh to get role assignment
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { commsColors as C, commsRadii as R } from './commsTokens';

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
  onWatch: () => void;
  onEnd: () => void;
  onRefresh: () => void;
}

export default function LiveThreadCard(props: LiveThreadCardProps) {
  const { status, canHost, callerRole, playbackUrl, streamKey, providerMode, busy, gateBlocksActions, onWatch, onEnd, onRefresh } = props;
  const disabled = busy || gateBlocksActions;
  const statusText = status ?? 'No active live session';
  const isActive = status != null && /active|live|started|streaming|broadcast|ready/i.test(status);
  const isHost = callerRole === 'host';
  const isViewer = callerRole === 'viewer';

  return (
    <View style={st.card}>
      <View style={st.header}>
        <View style={[st.dot, isActive && st.dotActive]} />
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

      <View style={st.actions}>
        {/* Viewer: Watch button (enabled when playback URL is available) */}
        {isViewer || (!isHost && !canHost) ? (
          <Pressable
            style={[st.btn, st.btnWatch, disabled && st.btnDisabled]}
            disabled={disabled}
            onPress={onWatch}
          >
            <Text style={st.btnWatchText}>{playbackUrl ? '▶ Watch' : 'Watch'}</Text>
          </Pressable>
        ) : null}

        {/* Host or unknown: Refresh to get latest status */}
        <Pressable style={[st.btn, disabled && st.btnDisabled]} disabled={disabled} onPress={onRefresh}>
          <Text style={st.btnText}>Refresh</Text>
        </Pressable>

        {/* Host: End button */}
        {canHost ? (
          <Pressable style={[st.btn, st.btnEnd, disabled && st.btnDisabled]} disabled={disabled} onPress={onEnd}>
            <Text style={[st.btnText, st.btnEndText]}>End</Text>
          </Pressable>
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
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
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
});

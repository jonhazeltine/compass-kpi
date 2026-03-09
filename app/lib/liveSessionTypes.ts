/**
 * liveSessionTypes.ts — Shared types for live-session feature.
 *
 * Extracted from KPIDashboardScreen to be consumed by:
 *   - liveSessionApi.ts (API call layer)
 *   - useLiveSession.ts (state hook)
 *   - LiveThreadCard, LiveBroadcastScreen, LiveSetupSheet
 */

// ── Provider / role enums ────────────────────────────────────────────

export type LiveProviderMode = 'mock' | 'mux' | 'unavailable';
export type LiveCallerRole = 'host' | 'viewer';

// ── Record shape returned from backend session endpoints ─────────────

export type LiveSessionRecord = {
  session_id: string;
  channel_id: string;
  title: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  host_user_id: string;
  started_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── Envelope returned by all four live-session endpoints ─────────────

export type LiveSessionResponse = {
  session?: LiveSessionRecord;
  idempotent_replay?: boolean;
  role?: LiveCallerRole;
  caller_role?: LiveCallerRole;
  token?: string;
  token_expires_at?: string;
  provider?: string;
  provider_mode?: LiveProviderMode;
  host_url?: string;
  join_url?: string;
  live_url?: string;
  stream_key?: string;
  rtmp_url?: string;
  playback_url?: string;
  error?: string | { code?: string; message?: string; request_id?: string };
};

// ── Replay publish response ──────────────────────────────────────────

export type PublishReplayResponse = {
  media_message_id?: string;
  error?: string | { code?: string; message?: string; request_id?: string };
};

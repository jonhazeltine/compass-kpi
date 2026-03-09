/**
 * liveSessionApi.ts — Thin fetch wrappers for live-session endpoints.
 *
 * All functions throw on network error and return the parsed JSON envelope.
 * HTTP errors are returned as part of the envelope (caller checks response.ok).
 */

import { API_URL } from './supabase';
import type {
  LiveSessionResponse,
  PublishReplayResponse,
} from './liveSessionTypes';

// ── Helpers ──────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/** Extract a human-readable error string from an API response payload. */
export function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const errorValue = (payload as { error?: unknown }).error;
    if (typeof errorValue === 'string' && errorValue.trim()) return errorValue;
    if (errorValue && typeof errorValue === 'object') {
      const nested = (errorValue as { message?: unknown }).message;
      if (typeof nested === 'string' && nested.trim()) return nested;
    }
  }
  return fallback;
}

/** Map common HTTP status codes to user-friendly live-session messages. */
export function mapLiveHttpError(status: number, fallback: string): string {
  if (status === 401) return 'Sign in is required for live sessions (401).';
  if (status === 403) return 'Permission denied for this live action (403).';
  if (status === 409) return 'Live session state changed. Refresh and retry (409).';
  if (status === 422) return 'Invalid live session request. Check inputs (422).';
  if (status === 503) return 'Live provider is temporarily unavailable. Try again shortly (503).';
  return fallback;
}

// ── API calls ────────────────────────────────────────────────────────

const BASE = () => `${API_URL}/api/coaching/media/live-sessions`;

export type CreateLiveSessionResult = {
  ok: boolean;
  status: number;
  data: LiveSessionResponse;
};

export async function createLiveSession(
  channelId: string,
  token: string,
): Promise<CreateLiveSessionResult> {
  const response = await fetch(BASE(), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      channel_id: channelId,
      title: `Live Session ${new Date().toLocaleTimeString()}`,
      idempotency_key: `live_start_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as LiveSessionResponse;
  return { ok: response.ok, status: response.status, data };
}

export type RefreshLiveSessionResult = {
  ok: boolean;
  status: number;
  data: LiveSessionResponse;
};

export async function refreshLiveSession(
  sessionId: string,
  token: string,
): Promise<RefreshLiveSessionResult> {
  const response = await fetch(`${BASE()}/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json().catch(() => ({}))) as LiveSessionResponse;
  return { ok: response.ok, status: response.status, data };
}

export type EndLiveSessionResult = {
  ok: boolean;
  status: number;
  data: LiveSessionResponse;
};

export async function endLiveSession(
  sessionId: string,
  token: string,
): Promise<EndLiveSessionResult> {
  const response = await fetch(`${BASE()}/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json().catch(() => ({}))) as LiveSessionResponse;
  return { ok: response.ok, status: response.status, data };
}

export type PublishReplayResult = {
  ok: boolean;
  status: number;
  data: PublishReplayResponse;
};

export async function publishReplay(
  sessionId: string,
  token: string,
): Promise<PublishReplayResult> {
  const response = await fetch(`${BASE()}/${encodeURIComponent(sessionId)}/publish-replay`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = (await response.json().catch(() => ({}))) as PublishReplayResponse;
  return { ok: response.ok, status: response.status, data };
}

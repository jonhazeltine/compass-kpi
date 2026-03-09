/**
 * useLiveSession — State-management hook for the live-session feature.
 *
 * Encapsulates all live-session state (busy, status, role, stream keys, etc.)
 * and exposes actions (start, refresh, end, publishReplay, reset).
 *
 * Replaces ~120 lines of inline state + callbacks in KPIDashboardScreen.
 */

import { useCallback, useState } from 'react';

import type {
  LiveCallerRole,
  LiveProviderMode,
  LiveSessionRecord,
  LiveSessionResponse,
} from '../lib/liveSessionTypes';

import {
  createLiveSession as apiCreate,
  refreshLiveSession as apiRefresh,
  endLiveSession as apiEnd,
  publishReplay as apiPublishReplay,
  getApiErrorMessage,
  mapLiveHttpError,
} from '../lib/liveSessionApi';

// ── Public state shape ───────────────────────────────────────────────

export interface LiveSessionState {
  busy: boolean;
  statusMessage: string | null;
  session: LiveSessionRecord | null;
  callerRole: LiveCallerRole | null;
  streamKey: string | null;
  rtmpUrl: string | null;
  playbackUrl: string | null;
  providerMode: LiveProviderMode | null;
  replayBusy: boolean;
  replayPublished: boolean;
}

export interface LiveSessionActions {
  startSession: (channelId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  endSession: () => Promise<void>;
  publishReplay: () => Promise<void>;
  /** Reset all live state (e.g. when channel changes) */
  reset: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useLiveSession(
  authToken: string | null | undefined,
): LiveSessionState & LiveSessionActions {
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [session, setSession] = useState<LiveSessionRecord | null>(null);
  const [callerRole, setCallerRole] = useState<LiveCallerRole | null>(null);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [rtmpUrl, setRtmpUrl] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [providerMode, setProviderMode] = useState<LiveProviderMode | null>(null);
  const [replayBusy, setReplayBusy] = useState(false);
  const [replayPublished, setReplayPublished] = useState(false);

  // ── apply envelope fields ────────────────────────────────────────

  const applyResponse = useCallback((payload: LiveSessionResponse) => {
    if (payload.session) setSession(payload.session);
    setCallerRole(payload.caller_role ?? payload.role ?? null);
    setStreamKey(payload.stream_key ?? null);
    setRtmpUrl(payload.rtmp_url ?? null);
    setPlaybackUrl(payload.playback_url ?? null);
    if (payload.provider_mode) setProviderMode(payload.provider_mode);
  }, []);

  // ── actions ──────────────────────────────────────────────────────

  const startSession = useCallback(
    async (channelId: string) => {
      if (!authToken) {
        setStatusMessage('Sign in is required for live sessions (401).');
        return;
      }
      setBusy(true);
      setStatusMessage('Starting live session…');
      try {
        const result = await apiCreate(channelId, authToken);
        if (!result.ok) {
          setStatusMessage(mapLiveHttpError(result.status, getApiErrorMessage(result.data, `Live session start failed (${result.status})`)));
          return;
        }
        applyResponse(result.data);
        const sid = result.data.session?.session_id ?? '?';
        const s = result.data.session?.status ?? '?';
        const mode = result.data.provider_mode ?? 'unknown';
        setStatusMessage(`Live session active: ${sid} (${s}) [${mode}].`);
      } catch (err) {
        setStatusMessage(err instanceof Error ? err.message : 'Live session start failed.');
      } finally {
        setBusy(false);
      }
    },
    [authToken, applyResponse],
  );

  const refreshSession = useCallback(async () => {
    const sessionId = session?.session_id;
    if (!authToken) {
      setStatusMessage('Sign in is required to refresh live session state (401).');
      return;
    }
    if (!sessionId) {
      setStatusMessage('No live session id available to refresh.');
      return;
    }
    setBusy(true);
    try {
      const result = await apiRefresh(sessionId, authToken);
      if (!result.ok) {
        setStatusMessage(mapLiveHttpError(result.status, getApiErrorMessage(result.data, `Live session refresh failed (${result.status})`)));
        return;
      }
      applyResponse(result.data);
      setStatusMessage(`Live session refreshed: ${result.data.session?.session_id ?? sessionId} (${result.data.session?.status ?? '?'}).`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Live session refresh failed.');
    } finally {
      setBusy(false);
    }
  }, [session?.session_id, authToken, applyResponse]);

  const endSession = useCallback(async () => {
    const sessionId = session?.session_id;
    if (!authToken) {
      setStatusMessage('Sign in is required to end live sessions (401).');
      return;
    }
    if (!sessionId) {
      setStatusMessage('No active live session available to end.');
      return;
    }
    setBusy(true);
    try {
      const result = await apiEnd(sessionId, authToken);
      if (!result.ok) {
        setStatusMessage(mapLiveHttpError(result.status, getApiErrorMessage(result.data, `Live session end failed (${result.status})`)));
        return;
      }
      if (result.data.session) setSession(result.data.session);
      setStreamKey(null);
      setRtmpUrl(null);
      setPlaybackUrl(null);
      setCallerRole(null);
      setStatusMessage('Live session ended.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Live session end failed.');
    } finally {
      setBusy(false);
    }
  }, [session?.session_id, authToken]);

  const doPublishReplay = useCallback(async () => {
    const sessionId = session?.session_id;
    if (!authToken || !sessionId) return;
    setReplayBusy(true);
    setStatusMessage('Processing replay…');
    try {
      const result = await apiPublishReplay(sessionId, authToken);
      if (!result.ok) {
        // Surface a user-friendly message for the "still processing" case
        const errObj = result.data?.error;
        const errorCode = typeof errObj === 'object' ? errObj?.code : undefined;
        if (errorCode === 'no_asset' || errorCode === 'no_playback') {
          setStatusMessage('Replay is still processing. Please try again in a minute.');
        } else {
          setStatusMessage(getApiErrorMessage(result.data, `Replay publish failed (${result.status})`));
        }
        return;
      }
      setReplayPublished(true);
      setStatusMessage('Replay saved to thread.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Replay publish failed.');
    } finally {
      setReplayBusy(false);
    }
  }, [session?.session_id, authToken]);

  const reset = useCallback(() => {
    setBusy(false);
    setStatusMessage(null);
    setSession(null);
    setCallerRole(null);
    setStreamKey(null);
    setRtmpUrl(null);
    setPlaybackUrl(null);
    setProviderMode(null);
    setReplayBusy(false);
    setReplayPublished(false);
  }, []);

  return {
    busy,
    statusMessage,
    session,
    callerRole,
    streamKey,
    rtmpUrl,
    playbackUrl,
    providerMode,
    replayBusy,
    replayPublished,
    startSession,
    refreshSession,
    endSession,
    publishReplay: doPublishReplay,
    reset,
  };
}

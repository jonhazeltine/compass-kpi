"use strict";
/**
 * muxLiveService.ts — Mux Live-Stream service
 *
 * Extracted from index.ts to contain all live-session provider logic:
 *   - In-memory session store + idempotency map
 *   - Provider mode resolution (mock | mux | unavailable)
 *   - Real Mux Live API calls (create, status, disable) via raw fetch
 *   - Session management helpers (create, get, join, end)
 *   - Validation helpers
 *
 * Mux Live is a one-to-many broadcast (not a video call):
 *   - Host = broadcaster, streams via RTMP/SRT to Mux ingest
 *   - Viewer = watches HLS playback URL
 *   - No "participant" role in the meeting-app sense
 *
 * RTMP ingest:   rtmps://global-live.mux.com:443/app/{stream_key}
 * HLS playback:  https://stream.mux.com/{playback_id}.m3u8
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLiveSession = getLiveSession;
exports.getIdempotentSession = getIdempotentSession;
exports.resolveLiveProviderMode = resolveLiveProviderMode;
exports.canHostLiveSession = canHostLiveSession;
exports.validateLiveSessionCreatePayload = validateLiveSessionCreatePayload;
exports.validateLiveSessionJoinTokenPayload = validateLiveSessionJoinTokenPayload;
exports.createMuxLiveStream = createMuxLiveStream;
exports.getMuxLiveStreamStatus = getMuxLiveStreamStatus;
exports.disableMuxLiveStream = disableMuxLiveStream;
exports.getMuxLiveStreamDetails = getMuxLiveStreamDetails;
exports.getMuxAsset = getMuxAsset;
exports.issueLiveSessionJoinToken = issueLiveSessionJoinToken;
exports.createSession = createSession;
exports.refreshSession = refreshSession;
exports.issueJoinToken = issueJoinToken;
exports.endSession = endSession;
exports.buildSessionResponse = buildSessionResponse;
const crypto = __importStar(require("crypto"));
/* ================================================================
   IN-MEMORY STORES
   ================================================================ */
const liveSessionStore = new Map();
const liveSessionByIdempotencyKey = new Map();
function getLiveSession(sessionId) {
    return liveSessionStore.get(sessionId);
}
function getIdempotentSession(userId, idempotencyKey) {
    const lookup = `${userId}::${idempotencyKey}`;
    const existingId = liveSessionByIdempotencyKey.get(lookup);
    return existingId ? liveSessionStore.get(existingId) : undefined;
}
/* ================================================================
   PROVIDER MODE RESOLUTION
   ================================================================ */
function resolveLiveProviderMode() {
    const raw = String(process.env.MUX_LIVE_PROVIDER_MODE ?? process.env.MUX_PROVIDER_MODE ?? "").trim().toLowerCase();
    if (raw === "down" || raw === "unavailable" || raw === "disabled" || raw === "off")
        return "unavailable";
    if (raw === "mock")
        return "mock";
    // Auto-detect: if Mux credentials are present, use real mode
    const tokenId = (process.env.MUX_TOKEN_ID ?? "").trim();
    const tokenSecret = (process.env.MUX_TOKEN_SECRET ?? "").trim();
    if (tokenId && tokenSecret)
        return "mux";
    // Fallback to mock when no credentials and no explicit mode
    return "mock";
}
/* ================================================================
   ROLE CHECK
   ================================================================ */
function canHostLiveSession(role) {
    return role === "admin" || role === "super_admin" || role === "coach" || role === "team_leader" || role === "challenge_sponsor";
}
/* ================================================================
   VALIDATION
   ================================================================ */
function isRecord(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
function validateLiveSessionCreatePayload(body) {
    if (!isRecord(body))
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    const channelId = typeof body.channel_id === "string" ? body.channel_id.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
    if (!channelId)
        return { ok: false, status: 422, error: "channel_id is required" };
    if (!title)
        return { ok: false, status: 422, error: "title is required" };
    if (!idempotencyKey)
        return { ok: false, status: 422, error: "idempotency_key is required" };
    if (title.length > 120)
        return { ok: false, status: 422, error: "title is too long (max 120 chars)" };
    const startsAtRaw = typeof body.starts_at === "string" && body.starts_at.trim() ? body.starts_at.trim() : undefined;
    let startsAt;
    if (startsAtRaw) {
        const parsed = new Date(startsAtRaw);
        if (Number.isNaN(parsed.getTime())) {
            return { ok: false, status: 422, error: "starts_at must be a valid ISO timestamp when provided" };
        }
        startsAt = parsed.toISOString();
    }
    const endsAtRaw = typeof body.ends_at === "string" && body.ends_at.trim() ? body.ends_at.trim() : undefined;
    let endsAt;
    if (endsAtRaw) {
        const parsed = new Date(endsAtRaw);
        if (Number.isNaN(parsed.getTime())) {
            return { ok: false, status: 422, error: "ends_at must be a valid ISO timestamp when provided" };
        }
        endsAt = parsed.toISOString();
    }
    if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        return { ok: false, status: 422, error: "ends_at must be later than starts_at" };
    }
    return {
        ok: true,
        payload: { channel_id: channelId, title, starts_at: startsAt, ends_at: endsAt, idempotency_key: idempotencyKey },
    };
}
function validateLiveSessionJoinTokenPayload(body) {
    if (body === undefined || body === null)
        return { ok: true, payload: {} };
    if (!isRecord(body))
        return { ok: false, status: 400, error: "Body must be a JSON object" };
    const role = body.role;
    if (role !== undefined && role !== "host" && role !== "participant" && role !== "viewer") {
        return { ok: false, status: 422, error: "role must be one of: host, participant, viewer" };
    }
    return { ok: true, payload: { role: role } };
}
/* ================================================================
   MUX LIVE API (raw fetch — consistent with existing upload pattern)
   ================================================================ */
const MUX_API_BASE = "https://api.mux.com/video/v1";
function muxAuthHeader() {
    const tokenId = (process.env.MUX_TOKEN_ID ?? "").trim();
    const tokenSecret = (process.env.MUX_TOKEN_SECRET ?? "").trim();
    return `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
}
/**
 * Create a new Mux live stream.
 * Returns the stream data or an error string.
 */
async function createMuxLiveStream() {
    try {
        const res = await fetch(`${MUX_API_BASE}/live-streams`, {
            method: "POST",
            headers: {
                Authorization: muxAuthHeader(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                playback_policy: ["public"],
                new_asset_settings: { playback_policy: ["public"] },
                reduced_latency: true,
                reconnect_window: 30,
            }),
        });
        const json = (await res.json().catch(() => ({})));
        if (!res.ok || !json.data?.id) {
            const msg = json.error?.messages?.join("; ") ?? `Mux API returned ${res.status}`;
            console.error("[MUX_LIVE] Create stream failed:", msg);
            return { ok: false, error: msg };
        }
        console.log(`[MUX_LIVE] Created stream ${json.data.id} (status: ${json.data.status})`);
        return { ok: true, data: json.data };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Mux API call failed";
        console.error("[MUX_LIVE] Create stream error:", msg);
        return { ok: false, error: msg };
    }
}
/**
 * Get current status of a Mux live stream.
 */
async function getMuxLiveStreamStatus(streamId) {
    try {
        const res = await fetch(`${MUX_API_BASE}/live-streams/${encodeURIComponent(streamId)}`, {
            headers: { Authorization: muxAuthHeader() },
        });
        const json = (await res.json().catch(() => ({})));
        if (!res.ok || !json.data) {
            return { ok: false, error: `Mux API returned ${res.status}` };
        }
        return { ok: true, data: json.data };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Mux API call failed" };
    }
}
/**
 * Disable (end) a Mux live stream. Prevents further broadcasting.
 */
async function disableMuxLiveStream(streamId) {
    try {
        const res = await fetch(`${MUX_API_BASE}/live-streams/${encodeURIComponent(streamId)}/disable`, {
            method: "PUT",
            headers: { Authorization: muxAuthHeader() },
        });
        if (!res.ok) {
            const json = (await res.json().catch(() => ({})));
            return { ok: false, error: json.error?.messages?.join("; ") ?? `Mux API returned ${res.status}` };
        }
        console.log(`[MUX_LIVE] Disabled stream ${streamId}`);
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Mux API call failed" };
    }
}
/**
 * Get full details of a Mux live stream, including recent_asset_ids
 * which we need to find the replay asset after a stream ends.
 */
async function getMuxLiveStreamDetails(streamId) {
    try {
        const res = await fetch(`${MUX_API_BASE}/live-streams/${encodeURIComponent(streamId)}`, {
            headers: { Authorization: muxAuthHeader() },
        });
        const json = (await res.json().catch(() => ({})));
        if (!res.ok || !json.data) {
            return { ok: false, error: `Mux API returned ${res.status}` };
        }
        return { ok: true, data: json.data };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Mux live stream query failed" };
    }
}
/**
 * Get a Mux video asset by ID (used to resolve replay playback URL).
 */
async function getMuxAsset(assetId) {
    try {
        const res = await fetch(`${MUX_API_BASE}/assets/${encodeURIComponent(assetId)}`, {
            headers: { Authorization: muxAuthHeader() },
        });
        const json = (await res.json().catch(() => ({})));
        if (!res.ok || !json.data) {
            return { ok: false, error: `Mux API returned ${res.status}` };
        }
        return { ok: true, data: json.data };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Mux asset query failed" };
    }
}
/* ================================================================
   URL BUILDERS
   ================================================================ */
const MUX_RTMP_URL = "rtmps://global-live.mux.com:443/app";
function buildMuxUrls(streamKey, playbackId) {
    const rtmpUrl = `${MUX_RTMP_URL}/${streamKey}`;
    const playbackUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : "";
    return {
        host_url: rtmpUrl, // RTMP ingest URL for broadcaster
        join_url: playbackUrl, // HLS playback for viewers
        live_url: playbackUrl, // Same as join for streams
    };
}
function buildMockUrls(sessionId, channelId, role, token) {
    const baseRaw = String(process.env.MUX_LIVE_BASE_URL ?? "https://mock.mux.local/live").trim();
    const base = baseRaw.endsWith("/") ? baseRaw.slice(0, -1) : baseRaw;
    const liveUrl = `${base}/${encodeURIComponent(sessionId)}`;
    const hostUrl = `${liveUrl}?channel_id=${encodeURIComponent(channelId)}&role=host`;
    const joinParams = new URLSearchParams({ channel_id: channelId, role });
    if (token)
        joinParams.set("token", token);
    return {
        host_url: hostUrl,
        join_url: `${liveUrl}?${joinParams.toString()}`,
        live_url: liveUrl,
    };
}
/* ================================================================
   JOIN TOKEN
   ================================================================ */
function issueLiveSessionJoinToken(input) {
    const payload = {
        provider: "mux_live",
        session_id: input.sessionId,
        channel_id: input.channelId,
        user_id: input.userId,
        role: input.role,
        issued_at: new Date(input.issuedAtMs).toISOString(),
        expires_at: new Date(input.issuedAtMs + input.ttlSeconds * 1000).toISOString(),
        ...(input.playbackUrl ? { playback_url: input.playbackUrl } : {}),
        ...(input.rtmpUrl && input.role === "host" ? { rtmp_url: input.rtmpUrl } : {}),
    };
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
}
/* ================================================================
   SESSION LIFECYCLE
   ================================================================ */
/**
 * Create a new live session. In "mux" mode, calls the real Mux API.
 * In "mock" mode, creates placeholder state.
 */
async function createSession(input) {
    const mode = resolveLiveProviderMode();
    if (mode === "unavailable") {
        return { ok: false, status: 503, error: "Live streaming provider is currently unavailable" };
    }
    // Idempotency check
    const idempotencyLookup = `${input.userId}::${input.payload.idempotency_key}`;
    const existingId = liveSessionByIdempotencyKey.get(idempotencyLookup);
    if (existingId) {
        const existing = liveSessionStore.get(existingId);
        if (existing)
            return { ok: true, session: existing, idempotent_replay: true };
    }
    const nowIso = new Date().toISOString();
    const startsAt = input.payload.starts_at ?? nowIso;
    const sessionId = `live_${crypto.randomUUID()}`;
    let muxStreamId = null;
    let muxStreamKey = null;
    let muxPlaybackId = null;
    let muxStreamStatus = null;
    let urls;
    if (mode === "mux") {
        const muxResult = await createMuxLiveStream();
        if (!muxResult.ok) {
            return { ok: false, status: 502, error: `Live stream creation failed: ${muxResult.error}` };
        }
        muxStreamId = muxResult.data.id;
        muxStreamKey = muxResult.data.stream_key;
        muxPlaybackId = muxResult.data.playback_ids?.[0]?.id ?? null;
        muxStreamStatus = muxResult.data.status;
        urls = buildMuxUrls(muxStreamKey, muxPlaybackId);
    }
    else {
        urls = buildMockUrls(sessionId, input.payload.channel_id, "host");
    }
    const status = new Date(startsAt).getTime() > Date.now() ? "scheduled" : "live";
    const record = {
        session_id: sessionId,
        channel_id: input.payload.channel_id,
        title: input.payload.title,
        status,
        host_user_id: input.userId,
        provider: "mux_live",
        provider_mode: mode,
        ...urls,
        started_at: startsAt,
        ends_at: input.payload.ends_at ?? null,
        created_at: nowIso,
        updated_at: nowIso,
        mux_live_stream_id: muxStreamId,
        mux_stream_key: muxStreamKey,
        mux_playback_id: muxPlaybackId,
        mux_stream_status: muxStreamStatus,
    };
    liveSessionStore.set(record.session_id, record);
    liveSessionByIdempotencyKey.set(idempotencyLookup, record.session_id);
    return { ok: true, session: record, idempotent_replay: false };
}
/**
 * Refresh session state from Mux (if real mode).
 */
async function refreshSession(sessionId) {
    const session = liveSessionStore.get(sessionId);
    if (!session)
        return undefined;
    // Only refresh from Mux if we have a real stream and session isn't ended
    if (session.provider_mode === "mux" && session.mux_live_stream_id && session.status !== "ended" && session.status !== "cancelled") {
        const muxResult = await getMuxLiveStreamStatus(session.mux_live_stream_id);
        if (muxResult.ok) {
            const data = muxResult.data;
            const prevStatus = session.mux_stream_status;
            session.mux_stream_status = data.status;
            // Transition session status based on Mux stream state
            const currentStatus = session.status;
            if (data.status === "active" && currentStatus === "scheduled") {
                session.status = "live";
            }
            else if (data.status === "disabled" && currentStatus !== "ended") {
                session.status = "ended";
                session.ends_at = session.ends_at ?? new Date().toISOString();
            }
            // Update playback info if changed
            const newPlaybackId = data.playback_ids?.[0]?.id ?? null;
            if (newPlaybackId && newPlaybackId !== session.mux_playback_id) {
                session.mux_playback_id = newPlaybackId;
                const urls = buildMuxUrls(session.mux_stream_key ?? "", newPlaybackId);
                session.join_url = urls.join_url;
                session.live_url = urls.live_url;
            }
            session.updated_at = new Date().toISOString();
            if (prevStatus !== data.status) {
                console.log(`[MUX_LIVE] Stream ${session.mux_live_stream_id} status: ${prevStatus} → ${data.status}`);
            }
            liveSessionStore.set(sessionId, session);
        }
    }
    return session;
}
/**
 * Issue a join/watch token for a session.
 * Adapts role: "participant" → "viewer" (Mux live has no participants, only host + viewers).
 */
function issueJoinToken(input) {
    const { session, userId, requestedRole, ttlSeconds } = input;
    // Map roles: host stays host, everything else becomes viewer
    const role = session.host_user_id === userId ? "host" : "viewer";
    const issuedAtMs = Date.now();
    const playbackUrl = session.mux_playback_id
        ? `https://stream.mux.com/${session.mux_playback_id}.m3u8`
        : session.join_url;
    const rtmpUrl = session.mux_stream_key
        ? `${MUX_RTMP_URL}/${session.mux_stream_key}`
        : session.host_url;
    const token = issueLiveSessionJoinToken({
        sessionId: session.session_id,
        channelId: session.channel_id,
        userId,
        role,
        issuedAtMs,
        ttlSeconds,
        playbackUrl,
        rtmpUrl,
    });
    // Transition scheduled → live when first token is issued
    if (session.status === "scheduled") {
        session.status = "live";
    }
    session.updated_at = new Date().toISOString();
    liveSessionStore.set(session.session_id, session);
    return {
        session,
        role,
        token,
        tokenExpiresAt: new Date(issuedAtMs + ttlSeconds * 1000).toISOString(),
    };
}
/**
 * End a live session. In "mux" mode, disables the Mux stream.
 */
async function endSession(sessionId) {
    const session = liveSessionStore.get(sessionId);
    if (!session)
        return { ok: false, error: "Session not found" };
    // Disable Mux stream if real
    if (session.provider_mode === "mux" && session.mux_live_stream_id) {
        const disableResult = await disableMuxLiveStream(session.mux_live_stream_id);
        if (!disableResult.ok) {
            console.warn(`[MUX_LIVE] Failed to disable stream ${session.mux_live_stream_id}: ${disableResult.error}`);
            // Continue anyway — mark session ended locally even if Mux call fails
        }
    }
    session.status = "ended";
    session.ends_at = new Date().toISOString();
    session.updated_at = new Date().toISOString();
    session.mux_stream_status = "disabled";
    liveSessionStore.set(sessionId, session);
    return { ok: true, session };
}
/* ================================================================
   RESPONSE HELPERS
   ================================================================ */
/**
 * Build the public API response for a session.
 * Strips mux_stream_key unless the caller is the host.
 */
function buildSessionResponse(session, callerIsHost) {
    const { mux_stream_key, ...publicSession } = session;
    const playbackUrl = session.mux_playback_id
        ? `https://stream.mux.com/${session.mux_playback_id}.m3u8`
        : session.live_url || undefined;
    return {
        session: publicSession,
        provider: session.provider,
        provider_mode: session.provider_mode,
        host_url: session.host_url,
        join_url: session.join_url,
        live_url: session.live_url,
        // Host-only fields
        ...(callerIsHost && mux_stream_key ? {
            stream_key: mux_stream_key,
            rtmp_url: `${MUX_RTMP_URL}/${mux_stream_key}`,
        } : {}),
        // Viewer-accessible fields
        ...(playbackUrl ? { playback_url: playbackUrl } : {}),
    };
}

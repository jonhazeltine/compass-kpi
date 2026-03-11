/**
 * broadcastCampaignApi.ts — Fetch wrappers for broadcast campaign endpoints.
 *
 * Follows the same pattern as liveSessionApi.ts.
 * All functions throw on network error and return parsed JSON envelopes.
 */

import { API_URL } from './supabase';

// ── Types ────────────────────────────────────────────────────────────

export type BroadcastContentType = 'message' | 'video' | 'live' | 'task';
export type BroadcastScopeType = 'channel' | 'team' | 'cohort';

export type BroadcastTarget = {
  scope_type: BroadcastScopeType;
  scope_id: string;
  label?: string;
};

export type BroadcastTaskDraft = {
  task_type: 'personal_task' | 'assigned_task' | 'team_task';
  title: string;
  description?: string | null;
  due_at?: string | null;
};

export type BroadcastCampaignPayload = {
  content_type: BroadcastContentType;
  targets: BroadcastTarget[];
  body?: string;
  media_id?: string;
  live_title?: string;
  task_draft?: BroadcastTaskDraft;
  idempotency_key: string;
};

// ── Response envelopes ───────────────────────────────────────────────

export type AudiencePreviewResponse = {
  total_unique_recipients: number;
  per_target: Array<{
    scope_type: BroadcastScopeType;
    scope_id: string;
    count: number;
  }>;
  overlap_removed: number;
  error?: string;
};

export type CampaignResultResponse = {
  campaign?: {
    campaign_id: string;
    content_type: BroadcastContentType;
    total_recipients: number;
    delivered: number;
    failed: number;
    live_session_id?: string | null;
  };
  error?: string;
};

export type ReplayResultResponse = {
  ok?: boolean;
  replays_sent?: number;
  error?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

const BASE = () => `${API_URL}/api/coaching/broadcast/campaign`;

// ── API calls ────────────────────────────────────────────────────────

export type PreviewResult = {
  ok: boolean;
  status: number;
  data: AudiencePreviewResponse;
};

export async function previewCampaignAudience(
  targets: BroadcastTarget[],
  token: string,
): Promise<PreviewResult> {
  const response = await fetch(`${BASE()}/preview`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ targets }),
  });
  const data = (await response.json().catch(() => ({}))) as AudiencePreviewResponse;
  return { ok: response.ok, status: response.status, data };
}

export type SendCampaignResult = {
  ok: boolean;
  status: number;
  data: CampaignResultResponse;
};

export async function sendBroadcastCampaign(
  payload: BroadcastCampaignPayload,
  token: string,
): Promise<SendCampaignResult> {
  const response = await fetch(BASE(), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as CampaignResultResponse;
  return { ok: response.ok, status: response.status, data };
}

export type PublishReplayResult = {
  ok: boolean;
  status: number;
  data: ReplayResultResponse;
};

export async function publishCampaignReplay(
  campaignId: string,
  token: string,
): Promise<PublishReplayResult> {
  const response = await fetch(`${BASE()}/${encodeURIComponent(campaignId)}/publish-replay`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = (await response.json().catch(() => ({}))) as ReplayResultResponse;
  return { ok: response.ok, status: response.status, data };
}

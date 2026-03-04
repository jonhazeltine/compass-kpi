import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { computeConfidence } from "./engines/confidenceEngine";
import { computeGpVpState } from "./engines/gpVpEngine";
import {
  buildFutureProjected12mSeries,
  buildPastActual6mSeries,
  derivePc90dFromFutureSeries,
  type PcEvent,
} from "./engines/pcTimelineEngine";
import { buildOnboardingBackplotPcEvents } from "./engines/onboardingBackplotEngine";
import { parseTtcDefinition, resolvePcTiming } from "./engines/pcTimingEngine";
import { buildDealCloseAttribution } from "./engines/dealAttributionEngine";
import {
  calibrationQualityBand,
  computeCalibrationStep,
  computeInitializationMultipliers,
  nextRollingAverage,
} from "./engines/userCalibrationEngine";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "127.0.0.1";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn("SUPABASE_URL or SUPABASE_ANON_KEY not set – auth endpoints will fail.");
}

if (!supabaseServiceRoleKey) {
  // eslint-disable-next-line no-console
  console.warn("SUPABASE_SERVICE_ROLE_KEY not set – write endpoints may fail due to RLS.");
}

const authClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const dataClient = supabaseUrl && (supabaseServiceRoleKey || supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey!)
  : null;

const muxMediaStore = new Map<string, MuxMediaSessionRecord>();
const muxMediaByUploadId = new Map<string, string>();
const muxMediaByProviderUploadId = new Map<string, string>();
const muxMediaByProviderAssetId = new Map<string, string>();
const muxMediaChannelByMediaId = new Map<string, string>();
const muxProcessedWebhookEventIds = new Set<string>();
const streamChannelSyncStates = new Map<string, StreamChannelSyncState>();
const liveSessionStore = new Map<string, LiveSessionRecord>();
const liveSessionByIdempotencyKey = new Map<string, string>();

type KPIType = "PC" | "GP" | "VP" | "Actual" | "Pipeline_Anchor" | "Custom";

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: unknown;
};

type KPIRecord = {
  id: string;
  type: KPIType;
  name?: string | null;
  slug?: string | null;
  requires_direct_value_input?: boolean | null;
  pc_weight?: number | null;
  ttc_days?: number | null;
  ttc_definition?: string | null;
  delay_days?: number | null;
  hold_days?: number | null;
  decay_days?: number | null;
  gp_value?: number | null;
  vp_value?: number | null;
};

type KPIWritePayload = {
  kpi_id: string;
  event_timestamp: string;
  logged_value?: number;
  idempotency_key?: string | null;
  challenge_instance_id?: string | null;
  sponsored_challenge_id?: string | null;
};

type UserProfileForCalc = {
  average_price_point?: number | null;
  commission_rate?: number | null;
  account_status?: string | null;
};

type TeamMembershipRole = "team_leader" | "member";

type TeamCreatePayload = {
  name: string;
};

type TeamUpdatePayload = {
  name: string;
};

type TeamMemberAddPayload = {
  user_id: string;
  role?: TeamMembershipRole;
};

type ChallengeJoinPayload = {
  challenge_id: string;
  user_id?: string;
  include_prior_logs?: boolean;
  sponsored_challenge_id?: string;
};

type ChallengeCreatePayload = {
  name: string;
  description?: string;
  mode: "solo" | "team";
  team_id?: string;
  start_at?: string;
  end_at: string;
  template_id?: string;
  late_join_includes_history?: boolean;
  invite_user_ids?: string[];
};

type ChannelType = "team" | "challenge" | "sponsor" | "cohort" | "direct";

type ChannelCreatePayload = {
  type: ChannelType;
  name?: string;
  team_id?: string;
  context_id?: string;
  member_user_ids?: string[];
};

type ChannelMessagePayload = {
  body?: string;
  message_type?: "message" | "media_attachment";
  media_attachment?: {
    media_id: string;
    caption?: string;
  };
};

type MarkSeenPayload = {
  channel_id: string;
};

type PushTokenPayload = {
  token: string;
  platform?: "expo" | "ios" | "android";
};

type CoachingLessonProgressPayload = {
  status: "not_started" | "in_progress" | "completed";
};

type CoachingBroadcastPayload = {
  scope_type: "team" | "journey" | "global";
  scope_id?: string;
  message_body: string;
};

type CoachingJourneyCreatePayload = {
  title: string;
  description?: string;
  team_id?: string;
};

type CoachingJourneyUpdatePayload = {
  title?: string;
  description?: string;
  team_id?: string | null;
  is_active?: boolean;
};

type CoachingLessonCreatePayload = {
  title: string;
  sort_order?: number;
};

type CoachingLessonUpdatePayload = {
  title?: string;
  sort_order?: number;
};

type CoachingLessonReorderPayload = {
  lesson_ids: string[];
};

type CoachingTaskCreatePayload = {
  title: string;
  body?: string;
  sort_order?: number;
};

type CoachingTaskUpdatePayload = {
  title?: string;
  body?: string | null;
  sort_order?: number;
};

type CoachingTaskReorderPayload = {
  task_ids: string[];
};

type CoachingCohortMembershipUpdatePayload = {
  member_user_ids: string[];
};

type CoachEngagementCreatePayload = {
  coach_id: string;
};

type CoachProfileReadModel = {
  id: string;
  name: string;
  specialties: string[];
  bio: string;
  engagement_availability: "available" | "waitlist" | "unavailable";
};

type CoachEngagementReadModel = {
  id: string;
  coach_id: string;
  client_id: string;
  status: "pending" | "active" | "ended";
  entitlement_state: "allowed" | "pending" | "blocked" | "fallback";
  plan_tier_label: string;
  status_reason: string;
  next_step_cta: string;
  coach: { id: string; name: string; specialties: string[] } | null;
  created_at: string;
};

type AiSuggestionCreatePayload = {
  user_id?: string;
  scope: string;
  proposed_message: string;
};

type KpiBatchWritePayload = {
  logs: KPIWritePayload[];
};

type AdminKpiPayload = {
  name: string;
  type: KPIType;
  slug?: string;
  requires_direct_value_input?: boolean;
  pc_weight?: number | null;
  ttc_days?: number | null;
  ttc_definition?: string | null;
  delay_days?: number | null;
  hold_days?: number | null;
  decay_days?: number | null;
  gp_value?: number | null;
  vp_value?: number | null;
  is_active?: boolean;
};

type AdminChallengeTemplatePayload = {
  name: string;
  description?: string;
  is_active?: boolean;
};

type AdminCalibrationUpdatePayload = {
  multiplier: number;
};

type NotificationEnqueuePayload = {
  user_id: string;
  category: "communication" | "challenge" | "coaching" | "system";
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  scheduled_for?: string;
};

type CoachingMediaUploadUrlPayload = {
  journey_id?: string;
  lesson_id?: string;
  channel_id?: string;
  filename: string;
  content_type: string;
  content_length_bytes: number;
  idempotency_key: string;
};

type CoachingMediaPlaybackTokenPayload = {
  media_id: string;
  viewer_context?: "coach" | "team_leader" | "member" | "sponsor";
};

type MuxLifecycleStatus =
  | "queued_for_upload"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "deleted";

type MuxMediaSessionRecord = {
  media_id: string;
  upload_id: string;
  provider: "mux";
  owner_user_id: string;
  journey_id: string | null;
  lesson_id: string | null;
  channel_id: string | null;
  filename: string;
  content_type: string;
  content_length_bytes: number;
  provider_upload_id: string;
  provider_asset_id: string | null;
  playback_id: string | null;
  upload_url: string;
  upload_url_expires_at: string;
  processing_status: MuxLifecycleStatus;
  playback_ready: boolean;
  last_provider_event_at: string | null;
  last_provider_event_id: string | null;
  provider_error_code: string | null;
  verification_status: "verified" | "rejected_signature" | "rejected_replay_window" | "duplicate_ignored" | "pending";
  created_at: string;
  updated_at: string;
};

type LiveSessionStatus = "scheduled" | "live" | "ended" | "cancelled";

type LiveSessionCreatePayload = {
  channel_id: string;
  title: string;
  starts_at?: string;
  ends_at?: string;
  idempotency_key: string;
};

type LiveSessionJoinTokenPayload = {
  role?: "host" | "participant" | "viewer";
};

type LiveSessionRecord = {
  session_id: string;
  channel_id: string;
  title: string;
  status: LiveSessionStatus;
  host_user_id: string;
  provider: "mux_live";
  host_url: string;
  join_url: string;
  live_url: string;
  started_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

type MuxWebhookVerification =
  | { ok: true; status: "verified"; timestampSeconds: number }
  | { ok: false; status: "rejected_signature" | "rejected_replay_window"; code: "invalid_signature" | "replay_window_exceeded" };

type RawBodyRequest = express.Request & { rawBody?: string };

type ChannelTokenPurpose = "chat_read" | "chat_write" | "channel_admin";

type ChannelTokenPayload = {
  channel_id: string;
  token_purpose: ChannelTokenPurpose;
  client_session_id?: string;
};

type ChannelSyncPayload = {
  channel_id: string;
  sync_reason: "membership_change" | "role_change" | "metadata_change" | "manual_reconcile";
  expected_version?: number;
};

type StreamChannelSyncState = {
  version: number;
  memberByUserId: Map<string, "admin" | "member">;
  metadataHash: string;
  providerSyncUpdatedAt: string;
};

type StreamSyncStatus = "not_synced" | "syncing" | "synced" | "stale" | "error";

type MeProfileUpdatePayload = {
  full_name?: string;
  avatar_url?: string;
  avatar_preset_id?: string;
  average_price_point?: number;
  commission_rate_percent?: number;
  goal_gci_365_days?: number;
  goal_deals_closed_365_days?: number;
  last_year_gci?: number;
  ytd_gci?: number;
  selected_kpis?: string[];
  kpi_weekly_inputs?: Record<string, { historicalWeeklyAverage: number; targetWeeklyCount: number }>;
  pipeline_listings_pending?: number;
  pipeline_buyers_uc?: number;
  geo_city?: string;
  geo_state?: string;
  settings_push_enabled?: boolean;
  settings_email_digest?: boolean;
  settings_theme?: "system" | "light" | "dark";
};

type CanonicalTier = "free" | "basic" | "pro" | "team" | "coach" | "enterprise";
type EffectivePlan = "free" | "pro" | "team" | "coach" | "enterprise";
type EntitlementValue = boolean | number | string | null;
type EntitlementsMap = Record<string, EntitlementValue>;
type SeatContext = {
  scope: "none" | "team" | "coach";
  included: number | null;
  used: number | null;
  overage: number | null;
};

type PackagingReadModel = {
  package_type: "team_coaching_program" | "sponsored_challenge_coaching_campaign" | "paid_coaching_product" | null;
  visibility_state: "published" | "unavailable" | "unknown";
  entitlement_result:
    | "allowed"
    | "allowed_channel_member"
    | "allowed_tier_gated"
    | "not_evaluated"
    | "unknown";
  linked_context_refs: {
    team_id: string | null;
    challenge_id: string | null;
    sponsored_challenge_id: string | null;
    sponsor_id: string | null;
    channel_id: string | null;
    journey_id: string | null;
  };
  display_requirements: {
    sponsor_disclaimer_required: boolean;
    sponsor_attribution_required: boolean;
    paywall_cta_required: boolean;
  };
  read_model_status: "inferred_baseline" | "partial_in_family" | "not_evaluated";
  notes?: string[];
};

type AiSuggestionRow = {
  id?: unknown;
  user_id?: unknown;
  scope?: unknown;
  proposed_message?: unknown;
  status?: unknown;
  created_by?: unknown;
  approved_by?: unknown;
  rejected_by?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  sent_at?: unknown;
};

type AiSuggestionQueueReadModel = {
  source_surface:
    | "channel_thread"
    | "coach_broadcast_compose"
    | "coaching_journey_detail"
    | "coaching_lesson_detail"
    | "challenge_coaching_block"
    | "team_coaching_module"
    | null;
  source_context_refs: {
    team_id: string | null;
    challenge_id: string | null;
    channel_id: string | null;
    journey_id: string | null;
    lesson_id: string | null;
    package_id: string | null;
  };
  request_intent: "draft_reply" | "draft_broadcast" | "rewrite" | "reflection_prompt" | "unknown";
  required_approval_tier: "admin";
  disclaimer_requirements: string[];
  safety_flags: string[];
  target_scope_summary: string;
  draft_content: string;
  audit_summary: {
    requester_user_id: string | null;
    target_user_id: string | null;
    reviewer_user_id: string | null;
    review_decision: "pending" | "approved" | "rejected" | "unknown";
    created_at: string | null;
    updated_at: string | null;
    decision_at: string | null;
    linked_execution_refs: {
      message_id: string | null;
      broadcast_id: string | null;
      publish_event_id: string | null;
    };
    edited_content_indicator: "unknown";
    reviewer_reason_present: false;
  };
  approval_queue: {
    queue_status: "pending_review" | "approved" | "rejected" | "unknown";
    approval_authority_model: "platform_admin_only_current_baseline";
    escalation_required: boolean;
  };
  model_meta: {
    provider: null;
    model_family: null;
  };
  read_model_status: "partial_in_family";
  notes: string[];
};

type NotificationReadModelClass =
  | "coaching_assignment_published"
  | "coaching_lesson_reminder"
  | "coaching_progress_nudge"
  | "coaching_channel_message"
  | "coaching_broadcast_sent"
  | "ai_review_queue_pending"
  | "ai_review_outcome"
  | "package_access_changed"
  | "sponsored_coaching_campaign_update"
  | "unknown";

type NotificationItemReadModel = {
  class: NotificationReadModelClass;
  preview: {
    title: string | null;
    body: string | null;
  };
  read_state: "read" | "unread" | "unknown";
  route_target: string | null;
  route_params: Record<string, string | number | boolean | null>;
  linked_context_refs: {
    team_id: string | null;
    challenge_id: string | null;
    sponsored_challenge_id: string | null;
    channel_id: string | null;
    journey_id: string | null;
    lesson_id: string | null;
    ai_suggestion_id: string | null;
    notification_queue_id: string | null;
  };
  display_requirements: {
    sponsor_disclaimer_required: boolean;
    sponsor_attribution_required: boolean;
    paywall_cta_required: boolean;
    ai_approval_boundary_notice_required: boolean;
  };
  delivery_channel_origin:
    | "channels_messages"
    | "coaching"
    | "notifications_queue"
    | "notifications_dispatch"
    | "unknown";
  created_at: string | null;
  read_model_status: "inferred_baseline" | "partial_in_family";
  notes?: string[];
};

type NotificationSummaryReadModel = {
  badge_total: number;
  counts_by_class: Record<NotificationReadModelClass, number>;
  last_event_at: string | null;
  source_scope:
    | "channels_list"
    | "channel_thread"
    | "messages_unread_count"
    | "coaching_journeys"
    | "coaching_progress"
    | "notifications_queue"
    | "unknown";
  read_model_status: "inferred_baseline" | "partial_in_family";
  notes?: string[];
};

type NotificationQueueRow = {
  id?: unknown;
  user_id?: unknown;
  category?: unknown;
  title?: unknown;
  body?: unknown;
  payload?: unknown;
  status?: unknown;
  attempts?: unknown;
  last_error?: unknown;
  scheduled_for?: unknown;
  sent_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type NotificationQueueReadModel = {
  notification_class: NotificationReadModelClass;
  status_bucket: "queued" | "sent" | "failed" | "unknown";
  dispatch_outcome: "pending" | "success" | "failed" | "unknown";
  retry_metadata: {
    attempts: number;
    retry_eligible: boolean;
    last_error_present: boolean;
  };
  policy_flags: {
    requires_visibility_entitlement_check: boolean;
    preserves_ai_approval_first_boundary: boolean;
    sponsor_disclaimer_required: boolean;
  };
  linked_context_refs: NotificationItemReadModel["linked_context_refs"];
  delivery_channel_origin: "notifications_queue" | "notifications_dispatch";
  read_model_status: "partial_in_family";
  notes: string[];
};

function emptyNotificationClassCounts(): Record<NotificationReadModelClass, number> {
  return {
    coaching_assignment_published: 0,
    coaching_lesson_reminder: 0,
    coaching_progress_nudge: 0,
    coaching_channel_message: 0,
    coaching_broadcast_sent: 0,
    ai_review_queue_pending: 0,
    ai_review_outcome: 0,
    package_access_changed: 0,
    sponsored_coaching_campaign_update: 0,
    unknown: 0,
  };
}

function buildNotificationSummaryReadModel(params: {
  items: NotificationItemReadModel[];
  source_scope: NotificationSummaryReadModel["source_scope"];
  badge_total?: number;
  read_model_status?: NotificationSummaryReadModel["read_model_status"];
  notes?: string[];
}): NotificationSummaryReadModel {
  const counts = emptyNotificationClassCounts();
  let lastEventAt: string | null = null;
  for (const item of params.items) {
    counts[item.class] = (counts[item.class] ?? 0) + 1;
    if (item.created_at && (!lastEventAt || item.created_at > lastEventAt)) {
      lastEventAt = item.created_at;
    }
  }
  return {
    badge_total: params.badge_total ?? params.items.filter((i) => i.read_state === "unread").length,
    counts_by_class: counts,
    last_event_at: lastEventAt,
    source_scope: params.source_scope,
    read_model_status: params.read_model_status ?? "partial_in_family",
    ...(params.notes ? { notes: params.notes } : {}),
  };
}

function inferNotificationClassFromChannel(channel: { type?: unknown }): NotificationReadModelClass {
  const type = String(channel.type ?? "");
  if (type === "sponsor") return "sponsored_coaching_campaign_update";
  return "coaching_channel_message";
}

function buildNotificationItemForChannel(params: {
  channel: { id?: unknown; type?: unknown; name?: unknown; team_id?: unknown; context_id?: unknown; created_at?: unknown };
  unread_count: number;
  last_seen_at?: unknown;
}): NotificationItemReadModel {
  const channelType = String(params.channel.type ?? "");
  const channelId = String(params.channel.id ?? "") || null;
  const contextId = String(params.channel.context_id ?? "") || null;
  const unreadCount = Math.max(0, params.unread_count);
  return {
    class: inferNotificationClassFromChannel(params.channel),
    preview: {
      title: String(params.channel.name ?? "") || "Coaching channel",
      body: unreadCount > 0 ? `${unreadCount} unread message(s)` : "No unread messages",
    },
    read_state: unreadCount > 0 ? "unread" : "read",
    route_target: "channel_thread",
    route_params: { channelId: channelId ?? "", source: "notifications" },
    linked_context_refs: {
      team_id: String(params.channel.team_id ?? "") || null,
      challenge_id: channelType === "challenge" ? contextId : null,
      sponsored_challenge_id: channelType === "sponsor" ? contextId : null,
      channel_id: channelId,
      journey_id: null,
      lesson_id: null,
      ai_suggestion_id: null,
      notification_queue_id: null,
    },
    display_requirements: {
      sponsor_disclaimer_required: channelType === "sponsor",
      sponsor_attribution_required: channelType === "sponsor",
      paywall_cta_required: false,
      ai_approval_boundary_notice_required: false,
    },
    delivery_channel_origin: "channels_messages",
    created_at: String(params.channel.created_at ?? params.last_seen_at ?? "") || null,
    read_model_status: "inferred_baseline",
    ...(channelType === "challenge" || channelType === "cohort"
      ? { notes: ["notification row is inferred from channel membership/unread baseline; explicit notification event records are not available in this family"] }
      : {}),
  };
}

function buildNotificationItemsForChannelThread(params: {
  channel: { id?: unknown; type?: unknown; name?: unknown; team_id?: unknown; context_id?: unknown };
  messages: Array<{ id?: unknown; channel_id?: unknown; body?: unknown; message_type?: unknown; created_at?: unknown }>;
}): NotificationItemReadModel[] {
  const channelType = String(params.channel.type ?? "");
  const contextId = String(params.channel.context_id ?? "") || null;
  return params.messages.slice(-20).map((message) => {
    const messageType = String(message.message_type ?? "");
    return {
      class: messageType === "broadcast" ? "coaching_broadcast_sent" : inferNotificationClassFromChannel(params.channel),
      preview: {
        title: String(params.channel.name ?? "") || "Channel thread",
        body: String(message.body ?? "").slice(0, 160) || null,
      },
      read_state: "unknown",
      route_target: "channel_thread",
      route_params: { channelId: String(params.channel.id ?? "") || "" },
      linked_context_refs: {
        team_id: String(params.channel.team_id ?? "") || null,
        challenge_id: channelType === "challenge" ? contextId : null,
        sponsored_challenge_id: channelType === "sponsor" ? contextId : null,
        channel_id: String(message.channel_id ?? params.channel.id ?? "") || null,
        journey_id: null,
        lesson_id: null,
        ai_suggestion_id: null,
        notification_queue_id: null,
      },
      display_requirements: {
        sponsor_disclaimer_required: channelType === "sponsor",
        sponsor_attribution_required: channelType === "sponsor",
        paywall_cta_required: false,
        ai_approval_boundary_notice_required: false,
      },
      delivery_channel_origin: "channels_messages",
      created_at: String(message.created_at ?? "") || null,
      read_model_status: "partial_in_family",
      notes: ["thread notifications are inferred from message rows; read state is not represented in this endpoint response"],
    };
  });
}

function buildNotificationItemsForCoachingJourneys(
  journeys: Array<{
    id?: unknown;
    title?: unknown;
    team_id?: unknown;
    completion_percent?: unknown;
    lessons_total?: unknown;
    lessons_completed?: unknown;
    created_at?: unknown;
  }>
): NotificationItemReadModel[] {
  return journeys.map((journey) => {
    const completionPercent = toNumberOrZero((journey as { completion_percent?: unknown }).completion_percent);
    const lessonsTotal = toNumberOrZero((journey as { lessons_total?: unknown }).lessons_total);
    const lessonsCompleted = toNumberOrZero((journey as { lessons_completed?: unknown }).lessons_completed);
    const inferredClass: NotificationReadModelClass =
      completionPercent <= 0 && lessonsTotal > 0 ? "coaching_assignment_published" : completionPercent < 100 ? "coaching_progress_nudge" : "coaching_lesson_reminder";
    const body =
      inferredClass === "coaching_assignment_published"
        ? "Journey assigned and ready to start"
        : inferredClass === "coaching_progress_nudge"
          ? `Progress ${completionPercent.toFixed(0)}% (${lessonsCompleted}/${lessonsTotal} lessons)`
          : "Journey complete; reminder/events may be represented in another endpoint family";
    return {
      class: inferredClass,
      preview: {
        title: String(journey.title ?? "") || "Coaching journey",
        body,
      },
      read_state: completionPercent >= 100 ? "read" : "unread",
      route_target: "coaching_journey_detail",
      route_params: { journeyId: String(journey.id ?? "") || "" },
      linked_context_refs: {
        team_id: String((journey as { team_id?: unknown }).team_id ?? "") || null,
        challenge_id: null,
        sponsored_challenge_id: null,
        channel_id: null,
        journey_id: String(journey.id ?? "") || null,
        lesson_id: null,
        ai_suggestion_id: null,
        notification_queue_id: null,
      },
      display_requirements: {
        sponsor_disclaimer_required: false,
        sponsor_attribution_required: false,
        paywall_cta_required: false,
        ai_approval_boundary_notice_required: false,
      },
      delivery_channel_origin: "coaching",
      created_at: String(journey.created_at ?? "") || null,
      read_model_status: "inferred_baseline",
      notes: ["journey notification rows are inferred from coaching progress/assignment visibility; explicit notification events are not persisted in this endpoint family"],
    };
  });
}

function inferNotificationClassFromQueueRow(row: NotificationQueueRow): NotificationReadModelClass {
  const category = String(row.category ?? "").toLowerCase();
  const title = String(row.title ?? "").toLowerCase();
  const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
  const payloadClass = typeof payload.notification_class === "string" ? String(payload.notification_class) : "";
  if (payloadClass) {
    const allowed: NotificationReadModelClass[] = [
      "coaching_assignment_published",
      "coaching_lesson_reminder",
      "coaching_progress_nudge",
      "coaching_channel_message",
      "coaching_broadcast_sent",
      "ai_review_queue_pending",
      "ai_review_outcome",
      "package_access_changed",
      "sponsored_coaching_campaign_update",
      "unknown",
    ];
    if (allowed.includes(payloadClass as NotificationReadModelClass)) {
      return payloadClass as NotificationReadModelClass;
    }
  }
  if (title.includes("ai") && (title.includes("approve") || title.includes("review") || title.includes("queue"))) {
    return "ai_review_queue_pending";
  }
  if (title.includes("ai") && (title.includes("approved") || title.includes("rejected") || title.includes("outcome"))) {
    return "ai_review_outcome";
  }
  if (title.includes("broadcast")) return "coaching_broadcast_sent";
  if (title.includes("lesson") && title.includes("reminder")) return "coaching_lesson_reminder";
  if (title.includes("progress") || title.includes("inactive") || title.includes("nudge")) return "coaching_progress_nudge";
  if (title.includes("assignment") || title.includes("journey")) return "coaching_assignment_published";
  if (title.includes("sponsor")) return "sponsored_coaching_campaign_update";
  if (title.includes("access") || title.includes("entitlement")) return "package_access_changed";
  if (category === "coaching") return "coaching_assignment_published";
  if (category === "communication") return "coaching_channel_message";
  return "unknown";
}

function buildNotificationItemFromQueueRow(row: NotificationQueueRow): NotificationItemReadModel {
  const inferredClass = inferNotificationClassFromQueueRow(row);
  const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
  const readState = String(row.status ?? "") === "sent" ? "read" : "unread";
  return {
    class: inferredClass,
    preview: {
      title: String(row.title ?? "") || null,
      body: String(row.body ?? "") || null,
    },
    read_state: readState === "read" ? "read" : "unread",
    route_target: inferredClass === "ai_review_queue_pending" || inferredClass === "ai_review_outcome" ? "coach_ops_audit" : "inbox",
    route_params: { queueId: String(row.id ?? "") || "" },
    linked_context_refs: {
      team_id: typeof payload.team_id === "string" ? payload.team_id : null,
      challenge_id: typeof payload.challenge_id === "string" ? payload.challenge_id : null,
      sponsored_challenge_id: typeof payload.sponsored_challenge_id === "string" ? payload.sponsored_challenge_id : null,
      channel_id: typeof payload.channel_id === "string" ? payload.channel_id : null,
      journey_id: typeof payload.journey_id === "string" ? payload.journey_id : null,
      lesson_id: typeof payload.lesson_id === "string" ? payload.lesson_id : null,
      ai_suggestion_id: typeof payload.ai_suggestion_id === "string" ? payload.ai_suggestion_id : null,
      notification_queue_id: String(row.id ?? "") || null,
    },
    display_requirements: {
      sponsor_disclaimer_required: inferredClass === "sponsored_coaching_campaign_update",
      sponsor_attribution_required: inferredClass === "sponsored_coaching_campaign_update",
      paywall_cta_required: inferredClass === "package_access_changed",
      ai_approval_boundary_notice_required:
        inferredClass === "ai_review_queue_pending" || inferredClass === "ai_review_outcome",
    },
    delivery_channel_origin: "notifications_queue",
    created_at: String(row.created_at ?? "") || null,
    read_model_status: "partial_in_family",
    notes: [
      "notification item is inferred from notification_queue row + optional payload refs",
      "delivery/read state semantics are queue-oriented and may not equal end-user inbox read state",
    ],
  };
}

function buildNotificationQueueReadModel(row: NotificationQueueRow): NotificationQueueReadModel {
  const status = String(row.status ?? "");
  const notificationClass = inferNotificationClassFromQueueRow(row);
  const statusBucket: NotificationQueueReadModel["status_bucket"] =
    status === "queued" ? "queued" : status === "sent" ? "sent" : status === "failed" ? "failed" : "unknown";
  const dispatchOutcome: NotificationQueueReadModel["dispatch_outcome"] =
    status === "queued" ? "pending" : status === "sent" ? "success" : status === "failed" ? "failed" : "unknown";
  const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
  const attempts = toNumberOrZero(row.attempts);
  return {
    notification_class: notificationClass,
    status_bucket: statusBucket,
    dispatch_outcome: dispatchOutcome,
    retry_metadata: {
      attempts,
      retry_eligible: statusBucket === "failed" && attempts < 5,
      last_error_present: Boolean(String(row.last_error ?? "")),
    },
    policy_flags: {
      requires_visibility_entitlement_check:
        notificationClass === "coaching_assignment_published" ||
        notificationClass === "package_access_changed" ||
        notificationClass === "sponsored_coaching_campaign_update",
      preserves_ai_approval_first_boundary:
        notificationClass === "ai_review_queue_pending" || notificationClass === "ai_review_outcome",
      sponsor_disclaimer_required: notificationClass === "sponsored_coaching_campaign_update",
    },
    linked_context_refs: {
      team_id: typeof payload.team_id === "string" ? payload.team_id : null,
      challenge_id: typeof payload.challenge_id === "string" ? payload.challenge_id : null,
      sponsored_challenge_id: typeof payload.sponsored_challenge_id === "string" ? payload.sponsored_challenge_id : null,
      channel_id: typeof payload.channel_id === "string" ? payload.channel_id : null,
      journey_id: typeof payload.journey_id === "string" ? payload.journey_id : null,
      lesson_id: typeof payload.lesson_id === "string" ? payload.lesson_id : null,
      ai_suggestion_id: typeof payload.ai_suggestion_id === "string" ? payload.ai_suggestion_id : null,
      notification_queue_id: String(row.id ?? "") || null,
    },
    delivery_channel_origin: statusBucket === "sent" ? "notifications_dispatch" : "notifications_queue",
    read_model_status: "partial_in_family",
    notes: [
      "ops visibility metadata is derived from notification_queue row status/attempts and optional payload refs only",
      "provider-specific dispatch receipts and policy engine outcomes are not persisted in current baseline",
    ],
  };
}

function attachNotificationQueueReadModel<T extends NotificationQueueRow>(row: T): T & { notification_queue_read_model: NotificationQueueReadModel } {
  return {
    ...row,
    notification_queue_read_model: buildNotificationQueueReadModel(row),
  };
}

function buildNotificationQueueSummary(rows: NotificationQueueRow[]) {
  let queued = 0;
  let sent = 0;
  let failed = 0;
  let retriesPending = 0;
  const countsByClass = emptyNotificationClassCounts();
  for (const row of rows) {
    const status = String(row.status ?? "");
    if (status === "queued") queued += 1;
    else if (status === "sent") sent += 1;
    else if (status === "failed") failed += 1;
    const attempts = toNumberOrZero(row.attempts);
    if (status === "failed" && attempts < 5) retriesPending += 1;
    const inferredClass = inferNotificationClassFromQueueRow(row);
    countsByClass[inferredClass] = (countsByClass[inferredClass] ?? 0) + 1;
  }
  return {
    total: rows.length,
    status_buckets: { queued, sent, failed },
    retries_pending: retriesPending,
    counts_by_class: countsByClass,
    policy_flags: {
      ai_approval_boundary_preserved: true,
      queue_visibility_only_no_dispatch_authority_expansion: true,
    },
    read_model_status: "partial_in_family" as const,
    notes: [
      "queue summary is derived from notification_queue rows only",
      "member-facing inbox/read-state aggregates require additional endpoint-family shaping or persistence beyond this ops queue baseline",
    ],
  };
}

function buildPackagingReadModel(
  partial: Partial<PackagingReadModel> & Pick<PackagingReadModel, "linked_context_refs">
): PackagingReadModel {
  return {
    package_type: partial.package_type ?? null,
    visibility_state: partial.visibility_state ?? "unknown",
    entitlement_result: partial.entitlement_result ?? "unknown",
    linked_context_refs: {
      team_id: partial.linked_context_refs.team_id ?? null,
      challenge_id: partial.linked_context_refs.challenge_id ?? null,
      sponsored_challenge_id: partial.linked_context_refs.sponsored_challenge_id ?? null,
      sponsor_id: partial.linked_context_refs.sponsor_id ?? null,
      channel_id: partial.linked_context_refs.channel_id ?? null,
      journey_id: partial.linked_context_refs.journey_id ?? null,
    },
    display_requirements: {
      sponsor_disclaimer_required: partial.display_requirements?.sponsor_disclaimer_required ?? false,
      sponsor_attribution_required: partial.display_requirements?.sponsor_attribution_required ?? false,
      paywall_cta_required: partial.display_requirements?.paywall_cta_required ?? false,
    },
    read_model_status: partial.read_model_status ?? "not_evaluated",
    ...(partial.notes ? { notes: partial.notes } : {}),
  };
}

function packagingReadModelForChannel(channel: {
  id?: unknown;
  type?: unknown;
  team_id?: unknown;
  context_id?: unknown;
  is_active?: unknown;
}): PackagingReadModel {
  const channelType = String(channel.type ?? "");
  const contextId = String(channel.context_id ?? "") || null;
  const teamId = String(channel.team_id ?? "") || null;
  const packageType: PackagingReadModel["package_type"] =
    channelType === "team"
      ? "team_coaching_program"
      : channelType === "sponsor"
        ? "sponsored_challenge_coaching_campaign"
        : null;

  return buildPackagingReadModel({
    package_type: packageType,
    visibility_state: Boolean(channel.is_active ?? true) ? "published" : "unavailable",
    entitlement_result: "allowed_channel_member",
    linked_context_refs: {
      team_id: teamId,
      challenge_id: channelType === "challenge" ? contextId : null,
      sponsored_challenge_id: channelType === "sponsor" ? contextId : null,
      sponsor_id: channelType === "sponsor" ? contextId : null,
      channel_id: String(channel.id ?? "") || null,
      journey_id: null,
    },
    display_requirements: {
      sponsor_disclaimer_required: channelType === "sponsor",
      sponsor_attribution_required: channelType === "sponsor",
      paywall_cta_required: false,
    },
    read_model_status: packageType ? "inferred_baseline" : "partial_in_family",
    notes:
      channelType === "challenge"
        ? ["challenge channel may require package attribution from linked challenge/sponsor context"]
        : channelType === "direct" || channelType === "cohort"
          ? ["package attribution unavailable in current channel payload baseline"]
          : undefined,
  });
}

function packagingReadModelForJourney(journey: {
  id?: unknown;
  team_id?: unknown;
  is_active?: unknown;
}): PackagingReadModel {
  const teamId = String(journey.team_id ?? "") || null;
  return buildPackagingReadModel({
    package_type: teamId ? "team_coaching_program" : null,
    visibility_state: Boolean(journey.is_active ?? true) ? "published" : "unavailable",
    entitlement_result: "not_evaluated",
    linked_context_refs: {
      team_id: teamId,
      challenge_id: null,
      sponsored_challenge_id: null,
      sponsor_id: null,
      channel_id: null,
      journey_id: String(journey.id ?? "") || null,
    },
    display_requirements: {
      sponsor_disclaimer_required: false,
      sponsor_attribution_required: false,
      paywall_cta_required: false,
    },
    read_model_status: "partial_in_family",
    notes: [
      "entitlement_result is not evaluated in current coaching journey handlers; server-side package entitlement output remains an in-family extension gap",
    ],
  });
}

function packagingReadModelForSponsoredChallenge(row: {
  id?: unknown;
  sponsors?: { id?: unknown } | null;
  disclaimer?: unknown;
}): PackagingReadModel {
  const sponsorId = String((row.sponsors as { id?: unknown } | null)?.id ?? "") || null;
  return buildPackagingReadModel({
    package_type: "sponsored_challenge_coaching_campaign",
    visibility_state: "published",
    entitlement_result: "allowed_tier_gated",
    linked_context_refs: {
      team_id: null,
      challenge_id: null,
      sponsored_challenge_id: String(row.id ?? "") || null,
      sponsor_id: sponsorId,
      channel_id: null,
      journey_id: null,
    },
    display_requirements: {
      sponsor_disclaimer_required: Boolean(row.disclaimer),
      sponsor_attribution_required: true,
      paywall_cta_required: false,
    },
    read_model_status: "partial_in_family",
    notes: [
      "linked coaching journey/channel refs are not present in current sponsored challenge payload baseline",
    ],
  });
}

function parseAiSuggestionScope(scopeRaw: string): Pick<
  AiSuggestionQueueReadModel,
  "source_surface" | "source_context_refs" | "request_intent" | "target_scope_summary" | "disclaimer_requirements" | "safety_flags"
> {
  const lower = scopeRaw.toLowerCase();
  const sourceSurface: AiSuggestionQueueReadModel["source_surface"] = lower.includes("channel_thread")
    ? "channel_thread"
    : lower.includes("broadcast")
      ? "coach_broadcast_compose"
      : lower.includes("lesson")
        ? "coaching_lesson_detail"
        : lower.includes("journey")
          ? "coaching_journey_detail"
          : lower.includes("challenge")
            ? "challenge_coaching_block"
            : lower.includes("team")
              ? "team_coaching_module"
              : null;
  const requestIntent: AiSuggestionQueueReadModel["request_intent"] = lower.includes("broadcast")
    ? "draft_broadcast"
    : lower.includes("rewrite")
      ? "rewrite"
      : lower.includes("reflection") || lower.includes("lesson")
        ? "reflection_prompt"
        : lower.includes("reply") || lower.includes("channel")
          ? "draft_reply"
          : "unknown";
  const disclaimerRequirements: string[] = [];
  if (lower.includes("sponsor")) {
    disclaimerRequirements.push("sponsor_disclaimer_review");
  }
  if (lower.includes("broadcast") || lower.includes("challenge")) {
    disclaimerRequirements.push("human_approval_required");
  }
  return {
    source_surface: sourceSurface,
    source_context_refs: {
      team_id: null,
      challenge_id: null,
      channel_id: null,
      journey_id: null,
      lesson_id: null,
      package_id: null,
    },
    request_intent: requestIntent,
    target_scope_summary: scopeRaw,
    disclaimer_requirements: disclaimerRequirements,
    safety_flags: [],
  };
}

function buildAiSuggestionQueueReadModel(row: AiSuggestionRow): AiSuggestionQueueReadModel {
  const scopeRaw = String(row.scope ?? "");
  const scopeParts = parseAiSuggestionScope(scopeRaw);
  const statusRaw = String(row.status ?? "");
  const queueStatus: AiSuggestionQueueReadModel["approval_queue"]["queue_status"] =
    statusRaw === "pending" ? "pending_review" : statusRaw === "approved" ? "approved" : statusRaw === "rejected" ? "rejected" : "unknown";
  const reviewDecision: AiSuggestionQueueReadModel["audit_summary"]["review_decision"] =
    statusRaw === "pending" || statusRaw === "approved" || statusRaw === "rejected" ? (statusRaw as "pending" | "approved" | "rejected") : "unknown";
  return {
    ...scopeParts,
    draft_content: String(row.proposed_message ?? ""),
    required_approval_tier: "admin",
    audit_summary: {
      requester_user_id: String(row.created_by ?? "") || null,
      target_user_id: String(row.user_id ?? "") || null,
      reviewer_user_id: String(row.approved_by ?? row.rejected_by ?? "") || null,
      review_decision: reviewDecision,
      created_at: String(row.created_at ?? "") || null,
      updated_at: String(row.updated_at ?? "") || null,
      decision_at: String(row.sent_at ?? row.updated_at ?? "") || null,
      linked_execution_refs: {
        message_id: null,
        broadcast_id: null,
        publish_event_id: null,
      },
      edited_content_indicator: "unknown",
      reviewer_reason_present: false,
    },
    approval_queue: {
      queue_status: queueStatus,
      approval_authority_model: "platform_admin_only_current_baseline",
      escalation_required: queueStatus === "pending_review",
    },
    model_meta: {
      provider: null,
      model_family: null,
    },
    read_model_status: "partial_in_family",
    notes: [
      "W5 in-family AI suggestion queue read-model is inferred from existing ai_suggestions columns only",
      "source_context_refs and model metadata are not persisted in current schema baseline",
      "approval reasons and execution linkage refs are unavailable without further contract/schema work",
    ],
  };
}

function attachAiSuggestionQueueReadModel<T extends AiSuggestionRow>(row: T): T & { ai_queue_read_model: AiSuggestionQueueReadModel } {
  return {
    ...row,
    ai_queue_read_model: buildAiSuggestionQueueReadModel(row),
  };
}

function buildAiSuggestionQueueSummary(rows: AiSuggestionRow[]) {
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  for (const row of rows) {
    const status = String(row.status ?? "");
    if (status === "pending") pending += 1;
    else if (status === "approved") approved += 1;
    else if (status === "rejected") rejected += 1;
  }
  return {
    total: rows.length,
    by_status: { pending, approved, rejected },
    approval_authority_model: "platform_admin_only_current_baseline" as const,
    read_model_status: "partial_in_family" as const,
    notes: [
      "Queue summary is derived from ai_suggestions.status only",
      "No per-scope queue partitioning is available in current in-family baseline",
    ],
  };
}

type UserMetadata = {
  selected_kpis?: string[];
  kpi_weekly_inputs?: Record<string, { historicalWeeklyAverage: number; targetWeeklyCount: number }>;
  average_price_point?: number;
  commission_rate_percent?: number;
  commission_rate_decimal?: number;
  last_year_gci?: number;
  ytd_gci?: number;
  last_activity_timestamp?: string;
  pipeline_listings_pending?: number;
  pipeline_buyers_uc?: number;
  onboarding_projection_seeded_at?: string;
};

app.use(cors());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as RawBodyRequest).rawBody = buf.toString("utf8");
    },
  })
);
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "compasskpi-backend" });
});

app.get("/me", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    let userRow: {
      role?: string | null;
      tier?: string | null;
      account_status?: string | null;
      geo_city?: string | null;
      geo_state?: string | null;
      avatar_url?: string | null;
    } | null = null;
    if (dataClient) {
      await ensureUserRow(auth.user.id);
      const { data } = await dataClient
        .from("users")
        .select("role,tier,account_status,geo_city,geo_state,avatar_url")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (data) {
        userRow = data as {
          role?: string | null;
          tier?: string | null;
          account_status?: string | null;
          geo_city?: string | null;
          geo_state?: string | null;
          avatar_url?: string | null;
        };
      }
    }

    const tier = normalizeTier(userRow?.tier ?? "free");
    const effectivePlan = effectivePlanFromTier(tier);
    const entitlements = await loadTierEntitlements(tier);
    const seatContext = await buildSeatContext(auth.user.id, tier);

    return res.json({
      id: auth.user.id,
      email: auth.user.email,
      role: userRow?.role ?? null,
      tier,
      effective_plan: effectivePlan,
      entitlements,
      seat_context: seatContext,
      account_status: userRow?.account_status ?? null,
      geo_city: userRow?.geo_city ?? null,
      geo_state: userRow?.geo_state ?? null,
      avatar_url: userRow?.avatar_url ?? null,
      user_metadata: auth.user.user_metadata,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in /me", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/me", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }
    if (!supabaseServiceRoleKey) {
      return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY is required for profile updates" });
    }

    const payloadCheck = validateMeProfileUpdatePayload(req.body);
    if (!payloadCheck.ok) {
      return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    }
    const payload = payloadCheck.payload;

    await ensureUserRow(auth.user.id);

    const userPatch: Record<string, unknown> = {};
    if (payload.average_price_point !== undefined) {
      userPatch.average_price_point = payload.average_price_point;
    }
    if (payload.commission_rate_percent !== undefined) {
      userPatch.commission_rate = payload.commission_rate_percent / 100;
    }
    if (payload.geo_city !== undefined) {
      userPatch.geo_city = payload.geo_city || null;
    }
    if (payload.geo_state !== undefined) {
      userPatch.geo_state = payload.geo_state || null;
    }
    if (payload.avatar_url !== undefined) {
      userPatch.avatar_url = payload.avatar_url || null;
    }
    if (Object.keys(userPatch).length > 0) {
      const { error: updateUserRowError } = await dataClient
        .from("users")
        .update(userPatch)
        .eq("id", auth.user.id);
      if (updateUserRowError) {
        return handleSupabaseError(res, "Failed to update user profile row", updateUserRowError);
      }
    }

    const metadataPatch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) {
        metadataPatch[key] = value;
      }
    }
    const existingMetadata =
      auth.user.user_metadata && typeof auth.user.user_metadata === "object"
        ? (auth.user.user_metadata as Record<string, unknown>)
        : {};
    let mergedMetadata: Record<string, unknown> = {
      ...existingMetadata,
      ...metadataPatch,
    };

    const seedResult = await maybeSeedInitialProjectionFromOnboarding(auth.user.id, mergedMetadata);
    if (!seedResult.ok) {
      return res.status(seedResult.status).json({ error: seedResult.error });
    }
    mergedMetadata = seedResult.mergedMetadata;

    const { data: updatedAuth, error: updateAuthError } = await dataClient.auth.admin.updateUserById(
      auth.user.id,
      { user_metadata: mergedMetadata }
    );
    if (updateAuthError) {
      return handleSupabaseError(res, "Failed to update auth user metadata", updateAuthError);
    }

    const avatarUrlOut =
      payload.avatar_url !== undefined
        ? payload.avatar_url || null
        : typeof existingMetadata.avatar_url === "string"
          ? String(existingMetadata.avatar_url)
          : null;

    return res.json({
      id: auth.user.id,
      email: auth.user.email,
      avatar_url: avatarUrlOut,
      user_metadata: updatedAuth.user?.user_metadata ?? mergedMetadata,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PATCH /me", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/profile/avatar/upload-url", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }
    if (!isRecord(req.body)) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }

    const fileName = typeof req.body.file_name === "string" ? req.body.file_name.trim() : "";
    const contentType = typeof req.body.content_type === "string" ? req.body.content_type.trim().toLowerCase() : "";
    const contentLengthBytes = Number(req.body.content_length_bytes ?? 0);
    if (!fileName) {
      return res.status(422).json({ error: "file_name is required" });
    }
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(contentType)) {
      return res.status(422).json({ error: "Unsupported content_type. Allowed: image/jpeg, image/png, image/webp" });
    }
    if (!Number.isFinite(contentLengthBytes) || contentLengthBytes <= 0 || contentLengthBytes > 8 * 1024 * 1024) {
      return res.status(422).json({ error: "content_length_bytes must be > 0 and <= 8MB" });
    }

    const avatarBucket = (process.env.PROFILE_AVATAR_BUCKET ?? "avatars").trim() || "avatars";
    const safeBaseName = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
    const extFromName = safeBaseName.includes(".") ? safeBaseName.slice(safeBaseName.lastIndexOf(".")).toLowerCase() : "";
    const fallbackExt = contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg";
    const fileExt = [".jpg", ".jpeg", ".png", ".webp"].includes(extFromName) ? extFromName : fallbackExt;
    const storagePath = `avatars/${auth.user.id}/${Date.now()}-${crypto.randomUUID()}${fileExt}`;

    const { data: signedUpload, error: signedUploadError } = await dataClient.storage
      .from(avatarBucket)
      .createSignedUploadUrl(storagePath);
    if (signedUploadError) {
      return handleSupabaseError(res, "Failed to create signed avatar upload URL", signedUploadError);
    }
    if (!signedUpload?.signedUrl) {
      return res.status(500).json({ error: "Failed to create signed avatar upload URL" });
    }
    const publicUrlResult = dataClient.storage.from(avatarBucket).getPublicUrl(storagePath);
    const fileUrl = publicUrlResult.data?.publicUrl ?? null;
    if (!fileUrl) {
      return res.status(500).json({ error: "Unable to resolve avatar file URL" });
    }
    return res.status(201).json({
      upload_url: signedUpload.signedUrl,
      file_url: fileUrl,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/profile/avatar/upload-url", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/billing/checkout-session", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!isRecord(req.body) || typeof req.body.plan_sku !== "string" || !req.body.plan_sku.trim()) {
      return res.status(422).json({ error: "plan_sku is required" });
    }
    const planSku = req.body.plan_sku.trim();
    const targetTier = mapPlanSkuToTier(planSku);
    const checkoutUrl = process.env.STRIPE_CHECKOUT_BASE_URL
      ? `${process.env.STRIPE_CHECKOUT_BASE_URL}?prefilled_email=${encodeURIComponent(auth.user.email ?? "")}&client_reference_id=${encodeURIComponent(auth.user.id)}&plan=${encodeURIComponent(planSku)}`
      : `https://billing.mock.compass.local/checkout?plan=${encodeURIComponent(planSku)}&user_id=${encodeURIComponent(auth.user.id)}`;

    await dataClient.from("payment_events").insert({
      provider: "stripe",
      event_id: `checkout_req_${crypto.randomUUID()}`,
      event_type: "checkout.session.requested",
      user_id: auth.user.id,
      payload: {
        plan_sku: planSku,
        target_tier: targetTier,
        checkout_url: checkoutUrl,
      },
      processing_status: "processed",
      processed_at: new Date().toISOString(),
    });

    return res.json({
      provider: "stripe",
      checkout_url: checkoutUrl,
      plan_sku: planSku,
      target_tier: targetTier,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/billing/checkout-session", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/billing/portal-session", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const { data: subscription } = await dataClient
      .from("subscriptions")
      .select("stripe_customer_id,plan_sku,tier,status")
      .eq("user_id", auth.user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const portalUrl = process.env.STRIPE_PORTAL_BASE_URL
      ? `${process.env.STRIPE_PORTAL_BASE_URL}?customer=${encodeURIComponent(String((subscription as { stripe_customer_id?: unknown })?.stripe_customer_id ?? ""))}`
      : `https://billing.mock.compass.local/portal?user_id=${encodeURIComponent(auth.user.id)}`;
    return res.json({
      provider: "stripe",
      portal_url: portalUrl,
      subscription: subscription ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/billing/portal-session", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/webhooks/stripe", async (req, res) => {
  try {
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    const rawBody = (req as RawBodyRequest).rawBody ?? JSON.stringify(req.body ?? {});
    const validSignature = verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: req.headers["stripe-signature"],
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    if (!validSignature) {
      return res.status(401).json({ error: "Invalid Stripe webhook signature" });
    }
    if (!isRecord(req.body)) {
      return res.status(400).json({ error: "Webhook body must be an object" });
    }
    const eventId = typeof req.body.id === "string" ? req.body.id : `evt_${crypto.randomUUID()}`;
    const eventType = typeof req.body.type === "string" ? req.body.type : "unknown";
    const eventDataObj = isRecord(req.body.data) && isRecord(req.body.data.object) ? req.body.data.object : {};
    const stripeSubscriptionId =
      typeof eventDataObj.id === "string" && String(eventType).startsWith("customer.subscription.")
        ? eventDataObj.id
        : typeof eventDataObj.subscription === "string"
          ? eventDataObj.subscription
          : null;
    const customerId = typeof eventDataObj.customer === "string" ? eventDataObj.customer : null;
    const planSku =
      typeof eventDataObj.plan === "string"
        ? eventDataObj.plan
        : isRecord(eventDataObj.plan) && typeof eventDataObj.plan.id === "string"
          ? eventDataObj.plan.id
          : isRecord(eventDataObj.items) && Array.isArray(eventDataObj.items.data)
            ? (() => {
                const first = eventDataObj.items.data.find((item) => isRecord(item) && isRecord(item.price) && typeof item.price.id === "string");
                return isRecord(first) && isRecord(first.price) && typeof first.price.id === "string" ? first.price.id : null;
              })()
            : null;
    const mappedTier = mapPlanSkuToTier(planSku);
    const subscriptionStatus = normalizeSubscriptionStatus(eventDataObj.status);

    let userId: string | null = null;
    if (typeof eventDataObj.client_reference_id === "string") {
      userId = eventDataObj.client_reference_id;
    } else if (isRecord(eventDataObj.metadata) && typeof eventDataObj.metadata.user_id === "string") {
      userId = eventDataObj.metadata.user_id;
    } else if (customerId) {
      const { data: byCustomer } = await dataClient
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      userId = byCustomer ? String((byCustomer as { user_id?: unknown }).user_id ?? "") : null;
    }
    if (userId) {
      await ensureUserRow(userId);
    }

    let subscriptionId: string | null = null;
    if (userId) {
      const { data: subscriptionRow, error: upsertError } = await dataClient
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: stripeSubscriptionId,
            plan_sku: planSku,
            tier: mappedTier,
            status: subscriptionStatus,
            current_period_start:
              typeof eventDataObj.current_period_start === "number"
                ? new Date(eventDataObj.current_period_start * 1000).toISOString()
                : null,
            current_period_end:
              typeof eventDataObj.current_period_end === "number"
                ? new Date(eventDataObj.current_period_end * 1000).toISOString()
                : null,
            cancel_at_period_end: Boolean(eventDataObj.cancel_at_period_end),
            metadata: isRecord(eventDataObj.metadata) ? eventDataObj.metadata : {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_subscription_id" }
        )
        .select("id")
        .single();
      if (!upsertError && subscriptionRow) {
        subscriptionId = String((subscriptionRow as { id?: unknown }).id ?? "");
      }
      if (!upsertError) {
        const nextTier: CanonicalTier = subscriptionStatus === "active" || subscriptionStatus === "trialing" ? mappedTier : "free";
        await dataClient.from("users").update({ tier: nextTier, updated_at: new Date().toISOString() }).eq("id", userId);
      }
    }

    await dataClient.from("payment_events").upsert(
      {
        provider: "stripe",
        event_id: eventId,
        event_type: eventType,
        user_id: userId,
        subscription_id: subscriptionId,
        payload: req.body,
        processed_at: new Date().toISOString(),
        processing_status: "processed",
      },
      { onConflict: "provider,event_id" }
    );

    return res.json({ received: true, event_id: eventId, event_type: eventType });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/webhooks/stripe", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/kpi-logs", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const payloadCheck = validateKpiLogPayload(req.body);
    if (!payloadCheck.ok) {
      return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    }

    const write = await writeKpiLogForUser(auth.user.id, payloadCheck.payload);
    if (!write.ok) {
      return res.status(write.status).json({ error: write.error });
    }
    return res.status(write.httpStatus).json(write.body);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in /kpi-logs", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/kpi-logs/batch", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const payloadCheck = validateKpiLogBatchPayload(req.body);
    if (!payloadCheck.ok) {
      return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    }

    const results: Array<Record<string, unknown>> = [];
    let created = 0;
    let duplicates = 0;
    let failed = 0;

    for (let i = 0; i < payloadCheck.payload.logs.length; i += 1) {
      const write = await writeKpiLogForUser(auth.user.id, payloadCheck.payload.logs[i]);
      if (!write.ok) {
        failed += 1;
        results.push({ index: i, status: "failed", error: write.error });
        continue;
      }

      if (write.httpStatus === 200) {
        duplicates += 1;
      } else {
        created += 1;
      }
      results.push({
        index: i,
        status: write.httpStatus === 200 ? "duplicate" : "created",
        ...(write.body as Record<string, unknown>),
      });
    }

    return res.status(200).json({
      summary: { total: payloadCheck.payload.logs.length, created, duplicates, failed },
      results,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /kpi-logs/batch", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/kpi-logs/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const logId = req.params.id;
    if (!logId) {
      return res.status(422).json({ error: "log id is required" });
    }

    const { data: existingLog, error: loadError } = await dataClient
      .from("kpi_logs")
      .select("id,user_id,kpi_id,event_timestamp,logged_value")
      .eq("id", logId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (loadError) {
      return handleSupabaseError(res, "Failed to load KPI log for delete", loadError);
    }
    if (!existingLog) {
      return res.status(404).json({ error: "KPI log not found" });
    }

    const { data: kpiRow, error: kpiError } = await dataClient
      .from("kpis")
      .select("id,type,name")
      .eq("id", String((existingLog as { kpi_id?: unknown }).kpi_id ?? ""))
      .maybeSingle();
    if (kpiError) {
      return handleSupabaseError(res, "Failed to load KPI for delete side-effects", kpiError);
    }

    const { error: deleteError } = await dataClient
      .from("kpi_logs")
      .delete()
      .eq("id", logId)
      .eq("user_id", auth.user.id);
    if (deleteError) {
      return handleSupabaseError(res, "Failed to delete KPI log", deleteError);
    }

    if (String((kpiRow as { type?: unknown } | null)?.type ?? "") === "Pipeline_Anchor") {
      const kpiId = String((existingLog as { kpi_id?: unknown }).kpi_id ?? "");
      const { data: latestAnchorLog, error: latestAnchorLogError } = await dataClient
        .from("kpi_logs")
        .select("logged_value,event_timestamp")
        .eq("user_id", auth.user.id)
        .eq("kpi_id", kpiId)
        .order("event_timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestAnchorLogError) {
        return handleSupabaseError(res, "Failed to refresh pipeline anchor after delete", latestAnchorLogError);
      }
      if (latestAnchorLog) {
        const { error: upsertAnchorError } = await dataClient
          .from("pipeline_anchor_status")
          .upsert(
            {
              user_id: auth.user.id,
              kpi_id: kpiId,
              anchor_type: String((kpiRow as { name?: unknown } | null)?.name ?? "Pipeline Anchor"),
              anchor_value: toNumberOrZero((latestAnchorLog as { logged_value?: unknown }).logged_value),
              updated_at: String((latestAnchorLog as { event_timestamp?: unknown }).event_timestamp ?? new Date().toISOString()),
            },
            { onConflict: "user_id,kpi_id" }
          );
        if (upsertAnchorError) {
          return handleSupabaseError(res, "Failed to upsert pipeline anchor after delete", upsertAnchorError);
        }
      } else {
        const { error: deleteAnchorStatusError } = await dataClient
          .from("pipeline_anchor_status")
          .delete()
          .eq("user_id", auth.user.id)
          .eq("kpi_id", kpiId);
        if (deleteAnchorStatusError) {
          return handleSupabaseError(res, "Failed to clear pipeline anchor after delete", deleteAnchorStatusError);
        }
      }
    }

    return res.json({
      status: "deleted",
      log_id: logId,
      kpi_id: String((existingLog as { kpi_id?: unknown }).kpi_id ?? ""),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /kpi-logs/:id", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/dashboard", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const { data: logs, error: logsError } = await dataClient
      .from("kpi_logs")
      .select("id,event_timestamp,kpi_id,pc_generated,actual_gci_delta,deals_closed_delta,points_generated,payoff_start_date,delay_days_applied,hold_days_applied,decay_days_applied")
      .eq("user_id", auth.user.id)
      .order("event_timestamp", { ascending: false })
      .limit(3000);

    if (logsError) {
      return handleSupabaseError(res, "Failed to fetch dashboard data", logsError);
    }

    const safeLogs = logs ?? [];
    const now = new Date();

    const { data: kpiCatalogRows, error: kpiCatalogError } = await dataClient
      .from("kpis")
      .select("id,name,slug,type,requires_direct_value_input,is_active,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,gp_value,vp_value")
      .eq("is_active", true);

    if (kpiCatalogError) {
      return handleSupabaseError(res, "Failed to fetch dashboard KPI catalog", kpiCatalogError);
    }
    const safeKpiCatalog = kpiCatalogRows ?? [];
    const kpiById = new Map<string, KPIRecord>(
      safeKpiCatalog.map((row) => [
        String(row.id),
        {
          id: String(row.id),
          type: String(row.type) as KPIType,
          name: String(row.name ?? ""),
          slug: String((row as { slug?: unknown }).slug ?? ""),
          requires_direct_value_input: Boolean(row.requires_direct_value_input),
          pc_weight: row.pc_weight as number | null | undefined,
          ttc_days: row.ttc_days as number | null | undefined,
          ttc_definition: row.ttc_definition as string | null | undefined,
          delay_days: row.delay_days as number | null | undefined,
          hold_days: row.hold_days as number | null | undefined,
          decay_days: row.decay_days as number | null | undefined,
          gp_value: (row as { gp_value?: number | null | undefined }).gp_value,
          vp_value: (row as { vp_value?: number | null | undefined }).vp_value,
        },
      ])
    );

    const actualGciFromLogs = safeLogs.reduce((sum, log) => sum + toNumberOrZero(log.actual_gci_delta), 0);
    const dealsClosed = safeLogs.reduce((sum, log) => sum + toNumberOrZero(log.deals_closed_delta), 0);
    const nowMs = now.getTime();
    const cutoff365Ms = nowMs - 365 * 24 * 60 * 60 * 1000;
    const startOfUtcYearMs = Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
    const actualGciLast365FromLogs = safeLogs.reduce((sum, log) => {
      const ts = new Date(String(log.event_timestamp ?? "")).getTime();
      if (Number.isNaN(ts) || ts < cutoff365Ms || ts > nowMs) return sum;
      return sum + toNumberOrZero(log.actual_gci_delta);
    }, 0);
    const actualGciYtdFromLogs = safeLogs.reduce((sum, log) => {
      const ts = new Date(String(log.event_timestamp ?? "")).getTime();
      if (Number.isNaN(ts) || ts < startOfUtcYearMs || ts > nowMs) return sum;
      return sum + toNumberOrZero(log.actual_gci_delta);
    }, 0);

    const gpLogs = safeLogs
      .filter((log) => kpiById.get(String(log.kpi_id))?.type === "GP")
      .map((log) => ({
        event_timestamp: String(log.event_timestamp),
        points_generated: toNumberOrZero(log.points_generated),
      }));
    const vpLogs = safeLogs
      .filter((log) => kpiById.get(String(log.kpi_id))?.type === "VP")
      .map((log) => ({
        event_timestamp: String(log.event_timestamp),
        points_generated: toNumberOrZero(log.points_generated),
      }));

    const gpVpState = computeGpVpState({
      now,
      gpLogs,
      vpLogs,
    });

    const { data: anchors, error: anchorError } = await dataClient
      .from("pipeline_anchor_status")
      .select("kpi_id,anchor_type,anchor_value,updated_at")
      .eq("user_id", auth.user.id);

    if (anchorError) {
      return handleSupabaseError(res, "Failed to fetch pipeline anchors", anchorError);
    }

    const meta = getUserMetadata(auth.user.user_metadata);
    const avgPrice = toNumberOrZero(meta.average_price_point);
    const commissionRateDecimal =
      meta.commission_rate_percent !== undefined
        ? toNumberOrZero(meta.commission_rate_percent) / 100
        : toNumberOrZero(meta.commission_rate_decimal);

    const pcEventsFromLogs: PcEvent[] = safeLogs.reduce<PcEvent[]>((acc, log) => {
        const kpi = kpiById.get(String(log.kpi_id));
        if (!kpi || kpi.type !== "PC") return acc;
        const initialPcGenerated = toNumberOrZero(log.pc_generated);
        if (initialPcGenerated <= 0) return acc;
        const logDelay = Number((log as { delay_days_applied?: unknown }).delay_days_applied);
        const logHold = Number((log as { hold_days_applied?: unknown }).hold_days_applied);
        const timingFromLog = resolvePcTiming({
          delay_days: Number.isFinite(logDelay) ? logDelay : kpi.delay_days,
          hold_days: Number.isFinite(logHold) ? logHold : kpi.hold_days,
          ttc_days: kpi.ttc_days,
          ttc_definition: kpi.ttc_definition,
        });
        const appliedDecay = toNumberOrZero((log as { decay_days_applied?: unknown }).decay_days_applied);
        acc.push({
          eventTimestampIso: String(log.event_timestamp),
          initialPcGenerated,
          delayBeforePayoffStartsDays: timingFromLog.delayDays,
          holdDurationDays: timingFromLog.holdDays,
          decayDurationDays: Math.max(1, appliedDecay || toNumberOrZero(kpi.decay_days) || 180),
        });
        return acc;
      }, []);

    const pcConfigById = Object.fromEntries(
      safeKpiCatalog
        .filter((kpi) => String(kpi.type) === "PC")
        .map((kpi) => [
          String(kpi.id),
          {
            pc_weight: toNumberOrZero(kpi.pc_weight),
            ttc_days: toNumberOrZero(kpi.ttc_days),
            ttc_definition: typeof kpi.ttc_definition === "string" ? kpi.ttc_definition : null,
            delay_days: toNumberOrZero(kpi.delay_days),
            hold_days: toNumberOrZero(kpi.hold_days),
            decay_days: toNumberOrZero(kpi.decay_days) || 180,
          },
        ])
    );

    const selectedKpiResolution = await resolveKpiSelectionIds(
      Array.isArray(meta.selected_kpis)
        ? meta.selected_kpis.filter((id): id is string => typeof id === "string")
        : []
    );
    if (!selectedKpiResolution.ok) {
      return res.status(selectedKpiResolution.status).json({ error: selectedKpiResolution.error });
    }
    const selectedKpis = selectedKpiResolution.ids;
    const rawWeeklyInputs = isRecord(meta.kpi_weekly_inputs) ? meta.kpi_weekly_inputs : {};
    const kpiWeeklyInputs: Record<string, { historicalWeeklyAverage: number; targetWeeklyCount: number }> = {};
    for (const [rawKey, value] of Object.entries(rawWeeklyInputs)) {
      const mappedId = selectedKpiResolution.by_input[rawKey] ?? selectedKpiResolution.by_input[normalizeKpiIdentifier(rawKey)];
      const parsed = parseBackplotInput(value);
      if (mappedId && parsed) kpiWeeklyInputs[mappedId] = parsed;
    }
    const syntheticOnboardingEvents = buildOnboardingBackplotPcEvents({
      now,
      averagePricePoint: avgPrice,
      commissionRateDecimal,
      selectedKpiIds: selectedKpis,
      kpiWeeklyInputs,
      kpiPcConfigById: pcConfigById,
    });

    const allPcEvents: PcEvent[] = pcEventsFromLogs.length > 0 ? pcEventsFromLogs : syntheticOnboardingEvents;
    const pipelineProjectionEvent = buildPipelineProjectionEvent({
      now,
      anchors: (anchors ?? []).map((row) => ({
        anchor_value: toNumberOrZero((row as { anchor_value?: unknown }).anchor_value),
      })),
      averagePricePoint: avgPrice,
      commissionRateDecimal,
    });
    const projectionPcEvents = pipelineProjectionEvent ? [...allPcEvents, pipelineProjectionEvent] : allPcEvents;

    const pastActualFromLogs = buildPastActual6mSeries(
      safeLogs.map((log) => ({
        event_timestamp: String(log.event_timestamp),
        actual_gci_delta: toNumberOrZero(log.actual_gci_delta),
      })),
      now
    );
    const fallbackPastActual6m = buildPastActual6mSeriesFromMetadata(now, {
      ytd_gci: meta.ytd_gci,
      last_year_gci: meta.last_year_gci,
    });
    const hasLoggedActuals = pastActualFromLogs.some((row) => toNumberOrZero(row.value) > 0);
    const pastActual6m = hasLoggedActuals ? pastActualFromLogs : fallbackPastActual6m;
    const futureProjected12m = buildFutureProjected12mSeries(projectionPcEvents, now, gpVpState.total_bump_percent);
    const projectedNext365 = Number(
      futureProjected12m.reduce((sum, row) => sum + toNumberOrZero(row.value), 0).toFixed(2)
    );
    const projectedRemainingThisYear = Number(
      futureProjected12m
        .filter((row) => {
          const dt = new Date(String(row.month_start ?? ""));
          return !Number.isNaN(dt.getTime()) && dt.getUTCFullYear() === now.getUTCFullYear();
        })
        .reduce((sum, row) => sum + toNumberOrZero(row.value), 0)
        .toFixed(2)
    );
    const actualGci = hasLoggedActuals
      ? actualGciFromLogs
      : Math.max(0, toNumberOrZero(meta.ytd_gci) || pastActual6m.reduce((sum, row) => sum + toNumberOrZero(row.value), 0));
    const actualGciYtd = hasLoggedActuals ? actualGciYtdFromLogs : Math.max(0, toNumberOrZero(meta.ytd_gci));
    const actualGciLast365 = hasLoggedActuals
      ? actualGciLast365FromLogs
      : Math.max(0, actualGciYtd + toNumberOrZero(meta.last_year_gci) - toNumberOrZero(meta.ytd_gci));
    const projectedGciYtd = Number((actualGciYtd + projectedRemainingThisYear).toFixed(2));

    const confidence = computeConfidence({
      now,
      lastActivityTimestampIso: getLastActivityTimestampFromLogsOrMetadata(safeLogs, meta.last_activity_timestamp),
      actualLogs: safeLogs.map((log) => ({
        event_timestamp: String(log.event_timestamp),
        actual_gci_delta: toNumberOrZero(log.actual_gci_delta),
      })),
      pcEvents: allPcEvents,
      anchors: (anchors ?? []).map((row) => ({
        anchor_value: toNumberOrZero((row as { anchor_value?: unknown }).anchor_value),
      })),
      averagePricePoint: avgPrice,
      commissionRateDecimal,
    });

    const { data: calibrationRows, error: calibrationError } = await dataClient
      .from("user_kpi_calibration")
      .select("sample_size,rolling_error_ratio,rolling_abs_pct_error")
      .eq("user_id", auth.user.id);
    if (calibrationError) {
      return handleSupabaseError(res, "Failed to fetch calibration diagnostics", calibrationError);
    }
    const calibrationDiagnostics = summarizeCalibrationDiagnostics(calibrationRows ?? []);

    const activeDaySet = new Set(
      safeLogs
        .map((log) => String(log.event_timestamp))
        .filter(Boolean)
        .map((iso) => iso.slice(0, 10))
    );

    return res.json({
      projection: {
        pc_90d: derivePc90dFromFutureSeries(futureProjected12m),
        pc_next_365: projectedNext365,
        projected_gci_ytd: projectedGciYtd,
        confidence: {
          score: confidence.score,
          band: confidence.band,
          components: confidence.components,
        },
        calibration_diagnostics: calibrationDiagnostics,
        bump_context: gpVpState,
        required_pipeline_anchors: anchors ?? [],
      },
      confidence: {
        components: confidence.components,
      },
      chart: {
        past_actual_6m: pastActual6m,
        future_projected_12m: futureProjected12m,
        confidence_band_by_month: futureProjected12m.map(() => confidence.band),
        boundary_index: Math.max(0, pastActual6m.length - 1),
      },
      actuals: {
        actual_gci: actualGci,
        actual_gci_last_365: Number(actualGciLast365.toFixed(2)),
        actual_gci_ytd: Number(actualGciYtd.toFixed(2)),
        deals_closed: dealsClosed,
      },
      points: {
        gp: gpVpState.gp_current,
        vp: gpVpState.vp_current,
      },
      activity: {
        total_logs: safeLogs.length,
        active_days: activeDaySet.size,
      },
      loggable_kpis: safeKpiCatalog.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        slug: String((row as { slug?: unknown }).slug ?? ""),
        type: String(row.type) as KPIType,
        requires_direct_value_input: Boolean(row.requires_direct_value_input),
        pc_weight: toNumberOrZero((row as { pc_weight?: unknown }).pc_weight),
        ttc_definition: String((row as { ttc_definition?: unknown }).ttc_definition ?? ""),
        delay_days: toNumberOrZero((row as { delay_days?: unknown }).delay_days),
        hold_days: toNumberOrZero((row as { hold_days?: unknown }).hold_days),
        decay_days: toNumberOrZero((row as { decay_days?: unknown }).decay_days),
        gp_value: (row as { gp_value?: unknown }).gp_value === null ? null : toNumberOrZero((row as { gp_value?: unknown }).gp_value),
        vp_value: (row as { vp_value?: unknown }).vp_value === null ? null : toNumberOrZero((row as { vp_value?: unknown }).vp_value),
      })),
      recent_logs: safeLogs
        .slice()
        .sort((a, b) => {
          const aTs = new Date(String(a.event_timestamp ?? 0)).getTime();
          const bTs = new Date(String(b.event_timestamp ?? 0)).getTime();
          return aTs - bTs;
        })
        .slice(-240)
        .map((log) => ({
          id: String((log as { id?: unknown }).id ?? ""),
          kpi_id: String(log.kpi_id ?? ""),
          kpi_name: String(kpiById.get(String(log.kpi_id))?.name ?? ""),
          event_timestamp: String(log.event_timestamp ?? ""),
          pc_generated: toNumberOrZero(log.pc_generated),
          actual_gci_delta: toNumberOrZero(log.actual_gci_delta),
          points_generated: toNumberOrZero(log.points_generated),
        })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in /dashboard", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/forecast-confidence/snapshot", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    await ensureUserRow(auth.user.id);

    const [{ data: userRow, error: userError }, { data: logs, error: logsError }, { data: anchors, error: anchorsError }, { data: activeKpis, error: kpiError }] =
      await Promise.all([
        dataClient.from("users").select("last_activity_timestamp,average_price_point,commission_rate").eq("id", auth.user.id).single(),
        dataClient
          .from("kpi_logs")
          .select("event_timestamp,kpi_id,pc_generated,actual_gci_delta,delay_days_applied,hold_days_applied,decay_days_applied")
          .eq("user_id", auth.user.id)
          .order("event_timestamp", { ascending: false })
          .limit(3000),
        dataClient
          .from("pipeline_anchor_status")
          .select("anchor_value")
          .eq("user_id", auth.user.id),
        dataClient
          .from("kpis")
          .select("id,type,ttc_days,ttc_definition,delay_days,hold_days,decay_days")
          .eq("is_active", true),
      ]);
    if (userError) return handleSupabaseError(res, "Failed to load user activity for confidence snapshot", userError);
    if (logsError) return handleSupabaseError(res, "Failed to load KPI logs for confidence snapshot", logsError);
    if (anchorsError) return handleSupabaseError(res, "Failed to load pipeline anchors for confidence snapshot", anchorsError);
    if (kpiError) return handleSupabaseError(res, "Failed to load KPI definitions for confidence snapshot", kpiError);

    const kpiById = new Map<string, KPIRecord>(
      (activeKpis ?? []).map((row) => [
        String(row.id),
        {
          id: String(row.id),
          type: String(row.type) as KPIType,
          ttc_days: row.ttc_days as number | null | undefined,
          ttc_definition: row.ttc_definition as string | null | undefined,
          delay_days: row.delay_days as number | null | undefined,
          hold_days: row.hold_days as number | null | undefined,
          decay_days: row.decay_days as number | null | undefined,
        },
      ])
    );

    const pcEvents: PcEvent[] = (logs ?? []).reduce<PcEvent[]>((acc, row) => {
        const kpi = kpiById.get(String((row as { kpi_id?: unknown }).kpi_id ?? ""));
        if (!kpi || kpi.type !== "PC") return acc;
        const pc = toNumberOrZero((row as { pc_generated?: unknown }).pc_generated);
        if (pc <= 0) return acc;
        const rowDelay = Number((row as { delay_days_applied?: unknown }).delay_days_applied);
        const rowHold = Number((row as { hold_days_applied?: unknown }).hold_days_applied);
        const timing = resolvePcTiming({
          delay_days: Number.isFinite(rowDelay) ? rowDelay : kpi.delay_days,
          hold_days: Number.isFinite(rowHold) ? rowHold : kpi.hold_days,
          ttc_days: kpi.ttc_days,
          ttc_definition: kpi.ttc_definition,
        });
        const decayDaysApplied = toNumberOrZero((row as { decay_days_applied?: unknown }).decay_days_applied);
        acc.push({
          eventTimestampIso: String((row as { event_timestamp?: unknown }).event_timestamp ?? ""),
          initialPcGenerated: pc,
          delayBeforePayoffStartsDays: timing.delayDays,
          holdDurationDays: timing.holdDays,
          decayDurationDays: Math.max(1, decayDaysApplied || toNumberOrZero(kpi.decay_days) || 180),
        });
        return acc;
      }, []);

    const averagePricePoint = toNumberOrZero((userRow as { average_price_point?: unknown } | null)?.average_price_point);
    const commissionRateDecimal = toNumberOrZero((userRow as { commission_rate?: unknown } | null)?.commission_rate);
    const confidence = computeConfidence({
      now: new Date(),
      lastActivityTimestampIso: String((userRow as { last_activity_timestamp?: unknown } | null)?.last_activity_timestamp ?? ""),
      actualLogs: (logs ?? []).map((row) => ({
        event_timestamp: String((row as { event_timestamp?: unknown }).event_timestamp ?? ""),
        actual_gci_delta: toNumberOrZero((row as { actual_gci_delta?: unknown }).actual_gci_delta),
      })),
      pcEvents,
      anchors: (anchors ?? []).map((row) => ({
        anchor_value: toNumberOrZero((row as { anchor_value?: unknown }).anchor_value),
      })),
      averagePricePoint,
      commissionRateDecimal,
    });

    const nowIso = new Date().toISOString();

    const { data: snapshot, error: insertError } = await dataClient
      .from("forecast_confidence_snapshots")
      .insert({
        user_id: auth.user.id,
        recency_score: confidence.components.inactivity_score,
        accuracy_score: confidence.components.historical_accuracy_score,
        anchor_score: confidence.components.pipeline_health_score,
        inactivity_days: confidence.components.inactivity_days,
        confidence_score: confidence.score,
        confidence_band: confidence.band,
        computed_at: nowIso,
      })
      .select("id,user_id,recency_score,accuracy_score,anchor_score,inactivity_days,confidence_score,confidence_band,computed_at")
      .single();
    if (insertError) return handleSupabaseError(res, "Failed to persist confidence snapshot", insertError);

    return res.json({
      confidence: {
        score: confidence.score,
        band: confidence.band,
        components: confidence.components,
      },
      snapshot,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/forecast-confidence/snapshot", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/channels", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const { data: memberships, error: membershipError } = await dataClient
      .from("channel_memberships")
      .select("channel_id,role")
      .eq("user_id", auth.user.id);
    if (membershipError) {
      return handleSupabaseError(res, "Failed to fetch channel memberships", membershipError);
    }
    const safeMemberships = memberships ?? [];
    const channelIds = safeMemberships.map((m) => String(m.channel_id));
    if (channelIds.length === 0) {
      return res.json({
        channels: [],
        notification_items: [],
        notification_summary_read_model: buildNotificationSummaryReadModel({
          items: [],
          source_scope: "channels_list",
          read_model_status: "partial_in_family",
          notes: ["No channel memberships found for caller; channel-derived notification summary is empty"],
        }),
      });
    }

    const { data: channels, error: channelsError } = await dataClient
      .from("channels")
      .select("id,type,name,team_id,context_id,is_active,created_at")
      .in("id", channelIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (channelsError) {
      return handleSupabaseError(res, "Failed to fetch channels", channelsError);
    }

    const { data: unreads, error: unreadsError } = await dataClient
      .from("message_unreads")
      .select("channel_id,unread_count,last_seen_at")
      .eq("user_id", auth.user.id)
      .in("channel_id", channelIds);
    if (unreadsError) {
      return handleSupabaseError(res, "Failed to fetch unread counters", unreadsError);
    }

    const membershipByChannel = new Map(
      safeMemberships.map((m) => [String(m.channel_id), String(m.role)])
    );
    const unreadByChannel = new Map(
      (unreads ?? []).map((u) => [
        String(u.channel_id),
        { unread_count: toNumberOrZero((u as { unread_count?: unknown }).unread_count), last_seen_at: u.last_seen_at },
      ])
    );

    // ── DM display name resolution ──
    // For direct channels, look up the counterpart user's name
    const safeChannels = channels ?? [];
    const directChannelIds = safeChannels
      .filter((c) => String((c as { type?: unknown }).type ?? "") === "direct")
      .map((c) => String(c.id));

    const dmDisplayNameByChannel = new Map<string, string>();
    if (directChannelIds.length > 0) {
      const { data: dmMemberships } = await dataClient
        .from("channel_memberships")
        .select("channel_id,user_id")
        .in("channel_id", directChannelIds);
      if (dmMemberships && dmMemberships.length > 0) {
        // Collect all counterpart user IDs (not the current user)
        const counterpartUserIds = new Set<string>();
        const channelToCounterpart = new Map<string, string>();
        for (const m of dmMemberships) {
          const chId = String(m.channel_id);
          const uid = String(m.user_id);
          if (uid !== auth.user.id) {
            counterpartUserIds.add(uid);
            channelToCounterpart.set(chId, uid);
          }
        }
        if (counterpartUserIds.size > 0) {
          const { data: userRows } = await dataClient
            .from("users")
            .select("id,full_name")
            .in("id", Array.from(counterpartUserIds));
          const nameById = new Map<string, string>(
            (userRows ?? []).map((u) => [String(u.id), String((u as { full_name?: unknown }).full_name ?? "")])
          );
          for (const [chId, uid] of channelToCounterpart) {
            const name = nameById.get(uid);
            if (name) {
              dmDisplayNameByChannel.set(chId, name);
            }
          }
        }
      }
    }

    // ── Last message preview per channel ──
    // Fetch the most recent message for each channel the user belongs to.
    // Supabase JS doesn't support DISTINCT ON, so we fetch recent messages
    // ordered by created_at desc, then pick the first per channel.
    const lastMessageByChannel = new Map<string, { body: string; created_at: string; sender_user_id: string }>();
    if (channelIds.length > 0) {
      const { data: recentMessages } = await dataClient
        .from("channel_messages")
        .select("channel_id,body,created_at,sender_user_id")
        .in("channel_id", channelIds)
        .order("created_at", { ascending: false })
        .limit(channelIds.length * 3);
      for (const msg of recentMessages ?? []) {
        const chId = String(msg.channel_id);
        if (!lastMessageByChannel.has(chId)) {
          lastMessageByChannel.set(chId, {
            body: String((msg as { body?: unknown }).body ?? ""),
            created_at: String(msg.created_at ?? ""),
            sender_user_id: String(msg.sender_user_id ?? ""),
          });
        }
      }
    }

    const channelRows = (channels ?? []).map((channel) => {
      const channelId = String(channel.id);
      const syncState = streamChannelSyncStates.get(channelId);
      const isDirect = String((channel as { type?: unknown }).type ?? "") === "direct";
      const lastMsg = lastMessageByChannel.get(channelId);

      // Build last-message preview (safe-truncated to 120 chars)
      let lastMessagePreview: string | null = null;
      let lastMessageAt: string | null = null;
      if (lastMsg && lastMsg.body) {
        const rawBody = lastMsg.body;
        const previewText = rawBody.length > 120 ? rawBody.slice(0, 117) + "..." : rawBody;
        lastMessagePreview = previewText;
        lastMessageAt = lastMsg.created_at || null;
      }

      // Deterministic fallback for empty channels
      if (!lastMessagePreview) {
        lastMessagePreview = isDirect ? "No messages yet — say hello!" : "No messages yet";
        lastMessageAt = null;
      }

      return {
        ...channel,
        my_role: membershipByChannel.get(channelId) ?? "member",
        unread_count: unreadByChannel.get(channelId)?.unread_count ?? 0,
        last_seen_at: unreadByChannel.get(channelId)?.last_seen_at ?? null,
        // DM read model fields
        dm_display_name: isDirect ? (dmDisplayNameByChannel.get(channelId) ?? null) : null,
        last_message_preview: lastMessagePreview,
        last_message_at: lastMessageAt,
        packaging_read_model: packagingReadModelForChannel(channel),
        provider: "stream",
        provider_channel_id: streamProviderChannelId(channelId),
        provider_sync_status: (syncState ? "synced" : "not_synced") as StreamSyncStatus,
        provider_sync_updated_at: syncState?.providerSyncUpdatedAt ?? null,
        provider_error_code: null,
        provider_trace_id: null,
      };
    });
    const scopedChannelRows: typeof channelRows = [];
    for (const channel of channelRows) {
      const scopeCheck = await evaluateRoleScopeForChannel(auth.user.id, String((channel as { id?: unknown }).id ?? ""));
      if (!scopeCheck.ok) return res.status(scopeCheck.status).json({ error: scopeCheck.error });
      if (scopeCheck.result.allowed) {
        scopedChannelRows.push(channel);
      }
    }
    const notificationItems = scopedChannelRows.map((channel) =>
      buildNotificationItemForChannel({
        channel,
        unread_count: toNumberOrZero((channel as { unread_count?: unknown }).unread_count),
        last_seen_at: (channel as { last_seen_at?: unknown }).last_seen_at,
      })
    );

    return res.json({
      channels: scopedChannelRows,
      notification_items: notificationItems,
      notification_summary_read_model: buildNotificationSummaryReadModel({
        items: notificationItems,
        source_scope: "channels_list",
        badge_total: notificationItems.reduce(
          (sum, item) =>
            sum + (item.class === "coaching_channel_message" || item.class === "sponsored_coaching_campaign_update"
              ? (item.read_state === "unread" ? 1 : 0)
              : 0),
          0
        ),
        read_model_status: "inferred_baseline",
        notes: [
          "Channel list summary is inferred from per-channel unread counters, not canonical notification events",
          "Badge total counts unread channel-derived coaching/sponsor communication items only in this endpoint family",
        ],
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/channels", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/channels", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const payloadCheck = validateChannelCreatePayload(req.body);
    if (!payloadCheck.ok) {
      return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    }
    const payload = payloadCheck.payload;

    await ensureUserRow(auth.user.id);

    if (payload.type === "direct") {
      const requested = payload.member_user_ids ?? [];
      const memberUserIds = Array.from(new Set([auth.user.id, ...requested]));
      if (memberUserIds.length < 2) {
        return res.status(422).json({ error: "direct channels require at least one target member" });
      }

      const roleResult = await getUserRoleForScope(auth.user.id);
      if (!roleResult.ok) return res.status(roleResult.status).json({ error: roleResult.error });
      const actorRole = roleResult.role;
      if (actorRole === "challenge_sponsor") {
        return res.status(403).json({ error: "challenge_sponsor scope is limited to sponsor/challenge channels" });
      }

      const malformedUserId = memberUserIds.find((id) => !isUuidLike(id));
      if (malformedUserId) {
        return res.status(422).json({ error: `member_user_ids includes invalid user id format: ${malformedUserId}` });
      }

      const requiresSharedTeamScope = actorRole === "team_leader" || actorRole === "agent" || actorRole === "member";
      if (requiresSharedTeamScope) {
        for (const targetUserId of memberUserIds) {
          if (targetUserId === auth.user.id) continue;
          const sharedScope = await hasSharedTeamMembership(auth.user.id, targetUserId);
          if (!sharedScope.ok) return res.status(sharedScope.status).json({ error: sharedScope.error });
          if (!sharedScope.shared) {
            return res.status(403).json({ error: "Direct channels are limited to members in your shared team scope" });
          }
        }
      }

      const existingChannel = await findExistingDirectChannelForMemberSet(auth.user.id, memberUserIds);
      if (!existingChannel.ok) return res.status(existingChannel.status).json({ error: existingChannel.error });
      if (existingChannel.channel) {
        return res.status(200).json({ channel: existingChannel.channel, idempotent_replay: true });
      }

      const directName = payload.name && payload.name.trim() ? payload.name.trim() : "Direct Message";
      const { data: channel, error: channelError } = await dataClient
        .from("channels")
        .insert({
          type: "direct",
          name: directName,
          team_id: null,
          context_id: payload.context_id ?? null,
          created_by: auth.user.id,
        })
        .select("id,type,name,team_id,context_id,created_by,created_at")
        .single();
      if (channelError) {
        return handleSupabaseError(res, "Failed to create direct channel", channelError);
      }

      const channelMembershipRows = memberUserIds.map((memberUserId) => ({
        channel_id: channel.id,
        user_id: memberUserId,
        role: memberUserId === auth.user.id ? "admin" : "member",
      }));
      const { error: membershipError } = await dataClient
        .from("channel_memberships")
        .upsert(channelMembershipRows, { onConflict: "channel_id,user_id" });
      if (membershipError) {
        if (String((membershipError as { code?: unknown }).code ?? "") === "23503") {
          return res.status(422).json({ error: "member_user_ids includes one or more users that cannot be messaged" });
        }
        return handleSupabaseError(res, "Failed to create direct channel memberships", membershipError);
      }

      const nowIso = new Date().toISOString();
      const unreadRows = memberUserIds.map((memberUserId) => ({
        channel_id: channel.id,
        user_id: memberUserId,
        unread_count: 0,
        last_seen_at: nowIso,
        updated_at: nowIso,
      }));
      const { error: unreadError } = await dataClient
        .from("message_unreads")
        .upsert(unreadRows, { onConflict: "channel_id,user_id" });
      if (unreadError) {
        return handleSupabaseError(res, "Failed to initialize direct channel unread state", unreadError);
      }

      return res.status(201).json({ channel, idempotent_replay: false });
    }

    if (payload.team_id) {
      const teamLeaderCheck = await checkTeamLeader(payload.team_id, auth.user.id);
      if (!teamLeaderCheck.ok) {
        return res.status(teamLeaderCheck.status).json({ error: teamLeaderCheck.error });
      }
      const platformAdmin = await isPlatformAdmin(auth.user.id);
      if (!teamLeaderCheck.isLeader && !platformAdmin) {
        return res.status(403).json({ error: "Only team leaders or admins can create team channels" });
      }
    }

    const { data: channel, error: channelError } = await dataClient
      .from("channels")
      .insert({
        type: payload.type,
        name: payload.name ?? "Channel",
        team_id: payload.team_id ?? null,
        context_id: payload.context_id ?? null,
        created_by: auth.user.id,
      })
      .select("id,type,name,team_id,context_id,created_by,created_at")
      .single();
    if (channelError) {
      return handleSupabaseError(res, "Failed to create channel", channelError);
    }

    const { error: membershipError } = await dataClient.from("channel_memberships").insert({
      channel_id: channel.id,
      user_id: auth.user.id,
      role: "admin",
    });
    if (membershipError) {
      return handleSupabaseError(res, "Failed to create channel membership", membershipError);
    }

    const { error: unreadError } = await dataClient.from("message_unreads").upsert(
      {
        channel_id: channel.id,
        user_id: auth.user.id,
        unread_count: 0,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id,user_id" }
    );
    if (unreadError) {
      return handleSupabaseError(res, "Failed to initialize unread state", unreadError);
    }

    return res.status(201).json({ channel });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/channels", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/channels/token", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    }
    if (!dataClient) {
      return errorEnvelopeResponse(res, 503, "provider_unavailable", "Supabase data client not configured", req.headers["x-request-id"]);
    }

    const payloadCheck = validateChannelTokenPayload(req.body);
    if (!payloadCheck.ok) {
      return errorEnvelopeResponse(res, 422, "invalid_token_purpose", payloadCheck.error, req.headers["x-request-id"]);
    }
    const payload = payloadCheck.payload;

    const membership = await checkChannelMembership(payload.channel_id, auth.user.id);
    if (!membership.ok) {
      return errorEnvelopeResponse(res, 503, "provider_unavailable", membership.error, req.headers["x-request-id"]);
    }
    if (!membership.member) {
      return errorEnvelopeResponse(
        res,
        403,
        "scope_denied",
        "Caller is not a member of this channel",
        req.headers["x-request-id"]
      );
    }
    const roleScopeCheck = await evaluateRoleScopeForChannel(auth.user.id, payload.channel_id);
    if (!roleScopeCheck.ok) {
      return errorEnvelopeResponse(res, 503, "provider_unavailable", roleScopeCheck.error, req.headers["x-request-id"]);
    }
    if (!roleScopeCheck.result.allowed) {
      return errorEnvelopeResponse(
        res,
        403,
        "scope_denied",
        roleScopeCheck.result.reason ?? "Caller role scope does not allow this channel",
        req.headers["x-request-id"]
      );
    }

    const { data: channel, error: channelError } = await dataClient
      .from("channels")
      .select("id,type,name,team_id,context_id,is_active")
      .eq("id", payload.channel_id)
      .maybeSingle();
    if (channelError || !channel || !Boolean((channel as { is_active?: unknown }).is_active)) {
      return errorEnvelopeResponse(
        res,
        403,
        "scope_denied",
        "Channel is not active or caller scope does not allow access",
        req.headers["x-request-id"]
      );
    }

    if (payload.token_purpose === "channel_admin" && String((channel as { type?: unknown }).type ?? "") === "direct") {
      return errorEnvelopeResponse(
        res,
        422,
        "invalid_token_purpose",
        "channel_admin tokens are not available for direct channels",
        req.headers["x-request-id"]
      );
    }

    const roleAdminScopeCheck = await evaluateRoleScopeForChannel(auth.user.id, payload.channel_id, {
      requireLeaderForTeamScopedAdmin: true,
    });
    if (!roleAdminScopeCheck.ok) {
      return errorEnvelopeResponse(res, 503, "provider_unavailable", roleAdminScopeCheck.error, req.headers["x-request-id"]);
    }
    const roleAdminScopeAllowed = roleAdminScopeCheck.result.allowed;
    const roleAdminScopeRole = roleAdminScopeCheck.result.role;
    const channelTeamId = String((channel as { team_id?: unknown }).team_id ?? "");
    const platformAdmin = roleAdminScopeRole === "admin" || roleAdminScopeRole === "super_admin";
    const roleProvidesAdminScope =
      roleAdminScopeAllowed &&
      (roleAdminScopeRole === "coach" ||
        roleAdminScopeRole === "admin" ||
        roleAdminScopeRole === "super_admin" ||
        (roleAdminScopeRole === "team_leader" && Boolean(channelTeamId)));
    const isChannelAdmin = membership.role === "admin" || platformAdmin || roleProvidesAdminScope;
    const grants = {
      chat_read: true,
      chat_write: true,
      channel_admin: isChannelAdmin,
    };
    if (payload.token_purpose === "channel_admin" && !grants.channel_admin) {
      return errorEnvelopeResponse(
        res,
        403,
        "scope_denied",
        "Caller does not have channel admin scope",
        req.headers["x-request-id"]
      );
    }

    const snapshot = await buildChannelAuthoritySnapshot(payload.channel_id);
    if (!snapshot.ok) {
      const code = snapshot.status === 403 ? "scope_denied" : "provider_unavailable";
      return errorEnvelopeResponse(res, snapshot.status, code, snapshot.error, req.headers["x-request-id"]);
    }

    const issuance = await issueStreamSessionToken({
      userId: auth.user.id,
      channelId: payload.channel_id,
      tokenPurpose: payload.token_purpose,
      scopeGrants: grants,
      clientSessionId: payload.client_session_id,
    });
    if (!issuance.ok) {
      return errorEnvelopeResponse(res, 503, "provider_unavailable", issuance.message, req.headers["x-request-id"]);
    }

    const syncReadModel = deriveStreamSyncReadModel(payload.channel_id, snapshot.snapshot);
    const issuedByRequestId = resolveRequestId(req.headers["x-request-id"]);
    return res.json({
      provider: "stream",
      provider_user_id: issuance.providerUserId,
      provider_channel_id: streamProviderChannelId(payload.channel_id),
      provider_token: issuance.providerToken,
      expires_at: issuance.expiresAt,
      ttl_seconds: issuance.ttlSeconds,
      scope_grants: grants,
      issued_by_request_id: issuedByRequestId,
      provider_sync_status: syncReadModel.provider_sync_status,
      provider_sync_updated_at: syncReadModel.provider_sync_updated_at,
      provider_error_code: syncReadModel.provider_error_code,
      provider_trace_id: issuance.providerTraceId,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/channels/token", err);
    return errorEnvelopeResponse(res, 503, "provider_unavailable", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/channels/sync", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return errorEnvelopeResponse(res, 403, "scope_denied", auth.error, req.headers["x-request-id"]);
    }
    if (!dataClient) {
      return errorEnvelopeResponse(res, 503, "provider_unavailable", "Supabase data client not configured", req.headers["x-request-id"]);
    }

    const payloadCheck = validateChannelSyncPayload(req.body);
    if (!payloadCheck.ok) {
      return errorEnvelopeResponse(res, 409, "reconcile_conflict", payloadCheck.error, req.headers["x-request-id"]);
    }
    const payload = payloadCheck.payload;

    const membership = await checkChannelMembership(payload.channel_id, auth.user.id);
    if (!membership.ok) {
      return errorEnvelopeResponse(res, 503, "provider_unavailable", membership.error, req.headers["x-request-id"]);
    }
    if (!membership.member) {
      return errorEnvelopeResponse(
        res,
        403,
        "scope_denied",
        "Channel sync requires channel membership",
        req.headers["x-request-id"]
      );
    }
    const roleScopeCheck = await evaluateRoleScopeForChannel(auth.user.id, payload.channel_id, {
      requireLeaderForTeamScopedAdmin: true,
    });
    if (!roleScopeCheck.ok) {
      return errorEnvelopeResponse(res, 503, "provider_unavailable", roleScopeCheck.error, req.headers["x-request-id"]);
    }
    if (!roleScopeCheck.result.allowed) {
      return errorEnvelopeResponse(
        res,
        403,
        "scope_denied",
        roleScopeCheck.result.reason ?? "Caller role scope does not allow channel sync",
        req.headers["x-request-id"]
      );
    }
    const role = roleScopeCheck.result.role;
    const { data: channelForAdminScope, error: channelForAdminScopeError } = await dataClient
      .from("channels")
      .select("team_id")
      .eq("id", payload.channel_id)
      .maybeSingle();
    if (channelForAdminScopeError || !channelForAdminScope) {
      return errorEnvelopeResponse(
        res,
        403,
        "scope_denied",
        "Channel is not active or caller scope does not allow access",
        req.headers["x-request-id"]
      );
    }
    const teamIdForAdminScope = String((channelForAdminScope as { team_id?: unknown }).team_id ?? "");
    const isRoleAdmin =
      role === "coach" ||
      role === "admin" ||
      role === "super_admin" ||
      (role === "team_leader" && Boolean(teamIdForAdminScope));
    if (!(membership.role === "admin" || isRoleAdmin)) {
      return errorEnvelopeResponse(
        res,
        403,
        "scope_denied",
        "Channel sync requires channel admin scope",
        req.headers["x-request-id"]
      );
    }

    const snapshot = await buildChannelAuthoritySnapshot(payload.channel_id);
    if (!snapshot.ok) {
      const code = snapshot.status === 403 ? "scope_denied" : "provider_unavailable";
      return errorEnvelopeResponse(res, snapshot.status, code, snapshot.error, req.headers["x-request-id"]);
    }

    const current = streamChannelSyncStates.get(payload.channel_id);
    if (
      payload.expected_version !== undefined &&
      payload.expected_version !== (current?.version ?? 0)
    ) {
      return errorEnvelopeResponse(
        res,
        409,
        "reconcile_conflict",
        "expected_version does not match current authority snapshot",
        req.headers["x-request-id"]
      );
    }

    const syncDispatch = await syncStreamChannelToProvider({
      channelId: payload.channel_id,
      channelType: snapshot.snapshot.channelType,
      syncReason: payload.sync_reason,
      memberByUserId: snapshot.snapshot.memberByUserId,
      metadataHash: snapshot.snapshot.metadataHash,
    });
    if (!syncDispatch.ok) {
      return errorEnvelopeResponse(res, 503, "provider_unavailable", syncDispatch.message, req.headers["x-request-id"]);
    }

    const previousMembers = current?.memberByUserId ?? new Map<string, "admin" | "member">();
    const nextMembers = snapshot.snapshot.memberByUserId;
    let membersAdded = 0;
    let membersRemoved = 0;
    let rolesUpdated = 0;
    for (const [userId, role] of nextMembers.entries()) {
      const prevRole = previousMembers.get(userId);
      if (!prevRole) {
        membersAdded += 1;
      } else if (prevRole !== role) {
        rolesUpdated += 1;
      }
    }
    for (const userId of previousMembers.keys()) {
      if (!nextMembers.has(userId)) membersRemoved += 1;
    }

    const metadataUpdated = !current || current.metadataHash !== snapshot.snapshot.metadataHash;
    const providerSyncUpdatedAt = syncDispatch.providerSyncUpdatedAt;
    streamChannelSyncStates.set(payload.channel_id, {
      version: (current?.version ?? 0) + 1,
      memberByUserId: new Map(nextMembers),
      metadataHash: snapshot.snapshot.metadataHash,
      providerSyncUpdatedAt,
    });

    return res.json({
      provider: "stream",
      provider_channel_id: streamProviderChannelId(payload.channel_id),
      sync_status: "synced",
      sync_diff: {
        members_added: membersAdded,
        members_removed: membersRemoved,
        roles_updated: rolesUpdated,
        metadata_updated: metadataUpdated,
      },
      provider_sync_updated_at: providerSyncUpdatedAt,
      provider_trace_id: syncDispatch.providerTraceId,
      authority_version: (current?.version ?? 0) + 1,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/channels/sync", err);
    return errorEnvelopeResponse(res, 503, "provider_unavailable", "Internal server error", req.headers["x-request-id"]);
  }
});

app.get("/api/channels/:id/messages", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const channelId = req.params.id;
    if (!channelId) return res.status(422).json({ error: "channel id is required" });

    const membership = await checkChannelMembership(channelId, auth.user.id);
    if (!membership.ok) return res.status(membership.status).json({ error: membership.error });
    if (!membership.member) return res.status(403).json({ error: "Not a channel member" });
    const roleScopeCheck = await evaluateRoleScopeForChannel(auth.user.id, channelId);
    if (!roleScopeCheck.ok) return res.status(roleScopeCheck.status).json({ error: roleScopeCheck.error });
    if (!roleScopeCheck.result.allowed) {
      return res.status(403).json({ error: roleScopeCheck.result.reason ?? "Channel scope denied for caller role" });
    }

    const { data: channel, error: channelError } = await dataClient
      .from("channels")
      .select("id,type,name,team_id,context_id,is_active,created_at")
      .eq("id", channelId)
      .single();
    if (channelError) {
      return handleSupabaseError(res, "Failed to fetch channel context", channelError);
    }

    const { data: messages, error: messagesError } = await dataClient
      .from("channel_messages")
      .select("id,channel_id,sender_user_id,body,message_type,created_at")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (messagesError) {
      return handleSupabaseError(res, "Failed to fetch channel messages", messagesError);
    }

    const threadNotificationItems = buildNotificationItemsForChannelThread({
      channel,
      messages: (messages ?? []) as Array<{ id?: unknown; channel_id?: unknown; body?: unknown; message_type?: unknown; created_at?: unknown }>,
    });
    const messageReadModels = (messages ?? []).map((row) =>
      buildChannelMessageReadModel(row as { id?: unknown; channel_id?: unknown; sender_user_id?: unknown; body?: unknown; message_type?: unknown; created_at?: unknown })
    );
    const syncState = streamChannelSyncStates.get(channelId);
    const channelWithProviderState = {
      ...channel,
      provider: "stream",
      provider_channel_id: streamProviderChannelId(channelId),
      provider_sync_status: (syncState ? "synced" : "not_synced") as StreamSyncStatus,
      provider_sync_updated_at: syncState?.providerSyncUpdatedAt ?? null,
      provider_error_code: null,
      provider_trace_id: null,
    };

    return res.json({
      channel: channelWithProviderState,
      packaging_read_model: packagingReadModelForChannel(channel),
      messages: messageReadModels,
      notification_items: threadNotificationItems,
      notification_summary_read_model: buildNotificationSummaryReadModel({
        items: threadNotificationItems,
        source_scope: "channel_thread",
        read_model_status: "partial_in_family",
        notes: [
          "Thread summary is derived from visible message rows and does not include caller unread state in this endpoint response",
        ],
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/channels/:id/messages", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/channels/:id/messages", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const channelId = req.params.id;
    if (!channelId) return res.status(422).json({ error: "channel id is required" });
    const payloadCheck = validateChannelMessagePayload(req.body);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });

    const membership = await checkChannelMembership(channelId, auth.user.id);
    if (!membership.ok) return res.status(membership.status).json({ error: membership.error });
    if (!membership.member) return res.status(403).json({ error: "Not a channel member" });
    const roleScopeCheck = await evaluateRoleScopeForChannel(auth.user.id, channelId);
    if (!roleScopeCheck.ok) return res.status(roleScopeCheck.status).json({ error: roleScopeCheck.error });
    if (!roleScopeCheck.result.allowed) {
      return res.status(403).json({ error: roleScopeCheck.result.reason ?? "Channel scope denied for caller role" });
    }

    let serializedBody = payloadCheck.payload.body ?? "";
    let messageType: "message" | "media_attachment" = payloadCheck.payload.message_type ?? "message";
    if (messageType === "media_attachment") {
      const mediaId = payloadCheck.payload.media_attachment?.media_id ?? "";
      const media = await getMuxMediaRecord(mediaId);
      if (!media) {
        return res.status(404).json({ error: "media_attachment.media_id was not found" });
      }

      const mediaScope = await canAccessMuxMediaForRole(auth.user.id, "playback", {
        journeyId: media.journey_id,
        lessonId: media.lesson_id,
        ownerUserId: media.owner_user_id,
      });
      if (!mediaScope.ok) return res.status(mediaScope.status).json({ error: mediaScope.error });
      if (!mediaScope.allowed) return res.status(403).json({ error: "Caller role does not have media scope for attachment" });

      if (media.channel_id && media.channel_id !== channelId) {
        return res.status(409).json({ error: "media_attachment is already linked to another channel" });
      }

      if (!media.channel_id) {
        const reboundMedia: MuxMediaSessionRecord = {
          ...media,
          channel_id: channelId,
          updated_at: new Date().toISOString(),
        };
        await upsertMuxMediaRecord(reboundMedia);
      }

      serializedBody = serializeChannelMessageBody({
        ...payloadCheck.payload,
        message_type: "media_attachment",
        lifecycle: {
          processing_status: media.processing_status,
          playback_ready: media.playback_ready,
        },
      });
    } else {
      messageType = "message";
      serializedBody = serializeChannelMessageBody({
        body: payloadCheck.payload.body,
        message_type: "message",
      });
    }

    const { data: message, error: messageError } = await dataClient
      .from("channel_messages")
      .insert({
        channel_id: channelId,
        sender_user_id: auth.user.id,
        body: serializedBody,
        message_type: messageType === "media_attachment" ? "message" : messageType,
      })
      .select("id,channel_id,sender_user_id,body,message_type,created_at")
      .single();
    if (messageError) {
      return handleSupabaseError(res, "Failed to create message", messageError);
    }

    await fanOutUnreadCounters(channelId, auth.user.id);
    const messageReadModel = buildChannelMessageReadModel(
      message as { id?: unknown; channel_id?: unknown; sender_user_id?: unknown; body?: unknown; message_type?: unknown; created_at?: unknown }
    );
    return res.status(201).json({ message: messageReadModel });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/channels/:id/messages", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/messages/unread-count", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const { data: rows, error } = await dataClient
      .from("message_unreads")
      .select("unread_count")
      .eq("user_id", auth.user.id);
    if (error) {
      return handleSupabaseError(res, "Failed to fetch unread count", error);
    }

    const unreadCount = (rows ?? []).reduce(
      (sum, row) => sum + toNumberOrZero((row as { unread_count?: unknown }).unread_count),
      0
    );
    return res.json({
      unread_count: unreadCount,
      notification_summary_read_model: {
        badge_total: unreadCount,
        counts_by_class: {
          ...emptyNotificationClassCounts(),
          coaching_channel_message: unreadCount,
        },
        last_event_at: null,
        source_scope: "messages_unread_count",
        read_model_status: "inferred_baseline",
        notes: [
          "Unread count endpoint aggregates channel unread counters only and does not include coaching journey/package/admin queue notifications",
        ],
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/messages/unread-count", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/messages/mark-seen", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const payloadCheck = validateMarkSeenPayload(req.body);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    const channelId = payloadCheck.payload.channel_id;

    const membership = await checkChannelMembership(channelId, auth.user.id);
    if (!membership.ok) return res.status(membership.status).json({ error: membership.error });
    if (!membership.member) return res.status(403).json({ error: "Not a channel member" });
    const roleScopeCheck = await evaluateRoleScopeForChannel(auth.user.id, channelId);
    if (!roleScopeCheck.ok) return res.status(roleScopeCheck.status).json({ error: roleScopeCheck.error });
    if (!roleScopeCheck.result.allowed) {
      return res.status(403).json({ error: roleScopeCheck.result.reason ?? "Channel scope denied for caller role" });
    }

    const nowIso = new Date().toISOString();
    const { data: row, error } = await dataClient
      .from("message_unreads")
      .upsert(
        {
          channel_id: channelId,
          user_id: auth.user.id,
          unread_count: 0,
          last_seen_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "channel_id,user_id" }
      )
      .select("channel_id,user_id,unread_count,last_seen_at")
      .single();
    if (error) {
      return handleSupabaseError(res, "Failed to mark messages as seen", error);
    }

    return res.json({ seen: row });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/messages/mark-seen", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/channels/:id/broadcast", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const channelId = req.params.id;
    if (!channelId) return res.status(422).json({ error: "channel id is required" });
    const payloadCheck = validateChannelMessagePayload(req.body);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    if ((payloadCheck.payload.message_type ?? "message") !== "message") {
      return res.status(422).json({ error: "broadcast endpoint supports text message payloads only" });
    }

    const permission = await canBroadcastToChannel(channelId, auth.user.id);
    if (!permission.ok) return res.status(permission.status).json({ error: permission.error });
    if (!permission.allowed) return res.status(403).json({ error: "Broadcast not permitted" });

    const cap = 10;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: countError } = await dataClient
      .from("broadcast_log")
      .select("id", { count: "exact", head: true })
      .eq("actor_user_id", auth.user.id)
      .gte("created_at", since);
    if (countError) {
      return handleSupabaseError(res, "Failed to evaluate broadcast throttle", countError);
    }
    if ((recentCount ?? 0) >= cap) {
      return res.status(429).json({ error: "Broadcast rate limit exceeded for 24h window" });
    }

    const { data: message, error: messageError } = await dataClient
      .from("channel_messages")
      .insert({
        channel_id: channelId,
        sender_user_id: auth.user.id,
        body: payloadCheck.payload.body,
        message_type: "broadcast",
      })
      .select("id,channel_id,sender_user_id,body,message_type,created_at")
      .single();
    if (messageError) {
      return handleSupabaseError(res, "Failed to create broadcast message", messageError);
    }

    const { error: logError } = await dataClient.from("broadcast_log").insert({
      channel_id: channelId,
      actor_user_id: auth.user.id,
      message_id: message.id,
      message_body: payloadCheck.payload.body,
    });
    if (logError) {
      return handleSupabaseError(res, "Failed to write broadcast audit log", logError);
    }

    await fanOutUnreadCounters(channelId, auth.user.id);
    return res.status(201).json({ broadcast: message });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/channels/:id/broadcast", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/push-tokens", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const payloadCheck = validatePushTokenPayload(req.body);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });

    const nowIso = new Date().toISOString();
    const { data, error } = await dataClient
      .from("push_tokens")
      .upsert(
        {
          user_id: auth.user.id,
          token: payloadCheck.payload.token,
          platform: payloadCheck.payload.platform ?? "expo",
          is_active: true,
          updated_at: nowIso,
        },
        { onConflict: "user_id,token" }
      )
      .select("id,user_id,platform,token,is_active,created_at,updated_at")
      .single();
    if (error) {
      return handleSupabaseError(res, "Failed to register push token", error);
    }

    return res.status(201).json({ push_token: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/push-tokens", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/coaching/journeys", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) {
      return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    }
    const access = accessResult.context;

    const { data: journeys, error: journeysError } = await dataClient
      .from("journeys")
      .select("id,title,description,team_id,created_by,is_active,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (journeysError) {
      return errorEnvelopeResponse(res, 500, "journey_fetch_failed", "Failed to fetch coaching journeys", req.headers["x-request-id"]);
    }

    /* Fetch journey IDs the user is enrolled in (via journey_enrollments) */
    const enrolledJourneyIds = new Set<string>();
    {
      const { data: enrollRows } = await dataClient
        .from("journey_enrollments")
        .select("journey_id")
        .eq("user_id", auth.user.id)
        .eq("status", "active");
      for (const row of enrollRows ?? []) {
        const jid = String((row as { journey_id?: unknown }).journey_id ?? "");
        if (jid) enrolledJourneyIds.add(jid);
      }
    }

    const visibleJourneys = (journeys ?? []).filter((j) => {
      const jId = String((j as { id?: unknown }).id ?? "");
      const teamId = String((j as { team_id?: unknown }).team_id ?? "") || null;
      const createdBy = String((j as { created_by?: unknown }).created_by ?? "");

      // Enrolled journeys are always visible
      if (enrolledJourneyIds.has(jId)) return true;

      // Coach-specific filtering: only own journeys + team journeys they belong to
      if (access.role === "coach" && !access.platformAdmin) {
        if (createdBy === auth.user.id) return true;
        if (teamId && access.leaderTeamIds.has(teamId)) return true;
        if (teamId && access.memberTeamIds.has(teamId)) return true;
        return false;
      }

      return canReadJourneyByTeam(access, teamId);
    });

    const journeyIds = visibleJourneys.map((j) => String(j.id));
    if (journeyIds.length === 0) {
      return res.json({
        journeys: [],
        notification_items: [],
        notification_summary_read_model: buildNotificationSummaryReadModel({
          items: [],
          source_scope: "coaching_journeys",
          read_model_status: "partial_in_family",
          notes: ["No visible journeys for caller; journey-derived coaching notifications are empty in this endpoint family"],
        }),
      });
    }

    const { data: milestones, error: milestonesError } = await dataClient
      .from("milestones")
      .select("id,journey_id")
      .in("journey_id", journeyIds);
    if (milestonesError) {
      return handleSupabaseError(res, "Failed to fetch coaching milestones", milestonesError);
    }

    const milestoneIds = (milestones ?? []).map((m) => String(m.id));
    let lessonRows: Array<{ id: string; milestone_id: string }> = [];
    if (milestoneIds.length > 0) {
      const { data: lessons, error: lessonsError } = await dataClient
        .from("lessons")
        .select("id,milestone_id")
        .eq("is_active", true)
        .in("milestone_id", milestoneIds);
      if (lessonsError) {
        return handleSupabaseError(res, "Failed to fetch coaching lessons", lessonsError);
      }
      lessonRows = (lessons ?? []) as Array<{ id: string; milestone_id: string }>;
    }

    const lessonIds = lessonRows.map((l) => String(l.id));
    let progressRows: Array<{ lesson_id: string; status: string }> = [];
    if (lessonIds.length > 0) {
      const { data: progress, error: progressError } = await dataClient
        .from("lesson_progress")
        .select("lesson_id,status")
        .eq("user_id", auth.user.id)
        .in("lesson_id", lessonIds);
      if (progressError) {
        return handleSupabaseError(res, "Failed to fetch lesson progress", progressError);
      }
      progressRows = (progress ?? []) as Array<{ lesson_id: string; status: string }>;
    }

    const milestoneCountByJourney = new Map<string, number>();
    for (const m of milestones ?? []) {
      const journeyId = String(m.journey_id);
      milestoneCountByJourney.set(journeyId, (milestoneCountByJourney.get(journeyId) ?? 0) + 1);
    }

    const lessonCountByJourney = new Map<string, number>();
    const journeyByMilestone = new Map<string, string>(
      (milestones ?? []).map((m) => [String(m.id), String(m.journey_id)])
    );
    for (const l of lessonRows) {
      const journeyId = journeyByMilestone.get(String(l.milestone_id));
      if (!journeyId) continue;
      lessonCountByJourney.set(journeyId, (lessonCountByJourney.get(journeyId) ?? 0) + 1);
    }

    const progressByLesson = new Map<string, string>(
      progressRows.map((p) => [String(p.lesson_id), String(p.status)])
    );
    const completedLessonsByJourney = new Map<string, number>();
    for (const l of lessonRows) {
      const journeyId = journeyByMilestone.get(String(l.milestone_id));
      if (!journeyId) continue;
      if (progressByLesson.get(String(l.id)) === "completed") {
        completedLessonsByJourney.set(journeyId, (completedLessonsByJourney.get(journeyId) ?? 0) + 1);
      }
    }

    const journeyRows = visibleJourneys.map((j) => {
        const journeyId = String(j.id);
        const lessonsTotal = lessonCountByJourney.get(journeyId) ?? 0;
        const lessonsCompleted = completedLessonsByJourney.get(journeyId) ?? 0;
        return {
          ...j,
          milestones_count: milestoneCountByJourney.get(journeyId) ?? 0,
          lessons_total: lessonsTotal,
          lessons_completed: lessonsCompleted,
          completion_percent:
            lessonsTotal > 0 ? Number(((lessonsCompleted / lessonsTotal) * 100).toFixed(2)) : 0,
          packaging_read_model: packagingReadModelForJourney(j),
        };
      });
    const journeyNotificationItems = buildNotificationItemsForCoachingJourneys(
      journeyRows as Array<{
        id?: unknown;
        title?: unknown;
        team_id?: unknown;
        completion_percent?: unknown;
        lessons_total?: unknown;
        lessons_completed?: unknown;
        created_at?: unknown;
      }>
    );
    return res.json({
      journeys: journeyRows,
      notification_items: journeyNotificationItems,
      notification_summary_read_model: buildNotificationSummaryReadModel({
        items: journeyNotificationItems,
        source_scope: "coaching_journeys",
        read_model_status: "inferred_baseline",
        notes: [
          "Journey notification rows are inferred from visibility + progress aggregates and should be treated as coaching prompts/next-action hints, not canonical notification queue events",
        ],
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/coaching/journeys", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.get("/api/coaching/journeys/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) {
      return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    }
    const access = accessResult.context;

    const journeyId = req.params.id;
    if (!journeyId) return errorEnvelopeResponse(res, 422, "invalid_request", "journey id is required", req.headers["x-request-id"]);

    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("id,title,description,team_id,is_active,created_at")
      .eq("id", journeyId)
      .single();
    if (journeyError) {
      return errorEnvelopeResponse(res, 404, "not_found", "Journey not found", req.headers["x-request-id"]);
    }
    const scopedTeamId = String((journey as { team_id?: unknown } | null)?.team_id ?? "");
    if (!canReadJourneyByTeam(access, scopedTeamId || null)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "You are not allowed to view this journey", req.headers["x-request-id"]);
    }

    const { data: milestones, error: milestonesError } = await dataClient
      .from("milestones")
      .select("id,journey_id,title,sort_order")
      .eq("journey_id", journeyId)
      .order("sort_order", { ascending: true });
    if (milestonesError) return errorEnvelopeResponse(res, 500, "journey_fetch_failed", "Failed to fetch milestones", req.headers["x-request-id"]);

    const milestoneIds = (milestones ?? []).map((m) => String(m.id));
    let lessons: Array<{ id: string; milestone_id: string; title: string; body: string | null; sort_order: number }> = [];
    if (milestoneIds.length > 0) {
      const { data: lessonRows, error: lessonError } = await dataClient
        .from("lessons")
        .select("id,milestone_id,title,body,sort_order")
        .eq("is_active", true)
        .in("milestone_id", milestoneIds)
        .order("sort_order", { ascending: true });
      if (lessonError) return errorEnvelopeResponse(res, 500, "journey_fetch_failed", "Failed to fetch lessons", req.headers["x-request-id"]);
      lessons = (lessonRows ?? []) as Array<{ id: string; milestone_id: string; title: string; body: string | null; sort_order: number }>;
    }

    const lessonIds = lessons.map((l) => String(l.id));
    let progressRows: Array<{ lesson_id: string; status: string; completed_at: string | null }> = [];
    if (lessonIds.length > 0) {
      const { data: progress, error: progressError } = await dataClient
        .from("lesson_progress")
        .select("lesson_id,status,completed_at")
        .eq("user_id", auth.user.id)
        .in("lesson_id", lessonIds);
      if (progressError) return errorEnvelopeResponse(res, 500, "journey_fetch_failed", "Failed to fetch lesson progress", req.headers["x-request-id"]);
      progressRows = (progress ?? []) as Array<{ lesson_id: string; status: string; completed_at: string | null }>;
    }
    const progressByLesson = new Map(progressRows.map((p) => [String(p.lesson_id), p]));

    const lessonsByMilestone = new Map<string, Array<{
      id: string;
      title: string;
      body: string | null;
      sort_order: number;
      progress_status: string;
      completed_at: string | null;
    }>>();
    for (const lesson of lessons) {
      const progress = progressByLesson.get(String(lesson.id));
      const arr = lessonsByMilestone.get(String(lesson.milestone_id)) ?? [];
      arr.push({
        id: lesson.id,
        title: lesson.title,
        body: lesson.body,
        sort_order: lesson.sort_order,
        progress_status: progress?.status ?? "not_started",
        completed_at: progress?.completed_at ?? null,
      });
      lessonsByMilestone.set(String(lesson.milestone_id), arr);
    }

    return res.json({
      journey: {
        ...journey,
        packaging_read_model: packagingReadModelForJourney(journey as { id?: unknown; team_id?: unknown; is_active?: unknown }),
      },
      milestones: (milestones ?? []).map((m) => ({
        ...m,
        lessons: lessonsByMilestone.get(String(m.id)) ?? [],
      })),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/coaching/journeys/:id", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/coaching/journeys", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const payloadCheck = validateCoachingJourneyCreatePayload(req.body);
    if (!payloadCheck.ok) {
      return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);
    }
    const payload = payloadCheck.payload;
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) {
      return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    }
    const access = accessResult.context;
    if (!canWriteJourneyByTeam(access, payload.team_id ?? null)) {
      return errorEnvelopeResponse(
        res,
        403,
        "scope_denied",
        "Caller role cannot create journey in this scope",
        req.headers["x-request-id"]
      );
    }

    await ensureUserRow(auth.user.id);
    const nowIso = new Date().toISOString();
    const { data: row, error } = await dataClient
      .from("journeys")
      .insert({
        title: payload.title,
        description: payload.description ?? null,
        team_id: payload.team_id ?? null,
        created_by: auth.user.id,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id,title,description,team_id,is_active,created_by,created_at,updated_at")
      .single();
    if (error) {
      return errorEnvelopeResponse(res, 500, "journey_create_failed", "Failed to create journey", req.headers["x-request-id"]);
    }
    return res.status(201).json({ journey: row });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/journeys", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.patch("/api/coaching/journeys/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const journeyId = req.params.id;
    if (!journeyId) return errorEnvelopeResponse(res, 422, "invalid_request", "journey id is required", req.headers["x-request-id"]);
    const payloadCheck = validateCoachingJourneyUpdatePayload(req.body);
    if (!payloadCheck.ok) {
      return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);
    }
    const payload = payloadCheck.payload;

    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("id,team_id,is_active")
      .eq("id", journeyId)
      .maybeSingle();
    if (journeyError || !journey) {
      return errorEnvelopeResponse(res, 404, "not_found", "Journey not found", req.headers["x-request-id"]);
    }

    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) {
      return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    }
    const access = accessResult.context;
    const currentTeamId = String((journey as { team_id?: unknown }).team_id ?? "") || null;
    if (!canWriteJourneyByTeam(access, currentTeamId)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot update this journey", req.headers["x-request-id"]);
    }
    const nextTeamId = payload.team_id === undefined ? currentTeamId : payload.team_id;
    if (!canWriteJourneyByTeam(access, nextTeamId ?? null)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot move journey to requested scope", req.headers["x-request-id"]);
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.title !== undefined) patch.title = payload.title;
    if (payload.description !== undefined) patch.description = payload.description || null;
    if (payload.team_id !== undefined) patch.team_id = payload.team_id;
    if (payload.is_active !== undefined) patch.is_active = payload.is_active;

    const { data: updated, error: updateError } = await dataClient
      .from("journeys")
      .update(patch)
      .eq("id", journeyId)
      .select("id,title,description,team_id,is_active,created_by,created_at,updated_at")
      .single();
    if (updateError) {
      return errorEnvelopeResponse(res, 500, "journey_update_failed", "Failed to update journey", req.headers["x-request-id"]);
    }
    return res.json({ journey: updated });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PATCH /api/coaching/journeys/:id", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.delete("/api/coaching/journeys/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const journeyId = req.params.id;
    if (!journeyId) return errorEnvelopeResponse(res, 422, "invalid_request", "journey id is required", req.headers["x-request-id"]);

    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("id,team_id,is_active")
      .eq("id", journeyId)
      .maybeSingle();
    if (journeyError || !journey) {
      return errorEnvelopeResponse(res, 404, "not_found", "Journey not found", req.headers["x-request-id"]);
    }
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) {
      return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    }
    const teamId = String((journey as { team_id?: unknown }).team_id ?? "") || null;
    if (!canWriteJourneyByTeam(accessResult.context, teamId)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot delete this journey", req.headers["x-request-id"]);
    }
    const { error: deleteError } = await dataClient
      .from("journeys")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", journeyId);
    if (deleteError) {
      return errorEnvelopeResponse(res, 500, "journey_delete_failed", "Failed to delete journey", req.headers["x-request-id"]);
    }
    return res.json({ deleted: true, journey_id: journeyId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /api/coaching/journeys/:id", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/coaching/journeys/:id/lessons", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const journeyId = req.params.id;
    if (!journeyId) return errorEnvelopeResponse(res, 422, "invalid_request", "journey id is required", req.headers["x-request-id"]);
    const payloadCheck = validateCoachingLessonCreatePayload(req.body);
    if (!payloadCheck.ok) {
      return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);
    }

    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("id,team_id")
      .eq("id", journeyId)
      .maybeSingle();
    if (journeyError || !journey) return errorEnvelopeResponse(res, 404, "not_found", "Journey not found", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    const teamId = String((journey as { team_id?: unknown }).team_id ?? "") || null;
    if (!canWriteJourneyByTeam(accessResult.context, teamId)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot modify lessons in this journey", req.headers["x-request-id"]);
    }

    const payload = payloadCheck.payload;
    let sortOrder = payload.sort_order;
    if (sortOrder === undefined) {
      const { data: sortRows, error: sortError } = await dataClient
        .from("milestones")
        .select("sort_order")
        .eq("journey_id", journeyId)
        .order("sort_order", { ascending: false })
        .limit(1);
      if (sortError) return errorEnvelopeResponse(res, 500, "lesson_create_failed", "Failed to compute lesson sort order", req.headers["x-request-id"]);
      sortOrder = toNumberOrZero((sortRows?.[0] as { sort_order?: unknown } | undefined)?.sort_order) + 1;
    }
    const nowIso = new Date().toISOString();
    const { data: row, error } = await dataClient
      .from("milestones")
      .insert({
        journey_id: journeyId,
        title: payload.title,
        sort_order: sortOrder,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id,journey_id,title,sort_order,created_at,updated_at")
      .single();
    if (error) return errorEnvelopeResponse(res, 500, "lesson_create_failed", "Failed to create lesson", req.headers["x-request-id"]);
    return res.status(201).json({ lesson: row });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/journeys/:id/lessons", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.patch("/api/coaching/journeys/:id/lessons/:lessonId", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const journeyId = req.params.id;
    const lessonId = req.params.lessonId;
    if (!journeyId || !lessonId) return errorEnvelopeResponse(res, 422, "invalid_request", "journey id and lesson id are required", req.headers["x-request-id"]);
    const payloadCheck = validateCoachingLessonUpdatePayload(req.body);
    if (!payloadCheck.ok) return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);

    const { data: milestone, error: milestoneError } = await dataClient
      .from("milestones")
      .select("id,journey_id,title,sort_order,created_at,updated_at")
      .eq("id", lessonId)
      .eq("journey_id", journeyId)
      .maybeSingle();
    if (milestoneError || !milestone) return errorEnvelopeResponse(res, 404, "not_found", "Lesson not found", req.headers["x-request-id"]);
    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("team_id")
      .eq("id", journeyId)
      .maybeSingle();
    if (journeyError || !journey) return errorEnvelopeResponse(res, 404, "not_found", "Journey not found", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    const teamId = String((journey as { team_id?: unknown }).team_id ?? "") || null;
    if (!canWriteJourneyByTeam(accessResult.context, teamId)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot modify lessons in this journey", req.headers["x-request-id"]);
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payloadCheck.payload.title !== undefined) patch.title = payloadCheck.payload.title;
    if (payloadCheck.payload.sort_order !== undefined) patch.sort_order = payloadCheck.payload.sort_order;
    const { data: updated, error: updateError } = await dataClient
      .from("milestones")
      .update(patch)
      .eq("id", lessonId)
      .select("id,journey_id,title,sort_order,created_at,updated_at")
      .single();
    if (updateError) return errorEnvelopeResponse(res, 500, "lesson_update_failed", "Failed to update lesson", req.headers["x-request-id"]);
    return res.json({ lesson: updated });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PATCH /api/coaching/journeys/:id/lessons/:lessonId", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.delete("/api/coaching/journeys/:id/lessons/:lessonId", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const journeyId = req.params.id;
    const lessonId = req.params.lessonId;
    if (!journeyId || !lessonId) return errorEnvelopeResponse(res, 422, "invalid_request", "journey id and lesson id are required", req.headers["x-request-id"]);

    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("team_id")
      .eq("id", journeyId)
      .maybeSingle();
    if (journeyError || !journey) return errorEnvelopeResponse(res, 404, "not_found", "Journey not found", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    const teamId = String((journey as { team_id?: unknown }).team_id ?? "") || null;
    if (!canWriteJourneyByTeam(accessResult.context, teamId)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot modify lessons in this journey", req.headers["x-request-id"]);
    }
    const { error } = await dataClient
      .from("milestones")
      .delete()
      .eq("id", lessonId)
      .eq("journey_id", journeyId);
    if (error) return errorEnvelopeResponse(res, 500, "lesson_delete_failed", "Failed to delete lesson", req.headers["x-request-id"]);
    return res.json({ deleted: true, lesson_id: lessonId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /api/coaching/journeys/:id/lessons/:lessonId", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/coaching/journeys/:id/lessons/reorder", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const journeyId = req.params.id;
    if (!journeyId) return errorEnvelopeResponse(res, 422, "invalid_request", "journey id is required", req.headers["x-request-id"]);
    const payloadCheck = validateCoachingLessonReorderPayload(req.body);
    if (!payloadCheck.ok) return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);

    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("team_id")
      .eq("id", journeyId)
      .maybeSingle();
    if (journeyError || !journey) return errorEnvelopeResponse(res, 404, "not_found", "Journey not found", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    const teamId = String((journey as { team_id?: unknown }).team_id ?? "") || null;
    if (!canWriteJourneyByTeam(accessResult.context, teamId)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot reorder lessons in this journey", req.headers["x-request-id"]);
    }

    const lessonIds = payloadCheck.payload.lesson_ids;
    const { data: milestones, error: milestonesError } = await dataClient
      .from("milestones")
      .select("id")
      .eq("journey_id", journeyId);
    if (milestonesError) return errorEnvelopeResponse(res, 500, "lesson_reorder_failed", "Failed to load lessons", req.headers["x-request-id"]);
    const existingIds = new Set((milestones ?? []).map((row) => String((row as { id?: unknown }).id ?? "")));
    if (existingIds.size !== lessonIds.length || lessonIds.some((id) => !existingIds.has(id))) {
      return errorEnvelopeResponse(
        res,
        409,
        "reconcile_conflict",
        "lesson_ids must include every lesson id for the journey exactly once",
        req.headers["x-request-id"]
      );
    }
    for (let i = 0; i < lessonIds.length; i += 1) {
      const lessonId = lessonIds[i];
      const { error } = await dataClient
        .from("milestones")
        .update({ sort_order: i, updated_at: new Date().toISOString() })
        .eq("id", lessonId)
        .eq("journey_id", journeyId);
      if (error) return errorEnvelopeResponse(res, 500, "lesson_reorder_failed", "Failed to reorder lessons", req.headers["x-request-id"]);
    }
    return res.json({ reordered: true, lesson_ids: lessonIds });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/journeys/:id/lessons/reorder", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/coaching/journeys/:id/lessons/:lessonId/tasks", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const journeyId = req.params.id;
    const lessonId = req.params.lessonId;
    if (!journeyId || !lessonId) return errorEnvelopeResponse(res, 422, "invalid_request", "journey id and lesson id are required", req.headers["x-request-id"]);
    const payloadCheck = validateCoachingTaskCreatePayload(req.body);
    if (!payloadCheck.ok) return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);
    const { data: milestone, error: milestoneError } = await dataClient
      .from("milestones")
      .select("id,journey_id")
      .eq("id", lessonId)
      .eq("journey_id", journeyId)
      .maybeSingle();
    if (milestoneError || !milestone) return errorEnvelopeResponse(res, 404, "not_found", "Lesson not found", req.headers["x-request-id"]);
    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("team_id")
      .eq("id", journeyId)
      .maybeSingle();
    if (journeyError || !journey) return errorEnvelopeResponse(res, 404, "not_found", "Journey not found", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    const teamId = String((journey as { team_id?: unknown }).team_id ?? "") || null;
    if (!canWriteJourneyByTeam(accessResult.context, teamId)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot modify tasks in this lesson", req.headers["x-request-id"]);
    }
    const payload = payloadCheck.payload;
    let sortOrder = payload.sort_order;
    if (sortOrder === undefined) {
      const { data: sortRows, error: sortError } = await dataClient
        .from("lessons")
        .select("sort_order")
        .eq("milestone_id", lessonId)
        .eq("is_active", true)
        .order("sort_order", { ascending: false })
        .limit(1);
      if (sortError) return errorEnvelopeResponse(res, 500, "task_create_failed", "Failed to compute task sort order", req.headers["x-request-id"]);
      sortOrder = toNumberOrZero((sortRows?.[0] as { sort_order?: unknown } | undefined)?.sort_order) + 1;
    }
    const nowIso = new Date().toISOString();
    const { data: row, error } = await dataClient
      .from("lessons")
      .insert({
        milestone_id: lessonId,
        title: payload.title,
        body: payload.body ?? null,
        sort_order: sortOrder,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id,milestone_id,title,body,sort_order,is_active,created_at,updated_at")
      .single();
    if (error) return errorEnvelopeResponse(res, 500, "task_create_failed", "Failed to create task", req.headers["x-request-id"]);
    return res.status(201).json({ task: row });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/journeys/:id/lessons/:lessonId/tasks", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.patch("/api/coaching/journeys/:id/lessons/:lessonId/tasks/:taskId", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const { id: journeyId, lessonId, taskId } = req.params;
    if (!journeyId || !lessonId || !taskId) {
      return errorEnvelopeResponse(res, 422, "invalid_request", "journey id, lesson id, and task id are required", req.headers["x-request-id"]);
    }
    const payloadCheck = validateCoachingTaskUpdatePayload(req.body);
    if (!payloadCheck.ok) return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);

    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("team_id")
      .eq("id", journeyId)
      .maybeSingle();
    if (journeyError || !journey) return errorEnvelopeResponse(res, 404, "not_found", "Journey not found", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    const teamId = String((journey as { team_id?: unknown }).team_id ?? "") || null;
    if (!canWriteJourneyByTeam(accessResult.context, teamId)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot modify tasks in this lesson", req.headers["x-request-id"]);
    }

    const { data: taskRow, error: taskLookupError } = await dataClient
      .from("lessons")
      .select("id,milestone_id")
      .eq("id", taskId)
      .eq("milestone_id", lessonId)
      .maybeSingle();
    if (taskLookupError || !taskRow) return errorEnvelopeResponse(res, 404, "not_found", "Task not found", req.headers["x-request-id"]);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payloadCheck.payload.title !== undefined) patch.title = payloadCheck.payload.title;
    if (payloadCheck.payload.body !== undefined) patch.body = payloadCheck.payload.body;
    if (payloadCheck.payload.sort_order !== undefined) patch.sort_order = payloadCheck.payload.sort_order;
    const { data: updated, error: updateError } = await dataClient
      .from("lessons")
      .update(patch)
      .eq("id", taskId)
      .eq("milestone_id", lessonId)
      .select("id,milestone_id,title,body,sort_order,is_active,created_at,updated_at")
      .single();
    if (updateError) return errorEnvelopeResponse(res, 500, "task_update_failed", "Failed to update task", req.headers["x-request-id"]);
    return res.json({ task: updated });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PATCH /api/coaching/journeys/:id/lessons/:lessonId/tasks/:taskId", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.delete("/api/coaching/journeys/:id/lessons/:lessonId/tasks/:taskId", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const { id: journeyId, lessonId, taskId } = req.params;
    if (!journeyId || !lessonId || !taskId) {
      return errorEnvelopeResponse(res, 422, "invalid_request", "journey id, lesson id, and task id are required", req.headers["x-request-id"]);
    }
    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("team_id")
      .eq("id", journeyId)
      .maybeSingle();
    if (journeyError || !journey) return errorEnvelopeResponse(res, 404, "not_found", "Journey not found", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    const teamId = String((journey as { team_id?: unknown }).team_id ?? "") || null;
    if (!canWriteJourneyByTeam(accessResult.context, teamId)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot modify tasks in this lesson", req.headers["x-request-id"]);
    }

    const { error } = await dataClient
      .from("lessons")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("milestone_id", lessonId);
    if (error) return errorEnvelopeResponse(res, 500, "task_delete_failed", "Failed to delete task", req.headers["x-request-id"]);
    return res.json({ deleted: true, task_id: taskId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /api/coaching/journeys/:id/lessons/:lessonId/tasks/:taskId", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/coaching/journeys/:id/lessons/:lessonId/tasks/reorder", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const { id: journeyId, lessonId } = req.params;
    if (!journeyId || !lessonId) {
      return errorEnvelopeResponse(res, 422, "invalid_request", "journey id and lesson id are required", req.headers["x-request-id"]);
    }
    const payloadCheck = validateCoachingTaskReorderPayload(req.body);
    if (!payloadCheck.ok) return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);
    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("team_id")
      .eq("id", journeyId)
      .maybeSingle();
    if (journeyError || !journey) return errorEnvelopeResponse(res, 404, "not_found", "Journey not found", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    const teamId = String((journey as { team_id?: unknown }).team_id ?? "") || null;
    if (!canWriteJourneyByTeam(accessResult.context, teamId)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot reorder tasks in this lesson", req.headers["x-request-id"]);
    }

    const taskIds = payloadCheck.payload.task_ids;
    const { data: taskRows, error: taskFetchError } = await dataClient
      .from("lessons")
      .select("id")
      .eq("milestone_id", lessonId)
      .eq("is_active", true);
    if (taskFetchError) return errorEnvelopeResponse(res, 500, "task_reorder_failed", "Failed to load tasks", req.headers["x-request-id"]);
    const existingIds = new Set((taskRows ?? []).map((row) => String((row as { id?: unknown }).id ?? "")));
    if (existingIds.size !== taskIds.length || taskIds.some((id) => !existingIds.has(id))) {
      return errorEnvelopeResponse(
        res,
        409,
        "reconcile_conflict",
        "task_ids must include every task id for the lesson exactly once",
        req.headers["x-request-id"]
      );
    }
    for (let i = 0; i < taskIds.length; i += 1) {
      const taskId = taskIds[i];
      const { error } = await dataClient
        .from("lessons")
        .update({ sort_order: i, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("milestone_id", lessonId);
      if (error) return errorEnvelopeResponse(res, 500, "task_reorder_failed", "Failed to reorder tasks", req.headers["x-request-id"]);
    }
    return res.json({ reordered: true, task_ids: taskIds });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/journeys/:id/lessons/:lessonId/tasks/reorder", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.get("/api/coaching/cohorts", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    const access = accessResult.context;
    let query = dataClient
      .from("teams")
      .select("id,name,created_by,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (!access.canAuthorGlobal) {
      const scopedTeamIds = Array.from(new Set([...access.leaderTeamIds, ...access.memberTeamIds]));
      if (scopedTeamIds.length === 0) return res.json({ cohorts: [] });
      query = query.in("id", scopedTeamIds);
    }
    const { data: teams, error: teamsError } = await query;
    if (teamsError) return errorEnvelopeResponse(res, 500, "cohort_fetch_failed", "Failed to fetch cohorts", req.headers["x-request-id"]);
    const teamIds = (teams ?? []).map((row) => String((row as { id?: unknown }).id ?? ""));
    let memberships: Array<{ team_id: string; user_id: string; role: string }> = [];
    if (teamIds.length > 0) {
      const { data: rows, error } = await dataClient
        .from("team_memberships")
        .select("team_id,user_id,role")
        .in("team_id", teamIds);
      if (error) return errorEnvelopeResponse(res, 500, "cohort_fetch_failed", "Failed to fetch cohort memberships", req.headers["x-request-id"]);
      memberships = (rows ?? []).map((row) => ({
        team_id: String((row as { team_id?: unknown }).team_id ?? ""),
        user_id: String((row as { user_id?: unknown }).user_id ?? ""),
        role: String((row as { role?: unknown }).role ?? "member"),
      }));
    }
    const membersByTeam = new Map<string, Array<{ user_id: string; role: string }>>();
    for (const row of memberships) {
      const list = membersByTeam.get(row.team_id) ?? [];
      list.push({ user_id: row.user_id, role: row.role });
      membersByTeam.set(row.team_id, list);
    }
    const cohorts = (teams ?? []).map((team) => {
      const teamId = String((team as { id?: unknown }).id ?? "");
      const members = membersByTeam.get(teamId) ?? [];
      const myMembership = members.find((row) => row.user_id === auth.user.id);
      return {
        ...team,
        members_count: members.length,
        leaders_count: members.filter((row) => row.role === "team_leader").length,
        member_user_ids: members.map((row) => row.user_id),
        my_membership_role: myMembership?.role ?? null,
      };
    });
    return res.json({ cohorts });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/coaching/cohorts", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.put("/api/coaching/cohorts/:id/members", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const cohortId = req.params.id;
    if (!cohortId) return errorEnvelopeResponse(res, 422, "invalid_request", "cohort id is required", req.headers["x-request-id"]);
    const payloadCheck = validateCoachingCohortMembershipUpdatePayload(req.body);
    if (!payloadCheck.ok) return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    if (!canWriteJourneyByTeam(accessResult.context, cohortId)) {
      return errorEnvelopeResponse(res, 403, "scope_denied", "Caller role cannot update this cohort", req.headers["x-request-id"]);
    }
    const { data: team, error: teamError } = await dataClient
      .from("teams")
      .select("id")
      .eq("id", cohortId)
      .maybeSingle();
    if (teamError || !team) return errorEnvelopeResponse(res, 404, "not_found", "Cohort not found", req.headers["x-request-id"]);

    const targetSet = new Set(payloadCheck.payload.member_user_ids);
    const { data: existingRows, error: existingError } = await dataClient
      .from("team_memberships")
      .select("user_id,role")
      .eq("team_id", cohortId);
    if (existingError) return errorEnvelopeResponse(res, 500, "cohort_update_failed", "Failed to load existing memberships", req.headers["x-request-id"]);
    const existing = (existingRows ?? []).map((row) => ({
      user_id: String((row as { user_id?: unknown }).user_id ?? ""),
      role: String((row as { role?: unknown }).role ?? "member"),
    }));
    const leaderIds = new Set(existing.filter((row) => row.role === "team_leader").map((row) => row.user_id));
    for (const leaderId of leaderIds) targetSet.add(leaderId);
    const removeIds = existing
      .filter((row) => row.role !== "team_leader" && !targetSet.has(row.user_id))
      .map((row) => row.user_id);
    if (removeIds.length > 0) {
      const { error } = await dataClient
        .from("team_memberships")
        .delete()
        .eq("team_id", cohortId)
        .in("user_id", removeIds);
      if (error) return errorEnvelopeResponse(res, 500, "cohort_update_failed", "Failed to remove cohort members", req.headers["x-request-id"]);
    }
    const upsertRows = Array.from(targetSet)
      .filter((userId) => !!userId)
      .map((userId) => ({
        team_id: cohortId,
        user_id: userId,
        role: leaderIds.has(userId) ? "team_leader" : "member",
      }));
    if (upsertRows.length > 0) {
      const { error } = await dataClient
        .from("team_memberships")
        .upsert(upsertRows, { onConflict: "team_id,user_id" });
      if (error) return errorEnvelopeResponse(res, 500, "cohort_update_failed", "Failed to upsert cohort members", req.headers["x-request-id"]);
    }
    return res.json({
      cohort_id: cohortId,
      member_user_ids: Array.from(targetSet),
      leaders_preserved: Array.from(leaderIds),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PUT /api/coaching/cohorts/:id/members", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.get("/api/coaching/channels", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, 401, "unauthenticated", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    const accessResult = await getCoachingAccessContext(auth.user.id);
    if (!accessResult.ok) return errorEnvelopeResponse(res, accessResult.status, "scope_denied", accessResult.error, req.headers["x-request-id"]);
    const access = accessResult.context;

    const { data: membershipRows, error: membershipError } = await dataClient
      .from("channel_memberships")
      .select("channel_id,user_id,role")
      .eq("user_id", auth.user.id);
    if (membershipError) {
      return errorEnvelopeResponse(res, 500, "channel_fetch_failed", "Failed to resolve channel scope", req.headers["x-request-id"]);
    }
    const directMemberChannelIds = new Set((membershipRows ?? []).map((row) => String((row as { channel_id?: unknown }).channel_id ?? "")));
    let channelsQuery = dataClient
      .from("channels")
      .select("id,type,name,team_id,context_id,is_active,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (!access.canAuthorGlobal) {
      const scopedTeamIds = Array.from(new Set([...access.leaderTeamIds, ...access.memberTeamIds]));
      if (scopedTeamIds.length > 0) {
        channelsQuery = channelsQuery.or(
          `team_id.in.(${scopedTeamIds.join(",")}),id.in.(${Array.from(directMemberChannelIds).join(",") || "00000000-0000-0000-0000-000000000000"})`
        );
      } else if (directMemberChannelIds.size > 0) {
        channelsQuery = channelsQuery.in("id", Array.from(directMemberChannelIds));
      } else {
        return res.json({ channels: [] });
      }
    }
    const { data: channels, error: channelsError } = await channelsQuery;
    if (channelsError) return errorEnvelopeResponse(res, 500, "channel_fetch_failed", "Failed to fetch channels", req.headers["x-request-id"]);
    const channelIds = (channels ?? []).map((row) => String((row as { id?: unknown }).id ?? ""));
    let memberCounts = new Map<string, number>();
    if (channelIds.length > 0) {
      const { data: members, error: membersError } = await dataClient
        .from("channel_memberships")
        .select("channel_id")
        .in("channel_id", channelIds);
      if (membersError) return errorEnvelopeResponse(res, 500, "channel_fetch_failed", "Failed to fetch channel membership counts", req.headers["x-request-id"]);
      for (const row of members ?? []) {
        const channelId = String((row as { channel_id?: unknown }).channel_id ?? "");
        memberCounts.set(channelId, (memberCounts.get(channelId) ?? 0) + 1);
      }
    }
    let lastMessageAt = new Map<string, string | null>();
    if (channelIds.length > 0) {
      const { data: messages, error: messagesError } = await dataClient
        .from("channel_messages")
        .select("channel_id,created_at")
        .in("channel_id", channelIds)
        .order("created_at", { ascending: false });
      if (messagesError) return errorEnvelopeResponse(res, 500, "channel_fetch_failed", "Failed to fetch channel message metadata", req.headers["x-request-id"]);
      for (const row of messages ?? []) {
        const channelId = String((row as { channel_id?: unknown }).channel_id ?? "");
        if (!lastMessageAt.has(channelId)) {
          lastMessageAt.set(channelId, String((row as { created_at?: unknown }).created_at ?? null));
        }
      }
    }
    const scopedChannels = (channels ?? [])
      .filter((channel) => {
        if (access.canAuthorGlobal) return true;
        const channelId = String((channel as { id?: unknown }).id ?? "");
        const teamId = String((channel as { team_id?: unknown }).team_id ?? "");
        if (directMemberChannelIds.has(channelId)) return true;
        if (teamId && (access.leaderTeamIds.has(teamId) || access.memberTeamIds.has(teamId))) return true;
        return false;
      })
      .map((channel) => {
        const channelId = String((channel as { id?: unknown }).id ?? "");
        return {
          ...channel,
          member_count: memberCounts.get(channelId) ?? 0,
          last_message_at: lastMessageAt.get(channelId) ?? null,
          can_author: access.canAuthorGlobal || access.leaderTeamIds.has(String((channel as { team_id?: unknown }).team_id ?? "")),
        };
      });
    return res.json({ channels: scopedChannels });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/coaching/channels", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/coaching/lessons/:id/progress", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const lessonId = req.params.id;
    if (!lessonId) return res.status(422).json({ error: "lesson id is required" });
    const payloadCheck = validateCoachingLessonProgressPayload(req.body);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });

    const { data: lesson, error: lessonError } = await dataClient
      .from("lessons")
      .select("id,milestone_id")
      .eq("id", lessonId)
      .single();
    if (lessonError) {
      return handleSupabaseError(res, "Failed to fetch lesson", lessonError);
    }
    const { data: milestone, error: milestoneError } = await dataClient
      .from("milestones")
      .select("journey_id")
      .eq("id", String((lesson as { milestone_id?: unknown }).milestone_id))
      .single();
    if (milestoneError) {
      return handleSupabaseError(res, "Failed to fetch milestone", milestoneError);
    }
    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("team_id")
      .eq("id", String((milestone as { journey_id?: unknown }).journey_id))
      .single();
    if (journeyError) {
      return handleSupabaseError(res, "Failed to fetch journey", journeyError);
    }
    const platformAdmin = await isPlatformAdmin(auth.user.id);
    const scopedTeamId = String((journey as { team_id?: unknown } | null)?.team_id ?? "");
    if (scopedTeamId && !platformAdmin) {
      const membership = await checkTeamMembership(scopedTeamId, auth.user.id);
      if (!membership.ok) return res.status(membership.status).json({ error: membership.error });
      if (!membership.member) {
        return res.status(403).json({ error: "You are not allowed to update progress for this lesson" });
      }
    }

    await ensureUserRow(auth.user.id);

    const completedAt =
      payloadCheck.payload.status === "completed" ? new Date().toISOString() : null;
    const nowIso = new Date().toISOString();

    const { data: row, error } = await dataClient
      .from("lesson_progress")
      .upsert(
        {
          lesson_id: lessonId,
          user_id: auth.user.id,
          status: payloadCheck.payload.status,
          completed_at: completedAt,
          updated_at: nowIso,
        },
        { onConflict: "lesson_id,user_id" }
      )
      .select("lesson_id,user_id,status,completed_at,updated_at")
      .single();
    if (error) {
      return handleSupabaseError(res, "Failed to update lesson progress", error);
    }

    return res.json({ progress: row });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/lessons/:id/progress", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/coaching/progress", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const { data: rows, error } = await dataClient
      .from("lesson_progress")
      .select("status")
      .eq("user_id", auth.user.id);
    if (error) {
      return handleSupabaseError(res, "Failed to fetch coaching progress summary", error);
    }

    const total = (rows ?? []).length;
    const byStatus = { not_started: 0, in_progress: 0, completed: 0 };
    for (const row of rows ?? []) {
      const status = String((row as { status?: unknown }).status ?? "not_started");
      if (status === "completed" || status === "in_progress" || status === "not_started") {
        byStatus[status] += 1;
      }
    }

    const progressNotificationItems: NotificationItemReadModel[] = [];
    if (byStatus.in_progress > 0 || byStatus.not_started > 0) {
      progressNotificationItems.push({
        class: byStatus.not_started > 0 ? "coaching_lesson_reminder" : "coaching_progress_nudge",
        preview: {
          title: "Coaching progress",
          body:
            byStatus.not_started > 0
              ? `${byStatus.not_started} lesson(s) not started`
              : `${byStatus.in_progress} lesson(s) in progress`,
        },
        read_state: "unread",
        route_target: "coaching_journeys",
        route_params: { source: "coaching_progress" },
        linked_context_refs: {
          team_id: null,
          challenge_id: null,
          sponsored_challenge_id: null,
          channel_id: null,
          journey_id: null,
          lesson_id: null,
          ai_suggestion_id: null,
          notification_queue_id: null,
        },
        display_requirements: {
          sponsor_disclaimer_required: false,
          sponsor_attribution_required: false,
          paywall_cta_required: false,
          ai_approval_boundary_notice_required: false,
        },
        delivery_channel_origin: "coaching",
        created_at: null,
        read_model_status: "inferred_baseline",
        notes: ["Progress summary endpoint exposes aggregate coaching progress only; row is synthesized for W6 coaching notification readiness"],
      });
    }

    return res.json({
      total_progress_rows: total,
      status_counts: byStatus,
      completion_percent:
        total > 0 ? Number(((byStatus.completed / total) * 100).toFixed(2)) : 0,
      notification_items: progressNotificationItems,
      notification_summary_read_model: buildNotificationSummaryReadModel({
        items: progressNotificationItems,
        source_scope: "coaching_progress",
        read_model_status: "inferred_baseline",
        notes: [
          "Progress summary-derived notifications are aggregate prompts only; no per-lesson notification event rows exist in this endpoint family baseline",
        ],
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/coaching/progress", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/coaching/broadcast", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const payloadCheck = validateCoachingBroadcastPayload(req.body);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    const payload = payloadCheck.payload;

    const platformAdmin = await isPlatformAdmin(auth.user.id);
    if (payload.scope_type === "global" && !platformAdmin) {
      return res.status(403).json({ error: "Only platform admins can send global coaching broadcasts" });
    }
    if (payload.scope_type === "team") {
      if (!payload.scope_id) {
        return res.status(422).json({ error: "scope_id is required for team broadcasts" });
      }
      const leaderCheck = await checkTeamLeader(payload.scope_id, auth.user.id);
      if (!leaderCheck.ok) return res.status(leaderCheck.status).json({ error: leaderCheck.error });
      if (!leaderCheck.isLeader && !platformAdmin) {
        return res.status(403).json({ error: "Only team leaders or admins can send team coaching broadcasts" });
      }
    }
    if (payload.scope_type === "journey" && !payload.scope_id) {
      return res.status(422).json({ error: "scope_id is required for journey broadcasts" });
    }

    const { data: row, error } = await dataClient
      .from("coach_broadcasts")
      .insert({
        actor_user_id: auth.user.id,
        scope_type: payload.scope_type,
        scope_id: payload.scope_id ?? null,
        message_body: payload.message_body,
      })
      .select("id,actor_user_id,scope_type,scope_id,message_body,created_at")
      .single();
    if (error) {
      return handleSupabaseError(res, "Failed to create coaching broadcast", error);
    }
    return res.status(201).json({ broadcast: row });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/broadcast", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/coaching/media/upload-url", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return errorEnvelopeResponse(res, auth.status, "unauthenticated", auth.error, req.headers["x-request-id"]);
    }

    const payloadCheck = validateCoachingMediaUploadUrlPayload(req.body);
    if (!payloadCheck.ok) {
      return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);
    }
    const payload = payloadCheck.payload;

    const roleCheck = await canAccessMuxMediaForRole(auth.user.id, "upload", {
      journeyId: payload.journey_id ?? null,
      lessonId: payload.lesson_id ?? null,
    });
    if (!roleCheck.ok) {
      return errorEnvelopeResponse(res, roleCheck.status, "provider_unavailable", roleCheck.error, req.headers["x-request-id"]);
    }
    if (!roleCheck.allowed) {
      return errorEnvelopeResponse(
        res,
        403,
        "unauthorized_scope",
        "Caller role does not have media upload scope for this context",
        req.headers["x-request-id"]
      );
    }

    if (payload.channel_id) {
      const membership = await checkChannelMembership(payload.channel_id, auth.user.id);
      if (!membership.ok) return res.status(membership.status).json({ error: membership.error });
      if (!membership.member) return res.status(403).json({ error: "Not a channel member for media upload context" });
      const channelRoleScope = await evaluateRoleScopeForChannel(auth.user.id, payload.channel_id);
      if (!channelRoleScope.ok) return res.status(channelRoleScope.status).json({ error: channelRoleScope.error });
      if (!channelRoleScope.result.allowed) {
        return res.status(403).json({ error: channelRoleScope.result.reason ?? "Channel scope denied for media upload context" });
      }
    }

    const now = new Date();
    const uploadId = `upl_${crypto.randomUUID()}`;
    const mediaId = uploadId;
    const providerCreate = await createMuxUploadSession({
      uploadId,
      ownerUserId: auth.user.id,
      filename: payload.filename,
      contentType: payload.content_type,
      contentLengthBytes: payload.content_length_bytes,
      journeyId: payload.journey_id ?? null,
      lessonId: payload.lesson_id ?? null,
    });
    if (!providerCreate.ok) {
      return errorEnvelopeResponse(res, 503, providerCreate.code, providerCreate.message, req.headers["x-request-id"]);
    }

    const record: MuxMediaSessionRecord = {
      media_id: mediaId,
      upload_id: uploadId,
      provider: "mux",
      owner_user_id: auth.user.id,
      journey_id: payload.journey_id ?? null,
      lesson_id: payload.lesson_id ?? null,
      channel_id: payload.channel_id ?? null,
      filename: payload.filename,
      content_type: payload.content_type,
      content_length_bytes: payload.content_length_bytes,
      provider_upload_id: providerCreate.providerUploadId,
      provider_asset_id: null,
      playback_id: null,
      upload_url: providerCreate.uploadUrl,
      upload_url_expires_at: providerCreate.uploadUrlExpiresAt,
      processing_status: "queued_for_upload",
      playback_ready: false,
      last_provider_event_at: null,
      last_provider_event_id: null,
      provider_error_code: null,
      verification_status: "pending",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    await upsertMuxMediaRecord(record);

    return res.status(201).json({
      upload_id: record.upload_id,
      media_id: record.media_id,
      provider: record.provider,
      provider_upload_id: record.provider_upload_id,
      upload_url: record.upload_url,
      upload_url_expires_at: record.upload_url_expires_at,
      lifecycle: {
        processing_status: record.processing_status,
        playback_ready: record.playback_ready,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/media/upload-url", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/coaching/media/playback-token", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return errorEnvelopeResponse(res, auth.status, "unauthenticated", auth.error, req.headers["x-request-id"]);
    }

    const payloadCheck = validateCoachingMediaPlaybackTokenPayload(req.body);
    if (!payloadCheck.ok) {
      return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);
    }
    const payload = payloadCheck.payload;

    const media = await getMuxMediaRecord(payload.media_id);
    if (!media) {
      return errorEnvelopeResponse(res, 404, "media_not_found", "Media asset not found", req.headers["x-request-id"]);
    }

    const roleCheck = await canAccessMuxMediaForRole(auth.user.id, "playback", {
      journeyId: media.journey_id,
      lessonId: media.lesson_id,
      ownerUserId: media.owner_user_id,
      viewerContext: payload.viewer_context,
    });
    if (!roleCheck.ok) {
      return errorEnvelopeResponse(res, roleCheck.status, "provider_unavailable", roleCheck.error, req.headers["x-request-id"]);
    }
    if (!roleCheck.allowed) {
      return errorEnvelopeResponse(
        res,
        403,
        "unauthorized_scope",
        "Caller role does not have media playback scope for this context",
        req.headers["x-request-id"]
      );
    }

    if (media.processing_status === "deleted") {
      return errorEnvelopeResponse(res, 409, "media_deleted", "Media has been deleted", req.headers["x-request-id"]);
    }
    if (!media.playback_ready || media.processing_status !== "ready" || !media.playback_id) {
      return errorEnvelopeResponse(res, 409, "media_not_ready", "Media is not ready for playback", req.headers["x-request-id"]);
    }

    const ttlSeconds = 15 * 60;
    const issuedAtMs = Date.now();
    const tokenExpiresAt = new Date(issuedAtMs + ttlSeconds * 1000).toISOString();
    const token = signMuxPlaybackToken({
      mediaId: media.media_id,
      playbackId: media.playback_id,
      subjectUserId: auth.user.id,
      viewerContext: payload.viewer_context ?? inferViewerContextFromRole(roleCheck.role),
      tokenExpiresAt,
    });

    return res.json({
      token,
      token_expires_at: tokenExpiresAt,
      playback_id: media.playback_id,
      policy: {
        watermark_required: false,
        allow_download: false,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/media/playback-token", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/coaching/media/live-sessions", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return errorEnvelopeResponse(res, auth.status, "unauthenticated", auth.error, req.headers["x-request-id"]);
    }

    const payloadCheck = validateLiveSessionCreatePayload(req.body);
    if (!payloadCheck.ok) {
      return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);
    }
    const payload = payloadCheck.payload;

    const membership = await checkChannelMembership(payload.channel_id, auth.user.id);
    if (!membership.ok) return res.status(membership.status).json({ error: membership.error });
    if (!membership.member) return res.status(403).json({ error: "Not a channel member for live session context" });
    const roleScopeCheck = await evaluateRoleScopeForChannel(auth.user.id, payload.channel_id);
    if (!roleScopeCheck.ok) return res.status(roleScopeCheck.status).json({ error: roleScopeCheck.error });
    if (!roleScopeCheck.result.allowed) {
      return res.status(403).json({ error: roleScopeCheck.result.reason ?? "Channel scope denied for caller role" });
    }

    const roleResult = await getUserRoleForScope(auth.user.id);
    if (!roleResult.ok) return res.status(roleResult.status).json({ error: roleResult.error });
    if (!canHostLiveSession(roleResult.role)) {
      return errorEnvelopeResponse(
        res,
        403,
        "unauthorized_scope",
        "Caller role does not have live session host scope for this channel",
        req.headers["x-request-id"]
      );
    }

    const idempotencyLookup = `${auth.user.id}::${payload.idempotency_key}`;
    const existingSessionId = liveSessionByIdempotencyKey.get(idempotencyLookup);
    if (existingSessionId) {
      const existing = liveSessionStore.get(existingSessionId);
      if (existing) {
        return res.status(200).json({
          session: existing,
          idempotent_replay: true,
          provider: existing.provider,
          host_url: existing.host_url,
          join_url: existing.join_url,
          live_url: existing.live_url,
        });
      }
    }

    if (resolveLiveProviderMode() === "unavailable") {
      return errorEnvelopeResponse(
        res,
        503,
        "provider_unavailable",
        "Mux live provider is unavailable",
        req.headers["x-request-id"]
      );
    }

    const nowIso = new Date().toISOString();
    const startsAt = payload.starts_at ?? nowIso;
    const status: LiveSessionStatus = new Date(startsAt).getTime() > Date.now() ? "scheduled" : "live";
    const sessionId = `live_${crypto.randomUUID()}`;
    const launchUrls = buildLiveSessionLaunchUrls({
      sessionId,
      channelId: payload.channel_id,
      role: "host",
    });
    const record: LiveSessionRecord = {
      session_id: sessionId,
      channel_id: payload.channel_id,
      title: payload.title,
      status,
      host_user_id: auth.user.id,
      provider: "mux_live",
      host_url: launchUrls.host_url,
      join_url: launchUrls.join_url,
      live_url: launchUrls.live_url,
      started_at: startsAt,
      ends_at: payload.ends_at ?? null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    liveSessionStore.set(record.session_id, record);
    liveSessionByIdempotencyKey.set(idempotencyLookup, record.session_id);
    return res.status(201).json({
      session: record,
      idempotent_replay: false,
      provider: record.provider,
      host_url: record.host_url,
      join_url: record.join_url,
      live_url: record.live_url,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/media/live-sessions", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.get("/api/coaching/media/live-sessions/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return errorEnvelopeResponse(res, auth.status, "unauthenticated", auth.error, req.headers["x-request-id"]);
    }

    const sessionId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!sessionId) {
      return errorEnvelopeResponse(res, 422, "invalid_request", "session id is required", req.headers["x-request-id"]);
    }
    const session = liveSessionStore.get(sessionId);
    if (!session) {
      return errorEnvelopeResponse(res, 404, "not_found", "Live session not found", req.headers["x-request-id"]);
    }

    const membership = await checkChannelMembership(session.channel_id, auth.user.id);
    if (!membership.ok) return res.status(membership.status).json({ error: membership.error });
    if (!membership.member) return res.status(403).json({ error: "Not a channel member for live session context" });
    const roleScopeCheck = await evaluateRoleScopeForChannel(auth.user.id, session.channel_id);
    if (!roleScopeCheck.ok) return res.status(roleScopeCheck.status).json({ error: roleScopeCheck.error });
    if (!roleScopeCheck.result.allowed) {
      return res.status(403).json({ error: roleScopeCheck.result.reason ?? "Channel scope denied for caller role" });
    }

    return res.json({
      session,
      provider: session.provider,
      host_url: session.host_url,
      join_url: session.join_url,
      live_url: session.live_url,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/coaching/media/live-sessions/:id", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/coaching/media/live-sessions/:id/join-token", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return errorEnvelopeResponse(res, auth.status, "unauthenticated", auth.error, req.headers["x-request-id"]);
    }

    const sessionId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!sessionId) {
      return errorEnvelopeResponse(res, 422, "invalid_request", "session id is required", req.headers["x-request-id"]);
    }
    const session = liveSessionStore.get(sessionId);
    if (!session) {
      return errorEnvelopeResponse(res, 404, "not_found", "Live session not found", req.headers["x-request-id"]);
    }
    if (session.status === "ended" || session.status === "cancelled") {
      return errorEnvelopeResponse(res, 409, "session_closed", "Live session is closed", req.headers["x-request-id"]);
    }

    const membership = await checkChannelMembership(session.channel_id, auth.user.id);
    if (!membership.ok) return res.status(membership.status).json({ error: membership.error });
    if (!membership.member) return res.status(403).json({ error: "Not a channel member for live session context" });
    const roleScopeCheck = await evaluateRoleScopeForChannel(auth.user.id, session.channel_id);
    if (!roleScopeCheck.ok) return res.status(roleScopeCheck.status).json({ error: roleScopeCheck.error });
    if (!roleScopeCheck.result.allowed) {
      return res.status(403).json({ error: roleScopeCheck.result.reason ?? "Channel scope denied for caller role" });
    }

    const payloadCheck = validateLiveSessionJoinTokenPayload(req.body);
    if (!payloadCheck.ok) {
      return errorEnvelopeResponse(res, payloadCheck.status, "invalid_request", payloadCheck.error, req.headers["x-request-id"]);
    }
    if (resolveLiveProviderMode() === "unavailable") {
      return errorEnvelopeResponse(
        res,
        503,
        "provider_unavailable",
        "Mux live provider is unavailable",
        req.headers["x-request-id"]
      );
    }
    const requestedRole = payloadCheck.payload.role ?? "participant";
    const role: "host" | "participant" | "viewer" = session.host_user_id === auth.user.id ? "host" : requestedRole;
    const issuedAtMs = Date.now();
    const ttlSeconds = Math.max(60, Math.min(3600, toNumberOrZero(process.env.LIVE_SESSION_JOIN_TOKEN_TTL_SECONDS ?? 900) || 900));
    const token = issueLiveSessionJoinToken({
      sessionId,
      channelId: session.channel_id,
      userId: auth.user.id,
      role,
      issuedAtMs,
      ttlSeconds,
    });

    const sessionUpdate: LiveSessionRecord = {
      ...session,
      status: session.status === "scheduled" ? "live" : session.status,
      ...buildLiveSessionLaunchUrls({
        sessionId,
        channelId: session.channel_id,
        role,
        token,
      }),
      updated_at: new Date().toISOString(),
    };
    liveSessionStore.set(sessionId, sessionUpdate);

    return res.json({
      session: sessionUpdate,
      role,
      token,
      token_expires_at: new Date(issuedAtMs + ttlSeconds * 1000).toISOString(),
      provider: sessionUpdate.provider,
      host_url: sessionUpdate.host_url,
      join_url: sessionUpdate.join_url,
      live_url: sessionUpdate.live_url,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/media/live-sessions/:id/join-token", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/coaching/media/live-sessions/:id/end", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return errorEnvelopeResponse(res, auth.status, "unauthenticated", auth.error, req.headers["x-request-id"]);
    }

    const sessionId = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!sessionId) {
      return errorEnvelopeResponse(res, 422, "invalid_request", "session id is required", req.headers["x-request-id"]);
    }
    const session = liveSessionStore.get(sessionId);
    if (!session) {
      return errorEnvelopeResponse(res, 404, "not_found", "Live session not found", req.headers["x-request-id"]);
    }

    const roleResult = await getUserRoleForScope(auth.user.id);
    if (!roleResult.ok) return res.status(roleResult.status).json({ error: roleResult.error });
    const adminLike = roleResult.role === "admin" || roleResult.role === "super_admin";
    if (!adminLike && session.host_user_id !== auth.user.id) {
      return errorEnvelopeResponse(res, 403, "unauthorized_scope", "Only the host or admin can end this live session", req.headers["x-request-id"]);
    }

    const ended: LiveSessionRecord = {
      ...session,
      status: "ended",
      ends_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    liveSessionStore.set(sessionId, ended);
    return res.json({ session: ended });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/media/live-sessions/:id/end", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/webhooks/mux", async (req, res) => {
  try {
    const rawBody = (req as RawBodyRequest).rawBody ?? JSON.stringify(req.body ?? {});
    const signatureHeader = req.headers["mux-signature"] ?? req.headers["x-mux-signature"];
    const verification = verifyMuxWebhookSignature({
      rawBody,
      signatureHeader,
      nowMs: Date.now(),
    });
    if (!verification.ok) {
      return errorEnvelopeResponse(
        res,
        401,
        verification.code,
        verification.status === "rejected_replay_window" ? "Webhook rejected: replay window exceeded" : "Webhook signature verification failed",
        req.headers["x-request-id"]
      );
    }

    const event = normalizeMuxWebhookEvent(req.body);
    if (!event.ok) {
      return errorEnvelopeResponse(res, 422, "invalid_payload", event.error, req.headers["x-request-id"]);
    }

    if (muxProcessedWebhookEventIds.has(event.eventId)) {
      return res.status(200).json({
        verification_status: "duplicate_ignored",
        event_id: event.eventId,
      });
    }

    const transition = mapMuxWebhookEventToTransition(event.eventType);
    if (!transition) {
      muxProcessedWebhookEventIds.add(event.eventId);
      return res.status(202).json({
        verification_status: "verified",
        event_id: event.eventId,
        ignored: true,
        reason: "unsupported_event_type",
      });
    }

    const targetMedia = await resolveMuxMediaFromWebhookEvent(event.object);
    if (!targetMedia) {
      muxProcessedWebhookEventIds.add(event.eventId);
      return res.status(202).json({
        verification_status: "verified",
        event_id: event.eventId,
        ignored: true,
        reason: "media_not_found_for_event",
      });
    }

    const applied = applyMuxLifecycleTransition(targetMedia, transition.nextStatus);
    const nowIso = new Date().toISOString();
    const updated: MuxMediaSessionRecord = {
      ...targetMedia,
      processing_status: applied.status,
      playback_ready: applied.status === "ready",
      provider_asset_id: event.providerAssetId ?? targetMedia.provider_asset_id,
      playback_id: event.playbackId ?? targetMedia.playback_id,
      provider_error_code: event.providerErrorCode ?? (applied.status === "failed" ? "provider_processing_failed" : null),
      last_provider_event_at: event.eventTimestampIso ?? nowIso,
      last_provider_event_id: event.eventId,
      verification_status: "verified",
      updated_at: nowIso,
    };
    await upsertMuxMediaRecord(updated);
    if (applied.applied && updated.channel_id) {
      await emitMuxLifecycleChannelMessage(updated, event.eventType);
    }
    muxProcessedWebhookEventIds.add(event.eventId);

    return res.status(200).json({
      verification_status: "verified",
      event_id: event.eventId,
      media_id: updated.media_id,
      processing_status: updated.processing_status,
      playback_ready: updated.playback_ready,
      transition_applied: applied.applied,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/webhooks/mux", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

// ── Coach Marketplace + Engagement (C2) ──────────────────────────────

app.get("/api/coaching/coaches", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const specialtyFilterRaw = typeof req.query.specialty === "string" ? req.query.specialty : null;
    const availabilityFilterRaw = typeof req.query.availability === "string" ? req.query.availability : null;
    const specialtyFilter = specialtyFilterRaw?.trim() ? specialtyFilterRaw.trim() : null;
    const availabilityFilter = availabilityFilterRaw?.trim() ? availabilityFilterRaw.trim().toLowerCase() : null;
    if (
      availabilityFilter &&
      availabilityFilter !== "available" &&
      availabilityFilter !== "waitlist" &&
      availabilityFilter !== "unavailable"
    ) {
      return res.status(422).json({ error: "availability must be one of: available, waitlist, unavailable" });
    }

    // Read coach profiles from users with coaching role
    let query = dataClient
      .from("users")
      .select("id,full_name,coach_specialties,coach_bio,coach_availability")
      .eq("is_coach", true)
      .order("full_name", { ascending: true });

    if (availabilityFilter) {
      query = query.eq("coach_availability", availabilityFilter);
    }

    const { data: rows, error } = await query;
    if (error) {
      return handleSupabaseError(res, "Failed to fetch coaches", error);
    }

    let coaches: CoachProfileReadModel[] = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: (r.full_name as string) ?? "Coach",
      specialties: Array.isArray(r.coach_specialties) ? (r.coach_specialties as string[]) : [],
      bio: (r.coach_bio as string) ?? "",
      engagement_availability: (r.coach_availability as CoachProfileReadModel["engagement_availability"]) ?? "available",
    }));

    if (specialtyFilter) {
      coaches = coaches.filter((c) => c.specialties.some((s) => s.toLowerCase() === specialtyFilter.toLowerCase()));
    }

    const emptyState =
      coaches.length === 0
        ? {
          code: "no_coaches_found",
          message: "No coaches found for the current filters.",
        }
        : null;

    return res.json({
      coaches,
      total: coaches.length,
      empty_state: emptyState,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/coaching/coaches", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/coaching/engagements", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const payloadCheck = validateCoachEngagementCreatePayload(req.body);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    const payload = payloadCheck.payload;

    // Check existing active engagement
    const { data: existing, error: existingError } = await dataClient
      .from("coaching_engagements")
      .select("id,status")
      .eq("client_id", auth.user.id)
      .in("status", ["pending", "active"])
      .limit(1);
    if (existingError) {
      return handleSupabaseError(res, "Failed to verify existing coaching engagements", existingError);
    }

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: "You already have an active or pending coaching engagement" });
    }

    const { data: coachRow, error: coachError } = await dataClient
      .from("users")
      .select("id,is_coach,coach_availability")
      .eq("id", payload.coach_id)
      .maybeSingle();
    if (coachError) {
      return handleSupabaseError(res, "Failed to verify coach profile", coachError);
    }
    if (!coachRow || !Boolean((coachRow as { is_coach?: unknown }).is_coach)) {
      return res.status(404).json({ error: "Coach profile not found" });
    }
    if ((coachRow as { coach_availability?: unknown }).coach_availability === "unavailable") {
      return res.status(409).json({ error: "Selected coach is currently unavailable for new engagements" });
    }

    // Phase-1: shell entitlement check (always allowed)
    const entitlementState: CoachEngagementReadModel["entitlement_state"] = "allowed";
    const planTierLabel = "Compass Coaching";
    const statusReason = "Engagement created — coach will confirm.";
    const nextStepCta = "Awaiting coach confirmation";

    const { data: row, error } = await dataClient
      .from("coaching_engagements")
      .insert({
        coach_id: payload.coach_id,
        client_id: auth.user.id,
        status: "pending",
        entitlement_state: entitlementState,
        plan_tier_label: planTierLabel,
        status_reason: statusReason,
        next_step_cta: nextStepCta,
      })
      .select("id,coach_id,client_id,status,entitlement_state,plan_tier_label,status_reason,next_step_cta,created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "You already have an active or pending coaching engagement" });
      }
      return handleSupabaseError(res, "Failed to create coaching engagement", error);
    }

    return res.status(201).json({ engagement: row });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/engagements", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/coaching/engagements/me", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const { data: rows, error } = await dataClient
      .from("coaching_engagements")
      .select("id,coach_id,client_id,status,entitlement_state,plan_tier_label,status_reason,next_step_cta,created_at")
      .eq("client_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return handleSupabaseError(res, "Failed to fetch engagements", error);
    }

    // Enrich with coach profile data
    const engagements: CoachEngagementReadModel[] = [];
    for (const r of rows ?? []) {
      let coach: CoachEngagementReadModel["coach"] = null;
      if (r.coach_id) {
        const { data: coachRow, error: coachError } = await dataClient
          .from("users")
          .select("id,full_name,coach_specialties")
          .eq("id", r.coach_id)
          .maybeSingle();
        if (coachError) {
          return handleSupabaseError(res, "Failed to fetch coach profile for engagement", coachError);
        }
        if (coachRow) {
          coach = {
            id: coachRow.id as string,
            name: (coachRow.full_name as string) ?? "Coach",
            specialties: Array.isArray(coachRow.coach_specialties) ? (coachRow.coach_specialties as string[]) : [],
          };
        }
      }
      engagements.push({
        id: r.id as string,
        coach_id: r.coach_id as string,
        client_id: r.client_id as string,
        status: r.status as CoachEngagementReadModel["status"],
        entitlement_state: (r.entitlement_state as CoachEngagementReadModel["entitlement_state"]) ?? "allowed",
        plan_tier_label: (r.plan_tier_label as string) ?? "Compass Coaching",
        status_reason: (r.status_reason as string) ?? "",
        next_step_cta: (r.next_step_cta as string) ?? "",
        coach,
        created_at: r.created_at as string,
      });
    }

    // Derive engagement summary for Coach tab routing
    const activeEngagement = engagements.find((e) => e.status === "active") ?? null;
    const pendingEngagement = engagements.find((e) => e.status === "pending") ?? null;
    const engagementStatus: "none" | "pending" | "active" | "ended" = activeEngagement
      ? "active"
      : pendingEngagement
        ? "pending"
        : engagements.length > 0
          ? "ended"
          : "none";

    const emptyState =
      engagements.length === 0
        ? {
          code: "no_engagements",
          message: "No coaching engagements yet.",
        }
        : null;

    return res.json({
      engagements,
      total: engagements.length,
      empty_state: emptyState,
      engagement_status: engagementStatus,
      active_engagement: activeEngagement,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/coaching/engagements/me", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Unified Goals/Tasks Feed (C3) ──────────────────────────────

app.get("/api/coaching/assignments/me", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const userId = auth.user.id;
    type AssignmentItem = {
      id: string;
      type: "personal_goal" | "team_leader_goal" | "coach_goal" | "personal_task" | "coach_task";
      title: string;
      status: "pending" | "in_progress" | "completed";
      due_at: string | null;
      assignee_id: string | null;
      source: "goals" | "message_linked";
      created_at: string;
      channel_id: string | null;
      source_message_id: string | null;
      last_thread_event_at: string | null;
      thread_read_state: "unread" | "read" | "unknown";
      rights: {
        can_edit_fields: boolean;
        can_update_status: boolean;
        can_mark_complete: boolean;
        can_reassign: boolean;
      };
    };

    const assignments: AssignmentItem[] = [];

    // 1. Fetch goals owned by or assigned to user
    const { data: goalRows, error: goalRowsError } = await dataClient
      .from("goals")
      .select("id,title,status,due_at,assignee_id,created_by,created_at,goal_type")
      .or(`assignee_id.eq.${userId},created_by.eq.${userId}`)
      .order("due_at", { ascending: true, nullsFirst: false });
    if (goalRowsError) {
      if (!isRecoverableAssignmentSourceGap(goalRowsError)) {
        return handleSupabaseError(res, "Failed to fetch goal assignments", goalRowsError);
      }
    }

    for (const g of goalRows ?? []) {
      const goalType = (g.goal_type as string) ?? "personal";
      let assignmentType: AssignmentItem["type"] = "personal_goal";
      if (goalType === "coach") {
        assignmentType = "coach_goal";
      } else if (goalType === "team_leader") {
        assignmentType = "team_leader_goal";
      }

      const isOwner = (g.created_by as string) === userId;
      const isAssignee = (g.assignee_id as string) === userId;

      assignments.push({
        id: g.id as string,
        type: assignmentType,
        title: (g.title as string) ?? "Untitled Goal",
        status: normalizeGoalStatus(g.status as string),
        due_at: (g.due_at as string) ?? null,
        assignee_id: (g.assignee_id as string) ?? null,
        source: "goals",
        created_at: (g.created_at as string) ?? new Date().toISOString(),
        channel_id: null,
        source_message_id: null,
        last_thread_event_at: null,
        thread_read_state: "unknown",
        rights: {
          can_edit_fields: isOwner,
          can_update_status: isOwner || isAssignee,
          can_mark_complete: isOwner || isAssignee,
          can_reassign: isOwner,
        },
      });
    }

    // 2. Fetch message-linked tasks (messages with message_kind metadata)
    const { data: memberChannelRows, error: memberChannelRowsError } = await dataClient
      .from("channel_memberships")
      .select("channel_id")
      .eq("user_id", userId);
    if (memberChannelRowsError) {
      return handleSupabaseError(res, "Failed to fetch channel scope for message-linked assignments", memberChannelRowsError);
    }
    const allowedChannelIds = (memberChannelRows ?? []).map((row) => String((row as { channel_id?: unknown }).channel_id ?? "")).filter(Boolean);

    const { data: taskMsgRows, error: taskRowsError } = await dataClient
      .from("channel_messages")
      .select("id,channel_id,message_kind,assignment_ref,created_at")
      .in("message_kind", ["coach_task", "personal_task"])
      .in("channel_id", allowedChannelIds.length > 0 ? allowedChannelIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });
    if (taskRowsError) {
      if (!isRecoverableAssignmentSourceGap(taskRowsError)) {
        return handleSupabaseError(res, "Failed to fetch message-linked assignments", taskRowsError);
      }
    }

    const seenMessageLinkedTaskIds = new Set<string>();
    for (const m of taskMsgRows ?? []) {
      const ref = (m.assignment_ref as Record<string, unknown>) ?? {};
      const assigneeId = (ref.assignee_id as string) ?? null;
      // Only include tasks assigned to or created by this user
      if (assigneeId !== userId && (ref.created_by as string) !== userId) continue;

      const taskType = (m.message_kind as string) === "coach_task" ? "coach_task" : "personal_task";
      const isAssignee = assigneeId === userId;
      const taskId = (ref.id as string) ?? (m.id as string);
      // Keep latest state only (rows are sorted newest->oldest).
      if (seenMessageLinkedTaskIds.has(taskId)) continue;
      seenMessageLinkedTaskIds.add(taskId);

      const roleScopeCheck = await evaluateRoleScopeForChannel(userId, String((m.channel_id as string) ?? ""));
      if (!roleScopeCheck.ok) return res.status(roleScopeCheck.status).json({ error: roleScopeCheck.error });
      if (!roleScopeCheck.result.allowed) continue;

      const role = roleScopeCheck.result.role;
      const canManageCoachTask = taskType === "coach_task" && (role === "coach" || role === "team_leader" || role === "admin" || role === "super_admin");
      const canEditFields = !isAssignee && canManageCoachTask;
      const canUpdateStatus = taskType === "personal_task" ? isAssignee : (isAssignee || canManageCoachTask);
      const canMarkComplete = canUpdateStatus;
      const sourceMessageId = (ref.source_message_id as string) ?? (m.id as string);
      const lastThreadEventAt = (ref.last_thread_event_at as string) ?? (m.created_at as string) ?? null;

      assignments.push({
        id: taskId,
        type: taskType as AssignmentItem["type"],
        title: (ref.title as string) ?? "Task",
        status: normalizeGoalStatus((ref.status as string) ?? "pending"),
        due_at: (ref.due_at as string) ?? null,
        assignee_id: assigneeId,
        source: "message_linked",
        created_at: (m.created_at as string) ?? new Date().toISOString(),
        channel_id: (m.channel_id as string) ?? null,
        source_message_id: sourceMessageId,
        last_thread_event_at: lastThreadEventAt,
        thread_read_state: "unknown",
        rights: {
          can_edit_fields: canEditFields,
          can_update_status: canUpdateStatus,
          can_mark_complete: canMarkComplete,
          can_reassign: canEditFields,
        },
      });
    }

    // Sort: due_at asc (nulls last), then created_at desc
    assignments.sort((a, b) => {
      if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
      if (a.due_at && !b.due_at) return -1;
      if (!a.due_at && b.due_at) return 1;
      return b.created_at.localeCompare(a.created_at);
    });

    const emptyState =
      assignments.length === 0
        ? {
          code: "no_assignments",
          message: "No assignments available.",
        }
        : null;

    return res.json({
      assignments,
      total: assignments.length,
      empty_state: emptyState,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/coaching/assignments/me", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/ai/suggestions", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const payloadCheck = validateAiSuggestionCreatePayload(req.body);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    const payload = payloadCheck.payload;
    const platformAdmin = await isPlatformAdmin(auth.user.id);
    const targetUserId = payload.user_id ?? auth.user.id;
    if (targetUserId !== auth.user.id && !platformAdmin) {
      const leaderScope = await canLeaderTargetUserForAiSuggestion(auth.user.id, targetUserId);
      if (!leaderScope.ok) return res.status(leaderScope.status).json({ error: leaderScope.error });
      if (!leaderScope.allowed) {
        return res.status(403).json({ error: "Only platform admins or team leaders can create AI suggestions for other users" });
      }
    }

    await ensureUserRow(auth.user.id);
    await ensureUserRow(targetUserId);

    const { data: row, error } = await dataClient
      .from("ai_suggestions")
      .insert({
        user_id: targetUserId,
        scope: payload.scope,
        proposed_message: payload.proposed_message,
        status: "pending",
        created_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .select("id,user_id,scope,proposed_message,status,created_by,approved_by,rejected_by,sent_at,created_at,updated_at")
      .single();
    if (error) {
      return handleSupabaseError(res, "Failed to create AI suggestion", error);
    }

    return res.status(201).json({ suggestion: attachAiSuggestionQueueReadModel(row) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/ai/suggestions", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/ai/suggestions", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const platformAdmin = await isPlatformAdmin(auth.user.id);
    if (platformAdmin) {
      const { data, error } = await dataClient
        .from("ai_suggestions")
        .select("id,user_id,scope,proposed_message,status,created_by,approved_by,rejected_by,sent_at,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        return handleSupabaseError(res, "Failed to fetch AI suggestions", error);
      }
      const rows = (data ?? []) as AiSuggestionRow[];
      return res.json({
        suggestions: rows.map((row) => attachAiSuggestionQueueReadModel(row)),
        queue_summary: buildAiSuggestionQueueSummary(rows),
      });
    }

    const { data, error } = await dataClient
      .from("ai_suggestions")
      .select("id,user_id,scope,proposed_message,status,created_by,approved_by,rejected_by,sent_at,created_at,updated_at")
      .or(`created_by.eq.${auth.user.id},user_id.eq.${auth.user.id}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      return handleSupabaseError(res, "Failed to fetch AI suggestions", error);
    }
    const rows = (data ?? []) as AiSuggestionRow[];
    return res.json({
      suggestions: rows.map((row) => attachAiSuggestionQueueReadModel(row)),
      queue_summary: buildAiSuggestionQueueSummary(rows),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/ai/suggestions", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/ai/suggestions/:id/approve", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const suggestionId = req.params.id;
    if (!suggestionId) return res.status(422).json({ error: "suggestion id is required" });

    const platformAdmin = await isPlatformAdmin(auth.user.id);
    if (!platformAdmin) {
      return res.status(403).json({ error: "Only platform admins can approve AI suggestions" });
    }

    const { data: existing, error: existingError } = await dataClient
      .from("ai_suggestions")
      .select("id,status")
      .eq("id", suggestionId)
      .single();
    if (existingError) {
      return handleSupabaseError(res, "Failed to fetch AI suggestion", existingError);
    }
    if (String(existing.status) !== "pending") {
      return res.status(422).json({ error: "Only pending suggestions can be approved" });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateError } = await dataClient
      .from("ai_suggestions")
      .update({
        status: "approved",
        approved_by: auth.user.id,
        rejected_by: null,
        sent_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", suggestionId)
      .select("id,user_id,scope,proposed_message,status,created_by,approved_by,rejected_by,sent_at,updated_at")
      .single();
    if (updateError) {
      return handleSupabaseError(res, "Failed to approve AI suggestion", updateError);
    }
    return res.json({ suggestion: attachAiSuggestionQueueReadModel(updated) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/ai/suggestions/:id/approve", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/ai/suggestions/:id/reject", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const suggestionId = req.params.id;
    if (!suggestionId) return res.status(422).json({ error: "suggestion id is required" });

    const platformAdmin = await isPlatformAdmin(auth.user.id);
    if (!platformAdmin) {
      return res.status(403).json({ error: "Only platform admins can reject AI suggestions" });
    }

    const { data: existing, error: existingError } = await dataClient
      .from("ai_suggestions")
      .select("id,status")
      .eq("id", suggestionId)
      .single();
    if (existingError) {
      return handleSupabaseError(res, "Failed to fetch AI suggestion", existingError);
    }
    if (String(existing.status) !== "pending") {
      return res.status(422).json({ error: "Only pending suggestions can be rejected" });
    }

    const nowIso = new Date().toISOString();
    const { data: updated, error: updateError } = await dataClient
      .from("ai_suggestions")
      .update({
        status: "rejected",
        approved_by: null,
        rejected_by: auth.user.id,
        sent_at: null,
        updated_at: nowIso,
      })
      .eq("id", suggestionId)
      .select("id,user_id,scope,proposed_message,status,created_by,approved_by,rejected_by,sent_at,updated_at")
      .single();
    if (updateError) {
      return handleSupabaseError(res, "Failed to reject AI suggestion", updateError);
    }
    return res.json({ suggestion: attachAiSuggestionQueueReadModel(updated) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/ai/suggestions/:id/reject", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/ops/summary/sprint1", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const [
      usersOut,
      kpisOut,
      logsOut,
      anchorsOut,
      kpiDefsOut,
      idempotencySelectOut,
    ] = await Promise.all([
      dataClient.from("users").select("id", { count: "exact", head: true }),
      dataClient.from("kpis").select("id", { count: "exact", head: true }),
      dataClient.from("kpi_logs").select("id,user_id,kpi_id,pc_generated,actual_gci_delta,idempotency_key", { count: "exact" }),
      dataClient.from("pipeline_anchor_status").select("id", { count: "exact", head: true }),
      dataClient.from("kpis").select("id,type,name"),
      dataClient.from("kpi_logs").select("idempotency_key").limit(1),
    ]);

    if (usersOut.error || kpisOut.error || logsOut.error || anchorsOut.error || kpiDefsOut.error) {
      return res.status(500).json({ error: "Failed to compute Sprint 1 summary" });
    }

    const logs = logsOut.data ?? [];
    const kpiDefs = kpiDefsOut.data ?? [];
    const kpiTypeById = new Map<string, KPIType>(
      kpiDefs.map((k) => [String(k.id), String(k.type) as KPIType])
    );

    let gpVpWithPc = 0;
    let actualWithPc = 0;
    let pcWithoutPcValue = 0;
    const idemKeyCounts = new Map<string, number>();

    for (const log of logs) {
      const kpiType = kpiTypeById.get(String(log.kpi_id));
      const pcGenerated = toNumberOrZero((log as { pc_generated?: unknown }).pc_generated);
      const key = String((log as { user_id?: unknown }).user_id) + "::" + String((log as { idempotency_key?: unknown }).idempotency_key ?? "");

      if ((kpiType === "GP" || kpiType === "VP") && pcGenerated !== 0) {
        gpVpWithPc += 1;
      }
      if (kpiType === "Actual" && pcGenerated !== 0) {
        actualWithPc += 1;
      }
      if (kpiType === "PC" && pcGenerated <= 0) {
        pcWithoutPcValue += 1;
      }
      if ((log as { idempotency_key?: unknown }).idempotency_key) {
        idemKeyCounts.set(key, (idemKeyCounts.get(key) ?? 0) + 1);
      }
    }

    let duplicateIdemRows = 0;
    for (const cnt of idemKeyCounts.values()) {
      if (cnt > 1) duplicateIdemRows += cnt - 1;
    }

    return res.json({
      sprint: "sprint1",
      generated_at: new Date().toISOString(),
      totals: {
        users: usersOut.count ?? 0,
        kpis: kpisOut.count ?? 0,
        kpi_logs: logsOut.count ?? logs.length,
        pipeline_anchor_status: anchorsOut.count ?? 0,
      },
      integrity_checks: {
        gp_vp_logs_with_pc_generated: gpVpWithPc,
        actual_logs_with_pc_generated: actualWithPc,
        pc_logs_with_non_positive_pc_generated: pcWithoutPcValue,
        duplicate_user_idempotency_rows: duplicateIdemRows,
      },
      schema_checks: {
        kpi_logs_has_idempotency_key:
          !idempotencySelectOut.error,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in /ops/summary/sprint1", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/ops/summary/sprint2", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const [teamsOut, membershipsOut, challengesOut, participantsOut, challengeKpisOut] =
      await Promise.all([
        dataClient.from("teams").select("id", { count: "exact" }),
        dataClient.from("team_memberships").select("team_id,user_id,role"),
        dataClient.from("challenges").select("id,team_id,mode,is_active,late_join_includes_history"),
        dataClient.from("challenge_participants").select("challenge_id,user_id,team_id,effective_start_at,progress_percent"),
        dataClient.from("challenge_kpis").select("challenge_id,kpi_id"),
      ]);

    if (
      teamsOut.error ||
      membershipsOut.error ||
      challengesOut.error ||
      participantsOut.error ||
      challengeKpisOut.error
    ) {
      return res.status(500).json({ error: "Failed to compute Sprint 2 summary" });
    }

    const memberships = membershipsOut.data ?? [];
    const challenges = challengesOut.data ?? [];
    const participants = participantsOut.data ?? [];
    const challengeKpis = challengeKpisOut.data ?? [];

    const leadersByTeam = new Map<string, number>();
    const membershipSet = new Set<string>();
    for (const m of memberships) {
      const teamId = String(m.team_id);
      const userId = String(m.user_id);
      membershipSet.add(`${teamId}::${userId}`);
      if (String(m.role) === "team_leader") {
        leadersByTeam.set(teamId, (leadersByTeam.get(teamId) ?? 0) + 1);
      }
    }

    let teamsWithoutLeader = 0;
    const challengeById = new Map<string, { id: unknown; team_id: unknown; mode: unknown; is_active: unknown }>(
      challenges.map((c) => [String(c.id), c as { id: unknown; team_id: unknown; mode: unknown; is_active: unknown }])
    );

    for (const teamId of new Set((teamsOut.data ?? []).map((t) => String(t.id)))) {
      if ((leadersByTeam.get(teamId) ?? 0) === 0) {
        teamsWithoutLeader += 1;
      }
    }

    const kpiMapCountByChallenge = new Map<string, number>();
    for (const row of challengeKpis) {
      const challengeId = String(row.challenge_id);
      kpiMapCountByChallenge.set(challengeId, (kpiMapCountByChallenge.get(challengeId) ?? 0) + 1);
    }
    let activeChallengesWithoutKpis = 0;
    for (const c of challenges) {
      const challengeId = String(c.id);
      const isActive = Boolean(c.is_active);
      if (isActive && (kpiMapCountByChallenge.get(challengeId) ?? 0) === 0) {
        activeChallengesWithoutKpis += 1;
      }
    }

    let teamModeParticipantsNotOnTeam = 0;
    for (const p of participants) {
      const challenge = challengeById.get(String(p.challenge_id));
      if (!challenge) continue;
      if (String(challenge.mode) !== "team") continue;
      const teamId = String(challenge.team_id ?? "");
      const userId = String(p.user_id);
      if (!teamId || !membershipSet.has(`${teamId}::${userId}`)) {
        teamModeParticipantsNotOnTeam += 1;
      }
    }

    const lateJoinPolicy = {
      true_count: challenges.filter((c) => Boolean(c.late_join_includes_history)).length,
      false_count: challenges.filter((c) => !Boolean(c.late_join_includes_history)).length,
    };

    const participantCountByChallenge = new Map<string, number>();
    for (const p of participants) {
      const challengeId = String(p.challenge_id);
      participantCountByChallenge.set(challengeId, (participantCountByChallenge.get(challengeId) ?? 0) + 1);
    }
    const challengeParticipantRows = challenges.map((c) => ({
      challenge_id: String(c.id),
      participants: participantCountByChallenge.get(String(c.id)) ?? 0,
      mode: String(c.mode),
    }));
    challengeParticipantRows.sort((a, b) => b.participants - a.participants);

    return res.json({
      sprint: "sprint2",
      generated_at: new Date().toISOString(),
      totals: {
        teams: teamsOut.count ?? 0,
        team_memberships: memberships.length,
        challenges: challenges.length,
        challenge_participants: participants.length,
        challenge_kpi_mappings: challengeKpis.length,
      },
      integrity_checks: {
        teams_without_team_leader: teamsWithoutLeader,
        active_challenges_without_kpi_mapping: activeChallengesWithoutKpis,
        team_mode_participants_not_on_team: teamModeParticipantsNotOnTeam,
      },
      policy_distribution: {
        late_join_includes_history: lateJoinPolicy,
      },
      top_challenges_by_participants: challengeParticipantRows.slice(0, 5),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in /ops/summary/sprint2", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/ops/summary/sprint3", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const [
      channelsOut,
      channelMembershipsOut,
      channelMessagesOut,
      messageUnreadsOut,
      pushTokensOut,
      broadcastLogOut,
    ] = await Promise.all([
      dataClient.from("channels").select("id,is_active"),
      dataClient.from("channel_memberships").select("channel_id,user_id,role"),
      dataClient.from("channel_messages").select("id,channel_id,sender_user_id,message_type"),
      dataClient.from("message_unreads").select("channel_id,user_id,unread_count"),
      dataClient.from("push_tokens").select("id,is_active"),
      dataClient.from("broadcast_log").select("id,message_id,channel_id,actor_user_id"),
    ]);

    if (
      channelsOut.error ||
      channelMembershipsOut.error ||
      channelMessagesOut.error ||
      messageUnreadsOut.error ||
      pushTokensOut.error ||
      broadcastLogOut.error
    ) {
      return res.status(500).json({ error: "Failed to compute Sprint 3 summary" });
    }

    const channels = channelsOut.data ?? [];
    const memberships = channelMembershipsOut.data ?? [];
    const messages = channelMessagesOut.data ?? [];
    const unreads = messageUnreadsOut.data ?? [];
    const pushTokens = pushTokensOut.data ?? [];
    const broadcastLogs = broadcastLogOut.data ?? [];

    const membershipSet = new Set(
      memberships.map((m) => `${String(m.channel_id)}::${String(m.user_id)}`)
    );
    const adminCountByChannel = new Map<string, number>();
    for (const m of memberships) {
      if (String(m.role) === "admin") {
        const channelId = String(m.channel_id);
        adminCountByChannel.set(channelId, (adminCountByChannel.get(channelId) ?? 0) + 1);
      }
    }

    let activeChannelsWithoutMembers = 0;
    let activeChannelsWithoutAdmin = 0;
    for (const channel of channels) {
      const channelId = String(channel.id);
      const isActive = Boolean(channel.is_active);
      if (!isActive) continue;
      const memberCount = memberships.filter((m) => String(m.channel_id) === channelId).length;
      if (memberCount === 0) {
        activeChannelsWithoutMembers += 1;
      }
      if ((adminCountByChannel.get(channelId) ?? 0) === 0) {
        activeChannelsWithoutAdmin += 1;
      }
    }

    let messagesByNonMembers = 0;
    for (const message of messages) {
      const key = `${String(message.channel_id)}::${String(message.sender_user_id)}`;
      if (!membershipSet.has(key)) {
        messagesByNonMembers += 1;
      }
    }

    let negativeUnreadRows = 0;
    for (const row of unreads) {
      if (toNumberOrZero((row as { unread_count?: unknown }).unread_count) < 0) {
        negativeUnreadRows += 1;
      }
    }

    const broadcastMessageIds = new Set(
      messages
        .filter((m) => String(m.message_type) === "broadcast")
        .map((m) => String(m.id))
    );
    const broadcastLogMessageIds = new Set(
      broadcastLogs
        .map((b) => String((b as { message_id?: unknown }).message_id ?? ""))
        .filter(Boolean)
    );

    let broadcastMessagesWithoutAudit = 0;
    for (const messageId of broadcastMessageIds) {
      if (!broadcastLogMessageIds.has(messageId)) {
        broadcastMessagesWithoutAudit += 1;
      }
    }

    const topChannelsByMessages = channels
      .map((channel) => {
        const channelId = String(channel.id);
        const messageCount = messages.filter((m) => String(m.channel_id) === channelId).length;
        return { channel_id: channelId, message_count: messageCount };
      })
      .sort((a, b) => b.message_count - a.message_count)
      .slice(0, 5);

    return res.json({
      sprint: "sprint3",
      generated_at: new Date().toISOString(),
      totals: {
        channels: channels.length,
        channel_memberships: memberships.length,
        channel_messages: messages.length,
        message_unreads: unreads.length,
        push_tokens_total: pushTokens.length,
        push_tokens_active: pushTokens.filter((t) => Boolean(t.is_active)).length,
        broadcast_logs: broadcastLogs.length,
      },
      integrity_checks: {
        active_channels_without_members: activeChannelsWithoutMembers,
        active_channels_without_admin: activeChannelsWithoutAdmin,
        channel_messages_by_non_members: messagesByNonMembers,
        negative_unread_rows: negativeUnreadRows,
        broadcast_messages_without_audit_log: broadcastMessagesWithoutAudit,
      },
      top_channels_by_messages: topChannelsByMessages,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in /ops/summary/sprint3", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/ops/summary/policy", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });

    const [
      kpiDefsOut,
      kpiLogsOut,
      participantsOut,
      sponsoredOut,
      adminAuditOut,
      usersOut,
      notificationOut,
    ] = await Promise.all([
      dataClient.from("kpis").select("id,type"),
      dataClient.from("kpi_logs").select("kpi_id,pc_generated"),
      dataClient.from("challenge_participants").select("id,sponsored_challenge_id"),
      dataClient.from("sponsored_challenges").select("id"),
      dataClient.from("admin_activity_log").select("id,admin_user_id"),
      dataClient.from("users").select("id,role,account_status,last_activity_timestamp"),
      dataClient.from("notification_queue").select("id,status,attempts"),
    ]);
    if (
      kpiDefsOut.error ||
      kpiLogsOut.error ||
      participantsOut.error ||
      sponsoredOut.error ||
      adminAuditOut.error ||
      usersOut.error ||
      notificationOut.error
    ) {
      return res.status(500).json({ error: "Failed to compute policy summary" });
    }

    const kpiTypeById = new Map<string, string>(
      (kpiDefsOut.data ?? []).map((k) => [String(k.id), String(k.type)])
    );
    let gpVpWithPc = 0;
    let actualWithPc = 0;
    for (const log of kpiLogsOut.data ?? []) {
      const type = kpiTypeById.get(String(log.kpi_id));
      const pc = toNumberOrZero((log as { pc_generated?: unknown }).pc_generated);
      if ((type === "GP" || type === "VP") && pc !== 0) gpVpWithPc += 1;
      if (type === "Actual" && pc !== 0) actualWithPc += 1;
    }

    const sponsoredIds = new Set((sponsoredOut.data ?? []).map((row) => String(row.id)));
    let participantSponsoredLinkViolations = 0;
    for (const p of participantsOut.data ?? []) {
      const sponsoredId = String((p as { sponsored_challenge_id?: unknown }).sponsored_challenge_id ?? "");
      if (sponsoredId && !sponsoredIds.has(sponsoredId)) participantSponsoredLinkViolations += 1;
    }

    const userRoleById = new Map(
      (usersOut.data ?? []).map((u) => [String(u.id), String(u.role ?? "")])
    );
    let adminAuditByNonAdmin = 0;
    for (const row of adminAuditOut.data ?? []) {
      const role = userRoleById.get(String(row.admin_user_id)) ?? "";
      if (role !== "admin" && role !== "super_admin") adminAuditByNonAdmin += 1;
    }

    const nowMs = Date.now();
    let deactivatedWithRecentActivity = 0;
    for (const user of usersOut.data ?? []) {
      if (String(user.account_status) !== "deactivated") continue;
      const lastActivityMs = new Date(String(user.last_activity_timestamp ?? 0)).getTime();
      if (Number.isFinite(lastActivityMs) && nowMs - lastActivityMs < 7 * 24 * 60 * 60 * 1000) {
        deactivatedWithRecentActivity += 1;
      }
    }

    let failedNotificationsOverRetryThreshold = 0;
    for (const n of notificationOut.data ?? []) {
      if (String(n.status) === "failed" && toNumberOrZero((n as { attempts?: unknown }).attempts) >= 3) {
        failedNotificationsOverRetryThreshold += 1;
      }
    }

    return res.json({
      summary: {
        generated_at: new Date().toISOString(),
        checks: {
          gp_vp_logs_with_pc_generated: gpVpWithPc,
          actual_logs_with_pc_generated: actualWithPc,
          challenge_participants_with_invalid_sponsored_link: participantSponsoredLinkViolations,
          admin_activity_rows_by_non_admin_roles: adminAuditByNonAdmin,
          deactivated_users_with_recent_activity_7d: deactivatedWithRecentActivity,
          failed_notifications_over_retry_threshold: failedNotificationsOverRetryThreshold,
        },
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in /ops/summary/policy", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/teams", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const payloadCheck = validateTeamCreatePayload(req.body);
    if (!payloadCheck.ok) {
      return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    }

    await ensureUserRow(auth.user.id);

    const { data: team, error: teamError } = await dataClient
      .from("teams")
      .insert({
        name: payloadCheck.payload.name,
        created_by: auth.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id,name,created_by,created_at")
      .single();

    if (teamError) {
      return handleSupabaseError(res, "Failed to create team", teamError);
    }

    const { error: membershipError } = await dataClient
      .from("team_memberships")
      .insert({
        team_id: team.id,
        user_id: auth.user.id,
        role: "team_leader",
      });

    if (membershipError) {
      return handleSupabaseError(res, "Failed to create team leader membership", membershipError);
    }

    return res.status(201).json({ team });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in /teams", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/teams/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const teamId = req.params.id;
    if (!teamId) {
      return res.status(422).json({ error: "team id is required" });
    }

    const isMember = await checkTeamMembership(teamId, auth.user.id);
    if (!isMember.ok) {
      return res.status(isMember.status).json({ error: isMember.error });
    }
    if (!isMember.member) {
      return res.status(403).json({ error: "You are not a member of this team" });
    }

    const { data: team, error: teamError } = await dataClient
      .from("teams")
      .select("id,name,created_by,created_at,updated_at")
      .eq("id", teamId)
      .single();
    if (teamError) {
      return handleSupabaseError(res, "Failed to fetch team", teamError);
    }

    const { data: members, error: membersError } = await dataClient
      .from("team_memberships")
      .select("user_id,role,created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });
    if (membersError) {
      return handleSupabaseError(res, "Failed to fetch team members", membersError);
    }

    const memberUserIds = (members ?? [])
      .map((row) => String((row as { user_id?: unknown }).user_id ?? ""))
      .filter(Boolean);
    const memberProfileById = new Map<string, { full_name: string | null; avatar_url: string | null; email: string | null }>();
    if (memberUserIds.length > 0) {
      const { data: memberProfiles, error: memberProfilesError } = await dataClient
        .from("users")
        .select("id,full_name,avatar_url")
        .in("id", memberUserIds);
      if (memberProfilesError) {
        return handleSupabaseError(res, "Failed to fetch team member profiles", memberProfilesError);
      }
      for (const row of memberProfiles ?? []) {
        const id = String((row as { id?: unknown }).id ?? "");
        if (!id) continue;
        memberProfileById.set(id, {
          full_name: typeof (row as { full_name?: unknown }).full_name === "string"
            ? String((row as { full_name?: unknown }).full_name)
            : null,
          avatar_url: typeof (row as { avatar_url?: unknown }).avatar_url === "string"
            ? String((row as { avatar_url?: unknown }).avatar_url)
            : null,
          email: null,
        });
      }
    }

    return res.json({
      team,
      members: (members ?? []).map((row) => {
        const userId = String((row as { user_id?: unknown }).user_id ?? "");
        const profile = memberProfileById.get(userId);
        return {
          user_id: userId,
          role: String((row as { role?: unknown }).role ?? "member"),
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
          avatar_url: profile?.avatar_url ?? null,
          created_at: (row as { created_at?: unknown }).created_at ?? null,
        };
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /teams/:id", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/teams/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const teamId = req.params.id;
    if (!teamId) {
      return res.status(422).json({ error: "team id is required" });
    }

    const payloadCheck = validateTeamUpdatePayload(req.body);
    if (!payloadCheck.ok) {
      return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    }

    const leaderCheck = await checkTeamLeader(teamId, auth.user.id);
    if (!leaderCheck.ok) {
      return res.status(leaderCheck.status).json({ error: leaderCheck.error });
    }
    if (!leaderCheck.isLeader) {
      return res.status(403).json({ error: "Only team leaders can update team settings" });
    }

    const { data: team, error: updateError } = await dataClient
      .from("teams")
      .update({
        name: payloadCheck.payload.name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", teamId)
      .select("id,name,created_by,created_at,updated_at")
      .single();

    if (updateError) {
      return handleSupabaseError(res, "Failed to update team", updateError);
    }

    return res.json({ team });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PATCH /teams/:id", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/teams/:id/members", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const teamId = req.params.id;
    if (!teamId) {
      return res.status(422).json({ error: "team id is required" });
    }

    const payloadCheck = validateTeamMemberAddPayload(req.body);
    if (!payloadCheck.ok) {
      return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    }

    const leaderCheck = await checkTeamLeader(teamId, auth.user.id);
    if (!leaderCheck.ok) {
      return res.status(leaderCheck.status).json({ error: leaderCheck.error });
    }
    if (!leaderCheck.isLeader) {
      return res.status(403).json({ error: "Only team leaders can add members" });
    }

    await ensureUserRow(payloadCheck.payload.user_id);

    const { data: membership, error: membershipError } = await dataClient
      .from("team_memberships")
      .upsert(
        {
          team_id: teamId,
          user_id: payloadCheck.payload.user_id,
          role: payloadCheck.payload.role ?? "member",
        },
        { onConflict: "team_id,user_id" }
      )
      .select("team_id,user_id,role,created_at")
      .single();

    if (membershipError) {
      return handleSupabaseError(res, "Failed to add team member", membershipError);
    }

    return res.status(201).json({ membership });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /teams/:id/members", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/teams/:id/invite-codes", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }
    const teamId = req.params.id;
    if (!teamId) {
      return res.status(422).json({ error: "team id is required" });
    }
    const leaderCheck = await checkTeamLeader(teamId, auth.user.id);
    if (!leaderCheck.ok) {
      return res.status(leaderCheck.status).json({ error: leaderCheck.error });
    }
    if (!leaderCheck.isLeader) {
      return res.status(403).json({ error: "Only team leaders can create team invite codes" });
    }

    const maxUses = resolveInviteMaxUses("team", req.body);
    const expiresAt = resolveInviteExpiry(req.body);
    const invite = await issueInviteCode({
      inviteType: "team",
      targetId: teamId,
      createdBy: auth.user.id,
      maxUses,
      expiresAtIso: expiresAt,
    });
    if (!invite.ok) {
      return res.status(invite.status).json({ error: invite.error });
    }
    return res.status(201).json({
      invite_code: invite.record,
      route_target: { tab: "team", screen: "dashboard", target_id: teamId },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /teams/:id/invite-codes", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

type TeamMembershipCleanupSummary = {
  challenge_participants_removed: number;
  channel_memberships_removed: number;
};

async function removeUserFromTeamScopedRuntime(
  teamId: string,
  userId: string
): Promise<
  | { ok: true; summary: TeamMembershipCleanupSummary }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }
  const summary: TeamMembershipCleanupSummary = {
    challenge_participants_removed: 0,
    channel_memberships_removed: 0,
  };

  const { data: teamChallenges, error: teamChallengesError } = await dataClient
    .from("challenges")
    .select("id")
    .eq("team_id", teamId);
  if (teamChallengesError) {
    return { ok: false, status: 500, error: "Failed to load team challenges for membership cleanup" };
  }
  const challengeIds = (teamChallenges ?? [])
    .map((row) => String((row as { id?: unknown }).id ?? ""))
    .filter(Boolean);

  if (challengeIds.length > 0) {
    const { data: participantRows, error: participantRowsError } = await dataClient
      .from("challenge_participants")
      .select("id")
      .eq("user_id", userId)
      .in("challenge_id", challengeIds);
    if (participantRowsError) {
      return { ok: false, status: 500, error: "Failed to load team challenge participation rows for membership cleanup" };
    }
    if ((participantRows ?? []).length > 0) {
      const { error: participantDeleteError } = await dataClient
        .from("challenge_participants")
        .delete()
        .eq("user_id", userId)
        .in("challenge_id", challengeIds);
      if (participantDeleteError) {
        return { ok: false, status: 500, error: "Failed to remove team challenge participation rows during membership cleanup" };
      }
      summary.challenge_participants_removed = participantRows?.length ?? 0;
    }
  }

  const channelIdSet = new Set<string>();
  const { data: directTeamChannels, error: directTeamChannelsError } = await dataClient
    .from("channels")
    .select("id")
    .eq("team_id", teamId)
    .eq("is_active", true);
  if (directTeamChannelsError) {
    return { ok: false, status: 500, error: "Failed to load team channels for membership cleanup" };
  }
  for (const row of directTeamChannels ?? []) {
    const channelId = String((row as { id?: unknown }).id ?? "");
    if (channelId) channelIdSet.add(channelId);
  }

  if (challengeIds.length > 0) {
    const { data: challengeChannels, error: challengeChannelsError } = await dataClient
      .from("channels")
      .select("id")
      .eq("type", "challenge")
      .in("context_id", challengeIds)
      .eq("is_active", true);
    if (challengeChannelsError) {
      return { ok: false, status: 500, error: "Failed to load challenge channels for membership cleanup" };
    }
    for (const row of challengeChannels ?? []) {
      const channelId = String((row as { id?: unknown }).id ?? "");
      if (channelId) channelIdSet.add(channelId);
    }
  }

  const channelIds = Array.from(channelIdSet);
  if (channelIds.length > 0) {
    const { data: membershipRows, error: membershipRowsError } = await dataClient
      .from("channel_memberships")
      .select("id")
      .eq("user_id", userId)
      .in("channel_id", channelIds);
    if (membershipRowsError) {
      return { ok: false, status: 500, error: "Failed to load channel membership rows for cleanup" };
    }
    if ((membershipRows ?? []).length > 0) {
      const { error: membershipDeleteError } = await dataClient
        .from("channel_memberships")
        .delete()
        .eq("user_id", userId)
        .in("channel_id", channelIds);
      if (membershipDeleteError) {
        return { ok: false, status: 500, error: "Failed to remove channel memberships during team membership cleanup" };
      }
      summary.channel_memberships_removed = membershipRows?.length ?? 0;
    }
  }

  return { ok: true, summary };
}

app.post("/teams/:id/leave", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }
    const teamId = String(req.params.id ?? "").trim();
    if (!teamId) {
      return res.status(422).json({ error: "team id is required" });
    }

    const membershipCheck = await checkTeamMembership(teamId, auth.user.id);
    if (!membershipCheck.ok) {
      return res.status(membershipCheck.status).json({ error: membershipCheck.error });
    }
    if (!membershipCheck.member) {
      return res.status(404).json({ error: "Team membership not found" });
    }
    if (membershipCheck.role === "team_leader") {
      return res.status(403).json({ error: "Team leaders cannot leave directly. Transfer ownership or remove the team first." });
    }

    const { error: removeMembershipError } = await dataClient
      .from("team_memberships")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", auth.user.id);
    if (removeMembershipError) {
      return handleSupabaseError(res, "Failed to leave team", removeMembershipError);
    }

    const cleanup = await removeUserFromTeamScopedRuntime(teamId, auth.user.id);
    if (!cleanup.ok) {
      return res.status(cleanup.status).json({ error: cleanup.error });
    }

    return res.json({
      left: true,
      team_id: teamId,
      user_id: auth.user.id,
      cleanup: cleanup.summary,
      warning: {
        challenge_enrollment_removed: true,
        team_contribution_metrics_removed: true,
        custom_kpi_visibility_note: "Team custom KPI access is removed when leaving the team unless you have a qualifying paid plan.",
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /teams/:id/leave", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/teams/:id/members/:userId", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }
    const teamId = String(req.params.id ?? "").trim();
    const targetUserId = String(req.params.userId ?? "").trim();
    if (!teamId) {
      return res.status(422).json({ error: "team id is required" });
    }
    if (!targetUserId || !isUuidLike(targetUserId)) {
      return res.status(422).json({ error: "valid target user id is required" });
    }

    const leaderCheck = await checkTeamLeader(teamId, auth.user.id);
    if (!leaderCheck.ok) {
      return res.status(leaderCheck.status).json({ error: leaderCheck.error });
    }
    if (!leaderCheck.isLeader) {
      return res.status(403).json({ error: "Only team leaders can remove members" });
    }
    if (targetUserId === auth.user.id) {
      return res.status(422).json({ error: "Team leaders cannot remove themselves with this route" });
    }

    const targetMembership = await checkTeamMembership(teamId, targetUserId);
    if (!targetMembership.ok) {
      return res.status(targetMembership.status).json({ error: targetMembership.error });
    }
    if (!targetMembership.member) {
      return res.status(404).json({ error: "Target user is not a member of this team" });
    }
    if (targetMembership.role === "team_leader") {
      return res.status(403).json({ error: "Team leaders can only remove member-role users" });
    }

    const { error: removeMembershipError } = await dataClient
      .from("team_memberships")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", targetUserId);
    if (removeMembershipError) {
      return handleSupabaseError(res, "Failed to remove team member", removeMembershipError);
    }

    const cleanup = await removeUserFromTeamScopedRuntime(teamId, targetUserId);
    if (!cleanup.ok) {
      return res.status(cleanup.status).json({ error: cleanup.error });
    }

    return res.json({
      removed: true,
      team_id: teamId,
      removed_user_id: targetUserId,
      removed_by: auth.user.id,
      cleanup: cleanup.summary,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /teams/:id/members/:userId", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/coaching/invite-codes", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }
    await ensureUserRow(auth.user.id);
    const actorIsAdmin = await isPlatformAdmin(auth.user.id);
    const targetCoachId =
      isRecord(req.body) && typeof req.body.coach_id === "string" && req.body.coach_id.trim() && actorIsAdmin
        ? req.body.coach_id.trim()
        : auth.user.id;

    const { data: coachRow, error: coachRowError } = await dataClient
      .from("users")
      .select("id,is_coach")
      .eq("id", targetCoachId)
      .maybeSingle();
    if (coachRowError) {
      return handleSupabaseError(res, "Failed to load coach profile for invite code", coachRowError);
    }
    if (!coachRow || !Boolean((coachRow as { is_coach?: unknown }).is_coach)) {
      return res.status(403).json({ error: "Coach invite codes require coach role" });
    }
    if (targetCoachId !== auth.user.id && !actorIsAdmin) {
      return res.status(403).json({ error: "Only admins can create invite codes for another coach" });
    }

    const maxUses = resolveInviteMaxUses("coach", req.body);
    const expiresAt = resolveInviteExpiry(req.body);
    const invite = await issueInviteCode({
      inviteType: "coach",
      targetId: targetCoachId,
      createdBy: auth.user.id,
      maxUses,
      expiresAtIso: expiresAt,
    });
    if (!invite.ok) {
      return res.status(invite.status).json({ error: invite.error });
    }
    return res.status(201).json({
      invite_code: invite.record,
      route_target: { tab: "coach", screen: "coach_hub_primary", target_id: targetCoachId },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/invite-codes", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/coaching/journeys/:id/invite-code", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const journeyId = req.params.id;
    if (!journeyId) return res.status(422).json({ error: "journey id is required" });

    const { data: journey, error: journeyError } = await dataClient
      .from("journeys")
      .select("id,title,created_by")
      .eq("id", journeyId)
      .maybeSingle();
    if (journeyError) return handleSupabaseError(res, "Failed to load journey for invite code", journeyError);
    if (!journey) return res.status(404).json({ error: "Journey not found" });

    const createdBy = String((journey as { created_by?: unknown }).created_by ?? "");
    if (createdBy !== auth.user.id) {
      const actorIsAdmin = await isPlatformAdmin(auth.user.id);
      if (!actorIsAdmin) return res.status(403).json({ error: "Only the journey creator can generate invite codes" });
    }

    // Check for existing active invite code for this journey
    const { data: existing } = await dataClient
      .from("invite_codes")
      .select("id,code,invite_type,target_id,max_uses,uses_count,expires_at,is_active,created_at")
      .eq("invite_type", "journey")
      .eq("target_id", journeyId)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      return res.json({ invite_code: existing[0], reused: true });
    }

    const maxUses = resolveInviteMaxUses("journey", req.body);
    const expiresAt = resolveInviteExpiry(req.body);
    const invite = await issueInviteCode({
      inviteType: "journey",
      targetId: journeyId,
      createdBy: auth.user.id,
      maxUses,
      expiresAtIso: expiresAt,
    });
    if (!invite.ok) return res.status(invite.status).json({ error: invite.error });

    return res.status(201).json({
      invite_code: invite.record,
      reused: false,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/coaching/journeys/:id/invite-code", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/challenges/:id/invite-codes", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }
    const challengeId = req.params.id;
    if (!challengeId) {
      return res.status(422).json({ error: "challenge id is required" });
    }
    const { data: challenge, error: challengeError } = await dataClient
      .from("challenges")
      .select("id,team_id,created_by")
      .eq("id", challengeId)
      .maybeSingle();
    if (challengeError) {
      return handleSupabaseError(res, "Failed to load challenge for invite code", challengeError);
    }
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }
    const actorIsAdmin = await isPlatformAdmin(auth.user.id);
    const createdBy = String((challenge as { created_by?: unknown }).created_by ?? "");
    const teamId = String((challenge as { team_id?: unknown }).team_id ?? "");
    const isCreator = createdBy === auth.user.id;
    let isScopedTeamLeader = false;
    if (teamId) {
      const leaderCheck = await checkTeamLeader(teamId, auth.user.id);
      if (!leaderCheck.ok) {
        return res.status(leaderCheck.status).json({ error: leaderCheck.error });
      }
      isScopedTeamLeader = leaderCheck.isLeader;
    }
    if (!isCreator && !actorIsAdmin && !isScopedTeamLeader) {
      return res.status(403).json({ error: "Only challenge hosts or scoped team leaders can create challenge invite codes" });
    }

    const maxUses = resolveInviteMaxUses("challenge", req.body);
    const expiresAt = resolveInviteExpiry(req.body);
    const invite = await issueInviteCode({
      inviteType: "challenge",
      targetId: challengeId,
      createdBy: auth.user.id,
      maxUses,
      expiresAtIso: expiresAt,
    });
    if (!invite.ok) {
      return res.status(invite.status).json({ error: invite.error });
    }
    return res.status(201).json({
      invite_code: invite.record,
      route_target: { tab: "challenge", screen: "details", target_id: challengeId },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /challenges/:id/invite-codes", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/invites/redeem", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }
    if (!isRecord(req.body) || typeof req.body.code !== "string" || !req.body.code.trim()) {
      return res.status(422).json({ error: "code is required" });
    }
    const normalizedCode = normalizeInviteCodeInput(req.body.code);
    const { data: inviteRow, error: inviteError } = await dataClient
      .from("invite_codes")
      .select("id,code,invite_type,target_id,max_uses,uses_count,expires_at,is_active")
      .eq("code", normalizedCode)
      .maybeSingle();
    if (inviteError) {
      return handleSupabaseError(res, "Failed to lookup invite code", inviteError);
    }
    if (!inviteRow) {
      return res.status(404).json({ error: "Invite code not found" });
    }
    if (!Boolean((inviteRow as { is_active?: unknown }).is_active)) {
      return res.status(410).json({ error: "Invite code is inactive" });
    }
    const expiresAtIso = String((inviteRow as { expires_at?: unknown }).expires_at ?? "");
    if (expiresAtIso && new Date(expiresAtIso).getTime() < Date.now()) {
      return res.status(410).json({ error: "Invite code has expired" });
    }

    const inviteId = String((inviteRow as { id?: unknown }).id ?? "");
    const inviteType = String((inviteRow as { invite_type?: unknown }).invite_type ?? "") as "team" | "coach" | "challenge" | "journey";
    const targetId = String((inviteRow as { target_id?: unknown }).target_id ?? "");
    if (!inviteId || !targetId || !["team", "coach", "challenge", "journey"].includes(inviteType)) {
      return res.status(422).json({ error: "Invite code payload is invalid" });
    }

    const { data: existingRedemption, error: existingRedemptionError } = await dataClient
      .from("invite_code_redemptions")
      .select("id")
      .eq("invite_code_id", inviteId)
      .eq("redeemed_by", auth.user.id)
      .maybeSingle();
    if (existingRedemptionError) {
      return handleSupabaseError(res, "Failed to evaluate existing invite redemption", existingRedemptionError);
    }
    const alreadyRedeemedByCaller = Boolean(existingRedemption);
    const maxUses = Math.max(1, toNumberOrZero((inviteRow as { max_uses?: unknown }).max_uses));
    const usesCount = Math.max(0, toNumberOrZero((inviteRow as { uses_count?: unknown }).uses_count));
    if (!alreadyRedeemedByCaller && usesCount >= maxUses) {
      return res.status(410).json({ error: "Invite code has reached its use limit" });
    }

    let routeTarget: { tab: "team" | "coach" | "challenge"; screen: string; target_id: string } | { tab: "coach"; screen: "coaching_journey_detail"; target_id: string };
    let alreadyJoined = false;

    if (inviteType === "team") {
      const { data: teamRow, error: teamError } = await dataClient
        .from("teams")
        .select("id")
        .eq("id", targetId)
        .maybeSingle();
      if (teamError) return handleSupabaseError(res, "Failed to load team for invite redeem", teamError);
      if (!teamRow) return res.status(404).json({ error: "Team target not found for invite code" });

      const { data: membershipRow, error: membershipLookupError } = await dataClient
        .from("team_memberships")
        .select("id")
        .eq("team_id", targetId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (membershipLookupError) {
        return handleSupabaseError(res, "Failed to evaluate team membership for invite redeem", membershipLookupError);
      }
      alreadyJoined = Boolean(membershipRow);
      if (!alreadyJoined) {
        const { error: membershipInsertError } = await dataClient
          .from("team_memberships")
          .upsert(
            {
              team_id: targetId,
              user_id: auth.user.id,
              role: "member",
            },
            { onConflict: "team_id,user_id" }
          );
        if (membershipInsertError) {
          return handleSupabaseError(res, "Failed to join team from invite code", membershipInsertError);
        }
      }
      routeTarget = { tab: "team", screen: "dashboard", target_id: targetId };
    } else if (inviteType === "coach") {
      await ensureUserRow(auth.user.id);
      const { data: coachRow, error: coachError } = await dataClient
        .from("users")
        .select("id,is_coach")
        .eq("id", targetId)
        .maybeSingle();
      if (coachError) return handleSupabaseError(res, "Failed to load coach for invite redeem", coachError);
      if (!coachRow || !Boolean((coachRow as { is_coach?: unknown }).is_coach)) {
        return res.status(404).json({ error: "Coach target not found for invite code" });
      }
      const { data: existingEngagement, error: engagementLookupError } = await dataClient
        .from("coaching_engagements")
        .select("id,status")
        .eq("coach_id", targetId)
        .eq("client_id", auth.user.id)
        .in("status", ["pending", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (engagementLookupError) {
        return handleSupabaseError(res, "Failed to evaluate coaching engagement for invite redeem", engagementLookupError);
      }
      alreadyJoined = Boolean(existingEngagement);
      if (!alreadyJoined) {
        const { error: engagementInsertError } = await dataClient
          .from("coaching_engagements")
          .insert({
            coach_id: targetId,
            client_id: auth.user.id,
            status: "active",
            entitlement_state: "allowed",
            plan_tier_label: "Compass Coaching",
            status_reason: "Invite code redeemed",
            next_step_cta: "Open your coach hub",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (engagementInsertError) {
          return handleSupabaseError(res, "Failed to activate coaching engagement from invite code", engagementInsertError);
        }
      }
      routeTarget = { tab: "coach", screen: "coach_hub_primary", target_id: targetId };
    } else if (inviteType === "journey") {
      /* ── Journey invite: enroll user into the journey AND the coach's world ── */
      await ensureUserRow(auth.user.id);
      const { data: journeyRow, error: journeyError } = await dataClient
        .from("journeys")
        .select("id,created_by,is_active")
        .eq("id", targetId)
        .maybeSingle();
      if (journeyError) return handleSupabaseError(res, "Failed to load journey for invite redeem", journeyError);
      if (!journeyRow || !Boolean((journeyRow as { is_active?: unknown }).is_active)) {
        return res.status(404).json({ error: "Journey target not found for invite code" });
      }
      const journeyCoachId = String((journeyRow as { created_by?: unknown }).created_by ?? "");

      /* Step 1: ensure coaching_engagement with the journey's coach */
      if (journeyCoachId && journeyCoachId !== auth.user.id) {
        const { data: existingEngagement, error: engLookupErr } = await dataClient
          .from("coaching_engagements")
          .select("id,status")
          .eq("coach_id", journeyCoachId)
          .eq("client_id", auth.user.id)
          .in("status", ["pending", "active"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (engLookupErr) {
          return handleSupabaseError(res, "Failed to evaluate coaching engagement for journey invite", engLookupErr);
        }
        if (!existingEngagement) {
          const { error: engInsertErr } = await dataClient
            .from("coaching_engagements")
            .insert({
              coach_id: journeyCoachId,
              client_id: auth.user.id,
              status: "active",
              entitlement_state: "allowed",
              plan_tier_label: "Compass Coaching",
              status_reason: "Journey invite code redeemed",
              next_step_cta: "Open your coach hub",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          if (engInsertErr) {
            return handleSupabaseError(res, "Failed to activate coaching engagement from journey invite", engInsertErr);
          }
        }
      }

      /* Step 2: enroll into the journey */
      const { data: existingEnrollment, error: enrollLookupErr } = await dataClient
        .from("journey_enrollments")
        .select("id")
        .eq("journey_id", targetId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (enrollLookupErr) {
        return handleSupabaseError(res, "Failed to evaluate journey enrollment for invite redeem", enrollLookupErr);
      }
      alreadyJoined = Boolean(existingEnrollment);
      if (!alreadyJoined) {
        const { error: enrollInsertErr } = await dataClient
          .from("journey_enrollments")
          .upsert(
            {
              journey_id: targetId,
              user_id: auth.user.id,
              enrolled_by: journeyCoachId || null,
              enrolled_via: "invite",
              status: "active",
              enrolled_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
            { onConflict: "journey_id,user_id" }
          );
        if (enrollInsertErr) {
          return handleSupabaseError(res, "Failed to enroll user into journey from invite code", enrollInsertErr);
        }
      }
      routeTarget = { tab: "coach", screen: "coaching_journey_detail", target_id: targetId };
    } else {
      const { data: challenge, error: challengeError } = await dataClient
        .from("challenges")
        .select("id,mode,team_id,is_active,start_at,end_at,late_join_includes_history")
        .eq("id", targetId)
        .maybeSingle();
      if (challengeError) {
        return handleSupabaseError(res, "Failed to load challenge for invite redeem", challengeError);
      }
      if (!challenge || !Boolean((challenge as { is_active?: unknown }).is_active)) {
        return res.status(404).json({ error: "Challenge target not found for invite code" });
      }
      const nowIso = new Date().toISOString();
      const endAtIso = String((challenge as { end_at?: unknown }).end_at ?? "");
      if (endAtIso && endAtIso < nowIso) {
        return res.status(410).json({ error: "Challenge invite target has ended" });
      }
      const { data: userTierRow, error: userTierError } = await dataClient
        .from("users")
        .select("tier")
        .eq("id", auth.user.id)
        .single();
      if (userTierError) {
        return handleSupabaseError(res, "Failed to evaluate challenge participation policy", userTierError);
      }
      const userTier = normalizeTier((userTierRow as { tier?: unknown }).tier ?? "free");
      const userEntitlements = await loadTierEntitlements(userTier);
      const activeParticipationLimit = Math.max(1, toEntitlementNumber(userEntitlements, "active_challenge_participation_limit", 1));
      const { data: activeParticipationRows, error: activeParticipationError } = await dataClient
        .from("challenge_participants")
        .select("challenge_id,challenges!inner(id,is_active,end_at)")
        .eq("user_id", auth.user.id)
        .eq("challenges.is_active", true)
        .gte("challenges.end_at", nowIso);
      if (activeParticipationError) {
        return handleSupabaseError(res, "Failed to evaluate active challenge participation limit", activeParticipationError);
      }
      const activeChallengeIds = new Set(
        (activeParticipationRows ?? [])
          .map((row) => String((row as { challenge_id?: unknown }).challenge_id ?? ""))
          .filter(Boolean)
      );
      if (!activeChallengeIds.has(targetId) && activeChallengeIds.size >= activeParticipationLimit) {
        return res.status(403).json({ error: "User already has an active challenge; only one active participation is allowed" });
      }
      if (String((challenge as { mode?: unknown }).mode ?? "") === "team") {
        const challengeTeamId = String((challenge as { team_id?: unknown }).team_id ?? "");
        if (!challengeTeamId) {
          return res.status(422).json({ error: "Team challenge target is misconfigured" });
        }
        const memberCheck = await checkTeamMembership(challengeTeamId, auth.user.id);
        if (!memberCheck.ok) return res.status(memberCheck.status).json({ error: memberCheck.error });
        if (!memberCheck.member) {
          return res.status(403).json({ error: "User must be a team member to join this challenge" });
        }
      }

      const { data: existingParticipant, error: existingParticipantError } = await dataClient
        .from("challenge_participants")
        .select("id")
        .eq("challenge_id", targetId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (existingParticipantError) {
        return handleSupabaseError(res, "Failed to evaluate challenge enrollment for invite redeem", existingParticipantError);
      }
      alreadyJoined = Boolean(existingParticipant);
      if (!alreadyJoined) {
        const includePriorLogs = Boolean((challenge as { late_join_includes_history?: unknown }).late_join_includes_history);
        const startAtIso = String((challenge as { start_at?: unknown }).start_at ?? nowIso);
        const effectiveStartAt = includePriorLogs ? startAtIso : nowIso;
        const challengeTeamId = String((challenge as { team_id?: unknown }).team_id ?? "");
        const { error: participantError } = await dataClient
          .from("challenge_participants")
          .upsert(
            {
              challenge_id: targetId,
              user_id: auth.user.id,
              team_id: challengeTeamId || null,
              joined_at: nowIso,
              effective_start_at: effectiveStartAt,
              sponsored_challenge_id: null,
            },
            { onConflict: "challenge_id,user_id" }
          );
        if (participantError) {
          return handleSupabaseError(res, "Failed to join challenge from invite code", participantError);
        }
      }
      routeTarget = { tab: "challenge", screen: "details", target_id: targetId };
    }

    if (!alreadyRedeemedByCaller) {
      const { error: redemptionError } = await dataClient
        .from("invite_code_redemptions")
        .insert({
          invite_code_id: inviteId,
          redeemed_by: auth.user.id,
          redeemed_at: new Date().toISOString(),
        });
      if (redemptionError) {
        return handleSupabaseError(res, "Failed to store invite redemption record", redemptionError);
      }
      const { error: usageUpdateError } = await dataClient
        .from("invite_codes")
        .update({
          uses_count: usesCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", inviteId);
      if (usageUpdateError) {
        return handleSupabaseError(res, "Failed to update invite code usage count", usageUpdateError);
      }
    }

    return res.json({
      success: true,
      invite_type: inviteType,
      target_id: targetId,
      route_target: routeTarget,
      already_joined: alreadyJoined || alreadyRedeemedByCaller,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/invites/redeem", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/challenges", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const payloadCheck = validateChallengeCreatePayload(req.body);
    if (!payloadCheck.ok) {
      return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    }
    const payload = payloadCheck.payload;

    await ensureUserRow(auth.user.id);
    const { data: userRow, error: userError } = await dataClient
      .from("users")
      .select("tier")
      .eq("id", auth.user.id)
      .single();
    if (userError) {
      return handleSupabaseError(res, "Failed to load user tier", userError);
    }
    const tier = normalizeTier((userRow as { tier?: unknown }).tier);
    const entitlements = await loadTierEntitlements(tier);
    if (!toEntitlementBool(entitlements, "can_start_challenges", true)) {
      return res.status(403).json({ error: "Your plan cannot start challenges" });
    }

    const inviteLimit = toEntitlementNumber(entitlements, "challenge_invite_limit", -1);
    const requestedInviteCount = payload.invite_user_ids?.length ?? 0;
    if (inviteLimit >= 0 && requestedInviteCount > inviteLimit) {
      return res.status(403).json({ error: `Invite limit exceeded for your plan (max ${inviteLimit})` });
    }

    const nowIso = new Date().toISOString();
    if (payload.mode === "team") {
      if (!payload.team_id) {
        return res.status(422).json({ error: "team_id is required when mode=team" });
      }
      const leaderCheck = await checkTeamLeader(payload.team_id, auth.user.id);
      if (!leaderCheck.ok) {
        return res.status(leaderCheck.status).json({ error: leaderCheck.error });
      }
      if (!leaderCheck.isLeader) {
        return res.status(403).json({ error: "Only team leaders can host team challenges" });
      }
      if (!toEntitlementBool(entitlements, "can_host_team_challenges", false)) {
        return res.status(403).json({ error: "Your plan cannot host team challenges" });
      }
    } else {
      // Team leaders can host one active private cross-team challenge on Team plan.
      if (tier === "team") {
        const { data: leaderRows, error: leaderRowsError } = await dataClient
          .from("team_memberships")
          .select("id")
          .eq("user_id", auth.user.id)
          .eq("role", "team_leader")
          .limit(1);
        if (leaderRowsError) {
          return handleSupabaseError(res, "Failed to evaluate team leader scope", leaderRowsError);
        }
        if (!leaderRows || leaderRows.length === 0) {
          return res.status(403).json({ error: "Private cross-team challenge hosting requires team leader role" });
        }
        const privateLimit = toEntitlementNumber(entitlements, "team_private_cross_team_limit", 0);
        if (privateLimit >= 0) {
          const { count, error: countError } = await dataClient
            .from("challenges")
            .select("id", { count: "exact", head: true })
            .eq("created_by", auth.user.id)
            .is("team_id", null)
            .eq("is_active", true)
            .gte("end_at", nowIso);
          if (countError) {
            return handleSupabaseError(res, "Failed to enforce private challenge host limit", countError);
          }
          if (Number(count ?? 0) >= privateLimit) {
            return res.status(403).json({ error: "Team plan allows one active private cross-team challenge" });
          }
        }
      }
      if (tier === "coach" && !toEntitlementBool(entitlements, "coach_private_challenge_unlimited", false)) {
        return res.status(403).json({ error: "Coach private challenge hosting is not enabled for this plan" });
      }
    }

    const { data: challenge, error: challengeError } = await dataClient
      .from("challenges")
      .insert({
        template_id: payload.template_id ?? null,
        team_id: payload.mode === "team" ? payload.team_id ?? null : null,
        name: payload.name,
        description: payload.description ?? null,
        mode: payload.mode,
        is_active: true,
        start_at: payload.start_at ?? nowIso,
        end_at: payload.end_at,
        late_join_includes_history: Boolean(payload.late_join_includes_history),
        created_by: auth.user.id,
      })
      .select("id,name,description,mode,team_id,start_at,end_at,late_join_includes_history,is_active,created_by,created_at")
      .single();
    if (challengeError) {
      return handleSupabaseError(res, "Failed to create challenge", challengeError);
    }

    const challengeId = String((challenge as { id?: unknown }).id ?? "");
    if (!challengeId) {
      return res.status(500).json({ error: "Challenge id missing from create response" });
    }

    await dataClient
      .from("challenge_participants")
      .upsert(
        {
          challenge_id: challengeId,
          user_id: auth.user.id,
          team_id: payload.mode === "team" ? payload.team_id ?? null : null,
          joined_at: nowIso,
          effective_start_at: payload.start_at ?? nowIso,
          sponsored_challenge_id: null,
        },
        { onConflict: "challenge_id,user_id" }
      );

    return res.status(201).json({
      challenge,
      invite_policy: {
        invite_limit: inviteLimit,
        requested_invites: requestedInviteCount,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /challenges", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/challenges", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const nowIso = new Date().toISOString();
    const { data: challenges, error: challengesError } = await dataClient
      .from("challenges")
      .select("id,name,description,mode,team_id,start_at,end_at,late_join_includes_history,is_active,created_at")
      .eq("is_active", true)
      .gte("end_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(200);

    if (challengesError) {
      return handleSupabaseError(res, "Failed to fetch challenges", challengesError);
    }

    const challengeList = challenges ?? [];
    const challengeIds = challengeList.map((c) => String(c.id));

    let participationByChallenge = new Map<string, unknown>();
    if (challengeIds.length > 0) {
      const { data: myParticipations, error: myParticipationError } = await dataClient
        .from("challenge_participants")
        .select("challenge_id,user_id,joined_at,effective_start_at,progress_percent")
        .eq("user_id", auth.user.id)
        .in("challenge_id", challengeIds);

      if (myParticipationError) {
        return handleSupabaseError(res, "Failed to fetch user challenge participation", myParticipationError);
      }

      participationByChallenge = new Map(
        (myParticipations ?? []).map((p) => [String(p.challenge_id), p])
      );
    }

    const enriched = [];
    for (const challenge of challengeList) {
      const challengeId = String(challenge.id);
      const myParticipation = participationByChallenge.get(challengeId) as
        | { progress_percent?: number; challenge_id?: string; user_id?: string }
        | undefined;

      let refreshedParticipation = myParticipation ?? null;
      if (myParticipation) {
        const recalculatedProgress = await computeChallengeProgressPercent(challengeId, auth.user.id);
        await dataClient
          .from("challenge_participants")
          .update({ progress_percent: recalculatedProgress })
          .eq("challenge_id", challengeId)
          .eq("user_id", auth.user.id);
        refreshedParticipation = {
          ...myParticipation,
          progress_percent: recalculatedProgress,
        };
      }

      const leaderboard = await buildChallengeLeaderboard(String(challenge.id), 5);
      enriched.push({
        ...challenge,
        my_participation: refreshedParticipation,
        leaderboard_top: leaderboard,
      });
    }

    return res.json({ challenges: enriched });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in /challenges", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/sponsored-challenges", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    await ensureUserRow(auth.user.id);
    const { data: userRow, error: userError } = await dataClient
      .from("users")
      .select("tier,geo_city,geo_state")
      .eq("id", auth.user.id)
      .single();
    if (userError) return handleSupabaseError(res, "Failed to load user tier", userError);
    const userTier = String((userRow as { tier?: unknown }).tier ?? "free");
    const userGeoCity = (userRow as { geo_city?: unknown }).geo_city;
    const userGeoState = (userRow as { geo_state?: unknown }).geo_state;

    const nowIso = new Date().toISOString();
    const { data: rows, error } = await dataClient
      .from("sponsored_challenges")
      .select(
        "id,name,description,reward_text,cta_label,cta_url,disclaimer,required_tier,start_at,end_at,is_active,geo_scope,geo_target_values,sponsors(id,name,logo_url,brand_color,is_active)"
      )
      .eq("is_active", true)
      .lte("start_at", nowIso)
      .gte("end_at", nowIso)
      .order("start_at", { ascending: false });
    if (error) return handleSupabaseError(res, "Failed to fetch sponsored challenges", error);

    const challenges = (rows ?? [])
      .filter((row) => isTierAtLeast(userTier, String((row as { required_tier?: unknown }).required_tier ?? "free")))
      .filter((row) => Boolean((row as { sponsors?: { is_active?: unknown } }).sponsors?.is_active))
      .filter((row) =>
        isSponsoredChallengeGeoEligible({
          geoScope: (row as { geo_scope?: unknown }).geo_scope,
          geoTargetValues: (row as { geo_target_values?: unknown }).geo_target_values,
          userCity: userGeoCity,
          userState: userGeoState,
        })
      )
      .map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        reward_text: row.reward_text,
        cta_label: row.cta_label,
        cta_url: row.cta_url,
        disclaimer: row.disclaimer,
        required_tier: row.required_tier,
        start_at: row.start_at,
        end_at: row.end_at,
        geo_scope: (row as { geo_scope?: unknown }).geo_scope ?? "national",
        geo_target_values: (row as { geo_target_values?: unknown }).geo_target_values ?? [],
        sponsor: (row as { sponsors?: unknown }).sponsors ?? null,
        packaging_read_model: packagingReadModelForSponsoredChallenge(row as { id?: unknown; sponsors?: { id?: unknown } | null; disclaimer?: unknown }),
      }));

    return res.json({ sponsored_challenges: challenges });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /sponsored-challenges", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/sponsored-challenges/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    const sponsoredChallengeId = req.params.id;
    if (!sponsoredChallengeId) return res.status(422).json({ error: "sponsored challenge id is required" });

    await ensureUserRow(auth.user.id);
    const { data: userRow, error: userError } = await dataClient
      .from("users")
      .select("tier,geo_city,geo_state")
      .eq("id", auth.user.id)
      .single();
    if (userError) return handleSupabaseError(res, "Failed to load user tier", userError);
    const userTier = String((userRow as { tier?: unknown }).tier ?? "free");
    const userGeoCity = (userRow as { geo_city?: unknown }).geo_city;
    const userGeoState = (userRow as { geo_state?: unknown }).geo_state;

    const { data: row, error } = await dataClient
      .from("sponsored_challenges")
      .select(
        "id,name,description,reward_text,cta_label,cta_url,disclaimer,required_tier,start_at,end_at,is_active,geo_scope,geo_target_values,sponsors(id,name,logo_url,brand_color,is_active)"
      )
      .eq("id", sponsoredChallengeId)
      .single();
    if (error) return handleSupabaseError(res, "Failed to fetch sponsored challenge", error);

    const now = Date.now();
    const startMs = new Date(String((row as { start_at?: unknown }).start_at ?? "")).getTime();
    const endMs = new Date(String((row as { end_at?: unknown }).end_at ?? "")).getTime();
    const isActiveWindow = Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= now && endMs >= now;
    if (!Boolean(row.is_active) || !isActiveWindow) {
      return res.status(404).json({ error: "Sponsored challenge not available" });
    }
    if (!Boolean((row as { sponsors?: { is_active?: unknown } }).sponsors?.is_active)) {
      return res.status(404).json({ error: "Sponsored challenge not available" });
    }
    if (!isTierAtLeast(userTier, String((row as { required_tier?: unknown }).required_tier ?? "free"))) {
      return res.status(403).json({ error: "Your subscription tier does not have access to this sponsored challenge" });
    }
    if (
      !isSponsoredChallengeGeoEligible({
        geoScope: (row as { geo_scope?: unknown }).geo_scope,
        geoTargetValues: (row as { geo_target_values?: unknown }).geo_target_values,
        userCity: userGeoCity,
        userState: userGeoState,
      })
    ) {
      return res.status(403).json({ error: "Sponsored challenge is not available in your geography" });
    }

    return res.json({
      sponsored_challenge: {
        id: row.id,
        name: row.name,
        description: row.description,
        reward_text: row.reward_text,
        cta_label: row.cta_label,
        cta_url: row.cta_url,
        disclaimer: row.disclaimer,
        required_tier: row.required_tier,
        start_at: row.start_at,
        end_at: row.end_at,
        geo_scope: (row as { geo_scope?: unknown }).geo_scope ?? "national",
        geo_target_values: (row as { geo_target_values?: unknown }).geo_target_values ?? [],
        sponsor: (row as { sponsors?: unknown }).sponsors ?? null,
        packaging_read_model: packagingReadModelForSponsoredChallenge(row as { id?: unknown; sponsors?: { id?: unknown } | null; disclaimer?: unknown }),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /sponsored-challenges/:id", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/custom-kpis", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });

    await ensureUserRow(auth.user.id);
    const { data: rows, error } = await dataClient
      .from("kpis")
      .select("id,name,slug,type,requires_direct_value_input,is_active,created_by,created_at,updated_at")
      .eq("type", "Custom")
      .eq("created_by", auth.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) return handleSupabaseError(res, "Failed to fetch custom KPIs", error);
    return res.json({ custom_kpis: rows ?? [] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/custom-kpis", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/custom-kpis", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!isRecord(req.body) || typeof req.body.name !== "string" || !req.body.name.trim()) {
      return res.status(422).json({ error: "name is required" });
    }

    await ensureUserRow(auth.user.id);
    const { data: userRow, error: userError } = await dataClient
      .from("users")
      .select("tier")
      .eq("id", auth.user.id)
      .single();
    if (userError) return handleSupabaseError(res, "Failed to load user tier", userError);
    const entitlements = await loadTierEntitlements(normalizeTier((userRow as { tier?: unknown }).tier ?? "free"));
    if (!toEntitlementBool(entitlements, "can_create_custom_kpis", false)) {
      return res.status(403).json({ error: "Custom KPIs require Pro, Team, Coach, or Enterprise plan" });
    }

    const name = req.body.name.trim();
    const slugCandidate = typeof req.body.slug === "string" && req.body.slug.trim() ? req.body.slug.trim() : name;
    const slug = normalizeKpiIdentifier(slugCandidate);
    if (!slug) return res.status(422).json({ error: "name/slug must contain at least one alphanumeric character" });
    const requiresDirect =
      req.body.requires_direct_value_input === undefined ? true : Boolean(req.body.requires_direct_value_input);

    const { data, error } = await dataClient
      .from("kpis")
      .insert({
        name,
        slug,
        type: "Custom",
        requires_direct_value_input: requiresDirect,
        is_active: true,
        created_by: auth.user.id,
      })
      .select("id,name,slug,type,requires_direct_value_input,is_active,created_by,created_at,updated_at")
      .single();
    if (error) return handleSupabaseError(res, "Failed to create custom KPI", error);
    return res.status(201).json({ custom_kpi: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/custom-kpis", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/custom-kpis/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    const customKpiId = String(req.params.id ?? "").trim();
    if (!customKpiId) return res.status(422).json({ error: "custom KPI id is required" });
    if (!isRecord(req.body)) return res.status(400).json({ error: "Body must be a JSON object" });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== "string" || !req.body.name.trim()) {
        return res.status(422).json({ error: "name must be a non-empty string when provided" });
      }
      patch.name = req.body.name.trim();
    }
    if (req.body.slug !== undefined) {
      if (typeof req.body.slug !== "string" || !req.body.slug.trim()) {
        return res.status(422).json({ error: "slug must be a non-empty string when provided" });
      }
      const slug = normalizeKpiIdentifier(req.body.slug.trim());
      if (!slug) return res.status(422).json({ error: "slug must contain at least one alphanumeric character" });
      patch.slug = slug;
    }
    if (req.body.requires_direct_value_input !== undefined) {
      patch.requires_direct_value_input = Boolean(req.body.requires_direct_value_input);
    }
    if (Object.keys(patch).length === 1) {
      return res.status(422).json({ error: "At least one mutable field is required" });
    }

    const { data, error } = await dataClient
      .from("kpis")
      .update(patch)
      .eq("id", customKpiId)
      .eq("created_by", auth.user.id)
      .eq("type", "Custom")
      .select("id,name,slug,type,requires_direct_value_input,is_active,created_by,created_at,updated_at")
      .single();
    if (error) return handleSupabaseError(res, "Failed to update custom KPI", error);
    return res.json({ custom_kpi: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PUT /api/custom-kpis/:id", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/custom-kpis/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    const customKpiId = String(req.params.id ?? "").trim();
    if (!customKpiId) return res.status(422).json({ error: "custom KPI id is required" });

    const { error } = await dataClient
      .from("kpis")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", customKpiId)
      .eq("created_by", auth.user.id)
      .eq("type", "Custom");
    if (error) return handleSupabaseError(res, "Failed to archive custom KPI", error);
    return res.status(204).send();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /api/custom-kpis/:id", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/admin/kpis", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });

    const { data, error } = await dataClient
      .from("kpis")
      .select("id,name,slug,type,requires_direct_value_input,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,gp_value,vp_value,is_active,created_at,updated_at")
      .order("created_at", { ascending: true });
    if (error) return handleSupabaseError(res, "Failed to fetch KPI catalog", error);
    return res.json({ kpis: data ?? [] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /admin/kpis", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/admin/kpis", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });

    const payloadCheck = validateAdminKpiPayload(req.body, true);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });

    const { data, error } = await dataClient
      .from("kpis")
      .insert(payloadCheck.payload)
      .select("id,name,slug,type,requires_direct_value_input,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,gp_value,vp_value,is_active,created_at,updated_at")
      .single();
    if (error) return handleSupabaseError(res, "Failed to create KPI", error);

    await logAdminActivity(auth.user.id, "kpis", String(data.id), "create", payloadCheck.payload);
    return res.status(201).json({ kpi: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /admin/kpis", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/admin/kpis/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const kpiId = req.params.id;
    if (!kpiId) return res.status(422).json({ error: "kpi id is required" });

    const payloadCheck = validateAdminKpiPayload(req.body, false);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });

    const { data, error } = await dataClient
      .from("kpis")
      .update({ ...payloadCheck.payload, updated_at: new Date().toISOString() })
      .eq("id", kpiId)
      .select("id,name,slug,type,requires_direct_value_input,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,gp_value,vp_value,is_active,created_at,updated_at")
      .single();
    if (error) return handleSupabaseError(res, "Failed to update KPI", error);

    await logAdminActivity(auth.user.id, "kpis", kpiId, "update", payloadCheck.payload);
    return res.json({ kpi: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PUT /admin/kpis/:id", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/admin/kpis/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const kpiId = req.params.id;
    if (!kpiId) return res.status(422).json({ error: "kpi id is required" });

    const { data, error } = await dataClient
      .from("kpis")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", kpiId)
      .select("id,name,is_active")
      .single();
    if (error) return handleSupabaseError(res, "Failed to deactivate KPI", error);

    await logAdminActivity(auth.user.id, "kpis", kpiId, "deactivate", { is_active: false });
    return res.json({ kpi: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /admin/kpis/:id", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/admin/challenge-templates", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });

    const { data, error } = await dataClient
      .from("challenge_templates")
      .select("id,name,description,is_active,created_at,updated_at")
      .order("created_at", { ascending: true });
    if (error) return handleSupabaseError(res, "Failed to fetch challenge templates", error);
    return res.json({ challenge_templates: data ?? [] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /admin/challenge-templates", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/admin/challenge-templates", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });

    const payloadCheck = validateAdminChallengeTemplatePayload(req.body, true);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });

    const { data, error } = await dataClient
      .from("challenge_templates")
      .insert(payloadCheck.payload)
      .select("id,name,description,is_active,created_at,updated_at")
      .single();
    if (error) return handleSupabaseError(res, "Failed to create challenge template", error);

    await logAdminActivity(auth.user.id, "challenge_templates", String(data.id), "create", payloadCheck.payload);
    return res.status(201).json({ challenge_template: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /admin/challenge-templates", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/admin/challenge-templates/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const templateId = req.params.id;
    if (!templateId) return res.status(422).json({ error: "template id is required" });

    const payloadCheck = validateAdminChallengeTemplatePayload(req.body, false);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });

    const { data, error } = await dataClient
      .from("challenge_templates")
      .update({ ...payloadCheck.payload, updated_at: new Date().toISOString() })
      .eq("id", templateId)
      .select("id,name,description,is_active,created_at,updated_at")
      .single();
    if (error) return handleSupabaseError(res, "Failed to update challenge template", error);

    await logAdminActivity(auth.user.id, "challenge_templates", templateId, "update", payloadCheck.payload);
    return res.json({ challenge_template: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PUT /admin/challenge-templates/:id", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/admin/challenge-templates/:id", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const templateId = req.params.id;
    if (!templateId) return res.status(422).json({ error: "template id is required" });

    const { data, error } = await dataClient
      .from("challenge_templates")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", templateId)
      .select("id,name,is_active")
      .single();
    if (error) return handleSupabaseError(res, "Failed to deactivate challenge template", error);

    await logAdminActivity(auth.user.id, "challenge_templates", templateId, "deactivate", { is_active: false });
    return res.json({ challenge_template: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /admin/challenge-templates/:id", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/admin/users", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });

    const { data, error } = await dataClient
      .from("users")
      .select("id,role,tier,account_status,last_activity_timestamp,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return handleSupabaseError(res, "Failed to fetch users", error);

    const authUsersPage = await dataClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authUsersPage.error) return handleSupabaseError(res, "Failed to fetch auth user details", authUsersPage.error);
    const authById = new Map(
      (authUsersPage.data.users ?? []).map((u) => [
        String(u.id ?? ""),
        {
          email: u.email ?? null,
          name:
            (typeof u.user_metadata?.name === "string" && u.user_metadata.name) ||
            (typeof u.user_metadata?.full_name === "string" && u.user_metadata.full_name) ||
            null,
        },
      ])
    );

    return res.json({
      users: (data ?? []).map((row) => {
        const id = String((row as { id?: unknown }).id ?? "");
        const authMeta = authById.get(id);
        return {
          ...row,
          email: authMeta?.email ?? null,
          name: authMeta?.name ?? null,
        };
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /admin/users", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/admin/users", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });

    const body = req.body as {
      email?: unknown;
      password?: unknown;
      role?: unknown;
      tier?: unknown;
      account_status?: unknown;
    };

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "agent");
    const tier = String(body.tier ?? "free");
    const accountStatus = String(body.account_status ?? "active");

    if (!email || !email.includes("@")) {
      return res.status(422).json({ error: "email is required" });
    }
    if (!password || password.length < 8) {
      return res.status(422).json({ error: "password is required and must be at least 8 characters" });
    }
    if (!["agent", "team_leader", "admin", "super_admin"].includes(role)) {
      return res.status(422).json({ error: "role must be one of: agent, team_leader, admin, super_admin" });
    }
    if (!["free", "basic", "teams", "enterprise"].includes(tier)) {
      return res.status(422).json({ error: "tier must be one of: free, basic, teams, enterprise" });
    }
    if (!["active", "deactivated"].includes(accountStatus)) {
      return res.status(422).json({ error: "account_status must be one of: active, deactivated" });
    }

    const authCreate = await dataClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
      },
      app_metadata: {
        role,
        roles: [role],
      },
    });
    if (authCreate.error) return handleSupabaseError(res, "Failed to create auth user", authCreate.error);

    const createdUserId = String(authCreate.data.user?.id ?? "");
    if (!createdUserId) {
      return res.status(500).json({ error: "Auth user create returned no id" });
    }

    const nowIso = new Date().toISOString();
    const { data: userRow, error: userRowError } = await dataClient
      .from("users")
      .upsert(
        {
          id: createdUserId,
          role,
          tier,
          account_status: accountStatus,
          updated_at: nowIso,
        },
        { onConflict: "id" }
      )
      .select("id,role,tier,account_status,last_activity_timestamp,created_at,updated_at")
      .single();
    if (userRowError) return handleSupabaseError(res, "Failed to create user row", userRowError);

    await logAdminActivity(auth.user.id, "users", createdUserId, "create_user", {
      email,
      role,
      tier,
      account_status: accountStatus,
    });

    return res.status(201).json({
      user: userRow,
      email,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /admin/users", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/admin/users/:id/role", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const userId = req.params.id;
    if (!userId) return res.status(422).json({ error: "user id is required" });

    const body = req.body as { role?: unknown };
    const role = String(body.role ?? "");
    if (!["agent", "team_leader", "admin", "super_admin"].includes(role)) {
      return res.status(422).json({ error: "role must be one of: agent, team_leader, admin, super_admin" });
    }

    const { data, error } = await dataClient
      .from("users")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id,role,tier,account_status")
      .single();
    if (error) return handleSupabaseError(res, "Failed to update user role", error);

    await logAdminActivity(auth.user.id, "users", userId, "update_role", { role });
    return res.json({ user: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PUT /admin/users/:id/role", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/admin/users/:id/tier", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const userId = req.params.id;
    if (!userId) return res.status(422).json({ error: "user id is required" });

    const body = req.body as { tier?: unknown };
    const tier = String(body.tier ?? "");
    if (!["free", "basic", "teams", "enterprise"].includes(tier)) {
      return res.status(422).json({ error: "tier must be one of: free, basic, teams, enterprise" });
    }

    const { data, error } = await dataClient
      .from("users")
      .update({ tier, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id,role,tier,account_status")
      .single();
    if (error) return handleSupabaseError(res, "Failed to update user tier", error);

    await logAdminActivity(auth.user.id, "users", userId, "update_tier", { tier });
    return res.json({ user: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PUT /admin/users/:id/tier", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/admin/users/:id/status", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const userId = req.params.id;
    if (!userId) return res.status(422).json({ error: "user id is required" });

    const body = req.body as { account_status?: unknown };
    const accountStatus = String(body.account_status ?? "");
    if (!["active", "deactivated"].includes(accountStatus)) {
      return res.status(422).json({ error: "account_status must be one of: active, deactivated" });
    }

    const { data, error } = await dataClient
      .from("users")
      .update({ account_status: accountStatus, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id,role,tier,account_status")
      .single();
    if (error) return handleSupabaseError(res, "Failed to update user status", error);

    await logAdminActivity(auth.user.id, "users", userId, "update_status", { account_status: accountStatus });
    return res.json({ user: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PUT /admin/users/:id/status", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/admin/users/:id/kpi-calibration", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const userId = req.params.id;
    if (!userId) return res.status(422).json({ error: "user id is required" });

    const { data, error } = await dataClient
      .from("user_kpi_calibration")
      .select("user_id,kpi_id,multiplier,sample_size,rolling_error_ratio,rolling_abs_pct_error,last_calibrated_at,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) return handleSupabaseError(res, "Failed to fetch user KPI calibration", error);

    const kpiIds = (data ?? []).map((row) => String((row as { kpi_id?: unknown }).kpi_id ?? ""));
    const { data: kpis, error: kpiError } = kpiIds.length
      ? await dataClient.from("kpis").select("id,name,type").in("id", kpiIds)
      : { data: [], error: null };
    if (kpiError) return handleSupabaseError(res, "Failed to fetch KPI metadata for calibration", kpiError);
    const kpiById = new Map<string, { name: string; type: string }>(
      (kpis ?? []).map((row) => [
        String((row as { id?: unknown }).id ?? ""),
        {
          name: String((row as { name?: unknown }).name ?? ""),
          type: String((row as { type?: unknown }).type ?? ""),
        },
      ])
    );

    return res.json({
      user_id: userId,
      diagnostics: summarizeCalibrationDiagnostics(data ?? []),
      rows: (data ?? []).map((row) => {
        const kpiId = String((row as { kpi_id?: unknown }).kpi_id ?? "");
        const kpiMeta = kpiById.get(kpiId);
        return {
          ...row,
          kpi_name: kpiMeta?.name ?? null,
          kpi_type: kpiMeta?.type ?? null,
        };
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /admin/users/:id/kpi-calibration", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/admin/users/:id/kpi-calibration/:kpiId", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const userId = req.params.id;
    const kpiId = req.params.kpiId;
    if (!userId || !kpiId) return res.status(422).json({ error: "user id and kpi id are required" });

    const payloadCheck = validateAdminCalibrationUpdatePayload(req.body);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error });

    const nowIso = new Date().toISOString();
    const { data, error } = await dataClient
      .from("user_kpi_calibration")
      .upsert(
        {
          user_id: userId,
          kpi_id: kpiId,
          multiplier: payloadCheck.payload.multiplier,
          updated_at: nowIso,
        },
        { onConflict: "user_id,kpi_id" }
      )
      .select("user_id,kpi_id,multiplier,sample_size,rolling_error_ratio,rolling_abs_pct_error,last_calibrated_at,created_at,updated_at")
      .single();
    if (error) return handleSupabaseError(res, "Failed to update KPI calibration multiplier", error);

    await logAdminActivity(auth.user.id, "user_kpi_calibration", `${userId}:${kpiId}`, "manual_set_multiplier", payloadCheck.payload);
    return res.json({ row: data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in PATCH /admin/users/:id/kpi-calibration/:kpiId", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/admin/users/:id/kpi-calibration/reset", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const userId = req.params.id;
    if (!userId) return res.status(422).json({ error: "user id is required" });

    const nowIso = new Date().toISOString();
    const { data, error } = await dataClient
      .from("user_kpi_calibration")
      .update({
        multiplier: 1,
        sample_size: 0,
        rolling_error_ratio: null,
        rolling_abs_pct_error: null,
        last_calibrated_at: null,
        updated_at: nowIso,
      })
      .eq("user_id", userId)
      .select("user_id,kpi_id,multiplier,sample_size,rolling_error_ratio,rolling_abs_pct_error,last_calibrated_at,created_at,updated_at");
    if (error) return handleSupabaseError(res, "Failed to reset KPI calibration", error);

    await logAdminActivity(auth.user.id, "user_kpi_calibration", userId, "reset_all", {});
    return res.json({ user_id: userId, rows: data ?? [] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /admin/users/:id/kpi-calibration/reset", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/admin/users/:id/kpi-calibration/reinitialize-from-onboarding", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const userId = req.params.id;
    if (!userId) return res.status(422).json({ error: "user id is required" });

    const authUser = await dataClient.auth.admin.getUserById(userId);
    if (authUser.error) return handleSupabaseError(res, "Failed to fetch user auth metadata", authUser.error);
    const metadata = getUserMetadata(authUser.data?.user?.user_metadata ?? {});
    const selectedKpis = Array.isArray(metadata.selected_kpis)
      ? metadata.selected_kpis.filter((id): id is string => typeof id === "string")
      : [];
    const kpiWeeklyInputs = isRecord(metadata.kpi_weekly_inputs) ? metadata.kpi_weekly_inputs : {};
    if (selectedKpis.length === 0 || Object.keys(kpiWeeklyInputs).length === 0) {
      return res.status(422).json({ error: "User onboarding KPI history is missing; cannot reinitialize calibration" });
    }

    const { data: kpiRows, error: kpiError } = await dataClient
      .from("kpis")
      .select("id,type,pc_weight")
      .in("id", selectedKpis);
    if (kpiError) return handleSupabaseError(res, "Failed to fetch KPI definitions for calibration reinitialize", kpiError);

    const selectedPcKpiIds = (kpiRows ?? [])
      .filter((row) => String((row as { type?: unknown }).type) === "PC")
      .map((row) => String((row as { id?: unknown }).id ?? ""));
    const historicalWeeklyByKpi = Object.fromEntries(
      selectedPcKpiIds.map((kpiId) => [
        kpiId,
        toNumberOrZero((kpiWeeklyInputs[kpiId] as { historicalWeeklyAverage?: unknown } | undefined)?.historicalWeeklyAverage),
      ])
    );
    const baseWeightByKpi = Object.fromEntries(
      (kpiRows ?? [])
        .filter((row) => String((row as { type?: unknown }).type) === "PC")
        .map((row) => [
          String((row as { id?: unknown }).id ?? ""),
          toNumberOrZero((row as { pc_weight?: unknown }).pc_weight),
        ])
    );
    const multipliers = computeInitializationMultipliers({
      selectedPcKpiIds,
      historicalWeeklyByKpi,
      baseWeightByKpi,
    });

    const nowIso = new Date().toISOString();
    const upserts = selectedPcKpiIds.map((kpiId) => ({
      user_id: userId,
      kpi_id: kpiId,
      multiplier: multipliers[kpiId] ?? 1,
      sample_size: 0,
      rolling_error_ratio: null,
      rolling_abs_pct_error: null,
      last_calibrated_at: null,
      updated_at: nowIso,
    }));
    if (upserts.length > 0) {
      const { error: upsertError } = await dataClient
        .from("user_kpi_calibration")
        .upsert(upserts, { onConflict: "user_id,kpi_id" });
      if (upsertError) return handleSupabaseError(res, "Failed to reinitialize KPI calibration", upsertError);
    }

    await logAdminActivity(auth.user.id, "user_kpi_calibration", userId, "reinitialize_from_onboarding", {
      kpi_count: upserts.length,
    });
    return res.json({ user_id: userId, reinitialized_rows: upserts.length });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /admin/users/:id/kpi-calibration/reinitialize-from-onboarding", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/admin/users/:id/kpi-calibration/events", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (!dataClient) return res.status(500).json({ error: "Supabase data client not configured" });
    if (!(await isPlatformAdmin(auth.user.id))) return res.status(403).json({ error: "Admin access required" });
    const userId = req.params.id;
    if (!userId) return res.status(422).json({ error: "user id is required" });

    const { data, error } = await dataClient
      .from("user_kpi_calibration_events")
      .select("id,user_id,actual_log_id,close_timestamp,actual_gci,predicted_gci_window,error_ratio,attribution_payload,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return handleSupabaseError(res, "Failed to fetch KPI calibration events", error);

    return res.json({ user_id: userId, events: data ?? [] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /admin/users/:id/kpi-calibration/events", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/notifications/enqueue", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, auth.status, "auth_error", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    if (!(await isPlatformAdmin(auth.user.id))) {
      return errorEnvelopeResponse(res, 403, "forbidden", "Admin access required", req.headers["x-request-id"]);
    }

    const payloadCheck = validateNotificationEnqueuePayload(req.body);
    if (!payloadCheck.ok) {
      return errorEnvelopeResponse(res, payloadCheck.status, "validation_error", payloadCheck.error, req.headers["x-request-id"]);
    }
    await ensureUserRow(payloadCheck.payload.user_id);

    const { data, error } = await dataClient
      .from("notification_queue")
      .insert({
        user_id: payloadCheck.payload.user_id,
        category: payloadCheck.payload.category,
        title: payloadCheck.payload.title,
        body: payloadCheck.payload.body,
        payload: payloadCheck.payload.payload ?? {},
        scheduled_for: payloadCheck.payload.scheduled_for ?? new Date().toISOString(),
        created_by: auth.user.id,
        status: "queued",
        updated_at: new Date().toISOString(),
      })
      .select("id,user_id,category,title,body,payload,status,attempts,scheduled_for,sent_at,created_at,updated_at")
      .single();
    if (error) return errorEnvelopeResponse(res, 500, "notification_enqueue_failed", "Failed to enqueue notification", req.headers["x-request-id"]);

    await logAdminActivity(auth.user.id, "notification_queue", String(data.id), "enqueue", payloadCheck.payload);
    return res.status(201).json({
      notification: attachNotificationQueueReadModel(data as NotificationQueueRow),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/notifications/enqueue", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.get("/api/notifications/queue", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, auth.status, "auth_error", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    if (!(await isPlatformAdmin(auth.user.id))) {
      return errorEnvelopeResponse(res, 403, "forbidden", "Admin access required", req.headers["x-request-id"]);
    }

    const { data, error } = await dataClient
      .from("notification_queue")
      .select("id,user_id,category,title,body,payload,status,attempts,last_error,scheduled_for,sent_at,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return errorEnvelopeResponse(res, 500, "notification_queue_fetch_failed", "Failed to fetch notification queue", req.headers["x-request-id"]);

    const rows = (data ?? []) as NotificationQueueRow[];
    const notificationsWithReadModel = rows.map((row) => attachNotificationQueueReadModel(row));
    const queueNotificationItems = rows.map((row) => buildNotificationItemFromQueueRow(row));
    return res.json({
      notifications: notificationsWithReadModel,
      queue_summary: buildNotificationQueueSummary(rows),
      notification_items: queueNotificationItems,
      notification_summary_read_model: buildNotificationSummaryReadModel({
        items: queueNotificationItems,
        source_scope: "notifications_queue",
        read_model_status: "partial_in_family",
        notes: [
          "Admin queue notification items represent queue visibility rows, not member delivery confirmations",
        ],
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in GET /api/notifications/queue", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/api/notifications/:id/dispatch", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) return errorEnvelopeResponse(res, auth.status, "auth_error", auth.error, req.headers["x-request-id"]);
    if (!dataClient) return errorEnvelopeResponse(res, 500, "config_error", "Supabase data client not configured", req.headers["x-request-id"]);
    if (!(await isPlatformAdmin(auth.user.id))) {
      return errorEnvelopeResponse(res, 403, "forbidden", "Admin access required", req.headers["x-request-id"]);
    }
    const notificationId = req.params.id;
    if (!notificationId) {
      return errorEnvelopeResponse(res, 422, "validation_error", "notification id is required", req.headers["x-request-id"]);
    }

    const { data: existing, error: existingError } = await dataClient
      .from("notification_queue")
      .select("id,status,attempts")
      .eq("id", notificationId)
      .single();
    if (existingError) {
      return errorEnvelopeResponse(res, 404, "not_found", "Notification job not found", req.headers["x-request-id"]);
    }

    const body = req.body as { success?: unknown; provider_message_id?: unknown; error?: unknown };
    const success = body.success === undefined ? true : Boolean(body.success);
    const nextAttempts = toNumberOrZero(existing.attempts) + 1;
    const nowIso = new Date().toISOString();

    if (success) {
      const { data: updated, error: updateError } = await dataClient
        .from("notification_queue")
        .update({
          status: "sent",
          attempts: nextAttempts,
          last_error: null,
          sent_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", notificationId)
        .select("id,user_id,category,title,body,payload,status,attempts,last_error,scheduled_for,sent_at,created_at,updated_at")
        .single();
      if (updateError) {
        return errorEnvelopeResponse(res, 500, "notification_dispatch_failed", "Failed to update dispatch status", req.headers["x-request-id"]);
      }
      await logAdminActivity(auth.user.id, "notification_queue", notificationId, "dispatch_success", {
        attempts: nextAttempts,
        provider_message_id: body.provider_message_id ?? null,
      });
      return res.json({
        notification: attachNotificationQueueReadModel(updated as NotificationQueueRow),
      });
    }

    const lastError = typeof body.error === "string" && body.error.trim() ? body.error.trim() : "dispatch failed";
    const { data: updated, error: updateError } = await dataClient
      .from("notification_queue")
      .update({
        status: "failed",
        attempts: nextAttempts,
        last_error: lastError,
        updated_at: nowIso,
      })
      .eq("id", notificationId)
      .select("id,user_id,category,title,body,payload,status,attempts,last_error,scheduled_for,sent_at,created_at,updated_at")
      .single();
    if (updateError) {
      return errorEnvelopeResponse(res, 500, "notification_dispatch_failed", "Failed to update dispatch status", req.headers["x-request-id"]);
    }
    await logAdminActivity(auth.user.id, "notification_queue", notificationId, "dispatch_failure", {
      attempts: nextAttempts,
      error: lastError,
    });
    return res.json({
      notification: attachNotificationQueueReadModel(updated as NotificationQueueRow),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in POST /api/notifications/:id/dispatch", err);
    return errorEnvelopeResponse(res, 500, "internal_error", "Internal server error", req.headers["x-request-id"]);
  }
});

app.post("/challenge-participants", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const payloadCheck = validateChallengeJoinPayload(req.body);
    if (!payloadCheck.ok) {
      return res.status(payloadCheck.status).json({ error: payloadCheck.error });
    }
    const payload = payloadCheck.payload;
    if (payload.sponsored_challenge_id) {
      const nowIso = new Date().toISOString();
      const { data: sponsored, error: sponsoredError } = await dataClient
        .from("sponsored_challenges")
        .select("id,is_active,start_at,end_at,required_tier")
        .eq("id", payload.sponsored_challenge_id)
        .single();
      if (sponsoredError) {
        return handleSupabaseError(res, "Failed to fetch sponsored challenge", sponsoredError);
      }
      if (!sponsored || !Boolean(sponsored.is_active)) {
        return res.status(422).json({ error: "Sponsored challenge is not active" });
      }
      if (String(sponsored.start_at) > nowIso || String(sponsored.end_at) < nowIso) {
        return res.status(422).json({ error: "Sponsored challenge is outside its active window" });
      }
      await ensureUserRow(auth.user.id);
      const { data: userTierRow, error: tierError } = await dataClient
        .from("users")
        .select("tier")
        .eq("id", auth.user.id)
        .single();
      if (tierError) {
        return handleSupabaseError(res, "Failed to evaluate sponsored challenge tier access", tierError);
      }
      const userTier = String((userTierRow as { tier?: unknown }).tier ?? "free");
      if (!isTierAtLeast(userTier, String((sponsored as { required_tier?: unknown }).required_tier ?? "free"))) {
        return res.status(403).json({ error: "Your subscription tier does not have access to this sponsored challenge" });
      }
    }

    const { data: challenge, error: challengeError } = await dataClient
      .from("challenges")
      .select("id,mode,team_id,start_at,end_at,late_join_includes_history,is_active,created_by")
      .eq("id", payload.challenge_id)
      .single();
    if (challengeError) {
      return handleSupabaseError(res, "Failed to fetch challenge", challengeError);
    }
    if (!challenge?.is_active) {
      return res.status(422).json({ error: "Challenge is not active" });
    }

    const targetUserId = payload.user_id ?? auth.user.id;
    const actorIsEnrollingSomeoneElse = targetUserId !== auth.user.id;

    await ensureUserRow(targetUserId);
    const { data: targetTierRow, error: targetTierError } = await dataClient
      .from("users")
      .select("tier")
      .eq("id", targetUserId)
      .single();
    if (targetTierError) {
      return handleSupabaseError(res, "Failed to load target user tier", targetTierError);
    }
    const targetTier = normalizeTier((targetTierRow as { tier?: unknown }).tier ?? "free");
    const targetEntitlements = await loadTierEntitlements(targetTier);
    const activeParticipationLimit = Math.max(1, toEntitlementNumber(targetEntitlements, "active_challenge_participation_limit", 1));

    const nowIso = new Date().toISOString();
    const { data: activeParticipationRows, error: activeParticipationError } = await dataClient
      .from("challenge_participants")
      .select("challenge_id,challenges!inner(id,is_active,end_at)")
      .eq("user_id", targetUserId)
      .eq("challenges.is_active", true)
      .gte("challenges.end_at", nowIso);
    if (activeParticipationError) {
      return handleSupabaseError(res, "Failed to evaluate active challenge participation limits", activeParticipationError);
    }
    const activeChallengeIds = new Set(
      (activeParticipationRows ?? []).map((row) => String((row as { challenge_id?: unknown }).challenge_id ?? "")).filter(Boolean)
    );
    if (!activeChallengeIds.has(payload.challenge_id) && activeChallengeIds.size >= activeParticipationLimit) {
      return res.status(403).json({ error: "User already has an active challenge; only one active participation is allowed" });
    }

    if (actorIsEnrollingSomeoneElse) {
      if (!challenge.team_id) {
        return res.status(403).json({ error: "Leader enrollment requires team challenge context" });
      }
      const leaderCheck = await checkTeamLeader(String(challenge.team_id), auth.user.id);
      if (!leaderCheck.ok) {
        return res.status(leaderCheck.status).json({ error: leaderCheck.error });
      }
      if (!leaderCheck.isLeader) {
        return res.status(403).json({ error: "Only team leaders can enroll other users" });
      }
      const { data: actorTierRow, error: actorTierError } = await dataClient
        .from("users")
        .select("tier")
        .eq("id", auth.user.id)
        .single();
      if (actorTierError) {
        return handleSupabaseError(res, "Failed to evaluate inviter tier", actorTierError);
      }
      const actorTier = normalizeTier((actorTierRow as { tier?: unknown }).tier ?? "free");
      const actorEntitlements = await loadTierEntitlements(actorTier);
      const inviteLimit = toEntitlementNumber(actorEntitlements, "challenge_invite_limit", -1);
      if (inviteLimit >= 0) {
        const { count, error: inviteCountError } = await dataClient
          .from("challenge_participants")
          .select("id", { count: "exact", head: true })
          .eq("challenge_id", payload.challenge_id);
        if (inviteCountError) {
          return handleSupabaseError(res, "Failed to enforce invite limit", inviteCountError);
        }
        const existingParticipantCount = Math.max(0, Number(count ?? 0));
        const creatorId = String((challenge as { created_by?: unknown }).created_by ?? "");
        const nonCreatorCount = creatorId ? Math.max(0, existingParticipantCount - 1) : existingParticipantCount;
        if (!activeChallengeIds.has(payload.challenge_id) && nonCreatorCount >= inviteLimit) {
          return res.status(403).json({ error: `Invite cap reached for current host plan (max ${inviteLimit})` });
        }
      }
    }

    if (challenge.mode === "team") {
      if (!challenge.team_id) {
        return res.status(500).json({ error: "Team challenge missing team_id" });
      }
      const memberCheck = await checkTeamMembership(String(challenge.team_id), targetUserId);
      if (!memberCheck.ok) {
        return res.status(memberCheck.status).json({ error: memberCheck.error });
      }
      if (!memberCheck.member) {
        return res.status(403).json({ error: "User must be a team member to join this challenge" });
      }
    }

    const includeHistory = payload.include_prior_logs ?? Boolean(challenge.late_join_includes_history);
    const effectiveStartAt = includeHistory
      ? new Date(challenge.start_at).toISOString()
      : new Date().toISOString();

    const { data: participant, error: participantError } = await dataClient
      .from("challenge_participants")
      .upsert(
        {
          challenge_id: payload.challenge_id,
          user_id: targetUserId,
          team_id: challenge.team_id ?? null,
          joined_at: new Date().toISOString(),
          effective_start_at: effectiveStartAt,
          sponsored_challenge_id: payload.sponsored_challenge_id ?? null,
        },
        { onConflict: "challenge_id,user_id" }
      )
      .select("id,challenge_id,user_id,team_id,joined_at,effective_start_at,progress_percent")
      .single();
    if (participantError) {
      return handleSupabaseError(res, "Failed to join challenge", participantError);
    }

    const progressPercent = await computeChallengeProgressPercent(payload.challenge_id, targetUserId);

    const { data: updatedParticipant, error: updateParticipantError } = await dataClient
      .from("challenge_participants")
      .update({ progress_percent: progressPercent })
      .eq("id", participant.id)
      .select("id,challenge_id,user_id,team_id,joined_at,effective_start_at,progress_percent")
      .single();
    if (updateParticipantError) {
      return handleSupabaseError(res, "Failed to update participant progress", updateParticipantError);
    }

    const leaderboard = await buildChallengeLeaderboard(payload.challenge_id, 5);

    return res.status(201).json({
      participant: updatedParticipant,
      leaderboard_top: leaderboard,
      late_join_policy: {
        include_prior_logs: includeHistory,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in /challenge-participants", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/challenge-participants/:challengeId", async (req, res) => {
  try {
    const auth = await authenticateRequest(req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }
    if (!dataClient) {
      return res.status(500).json({ error: "Supabase data client not configured" });
    }

    const challengeId = String(req.params.challengeId ?? "").trim();
    if (!challengeId) {
      return res.status(422).json({ error: "challenge id is required" });
    }

    const { data: existingRows, error: existingError } = await dataClient
      .from("challenge_participants")
      .select("id,challenge_id,user_id")
      .eq("challenge_id", challengeId)
      .eq("user_id", auth.user.id)
      .order("joined_at", { ascending: false });
    if (existingError) {
      return handleSupabaseError(res, "Failed to load challenge participation", existingError);
    }
    if (!existingRows || existingRows.length === 0) {
      return res.status(404).json({ error: "Challenge participation not found" });
    }

    const { error: deleteError } = await dataClient
      .from("challenge_participants")
      .delete()
      .eq("challenge_id", challengeId)
      .eq("user_id", auth.user.id);
    if (deleteError) {
      return handleSupabaseError(res, "Failed to leave challenge", deleteError);
    }

    return res.json({
      left: true,
      challenge_id: challengeId,
      user_id: auth.user.id,
      deleted_count: existingRows.length,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error in DELETE /challenge-participants/:challengeId", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function authenticateRequest(authorizationHeader?: string): Promise<
  | { ok: true; user: AuthUser }
  | { ok: false; status: number; error: string }
> {
  if (!authClient) {
    return { ok: false, status: 500, error: "Supabase auth client not configured" };
  }

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing or invalid Authorization header" };
  }

  const token = authorizationHeader.replace("Bearer ", "").trim();
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) {
    return { ok: false, status: 401, error: "Invalid or expired token" };
  }

  return {
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseBackplotInput(value: unknown): { historicalWeeklyAverage: number; targetWeeklyCount: number } | null {
  if (!isRecord(value)) return null;
  const historicalWeeklyAverage = toNumberOrZero(value.historicalWeeklyAverage);
  const targetWeeklyCount = toNumberOrZero(value.targetWeeklyCount);
  return {
    historicalWeeklyAverage: Math.max(0, historicalWeeklyAverage),
    targetWeeklyCount: Math.max(0, targetWeeklyCount),
  };
}

function normalizeKpiIdentifier(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const LEGACY_KPI_IDENTIFIER_ALIASES: Record<string, string> = {
  coffee_lunch_sphere: "coffee_lunch_with_sphere",
  good_night_sleep: "good_night_of_sleep",
};

async function resolveKpiSelectionIds(rawIdentifiers: string[]): Promise<
  | { ok: true; ids: string[]; by_input: Record<string, string> }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }
  const candidates = Array.from(
    new Set(
      rawIdentifiers
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
  if (candidates.length === 0) {
    return { ok: true, ids: [], by_input: {} };
  }

  const { data: rows, error } = await dataClient
    .from("kpis")
    .select("id,name,slug,is_active");
  if (error) {
    return { ok: false, status: 500, error: "Failed to resolve KPI identifiers" };
  }

  const byId = new Map<string, string>();
  const bySlug = new Map<string, string>();
  const byNameKey = new Map<string, string>();
  for (const row of rows ?? []) {
    if (!Boolean((row as { is_active?: unknown }).is_active)) continue;
    const id = String((row as { id?: unknown }).id ?? "");
    if (!id) continue;
    byId.set(id, id);
    const slug = String((row as { slug?: unknown }).slug ?? "").trim();
    if (slug) bySlug.set(slug, id);
    const name = String((row as { name?: unknown }).name ?? "").trim();
    if (name) byNameKey.set(normalizeKpiIdentifier(name), id);
  }

  const resolved: string[] = [];
  const resolvedByInput: Record<string, string> = {};
  for (const raw of candidates) {
    const normalized = normalizeKpiIdentifier(raw);
    const aliasNormalized = LEGACY_KPI_IDENTIFIER_ALIASES[normalized];
    const found =
      byId.get(raw) ??
      bySlug.get(normalized) ??
      (aliasNormalized ? bySlug.get(aliasNormalized) : undefined) ??
      byNameKey.get(normalized);
    if (found) {
      resolved.push(found);
      resolvedByInput[raw] = found;
      resolvedByInput[normalized] = found;
      if (aliasNormalized) resolvedByInput[aliasNormalized] = found;
    }
  }

  return { ok: true, ids: Array.from(new Set(resolved)), by_input: resolvedByInput };
}

function getUserMetadata(value: unknown): UserMetadata {
  if (!isRecord(value)) return {};
  const selected =
    Array.isArray(value.selected_kpis) ? value.selected_kpis.filter((v): v is string => typeof v === "string") : undefined;
  const kpiWeekly = isRecord(value.kpi_weekly_inputs)
    ? Object.fromEntries(
        Object.entries(value.kpi_weekly_inputs).map(([k, v]) => {
          const row = isRecord(v) ? v : {};
          return [
            k,
            {
              historicalWeeklyAverage: toNumberOrZero(row.historicalWeeklyAverage),
              targetWeeklyCount: toNumberOrZero(row.targetWeeklyCount),
            },
          ];
        })
      )
    : undefined;

  return {
    selected_kpis: selected,
    kpi_weekly_inputs: kpiWeekly,
    average_price_point: value.average_price_point !== undefined ? toNumberOrZero(value.average_price_point) : undefined,
    commission_rate_percent:
      value.commission_rate_percent !== undefined ? toNumberOrZero(value.commission_rate_percent) : undefined,
    commission_rate_decimal:
      value.commission_rate_decimal !== undefined ? toNumberOrZero(value.commission_rate_decimal) : undefined,
    last_year_gci: value.last_year_gci !== undefined ? toNumberOrZero(value.last_year_gci) : undefined,
    ytd_gci: value.ytd_gci !== undefined ? toNumberOrZero(value.ytd_gci) : undefined,
    last_activity_timestamp: typeof value.last_activity_timestamp === "string" ? value.last_activity_timestamp : undefined,
    pipeline_listings_pending:
      value.pipeline_listings_pending !== undefined ? toNumberOrZero(value.pipeline_listings_pending) : undefined,
    pipeline_buyers_uc:
      value.pipeline_buyers_uc !== undefined ? toNumberOrZero(value.pipeline_buyers_uc) : undefined,
    onboarding_projection_seeded_at:
      typeof value.onboarding_projection_seeded_at === "string" ? value.onboarding_projection_seeded_at : undefined,
  };
}

function getLastActivityTimestampFromLogsOrMetadata(
  logs: Array<{ event_timestamp?: unknown }>,
  metadataTs?: string
): string | undefined {
  const fromLogs = logs
    .map((row) => String(row.event_timestamp ?? ""))
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  if (fromLogs) return fromLogs;
  if (metadataTs && !Number.isNaN(new Date(metadataTs).getTime())) return metadataTs;
  return undefined;
}

async function maybeSeedInitialProjectionFromOnboarding(
  userId: string,
  mergedMetadata: Record<string, unknown>
): Promise<
  | { ok: true; mergedMetadata: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }

  const metadata = getUserMetadata(mergedMetadata);
  if (metadata.onboarding_projection_seeded_at) {
    return { ok: true, mergedMetadata };
  }

  const selectedResolution = await resolveKpiSelectionIds(
    Array.isArray(metadata.selected_kpis)
      ? metadata.selected_kpis.filter((id): id is string => typeof id === "string")
      : []
  );
  if (!selectedResolution.ok) {
    return selectedResolution;
  }
  const selectedKpis = selectedResolution.ids;
  const rawWeeklyInputs = isRecord(metadata.kpi_weekly_inputs) ? metadata.kpi_weekly_inputs : {};
  const kpiWeeklyInputs: Record<string, { historicalWeeklyAverage: number; targetWeeklyCount: number }> = {};
  for (const [rawKey, value] of Object.entries(rawWeeklyInputs)) {
    const mappedId = selectedResolution.by_input[rawKey] ?? selectedResolution.by_input[normalizeKpiIdentifier(rawKey)];
    const parsed = parseBackplotInput(value);
    if (mappedId && parsed) kpiWeeklyInputs[mappedId] = parsed;
  }
  if (selectedKpis.length === 0 || Object.keys(kpiWeeklyInputs).length === 0) {
    return { ok: true, mergedMetadata };
  }

  const averagePricePoint = toNumberOrZero(metadata.average_price_point);
  const commissionRateDecimal =
    metadata.commission_rate_percent !== undefined
      ? toNumberOrZero(metadata.commission_rate_percent) / 100
      : toNumberOrZero(metadata.commission_rate_decimal);
  if (averagePricePoint <= 0 || commissionRateDecimal <= 0) {
    return { ok: true, mergedMetadata };
  }

  const { data: kpiRows, error: kpiError } = await dataClient
    .from("kpis")
    .select("id,type,name,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,is_active")
    .in("id", selectedKpis);
  if (kpiError) {
    return { ok: false, status: 500, error: "Failed to load KPI definitions for onboarding projection seed" };
  }

  const pcConfigById = Object.fromEntries(
    (kpiRows ?? [])
      .filter((row) => String((row as { type?: unknown }).type) === "PC")
      .filter((row) => Boolean((row as { is_active?: unknown }).is_active))
      .map((row) => [
        String((row as { id?: unknown }).id),
        {
          pc_weight: toNumberOrZero((row as { pc_weight?: unknown }).pc_weight),
          ttc_days: toNumberOrZero((row as { ttc_days?: unknown }).ttc_days),
          ttc_definition:
            typeof (row as { ttc_definition?: unknown }).ttc_definition === "string"
              ? String((row as { ttc_definition?: unknown }).ttc_definition)
              : null,
          delay_days: toNumberOrZero((row as { delay_days?: unknown }).delay_days),
          hold_days: toNumberOrZero((row as { hold_days?: unknown }).hold_days),
          decay_days: Math.max(1, toNumberOrZero((row as { decay_days?: unknown }).decay_days) || 180),
        },
      ])
  );

  const syntheticEvents = buildOnboardingBackplotPcEvents({
    now: new Date(),
    averagePricePoint,
    commissionRateDecimal,
    selectedKpiIds: selectedKpis,
    kpiWeeklyInputs,
    kpiPcConfigById: pcConfigById,
  });

  const selectedPcKpiIds = selectedKpis.filter((id) => !!pcConfigById[id]);
  const historicalWeeklyByKpi = Object.fromEntries(
    selectedPcKpiIds.map((kpiId) => [
      kpiId,
      toNumberOrZero((kpiWeeklyInputs[kpiId] as { historicalWeeklyAverage?: unknown } | undefined)?.historicalWeeklyAverage),
    ])
  );
  const baseWeightByKpi = Object.fromEntries(
    selectedPcKpiIds.map((kpiId) => [kpiId, toNumberOrZero(pcConfigById[kpiId]?.pc_weight)])
  );
  const initializationMultipliers = computeInitializationMultipliers({
    selectedPcKpiIds,
    historicalWeeklyByKpi,
    baseWeightByKpi,
  });

  if (syntheticEvents.length > 0) {
    const logsToInsert = syntheticEvents.map((event) => {
      const eventTime = new Date(event.eventTimestampIso);
      const payoffStartDate = addDays(eventTime, event.delayBeforePayoffStartsDays);
      const ttcEndDate = addDays(eventTime, event.delayBeforePayoffStartsDays + event.holdDurationDays);
      const decayEndDate = addDays(ttcEndDate, event.decayDurationDays);
      const weeklyInput = kpiWeeklyInputs[event.kpiId];
      const idempotencyKey = `onboarding_seed:${userId}:${event.kpiId}:${event.eventTimestampIso.slice(0, 10)}`;
      return {
        user_id: userId,
        kpi_id: event.kpiId,
        event_timestamp: event.eventTimestampIso,
        logged_value: toNumberOrZero(weeklyInput?.historicalWeeklyAverage),
        idempotency_key: idempotencyKey,
        pc_generated: Number(event.initialPcGenerated.toFixed(2)),
        payoff_start_date: payoffStartDate.toISOString(),
        ttc_end_date: ttcEndDate.toISOString(),
        decay_end_date: decayEndDate.toISOString(),
        delay_days_applied: event.delayBeforePayoffStartsDays,
        hold_days_applied: event.holdDurationDays,
        decay_days_applied: event.decayDurationDays,
        points_generated: 0,
        actual_gci_delta: 0,
        deals_closed_delta: 0,
        created_at: new Date().toISOString(),
      };
    });
    const { error: seedLogError } = await dataClient
      .from("kpi_logs")
      .upsert(logsToInsert, { onConflict: "user_id,idempotency_key" });
    if (seedLogError) {
      return { ok: false, status: 500, error: "Failed to seed onboarding projection logs" };
    }
  }

  if (selectedPcKpiIds.length > 0) {
    const calibrationRows = selectedPcKpiIds.map((kpiId) => ({
      user_id: userId,
      kpi_id: kpiId,
      multiplier: initializationMultipliers[kpiId] ?? 1,
      sample_size: 0,
      rolling_error_ratio: null,
      rolling_abs_pct_error: null,
      last_calibrated_at: null,
      updated_at: new Date().toISOString(),
    }));
    const { error: calibrationSeedError } = await dataClient
      .from("user_kpi_calibration")
      .upsert(calibrationRows, { onConflict: "user_id,kpi_id" });
    if (calibrationSeedError) {
      return { ok: false, status: 500, error: "Failed to initialize onboarding KPI calibration state" };
    }
  }

  const pipelineListings = toNumberOrZero(metadata.pipeline_listings_pending);
  const pipelineBuyers = toNumberOrZero(metadata.pipeline_buyers_uc);
  if (pipelineListings > 0 || pipelineBuyers > 0) {
    const { data: anchorKpis, error: anchorKpiError } = await dataClient
      .from("kpis")
      .select("id,name,type,is_active")
      .eq("type", "Pipeline_Anchor")
      .eq("is_active", true);
    if (anchorKpiError) {
      return { ok: false, status: 500, error: "Failed to load pipeline anchor KPIs for onboarding seed" };
    }
    const safeAnchors = anchorKpis ?? [];
    const listingsKpi = safeAnchors.find((row) => String((row as { name?: unknown }).name).toLowerCase().includes("listing"));
    const buyersKpi = safeAnchors.find((row) => String((row as { name?: unknown }).name).toLowerCase().includes("buyer"));

    const nowIso = new Date().toISOString();
    const anchorUpserts: Array<Record<string, unknown>> = [];
    if (listingsKpi && pipelineListings >= 0) {
      anchorUpserts.push({
        user_id: userId,
        kpi_id: String((listingsKpi as { id?: unknown }).id),
        anchor_type: String((listingsKpi as { name?: unknown }).name ?? "Listings Pending"),
        anchor_value: pipelineListings,
        updated_at: nowIso,
      });
    }
    if (buyersKpi && pipelineBuyers >= 0) {
      anchorUpserts.push({
        user_id: userId,
        kpi_id: String((buyersKpi as { id?: unknown }).id),
        anchor_type: String((buyersKpi as { name?: unknown }).name ?? "Buyers UC"),
        anchor_value: pipelineBuyers,
        updated_at: nowIso,
      });
    }
    if (anchorUpserts.length > 0) {
      const { error: anchorUpsertError } = await dataClient
        .from("pipeline_anchor_status")
        .upsert(anchorUpserts, { onConflict: "user_id,kpi_id" });
      if (anchorUpsertError) {
        return { ok: false, status: 500, error: "Failed to seed onboarding pipeline anchors" };
      }
    }
  }

  return {
    ok: true,
    mergedMetadata: {
      ...mergedMetadata,
      onboarding_projection_seeded_at: new Date().toISOString(),
    },
  };
}

function validateTeamCreatePayload(body: unknown):
  | { ok: true; payload: TeamCreatePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<TeamCreatePayload>;
  if (!candidate.name || typeof candidate.name !== "string") {
    return { ok: false, status: 422, error: "name is required" };
  }
  const name = candidate.name.trim();
  if (!name) {
    return { ok: false, status: 422, error: "name must not be empty" };
  }
  return { ok: true, payload: { name } };
}

function validateTeamUpdatePayload(body: unknown):
  | { ok: true; payload: TeamUpdatePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<TeamUpdatePayload>;
  if (!candidate.name || typeof candidate.name !== "string") {
    return { ok: false, status: 422, error: "name is required" };
  }
  const name = candidate.name.trim();
  if (!name) {
    return { ok: false, status: 422, error: "name must not be empty" };
  }
  if (name.length > 80) {
    return { ok: false, status: 422, error: "name must be 80 characters or fewer" };
  }
  return { ok: true, payload: { name } };
}

function validateTeamMemberAddPayload(body: unknown):
  | { ok: true; payload: TeamMemberAddPayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<TeamMemberAddPayload>;
  if (!candidate.user_id || typeof candidate.user_id !== "string") {
    return { ok: false, status: 422, error: "user_id is required" };
  }
  if (
    candidate.role !== undefined &&
    candidate.role !== "member" &&
    candidate.role !== "team_leader"
  ) {
    return { ok: false, status: 422, error: "role must be one of: member, team_leader" };
  }
  return {
    ok: true,
    payload: { user_id: candidate.user_id, role: candidate.role },
  };
}

function validateChallengeCreatePayload(body: unknown):
  | { ok: true; payload: ChallengeCreatePayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, status: 422, error: "name is required" };
  const mode = body.mode === "team" ? "team" : body.mode === "solo" ? "solo" : null;
  if (!mode) return { ok: false, status: 422, error: "mode must be one of: solo, team" };
  const endAtRaw = typeof body.end_at === "string" ? body.end_at.trim() : "";
  if (!endAtRaw) return { ok: false, status: 422, error: "end_at is required" };
  const endAt = new Date(endAtRaw);
  if (Number.isNaN(endAt.getTime())) return { ok: false, status: 422, error: "end_at must be a valid ISO date" };
  const startAtRaw = typeof body.start_at === "string" ? body.start_at.trim() : "";
  const startAt = startAtRaw ? new Date(startAtRaw) : new Date();
  if (Number.isNaN(startAt.getTime())) return { ok: false, status: 422, error: "start_at must be a valid ISO date when provided" };
  if (endAt.getTime() <= startAt.getTime()) {
    return { ok: false, status: 422, error: "end_at must be later than start_at" };
  }
  if (mode === "team" && (typeof body.team_id !== "string" || !body.team_id.trim())) {
    return { ok: false, status: 422, error: "team_id is required when mode=team" };
  }
  if (body.description !== undefined && typeof body.description !== "string") {
    return { ok: false, status: 422, error: "description must be a string when provided" };
  }
  if (body.template_id !== undefined && typeof body.template_id !== "string") {
    return { ok: false, status: 422, error: "template_id must be a string when provided" };
  }
  if (body.late_join_includes_history !== undefined && typeof body.late_join_includes_history !== "boolean") {
    return { ok: false, status: 422, error: "late_join_includes_history must be boolean when provided" };
  }
  const inviteUserIds =
    body.invite_user_ids === undefined
      ? []
      : Array.isArray(body.invite_user_ids)
        ? body.invite_user_ids
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter(Boolean)
        : null;
  if (inviteUserIds === null) {
    return { ok: false, status: 422, error: "invite_user_ids must be an array of user ids when provided" };
  }
  return {
    ok: true,
    payload: {
      name,
      description: typeof body.description === "string" ? body.description.trim() : undefined,
      mode,
      team_id: typeof body.team_id === "string" ? body.team_id.trim() : undefined,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      template_id: typeof body.template_id === "string" ? body.template_id.trim() : undefined,
      late_join_includes_history: Boolean(body.late_join_includes_history),
      invite_user_ids: Array.from(new Set(inviteUserIds)),
    },
  };
}

function validateChallengeJoinPayload(body: unknown):
  | { ok: true; payload: ChallengeJoinPayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<ChallengeJoinPayload>;
  if (!candidate.challenge_id || typeof candidate.challenge_id !== "string") {
    return { ok: false, status: 422, error: "challenge_id is required" };
  }
  if (candidate.user_id !== undefined && typeof candidate.user_id !== "string") {
    return { ok: false, status: 422, error: "user_id must be a string when provided" };
  }
  if (
    candidate.include_prior_logs !== undefined &&
    typeof candidate.include_prior_logs !== "boolean"
  ) {
    return { ok: false, status: 422, error: "include_prior_logs must be boolean when provided" };
  }
  if (
    candidate.sponsored_challenge_id !== undefined &&
    typeof candidate.sponsored_challenge_id !== "string"
  ) {
    return { ok: false, status: 422, error: "sponsored_challenge_id must be a string when provided" };
  }
  return {
    ok: true,
    payload: {
      challenge_id: candidate.challenge_id,
      user_id: candidate.user_id,
      include_prior_logs: candidate.include_prior_logs,
      sponsored_challenge_id: candidate.sponsored_challenge_id,
    },
  };
}

function validateMeProfileUpdatePayload(body: unknown):
  | { ok: true; payload: MeProfileUpdatePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }

  const candidate = body as Record<string, unknown>;
  const payload: MeProfileUpdatePayload = {};

  if (candidate.full_name !== undefined) {
    if (typeof candidate.full_name !== "string" || !candidate.full_name.trim()) {
      return { ok: false, status: 422, error: "full_name must be a non-empty string when provided" };
    }
    payload.full_name = candidate.full_name.trim();
  }
  if (candidate.avatar_url !== undefined) {
    if (candidate.avatar_url === null || candidate.avatar_url === "") {
      payload.avatar_url = "";
    } else if (typeof candidate.avatar_url !== "string") {
      return { ok: false, status: 422, error: "avatar_url must be a string when provided" };
    } else {
      const normalized = candidate.avatar_url.trim();
      if (normalized && !/^https?:\/\//i.test(normalized)) {
        return { ok: false, status: 422, error: "avatar_url must be an absolute http(s) URL" };
      }
      payload.avatar_url = normalized;
    }
  }
  if (candidate.avatar_preset_id !== undefined) {
    if (typeof candidate.avatar_preset_id !== "string" || !candidate.avatar_preset_id.trim()) {
      return { ok: false, status: 422, error: "avatar_preset_id must be a non-empty string when provided" };
    }
    payload.avatar_preset_id = candidate.avatar_preset_id.trim();
  }

  const parseNumberField = (
    field:
      | "average_price_point"
      | "commission_rate_percent"
      | "goal_gci_365_days"
      | "goal_deals_closed_365_days"
      | "last_year_gci"
      | "ytd_gci"
  ) => {
    const raw = candidate[String(field)];
    if (raw === undefined) return;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
      throw new Error(`${String(field)} must be a non-negative number when provided`);
    }
    payload[field] = raw;
  };

  try {
    parseNumberField("average_price_point");
    parseNumberField("commission_rate_percent");
    parseNumberField("goal_gci_365_days");
    parseNumberField("goal_deals_closed_365_days");
    parseNumberField("last_year_gci");
    parseNumberField("ytd_gci");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid profile update payload";
    return { ok: false, status: 422, error: msg };
  }

  if (candidate.selected_kpis !== undefined) {
    if (!Array.isArray(candidate.selected_kpis)) {
      return { ok: false, status: 422, error: "selected_kpis must be an array of KPI ids when provided" };
    }
    const normalized = candidate.selected_kpis
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);
    const unique = Array.from(new Set(normalized));
    if (unique.length === 0) {
      return { ok: false, status: 422, error: "selected_kpis must contain at least one KPI id when provided" };
    }
    payload.selected_kpis = unique;
  }

  if (candidate.kpi_weekly_inputs !== undefined) {
    if (!isRecord(candidate.kpi_weekly_inputs)) {
      return { ok: false, status: 422, error: "kpi_weekly_inputs must be an object keyed by KPI id" };
    }
    const parsed: Record<string, { historicalWeeklyAverage: number; targetWeeklyCount: number }> = {};
    for (const [kpiId, rawValue] of Object.entries(candidate.kpi_weekly_inputs)) {
      if (!kpiId.trim()) continue;
      if (!isRecord(rawValue)) {
        return { ok: false, status: 422, error: `kpi_weekly_inputs.${kpiId} must be an object` };
      }
      const historical = rawValue.historicalWeeklyAverage;
      const target = rawValue.targetWeeklyCount;
      if (typeof historical !== "number" || !Number.isFinite(historical) || historical < 0) {
        return { ok: false, status: 422, error: `kpi_weekly_inputs.${kpiId}.historicalWeeklyAverage must be a non-negative number` };
      }
      if (typeof target !== "number" || !Number.isFinite(target) || target < 0) {
        return { ok: false, status: 422, error: `kpi_weekly_inputs.${kpiId}.targetWeeklyCount must be a non-negative number` };
      }
      parsed[kpiId] = {
        historicalWeeklyAverage: historical,
        targetWeeklyCount: target,
      };
    }
    if (Object.keys(parsed).length === 0) {
      return { ok: false, status: 422, error: "kpi_weekly_inputs must include at least one KPI entry when provided" };
    }
    payload.kpi_weekly_inputs = parsed;
  }

  const parseOptionalPipelineField = (
    field: "pipeline_listings_pending" | "pipeline_buyers_uc"
  ) => {
    const raw = candidate[field];
    if (raw === undefined) return;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
      throw new Error(`${field} must be a non-negative number when provided`);
    }
    payload[field] = raw;
  };

  try {
    parseOptionalPipelineField("pipeline_listings_pending");
    parseOptionalPipelineField("pipeline_buyers_uc");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid profile update payload";
    return { ok: false, status: 422, error: msg };
  }

  const parseOptionalGeoField = (field: "geo_city" | "geo_state") => {
    const raw = candidate[field];
    if (raw === undefined) return;
    if (raw === null) {
      payload[field] = "";
      return;
    }
    if (typeof raw !== "string") {
      throw new Error(`${field} must be a string when provided`);
    }
    payload[field] = raw.trim();
  };

  try {
    parseOptionalGeoField("geo_city");
    parseOptionalGeoField("geo_state");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid profile update payload";
    return { ok: false, status: 422, error: msg };
  }

  const parseOptionalBooleanField = (field: "settings_push_enabled" | "settings_email_digest") => {
    const raw = candidate[field];
    if (raw === undefined) return;
    if (typeof raw !== "boolean") {
      throw new Error(`${field} must be a boolean when provided`);
    }
    payload[field] = raw;
  };
  try {
    parseOptionalBooleanField("settings_push_enabled");
    parseOptionalBooleanField("settings_email_digest");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid profile update payload";
    return { ok: false, status: 422, error: msg };
  }

  if (candidate.settings_theme !== undefined) {
    if (
      candidate.settings_theme !== "system" &&
      candidate.settings_theme !== "light" &&
      candidate.settings_theme !== "dark"
    ) {
      return { ok: false, status: 422, error: "settings_theme must be one of: system, light, dark" };
    }
    payload.settings_theme = candidate.settings_theme;
  }

  if (Object.keys(payload).length === 0) {
    return { ok: false, status: 422, error: "At least one profile field is required" };
  }

  return { ok: true, payload };
}

function validateChannelCreatePayload(body: unknown):
  | { ok: true; payload: ChannelCreatePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<ChannelCreatePayload>;
  if (!candidate.type || typeof candidate.type !== "string") {
    return { ok: false, status: 422, error: "type is required" };
  }
  const allowedTypes: ChannelType[] = ["team", "challenge", "sponsor", "cohort", "direct"];
  if (!allowedTypes.includes(candidate.type as ChannelType)) {
    return { ok: false, status: 422, error: "type must be one of: team, challenge, sponsor, cohort, direct" };
  }
  const isDirect = candidate.type === "direct";
  if (!isDirect && (!candidate.name || typeof candidate.name !== "string")) {
    return { ok: false, status: 422, error: "name is required" };
  }
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  if (!isDirect && !name) {
    return { ok: false, status: 422, error: "name must not be empty" };
  }
  if (candidate.team_id !== undefined && typeof candidate.team_id !== "string") {
    return { ok: false, status: 422, error: "team_id must be a string when provided" };
  }
  if (candidate.context_id !== undefined && typeof candidate.context_id !== "string") {
    return { ok: false, status: 422, error: "context_id must be a string when provided" };
  }
  if (candidate.member_user_ids !== undefined && !Array.isArray(candidate.member_user_ids)) {
    return { ok: false, status: 422, error: "member_user_ids must be an array when provided" };
  }
  const memberUserIds = Array.isArray(candidate.member_user_ids)
    ? Array.from(
        new Set(
          candidate.member_user_ids
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter(Boolean)
        )
      )
    : undefined;
  if (isDirect && (!memberUserIds || memberUserIds.length === 0)) {
    return { ok: false, status: 422, error: "member_user_ids is required for direct channel create" };
  }
  return {
    ok: true,
    payload: {
      type: candidate.type as ChannelType,
      ...(name ? { name } : {}),
      team_id: candidate.team_id,
      context_id: candidate.context_id,
      member_user_ids: memberUserIds,
    },
  };
}

function validateChannelTokenPayload(body: unknown):
  | { ok: true; payload: ChannelTokenPayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.channel_id !== "string" || !candidate.channel_id.trim()) {
    return { ok: false, status: 422, error: "channel_id is required" };
  }
  const tokenPurpose = typeof candidate.token_purpose === "string" ? candidate.token_purpose.trim() : "";
  if (tokenPurpose !== "chat_read" && tokenPurpose !== "chat_write" && tokenPurpose !== "channel_admin") {
    return { ok: false, status: 422, error: "token_purpose must be one of: chat_read, chat_write, channel_admin" };
  }
  if (candidate.client_session_id !== undefined && typeof candidate.client_session_id !== "string") {
    return { ok: false, status: 422, error: "client_session_id must be a string when provided" };
  }
  return {
    ok: true,
    payload: {
      channel_id: candidate.channel_id.trim(),
      token_purpose: tokenPurpose as ChannelTokenPurpose,
      client_session_id:
        typeof candidate.client_session_id === "string" && candidate.client_session_id.trim()
          ? candidate.client_session_id.trim()
          : undefined,
    },
  };
}

function validateChannelSyncPayload(body: unknown):
  | { ok: true; payload: ChannelSyncPayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.channel_id !== "string" || !candidate.channel_id.trim()) {
    return { ok: false, status: 422, error: "channel_id is required" };
  }
  const syncReason = typeof candidate.sync_reason === "string" ? candidate.sync_reason.trim() : "";
  const validSyncReason =
    syncReason === "membership_change" ||
    syncReason === "role_change" ||
    syncReason === "metadata_change" ||
    syncReason === "manual_reconcile";
  if (!validSyncReason) {
    return { ok: false, status: 422, error: "sync_reason must be one of: membership_change, role_change, metadata_change, manual_reconcile" };
  }
  if (
    candidate.expected_version !== undefined &&
    (typeof candidate.expected_version !== "number" || !Number.isInteger(candidate.expected_version) || candidate.expected_version < 0)
  ) {
    return { ok: false, status: 422, error: "expected_version must be a non-negative integer when provided" };
  }
  return {
    ok: true,
    payload: {
      channel_id: candidate.channel_id.trim(),
      sync_reason: syncReason as ChannelSyncPayload["sync_reason"],
      expected_version:
        typeof candidate.expected_version === "number" ? candidate.expected_version : undefined,
    },
  };
}

function validateChannelMessagePayload(body: unknown):
  | { ok: true; payload: ChannelMessagePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<ChannelMessagePayload>;
  const messageType = candidate.message_type ?? "message";
  if (messageType !== "message" && messageType !== "media_attachment") {
    return { ok: false, status: 422, error: "message_type must be one of: message, media_attachment" };
  }

  const bodyTextRaw = typeof candidate.body === "string" ? candidate.body.trim() : "";
  if (messageType === "message") {
    if (!bodyTextRaw) {
      return { ok: false, status: 422, error: "body is required" };
    }
    if (bodyTextRaw.length > 4000) {
      return { ok: false, status: 422, error: "body is too long (max 4000 chars)" };
    }
    return { ok: true, payload: { body: bodyTextRaw, message_type: "message" } };
  }

  if (!isRecord(candidate.media_attachment)) {
    return { ok: false, status: 422, error: "media_attachment is required when message_type=media_attachment" };
  }
  if (typeof candidate.media_attachment.media_id !== "string" || !candidate.media_attachment.media_id.trim()) {
    return { ok: false, status: 422, error: "media_attachment.media_id is required" };
  }
  const captionRaw =
    typeof candidate.media_attachment.caption === "string" ? candidate.media_attachment.caption.trim() : undefined;
  if (captionRaw && captionRaw.length > 4000) {
    return { ok: false, status: 422, error: "media_attachment.caption is too long (max 4000 chars)" };
  }
  if (bodyTextRaw && bodyTextRaw.length > 4000) {
    return { ok: false, status: 422, error: "body is too long (max 4000 chars)" };
  }

  const normalizedText = bodyTextRaw || captionRaw || "Shared media attachment";
  return {
    ok: true,
    payload: {
      body: normalizedText,
      message_type: "media_attachment",
      media_attachment: {
        media_id: candidate.media_attachment.media_id.trim(),
        ...(captionRaw ? { caption: captionRaw } : {}),
      },
    },
  };
}

function validateMarkSeenPayload(body: unknown):
  | { ok: true; payload: MarkSeenPayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<MarkSeenPayload>;
  if (!candidate.channel_id || typeof candidate.channel_id !== "string") {
    return { ok: false, status: 422, error: "channel_id is required" };
  }
  return { ok: true, payload: { channel_id: candidate.channel_id } };
}

function serializeChannelMessageBody(payload: ChannelMessagePayload & {
  lifecycle?: {
    processing_status: MuxLifecycleStatus;
    playback_ready: boolean;
  };
}): string {
  const text = payload.body?.trim() || "";
  if (payload.message_type !== "media_attachment" || !payload.media_attachment) {
    return text;
  }
  return JSON.stringify({
    text,
    media_attachment: payload.media_attachment,
    lifecycle: payload.lifecycle ?? null,
  });
}

function buildChannelMessageReadModel(row: {
  id?: unknown;
  channel_id?: unknown;
  sender_user_id?: unknown;
  body?: unknown;
  message_type?: unknown;
  created_at?: unknown;
}): {
  id: string;
  channel_id: string;
  sender_user_id: string;
  body: string;
  message_type: string;
  created_at: string | null;
  media_attachment?: {
    media_id: string;
    caption?: string;
    lifecycle?: {
      processing_status: MuxLifecycleStatus;
      playback_ready: boolean;
    } | null;
  };
} {
  const base = {
    id: String(row.id ?? ""),
    channel_id: String(row.channel_id ?? ""),
    sender_user_id: String(row.sender_user_id ?? ""),
    body: typeof row.body === "string" ? row.body : "",
    message_type: String(row.message_type ?? "message"),
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };

  let parsed: Record<string, unknown> | null = null;
  if (typeof row.body === "string" && row.body.trim().startsWith("{")) {
    try {
      const json = JSON.parse(row.body) as unknown;
      if (isRecord(json)) parsed = json;
    } catch {
      parsed = null;
    }
  }
  const isAttachmentByType = base.message_type === "media_attachment";
  const attachmentPayload = parsed && isRecord(parsed.media_attachment) ? parsed.media_attachment : null;
  const isAttachmentByPayload = Boolean(attachmentPayload?.media_id);
  if (!isAttachmentByType && !isAttachmentByPayload) {
    return base;
  }

  if (!parsed || !attachmentPayload) {
    return {
      ...base,
      message_type: "media_attachment",
      media_attachment: {
        media_id: "",
      },
    };
  }

  const lifecycleRaw = isRecord(parsed.lifecycle) ? parsed.lifecycle : null;
  const lifecycle =
    lifecycleRaw &&
    typeof lifecycleRaw.processing_status === "string" &&
    typeof lifecycleRaw.playback_ready === "boolean"
      ? {
          processing_status: normalizeMuxLifecycleStatus(lifecycleRaw.processing_status),
          playback_ready: lifecycleRaw.playback_ready,
        }
      : null;

  const text = typeof parsed.text === "string" ? parsed.text : base.body;
  return {
    ...base,
    message_type: "media_attachment",
    body: text,
    media_attachment: {
      media_id: typeof attachmentPayload.media_id === "string" ? attachmentPayload.media_id : "",
      ...(typeof attachmentPayload.caption === "string" ? { caption: attachmentPayload.caption } : {}),
      ...(lifecycle ? { lifecycle } : {}),
    },
  };
}

function validatePushTokenPayload(body: unknown):
  | { ok: true; payload: PushTokenPayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<PushTokenPayload>;
  if (!candidate.token || typeof candidate.token !== "string") {
    return { ok: false, status: 422, error: "token is required" };
  }
  if (
    candidate.platform !== undefined &&
    candidate.platform !== "expo" &&
    candidate.platform !== "ios" &&
    candidate.platform !== "android"
  ) {
    return { ok: false, status: 422, error: "platform must be one of: expo, ios, android" };
  }
  return {
    ok: true,
    payload: {
      token: candidate.token,
      platform: candidate.platform,
    },
  };
}

function validateCoachingLessonProgressPayload(body: unknown):
  | { ok: true; payload: CoachingLessonProgressPayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<CoachingLessonProgressPayload>;
  if (!candidate.status || typeof candidate.status !== "string") {
    return { ok: false, status: 422, error: "status is required" };
  }
  if (
    candidate.status !== "not_started" &&
    candidate.status !== "in_progress" &&
    candidate.status !== "completed"
  ) {
    return { ok: false, status: 422, error: "status must be one of: not_started, in_progress, completed" };
  }
  return { ok: true, payload: { status: candidate.status } };
}

function validateCoachingBroadcastPayload(body: unknown):
  | { ok: true; payload: CoachingBroadcastPayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<CoachingBroadcastPayload>;
  if (!candidate.scope_type || typeof candidate.scope_type !== "string") {
    return { ok: false, status: 422, error: "scope_type is required" };
  }
  if (
    candidate.scope_type !== "team" &&
    candidate.scope_type !== "journey" &&
    candidate.scope_type !== "global"
  ) {
    return { ok: false, status: 422, error: "scope_type must be one of: team, journey, global" };
  }
  if (candidate.scope_id !== undefined && typeof candidate.scope_id !== "string") {
    return { ok: false, status: 422, error: "scope_id must be a string when provided" };
  }
  if (!candidate.message_body || typeof candidate.message_body !== "string") {
    return { ok: false, status: 422, error: "message_body is required" };
  }
  const messageBody = candidate.message_body.trim();
  if (!messageBody) {
    return { ok: false, status: 422, error: "message_body must not be empty" };
  }
  if (messageBody.length > 4000) {
    return { ok: false, status: 422, error: "message_body is too long (max 4000 chars)" };
  }
  return {
    ok: true,
    payload: {
      scope_type: candidate.scope_type,
      scope_id: candidate.scope_id,
      message_body: messageBody,
    },
  };
}

function normalizeGoalStatus(raw: string): "pending" | "in_progress" | "completed" {
  if (raw === "completed" || raw === "done") return "completed";
  if (raw === "in_progress" || raw === "active") return "in_progress";
  return "pending";
}

function validateCoachEngagementCreatePayload(body: unknown):
  | { ok: true; payload: CoachEngagementCreatePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<CoachEngagementCreatePayload>;
  if (!candidate.coach_id || typeof candidate.coach_id !== "string") {
    return { ok: false, status: 422, error: "coach_id is required" };
  }
  return { ok: true, payload: { coach_id: candidate.coach_id } };
}

function validateAiSuggestionCreatePayload(body: unknown):
  | { ok: true; payload: AiSuggestionCreatePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<AiSuggestionCreatePayload>;
  if (candidate.user_id !== undefined && typeof candidate.user_id !== "string") {
    return { ok: false, status: 422, error: "user_id must be a string when provided" };
  }
  if (!candidate.scope || typeof candidate.scope !== "string") {
    return { ok: false, status: 422, error: "scope is required" };
  }
  const scope = candidate.scope.trim();
  if (!scope) {
    return { ok: false, status: 422, error: "scope must not be empty" };
  }
  if (!candidate.proposed_message || typeof candidate.proposed_message !== "string") {
    return { ok: false, status: 422, error: "proposed_message is required" };
  }
  const proposedMessage = candidate.proposed_message.trim();
  if (!proposedMessage) {
    return { ok: false, status: 422, error: "proposed_message must not be empty" };
  }
  if (proposedMessage.length > 4000) {
    return { ok: false, status: 422, error: "proposed_message is too long (max 4000 chars)" };
  }
  return {
    ok: true,
    payload: {
      user_id: candidate.user_id,
      scope,
      proposed_message: proposedMessage,
    },
  };
}

function validateKpiLogPayload(body: unknown):
  | { ok: true; payload: KPIWritePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }

  const candidate = body as Partial<KPIWritePayload>;
  if (!candidate.kpi_id || typeof candidate.kpi_id !== "string") {
    return { ok: false, status: 422, error: "kpi_id is required" };
  }

  if (!candidate.event_timestamp || typeof candidate.event_timestamp !== "string") {
    return { ok: false, status: 422, error: "event_timestamp is required" };
  }

  const parsedDate = new Date(candidate.event_timestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return { ok: false, status: 422, error: "event_timestamp must be a valid ISO date" };
  }

  if (candidate.logged_value !== undefined && typeof candidate.logged_value !== "number") {
    return { ok: false, status: 422, error: "logged_value must be a number when provided" };
  }

  if (
    candidate.idempotency_key !== undefined &&
    (typeof candidate.idempotency_key !== "string" || candidate.idempotency_key.length === 0)
  ) {
    return { ok: false, status: 422, error: "idempotency_key must be a non-empty string when provided" };
  }

  if (typeof candidate.idempotency_key === "string" && candidate.idempotency_key.length > 128) {
    return { ok: false, status: 422, error: "idempotency_key is too long (max 128 chars)" };
  }
  if (
    candidate.challenge_instance_id !== undefined &&
    candidate.challenge_instance_id !== null &&
    typeof candidate.challenge_instance_id !== "string"
  ) {
    return { ok: false, status: 422, error: "challenge_instance_id must be a string when provided" };
  }
  if (
    candidate.sponsored_challenge_id !== undefined &&
    candidate.sponsored_challenge_id !== null &&
    typeof candidate.sponsored_challenge_id !== "string"
  ) {
    return { ok: false, status: 422, error: "sponsored_challenge_id must be a string when provided" };
  }

  return {
    ok: true,
    payload: {
      kpi_id: candidate.kpi_id,
      event_timestamp: candidate.event_timestamp,
      logged_value: candidate.logged_value,
      idempotency_key: candidate.idempotency_key ?? null,
      challenge_instance_id: candidate.challenge_instance_id ?? null,
      sponsored_challenge_id: candidate.sponsored_challenge_id ?? null,
    },
  };
}

function validateKpiLogBatchPayload(body: unknown):
  | { ok: true; payload: KpiBatchWritePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<{ logs: unknown }>;
  if (!Array.isArray(candidate.logs)) {
    return { ok: false, status: 422, error: "logs must be an array" };
  }
  if (candidate.logs.length === 0) {
    return { ok: false, status: 422, error: "logs must not be empty" };
  }
  if (candidate.logs.length > 200) {
    return { ok: false, status: 422, error: "logs is too large (max 200 entries)" };
  }

  const parsed: KPIWritePayload[] = [];
  for (let i = 0; i < candidate.logs.length; i += 1) {
    const checked = validateKpiLogPayload(candidate.logs[i]);
    if (!checked.ok) {
      return { ok: false, status: checked.status, error: `logs[${i}]: ${checked.error}` };
    }
    parsed.push(checked.payload);
  }

  return { ok: true, payload: { logs: parsed } };
}

function validateAdminKpiPayload(
  body: unknown,
  requireNameAndType: boolean
): | { ok: true; payload: AdminKpiPayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<AdminKpiPayload>;
  const payload: AdminKpiPayload = {} as AdminKpiPayload;

  if (requireNameAndType) {
    if (!candidate.name || typeof candidate.name !== "string") {
      return { ok: false, status: 422, error: "name is required" };
    }
    if (!candidate.type || typeof candidate.type !== "string") {
      return { ok: false, status: 422, error: "type is required" };
    }
  }

  if (candidate.name !== undefined) {
    if (typeof candidate.name !== "string" || !candidate.name.trim()) {
      return { ok: false, status: 422, error: "name must be a non-empty string" };
    }
    payload.name = candidate.name.trim();
  }
  if (candidate.slug !== undefined) {
    if (typeof candidate.slug !== "string" || !candidate.slug.trim()) {
      return { ok: false, status: 422, error: "slug must be a non-empty string when provided" };
    }
    payload.slug = normalizeKpiIdentifier(candidate.slug);
    if (!payload.slug) {
      return { ok: false, status: 422, error: "slug must contain at least one alphanumeric character" };
    }
  }
  if (candidate.type !== undefined) {
    const type = candidate.type as KPIType;
    const allowed: KPIType[] = ["PC", "GP", "VP", "Actual", "Pipeline_Anchor", "Custom"];
    if (!allowed.includes(type)) {
      return { ok: false, status: 422, error: "type must be one of: PC, GP, VP, Actual, Pipeline_Anchor, Custom" };
    }
    payload.type = type;
  }
  if (candidate.requires_direct_value_input !== undefined) {
    if (typeof candidate.requires_direct_value_input !== "boolean") {
      return { ok: false, status: 422, error: "requires_direct_value_input must be boolean when provided" };
    }
    payload.requires_direct_value_input = candidate.requires_direct_value_input;
  }
  if (candidate.pc_weight !== undefined && candidate.pc_weight !== null) {
    if (typeof candidate.pc_weight !== "number") return { ok: false, status: 422, error: "pc_weight must be numeric when provided" };
    payload.pc_weight = candidate.pc_weight;
  }
  if (candidate.ttc_days !== undefined && candidate.ttc_days !== null) {
    if (typeof candidate.ttc_days !== "number") return { ok: false, status: 422, error: "ttc_days must be numeric when provided" };
    payload.ttc_days = candidate.ttc_days;
  }
  if (candidate.ttc_definition !== undefined && candidate.ttc_definition !== null) {
    if (typeof candidate.ttc_definition !== "string" || !candidate.ttc_definition.trim()) {
      return { ok: false, status: 422, error: "ttc_definition must be a non-empty string when provided" };
    }
    const parsed = parseTtcDefinition(candidate.ttc_definition);
    if (!parsed) {
      return { ok: false, status: 422, error: "ttc_definition must be in `X-Y days` or `Z days` format" };
    }
    payload.ttc_definition = candidate.ttc_definition.trim();
    if (candidate.delay_days === undefined || candidate.delay_days === null) {
      payload.delay_days = parsed.delayDays;
    }
    if (candidate.hold_days === undefined || candidate.hold_days === null) {
      payload.hold_days = parsed.holdDays;
    }
    if (candidate.ttc_days === undefined || candidate.ttc_days === null) {
      payload.ttc_days = parsed.totalTtcDays;
    }
  }
  if (candidate.delay_days !== undefined && candidate.delay_days !== null) {
    if (typeof candidate.delay_days !== "number") return { ok: false, status: 422, error: "delay_days must be numeric when provided" };
    payload.delay_days = candidate.delay_days;
  }
  if (candidate.hold_days !== undefined && candidate.hold_days !== null) {
    if (typeof candidate.hold_days !== "number") return { ok: false, status: 422, error: "hold_days must be numeric when provided" };
    payload.hold_days = candidate.hold_days;
  }
  if (candidate.decay_days !== undefined && candidate.decay_days !== null) {
    if (typeof candidate.decay_days !== "number") return { ok: false, status: 422, error: "decay_days must be numeric when provided" };
    payload.decay_days = candidate.decay_days;
  }
  if (candidate.gp_value !== undefined && candidate.gp_value !== null) {
    if (typeof candidate.gp_value !== "number") return { ok: false, status: 422, error: "gp_value must be numeric when provided" };
    payload.gp_value = candidate.gp_value;
  }
  if (candidate.vp_value !== undefined && candidate.vp_value !== null) {
    if (typeof candidate.vp_value !== "number") return { ok: false, status: 422, error: "vp_value must be numeric when provided" };
    payload.vp_value = candidate.vp_value;
  }
  if (candidate.is_active !== undefined) {
    if (typeof candidate.is_active !== "boolean") return { ok: false, status: 422, error: "is_active must be boolean when provided" };
    payload.is_active = candidate.is_active;
  }

  const effectiveType = payload.type ?? candidate.type;
  const effectivePcWeight = payload.pc_weight ?? candidate.pc_weight;
  const effectiveTtcDays = payload.ttc_days ?? candidate.ttc_days;
  const effectiveDelayDays = payload.delay_days ?? candidate.delay_days;
  const effectiveHoldDays = payload.hold_days ?? candidate.hold_days;
  const effectiveDecayDays = payload.decay_days ?? candidate.decay_days;
  const effectiveGpValue = payload.gp_value ?? candidate.gp_value;
  const effectiveVpValue = payload.vp_value ?? candidate.vp_value;
  if (
    effectiveType === "PC" &&
    (
      effectivePcWeight === undefined ||
      effectivePcWeight === null ||
      effectiveDecayDays === undefined ||
      effectiveDecayDays === null ||
      (
        (effectiveTtcDays === undefined || effectiveTtcDays === null) &&
        (effectiveHoldDays === undefined || effectiveHoldDays === null)
      )
    )
  ) {
    return { ok: false, status: 422, error: "PC KPIs require pc_weight, decay_days, and TTC timing (`ttc_days` or `hold_days`) fields" };
  }
  if (effectiveType === "PC" && effectiveTtcDays === undefined && effectiveHoldDays !== undefined && effectiveHoldDays !== null) {
    const derivedTtc = Number(effectiveDelayDays ?? 0) + Number(effectiveHoldDays);
    if (Number.isFinite(derivedTtc)) {
      payload.ttc_days = Math.max(0, derivedTtc);
    }
  }
  if (effectiveType === "GP" && (effectiveGpValue === undefined || effectiveGpValue === null)) {
    payload.gp_value = 1;
  }
  if (effectiveType === "VP" && (effectiveVpValue === undefined || effectiveVpValue === null)) {
    payload.vp_value = 1;
  }
  if (effectiveType && effectiveType !== "GP") {
    payload.gp_value = null;
  }
  if (effectiveType && effectiveType !== "VP") {
    payload.vp_value = null;
  }

  return { ok: true, payload };
}

function validateCoachingJourneyCreatePayload(body: unknown):
  | { ok: true; payload: CoachingJourneyCreatePayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) return { ok: false, status: 400, error: "Body must be a JSON object" };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { ok: false, status: 422, error: "title is required" };
  if (body.description !== undefined && typeof body.description !== "string") {
    return { ok: false, status: 422, error: "description must be a string when provided" };
  }
  if (body.team_id !== undefined && typeof body.team_id !== "string") {
    return { ok: false, status: 422, error: "team_id must be a string when provided" };
  }
  return {
    ok: true,
    payload: {
      title,
      description: typeof body.description === "string" ? body.description.trim() : undefined,
      team_id: typeof body.team_id === "string" && body.team_id.trim() ? body.team_id.trim() : undefined,
    },
  };
}

function validateCoachingJourneyUpdatePayload(body: unknown):
  | { ok: true; payload: CoachingJourneyUpdatePayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) return { ok: false, status: 400, error: "Body must be a JSON object" };
  const payload: CoachingJourneyUpdatePayload = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return { ok: false, status: 422, error: "title must be a non-empty string when provided" };
    }
    payload.title = body.title.trim();
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      return { ok: false, status: 422, error: "description must be a string when provided" };
    }
    payload.description = body.description.trim();
  }
  if (body.team_id !== undefined) {
    if (body.team_id !== null && typeof body.team_id !== "string") {
      return { ok: false, status: 422, error: "team_id must be a string or null when provided" };
    }
    payload.team_id = body.team_id === null ? null : body.team_id.trim();
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      return { ok: false, status: 422, error: "is_active must be boolean when provided" };
    }
    payload.is_active = body.is_active;
  }
  if (Object.keys(payload).length === 0) {
    return { ok: false, status: 422, error: "At least one mutable field is required" };
  }
  return { ok: true, payload };
}

function validateCoachingLessonCreatePayload(body: unknown):
  | { ok: true; payload: CoachingLessonCreatePayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) return { ok: false, status: 400, error: "Body must be a JSON object" };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { ok: false, status: 422, error: "title is required" };
  if (body.sort_order !== undefined && (typeof body.sort_order !== "number" || !Number.isInteger(body.sort_order) || body.sort_order < 0)) {
    return { ok: false, status: 422, error: "sort_order must be a non-negative integer when provided" };
  }
  return {
    ok: true,
    payload: {
      title,
      sort_order: typeof body.sort_order === "number" ? body.sort_order : undefined,
    },
  };
}

function validateCoachingLessonUpdatePayload(body: unknown):
  | { ok: true; payload: CoachingLessonUpdatePayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) return { ok: false, status: 400, error: "Body must be a JSON object" };
  const payload: CoachingLessonUpdatePayload = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return { ok: false, status: 422, error: "title must be a non-empty string when provided" };
    }
    payload.title = body.title.trim();
  }
  if (body.sort_order !== undefined) {
    if (typeof body.sort_order !== "number" || !Number.isInteger(body.sort_order) || body.sort_order < 0) {
      return { ok: false, status: 422, error: "sort_order must be a non-negative integer when provided" };
    }
    payload.sort_order = body.sort_order;
  }
  if (Object.keys(payload).length === 0) {
    return { ok: false, status: 422, error: "At least one mutable field is required" };
  }
  return { ok: true, payload };
}

function validateCoachingLessonReorderPayload(body: unknown):
  | { ok: true; payload: CoachingLessonReorderPayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body) || !Array.isArray(body.lesson_ids)) {
    return { ok: false, status: 422, error: "lesson_ids array is required" };
  }
  const lessonIds = body.lesson_ids
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (lessonIds.length === 0) return { ok: false, status: 422, error: "lesson_ids must include at least one id" };
  return { ok: true, payload: { lesson_ids: Array.from(new Set(lessonIds)) } };
}

function validateCoachingTaskCreatePayload(body: unknown):
  | { ok: true; payload: CoachingTaskCreatePayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) return { ok: false, status: 400, error: "Body must be a JSON object" };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { ok: false, status: 422, error: "title is required" };
  if (body.body !== undefined && typeof body.body !== "string") {
    return { ok: false, status: 422, error: "body must be a string when provided" };
  }
  if (body.sort_order !== undefined && (typeof body.sort_order !== "number" || !Number.isInteger(body.sort_order) || body.sort_order < 0)) {
    return { ok: false, status: 422, error: "sort_order must be a non-negative integer when provided" };
  }
  return {
    ok: true,
    payload: {
      title,
      body: typeof body.body === "string" ? body.body : undefined,
      sort_order: typeof body.sort_order === "number" ? body.sort_order : undefined,
    },
  };
}

function validateCoachingTaskUpdatePayload(body: unknown):
  | { ok: true; payload: CoachingTaskUpdatePayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) return { ok: false, status: 400, error: "Body must be a JSON object" };
  const payload: CoachingTaskUpdatePayload = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return { ok: false, status: 422, error: "title must be a non-empty string when provided" };
    }
    payload.title = body.title.trim();
  }
  if (body.body !== undefined) {
    if (body.body !== null && typeof body.body !== "string") {
      return { ok: false, status: 422, error: "body must be a string or null when provided" };
    }
    payload.body = body.body === null ? null : body.body;
  }
  if (body.sort_order !== undefined) {
    if (typeof body.sort_order !== "number" || !Number.isInteger(body.sort_order) || body.sort_order < 0) {
      return { ok: false, status: 422, error: "sort_order must be a non-negative integer when provided" };
    }
    payload.sort_order = body.sort_order;
  }
  if (Object.keys(payload).length === 0) {
    return { ok: false, status: 422, error: "At least one mutable field is required" };
  }
  return { ok: true, payload };
}

function validateCoachingTaskReorderPayload(body: unknown):
  | { ok: true; payload: CoachingTaskReorderPayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body) || !Array.isArray(body.task_ids)) {
    return { ok: false, status: 422, error: "task_ids array is required" };
  }
  const taskIds = body.task_ids
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (taskIds.length === 0) return { ok: false, status: 422, error: "task_ids must include at least one id" };
  return { ok: true, payload: { task_ids: Array.from(new Set(taskIds)) } };
}

function validateCoachingCohortMembershipUpdatePayload(body: unknown):
  | { ok: true; payload: CoachingCohortMembershipUpdatePayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body) || !Array.isArray(body.member_user_ids)) {
    return { ok: false, status: 422, error: "member_user_ids array is required" };
  }
  const memberUserIds = body.member_user_ids
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return { ok: true, payload: { member_user_ids: Array.from(new Set(memberUserIds)) } };
}

function validateAdminChallengeTemplatePayload(
  body: unknown,
  requireName: boolean
): | { ok: true; payload: AdminChallengeTemplatePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<AdminChallengeTemplatePayload>;
  const payload: AdminChallengeTemplatePayload = {} as AdminChallengeTemplatePayload;

  if (requireName) {
    if (!candidate.name || typeof candidate.name !== "string" || !candidate.name.trim()) {
      return { ok: false, status: 422, error: "name is required" };
    }
  }
  if (candidate.name !== undefined) {
    if (typeof candidate.name !== "string" || !candidate.name.trim()) {
      return { ok: false, status: 422, error: "name must be a non-empty string" };
    }
    payload.name = candidate.name.trim();
  }
  if (candidate.description !== undefined) {
    if (typeof candidate.description !== "string") {
      return { ok: false, status: 422, error: "description must be a string when provided" };
    }
    payload.description = candidate.description;
  }
  if (candidate.is_active !== undefined) {
    if (typeof candidate.is_active !== "boolean") {
      return { ok: false, status: 422, error: "is_active must be boolean when provided" };
    }
    payload.is_active = candidate.is_active;
  }
  return { ok: true, payload };
}

function validateAdminCalibrationUpdatePayload(
  body: unknown
): { ok: true; payload: AdminCalibrationUpdatePayload } | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<AdminCalibrationUpdatePayload>;
  if (candidate.multiplier === undefined || candidate.multiplier === null) {
    return { ok: false, status: 422, error: "multiplier is required" };
  }
  if (typeof candidate.multiplier !== "number" || !Number.isFinite(candidate.multiplier)) {
    return { ok: false, status: 422, error: "multiplier must be numeric" };
  }
  if (candidate.multiplier < 0.5 || candidate.multiplier > 1.5) {
    return { ok: false, status: 422, error: "multiplier must be between 0.5 and 1.5" };
  }
  return { ok: true, payload: { multiplier: Number(candidate.multiplier.toFixed(6)) } };
}

function validateNotificationEnqueuePayload(body: unknown):
  | { ok: true; payload: NotificationEnqueuePayload }
  | { ok: false; status: number; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Partial<NotificationEnqueuePayload>;
  if (!candidate.user_id || typeof candidate.user_id !== "string") {
    return { ok: false, status: 422, error: "user_id is required" };
  }
  if (!candidate.category || typeof candidate.category !== "string") {
    return { ok: false, status: 422, error: "category is required" };
  }
  if (!["communication", "challenge", "coaching", "system"].includes(candidate.category)) {
    return { ok: false, status: 422, error: "category must be one of: communication, challenge, coaching, system" };
  }
  if (!candidate.title || typeof candidate.title !== "string" || !candidate.title.trim()) {
    return { ok: false, status: 422, error: "title is required" };
  }
  if (!candidate.body || typeof candidate.body !== "string" || !candidate.body.trim()) {
    return { ok: false, status: 422, error: "body is required" };
  }
  if (candidate.payload !== undefined && (typeof candidate.payload !== "object" || candidate.payload === null || Array.isArray(candidate.payload))) {
    return { ok: false, status: 422, error: "payload must be an object when provided" };
  }
  if (candidate.scheduled_for !== undefined) {
    if (typeof candidate.scheduled_for !== "string" || Number.isNaN(new Date(candidate.scheduled_for).getTime())) {
      return { ok: false, status: 422, error: "scheduled_for must be a valid ISO date when provided" };
    }
  }
  return {
    ok: true,
    payload: {
      user_id: candidate.user_id,
      category: candidate.category,
      title: candidate.title.trim(),
      body: candidate.body.trim(),
      payload: candidate.payload as Record<string, unknown> | undefined,
      scheduled_for: candidate.scheduled_for,
    },
  };
}

function validateCoachingMediaUploadUrlPayload(body: unknown):
  | { ok: true; payload: CoachingMediaUploadUrlPayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Record<string, unknown>;
  const journeyId = typeof candidate.journey_id === "string" && candidate.journey_id.trim()
    ? candidate.journey_id.trim()
    : undefined;
  const lessonId = typeof candidate.lesson_id === "string" && candidate.lesson_id.trim()
    ? candidate.lesson_id.trim()
    : undefined;
  const channelId = typeof candidate.channel_id === "string" && candidate.channel_id.trim()
    ? candidate.channel_id.trim()
    : undefined;
  if ((journeyId && lessonId) || (!journeyId && !lessonId)) {
    return { ok: false, status: 422, error: "Exactly one of journey_id or lesson_id is required" };
  }
  if (typeof candidate.filename !== "string" || !candidate.filename.trim()) {
    return { ok: false, status: 422, error: "filename is required" };
  }
  if (typeof candidate.content_type !== "string" || !candidate.content_type.trim()) {
    return { ok: false, status: 422, error: "content_type is required" };
  }
  const contentType = candidate.content_type.trim().toLowerCase();
  const allowedTypes = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"]);
  if (!allowedTypes.has(contentType)) {
    return { ok: false, status: 415, error: "content_type is not supported" };
  }
  if (typeof candidate.content_length_bytes !== "number" || !Number.isFinite(candidate.content_length_bytes) || candidate.content_length_bytes <= 0) {
    return { ok: false, status: 422, error: "content_length_bytes must be a positive number" };
  }
  const maxBytes = Number(process.env.MUX_UPLOAD_MAX_BYTES ?? 250_000_000);
  if (candidate.content_length_bytes > maxBytes) {
    return { ok: false, status: 413, error: "content_length_bytes exceeds upload limit" };
  }
  if (typeof candidate.idempotency_key !== "string" || !candidate.idempotency_key.trim()) {
    return { ok: false, status: 422, error: "idempotency_key is required" };
  }
  return {
    ok: true,
    payload: {
      journey_id: journeyId,
      lesson_id: lessonId,
      channel_id: channelId,
      filename: candidate.filename.trim(),
      content_type: contentType,
      content_length_bytes: Math.round(candidate.content_length_bytes),
      idempotency_key: candidate.idempotency_key.trim(),
    },
  };
}

function validateCoachingMediaPlaybackTokenPayload(body: unknown):
  | { ok: true; payload: CoachingMediaPlaybackTokenPayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) {
    return { ok: false, status: 400, error: "Body must be a JSON object" };
  }
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.media_id !== "string" || !candidate.media_id.trim()) {
    return { ok: false, status: 422, error: "media_id is required" };
  }
  if (
    candidate.viewer_context !== undefined &&
    candidate.viewer_context !== "coach" &&
    candidate.viewer_context !== "team_leader" &&
    candidate.viewer_context !== "member" &&
    candidate.viewer_context !== "sponsor"
  ) {
    return { ok: false, status: 422, error: "viewer_context must be one of: coach, team_leader, member, sponsor" };
  }
  return {
    ok: true,
    payload: {
      media_id: candidate.media_id.trim(),
      viewer_context: candidate.viewer_context as CoachingMediaPlaybackTokenPayload["viewer_context"],
    },
  };
}

function validateLiveSessionCreatePayload(body: unknown):
  | { ok: true; payload: LiveSessionCreatePayload }
  | { ok: false; status: number; error: string } {
  if (!isRecord(body)) return { ok: false, status: 400, error: "Body must be a JSON object" };
  const channelId = typeof body.channel_id === "string" ? body.channel_id.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
  if (!channelId) return { ok: false, status: 422, error: "channel_id is required" };
  if (!title) return { ok: false, status: 422, error: "title is required" };
  if (!idempotencyKey) return { ok: false, status: 422, error: "idempotency_key is required" };
  if (title.length > 120) return { ok: false, status: 422, error: "title is too long (max 120 chars)" };

  const startsAtRaw = typeof body.starts_at === "string" && body.starts_at.trim() ? body.starts_at.trim() : undefined;
  let startsAt: string | undefined;
  if (startsAtRaw) {
    const parsed = new Date(startsAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, status: 422, error: "starts_at must be a valid ISO timestamp when provided" };
    }
    startsAt = parsed.toISOString();
  }
  const endsAtRaw = typeof body.ends_at === "string" && body.ends_at.trim() ? body.ends_at.trim() : undefined;
  let endsAt: string | undefined;
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
    payload: {
      channel_id: channelId,
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      idempotency_key: idempotencyKey,
    },
  };
}

function validateLiveSessionJoinTokenPayload(body: unknown):
  | { ok: true; payload: LiveSessionJoinTokenPayload }
  | { ok: false; status: number; error: string } {
  if (body === undefined || body === null) {
    return { ok: true, payload: {} };
  }
  if (!isRecord(body)) return { ok: false, status: 400, error: "Body must be a JSON object" };
  const role = body.role;
  if (role !== undefined && role !== "host" && role !== "participant" && role !== "viewer") {
    return { ok: false, status: 422, error: "role must be one of: host, participant, viewer" };
  }
  return { ok: true, payload: { role: role as LiveSessionJoinTokenPayload["role"] } };
}

async function canAccessMuxMediaForRole(
  userId: string,
  action: "upload" | "playback",
  context: {
    journeyId?: string | null;
    lessonId?: string | null;
    ownerUserId?: string | null;
    viewerContext?: CoachingMediaPlaybackTokenPayload["viewer_context"];
  }
): Promise<
  | { ok: true; allowed: boolean; role: string }
  | { ok: false; status: number; error: string }
> {
  const roleResult = await getUserRoleForScope(userId);
  if (!roleResult.ok) return roleResult;
  const role = roleResult.role;
  const allowRole = role === "admin" || role === "super_admin" || role === "coach" || role === "team_leader" || role === "challenge_sponsor";
  if (allowRole) {
    return { ok: true, allowed: true, role };
  }
  if (action === "playback" && context.ownerUserId && context.ownerUserId === userId) {
    return { ok: true, allowed: true, role };
  }
  if (action === "playback" && context.viewerContext === "member" && role === "agent") {
    return { ok: true, allowed: true, role };
  }
  return { ok: true, allowed: false, role };
}

async function getUserRoleForScope(userId: string): Promise<
  | { ok: true; role: string }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }
  const { data, error } = await dataClient
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 500, error: "Failed to evaluate caller role for media scope" };
  }
  return { ok: true, role: String((data as { role?: unknown } | null)?.role ?? "agent") };
}

function inferViewerContextFromRole(role: string): "coach" | "team_leader" | "member" | "sponsor" {
  if (role === "coach") return "coach";
  if (role === "team_leader") return "team_leader";
  if (role === "challenge_sponsor") return "sponsor";
  return "member";
}

function muxLifecycleMessageCopy(status: MuxLifecycleStatus): string {
  if (status === "ready") return "Media attachment is ready for playback.";
  if (status === "processing") return "Media attachment is processing.";
  if (status === "uploaded" || status === "queued_for_upload") return "Media attachment upload received.";
  if (status === "failed") return "Media attachment processing failed.";
  if (status === "deleted") return "Media attachment was deleted.";
  return "Media attachment lifecycle updated.";
}

async function emitMuxLifecycleChannelMessage(media: MuxMediaSessionRecord, providerEventType: string): Promise<void> {
  if (!dataClient || !media.channel_id) return;
  const payload: ChannelMessagePayload & {
    lifecycle?: {
      processing_status: MuxLifecycleStatus;
      playback_ready: boolean;
      provider_event_type: string;
    };
  } = {
    body: muxLifecycleMessageCopy(media.processing_status),
    message_type: "media_attachment",
    media_attachment: {
      media_id: media.media_id,
      caption: media.filename,
    },
    lifecycle: {
      processing_status: media.processing_status,
      playback_ready: media.playback_ready,
      provider_event_type: providerEventType,
    },
  };

  const messageBody = JSON.stringify({
    text: payload.body,
    media_attachment: payload.media_attachment,
    lifecycle: payload.lifecycle,
  });

  const { error } = await dataClient.from("channel_messages").insert({
    channel_id: media.channel_id,
    sender_user_id: media.owner_user_id,
    body: messageBody,
    message_type: "message",
  });
  if (error) {
    if (!isRecoverableAssignmentSourceGap(error)) {
      // eslint-disable-next-line no-console
      console.error("Failed to create mux lifecycle channel message", error);
    }
    return;
  }
  await fanOutUnreadCounters(media.channel_id, media.owner_user_id);
}

function canHostLiveSession(role: string): boolean {
  return role === "admin" || role === "super_admin" || role === "coach" || role === "team_leader" || role === "challenge_sponsor";
}

function resolveLiveProviderMode(): "mock" | "unavailable" {
  const raw = String(process.env.MUX_LIVE_PROVIDER_MODE ?? process.env.MUX_PROVIDER_MODE ?? "mock").trim().toLowerCase();
  if (raw === "down" || raw === "unavailable" || raw === "disabled" || raw === "off") return "unavailable";
  return "mock";
}

function buildLiveSessionLaunchUrls(input: {
  sessionId: string;
  channelId: string;
  role: "host" | "participant" | "viewer";
  token?: string;
}): { host_url: string; join_url: string; live_url: string } {
  const baseRaw = String(process.env.MUX_LIVE_BASE_URL ?? "https://mock.mux.local/live").trim();
  const base = baseRaw.endsWith("/") ? baseRaw.slice(0, -1) : baseRaw;
  const liveUrl = `${base}/${encodeURIComponent(input.sessionId)}`;
  const hostUrl = `${liveUrl}?channel_id=${encodeURIComponent(input.channelId)}&role=host`;
  const joinParams = new URLSearchParams({
    channel_id: input.channelId,
    role: input.role,
  });
  if (input.token) joinParams.set("token", input.token);
  return {
    host_url: hostUrl,
    join_url: `${liveUrl}?${joinParams.toString()}`,
    live_url: liveUrl,
  };
}

function issueLiveSessionJoinToken(input: {
  sessionId: string;
  channelId: string;
  userId: string;
  role: "host" | "participant" | "viewer";
  issuedAtMs: number;
  ttlSeconds: number;
}): string {
  const payload = {
    provider: "compass_live",
    session_id: input.sessionId,
    channel_id: input.channelId,
    user_id: input.userId,
    role: input.role,
    issued_at: new Date(input.issuedAtMs).toISOString(),
    expires_at: new Date(input.issuedAtMs + input.ttlSeconds * 1000).toISOString(),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function resolveRequestId(requestIdHeader?: string | string[]): string {
  if (typeof requestIdHeader === "string" && requestIdHeader.trim()) {
    return requestIdHeader.trim();
  }
  return `req_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function streamProviderChannelId(channelId: string): string {
  return `stream_${channelId.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

type ChannelAuthoritySnapshot = {
  channelType: ChannelType;
  metadataHash: string;
  memberByUserId: Map<string, "admin" | "member">;
};

async function buildChannelAuthoritySnapshot(
  channelId: string
): Promise<
  | { ok: true; snapshot: ChannelAuthoritySnapshot }
  | { ok: false; status: 403 | 503; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 503, error: "Supabase data client not configured" };
  }
  const { data: channel, error: channelError } = await dataClient
    .from("channels")
    .select("id,type,name,team_id,context_id,is_active")
    .eq("id", channelId)
    .maybeSingle();
  if (channelError) {
    return { ok: false, status: 503, error: "Failed to read channel authority snapshot" };
  }
  if (!channel || !Boolean((channel as { is_active?: unknown }).is_active)) {
    return { ok: false, status: 403, error: "Channel is not active or not found" };
  }

  const { data: memberRows, error: memberError } = await dataClient
    .from("channel_memberships")
    .select("user_id,role")
    .eq("channel_id", channelId);
  if (memberError) {
    return { ok: false, status: 503, error: "Failed to read channel membership authority state" };
  }

  const memberByUserId = new Map<string, "admin" | "member">();
  const normalizedMembers: Array<{ user_id: string; role: "admin" | "member" }> = (memberRows ?? [])
    .map((row) => ({
      user_id: String((row as { user_id?: unknown }).user_id ?? ""),
      role: (String((row as { role?: unknown }).role ?? "member") === "admin" ? "admin" : "member") as "admin" | "member",
    }))
    .filter((row) => row.user_id)
    .sort((a, b) => a.user_id.localeCompare(b.user_id));
  for (const row of normalizedMembers) {
    memberByUserId.set(row.user_id, row.role);
  }

  const hashSource = JSON.stringify({
    channel_id: channelId,
    channel_type: String((channel as { type?: unknown }).type ?? "direct"),
    name: String((channel as { name?: unknown }).name ?? ""),
    team_id: String((channel as { team_id?: unknown }).team_id ?? ""),
    context_id: String((channel as { context_id?: unknown }).context_id ?? ""),
    members: normalizedMembers,
  });
  const metadataHash = crypto.createHash("sha256").update(hashSource).digest("hex");

  const channelType = String((channel as { type?: unknown }).type ?? "direct") as ChannelType;
  return {
    ok: true,
    snapshot: {
      channelType,
      metadataHash,
      memberByUserId,
    },
  };
}

function deriveStreamSyncReadModel(
  channelId: string,
  authoritySnapshot: ChannelAuthoritySnapshot
): {
  provider_sync_status: StreamSyncStatus;
  provider_sync_updated_at: string | null;
  provider_error_code: string | null;
} {
  const syncState = streamChannelSyncStates.get(channelId);
  if (!syncState) {
    return {
      provider_sync_status: "not_synced",
      provider_sync_updated_at: null,
      provider_error_code: null,
    };
  }
  if (syncState.metadataHash !== authoritySnapshot.metadataHash) {
    return {
      provider_sync_status: "stale",
      provider_sync_updated_at: syncState.providerSyncUpdatedAt,
      provider_error_code: "authority_state_drift",
    };
  }
  return {
    provider_sync_status: "synced",
    provider_sync_updated_at: syncState.providerSyncUpdatedAt,
    provider_error_code: null,
  };
}

async function issueStreamSessionToken(input: {
  userId: string;
  channelId: string;
  tokenPurpose: ChannelTokenPurpose;
  scopeGrants: {
    chat_read: boolean;
    chat_write: boolean;
    channel_admin: boolean;
  };
  clientSessionId?: string;
}): Promise<
  | {
      ok: true;
      providerUserId: string;
      providerToken: string;
      expiresAt: string;
      ttlSeconds: number;
      providerTraceId: string;
    }
  | { ok: false; message: string }
> {
  const providerMode = String(process.env.STREAM_PROVIDER_MODE ?? "mock").toLowerCase();
  if (providerMode === "down" || providerMode === "unavailable") {
    return { ok: false, message: "Stream provider is unavailable" };
  }

  const ttlRaw = toNumberOrZero(process.env.STREAM_TOKEN_TTL_SECONDS ?? 900);
  const ttlSeconds = Math.max(60, Math.min(3600, Math.round(ttlRaw || 900)));
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const providerTraceId = `stream_trace_${crypto.randomUUID()}`;
  const providerUserId = `compass_${input.userId}`;
  const payload = {
    provider: "stream",
    provider_user_id: providerUserId,
    channel_id: input.channelId,
    token_purpose: input.tokenPurpose,
    scope_grants: input.scopeGrants,
    client_session_id: input.clientSessionId ?? null,
    exp: expiresAt,
    trace_id: providerTraceId,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = process.env.STREAM_TOKEN_SIGNING_SECRET || "stream-dev-signing-secret";
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return {
    ok: true,
    providerUserId,
    providerToken: `stream.${encoded}.${signature}`,
    expiresAt,
    ttlSeconds,
    providerTraceId,
  };
}

async function syncStreamChannelToProvider(input: {
  channelId: string;
  channelType: ChannelType;
  syncReason: ChannelSyncPayload["sync_reason"];
  memberByUserId: Map<string, "admin" | "member">;
  metadataHash: string;
}): Promise<
  | { ok: true; providerSyncUpdatedAt: string; providerTraceId: string }
  | { ok: false; message: string }
> {
  const providerMode = String(process.env.STREAM_PROVIDER_MODE ?? "mock").toLowerCase();
  if (providerMode === "down" || providerMode === "unavailable") {
    return { ok: false, message: "Stream provider is unavailable" };
  }
  const providerTraceId = `stream_sync_${crypto.randomUUID()}`;
  const providerSyncUpdatedAt = new Date().toISOString();
  void input;
  return { ok: true, providerSyncUpdatedAt, providerTraceId };
}

async function createMuxUploadSession(input: {
  uploadId: string;
  ownerUserId: string;
  filename: string;
  contentType: string;
  contentLengthBytes: number;
  journeyId: string | null;
  lessonId: string | null;
}): Promise<
  | { ok: true; providerUploadId: string; uploadUrl: string; uploadUrlExpiresAt: string }
  | { ok: false; code: "provider_unavailable"; message: string }
> {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  const forcedMock = String(process.env.MUX_PROVIDER_MODE ?? "").toLowerCase() === "mock";
  if (!forcedMock && tokenId && tokenSecret) {
    try {
      const response = await fetch("https://api.mux.com/video/v1/uploads", {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          cors_origin: process.env.MUX_UPLOAD_CORS_ORIGIN ?? "*",
          new_asset_settings: {
            playback_policy: ["signed"],
            passthrough: input.uploadId,
            mp4_support: "none",
            meta: {
              compass_upload_id: input.uploadId,
              compass_owner_user_id: input.ownerUserId,
              compass_journey_id: input.journeyId ?? "",
              compass_lesson_id: input.lessonId ?? "",
              compass_filename: input.filename,
              compass_content_type: input.contentType,
              compass_content_length_bytes: String(input.contentLengthBytes),
            },
          },
        }),
      });
      if (!response.ok) {
        return { ok: false, code: "provider_unavailable", message: "Mux upload session request failed" };
      }
      const payload = await response.json();
      const providerUploadId = String((payload as { data?: { id?: unknown } }).data?.id ?? "");
      const uploadUrl = String((payload as { data?: { url?: unknown } }).data?.url ?? "");
      if (!providerUploadId || !uploadUrl) {
        return { ok: false, code: "provider_unavailable", message: "Mux upload session response was incomplete" };
      }
      const timeoutSeconds = toNumberOrZero((payload as { data?: { timeout?: unknown } }).data?.timeout) || 3600;
      return {
        ok: true,
        providerUploadId,
        uploadUrl,
        uploadUrlExpiresAt: new Date(Date.now() + timeoutSeconds * 1000).toISOString(),
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("createMuxUploadSession live provider error", error);
      return { ok: false, code: "provider_unavailable", message: "Mux provider is unavailable" };
    }
  }

  const providerUploadId = `mux_upl_${crypto.randomUUID()}`;
  return {
    ok: true,
    providerUploadId,
    uploadUrl: `https://mock.mux.local/uploads/${providerUploadId}`,
    uploadUrlExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

function signMuxPlaybackToken(input: {
  mediaId: string;
  playbackId: string;
  subjectUserId: string;
  viewerContext: "coach" | "team_leader" | "member" | "sponsor";
  tokenExpiresAt: string;
}): string {
  const secret = process.env.MUX_PLAYBACK_TOKEN_SECRET || process.env.MUX_WEBHOOK_SECRET || "mux-dev-secret";
  const payload = {
    media_id: input.mediaId,
    playback_id: input.playbackId,
    sub: input.subjectUserId,
    viewer_context: input.viewerContext,
    exp: input.tokenExpiresAt,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `mux.${encoded}.${signature}`;
}

function verifyMuxWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | string[] | undefined;
  nowMs: number;
}): MuxWebhookVerification {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, status: "rejected_signature", code: "invalid_signature" };
  }
  const signatureRaw = Array.isArray(input.signatureHeader) ? input.signatureHeader[0] : input.signatureHeader;
  if (!signatureRaw || typeof signatureRaw !== "string") {
    return { ok: false, status: "rejected_signature", code: "invalid_signature" };
  }
  const parsed = parseMuxSignatureHeader(signatureRaw);
  if (!parsed) {
    return { ok: false, status: "rejected_signature", code: "invalid_signature" };
  }
  const replayWindowSeconds = Number(process.env.MUX_WEBHOOK_REPLAY_WINDOW_SECONDS ?? 300);
  const nowSeconds = Math.floor(input.nowMs / 1000);
  if (Math.abs(nowSeconds - parsed.timestampSeconds) > replayWindowSeconds) {
    return { ok: false, status: "rejected_replay_window", code: "replay_window_exceeded" };
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parsed.timestampSeconds}.${input.rawBody}`)
    .digest("hex");
  if (!timingSafeEqualHex(parsed.signatureHex, expected)) {
    return { ok: false, status: "rejected_signature", code: "invalid_signature" };
  }
  return { ok: true, status: "verified", timestampSeconds: parsed.timestampSeconds };
}

function parseMuxSignatureHeader(value: string): { timestampSeconds: number; signatureHex: string } | null {
  const parts = value.split(",").map((p) => p.trim());
  let timestampRaw: string | null = null;
  let signatureHex: string | null = null;
  for (const part of parts) {
    const [key, val] = part.split("=");
    if (key === "t") timestampRaw = val ?? null;
    if (key === "v1") signatureHex = val ?? null;
  }
  const timestampSeconds = Number(timestampRaw);
  if (!Number.isInteger(timestampSeconds) || timestampSeconds <= 0 || !signatureHex || !/^[a-f0-9]+$/i.test(signatureHex)) {
    return null;
  }
  return { timestampSeconds, signatureHex: signatureHex.toLowerCase() };
}

function timingSafeEqualHex(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left, "hex");
  const rightBuf = Buffer.from(right, "hex");
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function normalizeMuxWebhookEvent(body: unknown):
  | {
      ok: true;
      eventId: string;
      eventType: string;
      eventTimestampIso: string | null;
      providerAssetId: string | null;
      playbackId: string | null;
      providerErrorCode: string | null;
      object: Record<string, unknown>;
    }
  | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: "Webhook body must be a JSON object" };
  const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `evt_${crypto.randomUUID()}`;
  const eventType = typeof body.type === "string" ? body.type.trim() : "";
  if (!eventType) return { ok: false, error: "Webhook event type is required" };
  const data = isRecord(body.data) ? body.data : null;
  const object = data && isRecord(data.object) ? data.object : {};
  const playbackIds = Array.isArray(object.playback_ids) ? object.playback_ids : [];
  const firstPlaybackId = playbackIds.find((row) => isRecord(row) && typeof row.id === "string") as
    | { id: string }
    | undefined;
  const eventTimestampIso = typeof body.created_at === "string" ? body.created_at : null;
  const providerAssetId = typeof object.id === "string" ? object.id : null;
  const providerErrorCode = typeof object.error_type === "string" ? object.error_type : null;
  return {
    ok: true,
    eventId: id,
    eventType,
    eventTimestampIso,
    providerAssetId,
    playbackId: firstPlaybackId?.id ?? null,
    providerErrorCode,
    object,
  };
}

function mapMuxWebhookEventToTransition(eventType: string): { nextStatus: MuxLifecycleStatus } | null {
  const normalized = eventType.toLowerCase();
  if (normalized.endsWith("asset.created")) return { nextStatus: "processing" };
  if (normalized.endsWith("upload.asset_created")) return { nextStatus: "uploaded" };
  if (normalized.endsWith("asset.ready")) return { nextStatus: "ready" };
  if (normalized.endsWith("asset.errored") || normalized.endsWith("asset.error")) return { nextStatus: "failed" };
  if (normalized.endsWith("asset.deleted")) return { nextStatus: "deleted" };
  return null;
}

async function resolveMuxMediaFromWebhookEvent(
  object: Record<string, unknown>
): Promise<MuxMediaSessionRecord | null> {
  const passthrough = typeof object.passthrough === "string" ? object.passthrough : null;
  const providerUploadId = typeof object.upload_id === "string" ? object.upload_id : null;
  const providerAssetId = typeof object.id === "string" ? object.id : null;

  if (passthrough) {
    const byUpload = await getMuxMediaRecordByUploadId(passthrough);
    if (byUpload) return byUpload;
  }
  if (providerUploadId) {
    const mediaId = muxMediaByProviderUploadId.get(providerUploadId);
    if (mediaId) {
      const byProviderUpload = await getMuxMediaRecord(mediaId);
      if (byProviderUpload) return byProviderUpload;
    }
  }
  if (providerAssetId) {
    const mediaId = muxMediaByProviderAssetId.get(providerAssetId);
    if (mediaId) {
      const byProviderAsset = await getMuxMediaRecord(mediaId);
      if (byProviderAsset) return byProviderAsset;
    }
  }
  return null;
}

function applyMuxLifecycleTransition(
  existing: MuxMediaSessionRecord,
  requested: MuxLifecycleStatus
): { status: MuxLifecycleStatus; applied: boolean } {
  const rank: Record<MuxLifecycleStatus, number> = {
    queued_for_upload: 0,
    uploaded: 1,
    processing: 2,
    ready: 3,
    failed: 3,
    deleted: 4,
  };
  if (existing.processing_status === "deleted") {
    return { status: "deleted", applied: false };
  }
  if (rank[requested] < rank[existing.processing_status]) {
    return { status: existing.processing_status, applied: false };
  }
  return { status: requested, applied: requested !== existing.processing_status };
}

async function upsertMuxMediaRecord(record: MuxMediaSessionRecord): Promise<void> {
  muxMediaStore.set(record.media_id, record);
  muxMediaByUploadId.set(record.upload_id, record.media_id);
  muxMediaByProviderUploadId.set(record.provider_upload_id, record.media_id);
  if (record.provider_asset_id) {
    muxMediaByProviderAssetId.set(record.provider_asset_id, record.media_id);
  }
  if (record.channel_id) {
    muxMediaChannelByMediaId.set(record.media_id, record.channel_id);
  } else {
    muxMediaChannelByMediaId.delete(record.media_id);
  }
  if (!dataClient) return;
  const { error } = await dataClient
    .from("coaching_media_assets")
    .upsert(
      {
        media_id: record.media_id,
        upload_id: record.upload_id,
        provider: record.provider,
        owner_user_id: record.owner_user_id,
        journey_id: record.journey_id,
        lesson_id: record.lesson_id,
        channel_id: record.channel_id,
        filename: record.filename,
        content_type: record.content_type,
        content_length_bytes: record.content_length_bytes,
        provider_upload_id: record.provider_upload_id,
        provider_asset_id: record.provider_asset_id,
        playback_id: record.playback_id,
        upload_url: record.upload_url,
        upload_url_expires_at: record.upload_url_expires_at,
        processing_status: record.processing_status,
        playback_ready: record.playback_ready,
        last_provider_event_at: record.last_provider_event_at,
        last_provider_event_id: record.last_provider_event_id,
        provider_error_code: record.provider_error_code,
        verification_status: record.verification_status,
        created_at: record.created_at,
        updated_at: record.updated_at,
      },
      { onConflict: "media_id" }
    );
  if (error && !isRecoverableAssignmentSourceGap(error)) {
    // eslint-disable-next-line no-console
    console.error("Failed to persist mux media record", error);
  }
}

async function getMuxMediaRecord(mediaId: string): Promise<MuxMediaSessionRecord | null> {
  const inMemory = muxMediaStore.get(mediaId);
  if (inMemory) return inMemory;
  if (!dataClient) return null;
  const { data, error } = await dataClient
    .from("coaching_media_assets")
    .select(
      "media_id,upload_id,provider,owner_user_id,journey_id,lesson_id,channel_id,filename,content_type,content_length_bytes,provider_upload_id,provider_asset_id,playback_id,upload_url,upload_url_expires_at,processing_status,playback_ready,last_provider_event_at,last_provider_event_id,provider_error_code,verification_status,created_at,updated_at"
    )
    .eq("media_id", mediaId)
    .maybeSingle();
  if (error) {
    if (!isRecoverableAssignmentSourceGap(error)) {
      // eslint-disable-next-line no-console
      console.error("Failed to load mux media record", error);
    }
    return null;
  }
  if (!data) return null;
  const record = mapMuxMediaRow(data);
  await upsertMuxMediaRecord(record);
  return record;
}

async function getMuxMediaRecordByUploadId(uploadId: string): Promise<MuxMediaSessionRecord | null> {
  const mediaId = muxMediaByUploadId.get(uploadId);
  if (mediaId) return getMuxMediaRecord(mediaId);
  if (!dataClient) return null;
  const { data, error } = await dataClient
    .from("coaching_media_assets")
    .select(
      "media_id,upload_id,provider,owner_user_id,journey_id,lesson_id,channel_id,filename,content_type,content_length_bytes,provider_upload_id,provider_asset_id,playback_id,upload_url,upload_url_expires_at,processing_status,playback_ready,last_provider_event_at,last_provider_event_id,provider_error_code,verification_status,created_at,updated_at"
    )
    .eq("upload_id", uploadId)
    .maybeSingle();
  if (error) {
    if (!isRecoverableAssignmentSourceGap(error)) {
      // eslint-disable-next-line no-console
      console.error("Failed to load mux media record by upload_id", error);
    }
    return null;
  }
  if (!data) return null;
  const record = mapMuxMediaRow(data);
  await upsertMuxMediaRecord(record);
  return record;
}

function mapMuxMediaRow(row: Record<string, unknown>): MuxMediaSessionRecord {
  return {
    media_id: String(row.media_id ?? ""),
    upload_id: String(row.upload_id ?? ""),
    provider: "mux",
    owner_user_id: String(row.owner_user_id ?? ""),
    journey_id: typeof row.journey_id === "string" ? row.journey_id : null,
    lesson_id: typeof row.lesson_id === "string" ? row.lesson_id : null,
    channel_id: typeof row.channel_id === "string" ? row.channel_id : null,
    filename: String(row.filename ?? ""),
    content_type: String(row.content_type ?? ""),
    content_length_bytes: Math.max(0, toNumberOrZero(row.content_length_bytes)),
    provider_upload_id: String(row.provider_upload_id ?? ""),
    provider_asset_id: typeof row.provider_asset_id === "string" ? row.provider_asset_id : null,
    playback_id: typeof row.playback_id === "string" ? row.playback_id : null,
    upload_url: String(row.upload_url ?? ""),
    upload_url_expires_at: String(row.upload_url_expires_at ?? new Date().toISOString()),
    processing_status: normalizeMuxLifecycleStatus(row.processing_status),
    playback_ready: Boolean(row.playback_ready),
    last_provider_event_at: typeof row.last_provider_event_at === "string" ? row.last_provider_event_at : null,
    last_provider_event_id: typeof row.last_provider_event_id === "string" ? row.last_provider_event_id : null,
    provider_error_code: typeof row.provider_error_code === "string" ? row.provider_error_code : null,
    verification_status: normalizeMuxVerificationStatus(row.verification_status),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function normalizeMuxLifecycleStatus(value: unknown): MuxLifecycleStatus {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "uploaded") return "uploaded";
  if (normalized === "processing") return "processing";
  if (normalized === "ready") return "ready";
  if (normalized === "failed") return "failed";
  if (normalized === "deleted") return "deleted";
  return "queued_for_upload";
}

function normalizeMuxVerificationStatus(value: unknown): MuxMediaSessionRecord["verification_status"] {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "verified") return "verified";
  if (normalized === "rejected_signature") return "rejected_signature";
  if (normalized === "rejected_replay_window") return "rejected_replay_window";
  if (normalized === "duplicate_ignored") return "duplicate_ignored";
  return "pending";
}

async function fetchUserProfileForCalculations(userId: string): Promise<
  | { ok: true; userProfile: UserProfileForCalc }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }

  const { data, error } = await dataClient
    .from("users")
    .upsert({ id: userId }, { onConflict: "id" })
    .select("average_price_point,commission_rate,account_status")
    .single();

  if (error) {
    return {
      ok: false,
      status: 500,
      error: "Failed to fetch or initialize user profile for KPI calculations",
    };
  }

  return {
    ok: true,
    userProfile: (data ?? {}) as UserProfileForCalc,
  };
}

function summarizeCalibrationDiagnostics(
  rows: Array<{ sample_size?: unknown; rolling_error_ratio?: unknown; rolling_abs_pct_error?: unknown }>
): {
  calibration_sample_size: number;
  rolling_error_ratio: number | null;
  rolling_abs_pct_error: number | null;
  calibration_quality_band: "low" | "medium" | "high";
} {
  if (rows.length === 0) {
    return {
      calibration_sample_size: 0,
      rolling_error_ratio: null,
      rolling_abs_pct_error: null,
      calibration_quality_band: "low",
    };
  }
  const sampleTotal = rows.reduce((sum, row) => sum + Math.max(0, toNumberOrZero(row.sample_size)), 0);
  const avgErrorRatio = rows.reduce((sum, row) => sum + toNumberOrZero(row.rolling_error_ratio), 0) / rows.length;
  const avgAbsPctError = rows.reduce((sum, row) => sum + toNumberOrZero(row.rolling_abs_pct_error), 0) / rows.length;
  return {
    calibration_sample_size: Math.round(sampleTotal),
    rolling_error_ratio: Number(avgErrorRatio.toFixed(6)),
    rolling_abs_pct_error: Number(avgAbsPctError.toFixed(6)),
    calibration_quality_band: calibrationQualityBand(sampleTotal),
  };
}

async function getUserKpiCalibrationRow(userId: string, kpiId: string): Promise<
  | { ok: true; row: { multiplier: number; sample_size: number; rolling_error_ratio: number | null; rolling_abs_pct_error: number | null } | null }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }

  const { data, error } = await dataClient
    .from("user_kpi_calibration")
    .select("multiplier,sample_size,rolling_error_ratio,rolling_abs_pct_error")
    .eq("user_id", userId)
    .eq("kpi_id", kpiId)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 500, error: "Failed to fetch user KPI calibration state" };
  }
  if (!data) return { ok: true, row: null };
  return {
    ok: true,
    row: {
      multiplier: toNumberOrZero((data as { multiplier?: unknown }).multiplier) || 1,
      sample_size: Math.max(0, toNumberOrZero((data as { sample_size?: unknown }).sample_size)),
      rolling_error_ratio:
        (data as { rolling_error_ratio?: unknown }).rolling_error_ratio === null
          ? null
          : toNumberOrZero((data as { rolling_error_ratio?: unknown }).rolling_error_ratio),
      rolling_abs_pct_error:
        (data as { rolling_abs_pct_error?: unknown }).rolling_abs_pct_error === null
          ? null
          : toNumberOrZero((data as { rolling_abs_pct_error?: unknown }).rolling_abs_pct_error),
    },
  };
}

async function runDealCloseCalibration(input: {
  userId: string;
  actualLogId: string;
  closeTimestampIso: string;
  actualGci: number;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!dataClient) return { ok: false, status: 500, error: "Supabase data client not configured" };
  const closeTs = new Date(input.closeTimestampIso);
  if (Number.isNaN(closeTs.getTime())) return { ok: true };

  const lookbackStartIso = new Date(closeTs.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: pcKpis, error: pcKpisError }, { data: pcLogs, error: logsError }] = await Promise.all([
    dataClient.from("kpis").select("id,type").eq("type", "PC"),
    dataClient
      .from("kpi_logs")
      .select("kpi_id,event_timestamp,pc_generated,delay_days_applied,hold_days_applied,decay_days_applied")
      .eq("user_id", input.userId)
      .gte("event_timestamp", lookbackStartIso)
      .lte("event_timestamp", input.closeTimestampIso),
  ]);
  if (pcKpisError) return { ok: false, status: 500, error: "Failed to load PC KPI definitions for calibration" };
  if (logsError) return { ok: false, status: 500, error: "Failed to load KPI logs for calibration" };

  const pcKpiIds = new Set((pcKpis ?? []).map((row) => String((row as { id?: unknown }).id ?? "")));
  const filteredPcLogs = (pcLogs ?? []).filter((row) => pcKpiIds.has(String((row as { kpi_id?: unknown }).kpi_id ?? "")));

  const attribution = buildDealCloseAttribution({
    closeTimestampIso: input.closeTimestampIso,
    pcLogs: filteredPcLogs.map((row) => ({
      kpi_id: String((row as { kpi_id?: unknown }).kpi_id ?? ""),
      event_timestamp: String((row as { event_timestamp?: unknown }).event_timestamp ?? ""),
      pc_generated: toNumberOrZero((row as { pc_generated?: unknown }).pc_generated),
      delay_days_applied: toNumberOrZero((row as { delay_days_applied?: unknown }).delay_days_applied),
      hold_days_applied: toNumberOrZero((row as { hold_days_applied?: unknown }).hold_days_applied),
      decay_days_applied: toNumberOrZero((row as { decay_days_applied?: unknown }).decay_days_applied),
    })),
  });

  const predicted = Math.max(0, attribution.predictedGciWindow);
  const actual = Math.max(0, toNumberOrZero(input.actualGci));
  const errorRatio = predicted > 0 ? actual / predicted : null;

  const { error: eventError } = await dataClient.from("user_kpi_calibration_events").insert({
    user_id: input.userId,
    actual_log_id: input.actualLogId,
    close_timestamp: input.closeTimestampIso,
    actual_gci: Number(actual.toFixed(2)),
    predicted_gci_window: Number(predicted.toFixed(2)),
    error_ratio: errorRatio === null ? null : Number(errorRatio.toFixed(6)),
    attribution_payload: attribution,
  });
  if (eventError) return { ok: false, status: 500, error: "Failed to write calibration audit event" };

  if (predicted <= 0) return { ok: true };

  const kpiIds = Object.keys(attribution.shareByKpiId);
  if (kpiIds.length === 0) return { ok: true };

  const { data: existingRows, error: existingError } = await dataClient
    .from("user_kpi_calibration")
    .select("kpi_id,multiplier,sample_size,rolling_error_ratio,rolling_abs_pct_error")
    .eq("user_id", input.userId)
    .in("kpi_id", kpiIds);
  if (existingError) return { ok: false, status: 500, error: "Failed to load existing calibration rows" };

  const byKpi = new Map<string, { multiplier: number; sample_size: number; rolling_error_ratio: number | null; rolling_abs_pct_error: number | null }>(
    (existingRows ?? []).map((row) => [
      String((row as { kpi_id?: unknown }).kpi_id ?? ""),
      {
        multiplier: toNumberOrZero((row as { multiplier?: unknown }).multiplier) || 1,
        sample_size: Math.max(0, toNumberOrZero((row as { sample_size?: unknown }).sample_size)),
        rolling_error_ratio:
          (row as { rolling_error_ratio?: unknown }).rolling_error_ratio === null
            ? null
            : toNumberOrZero((row as { rolling_error_ratio?: unknown }).rolling_error_ratio),
        rolling_abs_pct_error:
          (row as { rolling_abs_pct_error?: unknown }).rolling_abs_pct_error === null
            ? null
            : toNumberOrZero((row as { rolling_abs_pct_error?: unknown }).rolling_abs_pct_error),
      },
    ])
  );

  const safeErrorRatio = actual / Math.max(predicted, 1e-6);
  const safeAbsPctError = Math.abs(safeErrorRatio - 1);
  const nowIso = new Date().toISOString();

  const updates = kpiIds.map((kpiId) => {
    const existing = byKpi.get(kpiId) ?? {
      multiplier: 1,
      sample_size: 0,
      rolling_error_ratio: null,
      rolling_abs_pct_error: null,
    };
    const share = toNumberOrZero(attribution.shareByKpiId[kpiId]);
    const step = computeCalibrationStep({
      multiplierOld: existing.multiplier,
      sampleSize: existing.sample_size,
      errorRatio: safeErrorRatio,
      attributionShare: share,
    });
    const nextSample = existing.sample_size + 1;
    return {
      user_id: input.userId,
      kpi_id: kpiId,
      multiplier: step.multiplierNew,
      sample_size: nextSample,
      rolling_error_ratio: nextRollingAverage(existing.rolling_error_ratio, existing.sample_size, safeErrorRatio),
      rolling_abs_pct_error: nextRollingAverage(existing.rolling_abs_pct_error, existing.sample_size, safeAbsPctError),
      last_calibrated_at: input.closeTimestampIso,
      updated_at: nowIso,
    };
  });

  const { error: upsertError } = await dataClient.from("user_kpi_calibration").upsert(updates, {
    onConflict: "user_id,kpi_id",
  });
  if (upsertError) return { ok: false, status: 500, error: "Failed to update user KPI calibration rows" };

  return { ok: true };
}

async function writeKpiLogForUser(
  userId: string,
  payload: KPIWritePayload
): Promise<
  | { ok: true; httpStatus: 200 | 201; body: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }

  if (payload.idempotency_key) {
    const { data: existingLog, error: existingLogError } = await dataClient
      .from("kpi_logs")
      .select(
        "id,user_id,kpi_id,event_timestamp,logged_value,idempotency_key,pc_generated,points_generated,actual_gci_delta,deals_closed_delta,payoff_start_date,delay_days_applied,hold_days_applied,decay_days_applied,pc_base_weight_applied,pc_user_multiplier_applied,pc_effective_weight_applied"
      )
      .eq("user_id", userId)
      .eq("idempotency_key", payload.idempotency_key)
      .maybeSingle();
    if (existingLogError) {
      return { ok: false, status: 500, error: "Failed to check idempotency key" };
    }
    if (existingLog) {
      return {
        ok: true,
        httpStatus: 200,
        body: {
          status: "duplicate",
          log: existingLog,
          effects: {
            projection: { pc_generated: toNumberOrZero(existingLog.pc_generated) },
            actuals: {
              actual_gci_delta: toNumberOrZero(existingLog.actual_gci_delta),
              deals_closed_delta: toNumberOrZero(existingLog.deals_closed_delta),
            },
            points: { gp_or_vp_points_delta: toNumberOrZero(existingLog.points_generated) },
          },
        },
      };
    }
  }

  const { data: kpi, error: kpiError } = await dataClient
    .from("kpis")
    .select("id,type,name,slug,requires_direct_value_input,pc_weight,ttc_days,ttc_definition,delay_days,hold_days,decay_days,gp_value,vp_value")
    .eq("id", payload.kpi_id)
    .single<KPIRecord>();
  if (kpiError) {
    return { ok: false, status: 500, error: "Failed to fetch KPI definition" };
  }
  if (!kpi) {
    return { ok: false, status: 404, error: "KPI not found" };
  }
  if (kpi.requires_direct_value_input && payload.logged_value === undefined) {
    return { ok: false, status: 422, error: "logged_value is required for this KPI type" };
  }

  const profile = await fetchUserProfileForCalculations(userId);
  if (!profile.ok) {
    return profile;
  }
  if (profile.userProfile.account_status === "deactivated") {
    return { ok: false, status: 403, error: "Account is deactivated; KPI logging is blocked" };
  }

  const eventTime = new Date(payload.event_timestamp);
  let userPcMultiplier = 1;
  if (kpi.type === "PC") {
    const calibration = await getUserKpiCalibrationRow(userId, kpi.id);
    if (!calibration.ok) {
      return calibration;
    }
    userPcMultiplier = calibration.row ? toNumberOrZero(calibration.row.multiplier) : 1;
  }
  const calc = calculateKpiEffects({
    kpi,
    loggedValue: payload.logged_value,
    eventTime,
    userProfile: profile.userProfile,
    userPcMultiplier,
  });
  const isPcLog = kpi.type === "PC";
  const delayDaysAppliedForInsert = isPcLog ? Math.max(0, toNumberOrZero(calc.delayDaysApplied)) : null;
  const holdDaysAppliedForInsert = isPcLog ? Math.max(0, toNumberOrZero(calc.holdDaysApplied)) : null;
  const decayDaysAppliedForInsert = isPcLog ? Math.max(1, toNumberOrZero(calc.decayDaysApplied) || 1) : null;

  const { data: insertedLog, error: insertError } = await dataClient
    .from("kpi_logs")
    .insert({
      user_id: userId,
      kpi_id: payload.kpi_id,
      event_timestamp: eventTime.toISOString(),
      logged_value: payload.logged_value ?? null,
      idempotency_key: payload.idempotency_key ?? null,
      challenge_instance_id: payload.challenge_instance_id ?? null,
      sponsored_challenge_id: payload.sponsored_challenge_id ?? null,
      pc_generated: calc.pcGenerated,
      ttc_end_date: calc.ttcEndDate,
      decay_end_date: calc.decayEndDate,
      payoff_start_date: calc.payoffStartDate,
      delay_days_applied: delayDaysAppliedForInsert,
      hold_days_applied: holdDaysAppliedForInsert,
      decay_days_applied: decayDaysAppliedForInsert,
      points_generated: calc.pointsGenerated,
      actual_gci_delta: calc.actualGciDelta,
      deals_closed_delta: calc.dealsClosedDelta,
      pc_base_weight_applied: calc.pcBaseWeightApplied,
      pc_user_multiplier_applied: calc.pcUserMultiplierApplied,
      pc_effective_weight_applied: calc.pcEffectiveWeightApplied,
      created_at: new Date().toISOString(),
    })
      .select(
      "id,user_id,kpi_id,event_timestamp,logged_value,idempotency_key,pc_generated,points_generated,actual_gci_delta,deals_closed_delta,payoff_start_date,delay_days_applied,hold_days_applied,decay_days_applied,pc_base_weight_applied,pc_user_multiplier_applied,pc_effective_weight_applied"
    )
    .single();
  if (insertError) {
    // eslint-disable-next-line no-console
    console.error("writeKpiLogForUser insert failed", {
      userId,
      kpiId: payload.kpi_id,
      eventTimestamp: payload.event_timestamp,
      loggedValue: payload.logged_value ?? null,
      insertError,
      calcSnapshot: {
        pcGenerated: calc.pcGenerated,
        pointsGenerated: calc.pointsGenerated,
        actualGciDelta: calc.actualGciDelta,
        dealsClosedDelta: calc.dealsClosedDelta,
        payoffStartDate: calc.payoffStartDate,
        delayDaysApplied: delayDaysAppliedForInsert,
        holdDaysApplied: holdDaysAppliedForInsert,
        decayDaysApplied: decayDaysAppliedForInsert,
      },
    });
    return { ok: false, status: 500, error: "Failed to write KPI log" };
  }

  const { error: touchError } = await dataClient
    .from("users")
    .update({ last_activity_timestamp: eventTime.toISOString() })
    .eq("id", userId);
  if (touchError) {
    return { ok: false, status: 500, error: "Failed to update user activity timestamp" };
  }

  if (kpi.type === "Pipeline_Anchor") {
    const { error: anchorError } = await dataClient
      .from("pipeline_anchor_status")
      .upsert(
        {
          user_id: userId,
          kpi_id: kpi.id,
          anchor_type: kpi.name ?? kpi.id,
          anchor_value: payload.logged_value ?? 0,
          updated_at: eventTime.toISOString(),
        },
        { onConflict: "user_id,kpi_id" }
      );
    if (anchorError) {
      return { ok: false, status: 500, error: "Failed to update pipeline anchor status" };
    }
  }

  if (kpi.type === "Actual" && calc.actualGciDelta > 0) {
    const calibrationRun = await runDealCloseCalibration({
      userId,
      actualLogId: String((insertedLog as { id?: unknown }).id ?? ""),
      closeTimestampIso: eventTime.toISOString(),
      actualGci: calc.actualGciDelta,
    });
    if (!calibrationRun.ok) {
      return { ok: false, status: calibrationRun.status, error: calibrationRun.error };
    }
  }

  return {
    ok: true,
    httpStatus: 201,
    body: {
      status: "ok",
      log: insertedLog,
      effects: {
        projection: { pc_generated: calc.pcGenerated },
        actuals: {
          actual_gci_delta: calc.actualGciDelta,
          deals_closed_delta: calc.dealsClosedDelta,
        },
        points: { gp_or_vp_points_delta: calc.pointsGenerated },
      },
    },
  };
}

function normalizeInviteCodeInput(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

function randomInviteChunk(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

function buildInviteCode(prefix: "TEAM" | "COACH" | "CHAL" | "JRNY"): string {
  return `${prefix}-${randomInviteChunk(4)}-${randomInviteChunk(4)}`;
}

function resolveInviteMaxUses(inviteType: "team" | "coach" | "challenge" | "journey", rawBody: unknown): number {
  const body = isRecord(rawBody) ? rawBody : {};
  const supplied = Number(body.max_uses ?? NaN);
  const fallback = inviteType === "team" ? 25 : inviteType === "coach" ? 50 : inviteType === "journey" ? 50 : 100;
  if (!Number.isFinite(supplied) || supplied <= 0) return fallback;
  return Math.min(500, Math.floor(supplied));
}

function resolveInviteExpiry(rawBody: unknown): string {
  const body = isRecord(rawBody) ? rawBody : {};
  if (typeof body.expires_at === "string" && body.expires_at.trim()) {
    const parsedMs = new Date(body.expires_at.trim()).getTime();
    if (Number.isFinite(parsedMs) && parsedMs > Date.now()) {
      return new Date(parsedMs).toISOString();
    }
  }
  if (Number.isFinite(Number(body.expires_in_days))) {
    const days = Math.max(1, Math.min(90, Math.floor(Number(body.expires_in_days))));
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

async function issueInviteCode(args: {
  inviteType: "team" | "coach" | "challenge" | "journey";
  targetId: string;
  createdBy: string;
  maxUses: number;
  expiresAtIso: string;
}): Promise<
  | {
      ok: true;
      record: {
        id: string;
        code: string;
        invite_type: "team" | "coach" | "challenge" | "journey";
        target_id: string;
        max_uses: number;
        uses_count: number;
        expires_at: string;
        is_active: boolean;
        created_at: string;
      };
    }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) return { ok: false, status: 500, error: "Supabase data client not configured" };
  const codePrefix = args.inviteType === "team" ? "TEAM" : args.inviteType === "coach" ? "COACH" : args.inviteType === "journey" ? "JRNY" : "CHAL";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = buildInviteCode(codePrefix);
    const { data, error } = await dataClient
      .from("invite_codes")
      .insert({
        code,
        invite_type: args.inviteType,
        target_id: args.targetId,
        created_by: args.createdBy,
        max_uses: args.maxUses,
        uses_count: 0,
        expires_at: args.expiresAtIso,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id,code,invite_type,target_id,max_uses,uses_count,expires_at,is_active,created_at")
      .single();
    if (!error && data) {
      return {
        ok: true,
        record: {
          id: String((data as { id?: unknown }).id ?? ""),
          code: String((data as { code?: unknown }).code ?? code),
          invite_type: String((data as { invite_type?: unknown }).invite_type ?? args.inviteType) as "team" | "coach" | "challenge" | "journey",
          target_id: String((data as { target_id?: unknown }).target_id ?? args.targetId),
          max_uses: Math.max(1, toNumberOrZero((data as { max_uses?: unknown }).max_uses)),
          uses_count: Math.max(0, toNumberOrZero((data as { uses_count?: unknown }).uses_count)),
          expires_at: String((data as { expires_at?: unknown }).expires_at ?? args.expiresAtIso),
          is_active: Boolean((data as { is_active?: unknown }).is_active),
          created_at: String((data as { created_at?: unknown }).created_at ?? new Date().toISOString()),
        },
      };
    }
    if (!error || error.code !== "23505") {
      return {
        ok: false,
        status: 500,
        error: "Failed to create invite code",
      };
    }
  }
  return { ok: false, status: 500, error: "Failed to generate unique invite code" };
}

function normalizeTier(value: unknown): CanonicalTier {
  const t = String(value ?? "free").trim().toLowerCase();
  if (t === "enterprise") return "enterprise";
  if (t === "coach") return "coach";
  if (t === "team" || t === "teams") return "team";
  if (t === "pro") return "pro";
  if (t === "basic") return "basic";
  return "free";
}

function effectivePlanFromTier(tier: CanonicalTier): EffectivePlan {
  if (tier === "basic") return "pro";
  if (tier === "pro") return "pro";
  if (tier === "team") return "team";
  if (tier === "coach") return "coach";
  if (tier === "enterprise") return "enterprise";
  return "free";
}

function defaultEntitlementsForTier(tier: CanonicalTier): EntitlementsMap {
  const isPaidSolo = tier === "basic" || tier === "pro";
  const isTeam = tier === "team";
  const isCoach = tier === "coach";
  const isEnterprise = tier === "enterprise";
  return {
    kpi_cap_per_category: 8,
    active_challenge_participation_limit: 1,
    can_join_challenges: true,
    can_start_challenges: true,
    challenge_invite_limit: isPaidSolo || isTeam || isCoach || isEnterprise ? -1 : 3,
    can_create_custom_kpis: isPaidSolo || isTeam || isCoach || isEnterprise,
    advanced_insights: isPaidSolo || isTeam || isCoach || isEnterprise,
    can_export: isPaidSolo || isTeam || isCoach || isEnterprise,
    history_days: isEnterprise ? 3650 : isPaidSolo || isTeam || isCoach ? 365 : 30,
    can_host_team_challenges: isTeam || isEnterprise,
    team_private_cross_team_limit: isTeam ? 1 : isEnterprise ? -1 : 0,
    coach_private_challenge_unlimited: isCoach || isEnterprise,
  };
}

async function loadTierEntitlements(tier: CanonicalTier): Promise<EntitlementsMap> {
  if (!dataClient) {
    return defaultEntitlementsForTier(tier);
  }
  const { data, error } = await dataClient
    .from("tier_entitlements")
    .select("entitlement_key,entitlement_value")
    .eq("tier", tier);
  if (error || !data || data.length === 0) {
    return defaultEntitlementsForTier(tier);
  }
  const seeded = defaultEntitlementsForTier(tier);
  for (const row of data) {
    const key = String((row as { entitlement_key?: unknown }).entitlement_key ?? "").trim();
    if (!key) continue;
    seeded[key] = parseEntitlementValue((row as { entitlement_value?: unknown }).entitlement_value);
  }
  return seeded;
}

function parseEntitlementValue(raw: unknown): EntitlementValue {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean" || typeof raw === "number" || typeof raw === "string") return raw;
  if (Array.isArray(raw)) return JSON.stringify(raw);
  if (isRecord(raw)) {
    if (raw.value !== undefined && (typeof raw.value === "boolean" || typeof raw.value === "number" || typeof raw.value === "string")) {
      return raw.value;
    }
    return JSON.stringify(raw);
  }
  return String(raw);
}

function toEntitlementNumber(map: EntitlementsMap, key: string, fallback: number): number {
  const value = map[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toEntitlementBool(map: EntitlementsMap, key: string, fallback: boolean): boolean {
  const value = map[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
  }
  return fallback;
}

function mapPlanSkuToTier(planSkuRaw: unknown): CanonicalTier {
  const sku = String(planSkuRaw ?? "").trim().toLowerCase();
  if (!sku) return "free";
  if (sku.includes("enterprise")) return "enterprise";
  if (sku.includes("coach")) return "coach";
  if (sku.includes("team")) return "team";
  if (sku.includes("pro") || sku.includes("basic")) return "pro";
  return "free";
}

function normalizeSubscriptionStatus(value: unknown): "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "incomplete_expired" | "inactive" {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "trialing") return "trialing";
  if (normalized === "active") return "active";
  if (normalized === "past_due") return "past_due";
  if (normalized === "canceled") return "canceled";
  if (normalized === "incomplete") return "incomplete";
  if (normalized === "incomplete_expired") return "incomplete_expired";
  return "inactive";
}

function verifyStripeWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | string[] | undefined;
  secret: string | undefined;
}): boolean {
  const secret = input.secret;
  if (!secret) return true; // dev-mode permissive when secret is not configured
  const signatureRaw = Array.isArray(input.signatureHeader) ? input.signatureHeader[0] : input.signatureHeader;
  if (!signatureRaw || typeof signatureRaw !== "string") return false;
  const parts = signatureRaw.split(",").map((part) => part.trim());
  let timestampRaw: string | null = null;
  let signatureHex: string | null = null;
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestampRaw = value ?? null;
    if (key === "v1") signatureHex = value ?? null;
  }
  const timestamp = Number(timestampRaw);
  if (!Number.isInteger(timestamp) || !signatureHex) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest("hex");
  return timingSafeEqualHex(signatureHex.toLowerCase(), expected.toLowerCase());
}

function isTierAtLeast(userTierRaw: string, requiredTierRaw: string): boolean {
  const normalizeForRank = (v: string): EffectivePlan => effectivePlanFromTier(normalizeTier(v));
  const rank: Record<EffectivePlan, number> = {
    free: 0,
    pro: 1,
    team: 2,
    coach: 2,
    enterprise: 3,
  };
  return rank[normalizeForRank(userTierRaw)] >= rank[normalizeForRank(requiredTierRaw)];
}

async function logAdminActivity(
  adminUserId: string,
  targetTable: string,
  targetId: string,
  action: string,
  changeSummary: unknown
): Promise<void> {
  if (!dataClient) return;
  await dataClient.from("admin_activity_log").insert({
    admin_user_id: adminUserId,
    target_table: targetTable,
    target_id: targetId,
    action,
    change_summary: changeSummary ?? {},
  });
}

async function ensureUserRow(userId: string): Promise<void> {
  if (!dataClient) {
    throw new Error("Supabase data client not configured");
  }
  const { error } = await dataClient
    .from("users")
    .upsert({ id: userId }, { onConflict: "id" });
  if (error) {
    throw new Error(`Failed to ensure user row: ${error.message ?? "unknown error"}`);
  }
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function checkTeamMembership(teamId: string, userId: string): Promise<
  | { ok: true; member: boolean; role?: TeamMembershipRole }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }
  const { data, error } = await dataClient
    .from("team_memberships")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 500, error: "Failed to read team membership" };
  }
  if (!data) {
    return { ok: true, member: false };
  }
  return { ok: true, member: true, role: data.role as TeamMembershipRole };
}

async function checkTeamLeader(teamId: string, userId: string): Promise<
  | { ok: true; isLeader: boolean }
  | { ok: false; status: number; error: string }
> {
  const membership = await checkTeamMembership(teamId, userId);
  if (!membership.ok) {
    return membership;
  }
  return { ok: true, isLeader: membership.member && membership.role === "team_leader" };
}

async function buildSeatContext(userId: string, tier: CanonicalTier): Promise<SeatContext> {
  if (!dataClient) {
    return { scope: "none", included: null, used: null, overage: null };
  }
  if (tier === "team") {
    const { data: teamRows, error: teamRowsError } = await dataClient
      .from("team_memberships")
      .select("team_id")
      .eq("user_id", userId)
      .eq("role", "team_leader")
      .limit(1);
    if (teamRowsError || !teamRows || teamRows.length === 0) {
      return { scope: "team", included: 10, used: 0, overage: 0 };
    }
    const teamId = String((teamRows[0] as { team_id?: unknown }).team_id ?? "");
    if (!teamId) return { scope: "team", included: 10, used: 0, overage: 0 };
    const { count } = await dataClient
      .from("team_memberships")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId);
    const used = Math.max(0, Number(count ?? 0));
    return { scope: "team", included: 10, used, overage: Math.max(0, used - 10) };
  }
  if (tier === "coach") {
    const { count } = await dataClient
      .from("coaching_engagements")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", userId)
      .in("status", ["pending", "active"]);
    const used = Math.max(0, Number(count ?? 0));
    return { scope: "coach", included: 25, used, overage: Math.max(0, used - 25) };
  }
  return { scope: "none", included: null, used: null, overage: null };
}

function normalizeGeoScope(value: unknown): "city" | "state" | "multi_state" | "national" {
  const normalized = String(value ?? "national").trim().toLowerCase();
  if (normalized === "city") return "city";
  if (normalized === "state") return "state";
  if (normalized === "multi_state") return "multi_state";
  return "national";
}

function normalizeGeoTokens(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const tokens = values
    .map((token) => (typeof token === "string" ? token.trim().toLowerCase() : ""))
    .filter(Boolean);
  return Array.from(new Set(tokens));
}

function isSponsoredChallengeGeoEligible(input: {
  geoScope: unknown;
  geoTargetValues: unknown;
  userCity: unknown;
  userState: unknown;
}): boolean {
  const scope = normalizeGeoScope(input.geoScope);
  if (scope === "national") return true;
  const targets = normalizeGeoTokens(input.geoTargetValues);
  if (targets.length === 0) return false;
  const city = String(input.userCity ?? "").trim().toLowerCase();
  const state = String(input.userState ?? "").trim().toLowerCase();
  if (scope === "city") {
    if (!city || !state) return false;
    return targets.includes(`${city},${state}`) || targets.includes(city);
  }
  if (scope === "state") {
    if (!state) return false;
    return targets.includes(state);
  }
  if (scope === "multi_state") {
    if (!state) return false;
    return targets.includes(state);
  }
  return true;
}

async function hasSharedTeamMembership(
  actorUserId: string,
  targetUserId: string
): Promise<
  | { ok: true; shared: boolean }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }
  const { data: actorTeams, error: actorError } = await dataClient
    .from("team_memberships")
    .select("team_id")
    .eq("user_id", actorUserId);
  if (actorError) return { ok: false, status: 500, error: "Failed to load actor team scope" };
  const actorTeamIds = (actorTeams ?? []).map((row) => String((row as { team_id?: unknown }).team_id ?? "")).filter(Boolean);
  if (actorTeamIds.length === 0) return { ok: true, shared: false };

  const { data: targetTeam, error: targetError } = await dataClient
    .from("team_memberships")
    .select("team_id")
    .eq("user_id", targetUserId)
    .in("team_id", actorTeamIds)
    .limit(1)
    .maybeSingle();
  if (targetError) return { ok: false, status: 500, error: "Failed to evaluate target team scope" };
  return { ok: true, shared: Boolean(targetTeam) };
}

async function findExistingDirectChannelForMemberSet(
  actorUserId: string,
  memberUserIds: string[]
): Promise<
  | {
      ok: true;
      channel:
        | {
            id: string;
            type: string;
            name: string;
            team_id: string | null;
            context_id: string | null;
            created_by: string | null;
            created_at: string;
          }
        | null;
    }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }
  const normalized = Array.from(new Set(memberUserIds)).sort();

  const { data: actorMemberships, error: membershipError } = await dataClient
    .from("channel_memberships")
    .select("channel_id")
    .eq("user_id", actorUserId);
  if (membershipError) {
    return { ok: false, status: 500, error: "Failed to load actor direct channel memberships" };
  }
  const actorChannelIds = (actorMemberships ?? [])
    .map((row) => String((row as { channel_id?: unknown }).channel_id ?? ""))
    .filter(Boolean);
  if (actorChannelIds.length === 0) {
    return { ok: true, channel: null };
  }

  const { data: directChannels, error: channelsError } = await dataClient
    .from("channels")
    .select("id,type,name,team_id,context_id,created_by,created_at")
    .in("id", actorChannelIds)
    .eq("type", "direct")
    .eq("is_active", true);
  if (channelsError) {
    return { ok: false, status: 500, error: "Failed to lookup existing direct channels" };
  }
  const directChannelIds = (directChannels ?? [])
    .map((row) => String((row as { id?: unknown }).id ?? ""))
    .filter(Boolean);
  if (directChannelIds.length === 0) {
    return { ok: true, channel: null };
  }

  const { data: memberships, error: directMembershipError } = await dataClient
    .from("channel_memberships")
    .select("channel_id,user_id")
    .in("channel_id", directChannelIds);
  if (directMembershipError) {
    return { ok: false, status: 500, error: "Failed to inspect existing direct channel membership sets" };
  }
  const directMembershipMap = new Map<string, Set<string>>();
  for (const row of memberships ?? []) {
    const channelId = String((row as { channel_id?: unknown }).channel_id ?? "");
    const userId = String((row as { user_id?: unknown }).user_id ?? "");
    if (!channelId || !userId) continue;
    const current = directMembershipMap.get(channelId) ?? new Set<string>();
    current.add(userId);
    directMembershipMap.set(channelId, current);
  }

  const normalizedKey = normalized.join("|");
  const match = (directChannels ?? []).find((row) => {
    const channelId = String((row as { id?: unknown }).id ?? "");
    const members = Array.from(directMembershipMap.get(channelId) ?? new Set<string>()).sort();
    return members.join("|") === normalizedKey;
  });

  if (!match) return { ok: true, channel: null };
  return {
    ok: true,
    channel: {
      id: String((match as { id?: unknown }).id ?? ""),
      type: String((match as { type?: unknown }).type ?? ""),
      name: String((match as { name?: unknown }).name ?? ""),
      team_id: typeof (match as { team_id?: unknown }).team_id === "string" ? String((match as { team_id?: unknown }).team_id) : null,
      context_id: typeof (match as { context_id?: unknown }).context_id === "string" ? String((match as { context_id?: unknown }).context_id) : null,
      created_by: typeof (match as { created_by?: unknown }).created_by === "string" ? String((match as { created_by?: unknown }).created_by) : null,
      created_at: String((match as { created_at?: unknown }).created_at ?? new Date().toISOString()),
    },
  };
}

async function checkChannelMembership(channelId: string, userId: string): Promise<
  | { ok: true; member: boolean; role?: "admin" | "member" }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }
  const { data, error } = await dataClient
    .from("channel_memberships")
    .select("role")
    .eq("channel_id", channelId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    return { ok: false, status: 500, error: "Failed to read channel membership" };
  }
  if (!data) {
    return { ok: true, member: false };
  }
  return { ok: true, member: true, role: String(data.role) as "admin" | "member" };
}

async function isPlatformAdmin(userId: string): Promise<boolean> {
  if (!dataClient) return false;
  const { data, error } = await dataClient
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return false;
  const role = String((data as { role?: unknown }).role ?? "");
  return role === "admin" || role === "super_admin";
}

type CoachingAccessContext = {
  role: string;
  platformAdmin: boolean;
  canAuthorGlobal: boolean;
  sponsorReadOnly: boolean;
  leaderTeamIds: Set<string>;
  memberTeamIds: Set<string>;
};

type ChannelScopeEvaluation = {
  allowed: boolean;
  reason?: string;
  role: string;
};

async function getCoachingAccessContext(userId: string): Promise<
  | { ok: true; context: CoachingAccessContext }
  | { ok: false; status: number; error: string }
> {
  const roleResult = await getUserRoleForScope(userId);
  if (!roleResult.ok) return roleResult;
  const role = roleResult.role;
  const platformAdmin = role === "admin" || role === "super_admin";
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }
  const { data: teamRows, error: teamError } = await dataClient
    .from("team_memberships")
    .select("team_id,role")
    .eq("user_id", userId);
  if (teamError) {
    return { ok: false, status: 500, error: "Failed to load team scope for coaching access" };
  }
  const leaderTeamIds = new Set<string>();
  const memberTeamIds = new Set<string>();
  for (const row of teamRows ?? []) {
    const teamId = String((row as { team_id?: unknown }).team_id ?? "");
    if (!teamId) continue;
    memberTeamIds.add(teamId);
    if (String((row as { role?: unknown }).role ?? "") === "team_leader") {
      leaderTeamIds.add(teamId);
    }
  }
  const coachRole = role === "coach";
  const canAuthorGlobal = platformAdmin || coachRole;
  const sponsorReadOnly = role === "challenge_sponsor";
  return {
    ok: true,
    context: {
      role,
      platformAdmin,
      canAuthorGlobal,
      sponsorReadOnly,
      leaderTeamIds,
      memberTeamIds,
    },
  };
}

function canReadJourneyByTeam(access: CoachingAccessContext, teamId: string | null): boolean {
  if (!teamId) return access.platformAdmin || access.role === "coach";
  if (access.canAuthorGlobal) return true;
  if (access.leaderTeamIds.has(teamId)) return true;
  if (access.memberTeamIds.has(teamId)) return true;
  return false;
}

function canWriteJourneyByTeam(access: CoachingAccessContext, teamId: string | null): boolean {
  if (access.sponsorReadOnly) return false;
  if (access.canAuthorGlobal) return true;
  if (!teamId) return false;
  return access.leaderTeamIds.has(teamId);
}

async function canBroadcastToChannel(channelId: string, userId: string): Promise<
  | { ok: true; allowed: boolean }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }
  const membership = await checkChannelMembership(channelId, userId);
  if (!membership.ok) return membership;
  if (!membership.member) return { ok: true, allowed: false };
  const scope = await evaluateRoleScopeForChannel(userId, channelId, { requireLeaderForTeamScopedAdmin: true });
  if (!scope.ok) return scope;
  if (!scope.result.allowed) return { ok: true, allowed: false };

  const { data: channel, error: channelError } = await dataClient
    .from("channels")
    .select("type,team_id,is_active")
    .eq("id", channelId)
    .maybeSingle();
  if (channelError) {
    return { ok: false, status: 500, error: "Failed to load channel for broadcast permission" };
  }
  if (!channel || !Boolean((channel as { is_active?: unknown }).is_active)) {
    return { ok: true, allowed: false };
  }
  const role = scope.result.role;
  if (role === "admin" || role === "super_admin" || role === "coach") {
    return { ok: true, allowed: true };
  }
  if (role === "team_leader") {
    const teamId = String((channel as { team_id?: unknown }).team_id ?? "");
    if (!teamId) return { ok: true, allowed: false };
    const teamLeader = await checkTeamLeader(teamId, userId);
    if (!teamLeader.ok) return teamLeader;
    return { ok: true, allowed: teamLeader.isLeader && membership.role === "admin" };
  }
  if (role === "challenge_sponsor") {
    const channelType = String((channel as { type?: unknown }).type ?? "");
    return {
      ok: true,
      allowed: membership.role === "admin" && (channelType === "sponsor" || channelType === "challenge"),
    };
  }
  return { ok: true, allowed: false };
}

async function evaluateRoleScopeForChannel(
  userId: string,
  channelId: string,
  options: { requireLeaderForTeamScopedAdmin?: boolean } = {}
): Promise<
  | { ok: true; result: ChannelScopeEvaluation }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }
  const roleResult = await getUserRoleForScope(userId);
  if (!roleResult.ok) return roleResult;
  const role = roleResult.role;
  if (role === "admin" || role === "super_admin" || role === "coach") {
    return { ok: true, result: { allowed: true, role } };
  }

  const { data: channel, error: channelError } = await dataClient
    .from("channels")
    .select("id,type,team_id,context_id,is_active")
    .eq("id", channelId)
    .maybeSingle();
  if (channelError) {
    return { ok: false, status: 500, error: "Failed to load channel context for role scope" };
  }
  if (!channel || !Boolean((channel as { is_active?: unknown }).is_active)) {
    return { ok: true, result: { allowed: false, reason: "Channel is not active", role } };
  }

  const channelType = String((channel as { type?: unknown }).type ?? "direct");
  const teamId = String((channel as { team_id?: unknown }).team_id ?? "");

  if (role === "challenge_sponsor") {
    const sponsorAllowed = channelType === "sponsor" || channelType === "challenge";
    return {
      ok: true,
      result: sponsorAllowed
        ? { allowed: true, role }
        : {
            allowed: false,
            reason: "challenge_sponsor scope is limited to sponsor/challenge channels",
            role,
          },
    };
  }

  if (channelType === "sponsor") {
    return {
      ok: true,
      result: {
        allowed: false,
        reason: `${role} scope does not include sponsor channels`,
        role,
      },
    };
  }

  if (role === "team_leader" && options.requireLeaderForTeamScopedAdmin && teamId) {
    const leaderCheck = await checkTeamLeader(teamId, userId);
    if (!leaderCheck.ok) return leaderCheck;
    if (!leaderCheck.isLeader) {
      return {
        ok: true,
        result: {
          allowed: false,
          reason: "team_leader channel admin scope is limited to leader-owned team channels",
          role,
        },
      };
    }
  }

  return { ok: true, result: { allowed: true, role } };
}

async function canLeaderTargetUserForAiSuggestion(
  actorUserId: string,
  targetUserId: string
): Promise<
  | { ok: true; allowed: boolean }
  | { ok: false; status: number; error: string }
> {
  if (!dataClient) {
    return { ok: false, status: 500, error: "Supabase data client not configured" };
  }
  const { data: actorLeaderTeams, error: actorError } = await dataClient
    .from("team_memberships")
    .select("team_id")
    .eq("user_id", actorUserId)
    .eq("role", "team_leader");
  if (actorError) {
    return { ok: false, status: 500, error: "Failed to load team leader scope" };
  }
  const teamIds = (actorLeaderTeams ?? []).map((row) => String(row.team_id));
  if (teamIds.length === 0) {
    return { ok: true, allowed: false };
  }

  const { data: targetMembership, error: targetError } = await dataClient
    .from("team_memberships")
    .select("team_id")
    .eq("user_id", targetUserId)
    .in("team_id", teamIds)
    .limit(1)
    .maybeSingle();
  if (targetError) {
    return { ok: false, status: 500, error: "Failed to evaluate target team scope" };
  }

  return { ok: true, allowed: Boolean(targetMembership) };
}

async function fanOutUnreadCounters(channelId: string, senderUserId: string): Promise<void> {
  if (!dataClient) {
    throw new Error("Supabase data client not configured");
  }
  const { data: members, error: membersError } = await dataClient
    .from("channel_memberships")
    .select("user_id")
    .eq("channel_id", channelId);
  if (membersError) {
    throw new Error(`Failed to load channel members for unread fan-out: ${membersError.message ?? "unknown"}`);
  }

  const memberIds = (members ?? []).map((m) => String(m.user_id));
  if (memberIds.length === 0) return;

  const { data: existingRows, error: existingRowsError } = await dataClient
    .from("message_unreads")
    .select("channel_id,user_id,unread_count")
    .eq("channel_id", channelId)
    .in("user_id", memberIds);
  if (existingRowsError) {
    throw new Error(`Failed to load existing unread rows: ${existingRowsError.message ?? "unknown"}`);
  }
  const existingByUser = new Map(
    (existingRows ?? []).map((row) => [
      String(row.user_id),
      toNumberOrZero((row as { unread_count?: unknown }).unread_count),
    ])
  );

  const nowIso = new Date().toISOString();
  for (const userId of memberIds) {
    if (userId === senderUserId) {
      const { error } = await dataClient
        .from("message_unreads")
        .upsert(
          {
            channel_id: channelId,
            user_id: userId,
            unread_count: 0,
            last_seen_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "channel_id,user_id" }
        );
      if (error) {
        throw new Error(`Failed to update sender unread row: ${error.message ?? "unknown"}`);
      }
      continue;
    }

    const nextUnread = (existingByUser.get(userId) ?? 0) + 1;
    const { error } = await dataClient
      .from("message_unreads")
      .upsert(
        {
          channel_id: channelId,
          user_id: userId,
          unread_count: nextUnread,
          updated_at: nowIso,
        },
        { onConflict: "channel_id,user_id" }
      );
    if (error) {
      throw new Error(`Failed to update member unread row: ${error.message ?? "unknown"}`);
    }
  }
}

async function computeChallengeProgressPercent(challengeId: string, userId: string): Promise<number> {
  if (!dataClient) {
    throw new Error("Supabase data client not configured");
  }

  const { data: participant, error: participantError } = await dataClient
    .from("challenge_participants")
    .select("effective_start_at")
    .eq("challenge_id", challengeId)
    .eq("user_id", userId)
    .single();
  if (participantError || !participant) {
    throw new Error("Failed to load challenge participant");
  }

  const { data: challenge, error: challengeError } = await dataClient
    .from("challenges")
    .select("end_at")
    .eq("id", challengeId)
    .single();
  if (challengeError || !challenge) {
    throw new Error("Failed to load challenge");
  }

  const { data: challengeKpis, error: challengeKpisError } = await dataClient
    .from("challenge_kpis")
    .select("kpi_id")
    .eq("challenge_id", challengeId);
  if (challengeKpisError) {
    throw new Error("Failed to load challenge KPI mapping");
  }

  const kpiIds = (challengeKpis ?? []).map((row) => String(row.kpi_id));
  if (kpiIds.length === 0) {
    return 0;
  }

  const { data: logs, error: logsError } = await dataClient
    .from("kpi_logs")
    .select("id,kpi_id,event_timestamp")
    .eq("user_id", userId)
    .in("kpi_id", kpiIds)
    .gte("event_timestamp", participant.effective_start_at)
    .lte("event_timestamp", challenge.end_at);
  if (logsError) {
    throw new Error("Failed to load challenge logs");
  }

  const logCount = (logs ?? []).length;
  const denominator = Math.max(1, kpiIds.length);
  const progress = Math.min(100, (logCount / denominator) * 100);
  return Number(progress.toFixed(2));
}

async function buildChallengeLeaderboard(
  challengeId: string,
  limit: number
): Promise<Array<{ user_id: string; activity_count: number; progress_percent: number }>> {
  if (!dataClient) {
    throw new Error("Supabase data client not configured");
  }

  const { data: challenge, error: challengeError } = await dataClient
    .from("challenges")
    .select("end_at")
    .eq("id", challengeId)
    .single();
  if (challengeError || !challenge) {
    throw new Error("Failed to load challenge for leaderboard");
  }

  const { data: participants, error: participantsError } = await dataClient
    .from("challenge_participants")
    .select("user_id,effective_start_at,progress_percent")
    .eq("challenge_id", challengeId);
  if (participantsError) {
    throw new Error("Failed to load challenge participants");
  }
  const safeParticipants = participants ?? [];
  if (safeParticipants.length === 0) {
    return [];
  }

  const { data: challengeKpis, error: challengeKpisError } = await dataClient
    .from("challenge_kpis")
    .select("kpi_id")
    .eq("challenge_id", challengeId);
  if (challengeKpisError) {
    throw new Error("Failed to load challenge KPI mapping");
  }
  const kpiIds = (challengeKpis ?? []).map((row) => String(row.kpi_id));
  if (kpiIds.length === 0) {
    return safeParticipants
      .map((p) => ({
        user_id: String(p.user_id),
        activity_count: 0,
        progress_percent: toNumberOrZero(p.progress_percent),
      }))
      .slice(0, limit);
  }

  const userIds = safeParticipants.map((p) => String(p.user_id));
  const earliestStart = safeParticipants
    .map((p) => new Date(String(p.effective_start_at)).getTime())
    .reduce((min, t) => Math.min(min, t), Number.MAX_SAFE_INTEGER);

  const { data: logs, error: logsError } = await dataClient
    .from("kpi_logs")
    .select("user_id,kpi_id,event_timestamp")
    .in("user_id", userIds)
    .in("kpi_id", kpiIds)
    .gte("event_timestamp", new Date(earliestStart).toISOString())
    .lte("event_timestamp", challenge.end_at);
  if (logsError) {
    throw new Error("Failed to load logs for leaderboard");
  }

  const logsByUser = new Map<string, Array<{ event_timestamp: string }>>();
  for (const row of logs ?? []) {
    const key = String(row.user_id);
    const arr = logsByUser.get(key) ?? [];
    arr.push({ event_timestamp: String(row.event_timestamp) });
    logsByUser.set(key, arr);
  }

  const rows = safeParticipants.map((participant) => {
    const userId = String(participant.user_id);
    const effectiveStart = new Date(String(participant.effective_start_at)).getTime();
    const activity = (logsByUser.get(userId) ?? []).filter(
      (log) => new Date(log.event_timestamp).getTime() >= effectiveStart
    ).length;
    return {
      user_id: userId,
      activity_count: activity,
      progress_percent: toNumberOrZero(participant.progress_percent),
    };
  });

  rows.sort((a, b) => {
    if (b.activity_count !== a.activity_count) {
      return b.activity_count - a.activity_count;
    }
    return b.progress_percent - a.progress_percent;
  });
  return rows.slice(0, limit);
}

function calculateKpiEffects(input: {
  kpi: KPIRecord;
  loggedValue?: number;
  eventTime: Date;
  userProfile: UserProfileForCalc;
  userPcMultiplier?: number;
}): {
  pcGenerated: number;
  payoffStartDate: string | null;
  ttcEndDate: string | null;
  decayEndDate: string | null;
  delayDaysApplied: number;
  holdDaysApplied: number;
  decayDaysApplied: number;
  pointsGenerated: number;
  actualGciDelta: number;
  dealsClosedDelta: number;
  pcBaseWeightApplied: number | null;
  pcUserMultiplierApplied: number | null;
  pcEffectiveWeightApplied: number | null;
} {
  const { kpi, loggedValue, eventTime, userProfile, userPcMultiplier } = input;

  if (kpi.type === "GP" || kpi.type === "VP") {
    const unitPoints = Math.max(
      0,
      toNumberOrZero(kpi.type === "GP" ? kpi.gp_value : kpi.vp_value) || 1
    );
    const quantity = Math.max(0, loggedValue ?? 1);
    return {
      pcGenerated: 0,
      payoffStartDate: null,
      ttcEndDate: null,
      decayEndDate: null,
      delayDaysApplied: 0,
      holdDaysApplied: 0,
      decayDaysApplied: 0,
      pointsGenerated: Number((unitPoints * quantity).toFixed(2)),
      actualGciDelta: 0,
      dealsClosedDelta: 0,
      pcBaseWeightApplied: null,
      pcUserMultiplierApplied: null,
      pcEffectiveWeightApplied: null,
    };
  }

  if (kpi.type === "Actual") {
    return {
      pcGenerated: 0,
      payoffStartDate: null,
      ttcEndDate: null,
      decayEndDate: null,
      delayDaysApplied: 0,
      holdDaysApplied: 0,
      decayDaysApplied: 0,
      pointsGenerated: 0,
      actualGciDelta: loggedValue ?? 0,
      dealsClosedDelta: 1,
      pcBaseWeightApplied: null,
      pcUserMultiplierApplied: null,
      pcEffectiveWeightApplied: null,
    };
  }

  if (kpi.type === "PC") {
    const averagePricePoint = toNumberOrZero(
      userProfile.average_price_point
    );
    const commissionRate = toNumberOrZero(
      userProfile.commission_rate
    );
    const pcWeight = toNumberOrZero(kpi.pc_weight);
    const multiplier = toNumberOrZero(userPcMultiplier || 1) || 1;
    const effectiveWeight = pcWeight * multiplier;
    const timing = resolvePcTiming({
      ttc_days: kpi.ttc_days,
      ttc_definition: kpi.ttc_definition,
      delay_days: kpi.delay_days,
      hold_days: kpi.hold_days,
    });
    const decayDays = Math.max(1, toNumberOrZero(kpi.decay_days) || 180);
    const payoffStartDate = addDays(eventTime, timing.delayDays).toISOString();
    const ttcEndDate = addDays(eventTime, timing.delayDays + timing.holdDays).toISOString();
    const decayEndDate = addDays(eventTime, timing.delayDays + timing.holdDays + decayDays).toISOString();

    return {
      pcGenerated: averagePricePoint * commissionRate * effectiveWeight,
      payoffStartDate,
      ttcEndDate,
      decayEndDate,
      delayDaysApplied: timing.delayDays,
      holdDaysApplied: timing.holdDays,
      decayDaysApplied: decayDays,
      pointsGenerated: 0,
      actualGciDelta: 0,
      dealsClosedDelta: 0,
      pcBaseWeightApplied: Number(pcWeight.toFixed(6)),
      pcUserMultiplierApplied: Number(multiplier.toFixed(6)),
      pcEffectiveWeightApplied: Number(effectiveWeight.toFixed(6)),
    };
  }

  return {
    pcGenerated: 0,
    payoffStartDate: null,
    ttcEndDate: null,
    decayEndDate: null,
    delayDaysApplied: 0,
    holdDaysApplied: 0,
    decayDaysApplied: 0,
    pointsGenerated: 0,
    actualGciDelta: 0,
    dealsClosedDelta: 0,
    pcBaseWeightApplied: null,
    pcUserMultiplierApplied: null,
    pcEffectiveWeightApplied: null,
  };
}

function buildPipelineProjectionEvent(input: {
  now: Date;
  anchors: Array<{ anchor_value: number }>;
  averagePricePoint: number;
  commissionRateDecimal: number;
}): PcEvent | null {
  const totalAnchorCount = input.anchors.reduce(
    (sum, row) => sum + Math.max(0, toNumberOrZero(row.anchor_value)),
    0
  );
  if (totalAnchorCount <= 0) return null;
  const avgPrice = Math.max(0, toNumberOrZero(input.averagePricePoint));
  const commission = Math.max(0, toNumberOrZero(input.commissionRateDecimal));
  const potentialGci = totalAnchorCount * avgPrice * commission;
  if (potentialGci <= 0) return null;

  return {
    eventTimestampIso: input.now.toISOString(),
    initialPcGenerated: Number(potentialGci.toFixed(2)),
    delayBeforePayoffStartsDays: 0,
    holdDurationDays: 30,
    decayDurationDays: 1,
  };
}

function buildPastActual6mSeriesFromMetadata(
  now: Date,
  input: { ytd_gci?: number; last_year_gci?: number }
): Array<{ month_start: string; value: number }> {
  const safeYtd = Math.max(0, toNumberOrZero(input.ytd_gci));
  const safeLastYear = Math.max(0, toNumberOrZero(input.last_year_gci));
  const currentYear = now.getUTCFullYear();
  const currentMonthIndex = now.getUTCMonth();
  const monthlyYtd = safeYtd > 0 ? safeYtd / Math.max(1, currentMonthIndex + 1) : 0;
  const monthlyLastYear = safeLastYear > 0 ? safeLastYear / 12 : 0;

  return Array.from({ length: 6 }).map((_, i) => {
    const monthDate = new Date(Date.UTC(currentYear, currentMonthIndex - (5 - i), 1));
    const year = monthDate.getUTCFullYear();
    const value = year === currentYear
      ? monthlyYtd || monthlyLastYear
      : monthlyLastYear;
    return {
      month_start: monthDate.toISOString(),
      value: Number(Math.max(0, value).toFixed(2)),
    };
  });
}

function confidenceBand(score: number): "green" | "yellow" | "red" {
  if (score >= 75) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

function addDays(date: Date, days: number): Date {
  const cloned = new Date(date.getTime());
  cloned.setUTCDate(cloned.getUTCDate() + days);
  return cloned;
}

function toNumberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function errorEnvelopeResponse(
  res: express.Response,
  status: number,
  code: string,
  message: string,
  requestIdHeader?: string | string[]
) {
  const request_id =
    typeof requestIdHeader === "string" && requestIdHeader.trim()
      ? requestIdHeader.trim()
      : `req_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  return res.status(status).json({ error: { code, message, request_id } });
}

function handleSupabaseError(
  res: express.Response,
  contextMessage: string,
  error: { message?: string; code?: string }
) {
  // eslint-disable-next-line no-console
  console.error(contextMessage, error);
  if (error?.code === "PGRST116") {
    return res.status(404).json({ error: `${contextMessage}: resource not found` });
  }

  return res.status(500).json({ error: contextMessage });
}

function isRecoverableAssignmentSourceGap(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  if (code === "42P01" || code === "42703" || code === "PGRST204") {
    return true;
  }
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("could not find");
}

if (host === "0.0.0.0") {
  // eslint-disable-next-line no-console
  console.warn("Backend is exposed on your LAN (HOST=0.0.0.0). Use only for local device testing.");
}

app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`CompassKPI backend listening on http://${host}:${port}`);
});

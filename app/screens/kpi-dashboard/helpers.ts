import { getKpiTypeIconTreatment, normalizeKpiIdentifier, resolveKpiIcon } from '../../lib/kpiIcons';
import type { CustomKpiRow } from '../../lib/customKpiApi';

import {
  KPI_TYPE_SORT_ORDER,
  PC_PRIORITY_SLUG_INDEX,
  GP_BOTTOM_SLUG_INDEX,
  MAX_KPIS_PER_TYPE,
} from './constants';

import type {
  AIAssistHostSurface,
  AIAssistRequestIntent,
  ChallengeApiRow,
  ChallengeFlowItem,
  ChallengeFlowLeaderboardEntry,
  ChallengeKind,
  ChallengeKpiGroups,
  ChallengeListFilter,
  CoachAssignmentStatus,
  CoachingChannelScope,
  CoachingPackageGatePresentation,
  CoachingPackageGateTone,
  CustomKpiDraft,
  DashboardPayload,
  HomePanelTile,
  KpiTileContextBadge,
  KpiTileContextMeta,
  PipelineAnchorNagState,
  PipelineCheckinAnchorTargets,
  RuntimeNotificationDeliveryChannel,
  RuntimeNotificationItem,
  RuntimeNotificationReadState,
  RuntimeNotificationRouteTarget,
  RuntimeNotificationSeverity,
  RuntimeNotificationSummaryReadModel,
  RuntimePackageVisibilityOutcome,
  RuntimePackagingReadModel,
  RuntimeSurfaceState,
  RuntimeSurfaceStateModel,
  TeamKpiGroups,
} from './types';

export function fmtUsd(v: number) {
  const safe = Number.isFinite(v) ? v : 0;
  return `$${safe.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function fmtNum(v: number) {
  const safe = Number.isFinite(v) ? v : 0;
  return safe.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function normalizeCoachAssignmentStatus(raw: unknown): CoachAssignmentStatus {
  const value = typeof raw === 'string' ? raw : '';
  if (value === 'completed' || value === 'done') return 'completed';
  if (value === 'in_progress' || value === 'active') return 'in_progress';
  return 'pending';
}

export function fmtShortMonthDayYear(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function fmtShortMonthDay(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function fmtMonthDayTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getApiErrorMessage(payload: unknown, fallback: string) {
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

export function mapCommsHttpError(status: number, fallback: string) {
  if (status === 401) return 'Sign in is required to continue messaging (401).';
  if (status === 403) return 'Permission denied for this messaging action in current scope (403).';
  if (status === 409) return 'Messaging state changed. Refresh and retry (409).';
  if (status === 422) return 'Invalid messaging request payload. Update inputs and retry (422).';
  if (status === 503) return 'Messaging provider is temporarily unavailable. Try again shortly (503).';
  return fallback;
}

export function normalizeChannelTypeToScope(type?: string | null): CoachingChannelScope | null {
  const t = String(type ?? '').toLowerCase();
  if (t === 'team') return 'team';
  if (t === 'challenge') return 'challenge';
  if (t === 'sponsor') return 'sponsor';
  if (t === 'cohort') return 'cohort';
  if (t === 'direct') return 'community';
  return null;
}

export function normalizePackagingReadModelToVisibilityOutcome(
  readModel?: RuntimePackagingReadModel | null
): RuntimePackageVisibilityOutcome | null {
  if (!readModel) return null;
  const hasAnySignal =
    readModel.package_type != null ||
    readModel.visibility_state != null ||
    readModel.entitlement_result != null ||
    readModel.read_model_status != null ||
    readModel.linked_context_refs != null ||
    readModel.display_requirements != null;
  if (!hasAnySignal) return null;
  const refs = readModel.linked_context_refs ?? null;
  const dr = readModel.display_requirements ?? null;
  const inferredSponsorAttr =
    dr?.sponsor_attribution_required || refs?.sponsor_id || refs?.sponsored_challenge_id ? 'Sponsor-linked coaching' : null;
  const inferredDisclaimer = dr?.sponsor_disclaimer_required
    ? 'Sponsor disclaimer is required for this package-linked coaching surface.'
    : null;
  return {
    package_type: readModel.package_type ?? null,
    visibility_state: readModel.visibility_state ?? null,
    entitlement_result: readModel.entitlement_result ?? null,
    target_match: null,
    linked_context_refs: (refs as Record<string, unknown> | null) ?? null,
    display_requirements: {
      sponsor_disclaimer_required: dr?.sponsor_disclaimer_required ?? null,
      sponsor_attribution_required: dr?.sponsor_attribution_required ?? null,
      paywall_cta_required: dr?.paywall_cta_required ?? null,
      sponsor_attribution: inferredSponsorAttr,
      disclaimer: inferredDisclaimer,
    },
    read_model_status: readModel.read_model_status ?? null,
    notes: Array.isArray(readModel.notes) ? readModel.notes.filter((v): v is string => typeof v === 'string') : null,
  };
}

export function pickRuntimePackageVisibility(
  ...candidates: Array<RuntimePackageVisibilityOutcome | null | undefined>
): RuntimePackageVisibilityOutcome | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const hasAnySignal =
      candidate.package_type != null ||
      candidate.package_id != null ||
      candidate.visibility_state != null ||
      candidate.entitlement_result != null ||
      candidate.target_match != null ||
      candidate.display_requirements != null ||
      candidate.read_model_status != null;
    if (hasAnySignal) return candidate;
  }
  return null;
}

export function deriveCoachingPackageGatePresentation(
  surfaceLabel: string,
  outcome?: RuntimePackageVisibilityOutcome | null
): CoachingPackageGatePresentation {
  const packageType = String(outcome?.package_type ?? '').toLowerCase();
  const visibilityState = String(outcome?.visibility_state ?? '').toLowerCase();
  const entitlementResult = String(outcome?.entitlement_result ?? '').toLowerCase();
  const targetMatch = outcome?.target_match;
  const displayReq = outcome?.display_requirements ?? null;
  const sponsorAttr = displayReq?.sponsor_attribution?.trim() || null;
  const explicitDisclaimer = displayReq?.disclaimer?.trim() || null;
  const paywallRequired = Boolean(displayReq?.paywall_cta_required);
  const sponsorDisclaimerRequired = Boolean(displayReq?.sponsor_disclaimer_required);
  const sponsorAttributionRequired = Boolean(displayReq?.sponsor_attribution_required);
  const readModelStatus = String(outcome?.read_model_status ?? '').toLowerCase();
  const notes = Array.isArray(outcome?.notes) ? outcome?.notes.filter((v): v is string => typeof v === 'string') : [];

  const boundaryNote =
    packageType === 'sponsored_challenge_coaching_campaign'
      ? 'Sponsored coaching messaging/content is package-driven; challenge participation/results stay challenge-owned.'
      : packageType === 'paid_coaching_product'
        ? 'Paid coaching access is server-enforced; runtime UI only reflects entitlement outcomes.'
        : packageType === 'team_coaching_program'
          ? 'Team coaching package visibility is server-provided when available.'
          : null;

  if (!outcome || (!visibilityState && !entitlementResult && targetMatch == null)) {
    return {
      tone: 'fallback',
      title: 'Package Visibility Pending',
      summary: `${surfaceLabel} is using a safe fallback state because runtime package visibility/entitlement outcomes are not present on this payload.`,
      detail: 'CTAs remain visible as shell/access attempts; server-side routes remain the source of truth for permission and entitlement enforcement.',
      policyNote: boundaryNote ?? 'UI does not infer billing, sponsor approvals, or targeting policy from partial context.',
    };
  }

  const blockedByEntitlement =
    entitlementResult === 'blocked_not_entitled' ||
    entitlementResult === 'blocked_not_in_audience' ||
    entitlementResult === 'blocked_schedule' ||
    entitlementResult === 'blocked_policy';
  const blockedByVisibility =
    visibilityState.includes('blocked') ||
    visibilityState.includes('hidden') ||
    visibilityState.includes('retired') ||
    visibilityState.includes('paused');
  const allowedByEntitlement =
    entitlementResult === 'allowed' ||
    entitlementResult === 'allowed_channel_member' ||
    entitlementResult === 'allowed_tier_gated';
  const notEvaluated = entitlementResult === 'not_evaluated' || entitlementResult === 'unknown';
  const available = allowedByEntitlement && targetMatch !== false && !blockedByVisibility;

  if (available) {
    return {
      tone: 'available',
      title: 'Package Available',
      summary: `${surfaceLabel} is visible under the current runtime package/entitlement outcome.`,
      detail:
        [
          sponsorAttr ? `Sponsor: ${sponsorAttr}` : null,
          sponsorAttributionRequired ? 'Sponsor attribution required.' : null,
          sponsorDisclaimerRequired ? 'Sponsor disclaimer required.' : null,
          explicitDisclaimer,
          paywallRequired ? 'Paywall CTA may be required on linked access paths.' : null,
          readModelStatus ? `read-model: ${readModelStatus}` : null,
        ]
          .filter(Boolean)
          .join(' ') || boundaryNote || null,
      policyNote: 'UI is reflecting server-provided visibility/entitlement outcomes only.',
    };
  }

  if (blockedByEntitlement || blockedByVisibility || targetMatch === false) {
    const reason =
      entitlementResult === 'blocked_not_entitled'
        ? 'Not entitled'
        : entitlementResult === 'blocked_not_in_audience'
          ? 'Not in target audience'
          : entitlementResult === 'blocked_schedule'
            ? 'Not currently scheduled'
            : entitlementResult === 'blocked_policy'
              ? 'Blocked by policy'
              : targetMatch === false
                ? 'Targeting mismatch'
                : visibilityState
                  ? `Visibility state: ${visibilityState}`
                  : 'Access unavailable';
    const tone: CoachingPackageGateTone =
      entitlementResult === 'blocked_policy' || visibilityState.includes('blocked') ? 'blocked' : 'gated';
    return {
      tone,
      title: tone === 'blocked' ? 'Package Blocked' : 'Package Gated',
      summary: `${surfaceLabel} is not available for this context right now.`,
      detail: [reason, sponsorAttr ? `Sponsor: ${sponsorAttr}` : null, explicitDisclaimer].filter(Boolean).join(' • '),
      policyNote: boundaryNote ?? 'UI is displaying server outcomes and not computing local package policy.',
    };
  }

  if (notEvaluated) {
    return {
      tone: 'fallback',
      title: 'Package Outcome Not Evaluated',
      summary: `${surfaceLabel} received a server package read-model, but entitlement remains ${entitlementResult || 'unknown'} for this endpoint family.`,
      detail:
        [
          readModelStatus ? `read-model: ${readModelStatus}` : null,
          sponsorAttributionRequired ? 'Sponsor attribution required.' : null,
          sponsorDisclaimerRequired ? 'Sponsor disclaimer required.' : null,
          paywallRequired ? 'Paywall CTA may be required on linked access paths.' : null,
          ...notes.slice(0, 2),
        ]
          .filter(Boolean)
          .join(' • ') || null,
      policyNote:
        boundaryNote ??
        'UI keeps fallback CTA behavior until this endpoint family returns a decisive entitlement outcome.',
    };
  }

  return {
    tone: 'fallback',
    title: 'Package Visibility Unclear',
    summary: `${surfaceLabel} received partial packaging metadata without a reusable entitlement outcome.`,
    detail: explicitDisclaimer ?? null,
    policyNote: boundaryNote ?? 'UI fallback keeps CTAs non-authoritative and defers access enforcement to the server.',
  };
}

export function normalizeRuntimeNotificationSummary(input?: unknown): RuntimeNotificationSummaryReadModel | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const readModelStatus = typeof row.read_model_status === 'string' ? row.read_model_status : null;
  const notes = Array.isArray(row.notes) ? row.notes.filter((v): v is string => typeof v === 'string') : null;
  const totalCount = Number(row.total_count ?? row.total ?? row.count ?? 0);
  const unreadCount = Number(row.unread_count ?? row.unread ?? 0);
  const bannerCount = Number(row.banner_count ?? row.banner ?? 0);
  const badgeCount = Number(row.badge_count ?? row.badge ?? unreadCount);
  const badgeLabel =
    typeof row.badge_label === 'string'
      ? row.badge_label
      : badgeCount > 0
        ? `${Math.max(0, Math.round(badgeCount))}`
        : null;
  const hasSignal =
    Number.isFinite(totalCount) ||
    Number.isFinite(unreadCount) ||
    Number.isFinite(bannerCount) ||
    Number.isFinite(badgeCount) ||
    Boolean(readModelStatus) ||
    Boolean(notes?.length);
  if (!hasSignal) return null;
  return {
    total_count: Number.isFinite(totalCount) ? Math.max(0, Math.round(totalCount)) : null,
    unread_count: Number.isFinite(unreadCount) ? Math.max(0, Math.round(unreadCount)) : null,
    banner_count: Number.isFinite(bannerCount) ? Math.max(0, Math.round(bannerCount)) : null,
    badge_count: Number.isFinite(badgeCount) ? Math.max(0, Math.round(badgeCount)) : null,
    badge_label: badgeLabel,
    read_model_status: readModelStatus,
    notes,
  };
}

export function normalizeRuntimeNotificationItems(input?: unknown, sourceFamily?: string): RuntimeNotificationItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw, idx): RuntimeNotificationItem | null => {
      if (!raw || typeof raw !== 'object') return null;
      const row = raw as Record<string, unknown>;
      const notificationClass = String(
        row.notification_class ?? row.class ?? row.kind ?? row.type ?? 'notification'
      ).trim();
      const title = String(row.title ?? row.label ?? row.headline ?? '').trim();
      const bodyCandidate = row.body ?? row.summary ?? row.sub ?? row.description ?? null;
      const body = typeof bodyCandidate === 'string' ? bodyCandidate.trim() || null : null;
      const badgeLabelCandidate = row.badge_label ?? row.badge ?? row.chip_label ?? null;
      const badgeLabel = typeof badgeLabelCandidate === 'string' ? badgeLabelCandidate.trim() || null : null;
      const readStateCandidate = row.read_state ?? row.read ?? row.state ?? null;
      const readState =
        typeof readStateCandidate === 'string' && readStateCandidate.trim()
          ? (readStateCandidate.trim() as RuntimeNotificationReadState)
          : null;
      const severityCandidate = row.severity ?? row.tone ?? null;
      const severity =
        typeof severityCandidate === 'string' && severityCandidate.trim()
          ? (severityCandidate.trim() as RuntimeNotificationSeverity)
          : null;
      const deliveryRaw =
        Array.isArray(row.delivery_channels)
          ? row.delivery_channels
          : row.delivery_channel != null
            ? [row.delivery_channel]
            : Array.isArray(row.channels)
              ? row.channels
              : [];
      const deliveryChannels = deliveryRaw
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean) as RuntimeNotificationDeliveryChannel[];
      const routeRaw = (row.route_target && typeof row.route_target === 'object'
        ? row.route_target
        : null) as Record<string, unknown> | null;
      const routeTarget: RuntimeNotificationRouteTarget = {
        screen: typeof (routeRaw?.screen ?? row.screen) === 'string' ? String(routeRaw?.screen ?? row.screen) : null,
        channel_id:
          typeof (routeRaw?.channel_id ?? row.channel_id) === 'string'
            ? String(routeRaw?.channel_id ?? row.channel_id)
            : null,
        channel_name:
          typeof (routeRaw?.channel_name ?? row.channel_name) === 'string'
            ? String(routeRaw?.channel_name ?? row.channel_name)
            : null,
        journey_id:
          typeof (routeRaw?.journey_id ?? row.journey_id) === 'string'
            ? String(routeRaw?.journey_id ?? row.journey_id)
            : null,
        journey_title:
          typeof (routeRaw?.journey_title ?? row.journey_title) === 'string'
            ? String(routeRaw?.journey_title ?? row.journey_title)
            : null,
        lesson_id:
          typeof (routeRaw?.lesson_id ?? row.lesson_id) === 'string'
            ? String(routeRaw?.lesson_id ?? row.lesson_id)
            : null,
        lesson_title:
          typeof (routeRaw?.lesson_title ?? row.lesson_title) === 'string'
            ? String(routeRaw?.lesson_title ?? row.lesson_title)
            : null,
        challenge_id:
          typeof (routeRaw?.challenge_id ?? row.challenge_id) === 'string'
            ? String(routeRaw?.challenge_id ?? row.challenge_id)
            : null,
        challenge_title:
          typeof (routeRaw?.challenge_title ?? row.challenge_title) === 'string'
            ? String(routeRaw?.challenge_title ?? row.challenge_title)
            : null,
        preferred_channel_scope:
          typeof (routeRaw?.preferred_channel_scope ?? row.preferred_channel_scope) === 'string'
            ? String(routeRaw?.preferred_channel_scope ?? row.preferred_channel_scope)
            : null,
        preferred_channel_label:
          typeof (routeRaw?.preferred_channel_label ?? row.preferred_channel_label) === 'string'
            ? String(routeRaw?.preferred_channel_label ?? row.preferred_channel_label)
            : null,
      };
      const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
      const id = String(row.id ?? `${sourceFamily ?? 'notification'}-${notificationClass}-${idx}`).trim();
      if (!notificationClass || !title) return null;
      return {
        id,
        notification_class: notificationClass,
        title,
        body,
        badge_label: badgeLabel,
        read_state: readState,
        severity,
        delivery_channels: deliveryChannels.length > 0 ? deliveryChannels : null,
        route_target: routeTarget,
        source_family: sourceFamily ?? (typeof row.source_family === 'string' ? row.source_family : null),
        created_at: createdAt,
      };
    })
    .filter((item): item is RuntimeNotificationItem => Boolean(item));
}

export function summarizeNotificationRows(
  rows: RuntimeNotificationItem[],
  fallback?: { sourceLabel?: string; readModelStatus?: string | null }
): RuntimeNotificationSummaryReadModel | null {
  if (!rows.length && !fallback?.readModelStatus) return null;
  const unreadCount = rows.filter((row) => String(row.read_state ?? 'unknown').toLowerCase() !== 'read').length;
  const badgeCount = rows.filter((row) => (row.delivery_channels ?? []).some((ch) => ch === 'badge')).length || unreadCount;
  const bannerCount = rows.filter((row) => (row.delivery_channels ?? []).some((ch) => ch === 'banner')).length;
  return {
    total_count: rows.length,
    unread_count: unreadCount,
    banner_count: bannerCount,
    badge_count: badgeCount,
    badge_label: badgeCount > 0 ? String(badgeCount) : null,
    read_model_status: fallback?.readModelStatus ?? null,
    notes: fallback?.sourceLabel ? [`source:${fallback.sourceLabel}`] : null,
  };
}

export function isPartialReadModelStatus(status?: string | null) {
  const normalized = String(status ?? '').toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('partial') ||
    normalized.includes('inferred') ||
    normalized.includes('unknown') ||
    normalized.includes('not_evaluated')
  );
}

export function deriveRuntimeSurfaceStateModel(params: {
  surfaceLabel: string;
  loading?: boolean;
  errorText?: string | null;
  hasRows?: boolean;
  gateTone?: CoachingPackageGateTone | null;
  readModelStatus?: string | null;
}): RuntimeSurfaceStateModel {
  const loading = Boolean(params.loading);
  const errorText = String(params.errorText ?? '').trim();
  const hasRows = Boolean(params.hasRows);
  const gateTone = params.gateTone ?? null;
  const readModelStatus = params.readModelStatus ?? null;
  const lowerError = errorText.toLowerCase();
  const permissionDenied =
    gateTone === 'blocked' ||
    gateTone === 'gated' ||
    lowerError.includes('403') ||
    lowerError.includes('forbidden') ||
    lowerError.includes('permission') ||
    lowerError.includes('not allowed') ||
    lowerError.includes('policy');
  if (loading) {
    return {
      state: 'loading',
      title: `${params.surfaceLabel}: Loading`,
      detail: 'Loading context.',
      transitionHint: 'Updates when data returns.',
    };
  }
  if (permissionDenied) {
    return {
      state: 'permission_denied',
      title: `${params.surfaceLabel}: Permission denied`,
      detail: 'Limited by current role/package.',
      transitionHint: 'Updates when access changes.',
    };
  }
  if (errorText) {
    return {
      state: 'error',
      title: `${params.surfaceLabel}: Load error`,
      detail: errorText,
      transitionHint: 'Retry to refresh.',
    };
  }
  if (isPartialReadModelStatus(readModelStatus)) {
    return {
      state: 'partial_read_model',
      title: `${params.surfaceLabel}: Partial read-model`,
      detail: 'Some data is limited.',
      transitionHint: 'Updates when full data is available.',
    };
  }
  if (!hasRows) {
    return {
      state: 'empty',
      title: `${params.surfaceLabel}: Empty`,
      detail: 'Nothing to show yet.',
      transitionHint: 'Updates when items appear.',
    };
  }
  return {
    state: 'ready',
    title: `${params.surfaceLabel}: Ready`,
    detail: 'Data is ready.',
    transitionHint: 'Auto-updates with changes.',
  };
}

export function challengeBucketFromDates(input: { startAt?: string | null; endAt?: string | null; nowMs?: number }) {
  const nowMs = input.nowMs ?? Date.now();
  const startMs = input.startAt ? new Date(String(input.startAt)).getTime() : NaN;
  const endMs = input.endAt ? new Date(String(input.endAt)).getTime() : NaN;
  if (Number.isFinite(endMs) && endMs < nowMs) return 'completed' as const;
  if (Number.isFinite(startMs) && startMs > nowMs) return 'upcoming' as const;
  return 'active' as const;
}

export function challengeStatusLabelFromBucket(bucket: 'active' | 'upcoming' | 'completed', joined: boolean) {
  if (bucket === 'completed') return 'Completed';
  if (bucket === 'upcoming') return joined ? 'Joined' : 'Upcoming';
  return joined ? 'Joined' : 'Active';
}

export function challengeDaysLabelFromDates(bucket: 'active' | 'upcoming' | 'completed', startAt?: string | null, endAt?: string | null) {
  const now = Date.now();
  const startMs = startAt ? new Date(String(startAt)).getTime() : NaN;
  const endMs = endAt ? new Date(String(endAt)).getTime() : NaN;
  if (bucket === 'completed') return 'Completed';
  if (bucket === 'upcoming' && Number.isFinite(startMs)) {
    const days = Math.max(0, Math.ceil((startMs - now) / (24 * 60 * 60 * 1000)));
    return days <= 0 ? 'Starts today' : `Starts in ${days} day${days === 1 ? '' : 's'}`;
  }
  if (bucket === 'active' && Number.isFinite(endMs)) {
    const days = Math.max(0, Math.ceil((endMs - now) / (24 * 60 * 60 * 1000)));
    return `${days} day${days === 1 ? '' : 's'} left`;
  }
  return '';
}

export function challengeTimeframeLabel(startAt?: string | null, endAt?: string | null) {
  const start = fmtShortMonthDay(startAt);
  const end = fmtShortMonthDayYear(endAt);
  if (start && end) return `${start} - ${end}`;
  return start || end || 'Dates TBD';
}

export function challengeModeLabelFromApi(row: ChallengeApiRow) {
  const challengeKind = resolveChallengeKindFromApi(row);
  if (challengeKind === 'mini') return 'Mini';
  if (challengeKind === 'sponsored') return 'Sponsored';
  const mode = String(row.mode ?? '').toLowerCase();
  if (mode === 'team') return 'Team';
  if (mode === 'solo') return 'Single Agent';
  if (row.team_id) return 'Team';
  return 'Single Agent';
}

export function resolveChallengeKindFromApi(row: ChallengeApiRow): ChallengeKind {
  const kind = String(row.challenge_kind ?? '').toLowerCase();
  if (kind === 'team') return 'team';
  if (kind === 'mini') return 'mini';
  if (kind === 'sponsored') return 'sponsored';
  if (row.sponsored_challenge_id || row.sponsor_id) return 'sponsored';
  if (String(row.mode ?? '').toLowerCase() === 'team' || row.team_id) return 'team';
  return 'mini';
}

export function leaderboardFallbackName(userId?: string, rank?: number) {
  if (userId && userId.length >= 6) return `Member ${String(userId).slice(0, 4)}`;
  return `Member ${rank ?? ''}`.trim();
}

export function mapChallengeLeaderboardPreview(
  leaderboardTop: ChallengeApiRow['leaderboard_top'] | undefined | null
): ChallengeFlowLeaderboardEntry[] {
  const rows = Array.isArray(leaderboardTop) ? leaderboardTop : [];
  return rows.slice(0, 5).map((row, index) => ({
    rank: index + 1,
    userId: String(row.user_id ?? ''),
    // TODO(M4 challenge payload): use display names from challenge list/detail payload once backend includes profile summary.
    name: leaderboardFallbackName(String(row.user_id ?? ''), index + 1),
    pct: Math.max(0, Math.round(Number(row.progress_percent ?? 0))),
    value: Math.max(0, Math.round(Number(row.activity_count ?? 0))),
  }));
}

export function defaultChallengeFlowItems(): ChallengeFlowItem[] {
  return [
    {
      id: 'challenge-30-day-listing',
      title: '30 Day Listing Challenge',
      subtitle: 'Track listing-focused production actions this month',
      status: 'Active',
      progressPct: 60,
      timeframe: 'Nov 1 - Nov 30, 2025',
      daysLabel: '24 days left',
      participants: 12,
      sponsor: false,
      bucket: 'active',
      joined: true,
      challengeKind: 'mini',
      challengeModeLabel: 'Mini',
      targetValueLabel: '5 per month',
      raw: null,
      leaderboardPreview: [
        { rank: 1, name: 'Amy Jackson', pct: 33, value: 24 },
        { rank: 2, name: 'Sarah Johnson', pct: 18, value: 13 },
        { rank: 3, name: 'Scott Johnson', pct: 7, value: 5 },
      ],
    },
    {
      id: 'challenge-conversation-sprint',
      title: 'Conversation Sprint',
      subtitle: 'Momentum challenge for outreach and follow-up consistency',
      status: 'Upcoming',
      progressPct: 0,
      timeframe: 'Dec 1 - Dec 14, 2025',
      daysLabel: 'Starts in 4 days',
      participants: 8,
      sponsor: false,
      bucket: 'upcoming',
      joined: false,
      challengeKind: 'mini',
      challengeModeLabel: 'Mini',
      targetValueLabel: 'TBD',
      raw: null,
      leaderboardPreview: [],
    },
    {
      id: 'challenge-open-house-run',
      title: 'Open House Run',
      subtitle: 'Weekend event execution challenge with team leaderboard',
      status: 'Completed',
      progressPct: 100,
      timeframe: 'Oct 1 - Oct 31, 2025',
      daysLabel: 'Completed',
      participants: 15,
      sponsor: true,
      bucket: 'completed',
      joined: true,
      challengeKind: 'sponsored',
      challengeModeLabel: 'Sponsored',
      targetValueLabel: 'TBD',
      raw: null,
      leaderboardPreview: [],
    },
  ];
}

export function mapChallengesToFlowItems(rows: ChallengeApiRow[] | null | undefined): ChallengeFlowItem[] {
  if (!Array.isArray(rows) || rows.length === 0) return defaultChallengeFlowItems();
  return rows.map((row) => {
    const joined = !!row.my_participation;
    const bucket = challengeBucketFromDates({ startAt: row.start_at, endAt: row.end_at });
    const leaderboardPreview = mapChallengeLeaderboardPreview(row.leaderboard_top);
    const participants = Array.isArray(row.leaderboard_top) && row.leaderboard_top.length > 0
      ? row.leaderboard_top.length
      : joined
        ? 1
        : 0;
    // TODO(M4 challenge payload gap): API list payload does not expose target value metadata for details rows; keep placeholder label.
    const targetValueLabel = 'TBD';
    const subtitle =
      String(row.description ?? '').trim() ||
      'Challenge details and progress summary.';
    return {
      id: String(row.id),
      title: String(row.name ?? 'Challenge'),
      subtitle,
      status: challengeStatusLabelFromBucket(bucket, joined),
      progressPct: Math.max(0, Math.round(Number(row.my_participation?.progress_percent ?? 0))),
      timeframe: challengeTimeframeLabel(row.start_at, row.end_at),
      daysLabel: challengeDaysLabelFromDates(bucket, row.start_at, row.end_at),
      participants,
      sponsor: Boolean(row.sponsored_challenge_id ?? row.sponsor_id),
      bucket,
      joined,
      challengeKind: resolveChallengeKindFromApi(row),
      challengeModeLabel: challengeModeLabelFromApi(row),
      targetValueLabel,
      startAtIso: row.start_at ?? null,
      endAtIso: row.end_at ?? null,
      raw: row,
      leaderboardPreview,
    };
  });
}

export function challengeListFilterMatches(item: ChallengeFlowItem, filter: ChallengeListFilter) {
  if (filter === 'all') return true;
  return item.challengeKind === filter;
}

export function isApiBackedChallenge(item?: ChallengeFlowItem | null) {
  return Boolean(item?.raw?.id);
}

export function confidenceColor(band: 'green' | 'yellow' | 'red') {
  if (band === 'green') return '#2f9f56';
  if (band === 'yellow') return '#e3a62a';
  return '#d94d4d';
}

export function toPointsSpaced(values: number[], step: number, height: number, min: number, max: number, startX = 0) {
  if (values.length < 2) return '';
  return values
    .map((value, idx) => {
      const clamped = Math.max(min, Math.min(max, value));
      const y = height - ((clamped - min) / (max - min || 1)) * height;
      const x = startX + idx * step;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function yForValue(value: number, height: number, min: number, max: number) {
  const clamped = Math.max(min, Math.min(max, value));
  return height - ((clamped - min) / (max - min || 1)) * height;
}

export function formatUsdAxis(valueK: number) {
  const dollars = valueK * 1000;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1000) {
    const k = dollars / 1000;
    const label = k >= 100 ? `${Math.round(k)}` : k.toFixed(1).replace(/\.0$/, '');
    return `$${label}k`;
  }
  return `$${Math.round(dollars)}`;
}

export function kpiTypeTint(type: DashboardPayload['loggable_kpis'][number]['type']) {
  return getKpiTypeIconTreatment(type).background;
}

export function kpiTypeAccent(type: DashboardPayload['loggable_kpis'][number]['type']) {
  return getKpiTypeIconTreatment(type).foreground;
}

export function kpiSortSlug(kpi: DashboardPayload['loggable_kpis'][number]) {
  return normalizeKpiIdentifier(String(kpi.slug || kpi.name || ''));
}

export function compareKpisForSelectionOrder(
  a: DashboardPayload['loggable_kpis'][number],
  b: DashboardPayload['loggable_kpis'][number]
) {
  const typeDelta =
    (KPI_TYPE_SORT_ORDER[a.type as 'PC' | 'GP' | 'VP'] ?? 99) -
    (KPI_TYPE_SORT_ORDER[b.type as 'PC' | 'GP' | 'VP'] ?? 99);
  if (typeDelta !== 0) return typeDelta;

  const aSlug = kpiSortSlug(a);
  const bSlug = kpiSortSlug(b);

  if (a.type === 'PC' && b.type === 'PC') {
    const aIdx = PC_PRIORITY_SLUG_INDEX[aSlug];
    const bIdx = PC_PRIORITY_SLUG_INDEX[bSlug];
    const aPinned = aIdx !== undefined;
    const bPinned = bIdx !== undefined;
    if (aPinned && bPinned) return aIdx - bIdx;
    if (aPinned) return -1;
    if (bPinned) return 1;
  }

  if (a.type === 'GP' && b.type === 'GP') {
    const aIdx = GP_BOTTOM_SLUG_INDEX[aSlug];
    const bIdx = GP_BOTTOM_SLUG_INDEX[bSlug];
    const aPinned = aIdx !== undefined;
    const bPinned = bIdx !== undefined;
    if (aPinned && bPinned) return aIdx - bIdx;
    if (aPinned) return 1;
    if (bPinned) return -1;
  }

  return a.name.localeCompare(b.name);
}

export function sortSelectableKpis(
  kpis: DashboardPayload['loggable_kpis']
): DashboardPayload['loggable_kpis'] {
  return [...kpis].sort(compareKpisForSelectionOrder);
}

export function normalizeManagedKpiIds(
  ids: string[],
  allSelectable: DashboardPayload['loggable_kpis']
): string[] {
  const byId = new Map(allSelectable.map((kpi) => [kpi.id, kpi]));
  const unique = Array.from(new Set(ids)).filter((id) => byId.has(id));
  const counts: Record<'PC' | 'GP' | 'VP', number> = { PC: 0, GP: 0, VP: 0 };
  const next: string[] = [];
  for (const id of unique) {
    const kpi = byId.get(id);
    if (!kpi) continue;
    if (kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP') {
      if (counts[kpi.type] >= MAX_KPIS_PER_TYPE) continue;
      counts[kpi.type] += 1;
      next.push(id);
    }
  }
  return next;
}

export function dedupeKpisById(kpis: DashboardPayload['loggable_kpis']): DashboardPayload['loggable_kpis'] {
  const seen = new Set<string>();
  const deduped: DashboardPayload['loggable_kpis'] = [];
  for (const kpi of kpis) {
    const id = String(kpi.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(kpi);
  }
  return deduped;
}

export function emptyCustomKpiDraft(): CustomKpiDraft {
  return {
    name: '',
    slug: '',
    requiresDirectValueInput: false,
    iconSource: null,
    iconName: null,
  };
}

export function customKpiDraftFromRow(row: CustomKpiRow): CustomKpiDraft {
  const resolvedIcon = resolveKpiIcon(row);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? '',
    requiresDirectValueInput: Boolean(row.requires_direct_value_input),
    iconSource: resolvedIcon.kind === 'vector_icon' ? 'vector_icon' : 'brand_asset',
    iconName: resolvedIcon.kind === 'vector_icon' ? resolvedIcon.iconName : row.icon_name ?? row.icon_file ?? null,
  };
}

export function derivePlaceholderOverlayBadgesForHomeTile(
  _kpi: DashboardPayload['loggable_kpis'][number],
  tileIndex: number
): KpiTileContextBadge[] {
  // DEV/DEMO seam (M3-G1): make context badges visibly render on Home before challenge/team payload wiring.
  // TODO(M3-G4/M3-G5): replace with real challenge/team memberships when payload includes them.
  if (tileIndex === 0) return ['CH'];
  if (tileIndex === 1) return ['TM'];
  if (tileIndex === 2) return ['TC'];
  return [];
}

export function deriveKpiTileContextMeta(
  kpi: DashboardPayload['loggable_kpis'][number],
  payload: DashboardPayload | null,
  tileIndex: number
): KpiTileContextMeta {
  const requiredAnchorIds = new Set(
    (payload?.projection.required_pipeline_anchors ?? [])
      .map((anchor) => String(anchor.kpi_id ?? '').trim())
      .filter(Boolean)
  );
  const isRequired = requiredAnchorIds.has(String(kpi.id ?? '').trim());
  const badges = new Set<KpiTileContextBadge>();
  if (isRequired) badges.add('REQ');
  for (const badge of derivePlaceholderOverlayBadgesForHomeTile(kpi, tileIndex)) badges.add(badge);
  return {
    badges: [...badges],
    isRequired,
    isLagging: false,
  };
}

export function buildHomePanelTiles(
  kpis: DashboardPayload['loggable_kpis'],
  payload: DashboardPayload | null
): HomePanelTile[] {
  return dedupeKpisById(kpis).map((kpi, tileIndex) => ({
    kpi,
    context: deriveKpiTileContextMeta(kpi, payload, tileIndex),
  }));
}

export function rankHomePriorityKpisV1(params: {
  managedKpis: DashboardPayload['loggable_kpis'];
  favoriteKpiIds: string[];
  managedKpiIdSet: Set<string>;
  payload: DashboardPayload | null;
  gpUnlocked: boolean;
  vpUnlocked: boolean;
}) {
  const { managedKpis, favoriteKpiIds, managedKpiIdSet, payload, gpUnlocked, vpUnlocked } = params;
  const favoriteRankById = new Map(favoriteKpiIds.map((id, index) => [id, index]));
  const requiredAnchorIds = new Set(
    (payload?.projection.required_pipeline_anchors ?? [])
      .map((anchor) => String(anchor.kpi_id ?? '').trim())
      .filter(Boolean)
  );
  const lastLogMsByKpiId = new Map<string, number>();
  for (const row of payload?.recent_logs ?? []) {
    const id = String(row.kpi_id ?? '').trim();
    if (!id) continue;
    const ts = new Date(String(row.event_timestamp ?? '')).getTime();
    if (!Number.isFinite(ts)) continue;
    const prev = lastLogMsByKpiId.get(id);
    if (prev == null || ts > prev) lastLogMsByKpiId.set(id, ts);
  }
  const nowMs = Date.now();
  const baseIndexById = new Map(managedKpis.map((kpi, index) => [kpi.id, index]));

  return dedupeKpisById(managedKpis)
    .map((kpi) => {
      let score = 0;
      const id = String(kpi.id ?? '').trim();
      const favoriteRank = favoriteRankById.get(id);
      const lastLogMs = lastLogMsByKpiId.get(id);
      const isLocked = (kpi.type === 'GP' && !gpUnlocked) || (kpi.type === 'VP' && !vpUnlocked);
      const isRequiredAnchor = requiredAnchorIds.has(id);

      // TODO(M3-G7): insert challenge/team/team-challenge lagging + required inputs ahead of these heuristics.
      if (isRequiredAnchor) score += 9000;
      if (managedKpiIdSet.has(id)) score += 900;
      if (favoriteRank != null) score += 800 - favoriteRank * 20;
      if (lastLogMs == null) {
        score += 2400; // Never/recently unseen in local recent_logs -> surface it.
      } else {
        const staleDays = Math.max(0, Math.floor((nowMs - lastLogMs) / 86400000));
        score += Math.min(staleDays, 30) * 80;
      }

      // Lightweight deterministic type/value heuristics using existing payload fields.
      if (kpi.type === 'PC') score += Math.round(Number(kpi.pc_weight ?? 0) * 220);
      if (kpi.type === 'GP') score += Math.round(Number(kpi.gp_value ?? 0) * 14);
      if (kpi.type === 'VP') score += Math.round(Number(kpi.vp_value ?? 0) * 14);
      if (kpi.requires_direct_value_input) score -= 120;

      // Keep locked categories de-prioritized in Priority while preserving fallback eligibility.
      if (isLocked) score -= 7000;

      return { kpi, score, baseIndex: baseIndexById.get(kpi.id) ?? Number.MAX_SAFE_INTEGER };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.baseIndex - b.baseIndex;
    })
    .map((row) => row.kpi);
}

export function derivePipelineAnchorNagState(payload: DashboardPayload | null): PipelineAnchorNagState {
  const forceDemo = false; // DEV toggle for visual verification only; keep false in committed code.
  if (forceDemo) {
    return { severity: 'warning', missingCount: 1, staleDays: 999, lowConfidence: true };
  }
  const anchors = payload?.projection.required_pipeline_anchors ?? [];
  if (anchors.length === 0) {
    return { severity: 'warning', missingCount: 1, staleDays: 999, lowConfidence: false };
  }

  // M3-G3 v1 threshold: anchors older than 7 days are treated as stale (simple, deterministic, tunable later).
  const STALE_DAYS_THRESHOLD = 7;
  const nowMs = Date.now();
  let latestRequiredAnchorMs = 0;
  let validAnchorCount = 0;
  for (const anchor of anchors) {
    const ts = new Date(String(anchor.updated_at ?? '')).getTime();
    if (!Number.isFinite(ts)) continue;
    validAnchorCount += 1;
    if (ts > latestRequiredAnchorMs) latestRequiredAnchorMs = ts;
  }

  const missingCount = validAnchorCount === 0 ? 1 : 0;
  const staleDays =
    latestRequiredAnchorMs > 0 ? Math.max(0, Math.floor((nowMs - latestRequiredAnchorMs) / 86400000)) : 999;
  const lowConfidence = (payload?.projection.confidence.band ?? 'yellow') === 'red';

  if (missingCount > 0) {
    return { severity: 'warning', missingCount, staleDays, lowConfidence };
  }
  if (staleDays > STALE_DAYS_THRESHOLD) {
    return { severity: 'stale', missingCount, staleDays, lowConfidence };
  }
  return { severity: 'ok' };
}

export function deriveChallengeSurfaceKpis(params: {
  managedKpis: DashboardPayload['loggable_kpis'];
  favoriteKpiIds: string[];
  payload: DashboardPayload | null;
}): DashboardPayload['loggable_kpis'] {
  const { managedKpis, favoriteKpiIds, payload } = params;
  // TODO(M3-G4+): replace with real challenge membership/progress payload filtering when available.
  // v1 placeholder seam: prioritize favorited + recently active KPIs, then fill from managed KPI set.
  const byId = new Map(managedKpis.map((kpi) => [kpi.id, kpi]));
  const favorites = favoriteKpiIds.map((id) => byId.get(id)).filter(Boolean) as DashboardPayload['loggable_kpis'];
  const recentIds = Array.from(
    new Set(
      (payload?.recent_logs ?? [])
        .slice()
        .reverse()
        .map((row) => String(row.kpi_id ?? '').trim())
        .filter(Boolean)
    )
  );
  const recent = recentIds.map((id) => byId.get(id)).filter(Boolean) as DashboardPayload['loggable_kpis'];
  const merged = dedupeKpisById([...favorites, ...recent, ...managedKpis]);
  return merged.filter((kpi) => kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP');
}

export function groupChallengeKpisByType(kpis: DashboardPayload['loggable_kpis']): ChallengeKpiGroups {
  const grouped: ChallengeKpiGroups = { PC: [], GP: [], VP: [] };
  for (const kpi of dedupeKpisById(kpis)) {
    if (kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP') {
      grouped[kpi.type].push(kpi);
    }
  }
  return grouped;
}

export function deriveChallengeScopedKpis(
  challenge: ChallengeFlowItem | null | undefined,
  kpis: DashboardPayload['loggable_kpis']
): DashboardPayload['loggable_kpis'] {
  const base = dedupeKpisById(kpis).filter((kpi) => kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP');
  if (!challenge || base.length <= 8) return base;
  const tokenSource = `${challenge.title} ${challenge.subtitle} ${challenge.challengeModeLabel}`.toLowerCase();
  const tokens = Array.from(
    new Set(
      tokenSource
        .split(/[^a-z0-9]+/g)
        .map((t) => t.trim())
        .filter((t) => t.length >= 4)
    )
  );
  const scored = base
    .map((kpi, idx) => {
      const name = String(kpi.name ?? '').toLowerCase();
      const score = tokens.reduce((sum, token) => (name.includes(token) ? sum + 1 : sum), 0);
      return { kpi, score, idx };
    })
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx));
  const withMatches = scored.filter((row) => row.score > 0).map((row) => row.kpi);
  const fallback = scored.map((row) => row.kpi);
  return (withMatches.length > 0 ? withMatches : fallback).slice(0, 8);
}

export function deriveTeamSurfaceKpis(params: {
  managedKpis: DashboardPayload['loggable_kpis'];
  favoriteKpiIds: string[];
  payload: DashboardPayload | null;
}): DashboardPayload['loggable_kpis'] {
  const { managedKpis, favoriteKpiIds, payload } = params;
  // TODO(M3-G5+): replace with real team/team-challenge relevance filtering when team payload/context is available.
  // v1 placeholder seam: bias toward recently active + favorites + required pipeline-related visibility, then fill from managed KPIs.
  const byId = new Map(managedKpis.map((kpi) => [kpi.id, kpi]));
  const favorites = favoriteKpiIds.map((id) => byId.get(id)).filter(Boolean) as DashboardPayload['loggable_kpis'];
  const recentIds = Array.from(
    new Set(
      (payload?.recent_logs ?? [])
        .slice()
        .reverse()
        .map((row) => String(row.kpi_id ?? '').trim())
        .filter(Boolean)
    )
  );
  const recent = recentIds.map((id) => byId.get(id)).filter(Boolean) as DashboardPayload['loggable_kpis'];
  const requiredAnchorIds = new Set(
    (payload?.projection.required_pipeline_anchors ?? [])
      .map((row) => String(row.kpi_id ?? '').trim())
      .filter(Boolean)
  );
  const required = managedKpis.filter((kpi) => requiredAnchorIds.has(String(kpi.id ?? '')));
  const merged = dedupeKpisById([...required, ...recent, ...favorites, ...managedKpis]);
  return merged.filter((kpi) => kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP');
}

export function groupTeamKpisByType(kpis: DashboardPayload['loggable_kpis']): TeamKpiGroups {
  const grouped: TeamKpiGroups = { PC: [], GP: [], VP: [] };
  for (const kpi of dedupeKpisById(kpis)) {
    if (kpi.type === 'PC' || kpi.type === 'GP' || kpi.type === 'VP') {
      grouped[kpi.type].push(kpi);
    }
  }
  return grouped;
}

export function findPipelineCheckinAnchors(payload: DashboardPayload | null): PipelineCheckinAnchorTargets {
  const anchors = (payload?.loggable_kpis ?? []).filter((kpi) => kpi.type === 'Pipeline_Anchor');
  const listings = anchors.find((kpi) => String(kpi.name ?? '').toLowerCase().includes('listing')) ?? null;
  const buyers = anchors.find((kpi) => String(kpi.name ?? '').toLowerCase().includes('buyer')) ?? null;
  return { listings, buyers };
}

export function readPipelineAnchorCountsFromPayload(payload: DashboardPayload | null) {
  const rows = payload?.projection.required_pipeline_anchors ?? [];
  const readCount = (needle: string) => {
    const row = rows.find((item) => String(item.anchor_type ?? '').toLowerCase().includes(needle));
    return Math.max(0, Math.round(Number(row?.anchor_value ?? 0) || 0));
  };
  return {
    listings: readCount('listing'),
    buyers: readCount('buyer'),
  };
}

export function findActualGciLogKpi(payload: DashboardPayload | null) {
  const actualKpis = (payload?.loggable_kpis ?? []).filter((kpi) => kpi.type === 'Actual');
  const byName = actualKpis.find((kpi) => {
    const name = String(kpi.name ?? '').toLowerCase();
    return name.includes('gci') || name.includes('close') || name.includes('deal');
  });
  return byName ?? actualKpis[0] ?? null;
}

export function renderContextBadgeLabel(badge: KpiTileContextBadge) {
  if (badge === 'CH') return '🏆';
  if (badge === 'TM') return '👥';
  if (badge === 'TC') return '👥🏆';
  return 'REQ';
}

export function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthKeyLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(monthKeyValue: string) {
  const [year, month] = monthKeyValue.split('-').map(Number);
  const dt = new Date(year, (month ?? 1) - 1, 1);
  const mon = dt.toLocaleString(undefined, { month: 'short' });
  if ((month ?? 0) === 1) {
    const yy = String(year).slice(-2);
    return `${mon} '${yy}`;
  }
  return mon;
}

export function monthLabelFromIsoMonthStart(isoValue: string) {
  if (typeof isoValue !== 'string' || isoValue.length < 7) return '';
  const year = Number(isoValue.slice(0, 4));
  const month = Number(isoValue.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return '';
  return monthLabel(`${year}-${String(month).padStart(2, '0')}`);
}

export function aiAssistIntentForHost(host: AIAssistHostSurface): AIAssistRequestIntent {
  if (host === 'channel_thread') return 'draft_reply';
  if (host === 'coach_broadcast_compose') return 'draft_broadcast';
  if (host === 'coaching_lesson_detail') return 'reflection_prompt';
  return 'draft_support_note';
}

export function formatLogDateHeading(isoDay: string) {
  const dt = new Date(`${isoDay}T12:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return isoDay;
  const formatted = dt.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: 'long',
  });
  return formatted.replace(',', '.');
}

export function formatTodayLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isoTodayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftIsoLocalDate(isoDay: string, deltaDays: number) {
  const [year, month, day] = String(isoDay || '').split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoTodayLocal();
  const dt = new Date(year, Math.max(0, month - 1), day);
  dt.setDate(dt.getDate() + deltaDays);
  const nextYear = dt.getFullYear();
  const nextMonth = String(dt.getMonth() + 1).padStart(2, '0');
  const nextDay = String(dt.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function eventTimestampIsoForSelectedDay(isoDay: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? isoDay : isoTodayLocal();
  // Use noon UTC so the stored ISO date prefix remains the selected day across time zones.
  return `${normalized}T12:00:00.000Z`;
}

export function chartFromPayload(payload: DashboardPayload | null) {
  const pastActualRows = payload?.chart?.past_actual_6m ?? [];
  const futureProjectedRows = payload?.chart?.future_projected_12m ?? [];
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const axisPastMonthKeys = Array.from({ length: 6 }).map((_, idx) =>
    monthKeyLocal(new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + (idx - 5), 1))
  );
  const axisFutureMonthKeys = Array.from({ length: 12 }).map((_, idx) =>
    monthKeyLocal(new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + (idx + 1), 1))
  );
  const monthKeys = [...axisPastMonthKeys, ...axisFutureMonthKeys];
  const labels = monthKeys.map((k) => monthLabel(k));

  const pastValueByKey = new Map(
    pastActualRows.map((row) => [String(row.month_start ?? '').slice(0, 7), Math.round(Number(row.value ?? 0) / 1000)])
  );
  const futureValueByKey = new Map(
    futureProjectedRows.map((row) => [String(row.month_start ?? '').slice(0, 7), Math.round(Number(row.value ?? 0) / 1000)])
  );
  const pastActual = axisPastMonthKeys.map((key) => Number(pastValueByKey.get(key) ?? 0));
  const futureProjected = axisFutureMonthKeys.map((key) => Number(futureValueByKey.get(key) ?? 0));

  const rawFutureBands = payload?.chart?.confidence_band_by_month ?? [];
  const futureBandByKey = new Map<string, 'green' | 'yellow' | 'red'>();
  futureProjectedRows.forEach((row, idx) => {
    const key = String(row.month_start ?? '').slice(0, 7);
    const band = rawFutureBands[idx];
    if (key && (band === 'green' || band === 'yellow' || band === 'red')) {
      futureBandByKey.set(key, band);
    }
  });
  const futureBands = axisFutureMonthKeys.map((key) => futureBandByKey.get(key) ?? 'yellow');

  const all = [...pastActual, ...futureProjected].filter((v) => Number.isFinite(v));
  const rawMin = all.length > 0 ? Math.min(...all) : 0;
  const rawMax = all.length > 0 ? Math.max(...all) : 120;
  const rawSpan = Math.max(0, rawMax - rawMin);
  const basePadding = rawSpan > 0 ? Math.max(8, rawSpan * 0.2) : Math.max(10, rawMax * 0.35);
  let min = Math.max(0, rawMin - basePadding);
  let max = rawMax + basePadding;
  if (max - min < 20) {
    const center = (max + min) / 2;
    min = Math.max(0, center - 10);
    max = min + 20;
  }
  if (max <= min) {
    min = 0;
    max = 120;
  }

  const roundDown = (value: number) => Math.floor(value / 5) * 5;
  const roundUp = (value: number) => Math.ceil(value / 5) * 5;
  min = Math.max(0, roundDown(min));
  max = Math.max(min + 5, roundUp(max));

  const step = 52;
  const dataWidth = Math.max(step, (labels.length - 1) * step);
  const chartWidth = Math.max(320, dataWidth + 24);
  const tickStep = (max - min) / 4;
  const yTicks = [0, 1, 2, 3, 4].map((i) => Math.round(max - tickStep * i));
  const boundaryIndex = Math.max(0, pastActual.length - 1);
  const splitBaseIndex = boundaryIndex;
  const firstFutureIndex = pastActual.length;
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const splitOffsetFractionRaw = (dayOfMonth - 1) / Math.max(1, daysInCurrentMonth);
  const splitOffsetFraction = Math.max(0, Math.min(1, splitOffsetFractionRaw));
  const todayLabel = formatTodayLabel(now);

  return {
    labels,
    pastActual,
    futureProjected,
    futureBands,
    boundaryIndex,
    splitBaseIndex,
    firstFutureIndex,
    splitOffsetFraction,
    todayLabel,
    step,
    chartWidth,
    dataWidth,
    min,
    max,
    yTicks,
  };
}

export const isLightColor = (hex: string): boolean => {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
};

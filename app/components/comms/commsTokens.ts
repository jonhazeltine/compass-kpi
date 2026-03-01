/**
 * Comms-specific design tokens.
 * Extends the Compass base token set with messaging-oriented values.
 */
import { colors as baseColors, radii, space } from '../../theme/tokens';

/* ── colour palette ─────────────────────────────────── */
export const commsColors = {
  // surfaces
  pageBg: baseColors.bg,              // #f4f5f7
  cardBg: '#FFFFFF',
  cardBorder: '#E2E8F0',
  inputBg: '#F1F5F9',
  inputBorder: '#CBD5E1',
  inputFocusBorder: baseColors.brand,

  // brand
  brand: baseColors.brand,            // #2158d5
  brandLight: '#EFF6FF',
  brandMuted: '#DBEAFE',

  // text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textOnBrand: '#FFFFFF',

  // semantic
  success: '#059669',
  successBg: '#D1FAE5',
  warning: '#D97706',
  warningBg: '#FEF3C7',
  error: '#DC2626',
  errorBg: '#FEE2E2',

  // bubbles
  bubbleSent: baseColors.brand,
  bubbleSentText: '#FFFFFF',
  bubbleReceived: '#F1F5F9',
  bubbleReceivedText: '#0F172A',
  bubbleBroadcast: '#FEF3C7',
  bubbleBroadcastText: '#92400E',

  // channel icons
  channelTeam: '#2563EB',
  channelTeamBg: '#DBEAFE',
  channelChallenge: '#7C3AED',
  channelChallengeBg: '#EDE9FE',
  channelSponsor: '#D97706',
  channelSponsorBg: '#FEF3C7',
  channelCohort: '#059669',
  channelCohortBg: '#D1FAE5',
  channelCommunity: '#64748B',
  channelCommunityBg: '#F1F5F9',
  channelDm: baseColors.brand,
  channelDmBg: '#DBEAFE',

  // unread
  unreadBadgeBg: '#EF4444',
  unreadBadgeText: '#FFFFFF',
  unreadDot: '#EF4444',

  // divider
  divider: '#E2E8F0',
  dividerLight: '#F1F5F9',

  // overlay
  overlay: 'rgba(15, 23, 42, 0.4)',
} as const;

/* ── spacing (extend base) ──────────────────────────── */
export const commsSpace = {
  ...space,
  channelRowPadH: 16,
  channelRowPadV: 14,
  bubblePadH: 14,
  bubblePadV: 10,
  composerPadH: 16,
  composerPadV: 12,
  sectionGap: 24,
} as const;

/* ── radii (extend base) ────────────────────────────── */
export const commsRadii = {
  ...radii,
  bubble: 18,
  bubbleTail: 4,
  channelRow: 12,
  card: 16,
  avatar: 999,
  badge: 999,
  composer: 24,
} as const;

/* ── typography ─────────────────────────────────────── */
export const commsType = {
  channelTitle: { fontSize: 15, fontWeight: '600' as const, letterSpacing: -0.2 },
  channelSnippet: { fontSize: 13, fontWeight: '400' as const },
  channelMeta: { fontSize: 11, fontWeight: '500' as const },
  bubbleBody: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bubbleMeta: { fontSize: 11, fontWeight: '400' as const },
  composerInput: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  sectionHeader: { fontSize: 12, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  badgeText: { fontSize: 11, fontWeight: '700' as const },
  filterChip: { fontSize: 13, fontWeight: '600' as const },
  emptyTitle: { fontSize: 16, fontWeight: '600' as const },
  emptySub: { fontSize: 14, fontWeight: '400' as const },
  broadcastLabel: { fontSize: 13, fontWeight: '600' as const },
} as const;

/* ── avatar sizes ───────────────────────────────────── */
export const commsAvatarSize = {
  sm: 32,
  md: 44,
  lg: 56,
} as const;

/* ── icon mapping for channel scopes ────────────────── */
export function channelScopeVisual(scope: string | null | undefined) {
  switch (scope) {
    case 'team':
      return { icon: '#', bg: commsColors.channelTeamBg, fg: commsColors.channelTeam };
    case 'challenge':
      return { icon: '⚡', bg: commsColors.channelChallengeBg, fg: commsColors.channelChallenge };
    case 'sponsor':
      return { icon: '★', bg: commsColors.channelSponsorBg, fg: commsColors.channelSponsor };
    case 'cohort':
      return { icon: '◉', bg: commsColors.channelCohortBg, fg: commsColors.channelCohort };
    case 'dm':
      return { icon: '@', bg: commsColors.channelDmBg, fg: commsColors.channelDm };
    default:
      return { icon: '#', bg: commsColors.channelCommunityBg, fg: commsColors.channelCommunity };
  }
}

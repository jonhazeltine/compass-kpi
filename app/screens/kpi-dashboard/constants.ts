import PillGrowthBg from '../../assets/figma/kpi_icon_bank/pill_growth_bg_v1.svg';
import PillProjectionsBg from '../../assets/figma/kpi_icon_bank/pill_projections_bg_v1.svg';
import PillQuicklogBg from '../../assets/figma/kpi_icon_bank/pill_quicklog_bg_v1.svg';
import PillVitalityBg from '../../assets/figma/kpi_icon_bank/pill_vitality_bg_orange_v2.svg';
import TabCoachIcon from '../../assets/figma/kpi_icon_bank/tab_coach_themeable_v3.svg';
import TabChallengeSwordsIcon from '../../assets/figma/kpi_icon_bank/tab_challenge_swords_themeable_v1.svg';
import TabDashboardIcon from '../../assets/figma/kpi_icon_bank/tab_dashboard_themeable_v1.svg';
import TabMessagesIcon from '../../assets/figma/kpi_icon_bank/tab_messages_v1.svg';
import TabReportsIcon from '../../assets/figma/kpi_icon_bank/tab_reports_v1.svg';
import TabTeamIcon from '../../assets/figma/kpi_icon_bank/tab_team_themeable_v1.svg';

import type { BottomTab, HomePanel } from './types';

export const KPI_TYPE_SORT_ORDER: Record<'PC' | 'GP' | 'VP', number> = {
  PC: 0,
  GP: 1,
  VP: 2,
};
export const PC_PRIORITY_SLUG_ORDER = [
  'listing_taken',
  'buyer_contract_signed',
  'new_client_logged',
  'appointment_set_buyer',
  'appointment_set_seller',
  'biz_post',
] as const;
export const GP_BOTTOM_SLUG_GROUP = [
  'instagram_post_shared',
  'facebook_post_shared',
  'tiktok_post_shared',
  'x_post_shared',
  'linkedin_post_shared',
  'youtube_short_posted',
] as const;
export const PC_PRIORITY_SLUG_INDEX: Record<string, number> = Object.fromEntries(
  PC_PRIORITY_SLUG_ORDER.map((slug, idx) => [slug, idx])
);
export const GP_BOTTOM_SLUG_INDEX: Record<string, number> = Object.fromEntries(
  GP_BOTTOM_SLUG_GROUP.map((slug, idx) => [slug, idx])
);

export const HOME_PANEL_ORDER: HomePanel[] = ['Quick', 'PC', 'GP', 'VP'];
export const HOME_PANEL_LABELS: Record<HomePanel, string> = {
  Quick: 'PRIORITY',
  PC: 'PROJECTIONS',
  GP: 'GROWTH',
  VP: 'VITALITY',
};
export const HOME_PANEL_ICONS: Record<HomePanel, string> = {
  Quick: '⚡',
  PC: '📈',
  GP: '🏙️',
  VP: '🌳',
};
export const GAMEPLAY_MODE_ACTIVE_WIDTH = 238;
export const GAMEPLAY_MODE_INACTIVE_WIDTH = 52;
export const GAMEPLAY_MODE_GAP = 6;
export const GAMEPLAY_MODE_LOOP_CYCLES = 3;
export const MODE_RAIL_LOOP_CYCLES = 15;
export const MODE_RAIL_MIDDLE_CYCLE = Math.floor(MODE_RAIL_LOOP_CYCLES / 2);
export const PROJECTED_CARD_WINDOWS = [30, 60, 90, 180, 360] as const;
export const ACTUAL_CARD_VIEWS = ['actual365', 'progressYtd'] as const;
export const GP_LOTTIE_SOURCE: object | number | null = null;
export const VP_LOTTIE_SOURCE: object | number | null = null;
export const PIPELINE_CHECKIN_SESSION_DISMISSED_DAYS = new Set<string>();
export const PIPELINE_CHECKIN_DISMISS_KEY_PREFIX = 'compass.pipeline_checkin.dismissed_day';
export const PIPELINE_LOST_ENCOURAGEMENT_MESSAGES = [
  'Every pipeline dip is temporary. Refill the top and keep moving.',
  'Lost deals happen. Your consistency restores momentum.',
  'Reset the count, keep the reps high, and the next win comes faster.',
] as const;
export const MAX_KPIS_PER_TYPE = 4;
export const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SELF_PROFILE_DRAWER_ID = '__self_profile__';

export const dashboardAssets = {
  crown: require('../../assets/figma/dashboard/crown.png'),
  confettiLeft: require('../../assets/figma/dashboard/confetti_left.png'),
  confettiRight: require('../../assets/figma/dashboard/confetti_right.png'),
} as const;

export const feedbackAudioAssets = {
  swipe: require('../../assets/audio/sfx/swipe_shorter.m4a'),
  logTap: require('../../assets/audio/sfx/coin_success.m4a'),
  growthTap: require('../../assets/audio/sfx/drill_growth_kpi_sound.m4a'),
  vitalityTap: require('../../assets/audio/sfx/Vitatlity2.m4a'),
  logSuccess: require('../../assets/audio/sfx/ui_coin_success.mp3'),
  locked: require('../../assets/audio/sfx/ui_locked.mp3'),
  logError: require('../../assets/audio/sfx/ui_error.mp3'),
  shimmer: require('../../assets/audio/sfx/shimmer_accumulate.wav'),
  whoosh: require('../../assets/audio/sfx/whoosh_deploy.wav'),
  comboChime: require('../../assets/audio/sfx/combo_chime.wav'),
} as const;

export const bottomTabIconSvgByKey = {
  home: TabDashboardIcon,
  challenge: TabChallengeSwordsIcon,
  coach: TabCoachIcon,
  logs: TabReportsIcon,
  team: TabTeamIcon,
  comms: TabMessagesIcon,
} as const;

export const homePanelPillSvgBg = {
  Quick: PillQuicklogBg,
  PC: PillProjectionsBg,
  GP: PillGrowthBg,
  VP: PillVitalityBg,
} as const;

export const bottomTabIconStyleByKey: Record<BottomTab, any> = {
  home: null,
  challenge: null,
  coach: null,
  logs: null,
  team: null,
  comms: { transform: [{ translateY: 3.5 }] },
};

export const bottomTabAccessibilityLabel: Record<BottomTab, string> = {
  challenge: 'Challenges',
  coach: 'Coach',
  logs: 'Reports',
  home: 'Log',
  team: 'Team',
  comms: 'Messages',
};
export const bottomTabDisplayLabel: Record<BottomTab, string> = {
  comms: 'Messages',
  team: 'Team',
  home: 'Log',
  logs: 'Reports',
  challenge: 'Challenges',
  coach: 'Coach',
};

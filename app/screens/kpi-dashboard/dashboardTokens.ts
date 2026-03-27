/**
 * dashboardTokens.ts
 * Shared design tokens for KPI Dashboard and co-located component styles.
 * Values that appear 3+ times across the style files are extracted here.
 *
 * Usage: import { DASH_COLOR_PRIMARY, DASH_RADIUS_PILL } from '../screens/kpi-dashboard/dashboardTokens';
 */

// ── Colors ─────────────────────────────────────────────────────────────────

/** Primary brand blue — used for active states, CTAs, selected pills */
export const DASH_COLOR_PRIMARY = '#1f5fe2';

/** Primary dark text — headings, card titles */
export const DASH_COLOR_TEXT_DARK = '#2f3442';

/** White — card backgrounds, inner elements */
export const DASH_COLOR_WHITE = '#fff';

/** Secondary blue — used in jb/coaching action buttons */
export const DASH_COLOR_BLUE_SECONDARY = '#2563eb';

/** Dark surface text — 1e293b (slate-800) */
export const DASH_COLOR_SLATE_800 = '#1e293b';

/** Muted text (slate-500 equivalent) */
export const DASH_COLOR_SLATE_500 = '#475569';

/** Subtle muted text (slate-400 equivalent) */
export const DASH_COLOR_SLATE_400 = '#94a3b8';

/** Destructive / error red */
export const DASH_COLOR_DANGER = '#dc2626';

/** Light blue tint — selected state backgrounds */
export const DASH_COLOR_BLUE_TINT = '#eef4ff';

/** Surface background — light grey */
export const DASH_COLOR_SURFACE = '#f8fbff';

/** Card background with subtle blue */
export const DASH_COLOR_CARD_BG = '#fbfcfe';

// ── Border Radii ────────────────────────────────────────────────────────────

/** Pill shape — fully rounded */
export const DASH_RADIUS_PILL = 999;

/** Card / container — large */
export const DASH_RADIUS_LG = 12;

/** Card — medium */
export const DASH_RADIUS_MD = 10;

/** Card — small */
export const DASH_RADIUS_SM = 8;

/** Card — extra large (modal-like) */
export const DASH_RADIUS_XL = 14;

// ── Font Sizes ──────────────────────────────────────────────────────────────

/** Body / label text */
export const DASH_FONT_XS = 10;

/** Secondary body */
export const DASH_FONT_SM = 11;

/** Standard body */
export const DASH_FONT_MD = 12;

/** Card title / strong label */
export const DASH_FONT_LG = 13;

// ── Spacing ─────────────────────────────────────────────────────────────────

/** Standard gap between items */
export const DASH_GAP_SM = 8;

/** Medium gap */
export const DASH_GAP_MD = 12;

/** Standard horizontal padding */
export const DASH_PAD_H = 16;

/** Standard vertical padding */
export const DASH_PAD_V = 12;

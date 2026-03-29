/**
 * wizardTheme — Design tokens for the Challenge Wizard.
 * Extends app tokens with wizard-specific palette.
 */
import { colors, radii, space, type as fontSize } from '../../../theme/tokens';

export const wiz = {
  // ── Surface ────────────────────────────────────────────────
  bg: '#f8faff',
  surface: '#ffffff',
  surfaceBorder: '#e3eaf5',
  overlay: 'rgba(20, 30, 55, 0.45)',

  // ── Brand ──────────────────────────────────────────────────
  primary: '#2f6bff',
  primaryDark: '#1a4fd4',
  primaryLight: '#e8efff',
  accent: '#f5b40f',
  accentLight: '#fef7e0',

  // ── KPI Type Accents ───────────────────────────────────────
  kpiPC: '#4361c2',
  kpiPCLight: '#ebeffe',
  kpiGP: '#2d9b4e',
  kpiGPLight: '#e8f7ed',
  kpiVP: '#7c5cbf',
  kpiVPLight: '#f1ecfa',

  // ── Phase Colors (cycle for multi-phase timelines) ─────────
  phaseColors: ['#4361c2', '#2d9b4e', '#d4791f', '#7c5cbf', '#c0392b', '#1a8a8a'],

  // ── Text ───────────────────────────────────────────────────
  textPrimary: '#1a2540',
  textSecondary: '#636b78',
  textMuted: '#99a3b3',
  textOnPrimary: '#ffffff',

  // ── Feedback ───────────────────────────────────────────────
  success: '#2f9f56',
  warning: '#d4a017',
  error: '#c0392b',
  tierGate: '#f0e6ff',
  tierGateBorder: '#c9b3e8',
  tierGateText: '#6b4fa0',

  // ── Spacing (wizard-specific) ──────────────────────────────
  pagePadding: 20,
  cardPadding: 16,
  sectionGap: 20,
  cardRadius: 16,
  chipRadius: 20,

  // ── Animation ──────────────────────────────────────────────
  stepTransitionMs: 280,
  cardPressDuration: 120,
  springFriction: 7,
  springTension: 160,

  // ── Re-exports from app tokens ─────────────────────────────
  colors,
  radii,
  space,
  fontSize,
} as const;

/** KPI type → accent color mapping */
export function kpiTypeColor(kpiType: string): { bg: string; text: string; light: string } {
  switch (kpiType) {
    case 'PC':
      return { bg: wiz.kpiPC, text: '#ffffff', light: wiz.kpiPCLight };
    case 'GP':
      return { bg: wiz.kpiGP, text: '#ffffff', light: wiz.kpiGPLight };
    case 'VP':
      return { bg: wiz.kpiVP, text: '#ffffff', light: wiz.kpiVPLight };
    default:
      return { bg: wiz.textMuted, text: '#ffffff', light: '#f0f2f5' };
  }
}

/** Phase index → color (cycles through palette) */
export function phaseColor(index: number): string {
  return wiz.phaseColors[index % wiz.phaseColors.length];
}

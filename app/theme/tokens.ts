export const colors = {
  bg: '#f4f5f7',
  brand: '#2158d5',
  darkButton: '#343c4a',
  textPrimary: '#343c4a',
  textSecondary: '#636b78',
  inputBg: '#eaedf1',
  border: '#d8dee7',
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 14,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const type = {
  display: 56,
  h1: 22,
  title: 22,
  subtitle: 18,
  body: 16,
  bodySm: 14,
  button: 18,
  caption: 12,
} as const;

export const lineHeights = {
  h1: 30,
  title: 30,
  body: 24,
  bodySm: 20,
  caption: 16,
} as const;

export const fontScale = {
  // Keep dynamic type readable without breaking fixed auth layouts.
  maxMultiplier: 1.1,
} as const;

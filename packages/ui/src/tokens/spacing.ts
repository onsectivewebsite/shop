/**
 * Design tokens — spacing.
 * Source of truth: DESIGN_SYSTEM.md §4.
 * Base unit 4px; stick to the scale.
 */
export const spacing = {
  0: '0',
  1: '0.25rem', // 4
  2: '0.5rem', // 8
  3: '0.75rem', // 12
  4: '1rem', // 16
  5: '1.25rem', // 20
  6: '1.5rem', // 24
  8: '2rem', // 32
  10: '2.5rem', // 40
  12: '3rem', // 48
  16: '4rem', // 64
  20: '5rem', // 80
  24: '6rem', // 96
  32: '8rem', // 128
} as const;

export const radius = {
  none: '0',
  sm: '0.25rem',
  base: '0.5rem',
  md: '0.625rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export type SpacingTokens = typeof spacing;

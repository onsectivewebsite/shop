/**
 * Design tokens — typography.
 * Source of truth: DESIGN_SYSTEM.md §3.
 */
export const typography = {
  fontFamily: {
    sans: [
      'Inter',
      '"Noto Sans"',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ],
    display: ['"Inter Display"', 'Inter', 'sans-serif'],
    mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
  },
  fontSize: {
    micro: ['0.75rem', { lineHeight: '1rem', fontWeight: '500' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem', fontWeight: '500' }],
    xl: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
    '2xl': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
    '3xl': ['1.875rem', { lineHeight: '2.375rem', fontWeight: '700' }],
    '4xl': ['2.25rem', { lineHeight: '2.75rem', fontWeight: '700' }],
    '5xl': ['3rem', { lineHeight: '3.5rem', fontWeight: '800' }],
    '6xl': ['3.75rem', { lineHeight: '4.5rem', fontWeight: '800' }],
  },
} as const;

export type TypographyTokens = typeof typography;

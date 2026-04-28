/**
 * Design tokens — colors.
 * Source of truth: DESIGN_SYSTEM.md §2.
 * Never hard-code hex elsewhere; import from here.
 */
export const colors = {
  brand: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    300: '#A5B4FC',
    500: '#6366F1',
    600: '#4F46E5', // primary
    700: '#4338CA',
    900: '#312E81',
  },
  cta: {
    50: '#FFFBEB',
    400: '#FBBF24',
    500: '#F59E0B', // primary CTA (Buy Now / Add to Cart)
    600: '#D97706',
    900: '#78350F',
  },
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  semantic: {
    success: { 500: '#10B981', 600: '#059669' },
    warning: { 500: '#F59E0B' },
    error: { 500: '#EF4444', 600: '#DC2626' },
    info: { 500: '#0EA5E9' },
  },
  signal: {
    verified: '#0EA5E9',
    topRated: '#F59E0B',
    freeShipping: '#10B981',
    onsectiveChoice: '#4F46E5',
    lowStock: '#EF4444',
    outOfStock: '#94A3B8',
  },
} as const;

export type ColorTokens = typeof colors;

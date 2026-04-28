import type { Config } from 'tailwindcss';
import { colors, typography, spacing, radius, breakpoints } from '@onsective/ui/tokens';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    screens: breakpoints,
    extend: {
      colors: {
        brand: colors.brand,
        cta: colors.cta,
        slate: colors.slate,
        success: colors.semantic.success,
        warning: { 500: colors.semantic.warning[500] },
        error: colors.semantic.error,
        info: { 500: colors.semantic.info[500] },
        signal: colors.signal,
        background: colors.slate[50],
        foreground: colors.slate[900],
      },
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      spacing,
      borderRadius: radius,
      maxWidth: {
        container: '1280px',
        dashboard: '1440px',
        prose: '768px',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};

export default config;

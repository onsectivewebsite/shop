import type { Config } from 'tailwindcss';
import { colors, typography, spacing, radius, breakpoints } from '@onsective/ui/tokens';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    screens: breakpoints,
    extend: {
      colors: {
        brand: colors.brand,
        cta: colors.cta,
        slate: colors.slate,
        signal: colors.signal,
      },
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      spacing,
      borderRadius: radius,
    },
  },
  plugins: [],
};

export default config;

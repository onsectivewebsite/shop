export { cn } from '@onsective/ui';

/**
 * Format money for display.
 * Source of truth: DESIGN_SYSTEM.md §6.8 (Price component).
 *
 * Stored as integer minor units (cents/paise) — see ADR-004.
 */
export function formatMoney(amountMinor: number, currency: string, locale = 'en-US'): string {
  // JPY has no minor units; INR/USD have 2.
  const minorUnits = currency === 'JPY' ? 0 : 2;
  const amountMajor = amountMinor / Math.pow(10, minorUnits);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(amountMajor);
}

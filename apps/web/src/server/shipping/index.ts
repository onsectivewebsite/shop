import type { CarrierAdapter } from './adapter';
import { easyPost } from './easypost';

/**
 * Pick a carrier adapter by destination country. Phase 3 will add Shiprocket
 * for India and others as we expand. Keep this routing logic narrow — it's
 * the seam where geo-policy lives.
 */
export function carrierFor(countryCode: string): CarrierAdapter {
  const cc = countryCode.toUpperCase();
  if (cc === 'US') return easyPost;
  // Default: assume EasyPost-supported. Markets without coverage should be
  // gated upstream at the listing-availability layer, not here.
  return easyPost;
}

export type { CarrierAdapter, RateQuote, ShippingAddress, ParcelDimensions } from './adapter';

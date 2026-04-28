/**
 * Carrier adapter contract — implementation-agnostic surface so we can swap
 * EasyPost (US) for Shiprocket (IN) per market without rewriting callers.
 *
 * All money is minor units (cents/paise). All sizes are millimetres /
 * grams to match the Shipment model.
 */

export type ShippingAddress = {
  recipient: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  phone: string;
};

export type ParcelDimensions = {
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
};

export type RateQuote = {
  carrier: string;
  service: string;
  amountMinor: number;
  currency: string;
  estimatedDays: number | null;
  raw: unknown;
};

export type CreatedShipment = {
  externalId: string; // carrier's shipment id
  rates: RateQuote[];
};

export type PurchasedLabel = {
  carrier: string;
  service: string;
  awbNumber: string;
  trackingUrl: string | null;
  labelUrl: string;
  shippingCostMinor: number;
  currency: string;
  raw: unknown;
};

export type CarrierAdapter = {
  name: string;
  /** Create a draft shipment + return rate options. */
  createShipment(args: {
    from: ShippingAddress;
    to: ShippingAddress;
    parcel: ParcelDimensions;
    declaredValueMinor: number;
    currency: string;
  }): Promise<CreatedShipment>;

  /** Purchase a label for one of the previously-returned rates. */
  buyLabel(args: { externalId: string; rateId: string }): Promise<PurchasedLabel>;

  /** Latest tracking snapshot for an awb. Returns null if unknown. */
  trackByAwb(awbNumber: string): Promise<{
    status: string;
    deliveredAt: Date | null;
    expectedDeliveryAt: Date | null;
    raw: unknown;
  } | null>;

  /** Verify + parse an inbound webhook event from the carrier. Throws on bad sig. */
  verifyWebhook(args: {
    body: string;
    headers: Headers;
  }): { eventType: string; awbNumber: string | null; payload: unknown };
};

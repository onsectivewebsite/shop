import type { CarrierAdapter, RateQuote } from './adapter';

/**
 * EasyPost adapter — anchor carrier for US sellers. Swap for Shiprocket via
 * country lookup once the IN integration lands.
 *
 * Uses the v2 REST API directly (no SDK) so we avoid pulling another
 * abandoned client and can stub it cleanly in tests.
 */

const BASE = 'https://api.easypost.com/v2';

function apiKey(): string {
  const k = process.env.EASYPOST_API_KEY;
  if (!k) throw new Error('EASYPOST_API_KEY env var is not set.');
  return k;
}

function authHeader(): Record<string, string> {
  // EasyPost uses HTTP basic auth: API key as user, blank password.
  const token = Buffer.from(`${apiKey()}:`).toString('base64');
  return {
    authorization: `Basic ${token}`,
    'content-type': 'application/json',
  };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeader(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EasyPost ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

type EpRate = {
  id: string;
  carrier: string;
  service: string;
  rate: string;
  currency: string;
  delivery_days: number | null;
};

type EpShipment = {
  id: string;
  rates: EpRate[];
  tracker?: { tracking_code: string; public_url: string };
  postage_label?: { label_url: string };
  selected_rate?: EpRate;
};

function dollarsToMinor(amount: string, currency: string): number {
  // EasyPost returns rate as a decimal string in major units. Convert.
  const minorPlaces = currency === 'JPY' ? 0 : 2;
  return Math.round(parseFloat(amount) * Math.pow(10, minorPlaces));
}

function gramsToOz(g: number): number {
  return Math.round((g / 28.3495) * 100) / 100;
}

function mmToInches(mm: number): number {
  return Math.round((mm / 25.4) * 100) / 100;
}

export const easyPost: CarrierAdapter = {
  name: 'easypost',

  async createShipment({ from, to, parcel, declaredValueMinor }) {
    const body = {
      shipment: {
        from_address: {
          name: from.recipient,
          street1: from.line1,
          street2: from.line2,
          city: from.city,
          state: from.state,
          zip: from.postalCode,
          country: from.countryCode,
          phone: from.phone,
        },
        to_address: {
          name: to.recipient,
          street1: to.line1,
          street2: to.line2,
          city: to.city,
          state: to.state,
          zip: to.postalCode,
          country: to.countryCode,
          phone: to.phone,
        },
        parcel: {
          length: mmToInches(parcel.lengthMm),
          width: mmToInches(parcel.widthMm),
          height: mmToInches(parcel.heightMm),
          weight: gramsToOz(parcel.weightGrams),
        },
        // Insurance amount in major-unit string per EasyPost convention.
        insurance: (declaredValueMinor / 100).toFixed(2),
      },
    };
    const shipment = await call<EpShipment>('/shipments', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const rates: RateQuote[] = shipment.rates.map((r) => ({
      carrier: r.carrier,
      service: r.service,
      amountMinor: dollarsToMinor(r.rate, r.currency),
      currency: r.currency,
      estimatedDays: r.delivery_days,
      raw: r,
    }));
    return { externalId: shipment.id, rates };
  },

  async buyLabel({ externalId, rateId }) {
    const purchased = await call<EpShipment>(`/shipments/${externalId}/buy`, {
      method: 'POST',
      body: JSON.stringify({ rate: { id: rateId } }),
    });
    const rate = purchased.selected_rate ?? purchased.rates.find((r) => r.id === rateId);
    if (!rate) throw new Error('Selected rate not present on purchased shipment');
    if (!purchased.postage_label) throw new Error('No label on purchased shipment');
    return {
      carrier: rate.carrier,
      service: rate.service,
      awbNumber: purchased.tracker?.tracking_code ?? '',
      trackingUrl: purchased.tracker?.public_url ?? null,
      labelUrl: purchased.postage_label.label_url,
      shippingCostMinor: dollarsToMinor(rate.rate, rate.currency),
      currency: rate.currency,
      raw: purchased,
    };
  },

  async trackByAwb(awbNumber) {
    const trackers = await call<{ trackers: Array<{ status: string; updated_at: string; est_delivery_date?: string; tracking_details: Array<{ status: string; datetime: string }> }> }>(
      `/trackers?tracking_code=${encodeURIComponent(awbNumber)}`,
    );
    const t = trackers.trackers[0];
    if (!t) return null;
    const delivered = t.tracking_details.find((d) => d.status === 'delivered');
    return {
      status: t.status,
      deliveredAt: delivered ? new Date(delivered.datetime) : null,
      expectedDeliveryAt: t.est_delivery_date ? new Date(t.est_delivery_date) : null,
      raw: t,
    };
  },

  verifyWebhook({ body, headers }) {
    const secret = process.env.EASYPOST_WEBHOOK_SECRET;
    if (!secret) throw new Error('EASYPOST_WEBHOOK_SECRET not set');
    const signature = headers.get('x-hmac-signature');
    if (!signature) throw new Error('Missing X-Hmac-Signature header');

    // EasyPost signs with HMAC-SHA256 of the raw body, hex-encoded, prefixed
    // with "hmac-sha256-hex=". Constant-time comparison required.
    const crypto = require('node:crypto') as typeof import('node:crypto');
    const expected = `hmac-sha256-hex=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new Error('Bad webhook signature');
    }

    const event = JSON.parse(body) as { description: string; result: { tracking_code?: string } };
    return {
      eventType: event.description,
      awbNumber: event.result?.tracking_code ?? null,
      payload: event,
    };
  },
};

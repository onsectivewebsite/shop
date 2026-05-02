/* eslint-disable no-console */
import { prisma } from '../src/server/db';

/**
 * Daily FX rate refresh.
 *
 *   pnpm --filter @onsective/web cron:fx-rates
 *
 * Source: openexchangerates.org (free tier, USD-base, 1k req/month, 200+
 * currencies). Set OPENEXCHANGERATES_APP_ID in env. The free tier is USD-
 * base only — we cross-derive non-USD pairs at read time rather than
 * storing every (base, quote) combination, but for the marketplace's launch
 * markets (USD, INR, EUR, GBP, CAD, AUD, JPY) we ALSO write USD→quote and
 * EUR→quote forms so a future EU-base lookup is one row away.
 *
 * If the call fails (rate-limit, network), we log and exit non-zero — the
 * latest-rate query in fx.ts has its own staleness guard, so a missed day
 * doesn't break checkout, it just disables cross-currency redemption until
 * we catch up.
 */

const QUOTE_CURRENCIES = ['INR', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'] as const;

type OerResponse = {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
};

async function fetchUsdRates(): Promise<OerResponse | null> {
  const appId = process.env.OPENEXCHANGERATES_APP_ID;
  if (!appId) {
    console.error('[fx-rates] OPENEXCHANGERATES_APP_ID is unset; skipping.');
    return null;
  }
  const symbols = QUOTE_CURRENCIES.join(',');
  const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=${symbols}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`openexchangerates HTTP ${res.status}`);
  }
  return (await res.json()) as OerResponse;
}

async function main() {
  const data = await fetchUsdRates();
  if (!data) {
    process.exit(2);
  }

  const fetchedAt = new Date(data.timestamp * 1000);
  let written = 0;

  for (const quote of QUOTE_CURRENCIES) {
    const rate = data.rates[quote];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      console.warn(`[fx-rates] skipping invalid rate USD→${quote}:`, rate);
      continue;
    }
    try {
      await prisma.fxRate.create({
        data: {
          base: 'USD',
          quote,
          rate: rate.toFixed(8),
          source: 'openexchangerates',
          fetchedAt,
        },
      });
      written += 1;

      // Inverse pair so quote→USD lookups don't have to compute on the
      // fly. Rounded to 8 decimals to match the column.
      const inverse = 1 / rate;
      await prisma.fxRate.create({
        data: {
          base: quote,
          quote: 'USD',
          rate: inverse.toFixed(8),
          source: 'openexchangerates',
          fetchedAt,
        },
      });
      written += 1;
    } catch (err) {
      const code = (err as { code?: string }).code;
      // P2002 = same (base, quote, fetchedAt) already written by an earlier
      // run on the same minute. No-op.
      if (code === 'P2002') continue;
      throw err;
    }
  }

  console.log(`[fx-rates] wrote ${written} rates @ ${fetchedAt.toISOString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[fx-rates] failed:', err);
    process.exit(1);
  });

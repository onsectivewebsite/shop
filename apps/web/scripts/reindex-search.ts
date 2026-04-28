/* eslint-disable no-console */
import { fullReindex } from '../src/server/workers/search-index';
import { isOpenSearchEnabled } from '../src/server/search/opensearch';

/**
 * Full search reindex — run on deploy or when mapping changes.
 *
 *   pnpm --filter @onsective/web reindex:search
 */

async function main() {
  if (!isOpenSearchEnabled()) {
    console.log('[reindex] OPENSEARCH_URL not set — nothing to do (Postgres FTS is active).');
    return;
  }
  const t = Date.now();
  const result = await fullReindex({ log: (m) => console.log(m) });
  console.log(`[reindex] finished: ${result.total} docs in ${Date.now() - t}ms`);
}

main().catch((err) => {
  console.error('[reindex] failed:', err);
  process.exit(1);
});

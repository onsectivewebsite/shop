import { seedE2eFixtures } from './fixtures';

export default async function globalSetup() {
  if (process.env.SKIP_E2E_FIXTURES === '1') {
    // eslint-disable-next-line no-console
    console.log('[fixtures] skipped via SKIP_E2E_FIXTURES=1');
    return;
  }
  await seedE2eFixtures();
}

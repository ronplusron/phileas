import { defineConfig } from '@playwright/test';
import { playwrightTimeouts } from '@drugstoresushi/phileas';
import { journey } from './journeys';

/** The Journey's configuration, laid out as the rail demo's is. */
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  ...playwrightTimeouts(journey),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
});

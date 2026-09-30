import { defineConfig } from '@playwright/test';
import { playwrightTimeouts } from '@drugstoresushi/phileas';
import { journey } from './journeys';

/** Bobolink Editor's Journey configuration, laid out as buggy's is. */
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  ...playwrightTimeouts(journey),
  // One Route at a time until the editor's load is measured. Its own suite
  // runs one launch at a time too, in its playwright.config.ts.
  fullyParallel: true,
  workers: 1,
  retries: 0,
  reporter: [['list']],
});

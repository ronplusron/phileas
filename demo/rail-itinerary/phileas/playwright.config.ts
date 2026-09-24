import { defineConfig } from '@playwright/test';
import { playwrightTimeouts } from '@drugstoresushi/phileas';
import { demo } from './journeys/demo';

/** The demo Journey's configuration, laid out as buggy's is. */
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  ...playwrightTimeouts(demo),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['line']],
});

import { defineConfig } from '@playwright/test';
import { playwrightTimeouts } from '@drugstoresushi/phileas';
import { journey } from './journeys';

/** RStudio's Journey configuration, laid out as buggy's is. */
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  ...playwrightTimeouts(journey),
  // One Route at a time until RStudio's load is measured. Each Route starts
  // an R session as well as the application, and Positron's trial measured
  // five at a time overloading this machine.
  fullyParallel: true,
  workers: 1,
  retries: 0,
  reporter: [['list']],
});

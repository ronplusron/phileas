import { defineConfig } from '@playwright/test';
import { playwrightTimeouts } from '@drugstoresushi/phileas';
import { journey } from './journeys';

/** RStudio's Journey configuration, laid out as buggy's is. */
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  ...playwrightTimeouts(journey),
  // Two Routes at a time. Each Route starts an R session as well as the
  // application, and Positron's trial measured five at a time overloading
  // this machine. Measured on 2026-10-08 with RStudio 2026.10.0, 10 Routes
  // from the script Fix two at a time: a load of 6.6 at most on 8 cores, a
  // median Hop of 480 ms against 492 ms one at a time, and 1 Hop of 200
  // abandoned.
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [['list']],
});

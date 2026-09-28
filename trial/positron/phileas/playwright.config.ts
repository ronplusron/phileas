import { defineConfig } from '@playwright/test';
import { playwrightTimeouts } from '@drugstoresushi/phileas';
import { journey } from './journeys';

/** The trial's Journey configuration, laid out as buggy's is. */
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  ...playwrightTimeouts(journey),
  // Two Routes at a time. Routes share nothing, so this changes no Route;
  // what it changes is load. Five at a time, asked for on 2026-09-27, put
  // the load average at 26.9 on 8 cores and left 114 MB of memory free, and
  // a Route slowed by that reads as a hang.
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [['list']],
});

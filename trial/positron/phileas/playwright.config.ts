import { defineConfig } from '@playwright/test';
import { playwrightTimeouts } from '@drugstoresushi/phileas';
import { journey } from './journeys';

/** The trial's Journey configuration, laid out as buggy's is. */
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  ...playwrightTimeouts(journey),
  // Five Routes at a time, asked for on 2026-09-27. Routes share nothing, so
  // this changes no Route; what it can change is load, since five Positrons
  // compete for the machine, and a Route slowed by that can read as a hang.
  fullyParallel: true,
  workers: 5,
  retries: 0,
  reporter: [['list']],
});

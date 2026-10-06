import { defineConfig } from '@playwright/test';

/**
 * Probes of known Positron bugs, apart from the Journey so `phileas run`
 * never collects them. Each reproduces one bug by scripted steps on the
 * release that has it, and records what every check saw, so whether a check
 * could find that bug is measured rather than argued. Started on 2026-10-06
 * for the trial's step 5, where the bugs are positive controls.
 */
export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  timeout: 300_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
});

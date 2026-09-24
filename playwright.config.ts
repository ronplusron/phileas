import { defineConfig } from '@playwright/test';

/**
 * The engine's own tests, run against the testbed application.
 *
 * Not a Journey. These are the tests that show the engine's parts behave as
 * written; the Journey that shows the assembled engine finds planted defects
 * is phase 8's, and it gets a project of its own.
 */
export default defineConfig({
  testDir: './tests',

  // Fails the run if it leaves a phileas-* folder in the system temp folder.
  globalSetup: './tests/leftover-temp.ts',

  // One application at a time. Each test launches its own process, and
  // parallel Electron instances would contend for the same temporary
  // directories and the same screen.
  fullyParallel: false,
  workers: 1,

  /**
   * Zero, deliberately, and not to be raised.
   *
   * A seeded Route that fails and then passes on retry has found
   * nondeterminism, which is a finding. Retries turn that into "flaky" and
   * bury it. docs/PLAN.md carries this as a hazard.
   */
  retries: 0,

  reporter: [['list']],
  timeout: 60_000,
});

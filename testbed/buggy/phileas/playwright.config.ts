import { defineConfig } from '@playwright/test';
import { exploration } from './journeys/exploration';

/**
 * What one Hop is allowed, and what a Route is allowed on top of its Hops.
 *
 * Both are guesses until phase 4 measures a Hop, and they are written here as
 * named numbers so that the measurement replaces something visible rather than
 * being buried in an expression.
 */
const MILLISECONDS_PER_HOP = 3_000;
const ROUTE_OVERHEAD_MS = 30_000;

/**
 * The Journey's own configuration, in the consuming repository rather than the
 * engine's.
 *
 * This is the shape a real consumer ends up with, which is why it lives here
 * and not in the root config: a Journey is run by the application under test,
 * against its own terms. The root config runs the engine's own tests and is a
 * different thing entirely.
 *
 * `buggy` is inside this repository, so the Journey can also be run from the
 * root with `npm run journey`. That is a convenience for developing the engine,
 * not part of the layout a consumer copies.
 */
export default defineConfig({
  testDir: '.',

  // Where the seed is settled, once, before any worker starts.
  globalSetup: './global-setup.ts',

  // R4: the Journey's deadline. Work already done is reported when it passes.
  globalTimeout: exploration.deadlineMs,

  /**
   * The Route timeout, derived from the budget rather than left at the default.
   *
   * Playwright's default is thirty seconds. A Route of twenty Hops against a
   * slow application exceeds that and is reported as a timeout instead of as
   * whatever it had found, which docs/PLAN.md carries as a hazard and says to
   * set from the budget and the settle wait. It was left at the default here
   * until review caught it.
   */
  timeout: exploration.hopsPerRoute * MILLISECONDS_PER_HOP + ROUTE_OVERHEAD_MS,

  // One application at a time, for the reason the root config gives.
  fullyParallel: false,
  workers: 1,

  // Zero, deliberately. A seeded Route that fails and then passes on a retry
  // has found nondeterminism, which is a finding rather than flakiness.
  retries: 0,

  reporter: [['list']],
});

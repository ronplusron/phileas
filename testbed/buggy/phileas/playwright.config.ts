import { defineConfig } from '@playwright/test';
import { playwrightTimeouts } from '@drugstoresushi/phileas';
import { exploration } from './journeys/exploration';

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

  /**
   * Both deadlines, as the Journey states them: the Journey deadline becomes
   * Playwright's global timeout (R4) and the Route deadline its per-test one.
   *
   * Through the helper rather than written out, because a deadline left out
   * means no limit and Playwright needs that said as zero. Leaving `timeout`
   * out of this file would not mean no limit; it would mean Playwright's default
   * of thirty seconds, which cuts a Route off and reports a timeout instead of
   * whatever it found. That default was once left in place here until review
   * caught it, and then replaced by a formula that guessed how long a Hop takes.
   */
  ...playwrightTimeouts(exploration),

  // One application at a time, for the reason the root config gives.
  fullyParallel: false,
  workers: 1,

  // Zero, deliberately. A seeded Route that fails and then passes on a retry
  // has found nondeterminism, which is a finding rather than flakiness.
  retries: 0,

  reporter: [['list']],
});

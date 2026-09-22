import { resolveSeed } from '@drugstoresushi/phileas';
import { exploration } from './journeys/exploration';

/**
 * Settle this run's seed, once, before any Route runs.
 *
 * Playwright's workers are separate processes, so a spec file's top-level code
 * runs once per worker. A seed generated there would be a different seed in
 * every worker: every Route would report a seed that retraces nothing, and
 * every Route would still pass. Global setup runs once and what it puts in the
 * environment reaches the workers, which is the whole reason this file exists.
 *
 * It prints the seed because a Journey nobody can retrace is worth little, and
 * phase 7's report does not exist yet.
 */
export default function globalSetup(): void {
  const seed = resolveSeed(exploration.seed);
  console.log(`Journey seed: ${seed}`);
}

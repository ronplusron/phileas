import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';
import { startJourney } from '@drugstoresushi/phileas';
import { exploration } from './journeys/exploration';

/** Where this run's seed is written, for a Route to check its own against. */
export const seedRecordPath = (rootDir: string): string =>
  path.join(rootDir, '.phileas-seed');

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
export default function globalSetup(config: FullConfig): void {
  const { seed, run } = startJourney(exploration.seed);

  // Written to disk as well as to the environment, deliberately. A Route that
  // checked its seed against the environment variable would be checking the
  // mechanism against itself: requireSeed reads that variable, so the two agree
  // however wrong they are. The file is evidence of a different kind, and it is
  // what lets a Route notice a seed that did not survive being handed to its worker.
  fs.writeFileSync(seedRecordPath(config.rootDir), seed, 'utf8');

  console.log(`Journey seed: ${seed}`);
  console.log(`Run: ${run}`);
}

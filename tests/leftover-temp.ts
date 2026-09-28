import { startTempFolder } from '../src/index';

/**
 * Gives the run its own folder in the system temp folder, and fails the run if
 * anything is left in it.
 *
 * Global setup, returning its own teardown. The suite once left about eighty
 * folders per run, roughly 1,300 of them before anyone looked, because nothing
 * failed when a test forgot to remove what it made. Each cleanup is now in the
 * test or fixture that creates the folder, and this is the check that fails
 * when one is missing, rather than a note asking for care.
 *
 * Every profile and scratch folder the suite makes goes inside this one, so a
 * Journey or a demo running at the same time is never counted, and never
 * counts the suite's. The mechanism is the engine's, the one a Journey's start
 * and end use, so the two cannot drift apart. `startTempFolder` in
 * `src/start.ts` says how it reads.
 */
export default function globalSetup() {
  return startTempFolder('suite', 'run', 'Whatever created each one should remove it, even when its test fails.').check;
}

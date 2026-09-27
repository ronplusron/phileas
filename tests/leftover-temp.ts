import { watchTempFolder } from '../src/index';

/**
 * Fails the run if it leaves a `phileas-*` folder in the system temp folder.
 *
 * Global setup, returning its own teardown. The suite once left about eighty
 * folders per run, roughly 1,300 of them before anyone looked, because nothing
 * failed when a test forgot to remove what it made. Each cleanup is now in the
 * test or fixture that creates the folder, and this is the check that fails
 * when one is missing, rather than a note asking for care.
 *
 * The check itself is the engine's, the one a Journey's end runs, so the two
 * cannot drift apart. `watchTempFolder` in `src/start.ts` says how it reads.
 */
export default function globalSetup() {
  return watchTempFolder('run', 'Whatever created each one should remove it, even when its test fails.');
}

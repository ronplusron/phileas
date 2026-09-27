import os from 'node:os';
import { startJourney } from '@drugstoresushi/phileas';
import { journey } from './journeys';
import { guardHome } from './home-guard';

/**
 * Settle the seed, name the run and print its settings, once, before any Route
 * starts. Returns the home folder guard, which Playwright runs as teardown
 * whether the Routes passed or not.
 *
 * The folder the run was started from is watched as well, since that is where
 * an application's relative writes landed before the engine launched it from
 * the profile. The run's own output there is not counted.
 */
export default function globalSetup(): () => void {
  startJourney(journey);
  return guardHome(os.homedir(), {
    dir: process.cwd(),
    ownEntries: ['.phileas-journals', 'test-results', 'playwright-report'],
  });
}

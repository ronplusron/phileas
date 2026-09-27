import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finishJourney, runEveryCheck, startJourney } from '@drugstoresushi/phileas';
import { journey } from './journeys';
import { guardHome } from './home-guard';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Settle the seed, name the run and print its settings, once, before any Route
 * starts. Returns what runs when the Journey ends, whether the Routes passed
 * or not: the known findings brought up to date with what this Journey found,
 * the leftover profile check, and the home folder guard. Each runs even when
 * another fails, so one guard firing never hides what another would have said.
 *
 * The folder the run was started from is watched as well, since that is where
 * an application's relative writes landed before the engine launched it from
 * the profile. The run's own output there is not counted.
 */
export default function globalSetup(): () => void {
  startJourney(journey);
  const checkHome = guardHome(os.homedir(), {
    dir: process.cwd(),
    ownEntries: ['.phileas-journals', 'test-results', 'playwright-report'],
  });
  return () => {
    runEveryCheck([
      () => {
        finishJourney({
          journalsRoot: path.join(here, '.phileas-journals'),
          knownFindings: path.join(here, 'known-findings.json'),
        });
      },
      checkHome,
    ]);
  };
}

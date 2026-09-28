import os from 'node:os';
import { finishJourney, runEveryCheck, startJourney } from '@drugstoresushi/phileas';
import { journey } from './journeys';
import { fixes } from './fixes';
import { positron } from './adapter';
import { guardHome } from './home-guard';
import { journalsRoot, knownFindings } from './paths';


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
  startJourney(journey, positron, fixes);
  const checkHome = guardHome(os.homedir(), {
    dir: process.cwd(),
    ownEntries: ['.phileas-journals', 'test-results', 'playwright-report'],
  });
  return () => {
    runEveryCheck([
      () => {
        finishJourney({
          journalsRoot,
          knownFindings,
        });
      },
      checkHome,
    ]);
  };
}

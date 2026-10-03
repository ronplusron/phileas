import os from 'node:os';
import { finishJourney, guardHome, runEveryCheck, startJourney } from '@drugstoresushi/phileas';
import { journey } from './journeys';
import { fixes } from './fixes';
import { rstudio } from './adapter';
import { RSTUDIO } from './home';
import { journalsRoot, knownFindings } from './paths';
import { describePersonalLibrary, personalLibrary } from './personal-library';
import { guardRLibraries, librariesToGuard, machineLibraries } from './r-library-guard';

/**
 * Settle the seed, name the run and print its settings, once, before any Route
 * starts, with whether the Routes see the person's own R library. Returns
 * what runs when the Journey ends, whether the Routes passed or not: the
 * known findings brought up to date with what this Journey found, the
 * leftover profile check, the home folder guard, and the R library guard,
 * which watches a personal library given by path as well as the machine's.
 * Each runs even when another fails, so one guard firing never hides what
 * another would have said.
 *
 * The folder the run was started from is watched as well, as Positron's
 * trial watches its own, for an application writing by a relative path. The
 * run's own output there is not counted.
 */
export default function globalSetup(): () => void {
  startJourney(journey, rstudio, fixes);
  const personal = personalLibrary();
  console.log(describePersonalLibrary(personal));
  const checkHome = guardHome(os.homedir(), RSTUDIO, {
    dir: process.cwd(),
    ownEntries: ['.phileas-journals', 'test-results', 'playwright-report'],
  });
  const checkLibraries = guardRLibraries(librariesToGuard(machineLibraries(), personal.folders));
  return () => {
    runEveryCheck([
      () => {
        finishJourney({ journalsRoot, knownFindings, varying: rstudio.varyingInSignatures });
      },
      checkHome,
      checkLibraries,
    ]);
  };
}

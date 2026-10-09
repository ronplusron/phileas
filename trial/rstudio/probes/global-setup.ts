import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { finishJourney, guardHome, runEveryCheck, startJourney } from '@drugstoresushi/phileas';
import { journey } from '../phileas/journeys';
import { fixes } from '../phileas/fixes';
import { rstudio } from '../phileas/adapter';
import { RSTUDIO } from '../phileas/home';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The trial's own setup, less the known findings and the R library guard: a
 * probe never writes the known findings, and runs no Route that could install
 * a package. The home folder guard stays, since a probe launches RStudio.
 */
export default function globalSetup(): () => void {
  startJourney(journey, rstudio, fixes);
  const checkHome = guardHome(os.homedir(), RSTUDIO, {
    dir: process.cwd(),
    ownEntries: ['.phileas-journals', 'test-results', 'playwright-report'],
  });
  return () => runEveryCheck([() => void finishJourney({ journalsRoot: path.join(here, '.phileas-journals') }), checkHome]);
}

import os from 'node:os';
import { finishJourney, guardHome, runEveryCheck, startJourney } from '@drugstoresushi/phileas';
import { journey } from '../phileas/journeys';
import { fixes } from '../phileas/fixes';
import { positron } from '../phileas/adapter';
import { POSITRON } from '../phileas/home';
import { probeJournals } from './paths';

/**
 * The trial's own setup, less the known findings: a probe reads them, so a
 * known bug is carried past as in a Journey, and never writes them, since a
 * probe sets bugs off on purpose.
 */
export default function globalSetup(): () => void {
  startJourney(journey, positron, fixes);
  const checkHome = guardHome(os.homedir(), POSITRON, {
    dir: process.cwd(),
    ownEntries: ['.phileas-journals', 'test-results', 'playwright-report'],
  });
  return () => runEveryCheck([() => void finishJourney({ journalsRoot: probeJournals }), checkHome]);
}

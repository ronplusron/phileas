import { finishJourney, startJourney } from '@drugstoresushi/phileas';
import { journey } from './journeys';
import { eightyDays } from './adapter';
import { journalsRoot, knownFindings } from './paths';

/**
 * Settle the seed, name the run and print its settings, once, before any Route
 * starts, and return what runs after: the Journey's findings added to the
 * known findings file, and the check for a profile left behind.
 */
export default function globalSetup(): () => void {
  startJourney(journey, eightyDays);
  return () => {
    finishJourney({ journalsRoot, knownFindings });
  };
}

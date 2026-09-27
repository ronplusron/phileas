import { finishJourney, startJourney } from '@drugstoresushi/phileas';
import { journey } from './journeys';

/**
 * Settle the seed, name the run and print its settings, once, before any Route
 * starts, and return the check for a profile left behind, which runs after.
 */
export default function globalSetup(): () => void {
  startJourney(journey);
  return () => {
    finishJourney();
  };
}

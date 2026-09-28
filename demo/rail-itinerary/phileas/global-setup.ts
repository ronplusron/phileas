import { finishJourney, startJourney } from '@drugstoresushi/phileas';
import { journey } from './journeys';
import { fixes } from './fixes';
import { railItinerary } from './adapter';

/**
 * Settle the seed, name the run and print its settings, once, before any Route
 * starts, and return the check for a profile left behind, which runs after.
 */
export default function globalSetup(): () => void {
  startJourney(journey, railItinerary, fixes);
  return () => {
    finishJourney();
  };
}

import { startJourney } from '@drugstoresushi/phileas';
import { journey } from './journeys';

/** Settle the seed, name the run and print its settings, once, before any Route starts. */
export default function globalSetup(): void {
  startJourney(journey);
}

import { startJourney } from '@drugstoresushi/phileas';
import { demo } from './journeys/demo';

/** Settle the seed and name the run, once, before any Route starts. */
export default function globalSetup(): void {
  const { seed, run } = startJourney(demo.seed);
  console.log(`Journey seed: ${seed}`);
  console.log(`Run: ${run}`);
}

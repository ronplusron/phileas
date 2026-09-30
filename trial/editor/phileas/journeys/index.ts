import { defineJourney } from '@drugstoresushi/phileas';

/**
 * The Journey through Bobolink Editor. It names no Fix, so every Route starts
 * wherever the editor starts; `phileas run --fix <name>` opens every Route
 * with one of the Fixes `fixes/index.ts` lists.
 *
 * No seed and no deadlines, for the reasons buggy's Journey gives.
 */
export const journey = defineJourney({
  routes: 1,
  tripLength: 20,
});

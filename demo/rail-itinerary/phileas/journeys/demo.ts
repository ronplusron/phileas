import { defineJourney } from '@drugstoresushi/phileas';

/**
 * The demo's Journey: a few Routes, short enough to watch.
 *
 * No seed here. The demo's fixed default is set by watch.mjs, which is where
 * the demo is run from.
 */
export const demo = defineJourney({
  routes: 3,
  tripLength: 50,
});

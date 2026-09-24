import { defineJourney } from '@drugstoresushi/phileas';

/**
 * The demo's Journey: a few Routes, short enough to watch.
 *
 * No seed here, because a seed written into a definition wins over one passed
 * in, and the demo wants a fixed default that can still be overridden. The
 * default is set by watch.mjs instead.
 */
export const demo = defineJourney({
  routes: 3,
  tripLength: 50,
});

import { defineJourney, type Fix } from '@drugstoresushi/phileas';

/**
 * The trial's Journey through Positron, with no Fix yet.
 *
 * No seed and no deadlines, for the reasons buggy's Journey gives. The Fixes
 * the trial needs arrive in its fourth step.
 */
export const journey = defineJourney({
  routes: 1,
  tripLength: 20,
});

export const fix: Fix | undefined = undefined;

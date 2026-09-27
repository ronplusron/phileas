import { defineJourney, type Fix } from '@drugstoresushi/phileas';

/**
 * The demo's Journey: three Routes. The Trip length is provisional until the
 * balance measurement in docs/DEMO_PLAN_EIGHTY_DAYS.md sets it.
 *
 * No seed here. The demo's seeds are set where it is run from.
 */
export const demo = defineJourney({
  routes: 3,
  tripLength: 60,
});

/**
 * A Fix of one step, copied from `phileas survey`: every Route starts on the
 * road rather than in the Reform Club.
 */
export const accept: Fix = ({ hop }) => hop('button "Accept the wager"');

import { defineJourney, type Fix } from '@drugstoresushi/phileas';

/**
 * The demo's Journey: three Routes of two hundred Hops.
 *
 * Two hundred was set by the balance measurement docs/DEMO_PLAN_EIGHTY_DAYS.md
 * asks for, from the hong-kong Fix: six Routes ended one won, three lost and
 * two still going, and three Routes watched fit in about eight and a half
 * minutes. docs/HISTORY.md has the measurements that led here.
 *
 * No seed here. The demo's seeds are set where it is run from.
 */
export const demo = defineJourney({
  routes: 3,
  tripLength: 200,
});

/**
 * A Fix of one step, copied from `phileas survey`: every Route starts on the
 * road rather than in the Reform Club.
 */
export const accept: Fix = ({ hop }) => hop('button "Accept the wager"');

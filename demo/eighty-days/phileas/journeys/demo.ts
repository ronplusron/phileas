import { defineJourney, type Fix } from '@drugstoresushi/phileas';

/**
 * The demo's Journey: three Routes of a hundred and fifty Hops.
 *
 * A hundred and fifty was set by the balance measurement
 * docs/DEMO_PLAN_EIGHTY_DAYS.md asks for, from the hong-kong Fix: twenty-four
 * Routes ended six won, eleven lost and seven still going, half the seeds
 * tried showed all three in one Journey, and three Routes watched took 6.8
 * minutes. docs/HISTORY.md has the measurements that led here.
 *
 * No seed here. The demo's seeds are set where it is run from, and
 * demo/eighty-days/seeds.mjs holds the default.
 */
export const demo = defineJourney({
  routes: 3,
  tripLength: 150,
});

/**
 * A Fix of one step, copied from `phileas survey`: every Route starts on the
 * road rather than in the Reform Club.
 */
export const accept: Fix = ({ hop }) => hop('button "Accept the wager"');

import { defineJourney } from '@drugstoresushi/phileas';

/**
 * The demo's Journey: three Routes of a hundred and fifty Hops, each opening
 * with the `hong-kong` Fix. `phileas run --fix <name>` chooses another of the
 * Fixes in `../fixes/index.ts` for one run, and `--fix none` none.
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
export const journey = defineJourney({
  routes: 3,
  tripLength: 150,
  fix: 'hong-kong',
});

// Replaced by `--fix` on 2026-09-28. Refused rather than ignored, since a run
// that silently dropped it would open with a different Fix than was asked for.
if (process.env.EIGHTY_DAYS_JOURNEY) {
  const replacement = process.env.EIGHTY_DAYS_JOURNEY === 'no-fix' ? 'none' : process.env.EIGHTY_DAYS_JOURNEY;
  throw new Error(
    `EIGHTY_DAYS_JOURNEY is no longer read. Choose the Fix with phileas run --fix ${replacement}, ` +
      `or PHILEAS_FIX, and unset EIGHTY_DAYS_JOURNEY.`
  );
}

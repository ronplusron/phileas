import { defineJourney } from '@drugstoresushi/phileas';

/**
 * The demo's Journey: a few Routes, short enough to watch, each opening with
 * the `open-alps` Fix. `phileas run --fix add-leg-then-buy` opens them in the
 * ticket dialog instead, and `--fix none` with no Fix at all.
 *
 * No seed here. The demo's seeds are set by watch.mjs and present.mjs, which
 * are where the demo is run from.
 */
export const journey = defineJourney({
  routes: 3,
  tripLength: 50,
  fix: 'open-alps',
});

// Replaced by `--fix` on 2026-09-28. Refused rather than ignored, since a run
// that silently dropped it would open with a different Fix than was asked for.
if (process.env.RAIL_DEMO_JOURNEY) {
  const replacement = { 'no-fix': 'none', tickets: 'add-leg-then-buy' }[process.env.RAIL_DEMO_JOURNEY] ?? process.env.RAIL_DEMO_JOURNEY;
  throw new Error(
    `RAIL_DEMO_JOURNEY is no longer read. Choose the Fix with phileas run --fix ${replacement}, ` +
      `or PHILEAS_FIX, and unset RAIL_DEMO_JOURNEY.`
  );
}

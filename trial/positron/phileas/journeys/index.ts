import { defineJourney } from '@drugstoresushi/phileas';

/**
 * The trial's Journey through Positron. It names no Fix, so a run with no
 * `--fix` starts wherever Positron starts; `phileas run --fix <name>` opens
 * every Route with one of the Fixes `fixes/index.ts` lists.
 *
 * No seed and no deadlines, for the reasons buggy's Journey gives.
 */
export const journey = defineJourney({
  routes: 1,
  tripLength: 20,
});

// Replaced by `--fix` on 2026-09-28. Refused rather than ignored, since a run
// that silently dropped it would travel with no Fix and report nothing amiss.
if (process.env.POSITRON_JOURNEY) {
  throw new Error(
    `POSITRON_JOURNEY is no longer read. Choose the Fix with phileas run ` +
      `--fix ${process.env.POSITRON_JOURNEY === 'no-fix' ? 'none' : process.env.POSITRON_JOURNEY}, ` +
      `or PHILEAS_FIX, and unset POSITRON_JOURNEY.`
  );
}

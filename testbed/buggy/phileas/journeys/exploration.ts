import { defineJourney } from '@drugstoresushi/phileas';

/**
 * The terms of the ordinary Journey through `buggy`.
 *
 * Four terms and nothing else. What gets explored is not decided here and must
 * not start being: a journey definition that begins steering a Route is
 * the planner growing back, which `CLAUDE.md` records as declined.
 *
 * No seed. An ordinary run settles one per run in global setup; a seed written
 * here would make every run retrace the same Route, which is a replay. To
 * replay, set PHILEAS_SEED for the run rather than editing this file.
 *
 * The numbers are small on purpose while nothing travels. They are what phase 4
 * will raise once a Hop costs real time.
 */
export const exploration = defineJourney({
  routes: 5,
  tripLength: 20,
  deadlineMs: 10 * 60 * 1000,
});

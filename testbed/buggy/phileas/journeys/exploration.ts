import { defineJourney } from '@drugstoresushi/phileas';

/**
 * The ordinary Journey through `buggy`.
 *
 * Its definition and nothing else. What gets explored is not decided here and
 * must not start being: a journey definition that begins steering a Route is
 * the planner growing back, which `CLAUDE.md` records as declined.
 *
 * No seed. An ordinary run settles one per run in global setup; a seed written
 * here would make every run retrace the same Route, which is a replay. To
 * replay, set PHILEAS_SEED for the run rather than editing this file.
 *
 * No deadlines either, which is the common case and is shown here for that
 * reason: the Journey takes as long as its Routes take. That is still bounded,
 * by five Routes of twenty Trip hops each, and every Trip hop has its own time
 * limits. What a Route deadline would guard is a Fix, and this Journey has none.
 */
export const exploration = defineJourney({
  routes: 5,
  tripLength: 20,
});

// For each planted bug: the Fix the Route opens with, by the name `phileas run
// --fix` takes, a seed whose Route 1 meets it within the Trip length, and the
// Trip hop it was met at, each measured on 2026-09-28 with that one plant on
// and the window hidden. A seed was searched for, never steered: the Route
// found the bug by its own draws. seating-trap strands rather than fails, so
// its hop is where the Route ran out of moves. Any change to the application,
// the engine's draw or the survey moves what a seed does, so a change of that
// kind means searching again; these seeds were not chosen to be robust, only
// to reach their bug. Measured again on 2026-10-03, when the menu began to be
// drawn a level at a time: sleeper-throw's moved from hop 17 to 16, and the
// other two met theirs where they had.
export const PLANT_SEEDS = {
  'sleeper-throw': { fix: 'open-alps', seed: 'rail-demo', tripLength: 50, hop: 16 },
  'last-leg-blank': { fix: 'open-alps', seed: 'lyon', tripLength: 50, hop: 19 },
  'seating-trap': { fix: 'open-alps', seed: 'vienna', tripLength: 50, hop: 7 },
};

// The several-at-once section: the two plants that make a finding, five
// Routes of a hundred Hops. The trap is left out, since a Route that strands
// on it ends with no finding and hides whatever else it would have met.
// Measured 2026-09-28 with this seed: last-leg-blank on Routes 1 and 2, at Trip
// hops 81 and 72, and sleeper-throw on Route 4 at hop 100, the Trip's last, so
// a Trip one Hop shorter loses it. Three Routes of fifty met both with none of
// the seven seeds tried, and five Routes of a hundred with one of twelve: it
// is kept for that, fragile as it is, over a longer section. Of the other
// eleven, on 2026-09-28 and 29, four met only the sleeper, three only the last
// leg, and four neither. Measured again on 2026-10-03, when the menu began to
// be drawn a level at a time: it still finds both, the sleeper on Route 3 at
// Trip hop 48 and the last leg on Route 5 at hop 46.
export const SEVERAL = {
  fix: 'open-alps',
  seed: 'vienna',
  routes: 5,
  tripLength: 100,
  plants: ['sleeper-throw', 'last-leg-blank'],
};

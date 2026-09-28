// The default Journey's seed, shared by the watched run and the guided demo,
// the Trip length it was measured at, which is the Journey's own in
// phileas/journeys/demo.ts, and the Route of it whose replay is shown. Chosen by
// running seeds and reading how each Route's game went; docs/HISTORY.md has
// the search. Any change to the game, the engine's draw or the survey moves
// what a seed does, so a change of that kind means searching again.
export const DEMO_SEED = 'passepartout';
export const TRIP_LENGTH = 150;
export const REPLAY_ROUTE = 1;

// For each planted bug: the Journey whose Fix starts near it, a seed whose
// Route 1 meets it within the Trip length, and the Trip hop it was met at,
// each measured on 2026-09-27 with that one plant on and the window hidden.
// A seed was searched for, never steered: the Route found the bug by its own
// draws. bradshaw-trap strands rather than fails, so its hop is where the
// Route ran out of moves. The same warning as above applies, and harder:
// these seeds were not chosen to be robust, only to reach their bug once.
export const PLANT_SEEDS = {
  'kiouni-throw': { journey: 'kholby', seed: 'fogg', tripLength: 40, hop: 11 },
  'export-throw': { journey: 'hong-kong', seed: 'fogg', tripLength: 80, hop: 7 },
  'sail-console-error': { journey: 'fort-kearney', seed: 'kiouni', tripLength: 40, hop: 1 },
  'coal-hang': { journey: 'new-york', seed: 'aouda', tripLength: 40, hop: 5 },
  'blank-club': { journey: 'london', seed: 'fogg', tripLength: 30, hop: 4 },
  'set-out-confirm': { journey: 'reform-club', seed: 'mudge', tripLength: 60, hop: 1 },
  'carnatic-log-error': { journey: 'hong-kong', seed: 'aouda', tripLength: 60, hop: 5 },
  'bradshaw-trap': { journey: 'hong-kong', seed: 'fogg', tripLength: 80, hop: 8 },
};

// The several-at-once section: four plants on together, five Routes from Hong
// Kong. Measured 2026-09-28 with this seed: export-throw seen 4 times and
// carnatic-log-error once, every Route ending at its first bug, since none was
// known yet; the sledge's and the Henrietta's plants were planted and not
// reached. Of five seeds tried, three gave two findings and two gave one, since
// Export the ledger is on offer at every Hop and ends most Routes first.
export const SEVERAL = {
  journey: 'hong-kong',
  seed: 'mudge',
  routes: 5,
  tripLength: 150,
  plants: ['carnatic-log-error', 'export-throw', 'sail-console-error', 'coal-hang'],
};

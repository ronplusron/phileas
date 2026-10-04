// The default Journey's seed, shared by the watched run and the guided demo,
// the Trip length it was measured at, which is the Journey's own in
// phileas/journeys/index.ts, and the Route of it whose replay is shown. Chosen by
// running seeds and reading how each Route's game went; docs/HISTORY.md has
// the search. Any change to the game, the engine's draw or the survey moves
// what a seed does, so a change of that kind means searching again.
// Searched again on 2026-10-03, when the menu began to be drawn a level at a
// time: passepartout then gave one win and two losses. carnatic was the
// eighth seed tried, and the first since to show all three fates: Route 1
// lost at Trip hop 100, Route 2 won at 126, and Route 3 was still going; Route
// 1 alone retraced all 150 Hops.
export const DEMO_SEED = 'carnatic';
export const TRIP_LENGTH = 150;
export const REPLAY_ROUTE = 1;

// For each planted bug: the Fix that starts near it, by the name `phileas run --fix` takes, a seed whose
// Route 1 meets it within the Trip length, and the Trip hop it was met at,
// each measured on 2026-09-27 with that one plant on and the window hidden.
// Measured again on 2026-10-03, when the menu began to be drawn a level at a
// time: five moved and still met their bug, at the Hops below, and
// set-out-confirm's mudge no longer met it in 60 Hops, so stuart was searched
// for, the sixth seed tried. The other three met theirs where they had.
// A seed was searched for, never steered: the Route found the bug by its own
// draws. bradshaw-trap strands rather than fails, so its hop is where the
// Route ran out of moves. The same warning as above applies, and harder:
// these seeds were not chosen to be robust, only to reach their bug once.
export const PLANT_SEEDS = {
  'kiouni-throw': { fix: 'kholby', seed: 'fogg', tripLength: 40, hop: 9 },
  'export-throw': { fix: 'hong-kong', seed: 'fogg', tripLength: 80, hop: 67 },
  'sail-console-error': { fix: 'fort-kearney', seed: 'kiouni', tripLength: 40, hop: 1 },
  'coal-hang': { fix: 'new-york', seed: 'aouda', tripLength: 40, hop: 5 },
  'blank-club': { fix: 'london', seed: 'fogg', tripLength: 30, hop: 13 },
  'set-out-confirm': { fix: 'reform-club', seed: 'stuart', tripLength: 60, hop: 2 },
  'carnatic-log-error': { fix: 'hong-kong', seed: 'aouda', tripLength: 60, hop: 5 },
  'bradshaw-trap': { fix: 'hong-kong', seed: 'fogg', tripLength: 80, hop: 12 },
};

// The several-at-once section: four plants on together, five Routes from Hong
// Kong. Measured 2026-09-28 with this seed: export-throw seen 4 times and
// carnatic-log-error once, every Route ending at its first bug, since none was
// known yet; the sledge's and the Henrietta's plants were planted and not
// reached. Of five seeds tried, three gave two findings and two gave one, since
// Export the ledger is on offer at every Hop and ends most Routes first.
// Measured again on 2026-10-03, when the menu began to be drawn a level at a
// time: the same, export-throw 4 times and carnatic-log-error once.
export const SEVERAL = {
  fix: 'hong-kong',
  seed: 'mudge',
  routes: 5,
  tripLength: 150,
  plants: ['carnatic-log-error', 'export-throw', 'sail-console-error', 'coal-hang'],
};

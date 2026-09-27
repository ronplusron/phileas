// The watched demo: runs the default Journey, three Routes from the Hong Kong
// quay, with the window on screen and a pause per Hop, prints one line per Hop
// as its journal is written, then how each Route's game went, and ends by
// running one Route again from its seed to show it retraces hop for hop. The
// watcher itself, shared with the other demos, is demo/watching.mjs.
//
//   npm run demo:eighty-days                        the default seed
//   PHILEAS_SEED=abc npm run demo:eighty-days
//   npm run demo:eighty-days -- --no-replay
//
// Watched at the default pause, the three Routes take about seven minutes and
// the replay about two and a half more.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { watch } from '../watching.mjs';
import { fateLines } from './measure.mjs';
import { DEMO_SEED, REPLAY_ROUTE } from './seeds.mjs';

await watch({
  title: 'Eighty Days demo',
  demoDir: path.dirname(fileURLToPath(import.meta.url)),
  defaultSeed: DEMO_SEED,
  prefix: 'EIGHTY_DAYS_',
  // The Route whose game ended is the one worth replaying: it meets the same
  // fate at the same Hop. That was measured for the default seed and Journey
  // only, so any other replays Route 1.
  replayRoute: process.env.PHILEAS_SEED || process.env.EIGHTY_DAYS_JOURNEY ? 1 : REPLAY_ROUTE,
  afterRun(folder) {
    console.log('How each game went from Hong Kong:');
    for (const line of fateLines(folder, 'Hong Kong')) console.log(`  ${line}`);
    console.log('');
  },
});

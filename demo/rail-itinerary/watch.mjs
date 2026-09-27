// The watched demo: runs the Journey with the window on screen and a pause per
// Hop, prints one plain line per Hop as its journal is written, and ends by
// running Route 1 again from its seed to show it retraces hop for hop. The
// watcher itself, shared with the other demos, is demo/watching.mjs.
//
//   node demo/rail-itinerary/watch.mjs             the default seed
//   PHILEAS_SEED=abc node demo/rail-itinerary/watch.mjs
//   node demo/rail-itinerary/watch.mjs --no-replay
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { watch } from '../watching.mjs';

await watch({
  title: 'Rail Itinerary demo',
  demoDir: path.dirname(fileURLToPath(import.meta.url)),
  defaultSeed: 'rail-demo',
  prefix: 'RAIL_DEMO_',
});

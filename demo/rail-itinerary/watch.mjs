// The watched demo: runs the Journey with the window on screen and a pause per
// Hop, prints one plain line per Hop as its journal is written, and ends by
// running Route 1 again from its seed to show it retraces hop for hop.
//
// The per-Hop lines are the engine's own, from `phileas run --follow`'s
// renderer, so the demo keeps no journal reader of its own. It reads journals
// only to compare the replay with the first run, which is not reading for a
// person.
//
//   node demo/rail-itinerary/watch.mjs             the default seed
//   PHILEAS_SEED=abc node demo/rail-itinerary/watch.mjs
//   node demo/rail-itinerary/watch.mjs --no-replay
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const config = path.join(here, 'phileas', 'playwright.config.ts');
const journalsRoot = path.join(here, 'phileas', '.phileas-journals');

const seed = process.env.PHILEAS_SEED || 'rail-demo';
const env = {
  ...process.env,
  PHILEAS_SEED: seed,
  PHILEAS_SHOW: process.env.PHILEAS_SHOW || 'front',
  PHILEAS_HOP_DELAY_MS: process.env.PHILEAS_HOP_DELAY_MS || '300',
};
delete env.PHILEAS_RUN;

/** The run folder that appeared after `since`, once it exists. */
function newRunFolder(since) {
  const seedFolder = path.join(journalsRoot, seed);
  if (!fs.existsSync(seedFolder)) return undefined;
  return fs
    .readdirSync(seedFolder)
    .map((name) => path.join(seedFolder, name))
    .filter((folder) => fs.statSync(folder).birthtimeMs >= since)
    .sort()
    .at(-1);
}

/**
 * Run the Journey. With `follow`, print each Hop's line as the engine writes it;
 * the rest of Playwright's output is kept, and shown only if the run fails.
 */
function run(extraArgs, { follow = false } = {}) {
  const since = Date.now() - 1000;
  const child = spawn(
    path.join(repo, 'node_modules', '.bin', 'playwright'),
    ['test', '-c', config, ...extraArgs],
    { cwd: repo, env: { ...env, PHILEAS_FOLLOW: follow ? '1' : '0' }, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let output = '';
  let partial = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
    const lines = (partial + chunk).split('\n');
    partial = lines.pop() ?? '';
    for (const line of lines) {
      if (!follow || !/^route \d+ {2}(?!seed )/.test(line)) continue;
      console.log(line);
      if (/^route \d+ {2}(passed|failed|stranded) after/.test(line)) console.log('');
    }
  });
  child.stderr.on('data', (chunk) => (output += chunk));

  return new Promise((resolve) => {
    child.on('close', (code) => resolve({ code, output, folder: newRunFolder(since) }));
  });
}

/** What a replay must reproduce: each Hop's target, action, value and draws. `route` counts from 1. */
function hopsOf(folder, route) {
  const file = fs.readdirSync(folder).find((f) => f.startsWith(`route-${String(route).padStart(3, '0')}-`));
  return fs
    .readFileSync(path.join(folder, file), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.kind === 'trip-hop')
    .map((e) => JSON.stringify([e.target, e.action, e.value, e.shareDraw, e.draw]));
}

console.log(`Rail Itinerary demo, seed ${seed}\n`);
const first = await run([], { follow: true });
if (first.code !== 0 || !first.folder) {
  console.log(first.output);
  process.exit(first.code || 1);
}

if (!process.argv.includes('--no-replay')) {
  console.log(`Replaying route 1 from the same seed ...\n`);
  const again = await run(['--grep', 'route 1$']);
  if (again.code !== 0 || !again.folder) {
    console.log(again.output);
    process.exit(again.code || 1);
  }
  const a = hopsOf(first.folder, 1);
  const b = hopsOf(again.folder, 1);
  const same = a.length === b.length && a.every((hop, i) => hop === b[i]);
  console.log(
    same
      ? `Route 1 retraced all ${a.length} hops exactly.`
      : `Route 1 did not retrace: the runs first differ at hop ${a.findIndex((hop, i) => hop !== b[i]) + 1}.`
  );
}

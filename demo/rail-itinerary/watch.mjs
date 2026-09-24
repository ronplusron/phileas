// The watched demo: runs the Journey with the window on screen and a pause per
// Hop, prints one plain line per Hop as its journal is written, and ends by
// running Route 0 again from its seed to show it retraces hop for hop.
//
// This reads the journal format as it stands, for the demo only. It must not
// grow into a second journal reader: R30, a journal a person can read, is
// phase 7's, built into the report. docs/DEMO_PLAN_TRAIN.md says why.
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
  PHILEAS_HOP_DELAY_MS: process.env.PHILEAS_HOP_DELAY_MS || '800',
};
delete env.PHILEAS_RUN;

const pad = (text, width) => String(text).padEnd(width);

function effectText(effect) {
  if (!effect) return '';
  if (!effect.readable) return `could not read the screen: ${effect.reason}`;
  if (!effect.changed) return 'no change';
  const parts = [
    ...effect.appeared.map((h) => `+ ${h}`),
    ...(effect.appearedMore ? [`+ ${effect.appearedMore} more`] : []),
    ...effect.wentAway.map((h) => `- ${h}`),
    ...(effect.wentAwayMore ? [`- ${effect.wentAwayMore} more`] : []),
  ];
  return parts.length ? parts.join('   ') : 'changed, no heading moved';
}

function targetText(entry) {
  const t = entry.target;
  if (t.source === 'key') return t.role === 'shortcut' ? `shortcut ${t.name}` : `key ${t.name}`;
  if (t.source === 'menu') return `menu ${t.menuPath.join(' > ')}`;
  return `${t.role} "${t.name}"`;
}

function lineFor(route, entry) {
  if (entry.kind === 'trip-hop') {
    const value = entry.action === 'type' ? `"${entry.value ?? ''}"` : '';
    const abandoned = entry.abandoned ? '   (gave up: took too long)' : '';
    return (
      `route ${route}  hop ${pad(entry.hop, 3)}${pad(entry.action, 11)}` +
      `${pad(targetText(entry), 44)}${pad(value, 10)}${effectText(entry.effect)}${abandoned}`
    );
  }
  if (entry.kind === 'fix-hop') return `route ${route}  fix ${entry.hop}  ${entry.name}  ${effectText(entry.effect)}`;
  if (entry.kind === 'note') return `route ${route}  note: ${entry.note.split('. ')[0]}.`;
  if (entry.kind === 'outcome') {
    const reason = entry.reason ? `: ${entry.reason}` : '';
    return `route ${route}  ${entry.outcome} after ${entry.hops} hops${reason}\n`;
  }
  return undefined;
}

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

/** Run the Journey, printing each journal line as it is flushed. */
function runAndWatch(extraArgs, { quiet = false } = {}) {
  const since = Date.now() - 1000;
  const child = spawn(
    path.join(repo, 'node_modules', '.bin', 'playwright'),
    ['test', '-c', config, ...extraArgs],
    { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));

  const seen = new Map();
  let folder;
  const poll = () => {
    folder ??= newRunFolder(since);
    if (!folder) return;
    for (const file of fs.readdirSync(folder).sort()) {
      const route = Number(file.slice(6, 9));
      const text = fs.readFileSync(path.join(folder, file), 'utf8');
      const complete = text.slice(0, text.lastIndexOf('\n') + 1).split('\n').filter(Boolean);
      for (const raw of complete.slice(seen.get(file) ?? 0)) {
        const line = lineFor(route, JSON.parse(raw));
        if (line && !quiet) console.log(line);
      }
      seen.set(file, complete.length);
    }
  };
  const timer = setInterval(poll, 150);

  return new Promise((resolve) => {
    child.on('close', (code) => {
      clearInterval(timer);
      poll();
      resolve({ code, output, folder });
    });
  });
}

/** What a replay must reproduce: each Hop's target, action, value and draws. */
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
const first = await runAndWatch([]);
if (first.code !== 0 || !first.folder) {
  console.log(first.output);
  process.exit(first.code || 1);
}

if (!process.argv.includes('--no-replay')) {
  console.log(`Replaying route 0 from the same seed ...\n`);
  const again = await runAndWatch(['--grep', 'route 0$'], { quiet: true });
  if (again.code !== 0 || !again.folder) {
    console.log(again.output);
    process.exit(again.code || 1);
  }
  const a = hopsOf(first.folder, 0);
  const b = hopsOf(again.folder, 0);
  const same = a.length === b.length && a.every((hop, i) => hop === b[i]);
  console.log(
    same
      ? `Route 0 retraced all ${a.length} hops exactly.`
      : `Route 0 did not retrace: the runs first differ at hop ${a.findIndex((hop, i) => hop !== b[i]) + 1}.`
  );
}

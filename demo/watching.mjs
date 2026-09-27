// The watched run every demo shares: runs a demo's Journey with the window on
// screen and a pause per Hop, prints one plain line per Hop as its journal is
// written, prints what the Journey's end found, and runs one Route again from
// its seed to show it retraces hop for hop.
//
// Lifted out of the rail demo's watch.mjs when a second demo needed the same,
// for the reason demo/presenting.mjs was: two copies drift. Each demo's own
// watch.mjs names its folder, its default seed and its title.
//
// The per-Hop lines are the engine's own, from `phileas run --follow`'s
// renderer, so no demo keeps a journal reader for a person. Journals are read
// here only to compare the replay with the first run.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hopsOf, journeyEndLines, retraceVerdict, sameHops } from './journals.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Watch one demo's Journey. `demoDir` is the demo's folder, holding its
 * `phileas/` config; `prefix` is the demo's own switches, such as
 * `EIGHTY_DAYS_`, which the run inherits from the shell on purpose and
 * which are printed first, so a switch left set is never invisible.
 * `afterRun` is handed the run folder once the Journey has ended and
 * prints what the demo wants said about it. Resolves to the run folder.
 */
export async function watch({ title, demoDir, defaultSeed, prefix, replayRoute = 1, afterRun }) {
  const config = path.join(demoDir, 'phileas', 'playwright.config.ts');
  const journalsRoot = path.join(demoDir, 'phileas', '.phileas-journals');
  const seed = process.env.PHILEAS_SEED || defaultSeed;
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
   * Run the Journey. With `follow`, print each Hop's line as the engine writes
   * it, and what the Journey's end found; the rest of Playwright's output is
   * kept, and shown only if the run fails.
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
      child.on('close', (code) => {
        // What the Journey's end found, once it has printed it.
        const end = follow ? journeyEndLines(output.split('\n')) : [];
        if (end.length) console.log(`${end.join('\n')}\n`);
        resolve({ code, output, folder: newRunFolder(since) });
      });
    });
  }

  console.log(`${title}, seed ${seed}`);
  const own = Object.entries(process.env).filter(([k]) => k.startsWith(prefix));
  if (own.length) console.log(`Set in this shell: ${own.map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log('');

  const first = await run([], { follow: true });
  if (first.code !== 0 || !first.folder) {
    console.log(first.output);
    process.exit(first.code || 1);
  }
  afterRun?.(first.folder);

  if (!process.argv.includes('--no-replay')) {
    console.log(`Replaying route ${replayRoute} from the same seed ...\n`);
    const again = await run(['--grep', `route ${replayRoute}$`]);
    if (again.code !== 0 || !again.folder) {
      console.log(again.output);
      process.exit(again.code || 1);
    }
    const a = hopsOf(first.folder, replayRoute);
    const b = hopsOf(again.folder, replayRoute);
    console.log(retraceVerdict(a, b, replayRoute));
    // A replay that does not match is a finding, and says so in how it ends.
    if (!sameHops(a, b)) process.exitCode = 1;
  }
  return first.folder;
}

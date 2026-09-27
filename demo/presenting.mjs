// The runner every guided demo shares: sections shown one at a time, every
// command printed exactly as it would be typed before it runs, and the
// engine's output with Playwright's own lines taken out.
//
// Lifted out of the rail demo's present.mjs so a second demo does not copy it:
// two copies of a runner drift. Each demo's own present.mjs keeps its sections
// and hands them to `present`, along with its title and its config folder.
//
//   node demo/<name>/present.mjs                 wait for Enter between sections
//   node demo/<name>/present.mjs --auto          play through, 8 seconds apart
//   node demo/<name>/present.mjs --auto=15       play through, 15 seconds apart
//   node demo/<name>/present.mjs --from 8        start at section 8
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phileas = path.join(repo, 'bin', 'phileas.mjs');

/**
 * What no run inherits from the shell the demo was started in: the engine's
 * settings and every demo's own switches. A setting left over there would
 * change a run without appearing in the command shown for it, and a leftover
 * EIGHTY_DAYS_PLANT would switch a bug on in a section meant to show the game
 * working. Every demo's prefix is here, not only the running demo's, since a
 * presenter who ran one demo and then another has both in the shell.
 */
const INHERITED_PREFIXES_REFUSED = ['PHILEAS_', 'RAIL_DEMO_', 'EIGHTY_DAYS_'];

// --- options ---------------------------------------------------------------

const args = process.argv.slice(2);
const autoArg = args.find((a) => a === '--auto' || a.startsWith('--auto='));
const autoSeconds = autoArg ? Number(autoArg.split('=')[1] ?? 8) : undefined;
const fromIndex = args.indexOf('--from');
const from = fromIndex >= 0 ? Number(args[fromIndex + 1]) : 1;
if ((autoSeconds !== undefined && !(autoSeconds >= 0)) || !(from >= 1)) {
  console.error('Usage: present.mjs [--auto[=seconds]] [--from <section>]');
  process.exit(2);
}

// --- presentation helpers ----------------------------------------------------

const tty = process.stdout.isTTY;
export const bold = (s) => (tty ? `\x1b[1m${s}\x1b[0m` : s);
export const dim = (s) => (tty ? `\x1b[2m${s}\x1b[0m` : s);

function heading(number, title) {
  console.log(`\n${bold(`${number}. ${title}`)}\n`);
}

export function say(text) {
  console.log(text);
}

function showCommand(line) {
  console.log(dim(`$ ${line}`));
}

export function showCode(code) {
  for (const line of code.split('\n')) console.log(`    ${line}`);
  console.log('');
}

// One reader for the whole demo. A reader per pause would each take whatever
// Enters were already waiting and throw the rest away with it when closed.
let reader;
let inputEnded = false;

/** Wait for Enter, or for the --auto interval. Once input has ended, go on without waiting. */
async function pause(prompt) {
  if (autoSeconds !== undefined) {
    await new Promise((resolve) => setTimeout(resolve, autoSeconds * 1000));
    return;
  }
  if (inputEnded) return;
  if (!reader) {
    reader = readline.createInterface({ input: process.stdin, output: process.stdout });
    reader.on('close', () => (inputEnded = true));
  }
  await new Promise((resolve) => {
    reader.once('close', resolve);
    reader.question(dim(`  ${prompt} `)).then(resolve, resolve);
  });
}

/**
 * Show a command, then wait before running it. The wait is what makes the
 * command worth showing: printed as it starts, it scrolls away under the run's
 * own output before anyone has read it.
 */
export async function announce(line) {
  showCommand(line);
  await pause('Press Enter to run it');
}

/** A command as it would be typed, with quote marks where the shell needs them. */
export function typed(commandArgs) {
  return commandArgs.map((a) => (/[\s$"]/.test(a) ? `'${a}'` : a)).join(' ');
}

/** A path as a person in the repository would type it. */
export function fromRepo(file) {
  return path.relative(repo, file);
}

// --- running the engine ------------------------------------------------------

/** Lines of the engine's own that are not worth a watcher's attention. */
function isNoise(line) {
  return (
    /^Running \d+ tests? using/.test(line) ||
    /^\[\d+\/\d+\] /.test(line) ||
    /journey\.spec\.ts:\d+:\d+ › route \d+$/.test(line) ||
    /^\s*\d+ passed \(/.test(line)
  );
}

/** The window mode for every run: forward, for an audience, unless PHILEAS_SHOW says otherwise. */
const SHOW = process.env.PHILEAS_SHOW || 'front';

/**
 * Show a `phileas` command exactly as it would be typed, settings and all, and
 * then run it. Every run in a demo goes through here, so no command runs
 * without being shown first.
 *
 * `run` gets the window mode as its --show flag; `survey` takes no flags, so it
 * gets it as PHILEAS_SHOW in front, the way a person would type it.
 */
export async function phileasShown(command, commandArgs, env = {}) {
  const shownEnv = { ...env };
  const argv = [command, ...commandArgs];
  if (command === 'run') {
    const extra = argv.indexOf('--');
    argv.splice(extra >= 0 ? extra : argv.length, 0, '--show', SHOW);
  }
  if (command === 'survey') shownEnv.PHILEAS_SHOW = SHOW;
  const prefix = Object.entries(shownEnv).map(([k, v]) => `${k}=${v} `).join('');
  await announce(`${prefix}phileas ${typed(argv)}`);
  return runPhileas(argv, shownEnv);
}

/**
 * Run the `phileas` command and hand back its output with Playwright's own
 * lines taken out and blank lines collapsed. A run that fails prints
 * everything, unfiltered, and stops the demo: a filtered failure would be a
 * demo hiding the thing it is meant to show.
 */
function runPhileas(commandArgs, env) {
  return new Promise((resolve) => {
    const runEnv = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !INHERITED_PREFIXES_REFUSED.some((p) => k.startsWith(p)))
    );
    Object.assign(runEnv, env);
    const child = spawn(process.execPath, [phileas, ...commandArgs], {
      cwd: repo,
      env: runEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => {
      if (code !== 0) {
        console.log(output);
        console.log(bold(`\nThat run failed (exit ${code}), so the demo stops here.`));
        process.exit(code || 1);
      }
      // Playwright's line reporter leaves a blank line after each of the
      // engine's lines, so blank lines are dropped and put back only where
      // they separate something: after the settings, and before each Route
      // and each listing.
      const lines = [];
      for (const line of output.split('\n')) {
        if (isNoise(line) || line.trim() === '') continue;
        const startsBlock = /^route \d+ {2}seed |^What the engine sees/.test(line);
        if (startsBlock && lines.length && lines.at(-1) !== '') lines.push('');
        lines.push(line);
        if (/^Follow: |^Journals in /.test(line)) lines.push('');
      }
      resolve(lines);
    });
  });
}

/** The engine's output, followed by a blank line to set it apart from what comes next. */
export function print(lines) {
  for (const line of lines) console.log(line);
  if (lines.at(-1) !== '') console.log('');
}

/**
 * Per-Hop lines with a heading row above them, lined up with the renderer's
 * columns: the Route and Hop share its first 18 characters, then 11 for the
 * action and 44 for what was acted on.
 */
export function withColumnHeadings(lines) {
  const headings = `${'Route'.padEnd(9)}${'Hop'.padEnd(9)}${'Action'.padEnd(11)}${'Acted on'.padEnd(44)}What changed`;
  const first = lines.findIndex((line) => /^route \d+ {2}hop /.test(line));
  if (first < 0) return lines;
  return [...lines.slice(0, first), bold(headings), ...lines.slice(first)];
}

/** Everything after the settings block. */
export function afterSettings(lines) {
  return lines.slice(lines.findIndex((line) => line.trim() === '') + 1);
}

/** The survey's listing at the start, before any Fix runs. */
export function startListing(lines) {
  const body = afterSettings(lines);
  const end = body.findIndex((l) => /^route \d+ {2}fix /.test(l));
  return end >= 0 ? body.slice(0, end) : body;
}

/** The survey's Fix steps and the listing after them. */
export function fixAndAfter(lines) {
  const body = afterSettings(lines);
  return body.slice(body.findIndex((l) => /^route \d+ {2}fix /.test(l)));
}

// --- one demo's own ----------------------------------------------------------

/**
 * The helpers that need to know which demo is running: where its config and
 * journals are.
 */
export function demoFolders(configDir) {
  const journalsRoot = path.join(configDir, '.phileas-journals');
  return {
    journalsRoot,

    /** A passage of a source file in the demo's config, with its comments left out, for showing on screen. */
    excerpt(file, pattern) {
      const text = fs.readFileSync(path.join(configDir, file), 'utf8');
      const match = text.match(pattern);
      if (!match) throw new Error(`The demo could not find its excerpt in ${file}; it has changed shape.`);
      const lines = match[0]
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line) && line.trim() !== '');
      const indent = Math.min(...lines.map((line) => line.match(/^ */)[0].length));
      return lines.map((line) => line.slice(indent)).join('\n');
    },

    /** The run folder a run's printout names. */
    runFolderOf(lines) {
      const seed = lines.find((l) => l.startsWith('Journey seed:'))?.split(/\s+/)[2];
      const run = lines.find((l) => l.startsWith('Run:'))?.split(/\s+/)[1];
      return path.join(journalsRoot, seed, run);
    },
  };
}

// --- run ---------------------------------------------------------------------

/** Show the sections in order, from --from, pausing between them. */
export async function present(title, sections) {
  console.log(bold(title));
  if (autoSeconds !== undefined) console.log(dim(`Playing through, ${autoSeconds} seconds between sections.`));
  if (from > sections.length) {
    console.error(`There are ${sections.length} sections, so --from ${from} would show nothing.`);
    process.exit(2);
  }
  for (const [i, section] of sections.entries()) {
    const number = i + 1;
    if (number < from) continue;
    heading(number, section.title);
    await section.run();
    if (number < sections.length) {
      console.log('');
      await pause('Press Enter for the next section');
    }
  }
  console.log(bold('\nThat is the demo.'));
  reader?.close();
}

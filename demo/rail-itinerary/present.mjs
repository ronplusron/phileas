// The guided demo: Phileas at work on Rail Itinerary, one section at a time.
//
// Every section runs the real engine against the real application, with its
// window on screen. Nothing is recorded in advance. Between sections it waits
// for Enter, so a presenter can talk and take questions; with --auto it waits a
// few seconds instead and plays straight through.
//
//   npm run demo:present                   wait for Enter between sections
//   npm run demo:present -- --auto         play through, 8 seconds apart
//   npm run demo:present -- --auto=15      play through, 15 seconds apart
//   npm run demo:present -- --from 8       start at section 8
//
// PRESENTING.md beside this file is the same demo as a script to read from,
// with what to point at in each section.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const configDir = path.join(here, 'phileas');
const journalsRoot = path.join(configDir, '.phileas-journals');
const phileas = path.join(repo, 'bin', 'phileas.mjs');

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
const bold = (s) => (tty ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s) => (tty ? `\x1b[2m${s}\x1b[0m` : s);

function heading(number, title) {
  console.log(`\n${bold(`${number}. ${title}`)}\n`);
}

function say(text) {
  console.log(text);
}

function showCommand(line) {
  console.log(dim(`$ ${line}`));
}

function showCode(code) {
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
async function announce(line) {
  showCommand(line);
  await pause('Press Enter to run it');
}

/** A passage of a source file, with its comments left out, for showing on screen. */
function excerpt(file, pattern) {
  const text = fs.readFileSync(path.join(configDir, file), 'utf8');
  const match = text.match(pattern);
  if (!match) throw new Error(`The demo could not find its excerpt in ${file}; it has changed shape.`);
  const lines = match[0]
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line) && line.trim() !== '');
  const indent = Math.min(...lines.map((line) => line.match(/^ */)[0].length));
  return lines.map((line) => line.slice(indent)).join('\n');
}

/** A command as it would be typed, with quote marks where the shell needs them. */
function typed(commandArgs) {
  return commandArgs.map((a) => (/[\s$"]/.test(a) ? `'${a}'` : a)).join(' ');
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
 * then run it. Every run in the demo goes through here, so no command runs
 * without being shown first.
 *
 * `run` gets the window mode as its --show flag; `survey` takes no flags, so it
 * gets it as PHILEAS_SHOW in front, the way a person would type it.
 */
async function phileasShown(command, commandArgs, env = {}) {
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
    // Nothing of Phileas's or the demo's own is inherited from the shell the
    // demo was started in, so a setting left over there cannot change a run
    // without appearing in the command shown for it.
    const runEnv = Object.fromEntries(
      Object.entries(process.env).filter(([k]) => !k.startsWith('PHILEAS_') && k !== 'RAIL_DEMO_JOURNEY')
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
function print(lines) {
  for (const line of lines) console.log(line);
  if (lines.at(-1) !== '') console.log('');
}

/**
 * Per-Hop lines with a heading row above them, lined up with the renderer's
 * columns: the Route and Hop share its first 18 characters, then 11 for the
 * action and 44 for what was acted on.
 */
function withColumnHeadings(lines) {
  const headings = `${'Route'.padEnd(9)}${'Hop'.padEnd(9)}${'Action'.padEnd(11)}${'Acted on'.padEnd(44)}What changed`;
  const first = lines.findIndex((line) => /^route \d+ {2}hop /.test(line));
  if (first < 0) return lines;
  return [...lines.slice(0, first), bold(headings), ...lines.slice(first)];
}

/** Everything after the settings block. */
function afterSettings(lines) {
  return lines.slice(lines.findIndex((line) => line.trim() === '') + 1);
}

/** The run folder a run's printout names. */
function runFolderOf(lines) {
  const seed = lines.find((l) => l.startsWith('Journey seed:'))?.split(/\s+/)[2];
  const run = lines.find((l) => l.startsWith('Run:'))?.split(/\s+/)[1];
  return path.join(journalsRoot, seed, run);
}

/** What a replay must reproduce: each Trip hop's target, action, value and draws. `route` counts from 1. */
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

/** The survey's listing at the start, before any Fix runs. */
function startListing(lines) {
  const body = afterSettings(lines);
  const end = body.findIndex((l) => /^route \d+ {2}fix /.test(l));
  return end >= 0 ? body.slice(0, end) : body;
}

/** The survey's Fix steps and the listing after them. */
function fixAndAfter(lines) {
  const body = afterSettings(lines);
  return body.slice(body.findIndex((l) => /^route \d+ {2}fix /.test(l)));
}

// --- the sections ------------------------------------------------------------

// How long a survey holds each screen, so a watcher sees the window before it
// closes: a survey otherwise looks and closes the application in a moment.
const SURVEY_HOLD = { PHILEAS_HOP_DELAY_MS: '2000' };

// The Journey sections 8 to 10 share: the Fix that ends in the ticket dialog.
const JOURNEY_ENV = { RAIL_DEMO_JOURNEY: 'tickets' };
const JOURNEY_ARGS = ['demo/rail-itinerary/phileas', '--seed', 'rail-demo', '--routes', '3',
  '--trip-length', '15', '--hop-delay-ms', '300'];
let journeyRun; // the run folder section 8 makes, which 9 and 10 use

const sections = [
  {
    title: 'What you are about to see',
    async run() {
      say('Phileas explores an application the way a curious tester would: it looks at what is');
      say('on screen, picks something, does it, and repeats. No script says where to go.\n');
      say(`  ${bold('Journey')}  one run of Phileas: how many Routes, how long each one is, and a seed.`);
      say(`  ${bold('Route')}    one independent exploration, with its own pass or fail.`);
      say(`  ${bold('Fix')}      the fixed opening every Route follows first, so it starts somewhere known.`);
      say(`  ${bold('Trip')}     the unpredictable rest of a Route, after its Fix.`);
      say(`  ${bold('Hop')}      one move: a click, some typing, a key, a menu choice.\n`);
      say('Every choice comes from a seed, so any run can be repeated exactly.');
      say('The application here is Rail Itinerary, a small train planner built for this demo.');
    },
  },
  {
    title: 'A first look',
    async run() {
      say('A whole Journey, as small as it gets: one Route of ten Hops, starting wherever the');
      say('application starts. Watch the window, then read the lines. Each Hop is one line, in');
      say('five columns:\n');
      say(`  ${bold('Route')}         which Route, counting from 1`);
      say(`  ${bold('Hop')}           which move in that Route`);
      say(`  ${bold('Action')}        click, type, press, select or menu-click`);
      say(`  ${bold('Acted on')}      the control, by its kind and name, and any text typed into it`);
      say(`  ${bold('What changed')}  headings that appeared (+) or went away (-), or "no change"\n`);
      const lines = await phileasShown('run', ['demo/rail-itinerary/phileas', '--seed', 'first-look',
        '--routes', '1', '--trip-length', '10', '--hop-delay-ms', '700', '--follow'], { RAIL_DEMO_JOURNEY: 'no-fix' });
      print(withColumnHeadings(afterSettings(lines)));
      say('The rest of the demo takes that apart.');
    },
  },
  {
    title: 'How Phileas finds controls',
    async run() {
      say('Nobody tells Phileas what is in the application. It reads the screen the way a screen');
      say('reader does, and keeps every control that is visible, enabled and has a name.');
      say('Here is everything it finds when Rail Itinerary starts:\n');
      const lines = await phileasShown('survey', ['demo/rail-itinerary/phileas'],
        { RAIL_DEMO_JOURNEY: 'no-fix', ...SURVEY_HOLD });
      print(startListing(lines));
      say('"excluded" marks what it never touches: the standard menu entries every app gets, such');
      say('as Quit, and whatever the adapter lists. The keys are offered on every screen.');
    },
  },
  {
    title: 'How it decides each move',
    async run() {
      say('Playwright, the library Phileas drives the application with, only knows how to do');
      say('things: find, click, type. Phileas decides which thing, one move at a time.');
      say('Watch one short Route of three Hops, slowly:\n');
      const lines = await phileasShown('run', ['demo/rail-itinerary/phileas', '--seed', 'how-it-decides',
        '--routes', '1', '--trip-length', '3', '--hop-delay-ms', '1500', '--follow'], { RAIL_DEMO_JOURNEY: 'no-fix' });
      print(afterSettings(lines));
      say('Now Hop 1 in slow motion, worked out from what the engine wrote down:\n');
      await explainHop(runFolderOf(lines), 1);
    },
  },
  {
    title: 'How it is configured',
    async run() {
      say('Two small files. The Journey says how much to explore:\n');
      showCode(excerpt('journeys/demo.ts', /export const demo = defineJourney\(\{[\s\S]*?\}\);/));
      say('The adapter tells Phileas about this one application: where its build is, how to tell');
      say('it has started, and what it must never touch. The last part looks like this:\n');
      showCode(excerpt('adapter/index.ts', /\n {2}exclusions: \{[\s\S]*?\n {2}\},/));
      say('Any setting can be changed for one run, without editing a file:\n');
      showCode('phileas run --seed <anything> --routes 5 --trip-length 100 --show front --follow');
    },
  },
  {
    title: 'A Fix of one step',
    async run() {
      say('A Fix is written by copying a line from the survey. This one opens an itinerary, so every');
      say("Route's Trip starts inside it:\n");
      showCode(excerpt('journeys/demo.ts', /export const openAlps[^\n]*/));
      const lines = await phileasShown('survey', ['demo/rail-itinerary/phileas'],
        { RAIL_DEMO_JOURNEY: 'open-alps', ...SURVEY_HOLD });
      print(fixAndAfter(lines));
    },
  },
  {
    title: 'A Fix of several steps',
    async run() {
      say('This Fix opens the same itinerary, adds a leg from Geneva to Zurich, and opens the');
      say('ticket purchase dialog. It was built one step at a time: run the survey, copy the next');
      say('line, run the survey again.\n');
      showCode(excerpt('journeys/tickets.ts', /export const addLegThenBuy[\s\S]*?\n\};/));
      say('One step is ordinary Playwright code instead of a copied line. The From and To lists name');
      say('the same stations, so a copied line cannot say which list it means. A Fix can always drop');
      say('down to Playwright for a step like that.\n');
      const lines = await phileasShown('survey', ['demo/rail-itinerary/phileas'],
        { RAIL_DEMO_JOURNEY: 'tickets', ...SURVEY_HOLD });
      print(fixAndAfter(lines));
      say('After the Fix, the only controls on offer are the dialog\'s. That is where every Trip starts.');
    },
  },
  {
    title: 'A Journey in action',
    async run() {
      say('Three Routes of fifteen Hops, with the Fix from the last section. Each Route starts the');
      say('application fresh, follows the Fix into the ticket dialog, and takes its Trip from there.');
      say('One line per Hop: what it acted on, how, and what changed.\n');
      const lines = await phileasShown('run', [...JOURNEY_ARGS, '--follow'], JOURNEY_ENV);
      print(lines);
      journeyRun = runFolderOf(lines);
    },
  },
  {
    title: 'Seeding: the same seed makes the same moves',
    async run() {
      say('The seed decides every move. One Route of five Hops, then the same seed for ten:\n');
      const seedArgs = (hops) => ['demo/rail-itinerary/phileas', '--seed', 'five-then-ten', '--routes', '1',
        '--trip-length', String(hops), '--hop-delay-ms', '500', '--follow'];
      const fiveLines = await phileasShown('run', seedArgs(5), { RAIL_DEMO_JOURNEY: 'no-fix' });
      print(afterSettings(fiveLines));
      const tenLines = await phileasShown('run', seedArgs(10), { RAIL_DEMO_JOURNEY: 'no-fix' });
      print(afterSettings(tenLines));
      const five = hopsOf(runFolderOf(fiveLines), 1);
      const ten = hopsOf(runFolderOf(tenLines), 1);
      const prefix = five.length === 5 && five.every((hop, i) => hop === ten[i]);
      say(
        prefix
          ? bold('The ten-Hop Route starts with exactly the same five Hops, then carries on.')
          : bold(`The ten-Hop Route did not start with the same five Hops: they first differ at hop ${five.findIndex((hop, i) => hop !== ten[i]) + 1}.`)
      );
      say('The Trip length only decides where a Route stops.\n');

      const first = await ensureJourneyRun();
      say('A Route can also be replayed on its own. Route 1 of the Journey from section 8, again:\n');
      const again = runFolderOf(await phileasShown('run', [...JOURNEY_ARGS, '--', '--grep', 'route 1$'], JOURNEY_ENV));
      const a = hopsOf(first, 1);
      const b = hopsOf(again, 1);
      const same = a.length === b.length && a.every((hop, i) => hop === b[i]);
      say(
        same
          ? bold(`Route 1 retraced all ${a.length} hops exactly.`)
          : bold(`Route 1 did not retrace: the runs first differ at hop ${a.findIndex((hop, i) => hop !== b[i]) + 1}.`)
      );
      say('\nAnd a different seed makes different moves, against the five-Hop Route above:\n');
      print(afterSettings(await phileasShown('run', ['demo/rail-itinerary/phileas', '--seed', 'another-seed',
        '--routes', '1', '--trip-length', '5', '--hop-delay-ms', '500', '--follow'], { RAIL_DEMO_JOURNEY: 'no-fix' })));
    },
  },
  {
    title: 'The output',
    async run() {
      const folder = await ensureJourneyRun();
      say('Every Route writes a journal as it goes, one line per Hop, saved to disk after each Hop');
      say('so a crash cannot lose it. One file per Route:\n');
      await announce(`ls ${path.relative(repo, folder)}`);
      for (const f of fs.readdirSync(folder).sort()) say(`  ${f}`);
      say('\nRead back for a person:\n');
      print(await phileasShown('show', [path.relative(repo, folder)]));
      say('And one Hop as the engine wrote it, which is what makes an exact replay possible:\n');
      const file = fs.readdirSync(folder).sort()[0];
      const hop = fs
        .readFileSync(path.join(folder, file), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .find((e) => e.kind === 'trip-hop');
      showCode(JSON.stringify(hop, null, 2));
    },
  },
];

/** Section 8's run, made now if the demo started after it. */
async function ensureJourneyRun() {
  if (journeyRun) return journeyRun;
  say(dim('(Running the Journey from section 8 first, since the demo started after it.)\n'));
  journeyRun = runFolderOf(await phileasShown('run', JOURNEY_ARGS, JOURNEY_ENV));
  say('');
  return journeyRun;
}

async function explainHop(folder, hop) {
  const script = path.join(here, 'explain-hop.mjs');
  await announce(`node ${typed([path.relative(repo, script), path.relative(repo, folder), String(hop)])}`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, folder, String(hop)], { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code !== 0) process.exit(code || 1);
      resolve();
    });
  });
}

// --- run ---------------------------------------------------------------------

console.log(bold('Phileas on Rail Itinerary'));
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

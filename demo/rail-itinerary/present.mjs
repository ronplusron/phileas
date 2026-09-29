// The guided demo: Phileas at work on Rail Itinerary, one section at a time.
//
// Every section runs the real engine against the real application, with its
// window on screen. Nothing is recorded in advance. Between sections it waits
// for Enter, so a presenter can talk and take questions; with --auto it waits a
// few seconds instead and plays straight through.
//
//   npm run demo:train:present                   wait for Enter between sections
//   npm run demo:train:present -- --auto         play through, 8 seconds apart
//   npm run demo:train:present -- --auto=15      play through, 15 seconds apart
//   npm run demo:train:present -- --from 8       start at section 8
//
// Both stages of docs/DEMO_PLAN_TRAIN.md: sections 1 to 10 are stage one,
// exploring with nothing planted, and 11 to 16 are stage two, a planted bug
// found, a trap stranding, the bug replayed, filed and traveled past, and
// several found at once. PRESENTING.md beside this file is the same demo as a
// script to read from, with what to point at in each section. The runner
// itself, shared with the other demos, is demo/presenting.mjs; this file holds
// only the sections.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  afterSettings,
  announce,
  bold,
  demoFolders,
  dim,
  endingLines,
  fixAndAfter,
  fixLines,
  fromRepo,
  phileasShown,
  present,
  print,
  say,
  seedMissed,
  showCode,
  startListing,
  stop,
  tripTail,
  typed,
  withColumnHeadings,
} from '../presenting.mjs';
import { hopsOf, journeyEndLines, metIn, retraceVerdict, withoutJourneyEnd } from '../journals.mjs';
import { PLANT_SEEDS, SEVERAL } from './seeds.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const { excerpt, journalsRoot, runFolderOf } = demoFolders(path.join(here, 'phileas'));
const CONFIG = 'demo/rail-itinerary/phileas';

/**
 * A stage-one run, with the lines a Journey's end prints about known findings
 * taken out. Nothing is planted in stage one, so they only ever say none was
 * found, and they belong to stage two, which introduces them.
 */
const runShown = async (...args) => withoutJourneyEnd(await phileasShown(...args));

// --- the sections ------------------------------------------------------------

// How long a survey holds each screen, so a watcher sees the window before it
// closes: a survey otherwise looks and closes the application in a moment.
const SURVEY_HOLD = { PHILEAS_HOP_DELAY_MS: '2000' };

// The Fix sections 8 to 10 share: the one that ends in the ticket dialog.
const FIX_ENV = { PHILEAS_FIX: 'add-leg-then-buy' };
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
      const lines = await runShown('run', ['demo/rail-itinerary/phileas', '--seed', 'first-look',
        '--routes', '1', '--trip-length', '10', '--hop-delay-ms', '700', '--follow'], { PHILEAS_FIX: 'none' });
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
        { PHILEAS_FIX: 'none', ...SURVEY_HOLD });
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
      const lines = await runShown('run', ['demo/rail-itinerary/phileas', '--seed', 'how-it-decides',
        '--routes', '1', '--trip-length', '3', '--hop-delay-ms', '1500', '--follow'], { PHILEAS_FIX: 'none' });
      print(afterSettings(lines));
      say('Now Hop 1 in slow motion, worked out from what the engine wrote down:\n');
      await explainHop(runFolderOf(lines), 1);
    },
  },
  {
    title: 'How it is configured',
    async run() {
      say('Two small files. The Journey says how much to explore:\n');
      showCode(excerpt('journeys/index.ts', /export const journey = defineJourney\(\{[\s\S]*?\}\);/));
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
      showCode(excerpt('fixes/open-alps.ts', /export const openAlps[^\n]*/));
      const lines = await phileasShown('survey', ['demo/rail-itinerary/phileas'],
        { PHILEAS_FIX: 'open-alps', ...SURVEY_HOLD });
      print(fixAndAfter(lines));
    },
  },
  {
    title: 'A Fix of several steps',
    async run() {
      say('This Fix opens the same itinerary, adds a leg from Geneva to Zurich, and opens the');
      say('ticket purchase dialog. It was built one step at a time: run the survey, copy the next');
      say('line, run the survey again.\n');
      showCode(excerpt('fixes/add-leg-then-buy.ts', /export const addLegThenBuy[\s\S]*?\n\};/));
      say('One step is ordinary Playwright code instead of a copied line. The From and To lists name');
      say('the same stations, so a copied line cannot say which list it means. A Fix can always drop');
      say('down to Playwright for a step like that.\n');
      const lines = await phileasShown('survey', ['demo/rail-itinerary/phileas'],
        { PHILEAS_FIX: 'add-leg-then-buy', ...SURVEY_HOLD });
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
      const lines = await runShown('run', [...JOURNEY_ARGS, '--follow'], FIX_ENV);
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
      const fiveLines = await runShown('run', seedArgs(5), { PHILEAS_FIX: 'none' });
      print(afterSettings(fiveLines));
      const tenLines = await runShown('run', seedArgs(10), { PHILEAS_FIX: 'none' });
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
      const again = runFolderOf(await runShown('run', [...JOURNEY_ARGS, '--', '--grep', 'route 1$'], FIX_ENV));
      const a = hopsOf(first, 1);
      const b = hopsOf(again, 1);
      say(bold(retraceVerdict(a, b)));
      say('\nAnd a different seed makes different moves, against the five-Hop Route above:\n');
      print(afterSettings(await runShown('run', ['demo/rail-itinerary/phileas', '--seed', 'another-seed',
        '--routes', '1', '--trip-length', '5', '--hop-delay-ms', '500', '--follow'], { PHILEAS_FIX: 'none' })));
    },
  },
  {
    title: 'The output',
    async run() {
      const folder = await ensureJourneyRun();
      say('Every Route writes a journal as it goes, one line per Hop, saved to disk after each Hop');
      say('so a crash cannot lose it. One file per Route:\n');
      await announce(`ls ${fromRepo(folder)}`);
      for (const f of fs.readdirSync(folder).sort()) say(`  ${f}`);
      say('\nRead back for a person:\n');
      print(await phileasShown('show', [fromRepo(folder)]));
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
  // --- stage two: finding bugs -----------------------------------------------
  {
    title: 'Stage two: planting a bug',
    async run() {
      say('Now the same application with bugs planted in it, each behind a switch of its own, so the');
      say('build shown working is the same build shown broken, and any one bug can be shown alone:\n');
      for (const [plant, what] of Object.entries(PLANTED)) say(`  ${plant.padEnd(18)}${dim(what)}`);
      say('');
      say('A planted bug is found by a Journey, not steered to: a seed was searched for whose Route');
      say('meets it on its own. Each section says so if its seed no longer does.');
    },
  },
  {
    title: 'Found',
    async run() {
      say(`The ${FOUND.plant} bug: ${PLANTED[FOUND.plant]}. From an empty known findings file,`);
      say('one Route, opening the Alps itinerary as every Route so far has:\n');
      await runFound();
      print(found.shown);
      say(`Route 1 ended at Trip hop ${found.hop}, the Hop that chose the sleeper class. The failed check`);
      say(`names it, and the finding's id, ${found.id}, is the same every time the same bug is seen. The`);
      say("Journey's end added it to the known findings as unfiled, which a later section undoes on purpose.");
    },
  },
  {
    title: 'Stranded, which is not a finding',
    async run() {
      const trap = { plant: 'seating-trap', ...PLANT_SEEDS['seating-trap'] };
      say(`The ${trap.plant} bug: ${PLANTED[trap.plant]}. A Route that reaches it has no move left.`);
      say('That is a third outcome, not a failure:\n');
      fs.rmSync(trapFile, { force: true });
      const { run, folder } = await runPlanted(trap, { mayFail: true }, trapFile);
      const met = metIn(folder);
      if (met.where !== 'stranded') seedMissed(run, trap.plant, trap);
      print([...tripTail(run.lines, 3), ...journeyEndLines(run.lines)]);
      say(`Stranded after Trip hop ${met.hop}, with no finding and nothing added to the known findings. A`);
      say('trap may be a bug or a corner with nothing more to do; the engine says what it saw and no more.');
    },
  },
  {
    title: 'Replayed',
    async run() {
      await ensureFound();
      say('The known findings file is put back as it was before the bug was found, and the same Route');
      say('runs again from its seed:\n');
      fs.rmSync(knownFile, { force: true });
      const again = await runPlanted(FOUND, { mayFail: true });
      const met = metIn(again.folder);
      if (met.where !== 'trip' || met.hop !== found.hop) seedMissed(again.run, FOUND.plant, FOUND);
      print(tripTail(again.run.lines, 3));
      say(bold(retraceVerdict(hopsOf(found.folder, 1), hopsOf(again.folder, 1))));
      say(`\nThe same moves, straight back to Trip hop ${met.hop}, and the same finding, ${met.ids.join(', ')}. That is`);
      say('what makes a finding worth filing: anyone can watch it happen again.');
    },
  },
  {
    title: 'Filed, and traveled past',
    async run() {
      await ensureFound();
      say('Filing the finding with the issue it was reported as:\n');
      print(await phileasShown('known', ['add', found.id, '--issue', 'demo-1', fromRepo(knownFile)]));
      say('And the same Route once more. This time the bug is known, so it no longer ends the Route:\n');
      const past = await runPlanted(FOUND, { mayFail: true });
      if (past.run.code !== 0) stop(past.run.output, 'The Route should have traveled past the filed bug, and did not.');
      const around = past.run.lines.filter((line) => {
        const m = line.match(/^route \d+ {2}hop (\d+) /);
        return m && Math.abs(Number(m[1]) - found.hop) <= 1;
      });
      print([...around, ...endingLines(past.run.lines), ...journeyEndLines(past.run.lines)]);
      say(`At Trip hop ${found.hop} the line says the finding is known, with its issue, and the Route carries on`);
      say('to the end of its Trip. The summary still says it was seen, so a filed bug never goes quiet.');
    },
  },
  {
    title: 'Several at once',
    async run() {
      say(`${SEVERAL.plants.length} bugs planted together, ${SEVERAL.routes} Routes of ${SEVERAL.tripLength} Hops, from an empty known findings file:\n`);
      fs.rmSync(severalFile, { force: true });
      const run = await phileasShown(
        'run',
        [CONFIG, '--fix', SEVERAL.fix, '--seed', SEVERAL.seed, '--routes', String(SEVERAL.routes), '--trip-length', String(SEVERAL.tripLength), '--hop-delay-ms', '300'],
        { RAIL_DEMO_PLANT: SEVERAL.plants.join(','), RAIL_DEMO_KNOWN: fromRepo(severalFile) },
        { mayFail: true }
      );
      const folder = runFolderOf(run.lines);
      const end = journeyEndLines(run.lines);
      const findings = end.filter((line) => /^ {2}UNFILED/.test(line)).length;
      if (findings < SEVERAL.plants.length) {
        stop(run.output, `With seed ${SEVERAL.seed} this Journey found ${findings} of the ${SEVERAL.plants.length} planted bugs it was measured to find.`);
      }
      for (let route = 1; route <= SEVERAL.routes; route++) {
        const met = metIn(folder, route);
        const how =
          met.where === 'trip' ? `found ${met.checks.join(', ')} at Trip hop ${met.hop}, finding ${met.ids.join(', ')}` : met.where === 'stranded' ? `stranded after Trip hop ${met.hop}` : `${met.outcome} its Trip`;
        say(`  route ${route}  ${how}`);
      }
      say('');
      print(end);
      say('Each finding once, with how often it was seen. Every Route that met a bug ended there,');
      say('since none was known yet; from the next Journey on, these are, and the Routes go further.');
      say('A Route that met neither passed, and a bug nobody reached is not reported as absent.');
    },
  },
];

// --- stage two's helpers -----------------------------------------------------

/** What each planted bug does, as a watcher would put it. */
const PLANTED = {
  'sleeper-throw': 'choosing the sleeper class throws an error',
  'last-leg-blank': "removing an itinerary's last leg blanks the window",
  'seating-trap': 'Choose seats opens a dialog with nothing in it to press',
};

/**
 * The known findings file the found, replayed and filed sections read and
 * write, emptied when the demo starts. A Journey's end adds whatever it found,
 * and a finding held there lets a Route carry on past it, so the demo keeps its
 * own rather than whatever earlier runs left in the ordinary one. The trap and
 * the several-at-once sections keep files of their own, so neither reads the
 * finding the found section added, nor adds to its file.
 */
const knownFile = path.join(journalsRoot, 'present', 'known-findings.json');
const trapFile = path.join(journalsRoot, 'present', 'known-trap.json');
const severalFile = path.join(journalsRoot, 'present', 'known-several.json');

/** The bug the found, replayed and filed sections share, and the seed measured to reach it. */
const FOUND = { plant: 'sleeper-throw', ...PLANT_SEEDS['sleeper-throw'] };
let found; // the found section's run: its folder, the Hop, the finding's id and what was shown

/** Run a plant's Journey, one Route, from its measured seed, reading and writing a known findings file. */
async function runPlanted(p, options, known = knownFile) {
  const run = await phileasShown(
    'run',
    [CONFIG, '--fix', p.fix, '--seed', p.seed, '--routes', '1', '--trip-length', String(p.tripLength), '--hop-delay-ms', '300', '--follow'],
    { RAIL_DEMO_PLANT: p.plant, RAIL_DEMO_KNOWN: fromRepo(known) },
    options
  );
  return { run, folder: runFolderOf(run.lines) };
}

async function runFound() {
  fs.rmSync(knownFile, { force: true });
  const { run, folder } = await runPlanted(FOUND, { mayFail: true });
  const met = metIn(folder);
  if (met.where !== 'trip') seedMissed(run, FOUND.plant, FOUND);
  const shown = [
    ...fixLines(run.lines),
    ...run.lines.filter((line) => /^route \d+ {2}hop /.test(line)),
    ...endingLines(run.lines),
    '',
    ...journeyEndLines(run.lines),
  ];
  found = { folder, hop: met.hop, id: met.ids[0], shown };
}

/** The found section's run, made now if the demo started after it. */
async function ensureFound() {
  if (found) return;
  say(dim('(Running the found section first, since the demo started after it.)\n'));
  await runFound();
  say('');
}

/** Section 8's run, made now if the demo started after it. */
async function ensureJourneyRun() {
  if (journeyRun) return journeyRun;
  say(dim('(Running the Journey from section 8 first, since the demo started after it.)\n'));
  journeyRun = runFolderOf(await runShown('run', JOURNEY_ARGS, FIX_ENV));
  say('');
  return journeyRun;
}

async function explainHop(folder, hop) {
  const script = path.join(here, 'explain-hop.mjs');
  await announce(`node ${typed([fromRepo(script), fromRepo(folder), String(hop)])}`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, folder, String(hop)], { stdio: 'inherit' });
    child.on('close', (code) => {
      if (code !== 0) process.exit(code || 1);
      resolve();
    });
  });
}

// --- run ---------------------------------------------------------------------

fs.rmSync(knownFile, { force: true });
fs.mkdirSync(path.dirname(knownFile), { recursive: true });
await present('Phileas on Rail Itinerary', sections);

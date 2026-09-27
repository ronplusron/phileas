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
// PRESENTING.md beside this file is the same demo as a script to read from,
// with what to point at in each section. The runner itself, shared with the
// other demos, is demo/presenting.mjs; this file holds only the sections.
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
  fixAndAfter,
  fromRepo,
  phileasShown,
  present,
  print,
  say,
  showCode,
  startListing,
  typed,
  withColumnHeadings,
} from '../presenting.mjs';
import { hopsOf, retraceVerdict } from './journals.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const { excerpt, runFolderOf } = demoFolders(path.join(here, 'phileas'));

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
      say(bold(retraceVerdict(a, b)));
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

await present('Phileas on Rail Itinerary', sections);

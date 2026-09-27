// The guided demo: Phileas at work on Eighty Days, one section at a time.
//
// Every section runs the real engine against the real game, with its window on
// screen. Nothing is recorded in advance. Between sections it waits for Enter,
// so a presenter can talk and take questions; with --auto it waits a few
// seconds instead and plays straight through.
//
//   npm run demo:eighty-days:present                 wait for Enter between sections
//   npm run demo:eighty-days:present -- --auto       play through, 8 seconds apart
//   npm run demo:eighty-days:present -- --auto=15    play through, 15 seconds apart
//   npm run demo:eighty-days:present -- --from 4     start at section 4
//
// This is stage one of docs/DEMO_PLAN_EIGHTY_DAYS.md: exploring, with the
// checks passing and nothing planted. PRESENTING.md beside this file is the
// same demo as a script to read from. The runner, shared with the other demos,
// is demo/presenting.mjs; this file holds only the sections.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTally, hopsOf, journeyEndLines, retraceVerdict } from '../journals.mjs';
import {
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
} from '../presenting.mjs';
import { fateLines } from './measure.mjs';
import { DEMO_SEED, REPLAY_ROUTE, TRIP_LENGTH } from './seeds.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.join(here, 'phileas');
const { excerpt, journalsRoot, runFolderOf } = demoFolders(configDir);
const CONFIG = fromRepo(configDir);

/**
 * The known findings file every run here reads and writes, emptied when the
 * demo starts. A Journey's end adds whatever it found to that file, and a
 * finding held there lets a Route carry on past it, so the demo keeps its own
 * rather than whatever earlier runs left in the ordinary one. With nothing
 * planted it stays empty, which is what section 5 shows.
 */
const knownFile = path.join(journalsRoot, 'present', 'known-findings.json');
const KNOWN = { EIGHTY_DAYS_KNOWN: fromRepo(knownFile) };

// How long a survey holds each screen, so a watcher sees the window before it
// closes. The Fix has twenty-seven steps, so it gets a shorter pause.
const SURVEY_HOLD = { PHILEAS_HOP_DELAY_MS: '2000' };
const FIX_HOLD = { PHILEAS_HOP_DELAY_MS: '700' };

// The Journey sections 4 to 6 share: the default, from the Hong Kong quay.
const JOURNEY_ENV = { EIGHTY_DAYS_JOURNEY: 'hong-kong', ...KNOWN };
const JOURNEY_ARGS = [CONFIG, '--seed', DEMO_SEED, '--routes', '3', '--trip-length', String(TRIP_LENGTH), '--hop-delay-ms', '300'];
let journey; // section 4's printout and run folder, which 5 and 6 use

const sections = [
  {
    title: 'What you are about to see',
    async run() {
      say('Phileas explores an application the way a curious tester would: it looks at what is');
      say('on screen, picks something, does it, checks nothing has gone wrong, and repeats.');
      say('No script says where to go.\n');
      say(`  ${bold('Journey')}  one run of Phileas: how many Routes, how long each one is, and a seed.`);
      say(`  ${bold('Route')}    one independent exploration, with its own pass or fail.`);
      say(`  ${bold('Fix')}      the fixed opening every Route follows first, so it starts somewhere known.`);
      say(`  ${bold('Trip')}     the unpredictable rest of a Route, after its Fix.`);
      say(`  ${bold('Hop')}      one move: a click, some typing, a key, a menu choice.\n`);
      say('The application is Eighty Days, a game after the novel, built for this demo. Fogg races');
      say('east from London to win the Reform Club\'s wager: which steamer, whether to buy an');
      say('elephant, whether to wait for a ship or charter one. Nothing in it is random, so the');
      say('same moves always play the same game, and every choice comes from a seed.');
    },
  },
  {
    title: 'What Phileas finds at the Reform Club',
    async run() {
      say('Nobody tells Phileas what is in the game. It reads the screen the way a screen reader');
      say('does, and keeps every control that is visible, enabled and has a name. Here is');
      say('everything it finds when the game starts:\n');
      const lines = await phileasShown('survey', [CONFIG], { EIGHTY_DAYS_JOURNEY: 'no-fix', ...SURVEY_HOLD });
      print(startListing(lines));
      say('Only buttons and menu entries here, since the club has little to do. Out in the world');
      say('each place adds its own: tabs for its venues, dropdowns, text fields, a slider, a');
      say('switch. "excluded" marks what it never touches, such as Quit.');
    },
  },
  {
    title: "The book's own opening, as a Fix",
    async run() {
      say('A Fix is written by copying lines from that listing, one step at a time. This one plays');
      say("Fogg's choices from the book, London to Hong Kong, so every Route's Trip starts where the");
      say("book's Fogg stood on the quay:\n");
      showCode(excerpt('journeys/hongkong.ts', /export const toHongKong[\s\S]*?\n\};/));
      const lines = await phileasShown('survey', [CONFIG], { EIGHTY_DAYS_JOURNEY: 'hong-kong', ...FIX_HOLD });
      print(fixAndAfter(lines));
      say('That listing is where every Trip in the next section begins: a known start.');
    },
  },
  {
    title: 'Three fates from one Journey',
    async run() {
      say(`Three Routes of ${TRIP_LENGTH} Hops, each from the Hong Kong quay. Each starts the game`);
      say('fresh, follows the Fix, and takes its own Trip from there. Watch the chart on the');
      say('Circuit panel when a Route opens it: each Route draws its own line round the world.');
      say(dim('Watched, this takes about seven minutes.\n'));
      await runJourney();
      print(journey.lines);
      say('How each game went from Hong Kong, read from what the engine wrote down:\n');
      for (const line of fateLines(journey.folder, 'Hong Kong')) say(`  ${line}`);
      say('');
      say('One known start, three different continuations.');
    },
  },
  {
    title: 'Checked after every Hop',
    async run() {
      await ensureJourney();
      say('After every Hop, the Fix\'s included, Phileas checks that the game is still healthy.');
      say('Across the whole Journey from section 4:\n');
      for (const t of checkTally(journey.folder)) {
        const counts = [`passed ${t.passed}`, t.failed ? `failed ${t.failed}` : '', t.notRun ? `not run ${t.notRun}` : '']
          .filter(Boolean)
          .join(', ');
        const why = t.reasons.size ? dim(`: ${[...t.reasons].join('; ')}`) : '';
        say(`  ${t.check.padEnd(24)}${counts}${why}`);
      }
      say('');
      say('Two checks say "not run", with the reason, on every Hop. A check that did not run is');
      say('never counted as one that passed.\n');
      say('And what the Journey found, from the last lines it printed:\n');
      const end = journeyEndLines(journey.lines);
      print(end.length ? end : [dim('(The run printed no known findings, so its end was not reached.)')]);
      say('Nothing, because nothing is planted in the game yet. That is the baseline: the next');
      say('stage plants bugs and shows the same Journey finding them.');
    },
  },
  {
    title: 'The same seed, the same game',
    async run() {
      await ensureJourney();
      say(`Route ${REPLAY_ROUTE} again, on its own, from the same seed. Watch it make the same choices:\n`);
      const again = runFolderOf(await phileasShown('run', [...JOURNEY_ARGS, '--', '--grep', `route ${REPLAY_ROUTE}$`], JOURNEY_ENV));
      say(bold(retraceVerdict(hopsOf(journey.folder, REPLAY_ROUTE), hopsOf(again, REPLAY_ROUTE), REPLAY_ROUTE)));
      say('');
      const first = fateLines(journey.folder, 'Hong Kong').find((l) => l.startsWith(`route ${REPLAY_ROUTE} `));
      const second = fateLines(again, 'Hong Kong').find((l) => l.startsWith(`route ${REPLAY_ROUTE} `));
      say(`  first time:  ${first}`);
      say(`  replayed:    ${second}`);
      say('\nThe same fate at the same Hop. A Route that found a bug would walk straight back to it.');
    },
  },
];

async function runJourney() {
  const lines = await phileasShown('run', JOURNEY_ARGS, JOURNEY_ENV);
  journey = { lines, folder: runFolderOf(lines) };
}

/** Section 4's run, made now if the demo started after it. */
async function ensureJourney() {
  if (journey) return;
  say(dim('(Running the Journey from section 4 first, since the demo started after it.)\n'));
  await runJourney();
  say('');
}

// --- run ---------------------------------------------------------------------

fs.rmSync(knownFile, { force: true });
fs.mkdirSync(path.dirname(knownFile), { recursive: true });
await present('Phileas on Eighty Days', sections);

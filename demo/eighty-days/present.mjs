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
// Both stages of docs/DEMO_PLAN_EIGHTY_DAYS.md: sections 1 to 6 are stage one,
// exploring with the checks passing and nothing planted, and 7 to 12 are stage
// two, a planted bug found, replayed, filed and traveled past, and several
// found at once. PRESENTING.md beside this file is the same demo as a script
// to read from. The runner, shared with the other demos, is
// demo/presenting.mjs; this file holds only the sections.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTally, hopsOf, journeyEndLines, metIn, retraceVerdict } from '../journals.mjs';
import {
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
} from '../presenting.mjs';
import { fateLines } from './measure.mjs';
import { DEMO_SEED, PLANT_SEEDS, REPLAY_ROUTE, SEVERAL, TRIP_LENGTH } from './seeds.mjs';

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
const JOURNEY_ENV = { ...KNOWN };
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
      const lines = await phileasShown('survey', [CONFIG], { PHILEAS_FIX: 'none', ...SURVEY_HOLD });
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
      showCode(excerpt('fixes/hong-kong.ts', /export const toHongKong[\s\S]*?\n\};/));
      const lines = await phileasShown('survey', [CONFIG], { PHILEAS_FIX: 'hong-kong', ...FIX_HOLD });
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
  // --- stage two: finding bugs -----------------------------------------------
  {
    title: 'Stage two: planting a bug',
    async run() {
      say('Now the same game with bugs planted in it, each behind a switch of its own, so the build');
      say('shown working is the same build shown broken, and any one bug can be shown alone:\n');
      for (const [plant, { fix: from }] of Object.entries(PLANT_SEEDS)) say(`  ${plant.padEnd(22)}${dim(`reached from ${from}`)}`);
      say('');
      say('A planted bug is found by a Journey, not steered to: a seed was searched for whose Route');
      say('meets it on its own. Each section says so if its seed no longer does.');
    },
  },
  {
    title: 'Found',
    async run() {
      say(`The ${FOUND.plant} bug: raising the offer for Kiouni to £2,000 throws an error. From an empty`);
      say('known findings file, one Route from Kholby, where the offer already stands at £1,800:\n');
      await runFound();
      print(found.shown);
      say(`Route 1 ended at Trip hop ${found.hop}, the Hop that raised the offer. The failed check names it,`);
      say(`and the finding's id, ${found.id}, is the same every time the same bug is seen. The Journey's`);
      say('end added it to the known findings as unfiled, which the next section undoes on purpose.');
    },
  },
  {
    title: 'Stranded, which is not a finding',
    async run() {
      const trap = PLANT_SEEDS['bradshaw-trap'];
      say('The bradshaw-trap bug: Game > Consult Bradshaw opens a dialog with nothing in it to press.');
      say('A Route that reaches it has no move left. That is a third outcome, not a failure:\n');
      fs.rmSync(trapFile, { force: true });
      const run = await phileasShown(
        'run',
        [CONFIG, '--fix', trap.fix, '--seed', trap.seed, '--routes', '1', '--trip-length', String(trap.tripLength), '--hop-delay-ms', '300', '--follow'],
        { EIGHTY_DAYS_PLANT: 'bradshaw-trap', EIGHTY_DAYS_KNOWN: fromRepo(trapFile) },
        { mayFail: true }
      );
      const folder = runFolderOf(run.lines);
      const met = metIn(folder);
      if (met.where !== 'stranded') seedMissed(run, 'bradshaw-trap', trap);
      print([...fixLines(run.lines), ...tripTail(run.lines, 3), ...journeyEndLines(run.lines)]);
      say(`Stranded after Trip hop ${met.hop}, with no finding and nothing added to the known findings. A trap`);
      say('may be a bug or a corner with nothing more to do; the engine says what it saw and no more.');
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
      print([...fixLines(again.run.lines), ...tripTail(again.run.lines, 3)]);
      say(bold(retraceVerdict(hopsOf(found.folder, 1), hopsOf(again.folder, 1))));
      say(`\nThe same game, straight back to Trip hop ${met.hop}, and the same finding, ${met.ids.join(', ')}. That is what makes`);
      say('a finding worth filing: anyone can watch it happen again.');
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
      print([...fixLines(past.run.lines), ...around, ...endingLines(past.run.lines), ...journeyEndLines(past.run.lines)]);
      say(`At Trip hop ${found.hop} the line says the finding is known, with its issue, and the Route carries on to`);
      say('the end of its Trip. The summary still says it was seen, so a filed bug never goes quiet.');
    },
  },
  {
    title: 'Several at once',
    async run() {
      say(`${SEVERAL.plants.length} bugs planted together, ${SEVERAL.routes} Routes from Hong Kong, from an empty known findings file:\n`);
      fs.rmSync(severalFile, { force: true });
      const run = await phileasShown(
        'run',
        [CONFIG, '--fix', SEVERAL.fix, '--seed', SEVERAL.seed, '--routes', String(SEVERAL.routes), '--trip-length', String(SEVERAL.tripLength), '--hop-delay-ms', '300'],
        { EIGHTY_DAYS_PLANT: SEVERAL.plants.join(','), EIGHTY_DAYS_KNOWN: fromRepo(severalFile) },
        { mayFail: true }
      );
      const folder = runFolderOf(run.lines);
      const end = journeyEndLines(run.lines);
      const findings = end.filter((line) => /^ {2}UNFILED/.test(line)).length;
      if (findings < 2) stop(run.output, `With seed ${SEVERAL.seed} this Journey found ${findings} of the planted bugs, fewer than the two it was measured to find.`);
      for (let route = 1; route <= SEVERAL.routes; route++) {
        const met = metIn(folder, route);
        const how =
          met.where === 'trip' ? `found ${met.checks.join(', ')} at Trip hop ${met.hop}, finding ${met.ids.join(', ')}` : met.where === 'stranded' ? `stranded after Trip hop ${met.hop}` : `${met.outcome} its Trip`;
        say(`  route ${route}  ${how}`);
      }
      say('');
      print(end);
      say('Each finding once, with how often it was seen. Every Route ended at its first bug, since');
      say('none was known yet; from the next Journey on, these are, and the Routes go further. A bug');
      say('planted where no Route went does not appear: the summary says what was seen, and a bug');
      say('nobody reached is not reported as absent.');
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


// --- stage two's helpers -----------------------------------------------------

/** The bug the found, replayed and filed sections share, and the seed measured to reach it. */
const FOUND = { plant: 'kiouni-throw', ...PLANT_SEEDS['kiouni-throw'] };
// The trap and the several-at-once sections keep files of their own, so
// neither reads the finding the found section added, nor adds to its file.
const trapFile = path.join(journalsRoot, 'present', 'known-trap.json');
const severalFile = path.join(journalsRoot, 'present', 'known-several.json');
let found; // the found section's run: its folder, the Hop, the finding's id and what was shown

/** Run a plant's Journey, one Route, from its measured seed, reading and writing the demo's known findings. */
async function runPlanted(p, options) {
  const run = await phileasShown(
    'run',
    [CONFIG, '--fix', p.fix, '--seed', p.seed, '--routes', '1', '--trip-length', String(p.tripLength), '--hop-delay-ms', '300', '--follow'],
    { EIGHTY_DAYS_PLANT: p.plant, ...KNOWN },
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

// --- run ---------------------------------------------------------------------

fs.rmSync(knownFile, { force: true });
fs.mkdirSync(path.dirname(knownFile), { recursive: true });
await present('Phileas on Eighty Days', sections);

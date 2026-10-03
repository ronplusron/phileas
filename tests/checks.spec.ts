import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  CHECK_ORDER,
  CheckFailure,
  LOG_FAILURE,
  PageConnectionLost,
  FixFailure,
  RUN_VARIABLE,
  createTest,
  deriveRouteStreams,
  findingId,
  journalFolder,
  readJournal,
  runRoute,
  showsNothing,
  signatureOf,
  AdapterCheckError,
  assertAppChecks,
  type AppCheck,
  type AppUnderTest,
  type Chooser,
  type FixStepEntry,
  type JournaledCheck,
  type TripHopEntry,
} from '../src/index';
import { scratch as makeScratch, removeScratch } from './scratch';
import { arrivalOf, stepAt, type StepSpan } from '../src/timeline';

/**
 * The checks, each made to fire on a planted defect.
 *
 * **This file is the reason any check here is allowed to ship.** A check that
 * reads the same on a healthy application and a broken one is worse than
 * none, because a Route that ends at the first violation would then never end.
 * So every check has a defect in `buggy` that makes it fire, switched on by
 * that defect's own `--buggy-plant` flag, and a test here that watches it fire.
 * The healthy run below is the other half: the same checks, the same
 * application with no flag, and nothing firing.
 *
 * **Each test reaches its planted control through the choosing seam**, decided
 * 2026-09-26: a chooser that always picks that control. A seeded Trip would
 * reach it only when the draw happened to, and a test failing for that reason
 * says nothing about the check. Phase 8 keeps the seeded measure.
 */

const TEST_RUN = 'test-run';
process.env[RUN_VARIABLE] = TEST_RUN;

function scratch(): string {
  return makeScratch('phileas-checks-test-');
}

/** The one journal a test's scratch root holds. */
function journalIn(root: string) {
  const seeds = fs.readdirSync(root);
  expect(seeds, `expected one seed folder under ${root}`).toHaveLength(1);
  const folder = journalFolder(root, seeds[0] ?? '', TEST_RUN);
  const files = fs.readdirSync(folder);
  expect(files).toHaveLength(1);
  return readJournal(path.join(folder, files[0] ?? ''));
}

/** A chooser that always acts on the control with this name. */
function always(name: string): Chooser {
  return {
    choose: (candidates) => {
      const target = candidates.find((candidate) => candidate.name === name);
      if (!target) throw new Error(`${name} is not on offer: the planted control did not appear`);
      return { target };
    },
  };
}

function planted(plant: string, extra: Partial<AppUnderTest> = {}): AppUnderTest {
  return { ...buggy, launchArgs: [`--buggy-plant=${plant}`], ...extra };
}

/** Short waits, so a planted hang of six seconds outlasts every one of them. */
const SHORT = { hopTimeoutMs: 1_000, settleTimeoutMs: 1_000, responsiveTimeoutMs: 1_000 };

function result(checks: readonly JournaledCheck[], name: string): JournaledCheck | undefined {
  return checks.find((check) => check.check === name);
}

/**
 * One planted defect, one check: the Route fails at hop 1 with a
 * CheckFailure naming that check, and the journal's Hop line says so.
 */
function firesOn(plant: string, control: string, check: string, observed: RegExp, extra: Partial<AppUnderTest> = {}) {
  const cfg = planted(plant, extra);
  const test = createTest(cfg);
  test.afterEach(removeScratch);

  test(`${check} fires on the planted ${plant}`, async ({ page, app }) => {
    const root = scratch();
    const outcome = runRoute({
      page,
      app,
      cfg,
      streams: deriveRouteStreams(`plant-${plant}`, 1),
      journeySeed: `plant-${plant}`,
      routeNumber: 1,
      tripLength: 3,
      journalsRoot: root,
      chooser: always(control),
      ...SHORT,
    });

    const error = await outcome.then(
      () => undefined,
      (thrown: unknown) => thrown
    );
    expect(error, 'the Route should have ended on a failed check').toBeInstanceOf(CheckFailure);
    expect((error as CheckFailure).failed.map((c) => c.check)).toContain(check);

    const entries = journalIn(root);
    const hops = entries.filter((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
    // Ended at the first violation (R16), not after the Trip's three Hops.
    expect(hops).toHaveLength(1);
    const found = result(hops[0]?.checks ?? [], check);
    expect(found?.result).toBe('failed');
    expect(found?.observation).toMatch(observed);

    const closing = entries.at(-1);
    expect(closing?.kind).toBe('outcome');
    expect(closing?.kind === 'outcome' && closing.outcome).toBe('failed');

    if (plant === 'main-throw') {
      // The listener replaces Electron's own handling of an uncaught
      // main-process exception, which is a native dialog that blocks the
      // process until a person dismisses it. The main process answering on
      // the same Hop is the evidence that it did.
      expect(result(hops[0]?.checks ?? [], 'still-responding')?.result).toBe('passed');
    }
    // No clearing of the fixture's renderer errors afterwards, which these
    // tests once needed: the Route judged the planted error, so the fixture
    // leaves it alone, and the renderer-throw test passing is the evidence.
  });
}

// Exactly one "renderer: ": the prefix was once added twice, and a pattern
// that allowed either passed through it.
firesOn('renderer-throw', 'Weigh the trunk', 'uncaught-error', /^renderer: (?!renderer: ).*too heavy to weigh/);
firesOn('main-throw', 'Strap the trunk', 'uncaught-error', /main process: .*strap snapped/);
firesOn('console-error', 'Check the tickets', 'console-error', /could not be checked/);
firesOn('renderer-hang', 'Wait for the tide', 'still-responding', /renderer did not answer/);
firesOn('main-hang', 'Wait at the port', 'still-responding', /main process did not answer/);
firesOn('blank', 'Fold the map', 'window-showing-content', /shows nothing/);
firesOn('dialog', 'Ring the bell', 'no-unexpected-dialog', /alert: the bell rang/);
// A process that is gone rejects every call at once rather than hanging, and
// was once read as an answer, so a dead application passed.
firesOn('renderer-crash', 'Drop the lantern', 'still-responding', /the renderer crashed/);
// Which of its signs arrives first varies, and any of them is the finding.
firesOn('main-exit', 'Miss the boat', 'still-responding', /the window closed|the main process exited|the application closed/);
// A check of buggy's own, declared in its adapter (R18): the heading above the
// list stops agreeing with the list beneath it.
firesOn('miscount', 'Count the luggage', 'count-matches-list', /the heading says \d+ items and the list shows \d+/);

// The log is found through the environment the adapter hands the application,
// and named in logPaths, the way a real adapter names where its application
// writes. Not under the `phileas-` prefix the leftover check watches for, and
// removed after every test.
const LOG = path.join(os.tmpdir(), `buggy-checks-${process.pid}.log`);
firesOn('log-error', 'Write in the logbook', 'log-error', /ERROR the logbook page is torn/, {
  env: { BUGGY_LOG: LOG },
  logPaths: [LOG],
});

// The same planted log, written inside the Route's own profile folder, the way
// Positron writes its logs. Both halves are functions of that folder: env tells
// buggy where to write, and logPaths tells the check where to read. The check
// firing is the evidence that both reached their side, since neither file path
// exists until the folder does. The profile is removed with the Route.
const handedFolders: string[] = [];
const logbookIn = (userDataDir: string) => path.join(userDataDir, 'logbook.log');
const byFolder = planted('log-error', {
  env: (userDataDir) => ({ BUGGY_LOG: logbookIn(userDataDir) }),
  logPaths: (userDataDir) => {
    handedFolders.push(userDataDir);
    return [logbookIn(userDataDir)];
  },
});
const byFolderTest = createTest(byFolder);
byFolderTest.afterEach(removeScratch);

byFolderTest('logs named from the profile folder are read, given that folder', async ({ page, app, userDataDir }) => {
  handedFolders.length = 0;
  const root = scratch();
  const error = await runRoute({
    page,
    app,
    cfg: byFolder,
    streams: deriveRouteStreams('plant-log-by-folder', 1),
    journeySeed: 'plant-log-by-folder',
    routeNumber: 1,
    tripLength: 3,
    journalsRoot: root,
    chooser: always('Write in the logbook'),
    userDataDir,
    ...SHORT,
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );

  expect(handedFolders).toEqual([userDataDir]);
  expect(error).toBeInstanceOf(CheckFailure);
  expect((error as CheckFailure).failed.map((c) => c.check)).toContain('log-error');
});

byFolderTest('logs named from the profile folder refuse to start without it', async ({ page, app }) => {
  // Refused rather than read as no log, which would report the check as not
  // run on every Hop for a reason that is the caller's and not the adapter's.
  await expect(
    runRoute({
      page,
      app,
      cfg: byFolder,
      streams: deriveRouteStreams('plant-log-no-folder', 1),
      journeySeed: 'plant-log-no-folder',
      routeNumber: 1,
      tripLength: 1,
      journalsRoot: scratch(),
    })
  ).rejects.toThrow(/runRoute was not given/);
});

const healthy = createTest(buggy);
healthy.afterEach(removeScratch);
healthy.afterEach(() => fs.rmSync(LOG, { force: true }));

healthy("a page Playwright calls closed while its window is still open ends the Route as a lost connection, not a finding", async ({ page, app }) => {
  // What the Mac sleeping did on 2026-09-28: Playwright's page announced it had
  // closed, and the application's window was measured still open. The page's
  // own close event is fired here without closing anything. The planted
  // main-exit, above, is the control, where the window really goes.
  const root = scratch();
  let hop = 0;
  const error = await runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams('connection-lost', 1),
    journeySeed: 'connection-lost',
    routeNumber: 1,
    tripLength: 3,
    journalsRoot: root,
    chooser: {
      choose: (candidates) => {
        if (hop++ === 0) (page as unknown as NodeJS.EventEmitter).emit('close', page);
        const target = candidates.find((candidate) => candidate.name === 'Summary' && candidate.source === 'page');
        if (!target) throw new Error('Summary is not on offer');
        return { target };
      },
    },
    ...SHORT,
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );
  expect(error).toBeInstanceOf(PageConnectionLost);
  const entries = journalIn(root);
  const closing = entries[entries.length - 1];
  expect(closing?.kind === 'outcome' && closing.outcome).toBe('failed');
  expect(closing?.kind === 'outcome' ? closing.reason : '').toMatch(/lost its connection to the page/);
  // No finding: nothing about the application was shown to be wrong.
  const findings = entries.flatMap((entry) =>
    entry.kind === 'trip-hop' ? entry.checks.flatMap((check) => check.findings ?? []) : []
  );
  expect(findings).toEqual([]);
});

healthy('on the unplanted application, nothing fires, and what cannot run says why', async ({ page, app }) => {
  // The other half of every test above: the same checks against the same
  // application launched without a flag. A check that fired here would end
  // every Route of every Journey at hop 1.
  const root = scratch();
  const outcome = await runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams('healthy-checks', 1),
    journeySeed: 'healthy-checks',
    routeNumber: 1,
    tripLength: 12,
    journalsRoot: root,
  });
  expect(outcome.kind).toBe('passed');

  const hops = journalIn(root).filter((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
  expect(hops).toHaveLength(12);
  for (const hop of hops) {
    // Every check on every Hop, in a fixed order, including the ones that did
    // not run: an absent check would read exactly like a passing one.
    // The adapter's own checks follow the built-in ones, in declared order.
    expect(hop.checks.map((check) => check.check)).toEqual([...CHECK_ORDER, 'count-matches-list']);
    expect(hop.checks.filter((check) => check.result === 'failed')).toEqual([]);
    expect(result(hop.checks, 'log-error')).toEqual({
      check: 'log-error',
      result: 'not-run',
      observation: 'the adapter names no log in logPaths',
    });
    for (const unbuilt of ['no-navigation-away', 'named-controls']) {
      expect(result(hop.checks, unbuilt)?.result).toBe('not-run');
      expect(result(hop.checks, unbuilt)?.observation).toMatch(/not built yet/);
    }
  }
});

const narrowed = planted('console-error', {
  narrowedChecks: {
    'console-error': {
      kind: 'narrowed',
      reason: 'the ticket check logs on purpose',
      accept: (observation) => observation.includes('tickets'),
    },
  },
});
const narrowedTest = createTest(narrowed);
narrowedTest.afterEach(removeScratch);

narrowedTest('a narrowing accepts what it names, and the journal says so (R19)', async ({ page, app }) => {
  const root = scratch();
  const outcome = await runRoute({
    page,
    app,
    cfg: narrowed,
    streams: deriveRouteStreams('narrowed', 1),
    journeySeed: 'narrowed',
    routeNumber: 1,
    tripLength: 2,
    journalsRoot: root,
    chooser: always('Check the tickets'),
  });
  expect(outcome.kind).toBe('passed');

  const hop = journalIn(root).find((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
  const consoleCheck = result(hop?.checks ?? [], 'console-error');
  // Passed, and not silently: the reason and what it accepted are both there.
  expect(consoleCheck?.result).toBe('passed');
  expect(consoleCheck?.narrowed).toBe('the ticket check logs on purpose');
  expect(consoleCheck?.observation).toMatch(/accepted by the narrowing: .*could not be checked/);
});

// The negative case: a narrowing that names something else accepts nothing,
// and the check still fails. Without it, a narrowing that accepted everything
// passed the test above.
const narrowedElsewhere = planted('console-error', {
  narrowedChecks: {
    'console-error': {
      kind: 'narrowed',
      reason: 'the timetable logs on purpose',
      accept: (observation) => observation.includes('timetable'),
    },
  },
});
const elsewhereTest = createTest(narrowedElsewhere);
elsewhereTest.afterEach(removeScratch);

elsewhereTest('a narrowing that names something else accepts nothing, and the check still fails', async ({ page, app }) => {
  const root = scratch();
  const error = await runRoute({
    page,
    app,
    cfg: narrowedElsewhere,
    streams: deriveRouteStreams('narrowed-elsewhere', 1),
    journeySeed: 'narrowed-elsewhere',
    routeNumber: 1,
    tripLength: 2,
    journalsRoot: root,
    chooser: always('Check the tickets'),
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );
  expect(error).toBeInstanceOf(CheckFailure);
  const hop = journalIn(root).find((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
  const consoleCheck = result(hop?.checks ?? [], 'console-error');
  expect(consoleCheck?.result).toBe('failed');
  expect(consoleCheck?.narrowed).toBe('the timetable logs on purpose');
  expect(consoleCheck?.observation).not.toMatch(/accepted by the narrowing/);
});

// Two violations on one check, one of them known: the known one is recorded
// and the other still fails the check. "Passed if any finding is known" would
// let every new bug through on a check that already had one.
const consoleTest = createTest(buggy);
consoleTest.afterEach(removeScratch);

consoleTest('a known finding does not cover an unknown one on the same check', async ({ page, app }) => {
  const root = scratch();
  const knownOne = signatureOf('console-error', 'the kettle is known to whistle');
  const known = path.join(root, 'known-findings.json');
  fs.writeFileSync(
    known,
    JSON.stringify([
      { id: findingId(knownOne), check: 'console-error', signature: knownOne, added: '2026-09-27', source: 'journey' },
    ])
  );
  const twoErrors: Chooser = {
    choose: async (candidates) => {
      await page.evaluate(() => {
        console.error('the kettle is known to whistle');
        console.error('the stove is on fire');
      });
      const target = candidates.find((candidate) => candidate.name === 'Summary' && candidate.source === 'page');
      if (!target) throw new Error('Summary is not on offer');
      return { target };
    },
  };
  const error = await runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams('known-and-not', 1),
    journeySeed: 'known-and-not',
    routeNumber: 1,
    tripLength: 2,
    journalsRoot: root,
    chooser: twoErrors,
    knownFindings: known,
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );
  expect(error).toBeInstanceOf(CheckFailure);
  const consoleCheck = (error as CheckFailure).failed.find((check) => check.check === 'console-error');
  expect(consoleCheck?.observation).toBe('the stove is on fire');
  expect(consoleCheck?.findings?.map((found) => [found.signature, found.known])).toEqual([
    [knownOne, true],
    [signatureOf('console-error', 'the stove is on fire'), false],
  ]);
});

const switchedOff = planted('console-error', {
  narrowedChecks: { 'console-error': { kind: 'off', reason: 'this application logs errors in normal use' } },
});
const offTest = createTest(switchedOff);
offTest.afterEach(removeScratch);

offTest('a check switched off is recorded as not run, with the reason (R19)', async ({ page, app }) => {
  const root = scratch();
  await runRoute({
    page,
    app,
    cfg: switchedOff,
    streams: deriveRouteStreams('switched-off', 1),
    journeySeed: 'switched-off',
    routeNumber: 1,
    tripLength: 1,
    journalsRoot: root,
    chooser: always('Check the tickets'),
  });
  const hop = journalIn(root).find((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
  expect(result(hop?.checks ?? [], 'console-error')).toEqual({
    check: 'console-error',
    result: 'not-run',
    observation: 'switched off by the adapter',
    narrowed: 'this application logs errors in normal use',
  });
});

const throwing = planted('renderer-throw');
const fixTest = createTest(throwing);
fixTest.afterEach(removeScratch);

fixTest('a check failing after a Fix step is a Fix failure, not a failed Route (R11)', async ({ page, app }) => {
  const root = scratch();
  const error = await runRoute({
    page,
    app,
    cfg: throwing,
    streams: deriveRouteStreams('fix-check', 1),
    journeySeed: 'fix-check',
    routeNumber: 1,
    tripLength: 3,
    journalsRoot: root,
    fix: async ({ step }) => {
      await step({ kind: 'act', target: 'button "Weigh the trunk"' });
    },
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );

  expect(error).toBeInstanceOf(FixFailure);
  expect((error as FixFailure).cause).toBeInstanceOf(CheckFailure);

  const entries = journalIn(root);
  const step = entries.find((entry): entry is FixStepEntry => entry.kind === 'fix-step');
  expect(result(step?.checks ?? [], 'uncaught-error')?.result).toBe('failed');
  // The Trip never started.
  expect(entries.some((entry) => entry.kind === 'trip-hop')).toBe(false);
});

healthy('blank means nothing readable at all, not merely little', () => {
  // Narrow on purpose, since a broad definition fires on a legitimately empty
  // state. One word is enough not to be blank.
  expect(showsNothing(undefined)).toBe(true);
  expect(showsNothing([])).toBe(true);
  expect(showsNothing({ role: 'main', children: ['  ', { role: 'generic', children: [] }] })).toBe(true);
  expect(showsNothing({ role: 'main', children: ['Ready'] })).toBe(false);
  expect(showsNothing({ role: 'main', children: [{ role: 'button', name: 'Go' }] })).toBe(false);
});

// The log reader, driven by what a chooser writes just before each Hop, so
// the test decides exactly what each Hop's read finds.
const WRITTEN = path.join(os.tmpdir(), `buggy-checks-written-${process.pid}.log`);
const writtenLog: AppUnderTest = { ...buggy, logPaths: [WRITTEN] };
const writtenTest = createTest(writtenLog);
writtenTest.afterEach(async () => {
  removeScratch();
  await fs.promises.rm(WRITTEN, { force: true });
});

/** Writes the next piece before each Hop, and clicks Summary and Inventory in turn. */
function writing(pieces: readonly (string | undefined)[]): Chooser {
  let hop = 0;
  return {
    choose: (candidates) => {
      const piece = pieces[hop];
      if (piece !== undefined) fs.appendFileSync(WRITTEN, piece);
      const name = hop % 2 === 0 ? 'Summary' : 'Inventory';
      hop += 1;
      const target = candidates.find((candidate) => candidate.name === name && candidate.source === 'page');
      if (!target) throw new Error(`${name} is not on offer`);
      return { target };
    },
  };
}

async function logRoute(
  page: import('@playwright/test').Page,
  app: import('@playwright/test').ElectronApplication,
  pieces: readonly (string | undefined)[],
  cfg: AppUnderTest = writtenLog
) {
  const root = scratch();
  const error = await runRoute({
    page,
    app,
    cfg,
    streams: deriveRouteStreams('written-log', 1),
    journeySeed: 'written-log',
    routeNumber: 1,
    tripLength: 3,
    journalsRoot: root,
    chooser: writing(pieces),
    ...SHORT,
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );
  const hops = journalIn(root).filter((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
  return { error, hops: hops.map((hop) => result(hop.checks, 'log-error')) };
}

writtenTest('an error line written in two pieces is read once it is whole', async ({ page, app }) => {
  // A line with no error passes; half an error line is left for the next read;
  // the rest of it completes the line, which fails on the Hop that finished it.
  // Read to the end each time, "ERR" and "OR" matched nothing on either Hop.
  fs.writeFileSync(WRITTEN, '');
  const { error, hops } = await logRoute(page, app, ['all is well\n2026 ERR', 'OR the page is torn\n']);
  expect(hops.map((check) => check?.result)).toEqual(['passed', 'failed']);
  expect(hops[1]?.observation).toMatch(/2026 ERROR the page is torn/);
  expect(error).toBeInstanceOf(CheckFailure);
});

writtenTest('a named log that does not exist is not run, and says so, rather than passing', async ({ page, app }) => {
  const { error, hops } = await logRoute(page, app, []);
  expect(error).toBeUndefined();
  expect(hops).toHaveLength(3);
  for (const check of hops) {
    expect(check?.result).toBe('not-run');
    expect(check?.observation).toMatch(/does not exist, so it could not be read/);
  }
});

writtenTest('a log marked as created on its first write passes until it appears, then is read from its start', async ({ page, app }) => {
  // RStudio's session log does not exist until the session first logs
  // something. Marked, its absence is clean rather than not run; the same log
  // unmarked is the test above.
  const marked: AppUnderTest = { ...buggy, logPaths: [{ path: WRITTEN, createdOnFirstWrite: true }] };
  const { error, hops } = await logRoute(page, app, [undefined, 'ERROR the session broke\n'], marked);
  expect(hops.map((check) => check?.result)).toEqual(['passed', 'failed']);
  expect(hops[1]?.observation).toMatch(/ERROR the session broke/);
  expect(error).toBeInstanceOf(CheckFailure);
});

test('a log line fails on an error class name and on the plain words for failure', () => {
  // Invented, in the shape of Bobolink Inbox's log, which writes a failure's
  // class and never its message. "error" as a whole word matched only the
  // last of the first four, so the rest read as clean on every Hop.
  for (const line of [
    '2026-01-15 09:35:02  sign-in: failed: LoopbackError timedOut',
    '2026-01-15 09:36:10  unsubscribe: failed: TypeError',
    '2026-01-15 09:38:00  fatal: uncaught: TypeError',
    '2026-01-15 09:37:44  window: could not save its frame: Error EACCES',
    'GmailError http 500',
    'an unhandled exception in the worker',
    'panic: the index is out of range',
  ]) {
    expect(LOG_FAILURE.test(line), line).toBe(true);
  }
  // Ordinary lines, including words that only contain "error".
  for (const line of [
    '2026-01-15 09:30:12  sign-in: succeeded',
    '2026-01-15 09:31:40  sign-in: cancelled in the app',
    'checked 3 files, 0 errors',
    'errorCount=0',
  ]) {
    expect(LOG_FAILURE.test(line), line).toBe(false);
  }
});

writtenTest('a line naming an error class fails the log check on a Route', async ({ page, app }) => {
  fs.writeFileSync(WRITTEN, '');
  const { error, hops } = await logRoute(page, app, [
    '2026-01-15 09:30:12  sign-in: succeeded\n',
    '2026-01-15 09:36:10  unsubscribe: failed: TypeError\n',
  ]);
  expect(hops.map((check) => check?.result)).toEqual(['passed', 'failed']);
  expect(hops[1]?.observation).toMatch(/unsubscribe: failed: TypeError/);
  expect(error).toBeInstanceOf(CheckFailure);
});

writtenTest("a log's own failure pattern is read beside the engine's, and only for that log", async ({ page, app }) => {
  // A failure with no error name in it at all, as Bobolink Inbox writes a
  // refused sign-in. The same line passes on a log with no pattern of its own,
  // which is the control that the pattern is what failed it.
  const refused = '2026-01-15 09:40:00  sign-in: Google refused it: access_denied\n';
  fs.writeFileSync(WRITTEN, '');
  const plain = await logRoute(page, app, [refused]);
  expect(plain.hops.map((check) => check?.result)).toEqual(['passed', 'passed', 'passed']);

  fs.writeFileSync(WRITTEN, '');
  const own: AppUnderTest = { ...buggy, logPaths: [{ path: WRITTEN, failsOn: /refused it:/g }] };
  const { error, hops } = await logRoute(page, app, [refused], own);
  expect(hops[0]?.result).toBe('failed');
  expect(hops[0]?.observation).toMatch(/Google refused it: access_denied/);
  expect(error).toBeInstanceOf(CheckFailure);
});

/** A check of the adapter's own, for the tests below. */
function ownCheck(name: string, run: AppCheck['run'], why = 'a stated reason'): AppCheck {
  return { name, why, run };
}

test('an adapter check named like a built-in, twice, without a reason or out of form is refused', () => {
  const quiet = () => [];
  expect(() => assertAppChecks([ownCheck('console-error', quiet)])).toThrow(/name of a built-in check/);
  expect(() => assertAppChecks([ownCheck('same', quiet), ownCheck('same', quiet)])).toThrow(/two checks named same/);
  expect(() => assertAppChecks([ownCheck('no-reason', quiet, '  ')])).toThrow(/gives no reason/);
  expect(() => assertAppChecks([ownCheck('Count Matches', quiet)])).toThrow(/lower-case words/);
  // The control: well-formed checks pass.
  expect(() => assertAppChecks([ownCheck('one', quiet), ownCheck('two-more', quiet)])).not.toThrow();
});

/** One Hop on the unplanted application with these checks of the adapter's own. */
async function oneHopWith(page: Page, app: ElectronApplication, checks: AppCheck[], seed: string) {
  const root = scratch();
  const cfg: AppUnderTest = { ...buggy, checks };
  const outcome = await runRoute({
    page,
    app,
    cfg,
    streams: deriveRouteStreams(seed, 1),
    journeySeed: seed,
    routeNumber: 1,
    tripLength: 1,
    journalsRoot: root,
    ...SHORT,
  }).then(
    (value) => ({ value }),
    (thrown: unknown) => ({ thrown })
  );
  return { outcome, root };
}

const own = createTest(buggy);
own.afterEach(removeScratch);

own('an adapter check that does not answer in time is recorded as not run, and the Route goes on', async ({ page, app }) => {
  const { outcome, root } = await oneHopWith(page, app, [ownCheck('never-answers', () => new Promise(() => {}))], 'own-hang');
  expect(outcome).toEqual({ value: { kind: 'passed', hops: 1 } });
  const hop = journalIn(root).find((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
  expect(result(hop?.checks ?? [], 'never-answers')).toEqual({
    check: 'never-answers',
    result: 'not-run',
    observation: 'it did not answer within 1000 ms',
  });
});

own('an adapter check that throws ends the Route as a broken check, not a finding', async ({ page, app }) => {
  const { outcome } = await oneHopWith(
    page,
    app,
    [ownCheck('breaks', () => {
      throw new Error('a selector the check got wrong');
    })],
    'own-throw'
  );
  expect('thrown' in outcome && outcome.thrown).toBeInstanceOf(AdapterCheckError);
  expect('thrown' in outcome && String(outcome.thrown)).toMatch(/breaks threw.*a selector the check got wrong/);
});

own("an adapter check's violation is matched against known findings like a built-in one", async ({ page, app }) => {
  const violation = 'the ledger does not balance';
  const signature = signatureOf('ledger-balances', violation);
  const knownFile = path.join(scratch(), 'known-findings.json');
  fs.writeFileSync(
    knownFile,
    JSON.stringify([{ id: findingId(signature), check: 'ledger-balances', signature, added: '2026-09-27', source: 'journey' }])
  );
  const root = scratch();
  const outcome = await runRoute({
    page,
    app,
    cfg: { ...buggy, checks: [ownCheck('ledger-balances', () => [violation])] },
    streams: deriveRouteStreams('own-known', 1),
    journeySeed: 'own-known',
    routeNumber: 1,
    tripLength: 1,
    journalsRoot: root,
    knownFindings: knownFile,
    ...SHORT,
  });
  // Carried past, because it is known; the same check with no known file ends
  // the Route, which the throw and miscount tests above already show.
  expect(outcome.kind).toBe('passed');
  const hop = journalIn(root).find((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
  expect(result(hop?.checks ?? [], 'ledger-balances')?.findings).toEqual([
    // When it arrived is recorded beside the signature, never in it.
    { id: findingId(signature), signature, known: true, seenAt: expect.any(String) },
  ]);
});

/**
 * A finding that arrives after the Hop that caused it, placed by when it
 * arrived rather than charged to the Hop the checks ran after.
 *
 * **Measured on RStudio on 2026-09-29:** an install's error logged 5.6 s after
 * the click that started it was charged to a later Hop that triggers a
 * different bug. `buggy`'s late plants go wrong 1,500 ms after their click,
 * and every later Hop presses Escape, which `buggy` does nothing with, so the
 * error arrives while some later Hop runs. Which one depends on timing, so
 * the test does not name it: it reads the journal, and requires the failure
 * to name the step whose span holds the finding's recorded time, and to list
 * hop 1's click among the steps before it.
 */
const telegramIn = (userDataDir: string) => path.join(userDataDir, 'telegrams.log');
const isoAtStart = (line: string) => {
  const stamp = /^(\S+Z) /.exec(line)?.[1];
  return stamp === undefined ? undefined : Date.parse(stamp);
};

/** Acts on this control at hop 1, then presses Escape on every Hop after. */
function thenEscape(name: string): Chooser {
  let hop = 0;
  return {
    choose: (candidates) => {
      hop += 1;
      const target =
        hop === 1
          ? candidates.find((candidate) => candidate.name === name)
          : candidates.find((candidate) => candidate.source === 'key' && candidate.name === 'Escape');
      if (!target) throw new Error(`hop ${hop}'s target is not on offer`);
      return { target };
    },
  };
}

function arrivesLate(
  title: string,
  plant: string,
  control: string,
  check: string,
  extra: Partial<AppUnderTest>,
  expectations: (message: string, finding: NonNullable<JournaledCheck['findings']>[number]) => void
) {
  const cfg = planted(plant, extra);
  const lateTest = createTest(cfg);
  lateTest.afterEach(removeScratch);

  lateTest(title, async ({ page, app, userDataDir }) => {
    const root = scratch();
    const error = await runRoute({
      page,
      app,
      cfg,
      streams: deriveRouteStreams(`late-${plant}`, 1),
      journeySeed: `late-${plant}`,
      routeNumber: 1,
      tripLength: 12,
      journalsRoot: root,
      chooser: thenEscape(control),
      userDataDir,
      ...SHORT,
    }).then(
      () => undefined,
      (thrown: unknown) => thrown
    );
    expect(error, 'the Route should have ended on a failed check').toBeInstanceOf(CheckFailure);
    const message = (error as CheckFailure).message;

    const hops = journalIn(root).filter((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
    const first = hops[0];
    const last = hops.at(-1);
    // The precondition, without which this run shows nothing: the error
    // outlasted the Hop that set it off.
    expect(hops.length, 'the plant went wrong before hop 1 ended, so nothing arrived late').toBeGreaterThan(1);
    const finding = (result(last?.checks ?? [], check)?.findings ?? [])[0];
    expect(finding, `the last Hop's ${check} should have recorded the finding`).toBeDefined();
    if (!finding || !first) return;

    // When it arrived, recorded on the finding, is after the delay began.
    const arrival = arrivalOf(finding);
    const moment = arrival.loggedAt ?? arrival.at ?? arrival.before ?? 0;
    expect(moment).toBeGreaterThanOrEqual(Date.parse(first.startedAt) + 1_500);

    // Hop 1, which set it off, is among the steps listed before it.
    expect(message).toMatch(new RegExp(`hop 1 +started +[\\d.]+ s before +click button "${control}"`));
    expect(message).not.toContain('which acted on');
    // And the placement is the journal's own: the step whose span holds the moment.
    const spans: StepSpan[] = hops.map((hop) => ({
      name: `hop ${hop.hop}`,
      what: '',
      startedAt: Date.parse(hop.startedAt),
      endedAt: Date.parse(hop.startedAt) + (hop.durationMs ?? 0),
    }));
    if (arrival.after === undefined || arrival.loggedAt !== undefined) {
      expect(message).toContain(`arrived ${stepAt(moment, spans)}`);
    }
    expectations(message, finding);
  });
}

arrivesLate(
  'a late log error is placed by the log\'s own time, and hop 1 is listed before it',
  'late-log-error',
  'Send a telegram',
  'log-error',
  {
    env: (userDataDir) => ({ BUGGY_LOG: telegramIn(userDataDir) }),
    logPaths: (userDataDir) => [{ path: telegramIn(userDataDir), createdOnFirstWrite: true, timeOf: isoAtStart }],
  },
  (message, finding) => {
    expect(finding.loggedAt).toBeDefined();
    expect(message).toContain("by the log's own time");
  }
);

arrivesLate(
  'a late log error with no time of its own is placed between the reads around it',
  'late-log-error',
  'Send a telegram',
  'log-error',
  {
    env: (userDataDir) => ({ BUGGY_LOG: telegramIn(userDataDir) }),
    logPaths: (userDataDir) => [{ path: telegramIn(userDataDir), createdOnFirstWrite: true }],
  },
  (message, finding) => {
    expect(finding.loggedAt).toBeUndefined();
    expect(finding.seenAfter && finding.seenBefore).toBeTruthy();
    expect(message).toMatch(/arrived between \S+Z and \S+Z, .*the log gave no time the engine could read/);
  }
);

arrivesLate(
  'a late renderer error is placed by when the engine saw it arrive',
  'late-renderer-throw',
  'Set the alarm',
  'uncaught-error',
  {},
  (message, finding) => {
    expect(finding.seenAt).toBeDefined();
    expect(message).toMatch(/alarm rang too late/);
  }
);

// The positive control for all three: an error that arrives at once is placed
// during hop 1, the Hop that caused it, so a placement that always said
// "later" would fail here.
const atOnce = planted('log-error', {
  env: (userDataDir) => ({ BUGGY_LOG: logbookIn(userDataDir) }),
  logPaths: (userDataDir) => [{ path: logbookIn(userDataDir), timeOf: isoAtStart }],
});
const atOnceTest = createTest(atOnce);
atOnceTest.afterEach(removeScratch);

atOnceTest('an error that arrives at once is placed during the Hop that caused it', async ({ page, app, userDataDir }) => {
  const root = scratch();
  const error = await runRoute({
    page,
    app,
    cfg: atOnce,
    streams: deriveRouteStreams('at-once', 1),
    journeySeed: 'at-once',
    routeNumber: 1,
    tripLength: 3,
    journalsRoot: root,
    chooser: always('Write in the logbook'),
    userDataDir,
    ...SHORT,
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );
  expect(error).toBeInstanceOf(CheckFailure);
  const message = (error as CheckFailure).message;
  expect(message).toMatch(/arrived during hop 1, [\d.]+ s after it started \(by the log's own time/);
  expect(message).toMatch(/hop 1 +started +[\d.]+ s before +click button "Write in the logbook"/);
});

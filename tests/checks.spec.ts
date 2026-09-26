import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import { buggy } from '../testbed/buggy/phileas/adapter/index';
import {
  CHECK_ORDER,
  CheckFailure,
  FixFailure,
  RUN_VARIABLE,
  createTest,
  deriveRouteStreams,
  journalFolder,
  readJournal,
  runRoute,
  showsNothing,
  type AppUnderTest,
  type Chooser,
  type FixHopEntry,
  type JournaledCheck,
  type TripHopEntry,
} from '../src/index';
import { scratch as makeScratch, removeScratch } from './scratch';

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

  test(`${check} fires on the planted ${plant}`, async ({ page, app, launched }) => {
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

    forgetReported(launched);
  });
}

/**
 * The fixture fails a test on any uncaught renderer error at its end, which
 * still covers an error during boot, before any Route watches. Here the Route
 * has already reported the planted one as its finding, and the test has
 * checked that it did, so the fixture would report the same error a second
 * time and fail the test that watched the check work.
 */
function forgetReported(launched: { pageErrors: Error[] }): void {
  launched.pageErrors.length = 0;
}

firesOn('renderer-throw', 'Weigh the trunk', 'uncaught-error', /renderer: .*too heavy to weigh/);
firesOn('main-throw', 'Strap the trunk', 'uncaught-error', /main process: .*strap snapped/);
firesOn('console-error', 'Check the tickets', 'console-error', /could not be checked/);
firesOn('renderer-hang', 'Wait for the tide', 'still-responding', /renderer did not answer/);
firesOn('main-hang', 'Wait at the port', 'still-responding', /main process did not answer/);
firesOn('blank', 'Fold the map', 'window-showing-content', /shows nothing/);
firesOn('dialog', 'Ring the bell', 'no-unexpected-dialog', /alert: the bell rang/);

// The log is found through the environment the adapter hands the application,
// and named in logPaths, the way a real adapter names where its application
// writes. Not under the `phileas-` prefix the leftover check watches for, and
// removed after every test.
const LOG = path.join(os.tmpdir(), `buggy-checks-${process.pid}.log`);
firesOn('log-error', 'Write in the logbook', 'log-error', /ERROR the logbook page is torn/, {
  env: { BUGGY_LOG: LOG },
  logPaths: [LOG],
});

const healthy = createTest(buggy);
healthy.afterEach(removeScratch);
healthy.afterEach(() => fs.rmSync(LOG, { force: true }));

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
    expect(hop.checks.map((check) => check.check)).toEqual([...CHECK_ORDER]);
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

fixTest('a check failing after a Fix step is a Fix failure, not a failed Route (R11)', async ({ page, app, launched }) => {
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
    fix: async ({ hop }) => {
      await hop('button "Weigh the trunk"');
    },
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );

  expect(error).toBeInstanceOf(FixFailure);
  expect((error as FixFailure).cause).toBeInstanceOf(CheckFailure);

  const entries = journalIn(root);
  const step = entries.find((entry): entry is FixHopEntry => entry.kind === 'fix-hop');
  expect(result(step?.checks ?? [], 'uncaught-error')?.result).toBe('failed');
  // The Trip never started.
  expect(entries.some((entry) => entry.kind === 'trip-hop')).toBe(false);

  forgetReported(launched);
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

import fs from 'node:fs';
import path from 'node:path';
import { test as plain, expect } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  RUN_VARIABLE,
  closeApp,
  createSeededChooser,
  createTest,
  deriveRouteStreams,
  journalFolder,
  makeUserDataDir,
  readJournal,
  runRoute,
  seededValues,
  sharesFor,
  type Chooser,
  type Fix,
  type SurveyedCandidate,
  type TripHopEntry,
} from '../src/index';
import { launchOrRemove, removeScratch, scratch } from './scratch';

/**
 * The guarantees `CLAUDE.md` calls easy to lose without noticing, each tested
 * where it is relied on rather than one layer below.
 *
 * Every one of these was covered only in part: the generator's vectors, the
 * two streams being independent, the Journal class flushing. What a runRoute
 * refactor could quietly undo was not, and each such change leaves every
 * other test green while recorded seeds stop reproducing.
 */

const TEST_RUN = 'test-run';
process.env[RUN_VARIABLE] = TEST_RUN;

const test = createTest(buggy);
test.afterEach(removeScratch);

/** A Route's Trip Hops, read back from the one journal under a scratch root. */
function tripHops(root: string, seed: string): TripHopEntry[] {
  const folder = journalFolder(root, seed, TEST_RUN);
  const file = fs.readdirSync(folder).find((name) => name.endsWith('.jsonl')) ?? '';
  return readJournal(path.join(folder, file)).filter((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
}

/** What a replay has to reproduce, Hop by Hop. */
function retraced(hops: readonly TripHopEntry[]) {
  return hops.map((hop) => [hop.target, hop.action, hop.value, hop.shareDraw, hop.draw]);
}

// ---------------------------------------------------------------------------
// The order a Hop draws in, pinned.

/**
 * A fixed pool with every side represented, standing in for a survey. Only the
 * fields the chooser and the value generator read are real.
 */
const POOL = [
  { source: 'page', role: 'button', name: 'Inventory', nth: 1, disabled: false },
  { source: 'page', role: 'button', name: 'Summary', nth: 1, disabled: false },
  { source: 'page', role: 'textbox', name: 'Search', nth: 1, disabled: false },
  { source: 'page', role: 'combobox', name: 'Category', nth: 1, disabled: false },
  { source: 'menu', role: 'menuitem', name: 'Show Inventory', menuPath: ['View', 'Show Inventory'] },
  { source: 'menu', role: 'menuitem', name: 'Show Summary', menuPath: ['View', 'Show Summary'] },
  { source: 'key', role: 'key', name: 'Tab', key: 'Tab', controls: [] },
  { source: 'key', role: 'key', name: 'Enter', key: 'Enter', controls: [] },
] as unknown as SurveyedCandidate[];

plain('a Hop draws the side, then the target, then the value, in that order, pinned', async () => {
  // A decision, not a repair. These were computed from the implementation on
  // 2026-09-27 and frozen, because every other replay test compares the engine
  // with itself: swapping the share draw and the target draw, or drawing the
  // value before choosing, passes all of them while every seed ever recorded
  // stops reproducing. If this fails, a draw was reordered, added or removed,
  // and every recorded seed is invalid; do not update these to make it pass
  // without deciding that on purpose and saying so in the change.
  //
  // Updated once, on purpose, on 2026-09-27: "1" and "2" joined the value
  // corpus, so the typed values below changed. The share draws, the target
  // draws and their order did not, and that is what this test holds.
  const trip = deriveRouteStreams('pin', 1).trip;
  const chooser = createSeededChooser(sharesFor({}));
  const drawn = [];
  for (let hop = 0; hop < 6; hop += 1) {
    const { target, draw, shareDraw } = await chooser.choose(POOL, trip);
    const value = seededValues.generate(target, trip);
    drawn.push([shareDraw, draw, target.name, value]);
  }
  expect(drawn).toEqual(PINNED);
});

const PINNED: unknown[] = [
  [3379927090, 3231284432, 'Category', '2'],
  [2045533169, 2831561948, 'Search', '  '],
  [184377609, 1420814704, 'Tab', '2'],
  [2147008637, 1150354908, 'Summary', 'travel'],
  [313465525, 3832602742, 'Enter', '2'],
  [2892804314, 221617084, 'Inventory', '0'],
];

// ---------------------------------------------------------------------------
// The Fix draws from its own stream.

const FIX_SEED = 'fix-stream';

/** A Fix of one harmless step that draws `draws` times from the stream it is handed. */
function drawingFix(draws: number): Fix {
  return async ({ rng, step }) => {
    await step('draw and do nothing', async () => {
      for (let i = 0; i < draws; i += 1) rng.next();
    });
  };
}

async function tripAfterFix(page: Parameters<typeof runRoute>[0]['page'], app: Parameters<typeof runRoute>[0]['app'], draws: number, shared: boolean) {
  const root = scratch('phileas-guarantees-test-');
  const streams = deriveRouteStreams(FIX_SEED, 1);
  await runRoute({
    page,
    app,
    cfg: buggy,
    // Shared is the control: the Fix handed the Trip's own stream.
    streams: shared ? { ...streams, fix: streams.trip } : streams,
    journeySeed: FIX_SEED,
    routeNumber: 1,
    tripLength: 4,
    journalsRoot: root,
    fix: drawingFix(draws),
  });
  return tripHops(root, FIX_SEED).map((hop) => [hop.shareDraw, hop.draw]);
}

test('a Fix that draws more or less leaves the Trip where it was', async ({ page, app }) => {
  // Editing a Fix must never move a Trip: that is why the Route's seed is
  // split in two, and a recorded failing seed that stops reproducing reads as
  // a fixed bug.
  const none = await tripAfterFix(page, app, 0, false);
  await page.getByRole('button', { name: 'Inventory' }).click();
  const five = await tripAfterFix(page, app, 5, false);
  expect(none).toHaveLength(4);
  expect(five).toEqual(none);
});

test('the control: a Fix drawing from the Trip stream does move the Trip', async ({ page, app }) => {
  const none = await tripAfterFix(page, app, 0, true);
  await page.getByRole('button', { name: 'Inventory' }).click();
  const five = await tripAfterFix(page, app, 5, true);
  expect(five).not.toEqual(none);
});

// ---------------------------------------------------------------------------
// Each Route gets a fresh process.

const between: { pid?: number } = {};

test.describe.serial('each Route launches its own application', () => {
  test('the first leaves state behind in both processes', async ({ app, page }) => {
    await app.evaluate(() => {
      (globalThis as Record<string, unknown>).__leftBehind = 'by the first test';
    });
    await page.getByRole('button', { name: 'Summary' }).click();
    between.pid = app.process().pid;
    expect(between.pid).toBeDefined();
  });

  test('the second finds none of it, in a different process', async ({ app, page }) => {
    // Reusing the launch between tests, or reloading instead of relaunching,
    // passes every other test here and hands a Route the last one's state:
    // the leak this engine exists to find, reported against the wrong Route.
    expect(app.process().pid).not.toBe(between.pid);
    expect(await app.evaluate(() => (globalThis as Record<string, unknown>).__leftBehind)).toBeUndefined();
    // And the view is back where the application starts, not on the Summary
    // the first test left.
    await expect(page.getByRole('heading', { name: 'Total weight' })).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// The journal is flushed after every Hop, by runRoute itself.

test('each Hop is on disk before the next one is chosen', async ({ page, app }) => {
  // The Journal class flushes every write; this is whether runRoute writes
  // each Hop as it happens rather than holding them to the end, which a crash
  // would then take with it.
  const root = scratch('phileas-guarantees-test-');
  const seed = 'flush';
  const seen: number[] = [];
  const seeded = createSeededChooser(sharesFor(buggy));
  const checking: Chooser = {
    choose: (candidates, rng) => {
      const folder = journalFolder(root, seed, TEST_RUN);
      const file = fs.readdirSync(folder).find((name) => name.endsWith('.jsonl')) ?? '';
      const lines = fs.readFileSync(path.join(folder, file), 'utf8').split('\n').filter(Boolean);
      seen.push(lines.filter((line) => JSON.parse(line).kind === 'trip-hop').length);
      return seeded.choose(candidates, rng);
    },
  };
  await runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams(seed, 1),
    journeySeed: seed,
    routeNumber: 1,
    tripLength: 4,
    journalsRoot: root,
    chooser: checking,
  });
  // Before Hop N is chosen, the N-1 before it are already written.
  expect(seen).toEqual([0, 1, 2, 3]);
});

// ---------------------------------------------------------------------------
// A seed retraces its Route across fresh launches, not only within one.

plain('one seed retraces the same Route in two separate launches', async () => {
  // The in-launch replay tests reset the page by hand and share a process.
  // This is the real case: the same seed, a new application each time.
  plain.setTimeout(120_000);
  const seed = 'fresh-launches';
  const runs = [];
  for (let run = 0; run < 2; run += 1) {
    const dir = await makeUserDataDir(buggy);
    const launched = await launchOrRemove(buggy, dir);
    const root = scratch('phileas-guarantees-test-');
    try {
      const page = await launched.app.firstWindow();
      await buggy.waitForReady(page);
      await runRoute({
        page,
        app: launched.app,
        cfg: buggy,
        streams: deriveRouteStreams(seed, 1),
        journeySeed: seed,
        routeNumber: 1,
        tripLength: 10,
        journalsRoot: root,
      });
      runs.push(retraced(tripHops(root, seed)));
    } finally {
      await closeApp(buggy, launched).catch(() => undefined);
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  }
  // The length first, so two empty runs cannot agree.
  expect(runs[0]).toHaveLength(10);
  expect(runs[1]).toEqual(runs[0]);
});
plain.afterEach(removeScratch);

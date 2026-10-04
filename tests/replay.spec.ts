import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  RUN_VARIABLE,
  CheckFailure,
  CouldNotReplay,
  planReplay,
  replayFix,
  type AppUnderTest,
  type Chooser,
  type Fix,
  closeApp,
  deriveRouteStreams,
  journaled,
  journalFolder,
  makeUserDataDir,
  readRecorded,
  replayOf,
  runRoute,
  sameTarget,
  type TripHopEntry,
} from '../src/index';
import { launchOrRemove, removeScratch, scratch } from './scratch';
import { readEnding, replayVerdict } from '../src/report/reporter.mjs';

/**
 * Replaying a Route from its journal (R12): the replay chooser acts on each
 * recorded target by name, in a fresh launch, with no help from the seed.
 */

const TEST_RUN = 'test-run';
process.env[RUN_VARIABLE] = TEST_RUN;
test.afterEach(removeScratch);

/** Launch an application, ready, hand its page to `use`, and close it. */
async function inLaunch<T>(
  use: (page: Page, app: Awaited<ReturnType<typeof launchOrRemove>>['app']) => Promise<T>,
  cfg: AppUnderTest = buggy
): Promise<T> {
  const dir = await makeUserDataDir(cfg);
  const launched = await launchOrRemove(cfg, dir);
  try {
    const page = await launched.app.firstWindow();
    await cfg.waitForReady(page);
    return await use(page, launched.app);
  } finally {
    await closeApp(cfg, launched).catch(() => undefined);
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

/** Always the page control of this name, as the checks' tests steer a Route to a planted defect. */
function always(name: string): Chooser {
  return {
    choose: (candidates) => {
      const target = candidates.find((candidate) => candidate.source === 'page' && candidate.name === name);
      if (!target) throw new Error(`${name} is not on offer`);
      return { target };
    },
  };
}

/** The one journal a Route of `seed` wrote under `root`. */
function journalOf(root: string, seed: string): string {
  const folder = journalFolder(root, seed, TEST_RUN);
  return path.join(folder, fs.readdirSync(folder).find((name) => name.endsWith('.jsonl')) ?? '');
}

const what = (hops: readonly TripHopEntry[]) => hops.map((hop) => [hop.target, hop.action, hop.value]);

/** Record a Route of 10 Hops from `seed`, in a launch of its own. */
async function record(seed: string) {
  const root = scratch('phileas-replay-test-');
  await inLaunch((page, app) =>
    runRoute({ page, app, cfg: buggy, streams: deriveRouteStreams(seed, 1), journeySeed: seed, routeNumber: 1, tripLength: 10, journalsRoot: root })
  );
  return readRecorded(journalOf(root, seed));
}

test('a Route replays from its journal in a fresh launch, Hop for Hop, with no help from its seed', async () => {
  test.setTimeout(120_000);
  const recorded = await record('replay-record');
  expect(recorded.hops).toHaveLength(10);

  // Another seed, so a replay that drew instead of reading would go elsewhere.
  const root = scratch('phileas-replay-test-');
  const { chooser, values } = replayOf(recorded.hops, journaled);
  await inLaunch((page, app) =>
    runRoute({ page, app, cfg: buggy, streams: deriveRouteStreams('not-the-seed', 1), journeySeed: 'not-the-seed', routeNumber: 1, tripLength: 10, journalsRoot: root, chooser, values })
  );
  const replayed = readRecorded(journalOf(root, 'not-the-seed'));
  expect(what(replayed.hops)).toEqual(what(recorded.hops));

  // The control: drawn from its own seed, that Route goes elsewhere, so the
  // match above came from the journal and not from two seeds agreeing.
  const drawn = await record('not-the-seed');
  expect(what(drawn.hops)).not.toEqual(what(recorded.hops));
});

test('a target no longer on offer stops the replay at its Hop, naming what is there instead', async () => {
  test.setTimeout(120_000);
  const recorded = await record('replay-record');
  // The control: the recording does reach the Summary button, or renaming it proves nothing.
  const first = recorded.hops.find((hop) => hop.target.source === 'page' && hop.target.name === 'Summary');
  expect(first, 'the recorded Route never clicked Summary; choose another seed').toBeDefined();

  const root = scratch('phileas-replay-test-');
  const { chooser, values } = replayOf(recorded.hops, journaled);
  const ended = await inLaunch(async (page, app) => {
    // The application changed: the button is renamed.
    await page.evaluate(() => {
      for (const button of document.querySelectorAll('button')) {
        if (button.textContent?.trim() === 'Summary') button.textContent = 'Overview';
      }
    });
    return runRoute({ page, app, cfg: buggy, streams: deriveRouteStreams('renamed', 1), journeySeed: 'renamed', routeNumber: 1, tripLength: 10, journalsRoot: root, chooser, values }).then(
      () => undefined,
      (error: unknown) => error
    );
  });
  expect(ended).toBeInstanceOf(CouldNotReplay);
  expect((ended as CouldNotReplay).hop).toBe(first?.hop);
  expect(String((ended as Error).message)).toMatch(/Could not replay hop \d+: button "Summary" is not on offer now\. What is: .*button "Overview"/);
});

test('a target matches only exactly', () => {
  const button = { source: 'page' as const, role: 'button', name: 'Summary' };
  expect(sameTarget({ ...button }, button)).toBe(true);
  // The second of two with one name is not the first.
  expect(sameTarget({ ...button, nth: 1 }, button)).toBe(false);
  expect(sameTarget({ ...button, name: 'Summary ' }, button)).toBe(false);
});

test('a replayed finding that comes back is reproduced, and one fixed since is not', async () => {
  test.setTimeout(180_000);
  // Recorded: a Route steered to buggy's planted console error, which fails it.
  const planted: AppUnderTest = { ...buggy, launchArgs: ['--buggy-plant=console-error'] };
  const short = { hopTimeoutMs: 1_000, settleTimeoutMs: 1_000, responsiveTimeoutMs: 1_000 };
  const recordedRoot = scratch('phileas-replay-test-');
  await inLaunch(
    (page, app) =>
      runRoute({ page, app, cfg: planted, streams: deriveRouteStreams('replay-plant', 1), journeySeed: 'replay-plant', routeNumber: 1, tripLength: 3, journalsRoot: recordedRoot, chooser: always('Check the tickets'), ...short }).catch(() => undefined),
    planted
  );
  const file = journalOf(recordedRoot, 'replay-plant');
  const plan = planReplay(file);
  expect(plan.setAside).toHaveLength(1);
  expect(plan.count).toBe(1);

  const replayed = async (fixed: boolean) => {
    const root = scratch('phileas-replay-test-');
    const ended = await inLaunch(async (page, app) => {
      // Fixed: the control is still there and the error it logged is not.
      if (fixed) await page.evaluate(() => { console.error = () => undefined; });
      return runRoute({ page, app, cfg: planted, streams: deriveRouteStreams('replay-plant', 1), journeySeed: 'replay-plant', routeNumber: 1, tripLength: 3, journalsRoot: root, replay: plan, ...short }).then(
        () => undefined,
        (error: unknown) => error
      );
    }, planted);
    return { ended, verdict: replayVerdict(readEnding(journalOf(root, 'replay-plant'))) };
  };

  // The bug still there: it fails again, on the same finding.
  const again = await replayed(false);
  expect(again.ended).toBeInstanceOf(CheckFailure);
  expect(again.verdict).toBe('reproduced: the finding came back');

  // The bug fixed: every Hop lands, the finding does not come back, and the
  // Route passes, which the report never calls a plain pass.
  const fixed = await replayed(true);
  expect(fixed.ended).toBeUndefined();
  expect(fixed.verdict).toBe('not reproduced: all 1 replayed Hops landed, and the finding did not come back');
});

/** A journal written by hand, with the Fix steps given. */
function journalWith(fixSteps: object[]): string {
  const file = path.join(scratch('phileas-replay-test-'), 'route-001-x.jsonl');
  const effect = { readable: true, changed: false, appeared: [], appearedMore: 0, wentAway: [], wentAwayMore: 0 };
  const lines = [
    { kind: 'route', journeySeed: 'j', routeSeed: 'r', routeNumber: 1, tripLength: 1, settleQuietMs: 400, startedAt: '' },
    ...fixSteps.map((step, i) => ({ kind: 'fix-step', step: i + 1, startedAt: '', durationMs: 1, effect, checks: [], ...step })),
    { kind: 'outcome', outcome: 'passed', hops: 0, endedAt: '' },
  ];
  fs.writeFileSync(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  return file;
}

test("a code step is refused unless the current Fix runs, and the current Fix must match what was recorded", async () => {
  const action = async () => undefined;
  const code = { label: 'some code', stepKind: 'code', source: action.toString(), sourceHash: (await import('../src/journal')).sourceHash(action.toString()) };
  const act = { label: 'button "Summary"', stepKind: 'act', target: { source: 'page', role: 'button', name: 'Summary' }, action: 'click' };
  const file = journalWith([act, code]);
  expect(() => planReplay(file)).toThrow(/Fix step 2, "some code", is code, which a journal cannot hold\. Replay with --with-current-fix/);
  expect(() => planReplay(journalWith([{ label: 'old' }]))).toThrow(/written before Fix steps recorded their kind/);

  const plan = planReplay(file, { withCurrentFix: true });
  const taken: string[] = [];
  const context = {
    page: undefined as never,
    app: undefined as never,
    rng: undefined as never,
    step: async (what: { kind: string; target?: string; label?: string }) => {
      taken.push(what.kind === 'act' ? `act ${what.target}` : `code ${what.label}`);
    },
  };
  const same: Fix = async ({ step }) => {
    await step({ kind: 'act', target: 'button "Summary"' });
    await step({ kind: 'code', label: 'some code', action });
  };
  await replayFix(plan, same)?.(context as never);
  expect(taken).toEqual(['act button "Summary"', 'code some code']);

  // A Fix whose code changed since is stopped, rather than run as if the same.
  const changed: Fix = async ({ step }) => {
    await step({ kind: 'act', target: 'button "Summary"' });
    await step({ kind: 'code', label: 'some code', action: async () => { await Promise.resolve(); } });
  };
  await expect(replayFix(plan, changed)?.(context as never) ?? Promise.resolve()).rejects.toThrow(/is not the code recorded as step 2/);
  // And one that takes another step first.
  const other: Fix = async ({ step }) => step({ kind: 'act', target: 'button "Inventory"' });
  await expect(replayFix(plan, other)?.(context as never) ?? Promise.resolve()).rejects.toThrow(/step 1 is button "Inventory", and the recorded one was "button \"Summary\""/);
});

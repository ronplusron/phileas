import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  RUN_VARIABLE,
  CouldNotReplay,
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

/**
 * Replaying a Route from its journal (R12): the replay chooser acts on each
 * recorded target by name, in a fresh launch, with no help from the seed.
 */

const TEST_RUN = 'test-run';
process.env[RUN_VARIABLE] = TEST_RUN;
test.afterEach(removeScratch);

/** Launch buggy, ready, hand its page to `use`, and close it. */
async function inLaunch<T>(use: (page: Page, app: Awaited<ReturnType<typeof launchOrRemove>>['app']) => Promise<T>): Promise<T> {
  const dir = await makeUserDataDir(buggy);
  const launched = await launchOrRemove(buggy, dir);
  try {
    const page = await launched.app.firstWindow();
    await buggy.waitForReady(page);
    return await use(page, launched.app);
  } finally {
    await closeApp(buggy, launched).catch(() => undefined);
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
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

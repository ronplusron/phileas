import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import { inventoryClearRestoresList } from '../proving-ground/buggy/phileas/checks/inventory/inventory-clear-restores-list';
import {
  RUN_VARIABLE,
  CouldNotReplayDetour,
  checkFingerprint,
  closeApp,
  deriveRouteStreams,
  journalFolder,
  makeUserDataDir,
  planReplay,
  readJournal,
  runRoute,
  type AppRelation,
  type AppUnderTest,
  type Chooser,
  type ValueGenerator,
} from '../src/index';
import { launchOrRemove, removeScratch, scratch } from './scratch';
import { readEnding, replayVerdict } from '../src/report/reporter.mjs';

/**
 * Fingerprints of an adapter's own checks and relations, and a replay
 * comparing each Detour with the one recorded (docs/DEFECTS.md, until
 * 2026-10-21: a relation edited after a Route was recorded changed its replay
 * with nothing saying so).
 *
 * Each test records a Route on buggy's search with its relation in force,
 * then replays it with the relation as it is, edited, or newly added.
 */

const TEST_RUN = 'test-run';
process.env[RUN_VARIABLE] = TEST_RUN;
test.afterEach(removeScratch);

const SHORT = { hopTimeoutMs: 1_000, settleTimeoutMs: 1_000, responsiveTimeoutMs: 1_000 };

/** Launch an application, ready, hand its page to `use`, and close it. */
async function inLaunch<T>(use: (page: Page, app: Awaited<ReturnType<typeof launchOrRemove>>['app']) => Promise<T>, cfg: AppUnderTest): Promise<T> {
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

function journalOf(root: string, seed: string): string {
  const folder = journalFolder(root, seed, TEST_RUN);
  return path.join(folder, fs.readdirSync(folder).find((name) => name.endsWith('.jsonl')) ?? '');
}

/** A chooser that acts on these controls by name, one per Hop. */
function inTurn(names: readonly string[]): Chooser {
  let asked = 0;
  return {
    choose: (candidates) => {
      const name = names[asked];
      asked += 1;
      const target = candidates.find((candidate) => candidate.name === name);
      if (!target) throw new Error(`${name} is not on offer`);
      return { target };
    },
  };
}

const typing: ValueGenerator = { generate: () => 'bag' };

/** Record a Route of two Hops, typing into the search and then showing the inventory, under `cfg`. */
async function record(cfg: AppUnderTest, seed: string): Promise<string> {
  const root = scratch('phileas-fingerprints-test-');
  await inLaunch(
    (page, app) =>
      runRoute({ page, app, cfg, streams: deriveRouteStreams(seed, 1), journeySeed: seed, routeNumber: 1, tripLength: 2, journalsRoot: root, chooser: inTurn(['Search items', 'Inventory']), values: typing, ...SHORT }),
    cfg
  );
  return journalOf(root, seed);
}

/** Replay a recorded journal under `cfg`, and what the replay showed. */
async function replay(file: string, cfg: AppUnderTest, seed: string) {
  const root = scratch('phileas-fingerprints-test-');
  const ended = await inLaunch(
    (page, app) =>
      runRoute({ page, app, cfg, streams: deriveRouteStreams(seed, 1), journeySeed: seed, routeNumber: 1, tripLength: 2, journalsRoot: root, replay: planReplay(file), ...SHORT }).then(
        () => undefined,
        (error: unknown) => error
      ),
    cfg
  );
  const replayed = journalOf(root, seed);
  return { ended, entries: readJournal(replayed), verdict: replayVerdict(readEnding(replayed)) };
}

const withRelation = (relation: AppRelation): AppUnderTest => ({ ...buggy, relations: [relation] });

test("a fingerprint changes with a relation's functions or pattern, and not with its reason", () => {
  const as = checkFingerprint(inventoryClearRestoresList);
  expect(as).toMatch(/^[0-9a-f]{12}$/);
  expect(checkFingerprint({ ...inventoryClearRestoresList })).toBe(as);
  expect(checkFingerprint({ ...inventoryClearRestoresList, why: 'Said another way.' })).toBe(as);
  expect(checkFingerprint({ ...inventoryClearRestoresList, steps: () => [{ target: 'button "Inventory"' }] })).not.toBe(as);
  expect(checkFingerprint({ ...inventoryClearRestoresList, when: /^searchbox "Search"$/ })).not.toBe(as);
  expect(checkFingerprint({ ...inventoryClearRestoresList, expect: () => [] })).not.toBe(as);
});

test('the opening line names a fingerprint for each check and relation in force, and a replay of the same says nothing changed', async () => {
  const file = await record(buggy, 'fingerprint-same');
  const opening = readJournal(file).find((entry) => entry.kind === 'route');
  expect(opening?.kind === 'route' ? Object.keys(opening.checkFingerprints ?? {}).sort() : []).toEqual(['count-matches-list', 'inventory-clear-restores-list']);
  const replayed = await replay(file, buggy, 'fingerprint-same');
  expect(replayed.ended).toBeUndefined();
  expect(replayed.entries.some((entry) => entry.kind === 'note' && /Edited since/.test(entry.note))).toBe(false);
  expect(replayed.verdict).not.toMatch(/edited since/);
  // The control: the replay took the same Detour, and it was compared.
  expect(replayed.entries.filter((entry) => entry.kind === 'detour-step').map((entry) => (entry.kind === 'detour-step' ? entry.label : ''))).toEqual([
    'button "Clear search"',
    'searchbox "Search items", typing "bag"',
  ]);
});

test('a relation whose steps were edited stops the replay at its Detour, naming both', async () => {
  const file = await record(buggy, 'fingerprint-steps');
  const edited = withRelation({ ...inventoryClearRestoresList, steps: () => [{ target: 'button "Clear search"' }, { target: 'button "Inventory"' }] });
  const replayed = await replay(file, edited, 'fingerprint-steps');
  expect(replayed.ended).toBeInstanceOf(CouldNotReplayDetour);
  expect(String(replayed.ended)).toMatch(/Could not replay hop 1: its Detour when recorded was inventory-clear-restores-list's, button "Clear search", then searchbox "Search items", typing "bag", and now is inventory-clear-restores-list's, button "Clear search", then button "Inventory"/);
  expect(replayed.entries.some((entry) => entry.kind === 'note' && /Edited since the Route was recorded, and run as they are now: inventory-clear-restores-list\./.test(entry.note))).toBe(true);
  expect(replayed.verdict).toMatch(/^could not replay: Could not replay hop 1.*; edited since it was recorded: inventory-clear-restores-list$/);
});

test('a relation whose comparison alone was edited replays its Detour, and the verdict says it was edited', async () => {
  const file = await record(buggy, 'fingerprint-expect');
  const edited = withRelation({ ...inventoryClearRestoresList, expect: () => [] });
  const replayed = await replay(file, edited, 'fingerprint-expect');
  expect(replayed.ended).toBeUndefined();
  expect(replayed.verdict).toMatch(/edited since it was recorded: inventory-clear-restores-list$/);
});

test('a relation added since the Route was recorded is not taken in its replay, and the replay says so', async () => {
  const file = await record({ ...buggy, relations: [] }, 'fingerprint-added');
  const replayed = await replay(file, buggy, 'fingerprint-added');
  expect(replayed.ended).toBeUndefined();
  expect(replayed.entries.some((entry) => entry.kind === 'detour' || entry.kind === 'detour-step')).toBe(false);
  expect(replayed.entries.some((entry) => entry.kind === 'note' && /Not in force when the Route was recorded, so not taken in this replay: inventory-clear-restores-list\./.test(entry.note))).toBe(true);
});

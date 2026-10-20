import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import { inventoryClearRestoresList } from '../proving-ground/buggy/phileas/checks/inventory/inventory-clear-restores-list';
import {
  CheckFailure,
  RUN_VARIABLE,
  createTest,
  deriveRouteStreams,
  journalFolder,
  readJournal,
  renderEntry,
  runRoute,
  type AppRelation,
  type AppUnderTest,
  type Chooser,
  type DetourEntry,
  type DetourStepEntry,
  type JournalEntry,
  type TripHopEntry,
  type ValueGenerator,
} from '../src/index';
import { findingOf, readRecorded } from '../src/replay';
import { scratch as makeScratch, removeScratch } from './scratch';

/**
 * Relations and their Detours (R20), on buggy's search: a Hop types into an
 * empty search, the Detour clears it, and the list is compared with the one
 * before. docs/HISTORY.md, 2026-10-19, has the decisions this holds the engine to:
 * a Detour takes no draw and does not count toward the Trip length; a way
 * back returns the screen to where the Hop left it; only the first relation
 * that applies takes its Detour; and a step not on offer means it did not
 * apply when it is the first, a finding when a later one is absent with
 * nothing in the way, and a Detour broken off when something is.
 *
 * Each test reaches the search through the choosing seam, as the checks'
 * tests reach their plants, so what is shown is the relation and not the draw.
 */

const TEST_RUN = 'test-run';
process.env[RUN_VARIABLE] = TEST_RUN;

/** Short waits, so a step's target not on offer is given up on quickly. */
const SHORT = { hopTimeoutMs: 1_000, settleTimeoutMs: 1_000, responsiveTimeoutMs: 1_000 };

/** What every Hop that types types: two of buggy's items have it in their names. */
const TYPED = 'bag';

/** The one journal a test's scratch root holds, and its path. */
function journalIn(root: string): { file: string; entries: JournalEntry[] } {
  const seeds = fs.readdirSync(root);
  expect(seeds, `expected one seed folder under ${root}`).toHaveLength(1);
  const folder = journalFolder(root, seeds[0] ?? '', TEST_RUN);
  const files = fs.readdirSync(folder);
  expect(files).toHaveLength(1);
  const file = path.join(folder, files[0] ?? '');
  return { file, entries: readJournal(file) };
}

/** A chooser that acts on these controls by name, one per Hop, counting how often it is asked. */
function inTurn(names: readonly string[]): Chooser & { asked: number } {
  const chooser = {
    asked: 0,
    choose: (candidates: Parameters<Chooser['choose']>[0]) => {
      const name = names[chooser.asked];
      chooser.asked += 1;
      const target = candidates.find((candidate) => candidate.name === name);
      if (!target) throw new Error(`${name} is not on offer`);
      return { target };
    },
  };
  return chooser;
}

/** A value generator that always types `TYPED`, counting how often it is asked. */
function typing(): ValueGenerator & { asked: number } {
  const values = { asked: 0, generate: () => ((values.asked += 1), TYPED) };
  return values;
}

/** buggy's relation under another name, with these steps and no way back. */
function variant(name: string, steps: AppRelation['steps'], extra: Partial<AppRelation> = {}): AppRelation {
  const { back: _back, ...rest } = inventoryClearRestoresList;
  return { ...rest, name, steps, ...extra };
}

const lines = <K extends JournalEntry['kind']>(entries: JournalEntry[], kind: K) =>
  entries.filter((entry): entry is Extract<JournalEntry, { kind: K }> => entry.kind === kind);

async function run(
  page: Parameters<typeof runRoute>[0]['page'],
  app: Parameters<typeof runRoute>[0]['app'],
  cfg: AppUnderTest,
  seed: string,
  names: readonly string[],
  root: string
) {
  const chooser = inTurn(names);
  const values = typing();
  let outcome: unknown;
  try {
    outcome = await runRoute({
      page,
      app,
      cfg,
      streams: deriveRouteStreams(seed, 1),
      journeySeed: seed,
      routeNumber: 1,
      tripLength: names.length,
      journalsRoot: root,
      chooser,
      values,
      ...SHORT,
    });
  } catch (error) {
    outcome = error;
  }
  return { outcome, chooser, values, ...journalIn(root) };
}

{
  const test = createTest(buggy);
  test.afterEach(removeScratch);

  test('a relation that holds takes its Detour and its way back, with no draw and no Hop of the Trip', async ({ page, app }) => {
    const root = makeScratch('phileas-relations-test-');
    const ran = await run(page, app, buggy, 'relation-holds', ['Search items', 'Inventory'], root);
    expect(ran.outcome).toEqual({ kind: 'passed', hops: 2 });
    // Two Hops, each drawn once and typed for once: the Detour's two steps,
    // the clear and the way back, asked neither seam.
    expect(ran.chooser.asked).toBe(2);
    expect(ran.values.asked).toBe(2);
    expect(lines(ran.entries, 'trip-hop')).toHaveLength(2);

    const steps = lines(ran.entries, 'detour-step');
    expect(steps.map((step) => [step.hop, step.step, step.label, step.back ?? false])).toEqual([
      [1, 1, 'button "Clear search"', false],
      [1, 2, `searchbox "Search items", typing "${TYPED}"`, true],
    ]);
    const detour = lines(ran.entries, 'detour');
    expect(detour).toHaveLength(1);
    expect(detour[0]).toMatchObject({ hop: 1, relation: 'inventory-clear-restores-list', outcome: 'held', wayBack: true });
    expect(detour[0]?.checks).toEqual([{ check: 'inventory-clear-restores-list', result: 'passed' }]);
    expect(detour[0]?.before).toEqual(detour[0]?.after);
    // The way back left the search as the Hop typed it, so the next Hop drew
    // from the screen the seed's own Hop made.
    expect(await page.getByRole('searchbox', { name: 'Search items' }).inputValue()).toBe(TYPED);
    expect(await page.getByRole('list', { name: 'Items' }).getByRole('listitem').count()).toBe(2);

    const opening = ran.entries.find((entry) => entry.kind === 'route');
    expect(opening?.kind === 'route' ? opening.checksInForce : undefined).toContain('inventory-clear-restores-list');
    expect(renderEntry(detour[0] as DetourEntry, 1)).toMatch(/relation inventory-clear-restores-list after hop 1: held/);
    expect(renderEntry(steps[1] as DetourStepEntry, 1)).toMatch(/detour 2, back/);
  });

  test('a first step not on offer means the relation did not apply, and the Route goes on', async ({ page, app }) => {
    const root = makeScratch('phileas-relations-test-');
    const cfg = { ...buggy, relations: [variant('nowhere-first', () => [{ target: 'button "Nowhere"' }])] };
    const ran = await run(page, app, cfg, 'relation-first-missing', ['Search items', 'Inventory'], root);
    expect(ran.outcome).toEqual({ kind: 'passed', hops: 2 });
    expect(lines(ran.entries, 'detour-step')).toHaveLength(0);
    const detour = lines(ran.entries, 'detour')[0];
    expect(detour).toMatchObject({ outcome: 'did-not-apply', wayBack: false, checks: [] });
    expect(detour?.reason).toMatch(/its first step is not on offer: button "Nowhere" is not on screen/);
  });

  test('a later step absent with nothing in the way is a finding, and ends the Route', async ({ page, app }) => {
    const root = makeScratch('phileas-relations-test-');
    const cfg = {
      ...buggy,
      relations: [variant('nowhere-later', () => [{ target: 'button "Clear search"' }, { target: 'button "Nowhere"' }])],
    };
    const ran = await run(page, app, cfg, 'relation-later-missing', ['Search items', 'Inventory'], root);
    expect(ran.outcome).toBeInstanceOf(CheckFailure);
    expect(String(ran.outcome)).toMatch(/after hop 1's Detour, nowhere-later/);
    const detour = lines(ran.entries, 'detour')[0];
    expect(detour?.outcome).toBe('failed');
    expect(detour?.checks[0]?.result).toBe('failed');
    expect(detour?.checks[0]?.observation).toMatch(/its Detour step 2, button "Nowhere", was not on offer after step 1, with nothing covering or hiding it/);
    // The control: the step before it was taken.
    expect(lines(ran.entries, 'detour-step').map((step) => step.label)).toEqual(['button "Clear search"']);
  });

  test('a later step in the way of a rule is the Detour broken off, which is no finding', async ({ page, app }) => {
    const root = makeScratch('phileas-relations-test-');
    // The Summary shows buggy's outbound link, which its adapter excludes.
    const cfg = {
      ...buggy,
      relations: [variant('excluded-later', () => [{ target: 'button "Summary"' }, { target: 'link "Read about the journey"' }])],
    };
    const ran = await run(page, app, cfg, 'relation-broken-off', ['Search items', 'Summary'], root);
    expect(ran.outcome).toEqual({ kind: 'passed', hops: 2 });
    const detour = lines(ran.entries, 'detour')[0];
    expect(detour).toMatchObject({ outcome: 'broken-off', checks: [] });
    expect(detour?.reason).toMatch(/link "Read about the journey" is on screen but excluded .*goes on from where the Detour broke off/);
  });

  test('only the first relation that applies takes its Detour, and the others that matched are recorded', async ({ page, app }) => {
    const root = makeScratch('phileas-relations-test-');
    const cfg = {
      ...buggy,
      relations: [
        variant('applies-never', () => [{ target: 'button "Clear search"' }], { appliesWhen: () => false }),
        variant('applies-first', () => [{ target: 'button "Clear search"' }]),
        variant('applies-second', () => [{ target: 'button "Clear search"' }]),
      ],
    };
    const ran = await run(page, app, cfg, 'relation-first-only', ['Search items', 'Inventory'], root);
    expect(ran.outcome).toEqual({ kind: 'passed', hops: 2 });
    const detours = lines(ran.entries, 'detour');
    expect(detours.map((detour) => [detour.relation, detour.outcome, detour.notTaken])).toEqual([
      ['applies-first', 'held', ['applies-never', 'applies-second']],
    ]);
    expect(lines(ran.entries, 'detour-step')).toHaveLength(1);
  });
}

{
  const cfg: AppUnderTest = { ...buggy, launchArgs: ['--buggy-plant=stuck-search'] };
  const test = createTest(cfg);
  test.afterEach(removeScratch);

  test('the stuck-search plant makes the relation fire, and a replay is aimed at its Hop', async ({ page, app }) => {
    const root = makeScratch('phileas-relations-test-');
    const ran = await run(page, app, cfg, 'relation-plant', ['Fasten the search', 'Search items', 'Inventory'], root);
    expect(ran.outcome).toBeInstanceOf(CheckFailure);
    const detour = lines(ran.entries, 'detour')[0];
    expect(detour).toMatchObject({ hop: 2, outcome: 'failed' });
    expect(detour?.checks[0]?.observation).toMatch(/clearing the search shows 2 items, where the empty search before it showed \d+/);
    // The Route ended there, before its way back and its third Hop.
    expect(lines(ran.entries, 'detour-step').map((step) => step.back ?? false)).toEqual([false]);
    expect(lines(ran.entries, 'trip-hop') as TripHopEntry[]).toHaveLength(2);
    // A replay replays to the Hop that started the Detour, and sets its finding aside.
    const finding = findingOf(readRecorded(ran.file));
    expect(finding.hop).toBe(2);
    expect(finding.signatures).toEqual([detour?.checks[0]?.findings?.[0]?.signature]);
  });
}

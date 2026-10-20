import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  CHECK_OFF_VARIABLE,
  CHECK_ON_VARIABLE,
  RUN_VARIABLE,
  checkChoiceFromEnvironment,
  createTest,
  defineJourney,
  deriveRouteStreams,
  journalFolder,
  readJournal,
  runRoute,
  steadySelector,
  type AppUnderTest,
  type FixStepEntry,
  type JournalEntry,
  type JournaledCheck,
} from '../src/index';
import { scratch as makeScratch, removeScratch } from './scratch';

/**
 * Which checks a Route runs: each check's default for the application, then
 * what the Journey or the run includes and excludes. Settled on 2026-10-14:
 * knowing a check and running it by default are separate, and a Journey can
 * include or exclude a check whatever the adapter's default. `wcag-aa`,
 * axe-core's WCAG 2 A and AA rules, is the engine's first optional check.
 */

const test = createTest(buggy);
test.afterEach(removeScratch);
test.afterEach(() => {
  delete process.env[CHECK_ON_VARIABLE];
  delete process.env[CHECK_OFF_VARIABLE];
});

const TEST_RUN = 'test-run';
process.env[RUN_VARIABLE] = TEST_RUN;

/** The one journal a test's scratch root holds. */
function journalIn(root: string): JournalEntry[] {
  const seeds = fs.readdirSync(root);
  expect(seeds).toHaveLength(1);
  const folder = journalFolder(root, seeds[0] ?? '', TEST_RUN);
  const files = fs.readdirSync(folder).filter((name) => name.endsWith('.jsonl'));
  expect(files).toHaveLength(1);
  return readJournal(path.join(folder, files[0] ?? ''));
}

/** Every record of one check on every Fix step and Hop of a journal. */
function checksNamed(entries: JournalEntry[], name: string): JournaledCheck[] {
  return entries.flatMap((entry) =>
    entry.kind === 'trip-hop' || entry.kind === 'fix-step' ? entry.checks.filter((check) => check.check === name) : []
  );
}

/** One short Route on buggy under `cfg`, and its journal. */
async function route(
  page: Parameters<typeof runRoute>[0]['page'],
  app: Parameters<typeof runRoute>[0]['app'],
  cfg: AppUnderTest,
  fix?: Parameters<typeof runRoute>[0]['fix']
): Promise<JournalEntry[]> {
  const root = makeScratch('phileas-check-choice-test-');
  await runRoute({
    page,
    app,
    cfg,
    streams: deriveRouteStreams('check-choice', 1),
    journeySeed: 'check-choice',
    routeNumber: 1,
    tripLength: 2,
    journalsRoot: root,
    ...(fix ? { fix } : {}),
  }).catch(() => undefined);
  return journalIn(root);
}

test('an optional check is off by default, and left off each Hop', async ({ page, app }) => {
  const entries = await route(page, app, buggy);
  expect(entries.some((entry) => entry.kind === 'trip-hop')).toBe(true);
  expect(checksNamed(entries, 'wcag-aa')).toEqual([]);
});

test("an adapter can have an optional check on by default, and wcag-aa finds nothing on buggy as shipped", async ({ page, app }) => {
  const entries = await route(page, app, { ...buggy, checksByDefault: { 'wcag-aa': 'on' } });
  const ran = checksNamed(entries, 'wcag-aa');
  expect(ran.length).toBeGreaterThan(0);
  for (const check of ran) expect(check.result, check.observation).toBe('passed');
});

test('a run includes a check its adapter has off, which the journal records', async ({ page, app }) => {
  process.env[CHECK_ON_VARIABLE] = 'wcag-aa';
  const entries = await route(page, app, { ...buggy, checksByDefault: { 'wcag-aa': 'off' } });
  const opening = entries.find((entry) => entry.kind === 'route');
  expect(opening?.kind === 'route' ? opening.checksIncluded : undefined).toEqual(['wcag-aa']);
  expect(checksNamed(entries, 'wcag-aa').length).toBeGreaterThan(0);
});

test('wcag-aa finds an image with no alternative text, planted on buggy', async ({ page, app }) => {
  process.env[CHECK_ON_VARIABLE] = 'wcag-aa';
  const entries = await route(page, app, buggy, async ({ step, page }) => {
    await step({
      kind: 'code',
      label: 'plant an image with no alt',
      action: () =>
        page.evaluate(() => {
          const image = document.createElement('img');
          image.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
          image.width = 20;
          image.height = 20;
          document.body.append(image);
        }),
    });
  });
  const step = entries.find((entry): entry is FixStepEntry => entry.kind === 'fix-step');
  const wcag = step?.checks.find((check) => check.check === 'wcag-aa');
  expect(wcag?.result).toBe('failed');
  expect(wcag?.observation).toMatch(/^image-alt: img\b/m);
});

test('a check the run excludes, and one the adapter has off by default, are each recorded with why', async ({ page, app }) => {
  process.env[CHECK_OFF_VARIABLE] = 'console-error';
  const entries = await route(page, app, { ...buggy, checksByDefault: { 'no-unexpected-dialog': 'off' } });
  const opening = entries.find((entry) => entry.kind === 'route');
  expect(opening?.kind === 'route' ? opening.checksExcluded : undefined).toEqual(['console-error']);
  // Once, on the opening line, with why, and on no step's line, since neither
  // can run anywhere in the Route (docs/HISTORY.md, 2026-10-16).
  const unavailable = opening?.kind === 'route' ? (opening.checksUnavailable ?? []) : [];
  for (const [name, why] of [
    ['console-error', 'excluded for this run'],
    ['no-unexpected-dialog', 'off by default for this application'],
  ]) {
    expect(unavailable).toContainEqual({ check: name, reason: why });
    expect(checksNamed(entries, name ?? '')).toEqual([]);
  }
  // The control: a check nothing names still runs.
  const responding = checksNamed(entries, 'still-responding');
  expect(responding.length).toBeGreaterThan(0);
  expect(responding.every((check) => check.result === 'passed')).toBe(true);
});

test('a Journey includes and excludes checks, and a run replaces either', () => {
  const journey = defineJourney({ routes: 1, tripLength: 1, includeChecks: ['wcag-aa'], excludeChecks: [' console-error'] });
  expect(journey.includeChecks).toEqual(['wcag-aa']);
  expect(journey.excludeChecks).toEqual(['console-error']);
  process.env[CHECK_ON_VARIABLE] = 'none';
  const overridden = defineJourney({ routes: 1, tripLength: 1, includeChecks: ['wcag-aa'] });
  expect(overridden.includeChecks).toEqual([]);
});

test('a choice naming a check the application cannot run, or one both ways, is refused by name', () => {
  process.env[CHECK_ON_VARIABLE] = 'wcag-a';
  expect(() => checkChoiceFromEnvironment(buggy)).toThrow(
    /PHILEAS_CHECK_ON names "wcag-a", which this application cannot run\. It can run: uncaught-error, .*named-controls, wcag-aa, count-matches-list, inventory-clear-restores-list\.$/
  );
  process.env[CHECK_ON_VARIABLE] = 'wcag-aa';
  process.env[CHECK_OFF_VARIABLE] = 'wcag-aa';
  expect(() => checkChoiceFromEnvironment(buggy)).toThrow(/wcag-aa is both included \(PHILEAS_CHECK_ON\) and excluded \(PHILEAS_CHECK_OFF\)/);
  // The control: a choice it can run is accepted.
  delete process.env[CHECK_OFF_VARIABLE];
  expect(checkChoiceFromEnvironment(buggy)).toEqual({ included: ['wcag-aa'], excluded: [] });
});

test('a check the adapter switches off as unable to run cannot be included', () => {
  process.env[CHECK_ON_VARIABLE] = 'console-error';
  const narrowed: AppUnderTest = { ...buggy, narrowedChecks: { 'console-error': { kind: 'off', reason: 'it logs in normal use' } } };
  expect(() => checkChoiceFromEnvironment(narrowed)).toThrow(/includes console-error, which the adapter switches off as unable to run: it logs in normal use/);
});

test("an adapter's default naming a check it cannot run is refused", async ({ page, app }) => {
  const misspelled: AppUnderTest = { ...buggy, checksByDefault: { 'wcag-a': 'on' } };
  const root = makeScratch('phileas-check-choice-test-');
  const ended = await runRoute({
    page,
    app,
    cfg: misspelled,
    streams: deriveRouteStreams('check-choice', 1),
    journeySeed: 'check-choice',
    routeNumber: 1,
    tripLength: 1,
    journalsRoot: root,
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );
  expect(String(ended)).toMatch(/checksByDefault names "wcag-a", which this application cannot run/);
});

test('one element is one finding whatever order axe-core lists its attributes in', () => {
  expect(steadySelector('.GCOP2I3BNJ[width="25"][height="24"]')).toBe(steadySelector('.GCOP2I3BNJ[height="24"][width="25"]'));
  expect(steadySelector('td[width=""][height=""][colspan="1"] > .a')).toBe('td[colspan="1"][height=""][width=""] > .a');
  // Nothing outside a run of attributes moves.
  expect(steadySelector('#pinned_cols > .b:nth-child(3)')).toBe('#pinned_cols > .b:nth-child(3)');
});

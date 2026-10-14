import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  CHECK_OFF_VARIABLE,
  RUN_VARIABLE,
  checksOffFromEnvironment,
  createTest,
  deriveRouteStreams,
  journalFolder,
  optionalChecksOf,
  readJournal,
  runRoute,
  steadySelector,
  type AppUnderTest,
  type FixStepEntry,
  type JournalEntry,
  type JournaledCheck,
  type OptionalCheck,
} from '../src/index';
import { scratch as makeScratch, removeScratch } from './scratch';

/**
 * The engine's optional checks: off for every application until its adapter
 * names them, decided on 2026-10-14, and any check turned off for one run
 * with `--check-off`. `wcag-aa`, axe-core's WCAG 2 A and AA rules, is the
 * first, moved here from RStudio's adapter the same day.
 */

const test = createTest(buggy);
test.afterEach(removeScratch);
test.afterEach(() => {
  delete process.env[CHECK_OFF_VARIABLE];
});

const TEST_RUN = 'test-run';
process.env[RUN_VARIABLE] = TEST_RUN;

const withWcag: AppUnderTest = { ...buggy, optionalChecks: ['wcag-aa'] };

/** The one journal a test's scratch root holds. */
function journalIn(root: string): JournalEntry[] {
  const seeds = fs.readdirSync(root);
  expect(seeds).toHaveLength(1);
  const folder = journalFolder(root, seeds[0] ?? '', TEST_RUN);
  const files = fs.readdirSync(folder).filter((name) => name.endsWith('.jsonl'));
  expect(files).toHaveLength(1);
  return readJournal(path.join(folder, files[0] ?? ''));
}

/** Every check on every Fix step and Hop of a journal, by name. */
function checksNamed(entries: JournalEntry[], name: string): JournaledCheck[] {
  return entries.flatMap((entry) =>
    entry.kind === 'trip-hop' || entry.kind === 'fix-step' ? entry.checks.filter((check) => check.check === name) : []
  );
}

/** One Route on buggy under `cfg`, its journal and how it ended. */
async function route(
  page: Parameters<typeof runRoute>[0]['page'],
  app: Parameters<typeof runRoute>[0]['app'],
  cfg: AppUnderTest,
  fix?: Parameters<typeof runRoute>[0]['fix']
): Promise<{ entries: JournalEntry[]; outcome: unknown }> {
  const root = makeScratch('phileas-optional-test-');
  const outcome = await runRoute({
    page,
    app,
    cfg,
    streams: deriveRouteStreams('optional', 1),
    journeySeed: 'optional',
    routeNumber: 1,
    tripLength: 2,
    journalsRoot: root,
    ...(fix ? { fix } : {}),
  }).then(
    (ended) => ended,
    (thrown: unknown) => thrown
  );
  return { entries: journalIn(root), outcome };
}

test('an optional check is off until the adapter names it', async ({ page, app }) => {
  const { entries } = await route(page, app, buggy);
  expect(entries.some((entry) => entry.kind === 'trip-hop')).toBe(true);
  expect(checksNamed(entries, 'wcag-aa')).toEqual([]);
});

test('wcag-aa, turned on, runs on every Hop and finds nothing on buggy as shipped', async ({ page, app }) => {
  const { entries } = await route(page, app, withWcag);
  const ran = checksNamed(entries, 'wcag-aa');
  expect(ran.length).toBeGreaterThan(0);
  for (const check of ran) expect(check.result, check.observation).toBe('passed');
});

test('wcag-aa finds an image with no alternative text, planted on buggy', async ({ page, app }) => {
  const { entries } = await route(page, app, withWcag, async ({ step, page }) => {
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

test('a check turned off for the run records as not run, and says how', async ({ page, app }) => {
  process.env[CHECK_OFF_VARIABLE] = 'wcag-aa,console-error';
  const { entries } = await route(page, app, withWcag);
  const opening = entries.find((entry) => entry.kind === 'route');
  expect(opening?.kind === 'route' ? opening.checksOff : undefined).toEqual(['console-error', 'wcag-aa']);
  for (const name of ['wcag-aa', 'console-error']) {
    const recorded = checksNamed(entries, name);
    expect(recorded.length).toBeGreaterThan(0);
    for (const check of recorded) {
      expect(check).toMatchObject({ result: 'not-run', observation: 'turned off for this run with --check-off' });
    }
  }
  // The control: a check not named still runs.
  expect(checksNamed(entries, 'still-responding').every((check) => check.result === 'passed')).toBe(true);
});

test('a check this application does not run cannot be turned off, and the refusal lists what it runs', () => {
  process.env[CHECK_OFF_VARIABLE] = 'wcag-aa';
  expect(() => checksOffFromEnvironment(buggy)).toThrow(
    /does not run\. It runs: uncaught-error, .*named-controls, count-matches-list\.$/
  );
  expect(checksOffFromEnvironment(withWcag)).toEqual(['wcag-aa']);
  process.env[CHECK_OFF_VARIABLE] = 'wcag-a';
  expect(() => checksOffFromEnvironment(withWcag)).toThrow(/"wcag-a"/);
});

test('an optional check the engine does not have is refused by name', () => {
  const misspelled = { ...buggy, optionalChecks: ['wcag-a' as OptionalCheck] };
  expect(() => optionalChecksOf(misspelled)).toThrow(/"wcag-a", which is not one of the engine's optional checks: wcag-aa/);
  expect(optionalChecksOf(withWcag).map((check) => check.name)).toEqual(['wcag-aa']);
  expect(optionalChecksOf(buggy)).toEqual([]);
});

test('one element is one finding whatever order axe-core lists its attributes in', () => {
  expect(steadySelector('.GCOP2I3BNJ[width="25"][height="24"]')).toBe(steadySelector('.GCOP2I3BNJ[height="24"][width="25"]'));
  expect(steadySelector('td[width=""][height=""][colspan="1"] > .a')).toBe('td[colspan="1"][height=""][width=""] > .a');
  // Nothing outside a run of attributes moves.
  expect(steadySelector('#pinned_cols > .b:nth-child(3)')).toBe('#pinned_cols > .b:nth-child(3)');
});

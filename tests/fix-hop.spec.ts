import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import { buggy } from '../testbed/buggy/phileas/adapter/index';
import {
  createExclusionTally,
  createTest,
  deriveRouteStreams,
  journalFolder,
  readJournal,
  runRoute,
  survey,
  surveyLines,
  FixFailure,
  RUN_VARIABLE,
  type Fix,
  runTempFolder,
} from '../src/index';

/**
 * Writing a Fix from what the engine sees: `phileas survey`'s lines, and a Fix
 * step that takes one of those lines as it is.
 *
 * The point of both is that a Fix is written by copying what the engine found,
 * never by reading the application's code, so the tests hold the survey's lines
 * and hop()'s names to the same form.
 */

const test = createTest(buggy);

const TEST_RUN = 'fix-hop-test-run';
process.env[RUN_VARIABLE] = TEST_RUN;

/** Run a Route with a Fix and a one-hop Trip, and hand back its journal. */
async function routeWithFix(page: Parameters<Fix>[0]['page'], app: Parameters<Fix>[0]['app'], fix: Fix) {
  const root = fs.mkdtempSync(path.join(runTempFolder(), 'fix-hop-test-'));
  const streams = deriveRouteStreams('fix-hop-seed', 1);
  try {
    const outcome = await runRoute({
      page,
      app,
      cfg: buggy,
      streams,
      journeySeed: 'fix-hop-seed',
      routeNumber: 1,
      tripLength: 1,
      journalsRoot: root,
      fix,
    }).catch((error: unknown) => error);
    const file = path.join(journalFolder(root, 'fix-hop-seed', TEST_RUN), `route-001-${streams.routeSeed}.jsonl`);
    return { outcome, entries: readJournal(file) };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("the survey's lines are what the start screen offers, in hop()'s form", async ({ page, app }) => {
  const exclusions = buggy.exclusions;
  const lines = surveyLines(
    await survey({ page, app, exclusions, hopIndex: 0, tally: createExclusionTally(exclusions) })
  );
  expect(lines).toContain('button "Summary"');
  expect(lines).toContain('menu View > Show Summary');
  expect(lines).toContain('menu Buggy > Quit Buggy   (excluded: standard menu entry: quit)');
  expect(lines.at(-1)).toBe('and the common keys: Enter, Escape, Tab, ArrowUp, ArrowDown, ArrowLeft, ArrowRight');
});

test('a Fix step can name a control as the survey prints it, and acts on it', async ({ page, app }) => {
  const { outcome, entries } = await routeWithFix(page, app, ({ hop }) => hop('button "Summary"'));
  expect(outcome).toMatchObject({ kind: 'passed' });
  const step = entries.find((entry) => entry.kind === 'fix-hop');
  expect(step).toMatchObject({ name: 'button "Summary"' });
  // What the step did, not only that it ran: the Summary view appeared.
  expect(step?.kind === 'fix-hop' && step.effect.readable && step.effect.appeared).toContain('Total weight');
});

test('a Fix step can type into a named field, and refuses to without a value', async ({ page, app }) => {
  const typed = await routeWithFix(page, app, ({ hop }) => hop('searchbox "Search items"', 'Carpet'));
  expect(typed.outcome).toMatchObject({ kind: 'passed' });
  expect(typed.entries.find((e) => e.kind === 'fix-hop')).toMatchObject({
    name: 'searchbox "Search items", typing "Carpet"',
  });
  await expect(page.getByRole('searchbox', { name: 'Search items' })).toHaveValue('Carpet');

  const missing = await routeWithFix(page, app, ({ hop }) => hop('searchbox "Search items"'));
  expect(missing.outcome).toBeInstanceOf(FixFailure);
  expect(String((missing.outcome as FixFailure).message)).toMatch(/give the value to type/);
});

test('a name that is not on screen fails the Fix and lists what is', async ({ page, app }) => {
  const { outcome, entries } = await routeWithFix(page, app, ({ hop }) => hop('button "Sumary"'));
  expect(outcome).toBeInstanceOf(FixFailure);
  const step = entries.find((entry) => entry.kind === 'fix-hop');
  // The list of what is on screen is the whole point: a wrong name says what
  // the right one is.
  expect(step?.kind === 'fix-hop' ? step.error : '').toMatch(
    /button "Sumary" is not on screen\. What is: .*button "Summary"/
  );
});

test('an excluded control is refused to a Fix, by its rule', async ({ page, app }) => {
  const { outcome, entries } = await routeWithFix(page, app, ({ hop }) => hop('menu Buggy > Quit Buggy'));
  expect(outcome).toBeInstanceOf(FixFailure);
  const step = entries.find((entry) => entry.kind === 'fix-hop');
  expect(step?.kind === 'fix-hop' ? step.error : '').toMatch(/on screen but excluded \(standard menu entry: quit\)/);
  // And the application is still there to be asked.
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBeGreaterThan(0);
});

test('a survey-only Route runs the Fix, travels nowhere, and writes no journal', async ({ page, app }) => {
  const root = fs.mkdtempSync(path.join(runTempFolder(), 'fix-hop-test-'));
  try {
    const outcome = await runRoute({
      page,
      app,
      cfg: buggy,
      streams: deriveRouteStreams('survey-seed', 1),
      journeySeed: 'survey-seed',
      routeNumber: 1,
      tripLength: 5,
      journalsRoot: root,
      surveyOnly: true,
      fix: ({ hop }) => hop('button "Summary"'),
    });
    expect(outcome).toEqual({ kind: 'surveyed' });
    // The Fix ran, so a survey can show where the Trip would begin.
    await expect(page.getByRole('heading', { name: 'Total weight' })).toBeVisible();
    // Nothing at all under the root: a journal here would read as a Route that
    // traveled nowhere.
    expect(fs.readdirSync(root)).toEqual([]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the hop delay pauses after each Fix step, outside the time the step records', async ({ page, app }) => {
  const root = fs.mkdtempSync(path.join(runTempFolder(), 'fix-hop-test-'));
  const streams = deriveRouteStreams('delay-seed', 1);
  try {
    await runRoute({
      page,
      app,
      cfg: buggy,
      streams,
      journeySeed: 'delay-seed',
      routeNumber: 1,
      tripLength: 1,
      journalsRoot: root,
      hopDelayMs: 600,
      fix: async ({ hop }) => {
        await hop('button "Summary"');
        await hop('button "Summary"');
      },
    });
    const file = path.join(journalFolder(root, 'delay-seed', TEST_RUN), `route-001-${streams.routeSeed}.jsonl`);
    const [first, second] = readJournal(file).filter((entry) => entry.kind === 'fix-hop');
    if (first?.kind !== 'fix-hop' || second?.kind !== 'fix-hop') throw new Error('expected two Fix steps');
    // The gap between one step ending and the next starting is the pause. Were
    // it inside the step, the gap would be close to nothing and durationMs
    // would carry it instead.
    const gap = Date.parse(second.startedAt) - (Date.parse(first.startedAt) + first.durationMs);
    expect(gap).toBeGreaterThanOrEqual(550);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the hop delay holds a survey on screen after it prints', async ({ page, app }) => {
  const started = Date.now();
  await runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams('survey-delay-seed', 1),
    journeySeed: 'survey-delay-seed',
    routeNumber: 1,
    tripLength: 1,
    journalsRoot: os.tmpdir(),
    surveyOnly: true,
    hopDelayMs: 1500,
  });
  // A survey with no Fix prints one listing, so it pauses once. Without the
  // pause it takes a fraction of this.
  expect(Date.now() - started).toBeGreaterThanOrEqual(1450);
});

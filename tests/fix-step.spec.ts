import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
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
  defineFixes,
} from '../src/index';

/**
 * Writing a Fix from what the engine sees: `phileas survey`'s lines, and a Fix
 * step that takes one of those lines as it is.
 *
 * The point of both is that a Fix is written by copying what the engine found,
 * never by reading the application's code, so the tests hold the survey's lines
 * and an act step's targets to the same form.
 */

const test = createTest(buggy);

const TEST_RUN = 'fix-step-test-run';
process.env[RUN_VARIABLE] = TEST_RUN;

/** Run a Route with a Fix and a one-hop Trip, and hand back its journal. */
async function routeWithFix(page: Parameters<Fix>[0]['page'], app: Parameters<Fix>[0]['app'], fix: Fix) {
  const root = fs.mkdtempSync(path.join(runTempFolder(), 'fix-step-test-'));
  // The seed keeps the name it had before Fix steps were renamed: a seed is a
  // value, and a new one changes what the one-hop Trip draws after the Fix.
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

test("the survey's lines are what the start screen offers, in an act step's form", async ({ page, app }) => {
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
  const { outcome, entries } = await routeWithFix(page, app, ({ step }) => step({ kind: 'act', target: 'button "Summary"' }));
  expect(outcome).toMatchObject({ kind: 'passed' });
  const step = entries.find((entry) => entry.kind === 'fix-step');
  expect(step).toMatchObject({ label: 'button "Summary"' });
  // What the step did, not only that it ran: the Summary view appeared.
  expect(step?.kind === 'fix-step' && step.effect.readable && step.effect.appeared).toContain('Total weight');
});

test('a Fix step can type into a named field, and refuses to without a value', async ({ page, app }) => {
  const typed = await routeWithFix(page, app, ({ step }) => step({ kind: 'act', target: 'searchbox "Search items"', value: 'Carpet' }));
  expect(typed.outcome).toMatchObject({ kind: 'passed' });
  expect(typed.entries.find((e) => e.kind === 'fix-step')).toMatchObject({
    label: 'searchbox "Search items", typing "Carpet"',
  });
  await expect(page.getByRole('searchbox', { name: 'Search items' })).toHaveValue('Carpet');

  const missing = await routeWithFix(page, app, ({ step }) => step({ kind: 'act', target: 'searchbox "Search items"' }));
  expect(missing.outcome).toBeInstanceOf(FixFailure);
  expect(String((missing.outcome as FixFailure).message)).toMatch(/give the value to type/);
});

test('a target that is not on screen fails the Fix and lists what is', async ({ page, app }) => {
  const { outcome, entries } = await routeWithFix(page, app, ({ step }) => step({ kind: 'act', target: 'button "Sumary"' }));
  expect(outcome).toBeInstanceOf(FixFailure);
  const step = entries.find((entry) => entry.kind === 'fix-step');
  // The list of what is on screen is the whole point: a wrong name says what
  // the right one is.
  expect(step?.kind === 'fix-step' ? step.error : '').toMatch(
    /button "Sumary" is not on screen after \d+ ms\. What is: .*button "Summary"/
  );
});

test('a Fix step waits for a target that appears after the step before it settled', async ({ page, app }) => {
  // Positron's New File list filled in after the step that opened it had
  // settled, and a single survey lost 1 of 7 Routes to it on 2026-09-27. Here
  // the button arrives well after the settle wait and inside the hop timeout.
  const { outcome, entries } = await routeWithFix(page, app, async ({ page, step }) => {
    await step({
      kind: 'code',
      label: 'a button that arrives late',
      action: () =>
        page.evaluate(() => {
          setTimeout(() => {
            const button = document.createElement('button');
            button.textContent = 'Late arrival';
            document.body.appendChild(button);
          }, 1_500);
        }),
    });
    await step({ kind: 'act', target: 'button "Late arrival"' });
  });
  expect(outcome).not.toBeInstanceOf(FixFailure);
  const late = entries.find((entry) => entry.kind === 'fix-step' && entry.label === 'button "Late arrival"');
  expect(late?.kind === 'fix-step' ? late.error : 'no such step').toBeUndefined();
});

test('a step taken inside another step is refused, and the Fix fails at the outer one', async ({ page, app }) => {
  // Both would take the same number, the inner line would be written first,
  // and the settle and checks would run twice.
  const { outcome, entries } = await routeWithFix(page, app, async ({ step }) => {
    await step({
      kind: 'code',
      label: 'outer',
      action: () => step({ kind: 'act', target: 'button "Summary"' }),
    });
  });
  expect(outcome).toBeInstanceOf(FixFailure);
  const steps = entries.filter((entry) => entry.kind === 'fix-step');
  expect(steps).toHaveLength(1);
  expect(steps[0]).toMatchObject({ step: 1, label: 'outer' });
  expect(steps[0]?.kind === 'fix-step' ? steps[0].error : '').toMatch(
    /"button "Summary"" was taken inside the step "outer"/
  );
});

test('a step that names no kind the engine knows fails the Fix, for a Fix the compiler did not check', async ({
  page,
  app,
}) => {
  const { outcome } = await routeWithFix(page, app, ({ step }) =>
    step({ kind: 'code', label: 'no action' } as never)
  );
  expect(outcome).toBeInstanceOf(FixFailure);
  expect(String(outcome)).toMatch(/must be \{ kind: 'act', target, value\? \} or \{ kind: 'code', label, action \}/);
});

test('a journal written before Fix steps were renamed reads as fix-step lines', () => {
  const dir = fs.mkdtempSync(path.join(runTempFolder(), 'fix-step-legacy-'));
  try {
    const file = path.join(dir, 'route-001-legacy.jsonl');
    fs.writeFileSync(
      file,
      JSON.stringify({
        kind: 'fix-hop',
        hop: 1,
        name: 'button "Summary"',
        startedAt: '2026-09-28T00:00:00.000Z',
        durationMs: 5,
        effect: { readable: true, changed: true, appeared: [], appearedMore: 0, wentAway: [], wentAwayMore: 0 },
        checks: [],
      }) + '\n'
    );
    const [entry] = readJournal(file);
    expect(entry).toMatchObject({ kind: 'fix-step', step: 1, label: 'button "Summary"' });
    expect(entry).not.toHaveProperty('hop');
    expect(entry).not.toHaveProperty('name');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an excluded control is refused to a Fix, by its rule', async ({ page, app }) => {
  const { outcome, entries } = await routeWithFix(page, app, ({ step }) => step({ kind: 'act', target: 'menu Buggy > Quit Buggy' }));
  expect(outcome).toBeInstanceOf(FixFailure);
  const step = entries.find((entry) => entry.kind === 'fix-step');
  expect(step?.kind === 'fix-step' ? step.error : '').toMatch(/on screen but excluded \(standard menu entry: quit\)/);
  // And the application is still there to be asked.
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBeGreaterThan(0);
});

test('a survey-only Route runs the Fix, travels nowhere, and writes no journal', async ({ page, app }) => {
  const root = fs.mkdtempSync(path.join(runTempFolder(), 'fix-step-test-'));
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
      fix: ({ step }) => step({ kind: 'act', target: 'button "Summary"' }),
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
  const root = fs.mkdtempSync(path.join(runTempFolder(), 'fix-step-test-'));
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
      fix: async ({ step }) => {
        await step({ kind: 'act', target: 'button "Summary"' });
        await step({ kind: 'act', target: 'button "Summary"' });
      },
    });
    const file = path.join(journalFolder(root, 'delay-seed', TEST_RUN), `route-001-${streams.routeSeed}.jsonl`);
    const [first, second] = readJournal(file).filter((entry) => entry.kind === 'fix-step');
    if (first?.kind !== 'fix-step' || second?.kind !== 'fix-step') throw new Error('expected two Fix steps');
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

test("the Route's opening line records its Fix by name and by a fingerprint of its source", async ({ page, app }) => {
  // So a replay can tell a changed Fix from a changed application (R14).
  const summary: Fix = async ({ step }) => step({ kind: 'act', target: 'button "Summary"' });
  const listed = defineFixes({ 'open-summary': summary });

  const opening = (entries: ReturnType<typeof readJournal>) => entries.find((entry) => entry.kind === 'route');
  const first = opening((await routeWithFix(page, app, listed['open-summary'] as Fix)).entries);
  expect(first?.kind === 'route' && first.fix).toEqual({ name: 'open-summary', fingerprint: expect.stringMatching(/^[0-9a-f]{12}$/) });

  // A Fix never listed is named by its own constant, and a different Fix, even
  // one doing the same, has a different fingerprint.
  const alsoSummary: Fix = async ({ step }) => {
    await step({ kind: 'act', target: 'button "Summary"' });
  };
  const second = opening((await routeWithFix(page, app, alsoSummary)).entries);
  expect(second?.kind === 'route' && second.fix && second.fix.name).toBe('alsoSummary');
  expect(second?.kind === 'route' && second.fix && second.fix.fingerprint).not.toBe(first?.kind === 'route' && first.fix && first.fix.fingerprint);
});

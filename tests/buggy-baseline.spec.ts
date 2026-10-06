import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { buggy, PLANT_VARIABLE } from '../proving-ground/buggy/phileas/adapter/index';
import { PLANTS, checkButtonsAgainstRenderer, routeFound } from '../proving-ground/buggy/measure.mjs';
import { removeScratch, scratch } from './scratch';

/**
 * The baseline phase 8 brought forward on 2026-10-05: buggy's plants switched
 * on for a Journey by BUGGY_PLANT, and measure.mjs saying which a Route found.
 */

test.afterEach(removeScratch);

test('BUGGY_PLANT becomes one --buggy-plant flag per name, and nothing when unset', () => {
  const launchArgs = buggy.launchArgs as () => string[];
  const before = process.env[PLANT_VARIABLE];
  try {
    process.env[PLANT_VARIABLE] = ' console-error, blank ,';
    expect(launchArgs()).toEqual(['--buggy-plant=console-error', '--buggy-plant=blank']);
    delete process.env[PLANT_VARIABLE];
    expect(launchArgs()).toEqual([]);
  } finally {
    if (before === undefined) delete process.env[PLANT_VARIABLE];
    else process.env[PLANT_VARIABLE] = before;
  }
});

test("every plant's button is one buggy's renderer has, and a renamed one is refused", () => {
  checkButtonsAgainstRenderer();
  // The control: a renderer without one of the buttons is refused by name.
  const renamed = path.join(scratch('buggy-baseline-test-'), 'renderer.js');
  const source = fs.readFileSync(new URL('../proving-ground/buggy/renderer/renderer.js', import.meta.url), 'utf8');
  fs.writeFileSync(renamed, source.replace("'Fold the map'", "'Fold the chart'"));
  expect(() => checkButtonsAgainstRenderer(renamed)).toThrow(/blank "Fold the map"/);
});

/** A journal written by hand: the given Trip hops, then how the Route ended. */
function journal(hops: { name: string; failed?: string }[], outcome: 'passed' | 'failed' | 'stranded'): string {
  const file = path.join(scratch('buggy-baseline-test-'), 'route-001-x.jsonl');
  const lines = [
    { kind: 'route', journeySeed: 'j', routeSeed: 'r', routeNumber: 1, tripLength: 20, settleQuietMs: 400, startedAt: '' },
    ...hops.map((hop, i) => ({
      kind: 'trip-hop',
      hop: i + 1,
      target: { source: 'page', role: 'button', name: hop.name },
      action: 'click',
      pool: 'p',
      checks: hop.failed ? [{ check: hop.failed, result: 'failed' }] : [],
    })),
    { kind: 'outcome', outcome, hops: hops.length, endedAt: '' },
  ];
  fs.writeFileSync(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  return file;
}

test("a finding is put down to the plant last clicked, and only where it is that plant's check", () => {
  const press = (plant: string) => {
    const button = PLANTS[plant]?.button;
    if (!button) throw new Error(`${plant} is not a plant the baseline counts`);
    return button;
  };
  // Clicked and failed on the same Hop, on its own check.
  expect(routeFound(journal([{ name: 'Summary' }, { name: press('blank'), failed: 'window-showing-content' }], 'failed')).found).toBe('blank');
  // A late plant: clicked at hop 2, its error read two Hops later.
  expect(
    routeFound(journal([{ name: 'Summary' }, { name: press('late-log-error') }, { name: 'Inventory' }, { name: 'Summary', failed: 'log-error' }], 'failed')).found
  ).toBe('late-log-error');
  // A late plant whose error arrives on a Hop that clicked another plant, as
  // measured: the alarm's late throw, read on the Hop that clicked the hang.
  expect(
    routeFound(journal([{ name: press('late-renderer-throw') }, { name: press('main-hang'), failed: 'uncaught-error' }], 'failed')).found
  ).toBe('late-renderer-throw');
  // A check no plant clicked makes fire is unexplained, never found.
  const mismatched = routeFound(journal([{ name: press('dialog'), failed: 'console-error' }], 'failed'));
  expect(mismatched.found).toBeUndefined();
  expect(mismatched.unexplained).toBe('dialog');
  // A failure with no plant clicked before it.
  expect(routeFound(journal([{ name: 'Summary', failed: 'uncaught-error' }], 'failed')).unexplained).toBe('no plant clicked');
  // A Route that passed found nothing, though it clicked a plant.
  const passed = routeFound(journal([{ name: press('miscount') }, { name: 'Summary' }], 'passed'));
  expect(passed.found).toBeUndefined();
  expect(passed.plantsClicked).toEqual(['miscount']);
});

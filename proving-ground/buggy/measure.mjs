// Which of buggy's planted defects a Journey found by traveling: the baseline
// that phase 8 brought forward on 2026-10-05, under the uniform draw, for
// weighting the draw to be measured against.
//
//   node proving-ground/buggy/measure.mjs proving-ground/buggy/phileas/.phileas-journals/<seed>/<run> [...]
//
// A Route ends at its first finding, so each finds at most one plant. A
// finding is put down to the plant clicked most recently, at or before the
// Hop the checks failed on, whose own check is among those that failed. That
// covers a late plant whose error arrives a Hop or two after its click, even
// when another plant was clicked in between: measured on 2026-10-06, an
// alarm's late error arrived on the Hop that clicked the port's hang, and
// taking the last plant clicked had blamed the hang. A failure no plant
// clicked before it explains is listed as unexplained rather than counted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentEntry } from '../../src/legacy.mjs';

/**
 * Each plant the baseline counts: its button's name, as renderer.js labels
 * it, and the check it exists to make fire. Left out on purpose: full-screen,
 * native-dialog and second-window, which test that the engine contains what
 * an application does, not that a check finds a defect.
 */
/** @type {Record<string, { button: string, check: string }>} */
export const PLANTS = {
  'renderer-throw': { button: 'Weigh the trunk', check: 'uncaught-error' },
  'main-throw': { button: 'Strap the trunk', check: 'uncaught-error' },
  'late-renderer-throw': { button: 'Set the alarm', check: 'uncaught-error' },
  'console-error': { button: 'Check the tickets', check: 'console-error' },
  'log-error': { button: 'Write in the logbook', check: 'log-error' },
  'late-log-error': { button: 'Send a telegram', check: 'log-error' },
  'renderer-hang': { button: 'Wait for the tide', check: 'still-responding' },
  'main-hang': { button: 'Wait at the port', check: 'still-responding' },
  'endless-hang': { button: 'Wait for the last ferry', check: 'still-responding' },
  'renderer-crash': { button: 'Drop the lantern', check: 'still-responding' },
  'main-exit': { button: 'Miss the boat', check: 'still-responding' },
  blank: { button: 'Fold the map', check: 'window-showing-content' },
  dialog: { button: 'Ring the bell', check: 'no-unexpected-dialog' },
  miscount: { button: 'Count the luggage', check: 'count-matches-list' },
};

/**
 * Refuses when a button named here is not in buggy's renderer, since a
 * renamed button would make its plant read as never clicked and never found.
 */
export function checkButtonsAgainstRenderer(renderer = fileURLToPath(new URL('./renderer/renderer.js', import.meta.url))) {
  const source = fs.readFileSync(renderer, 'utf8');
  const missing = Object.entries(PLANTS).filter(([, plant]) => !source.includes(`'${plant.button}'`));
  if (missing.length) {
    throw new Error(`measure.mjs names buttons renderer.js does not have: ${missing.map(([name, plant]) => `${name} "${plant.button}"`).join(', ')}`);
  }
}

const byButton = new Map(Object.entries(PLANTS).map(([name, plant]) => [plant.button, name]));

/**
 * One Route's journal, read for what it found.
 * @param {string} file
 * @returns {{ route?: number, outcome: string, hops: number, plantsClicked: string[], failed?: string[], found?: string, unexplained?: string, reason?: string }}
 */
export function routeFound(file) {
  const entries = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [currentEntry(JSON.parse(line))];
      } catch {
        return [];
      }
    });
  const hops = entries.filter((entry) => entry.kind === 'trip-hop');
  const outcome = entries.find((entry) => entry.kind === 'outcome');
  const route = entries.find((entry) => entry.kind === 'route')?.routeNumber;
  /** @param {{ target?: { source?: string, name?: string } }} hop */
  const clicked = (hop) => (hop.target?.source === 'page' ? byButton.get(hop.target.name ?? '') : undefined);
  const plantsClicked = /** @type {string[]} */ ([...new Set(hops.map(clicked).filter(Boolean))]);
  const failedHop = outcome?.outcome === 'failed' ? hops[hops.length - 1] : undefined;
  const failed = (failedHop?.checks ?? []).filter((check) => check.result === 'failed').map((check) => check.check);
  if (!failedHop || !failed.length) {
    return { route, outcome: outcome?.outcome ?? 'unfinished', hops: hops.length, plantsClicked, reason: outcome?.reason };
  }
  const recent = /** @type {string[]} */ ([...hops].reverse().map(clicked).filter(Boolean));
  const found = recent.find((plant) => failed.includes(PLANTS[plant]?.check ?? ''));
  return { route, outcome: 'failed', hops: hops.length, plantsClicked, failed, ...(found ? { found } : { unexplained: recent[0] ?? 'no plant clicked' }) };
}

/**
 * Every Route of a run folder.
 * @param {string} folder
 */
export function runFound(folder) {
  return fs
    .readdirSync(folder)
    .filter((name) => name.endsWith('.jsonl'))
    .sort()
    .map((name) => routeFound(path.join(folder, name)));
}

/**
 * What a run found, as lines for a person.
 * @param {string} folder
 */
export function report(folder) {
  const routes = runFound(folder);
  const lines = [`${folder}: ${routes.length} Routes`];
  const found = new Map();
  for (const route of routes) if (route.found) found.set(route.found, [...(found.get(route.found) ?? []), route.route]);
  /** @param {string} kind */
  const count = (kind) => routes.filter((route) => route.outcome === kind).length;
  lines.push(
    `  found ${found.size} of ${Object.keys(PLANTS).length} plants; ` +
      `${count('failed')} failed, ${count('passed')} passed, ${count('stranded')} stranded, ${count('unfinished')} unfinished`
  );
  for (const name of Object.keys(PLANTS)) {
    const routesFinding = found.get(name);
    const clickedBy = routes.filter((route) => route.plantsClicked.includes(name)).length;
    lines.push(
      `  ${name.padEnd(20)} ${routesFinding ? `found by ${routesFinding.length}, first route ${Math.min(...routesFinding)}` : 'not found'}` +
        `; clicked on ${clickedBy} Route(s)`
    );
  }
  for (const route of routes.filter((route) => route.unexplained)) {
    lines.push(`  unexplained: route ${route.route} failed ${(route.failed ?? []).join(', ')}, last plant clicked ${route.unexplained}`);
  }
  return lines;
}

const invoked = process.argv[1] && fs.realpathSync(process.argv[1]);
if (invoked === fs.realpathSync(fileURLToPath(import.meta.url))) {
  checkButtonsAgainstRenderer();
  const folders = process.argv.slice(2);
  if (!folders.length) {
    console.error('measure.mjs needs one or more run folders, such as phileas/.phileas-journals/<seed>/<run>');
    process.exit(2);
  }
  for (const folder of folders) console.log(report(folder).join('\n'));
}

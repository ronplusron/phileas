import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Frame, Page } from '@playwright/test';
import {
  clickMenuItem,
  createTest,
  deriveRouteStreams,
  expect,
  journalFolder,
  readJournal,
  requireRun,
  runRoute,
  type Chooser,
  type DetourHop,
  type JournalEntry,
} from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';
import { dataViewerSortCycleRestoresOrder as relation } from '../phileas/checks/data-viewer/data-viewer-sort-cycle-restores-order';
import { dataViewerPaged } from '../phileas/fixes/data-viewer/data-viewer-paged';

/**
 * The test every check is to have (docs/HISTORY.md, 2026-10-16), for the
 * relation `data-viewer-sort-cycle-restores-order`, written on 2026-10-19.
 *
 * The first test runs a real Route, from the `data-viewer-paged` Fix, steered
 * through the choosing seam onto a column's "ascending" button and then
 * another's: the first starts the relation's Detour on an unsorted frame, and
 * the second, on a frame the way back left sorted, does not. So the engine's
 * Detour is shown on RStudio's own frame, its targets named as the survey
 * names them.
 *
 * The second asks the relation's own questions by hand around a sort cycle,
 * as the checks' tests do: quiet on the page as it is, and firing with the
 * page made to contradict itself, two row names swapped after the cycle,
 * since no defect can be planted in RStudio.
 */
const test = createTest(rstudio);

async function menuEntry(app: ElectronApplication, page: Page, wanted: RegExp[]): Promise<void> {
  const paths = await app.evaluate(({ Menu }) => {
    const found: string[][] = [];
    const walk = (items: Electron.MenuItem[], above: string[]) => {
      for (const item of items) {
        if (item.type === 'separator') continue;
        if (item.submenu) walk(item.submenu.items, [...above, item.label]);
        else found.push([...above, item.label]);
      }
    };
    walk(Menu.getApplicationMenu()?.items ?? [], []);
    return found;
  });
  const labels = paths.find((p) => p.length === wanted.length && p.every((label, i) => wanted[i]?.test(label.replace(/&/g, ''))));
  if (!labels) throw new Error(`no menu entry matches ${wanted.map(String).join(' > ')}`);
  await clickMenuItem(app, labels, page);
  await page.waitForTimeout(800);
}

function viewer(page: Page): Frame | undefined {
  return page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes('obj=paged&'));
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

test('a real Route takes the relation\'s Detour on an unsorted frame, and not on a sorted one', async ({ page, app, userDataDir }) => {
  test.setTimeout(10 * 60_000);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-sort-cycle-'));
  try {
    const outcome = await runRoute({
      page,
      app,
      // The rows check is off by default in the adapter until
      // docs/OUTSTANDING.md 2.35 is settled, so it does not end this Route in
      // a launch that opens fitted to the screen.
      cfg: rstudio,
      streams: deriveRouteStreams('sort-cycle', 1),
      journeySeed: 'sort-cycle',
      routeNumber: 1,
      tripLength: 2,
      journalsRoot: root,
      fix: dataViewerPaged,
      chooser: inTurn(['Sort column n01 ascending', 'Sort column n02 ascending']),
      userDataDir,
    }).catch((error: unknown) => error);
    const folder = journalFolder(root, 'sort-cycle', requireRun());
    const entries: JournalEntry[] = readJournal(path.join(folder, fs.readdirSync(folder)[0] ?? ''));
    for (const entry of entries.filter((entry) => entry.kind === 'trip-hop' || entry.kind === 'detour-step' || entry.kind === 'detour')) {
      const said =
        entry.kind === 'trip-hop'
          ? `hop ${entry.hop}: ${entry.action} ${entry.target.name}`
          : entry.kind === 'detour-step'
            ? `  detour ${entry.step}${entry.back ? ' back' : ''}: ${entry.label}`
            : `  relation ${entry.relation}: ${entry.outcome}${entry.reason ? `, ${entry.reason}` : ''}, before ${JSON.stringify(entry.before).slice(0, 80)}`;
      process.stdout.write(`route: ${said}\n`);
    }
    expect(outcome).toEqual({ kind: 'passed', hops: 2 });
    const detours = entries.filter((entry) => entry.kind === 'detour');
    expect(detours).toHaveLength(1);
    expect(detours[0]).toMatchObject({ hop: 1, relation: relation.name, outcome: 'held', wayBack: true });
    const steps = entries.filter((entry) => entry.kind === 'detour-step');
    expect(steps.map((step) => (step.kind === 'detour-step' ? [step.label, step.back ?? false] : []))).toEqual([
      ['frame "Data Browser" > button "Sort column n01 descending"', false],
      ['frame "Data Browser" > button "Remove sort on column n01"', false],
      ['frame "Data Browser" > button "Sort column n01 ascending"', true],
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the relation is quiet around a real sort cycle, and fires with two row names swapped', async ({ page, app }) => {
  test.setTimeout(10 * 60_000);
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await dataViewerPaged({
    page,
    app,
    step: async (step: { kind: 'act' } | { kind: 'code'; action: () => Promise<unknown> }) => {
      if (step.kind === 'code') return step.action();
      // The Fix's one act step is View > Move Focus to Console.
      await menuEntry(app, page, [/^View$/, /^Move Focus to Console$/]);
    },
  } as unknown as Parameters<typeof dataViewerPaged>[0]);
  await page.waitForTimeout(3_000);

  const hop: DetourHop = { target: 'frame "Data Browser" > button "Sort column n01 ascending"', match: [], action: 'click' };
  const matched = relation.when.exec(hop.target);
  expect(matched, 'the Hop that starts it').not.toBeNull();
  const started = { ...hop, match: [...(matched ?? [])] };
  const context = { page, app, tree: undefined, hop: started };
  expect(await relation.appliesWhen?.(context)).toBe(true);

  const cycle = async () => {
    for (const name of ['Sort column n01 ascending', 'Sort column n01 descending', 'Remove sort on column n01']) {
      await viewer(page)?.getByRole('button', { name, exact: true }).first().click({ timeout: 5_000 });
      await page.waitForTimeout(2_500);
    }
  };

  const before = await relation.read(context);
  await cycle();
  const after = await relation.read(context);
  process.stdout.write(`check: as it is, before ${JSON.stringify(before).slice(0, 80)}, after ${JSON.stringify(after).slice(0, 80)}\n`);
  expect(relation.expect(before, after)).toEqual([]);

  // A contradiction: the first two rows in view swapped after the cycle.
  await viewer(page)?.evaluate(() => {
    const rows = [...document.querySelectorAll<HTMLElement>('#pinnedTable tr[aria-rowindex="2"] td, #pinnedTable tr[aria-rowindex="3"] td')];
    const [first, second] = rows;
    if (first && second) [first.textContent, second.textContent] = [second.textContent, first.textContent];
  });
  const swapped = await relation.read(context);
  const found = relation.expect(before, swapped);
  process.stdout.write(`check: two rows swapped -> ${JSON.stringify(found)}\n`);
  expect(found).toHaveLength(1);
  expect(found[0]).toMatch(/begin \["2","1",.*where before the sort they began \["1","2",/);
});

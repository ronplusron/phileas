import type { ElectronApplication, Frame, Page } from '@playwright/test';
import { clickMenuItem, createTest, expect, type AppCheckContext } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';
import { dataViewerSortedColumnInOrder as check } from '../phileas/checks/data-viewer/data-viewer-sorted-column-in-order';

/**
 * The test every check is to have (docs/HISTORY.md, 2026-10-16), for
 * `data-viewer-sorted-column-in-order`: on the screens it is written for it
 * applies and is quiet, where it has nothing to judge it does not apply, and
 * with the page made to contradict itself it fires. Written on 2026-10-19.
 *
 * Builds `sorts` as `viewer-sort-order.spec.ts` does, 300 rows of numbers
 * with NAs, text, a factor, logicals with NAs and dates, and sorts each
 * column both ways from the summary sidebar's buttons.
 */
const test = createTest(rstudio);

const BUILD =
  'sorts <- data.frame(' +
  'num = ifelse(1:300 %% 23 == 0, NA, ((1:300 * 37) %% 101) - 50), ' +
  'txt = c("apple", "Banana", "cherry", "\\u00c4pfel", "banana", "apple2", "Zebra", "\\u00e9clair", "10", "9")[(1:300 * 7) %% 10 + 1], ' +
  'fac = factor(c("low", "high", "mid")[1:300 %% 3 + 1], levels = c("low", "mid", "high")), ' +
  'lgl = ifelse(1:300 %% 17 == 0, NA, 1:300 %% 4 == 0), ' +
  'day = as.Date("2026-01-01") + (1:300 * 13) %% 200, ' +
  'stringsAsFactors = FALSE)';

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

function frameFor(page: Page): Frame | undefined {
  return page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes('obj=sorts&'));
}

/** The sidebar's sort button reads "Sort column x ascending", then "... descending", then "Remove sort on column x". */
async function clickSort(page: Page, column: string): Promise<void> {
  await frameFor(page)
    ?.getByRole('button', { name: new RegExp(`^(Sort column ${column} |Remove sort on column ${column}$)`) })
    .first()
    .click({ timeout: 5_000 });
  await page.waitForTimeout(2_500);
}

async function scrollTo(page: Page, share: number): Promise<void> {
  await frameFor(page)?.evaluate((to) => {
    const viewport = document.getElementById('gridViewport');
    if (viewport) viewport.scrollTop = Math.round((viewport.scrollHeight - viewport.clientHeight) * to);
  }, share);
  await page.waitForTimeout(2_500);
}

/** Writes text into a column's cell in the first row wholly in view, as the page would draw it. */
async function writeFirstCell(page: Page, column: string, text: string): Promise<boolean> {
  return (
    (await frameFor(page)?.evaluate(
      ([column, text]) => {
        const header = [...document.querySelectorAll<HTMLElement>('th[role="columnheader"]')].find((th) =>
          [...th.querySelectorAll('span')].some((span) => (span.textContent ?? '').trim() === column)
        );
        if (!header) return false;
        const box = header.getBoundingClientRect();
        const middle = (box.left + box.right) / 2;
        const row = [...document.querySelectorAll<HTMLElement>('#rsGridData tr[aria-rowindex]')]
          .filter((candidate) => candidate.getBoundingClientRect().top >= box.bottom - 1)
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        const cell = [...(row?.querySelectorAll<HTMLElement>('[role="gridcell"]') ?? [])].find((candidate) => {
          const at = candidate.getBoundingClientRect();
          return at.left <= middle && middle <= at.right;
        });
        if (!cell) return false;
        cell.textContent = text;
        return true;
      },
      [column, text] as const
    )) ?? false
  );
}

async function verdict(context: AppCheckContext, state: string): Promise<{ applies: boolean; found?: unknown }> {
  const applies = (await check.appliesWhen?.(context)) ?? true;
  const result = applies ? { applies, found: await check.run(context) } : { applies };
  const said = !applies ? 'does not apply' : Array.isArray(result.found) && result.found.length ? `FIRES: ${result.found.join('; ')}` : `applies, ${JSON.stringify(result.found)}`;
  process.stdout.write(`check: ${state.padEnd(44)} -> ${said}\n`);
  return result;
}

test('data-viewer-sorted-column-in-order applies, stays quiet, and fires on a contradiction', async ({ page, app }) => {
  test.setTimeout(10 * 60_000);
  const context = { page, app, tree: undefined };
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  expect(await verdict(context, 'nothing open')).toEqual({ applies: false });

  await menuEntry(app, page, [/^View$/, /^Move Focus to Console$/]);
  await page.keyboard.type(BUILD);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3_000);
  await page.keyboard.type('View(sorts)');
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: /sorts/ }).first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(3_000);
  expect(await verdict(context, 'sorts, unsorted')).toEqual({ applies: false });

  // Each kind it compares, both ways, then the sort removed.
  for (const column of ['num', 'txt', 'lgl', 'day']) {
    await clickSort(page, column);
    expect(await verdict(context, `${column} ascending`)).toEqual({ applies: true, found: [] });
    await clickSort(page, column);
    expect(await verdict(context, `${column} descending`)).toEqual({ applies: true, found: [] });
    await clickSort(page, column);
    expect(await verdict(context, `${column} sort removed`)).toEqual({ applies: false });
  }

  // A factor is sorted by levels the page does not state, so it is left alone.
  await clickSort(page, 'fac');
  expect(await verdict(context, 'fac ascending, a factor')).toEqual({ applies: false });
  await clickSort(page, 'fac');
  await clickSort(page, 'fac');

  // Past the first rows: the middle, and the bottom, where the NAs are.
  await clickSort(page, 'num');
  await scrollTo(page, 0.5);
  expect(await verdict(context, 'num ascending, half way')).toEqual({ applies: true, found: [] });
  await scrollTo(page, 1);
  expect(await verdict(context, 'num ascending, at the bottom, NAs in view')).toEqual({ applies: true, found: [] });
  await scrollTo(page, 0);

  // Searched, then sorted.
  await clickSort(page, 'num');
  await clickSort(page, 'num');
  await page.getByRole('textbox', { name: 'Search data table' }).first().fill('an');
  await page.waitForTimeout(2_500);
  await clickSort(page, 'txt');
  expect(await verdict(context, 'searched for "an", txt ascending')).toEqual({ applies: true, found: [] });
  await page.getByRole('textbox', { name: 'Search data table' }).first().fill('');
  await page.waitForTimeout(2_500);
  expect(await verdict(context, 'search cleared, txt ascending, the control')).toEqual({ applies: true, found: [] });

  // Contradictions: text drawn out of order, then a number, then NA drawn first.
  expect(await writeFirstCell(page, 'txt', 'zzz'), 'the first txt cell was found').toBe(true);
  const text = await verdict(context, 'contradiction: txt first cell "zzz"');
  expect(JSON.stringify(text.found)).toMatch(/column txt sorted ascending, and \\"zzz\\" is drawn above/);
  await clickSort(page, 'txt');
  await clickSort(page, 'txt');
  await clickSort(page, 'num');
  expect(await verdict(context, 'num ascending again, the control')).toEqual({ applies: true, found: [] });
  expect(await writeFirstCell(page, 'num', '50'), 'the first num cell was found').toBe(true);
  const number = await verdict(context, 'contradiction: num first cell "50"');
  expect(JSON.stringify(number.found)).toMatch(/column num sorted ascending, and \\"50\\" is drawn above/);
  expect(await writeFirstCell(page, 'num', 'NA'), 'the first num cell was found').toBe(true);
  const missing = await verdict(context, 'contradiction: num first cell "NA"');
  expect(JSON.stringify(missing.found)).toMatch(/is drawn after NA, where NA comes last whichever way/);
});

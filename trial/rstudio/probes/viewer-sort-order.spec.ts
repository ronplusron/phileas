import type { ElectronApplication, Frame, Page } from '@playwright/test';
import { clickMenuItem, createTest } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * What the data viewer shows when a column is sorted, before a check is
 * written that a sorted column's drawn values are in order. Written on
 * 2026-10-19, from a rule read in the title of one of RStudio's own e2e tests
 * (sort headers cycle through ascending, descending and unsorted), stated here
 * in this project's words; nothing of the test is copied.
 *
 * Builds `sorts`, 300 rows from sequences with no randomness: numbers with
 * negatives, ties and NAs; text in mixed case with accents and digits;
 * a factor whose levels are not in alphabetical order; logicals with NAs;
 * and dates. Views it, then for each column clicks its sort button three
 * times, and prints at each click: the header's state, the button's name,
 * the row names and the column's values in view, and whether those values
 * are in order under each of several ways of comparing them. Then, sorted,
 * it scrolls to the middle and the bottom, and sorts with a search active.
 *
 * It answers: what says a column is sorted, and which way; how to read a
 * column's values row by row; how R orders each kind, against what the page
 * can compare; where NAs go; and whether the third click restores the order
 * the frame had.
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

const COLUMNS = ['num', 'txt', 'fac', 'lgl', 'day'];

function say(line: string): void {
  process.stdout.write(`probe sort order: ${line}\n`);
}

async function menu(app: ElectronApplication, page: Page, wanted: RegExp[]): Promise<void> {
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

function viewerFrame(page: Page): Frame | undefined {
  return page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes('obj=sorts&'));
}

type Read = {
  error?: string;
  header?: { text: string; title: string | null; ariaSort: string | null; colIndex: string | null; className: string; labels: (string | null)[] };
  cells?: { rowIndex: string | null; name: string; value?: string; inView: boolean; partly: boolean }[];
  sortSayers?: string[];
};

/**
 * One column's header and its value in each row drawn, in the order drawn on
 * screen. Measured on 2026.11.0-daily+78 by a first run: a header is a
 * `th[role=columnheader]` holding the column's name in a span, with
 * `aria-sort` none, ascending or descending; the sort buttons are in the
 * summary sidebar, not the header. Row names are in `#pinnedTable` and the
 * data in `#rsGridData`, each row of both carrying `aria-rowindex`. A cell is
 * matched to its header by position.
 */
async function readColumn(frame: Frame, column: string): Promise<Read> {
  return frame
    .evaluate((column) => {
      const view = document.getElementById('gridViewport')?.getBoundingClientRect();
      const header = [...document.querySelectorAll<HTMLElement>('th[role="columnheader"]')].find((th) =>
        [...th.querySelectorAll('span')].some((span) => (span.textContent ?? '').trim() === column)
      );
      if (!header) return { error: `no column header names ${column}` };
      const box = header.getBoundingClientRect();
      const middle = (box.left + box.right) / 2;
      // The header row sits inside the viewport's box, so rows start below it.
      const top = Math.max(view?.top ?? 0, box.bottom);
      const bottom = view?.bottom ?? Infinity;
      const names = new Map(
        [...document.querySelectorAll<HTMLElement>('#pinnedTable tr[aria-rowindex]')].map((row) => [row.getAttribute('aria-rowindex'), row.innerText.trim()])
      );
      const cells = [...document.querySelectorAll<HTMLElement>('#rsGridData tr[aria-rowindex]')]
        .map((row) => {
          const rowBox = row.getBoundingClientRect();
          const cell = [...row.querySelectorAll<HTMLElement>('[role="gridcell"]')].find((candidate) => {
            const at = candidate.getBoundingClientRect();
            return at.left <= middle && middle <= at.right;
          });
          return {
            top: rowBox.top,
            rowIndex: row.getAttribute('aria-rowindex'),
            name: names.get(row.getAttribute('aria-rowindex')) ?? '',
            value: cell ? cell.innerText.trim() : undefined,
            inView: rowBox.top >= top - 1 && rowBox.bottom <= bottom + 1,
            partly: rowBox.bottom > top && rowBox.top < bottom,
          };
        })
        .sort((a, b) => a.top - b.top)
        .map(({ top: _top, ...rest }) => rest);
      // Anything else in the frame that speaks of sorting, such as a status
      // bar or a button to clear the sort.
      const sortSayers = [...document.querySelectorAll<HTMLElement>('*')]
        .filter((element) => {
          const label = `${element.getAttribute('aria-label') ?? ''} ${element.getAttribute('title') ?? ''}`;
          const own = [...element.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent ?? '').join(' ');
          return /sort/i.test(`${label} ${own}`) && !/^Sort column /.test(element.getAttribute('aria-label') ?? '');
        })
        .map((element) => {
          const at = element.getBoundingClientRect();
          const shown = at.width > 0 && at.height > 0 && getComputedStyle(element).visibility !== 'hidden';
          return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} ${shown ? 'shown' : 'not shown'} label="${element.getAttribute('aria-label') ?? ''}" title="${element.getAttribute('title') ?? ''}" text="${(element.innerText ?? '').trim().slice(0, 80)}"`;
        });
      return {
        header: {
          text: header.innerText.trim(),
          title: header.getAttribute('title'),
          ariaSort: header.getAttribute('aria-sort'),
          colIndex: header.getAttribute('aria-colindex'),
          className: String(header.className),
          labels: [...header.querySelectorAll('[aria-label]')].map((element) => element.getAttribute('aria-label')),
        },
        cells,
        sortSayers,
      };
    }, column)
    .catch((error: Error) => ({ error: error.message.split('\n')[0] }));
}

const MISSING = new Set(['', 'NA']);

/** Whether each way of comparing finds the values in view non-decreasing, non-increasing, or neither. */
function orderings(values: string[]): string {
  const present = values.filter((value) => !MISSING.has(value));
  const ways: Record<string, (a: string, b: string) => number> = {
    number: (a, b) => Number(a.replace(/,/g, '')) - Number(b.replace(/,/g, '')),
    date: (a, b) => Date.parse(a) - Date.parse(b),
    locale: (a, b) => a.localeCompare(b, 'en'),
    'locale, numeric': (a, b) => a.localeCompare(b, 'en', { numeric: true }),
    codepoint: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
  };
  const said = Object.entries(ways).map(([way, compare]) => {
    const steps = present.slice(1).map((value, i) => compare(present[i] as string, value));
    if (steps.some(Number.isNaN)) return `${way}: not comparable`;
    const up = steps.every((step) => step <= 0);
    const down = steps.every((step) => step >= 0);
    return `${way}: ${up && down ? 'all equal' : up ? 'ascending' : down ? 'descending' : 'neither'}`;
  });
  const missingAt = values.map((value, i) => (MISSING.has(value) ? i : -1)).filter((i) => i >= 0);
  return `${said.join('; ')}; missing at ${JSON.stringify(missingAt)} of ${values.length}`;
}

async function report(page: Page, column: string, state: string): Promise<void> {
  say(`--- ${column}: ${state}`);
  const frame = viewerFrame(page);
  if (!frame) {
    say('no viewer frame for sorts');
    return;
  }
  const footer = await frame.getByText(/^Showing /).first().innerText().catch(() => 'unreadable');
  say(`footer: "${footer}"`);
  const read = await readColumn(frame, column);
  if (read.error || !read.header || !read.cells) {
    say(`could not read: ${read.error}`);
    return;
  }
  say(`header: ${JSON.stringify(read.header)}`);
  say(`others speaking of sorting: ${JSON.stringify(read.sortSayers)}`);
  const inView = read.cells.filter((cell) => cell.inView);
  say(`rows drawn ${read.cells.length}, wholly in view ${inView.length}, partly ${read.cells.filter((cell) => cell.partly).length}; aria-rowindex on ${read.cells.filter((cell) => cell.rowIndex !== null).length}`);
  say(`row names in view: ${JSON.stringify(inView.map((cell) => cell.name).slice(0, 40))}`);
  say(`row indexes in view: ${JSON.stringify(inView.map((cell) => cell.rowIndex).slice(0, 40))}`);
  const values = inView.map((cell) => cell.value ?? '<no cell under the header>');
  say(`values in view: ${JSON.stringify(values.slice(0, 40))}`);
  say(`order: ${orderings(values)}`);
}

/**
 * The column's value in every row of the frame, read by scrolling the grid a
 * view at a time from the top and keeping each row drawn by its
 * aria-rowindex. The second run, on 2026-10-19, saw 16 rows in view and
 * every one the same value for text, factor and logical columns, which says
 * nothing of where one value gives way to the next.
 */
async function reportWhole(page: Page, column: string, state: string): Promise<void> {
  const byIndex = new Map<number, string>();
  for (let step = 0; step < 60; step++) {
    const frame = viewerFrame(page);
    if (!frame) break;
    const read = await readColumn(frame, column);
    for (const cell of read.cells ?? []) if (cell.rowIndex && cell.value !== undefined) byIndex.set(Number(cell.rowIndex), cell.value);
    const more = await frame
      .evaluate(() => {
        const viewport = document.getElementById('gridViewport');
        if (!viewport || viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1) return false;
        viewport.scrollTop += Math.round(viewport.clientHeight * 0.8);
        return true;
      })
      .catch(() => false);
    if (!more) break;
    await page.waitForTimeout(800);
  }
  await viewerFrame(page)?.evaluate(() => {
    const viewport = document.getElementById('gridViewport');
    if (viewport) viewport.scrollTop = 0;
  });
  await page.waitForTimeout(1_500);
  const indexes = [...byIndex.keys()].sort((a, b) => a - b);
  const gaps = indexes.filter((index, i) => i > 0 && index !== (indexes[i - 1] as number) + 1);
  const values = indexes.map((index) => byIndex.get(index) as string);
  const runs: string[] = [];
  for (const value of values) {
    const last = runs.at(-1);
    const [seen, times] = last ? [last.replace(/ x\d+$/, ''), Number(/ x(\d+)$/.exec(last)?.[1] ?? 1)] : [undefined, 0];
    if (last && seen === value) runs[runs.length - 1] = `${value} x${times + 1}`;
    else runs.push(`${value} x1`);
  }
  say(`--- ${column}: ${state}, the whole frame`);
  say(`rows read ${indexes.length}, aria-rowindex ${indexes[0]} to ${indexes.at(-1)}, gaps before ${JSON.stringify(gaps)}`);
  say(`runs: ${JSON.stringify(runs)}`);
  say(`order: ${orderings(values)}`);
}

async function scrollTo(page: Page, share: number): Promise<void> {
  const said = await viewerFrame(page)
    ?.evaluate((to) => {
      const viewport = document.getElementById('gridViewport');
      if (!viewport) return 'no #gridViewport';
      viewport.scrollTop = Math.round((viewport.scrollHeight - viewport.clientHeight) * to);
      return `scrollTop ${viewport.scrollTop} of ${viewport.scrollHeight - viewport.clientHeight}`;
    }, share)
    .catch((error: Error) => `unreadable: ${error.message}`);
  say(`scrolled to ${share}: ${said}`);
  await page.waitForTimeout(2_500);
}

/** The sidebar's sort button reads "Sort column x ascending", then "... descending", then "Remove sort on column x". */
function sortButton(page: Page, column: string) {
  return viewerFrame(page)?.getByRole('button', { name: new RegExp(`^(Sort column ${column} |Remove sort on column ${column}$)`) }).first();
}

async function clickSort(page: Page, column: string): Promise<void> {
  const before = await sortButton(page, column)?.getAttribute('aria-label').catch(() => null);
  await sortButton(page, column)?.click({ timeout: 5_000 }).catch((error: Error) => say(`could not click: ${error.message.split('\n')[0]}`));
  await page.waitForTimeout(2_500);
  const after = await sortButton(page, column)?.getAttribute('aria-label').catch(() => null);
  say(`clicked "${before}", the button now reads "${after}"`);
}

test('what the data viewer shows of a sorted column', async ({ page, app }) => {
  test.setTimeout(15 * 60_000);
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await menu(app, page, [/^View$/, /^Move Focus to Console$/]);
  await page.keyboard.type(BUILD);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3_000);
  await page.keyboard.type('View(sorts)');
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: /sorts/ }).first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(3_000);
  await report(page, 'num', 'as opened');

  for (const column of COLUMNS) {
    for (const click of ['first click', 'second click', 'third click']) {
      await clickSort(page, column);
      await report(page, column, click);
      if (click !== 'third click' && column !== 'num') await reportWhole(page, column, click);
    }
  }

  // Ascending, the whole frame: where the NAs go that way.
  await clickSort(page, 'num');
  await reportWhole(page, 'num', 'ascending');
  await clickSort(page, 'num');
  await clickSort(page, 'num');

  // Sorted, then scrolled: whether the order holds past the first rows drawn,
  // and where the NAs went.
  await clickSort(page, 'num');
  await clickSort(page, 'num');
  for (const share of [0.5, 1]) {
    await scrollTo(page, share);
    await report(page, 'num', `descending, scrolled to ${share}`);
  }
  await scrollTo(page, 0);
  await clickSort(page, 'num');
  await report(page, 'num', 'third click, back at the top');

  // Sorted with a search active.
  await page.getByRole('textbox', { name: 'Search data table' }).first().fill('an');
  await page.waitForTimeout(2_500);
  await clickSort(page, 'txt');
  await report(page, 'txt', 'searched for "an", first click');
});

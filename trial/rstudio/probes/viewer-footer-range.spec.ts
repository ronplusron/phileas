import type { ElectronApplication, Frame, Page } from '@playwright/test';
import { clickMenuItem, createTest } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * Whether the data viewer's footer says which rows, and past ~200 columns
 * which columns, are in view, before a check is written that compares the
 * two. Written on 2026-10-19. The footer reads "Showing 1 to 16 of 1,000
 * entries", and past ~200 columns adds "columns 1 to 5 of 450"
 * (`viewer-paging.spec.ts`); what the numbers count, and when they catch up
 * after a scroll, is unmeasured.
 *
 * The rows test builds `paged`, 1,000 rows by 120 columns, as the
 * `data-viewer-paged` Fix does, and at each state prints the footer, read at
 * once, after 500 ms and after 2.5 s, beside every row drawn: its
 * aria-rowindex, its row name, and whether it is wholly, partly or not in
 * the grid's view. The states: as opened; scrolled a quarter, half way, to
 * the bottom; scrolled by half a row; sorted by `id` descending, where row
 * names and positions part; searched; and a column hidden.
 *
 * The columns test builds `wide`, 1,000 rows by 450 columns, and prints the
 * footer beside every column header drawn: its text, data-col-idx, and
 * whether it is wholly, partly or not in view, as opened, scrolled sideways
 * by 30% and 60%, to the end, by half a column, and with a column pinned.
 */
const test = createTest(rstudio);

function say(line: string): void {
  process.stdout.write(`probe footer range: ${line}\n`);
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

async function inConsole(app: ElectronApplication, page: Page, line: string, settleMs = 3_000): Promise<void> {
  await menu(app, page, [/^View$/, /^Move Focus to Console$/]);
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(settleMs);
}

function viewerFrame(page: Page, object: string): Frame | undefined {
  return page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes(`obj=${object}&`));
}

async function footerNow(frame: Frame): Promise<string> {
  return frame.getByText(/^Showing /).first().innerText({ timeout: 2_000 }).catch(() => 'unreadable');
}

/** Moves the grid's own viewport, by a share of its range or by a share of one row or column. */
async function move(frame: Frame, how: { down?: number; across?: number; downRows?: number; acrossColumns?: number }): Promise<string> {
  return frame
    .evaluate((how) => {
      const viewport = document.getElementById('gridViewport');
      if (!viewport) return 'no #gridViewport';
      const row = document.querySelector<HTMLElement>('#rsGridData tr[aria-rowindex]')?.getBoundingClientRect().height ?? 0;
      const column = document.querySelector<HTMLElement>('th[role="columnheader"]')?.getBoundingClientRect().width ?? 0;
      if (how.down !== undefined) viewport.scrollTop = Math.round((viewport.scrollHeight - viewport.clientHeight) * how.down);
      if (how.across !== undefined) viewport.scrollLeft = Math.round((viewport.scrollWidth - viewport.clientWidth) * how.across);
      if (how.downRows !== undefined) viewport.scrollTop += Math.round(row * how.downRows);
      if (how.acrossColumns !== undefined) viewport.scrollLeft += Math.round(column * how.acrossColumns);
      return `scrollTop ${viewport.scrollTop} of ${viewport.scrollHeight - viewport.clientHeight}, scrollLeft ${viewport.scrollLeft} of ${viewport.scrollWidth - viewport.clientWidth}; a row ${row.toFixed(1)}px, a column ${column.toFixed(1)}px`;
    }, how)
    .catch((error: Error) => `unreadable: ${error.message}`);
}

/**
 * Every body row drawn, top to bottom, with where it sits against the grid's
 * view. Measured on 2026.11.0-daily+78 by `viewer-sort-order.spec.ts`'s first
 * runs: row names are in `#pinnedTable` and the data in `#rsGridData`, each
 * row of both carrying `aria-rowindex`, counted from 2 for the first.
 */
async function rowsDrawn(frame: Frame): Promise<{ rowIndex: string | null; name: string; where: string }[]> {
  return frame
    .evaluate(() => {
      const view = document.getElementById('gridViewport')?.getBoundingClientRect();
      // The header row sits inside the viewport's box, so the view for body
      // rows starts below it.
      const headerBottom = Math.max(0, ...[...document.querySelectorAll('th[role="columnheader"]')].map((cell) => cell.getBoundingClientRect().bottom));
      const top = Math.max(view?.top ?? 0, headerBottom);
      const bottom = view?.bottom ?? Infinity;
      const names = new Map(
        [...document.querySelectorAll<HTMLElement>('#pinnedTable tr[aria-rowindex]')].map((row) => [row.getAttribute('aria-rowindex'), row.innerText.trim()])
      );
      return [...document.querySelectorAll<HTMLElement>('#rsGridData tr[aria-rowindex]')]
        .map((row) => {
          const box = row.getBoundingClientRect();
          const where = box.top >= top - 1 && box.bottom <= bottom + 1 ? 'whole' : box.bottom > top && box.top < bottom ? 'part' : 'out';
          return { at: box.top, rowIndex: row.getAttribute('aria-rowindex'), name: names.get(row.getAttribute('aria-rowindex')) ?? '', where };
        })
        .sort((a, b) => a.at - b.at)
        .map(({ at: _at, ...rest }) => rest);
    })
    .catch(() => []);
}

/**
 * Every column header drawn, left to right, with where it sits against the
 * grid's view: a `th[role=columnheader]` naming its column in a span and
 * carrying `data-col-idx`. The row names' header has no role. A header in
 * `#pinnedTable`, or classed pinned, counts as pinned.
 */
async function headersDrawn(frame: Frame): Promise<{ text: string; colIndex: string | null; where: string; pinned: boolean }[]> {
  return frame
    .evaluate(() => {
      const view = document.getElementById('gridViewport')?.getBoundingClientRect();
      const left = view?.left ?? 0;
      const right = view?.right ?? Infinity;
      return [...document.querySelectorAll<HTMLElement>('th[role="columnheader"]')]
        .map((cell) => {
          const box = cell.getBoundingClientRect();
          const where = box.width === 0 ? 'no width' : box.left >= left - 1 && box.right <= right + 1 ? 'whole' : box.right > left && box.left < right ? 'part' : 'out';
          return {
            at: box.left,
            text: [...cell.querySelectorAll('span')].map((span) => (span.textContent ?? '').trim()).find(Boolean) ?? '',
            colIndex: cell.getAttribute('data-col-idx'),
            where,
            pinned: Boolean(cell.closest('#pinnedTable')) || /pinned/.test(String(cell.className)),
          };
        })
        .sort((a, b) => a.at - b.at)
        .map(({ at: _at, ...rest }) => rest);
    })
    .catch(() => []);
}

/** A run of entries said compactly: the first and last few, and how many lie between. */
function ends<T>(all: T[], show = 4): string {
  if (all.length <= show * 2) return JSON.stringify(all);
  return `${JSON.stringify(all.slice(0, show))} ... ${all.length - show * 2} more ... ${JSON.stringify(all.slice(-show))}`;
}

async function reportRows(page: Page, state: string): Promise<void> {
  say(`--- rows: ${state}`);
  const frame = viewerFrame(page, 'paged');
  if (!frame) return say('no viewer frame for paged');
  const atOnce = await footerNow(frame);
  await page.waitForTimeout(500);
  const after500 = await footerNow(frame);
  await page.waitForTimeout(2_000);
  const after2500 = await footerNow(frame);
  say(`footer at once "${atOnce}", after 500 ms "${after500}", after 2.5 s "${after2500}"`);
  const rows = await rowsDrawn(frame);
  for (const where of ['whole', 'part', 'out']) {
    const these = rows.filter((row) => row.where === where);
    say(`${where} in view: ${these.length}; names ${ends(these.map((row) => row.name))}; aria-rowindex ${ends(these.map((row) => row.rowIndex))}`);
  }
}

async function reportColumns(page: Page, state: string): Promise<void> {
  say(`--- columns: ${state}`);
  const frame = viewerFrame(page, 'wide');
  if (!frame) return say('no viewer frame for wide');
  const atOnce = await footerNow(frame);
  await page.waitForTimeout(500);
  const after500 = await footerNow(frame);
  await page.waitForTimeout(2_000);
  const after2500 = await footerNow(frame);
  say(`footer at once "${atOnce}", after 500 ms "${after500}", after 2.5 s "${after2500}"`);
  const headers = await headersDrawn(frame);
  for (const where of ['whole', 'part', 'out', 'no width']) {
    const these = headers.filter((header) => header.where === where);
    say(
      `${where}: ${these.length}; names ${ends(these.map((header) => header.text))}; data-col-idx ${ends(these.map((header) => header.colIndex))}; pinned ${JSON.stringify(these.filter((header) => header.pinned).map((header) => header.text))}`
    );
  }
}

test("whether the footer's rows are the rows in view", async ({ page, app }) => {
  test.setTimeout(15 * 60_000);
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await inConsole(
    app,
    page,
    'paged <- data.frame(id = 1:1000, ' +
      'setNames(lapply(1:39, function(j) (1:1000 * j) %% 997 / 10), sprintf("n%02d", 1:39)), ' +
      'setNames(lapply(1:40, function(j) sprintf("r%04d-%d", 1:1000, j)), sprintf("t%02d", 1:40)), ' +
      'setNames(lapply(1:40, function(j) factor(letters[(1:1000 + j) %% 5 + 1])), sprintf("f%02d", 1:40)))'
  );
  await inConsole(app, page, 'View(paged)', 5_000);
  await reportRows(page, 'as opened');

  const frame = () => viewerFrame(page, 'paged');
  for (const share of [0.25, 0.5, 1]) {
    say(`scroll: ${await (frame() ? move(frame() as Frame, { down: share }) : 'no frame')}`);
    await reportRows(page, `scrolled to ${share}`);
  }
  say(`scroll: ${await (frame() ? move(frame() as Frame, { down: 0.5 }) : 'no frame')}`);
  say(`scroll: ${await (frame() ? move(frame() as Frame, { downRows: 0.5 }) : 'no frame')}`);
  await reportRows(page, 'half way, then down half a row');

  // Sorted by id descending, so row names and positions part.
  say(`scroll: ${await (frame() ? move(frame() as Frame, { down: 0 }) : 'no frame')}`);
  for (let i = 0; i < 2; i++) {
    await frame()?.getByRole('button', { name: /^Sort column id / }).first().click({ timeout: 5_000 }).catch((error: Error) => say(`could not sort: ${error.message.split('\n')[0]}`));
    await page.waitForTimeout(2_000);
  }
  await reportRows(page, 'sorted by id, two clicks');
  say(`scroll: ${await (frame() ? move(frame() as Frame, { down: 0.5 }) : 'no frame')}`);
  await reportRows(page, 'sorted, scrolled half way');
  await frame()?.getByRole('button', { name: /^(Sort column id |Remove sort on column id$)/ }).first().click({ timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(2_000);

  // Searched: fewer entries than rows in the frame.
  await page.getByRole('textbox', { name: 'Search data table' }).first().fill('r00');
  await page.waitForTimeout(2_500);
  await reportRows(page, 'searched for r00');
  say(`scroll: ${await (frame() ? move(frame() as Frame, { down: 1 }) : 'no frame')}`);
  await reportRows(page, 'searched, scrolled to the bottom');
  await page.getByRole('textbox', { name: 'Search data table' }).first().fill('');
  await page.waitForTimeout(2_500);

  await frame()?.getByRole('button', { name: 'Hide column n01' }).first().click({ timeout: 5_000 }).catch((error: Error) => say(`could not hide: ${error.message.split('\n')[0]}`));
  await page.waitForTimeout(2_000);
  await reportRows(page, 'column n01 hidden');
});

test("whether the footer's columns are the columns in view, past 200", async ({ page, app }) => {
  test.setTimeout(15 * 60_000);
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await inConsole(
    app,
    page,
    'wide <- data.frame(id = 1:1000, ' +
      'setNames(lapply(1:149, function(j) (1:1000 * j) %% 997 / 10), sprintf("n%03d", 1:149)), ' +
      'setNames(lapply(1:150, function(j) sprintf("r%04d-%d", 1:1000, j)), sprintf("t%03d", 1:150)), ' +
      'setNames(lapply(1:150, function(j) factor(letters[(1:1000 + j) %% 5 + 1])), sprintf("f%03d", 1:150)))',
    4_000
  );
  await inConsole(app, page, 'View(wide)', 5_000);
  await reportColumns(page, 'as opened');

  const frame = () => viewerFrame(page, 'wide');
  for (const share of [0.3, 0.6, 1]) {
    say(`scroll: ${await (frame() ? move(frame() as Frame, { across: share }) : 'no frame')}`);
    await reportColumns(page, `scrolled sideways to ${share}`);
  }
  say(`scroll: ${await (frame() ? move(frame() as Frame, { across: 0.3 }) : 'no frame')}`);
  say(`scroll: ${await (frame() ? move(frame() as Frame, { acrossColumns: 0.5 }) : 'no frame')}`);
  await reportColumns(page, 'at 0.3, then across half a column');

  say(`scroll: ${await (frame() ? move(frame() as Frame, { across: 0 }) : 'no frame')}`);
  await frame()?.getByRole('button', { name: 'Pin column n002' }).first().click({ timeout: 5_000 }).catch((error: Error) => say(`could not pin: ${error.message.split('\n')[0]}`));
  await page.waitForTimeout(2_000);
  await reportColumns(page, 'n002 pinned');
  say(`scroll: ${await (frame() ? move(frame() as Frame, { across: 0.5 }) : 'no frame')}`);
  await reportColumns(page, 'n002 pinned, scrolled sideways to 0.5');
});

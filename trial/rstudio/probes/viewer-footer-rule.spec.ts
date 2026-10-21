import type { ElectronApplication, Frame, Page } from '@playwright/test';
import { clickMenuItem, createTest } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * Which rows the data viewer's footer, "Showing X to Y", counts when a row
 * is only partly in view. Written on 2026-10-21, after a shown launch on
 * 2026.11.0-daily+78, scrolled a quarter of the way, said rows 247 to 261
 * with row 247 about three quarters in view: the footer counts more than
 * the rows wholly in view, which is what `data-viewer-footer-rows-in-view`
 * assumed.
 *
 * Builds `paged` as the `data-viewer-paged` Fix does, views it, and scrolls
 * the grid to row 200 and then to part-row offsets past it, in tenths of a
 * row. At each it prints the footer's X and Y beside how much of each row at
 * the top and bottom edges shows, as a share of its height, so the rule can
 * be read off both edges. Run shown and hidden, since the window's height
 * decides where the bottom edge falls.
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

function say(line: string): void {
  process.stdout.write(`probe footer rule: ${line}\n`);
}

/** The footer, and how much of each row near the view's edges shows, by position. */
async function edges(frame: Frame): Promise<{ footer: string; rowHeight: number; shown: { position: number; share: number }[] }> {
  return frame.evaluate(() => {
    const footer = [...document.querySelectorAll<HTMLElement>('*')].find((element) =>
      [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim().startsWith('Showing '))
    );
    const view = document.getElementById('gridViewport')?.getBoundingClientRect();
    const headerBottom = Math.max(0, ...[...document.querySelectorAll('th[role="columnheader"]')].map((h) => h.getBoundingClientRect().bottom));
    const top = Math.max(view?.top ?? 0, headerBottom);
    const bottom = view?.bottom ?? Infinity;
    const rows = [...document.querySelectorAll<HTMLElement>('#rsGridData tr[aria-rowindex]')];
    const rowHeight = rows[0]?.getBoundingClientRect().height ?? 0;
    const shown = rows
      .map((row) => {
        const box = row.getBoundingClientRect();
        const share = Math.max(0, Math.min(box.bottom, bottom) - Math.max(box.top, top)) / box.height;
        return { position: Number(row.getAttribute('aria-rowindex')) - 1, share: Math.round(share * 100) / 100 };
      })
      .filter((row) => row.share > 0)
      .sort((a, b) => a.position - b.position);
    return { footer: footer?.innerText.trim() ?? '', rowHeight, shown };
  });
}

test('which rows the footer counts when one is partly in view', async ({ page, app }) => {
  test.setTimeout(10 * 60_000);
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await menuEntry(app, page, [/^View$/, /^Move Focus to Console$/]);
  await page.keyboard.type(
    'paged <- data.frame(id = 1:1000, ' +
      'setNames(lapply(1:39, function(j) (1:1000 * j) %% 997 / 10), sprintf("n%02d", 1:39)), ' +
      'setNames(lapply(1:40, function(j) sprintf("r%04d-%d", 1:1000, j)), sprintf("t%02d", 1:40)), ' +
      'setNames(lapply(1:40, function(j) factor(letters[(1:1000 + j) %% 5 + 1])), sprintf("f%02d", 1:40)))'
  );
  await page.keyboard.press('Enter');
  await page.getByText('1000 obs. of 120 variables').first().waitFor({ timeout: 15_000 });
  await page.keyboard.type('View(paged)');
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: /paged/ }).first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(3_000);

  const frame = page.frames().find((f) => f.url().includes('gridviewer.html') && f.url().includes('obj=paged&'));
  if (!frame) throw new Error('no viewer frame for paged');
  const { rowHeight } = await edges(frame);
  say(`window ${await page.evaluate(() => `${window.innerWidth}x${window.innerHeight}`)}, row height ${rowHeight}`);
  for (const tenths of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const scrollTop = await frame.evaluate((to) => {
      const viewport = document.getElementById('gridViewport');
      if (!viewport) return -1;
      viewport.scrollTop = to;
      return viewport.scrollTop;
    }, Math.round(rowHeight * (200 + tenths / 10)));
    await page.waitForTimeout(1_500);
    const read = await edges(frame);
    const first = read.shown.slice(0, 2).map((row) => `${row.position}:${row.share}`).join(' ');
    const last = read.shown.slice(-2).map((row) => `${row.position}:${row.share}`).join(' ');
    const said = /^Showing ([\d,]+) to ([\d,]+)/.exec(read.footer);
    say(`+${tenths}/10 row, scrollTop ${scrollTop}: footer ${said?.[1]} to ${said?.[2]}; top edge ${first}; bottom edge ${last}`);
  }
});

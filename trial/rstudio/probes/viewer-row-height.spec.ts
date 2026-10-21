import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenuItem, createTest } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * Why the data viewer draws its rows 37 px tall in some launches and 23 px in
 * others. Written on 2026-10-19, after four launches of the same probe on
 * 2026.11.0-daily+78 gave three with a window 868 high, rows 23 px and the
 * footer's "Showing 1 to 16" matching the 16 rows wholly in view, and one
 * with a window 829 high, rows 37 px and "Showing 1 to 15" over 9 rows in
 * view: the footer counted rows of 23 px into a grid drawing them 37.
 *
 * Builds `paged` as the `data-viewer-paged` Fix does, views it, and prints in
 * each launch what could make a row taller: the window's size and its
 * display's work area, the zoom factor and the device pixel ratio, the
 * grid's fonts and whether they have loaded, the first row's cells, each
 * with its height, its font and whether its text wraps, and the tallest one.
 * Run with `--repeat-each` to meet both kinds of launch.
 *
 * **Found on 2026-10-19, over 16 launches:** what decides it is where the
 * window opened. Every launch that opened at x 0, y 33, 1200 by 861, fitted to
 * the display's work area, drew all 120 columns in each row, narrower, and 31
 * text cells of the first row wrapped onto two lines, `r0001-10` in a column 63
 * wide, so rows were 37 px and the footer said 15 over 9 rows wholly in view.
 * Every launch that opened at y 0, 1200 by 900, drew 10 columns, rows 23 px,
 * and agreed, and so did three such launches moved to the fitted bounds before
 * `View(paged)`: the bounds at the moment of viewing are not the cause. Zoom,
 * pixel ratio and fonts were the same in both. Not known: what in RStudio ties
 * the grid's column drawing to how the window opened.
 *
 * **Run shown on 2026-10-21,** `PHILEAS_SHOW=back`: 5 of 5 launches opened
 * fitted and drew 10 columns of 23 px rows, so the 37 px layout comes only
 * of a hidden window, an engine defect docs/DEFECTS.md has. Hidden on the
 * installed 2026.10.0, 1 launch of 8 opened fitted and drew it too.
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
  process.stdout.write(`probe row height: ${line}\n`);
}

test('what makes the data viewer draw its rows taller', async ({ page, app }) => {
  test.setTimeout(5 * 60_000);
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);

  const windowFacts = await app.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.webContents.getURL().startsWith('http'));
    const bounds = window?.getBounds();
    const display = bounds ? screen.getDisplayMatching(bounds) : screen.getPrimaryDisplay();
    return {
      bounds,
      contentBounds: window?.getContentBounds(),
      zoomFactor: window?.webContents.getZoomFactor(),
      zoomLevel: window?.webContents.getZoomLevel(),
      display: { bounds: display.bounds, workArea: display.workArea, scaleFactor: display.scaleFactor },
      displays: screen.getAllDisplays().length,
    };
  });
  say(`window ${JSON.stringify(windowFacts)}`);

  // PROBE_BOUNDS sets the window's bounds before anything is viewed: `fit`,
  // as the tall launches opened, at x 0, y 33, 1200 by 861; or `full`, as the
  // others did, at x 0, y 0, 1200 by 900. Unset, the window is left as it
  // opened.
  const wanted = { fit: { x: 0, y: 33, width: 1200, height: 861 }, full: { x: 0, y: 0, width: 1200, height: 900 } }[process.env.PROBE_BOUNDS ?? ''];
  if (wanted) {
    const set = await app.evaluate(({ BrowserWindow }, bounds) => {
      const window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.webContents.getURL().startsWith('http'));
      window?.setBounds(bounds);
      return window?.getBounds();
    }, wanted);
    await page.waitForTimeout(1_500);
    say(`bounds set to ${process.env.PROBE_BOUNDS}: ${JSON.stringify(set)}, page ${await page.evaluate(() => `${window.innerWidth}x${window.innerHeight}`)}`);
  }
  say(`page ${await page.evaluate(() => JSON.stringify({ inner: `${window.innerWidth}x${window.innerHeight}`, dpr: window.devicePixelRatio, rootFont: getComputedStyle(document.documentElement).fontSize }))}`);

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
  const grid = await frame?.evaluate(async () => {
    const round = (n: number) => Math.round(n * 10) / 10;
    const footer = [...document.querySelectorAll<HTMLElement>('*')].find((element) =>
      [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim().startsWith('Showing '))
    );
    const first = [...document.querySelectorAll<HTMLElement>('#rsGridData tr[aria-rowindex]')].sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
    )[0];
    const pinned = document.querySelector<HTMLElement>('#pinnedTable tr[aria-rowindex="2"]');
    const cellFacts = (cell: HTMLElement) => {
      const style = getComputedStyle(cell);
      return {
        text: cell.innerText.slice(0, 20),
        height: round(cell.getBoundingClientRect().height),
        width: round(cell.getBoundingClientRect().width),
        font: `${style.fontSize}/${style.lineHeight} ${style.fontFamily.slice(0, 40)}`,
        whiteSpace: style.whiteSpace,
        padding: `${style.paddingTop} ${style.paddingBottom}`,
        wraps: cell.scrollHeight > parseFloat(style.lineHeight || '0') * 1.5,
      };
    };
    const cells = [...(first?.querySelectorAll<HTMLElement>('td') ?? [])];
    const tallest = cells.reduce<HTMLElement | undefined>((top, cell) => (!top || cell.getBoundingClientRect().height > top.getBoundingClientRect().height ? cell : top), undefined);
    await document.fonts.ready;
    return {
      footer: footer?.innerText.trim(),
      frame: `${window.innerWidth}x${window.innerHeight}`,
      dpr: window.devicePixelRatio,
      bodyFont: `${getComputedStyle(document.body).fontSize} ${getComputedStyle(document.body).fontFamily.slice(0, 60)}`,
      fonts: [...document.fonts].map((font) => `${font.family} ${font.weight} ${font.status}`).slice(0, 8),
      firstRow: first ? { height: round(first.getBoundingClientRect().height), cells: cells.length } : null,
      pinnedRow: pinned ? { height: round(pinned.getBoundingClientRect().height), cell: pinned.querySelector('td') ? cellFacts(pinned.querySelector('td') as HTMLElement) : null } : null,
      firstCells: cells.slice(0, 4).map(cellFacts),
      tallest: tallest ? cellFacts(tallest) : null,
      // The cells whose text takes more than one line, by their text's own boxes.
      wrapped: cells
        .filter((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size > 1;
        })
        .map((cell) => `${cell.innerText.replace(/\s+/g, ' ').slice(0, 24)} (${round(cell.getBoundingClientRect().width)} wide)`)
        .slice(0, 6),
      wrappedCount: cells.filter((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size > 1;
      }).length,
      bodyClass: document.body.className,
    };
  });
  say(`grid ${JSON.stringify(grid)}`);
});

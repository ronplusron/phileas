import type { ElectronApplication, Frame, Page } from '@playwright/test';
import { clickMenuItem, createTest, expect, type AppCheckContext } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';
import { dataViewerFooterRowsInView as check } from '../phileas/checks/data-viewer/data-viewer-footer-rows-in-view';
import { shownViewer } from '../phileas/checks/data-viewer/viewer';
import { dataViewerPaged } from '../phileas/fixes/data-viewer/data-viewer-paged';

/**
 * The test every check is to have (docs/HISTORY.md, 2026-10-16), for
 * `data-viewer-footer-rows-in-view`: on the screens it is written for it
 * applies and is quiet, where it has nothing to compare it does not apply,
 * and with the page made to contradict itself, each way, it fires. Written on
 * 2026-10-19.
 *
 * Starts from the `data-viewer-paged` Fix, run here outside a Route, as
 * `data-viewer-counts-check.spec.ts` does.
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

function frameFor(page: Page): Frame | undefined {
  return page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes('obj=paged&'));
}

/** Moves the grid's viewport to a share of its height, then down by a share of a row. */
async function scroll(page: Page, share: number, rows = 0): Promise<void> {
  await frameFor(page)?.evaluate(
    ([share, rows]) => {
      const viewport = document.getElementById('gridViewport');
      if (!viewport) return;
      const row = document.querySelector<HTMLElement>('#rsGridData tr[aria-rowindex]')?.getBoundingClientRect().height ?? 0;
      viewport.scrollTop = Math.round((viewport.scrollHeight - viewport.clientHeight) * share + row * rows);
    },
    [share, rows] as const
  );
  await page.waitForTimeout(2_500);
}

async function clickSort(page: Page, column: string): Promise<void> {
  await frameFor(page)
    ?.getByRole('button', { name: new RegExp(`^(Sort column ${column} |Remove sort on column ${column}$)`) })
    .first()
    .click({ timeout: 5_000 });
  await page.waitForTimeout(2_500);
}

async function verdict(context: AppCheckContext, state: string): Promise<{ applies: boolean; found?: unknown }> {
  const applies = (await check.appliesWhen?.(context)) ?? true;
  const result = applies ? { applies, found: await check.run(context) } : { applies };
  // The footer of whichever viewer the Source pane shows, not always paged's.
  const shown = await shownViewer(context.page);
  const footer = await (shown?.frame.getByText(/^Showing /).first().innerText().catch(() => '') ?? Promise.resolve(''));
  const said = !applies ? 'does not apply' : Array.isArray(result.found) && result.found.length ? `FIRES: ${result.found.join('; ')}` : `applies, ${JSON.stringify(result.found)}`;
  process.stdout.write(`check: ${state.padEnd(40)} footer "${footer}" -> ${said}\n`);
  return result;
}

test('data-viewer-footer-rows-in-view applies, stays quiet, and fires on a contradiction each way', async ({ page, app }) => {
  test.setTimeout(10 * 60_000);
  const context = { page, app, tree: undefined };
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  expect(await verdict(context, 'nothing open')).toEqual({ applies: false });

  // The Fix, as a Route would run it.
  await dataViewerPaged({
    page,
    app,
    step: async (step: { kind: 'act' } | { kind: 'code'; action: () => Promise<unknown> }) => {
      // The Fix's one act step is View > Move Focus to Console.
      if (step.kind === 'act') await menuEntry(app, page, [/^View$/, /^Move Focus to Console$/]);
      else await step.action();
    },
  } as unknown as Parameters<typeof dataViewerPaged>[0]);
  await page.waitForTimeout(3_000);

  // A launch whose window opened fitted to the screen draws every column, its
  // text wraps, and its rows are 37 px where the footer counts rows of 23, so
  // the footer names more rows than are in view, a likely RStudio finding,
  // docs/OUTSTANDING.md 2.35. There the check is right to fire as the viewer
  // opens, and the states below, written for a viewer that agrees, do not
  // hold.
  const rowHeight = await frameFor(page)?.evaluate(
    () => document.querySelector<HTMLElement>('#rsGridData tr[aria-rowindex]')?.getBoundingClientRect().height ?? 0
  );
  if ((rowHeight ?? 0) > 30) {
    const fitted = await verdict(context, `paged, as opened, rows ${rowHeight} px`);
    expect(fitted.applies).toBe(true);
    expect(JSON.stringify(fitted.found)).toMatch(/says rows 1 to (\d+), and rows 1 to (?!\1\b)\d+ are wholly in view/);
    return;
  }
  expect(await verdict(context, 'paged, as opened')).toEqual({ applies: true, found: [] });

  for (const [share, rows] of [
    [0.25, 0],
    [0.5, 0.5],
    [1, 0],
  ] as const) {
    await scroll(page, share, rows);
    expect(await verdict(context, `scrolled to ${share}, and ${rows} of a row`)).toEqual({ applies: true, found: [] });
  }

  // Sorted, where row names and positions part.
  await scroll(page, 0);
  await clickSort(page, 'id');
  await clickSort(page, 'id');
  expect(await verdict(context, 'sorted by id descending')).toEqual({ applies: true, found: [] });
  await scroll(page, 0.5);
  expect(await verdict(context, 'sorted, half way')).toEqual({ applies: true, found: [] });
  await scroll(page, 0);
  await clickSort(page, 'id');

  // Searched, fewer entries than the frame's rows.
  await page.getByRole('textbox', { name: 'Search data table' }).first().fill('r00');
  await page.waitForTimeout(2_500);
  expect(await verdict(context, 'searched for r00')).toEqual({ applies: true, found: [] });
  await scroll(page, 1);
  expect(await verdict(context, 'searched, at the bottom')).toEqual({ applies: true, found: [] });
  await page.getByRole('textbox', { name: 'Search data table' }).first().fill('');
  await page.waitForTimeout(2_500);
  expect(await verdict(context, 'search cleared, the control')).toEqual({ applies: true, found: [] });

  // Where it has nothing to compare.
  await menuEntry(app, page, [/^View$/, /^Move Focus to Console$/]);
  await page.keyboard.type('empty <- paged[0, ]; View(empty)');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4_000);
  expect(await verdict(context, 'a frame of no rows')).toEqual({ applies: false });
  // A viewer's tab is named for its icon too, as "CSV paged Close document tab".
  await page.getByRole('tablist', { name: 'Documents' }).getByRole('tab', { name: /\bpaged Close document tab$/ }).first().click();
  await page.waitForTimeout(2_500);
  expect(await verdict(context, 'paged selected again, the control')).toEqual({ applies: true, found: [] });

  // One way: the footer says one row further on.
  const footerEdited = await frameFor(page)?.evaluate(() => {
    let n = 0;
    for (const element of document.querySelectorAll<HTMLElement>('*')) {
      if (element.children.length === 0 && /^Showing 1 to 16 /.test(element.textContent ?? '')) {
        element.textContent = (element.textContent ?? '').replace('Showing 1 to 16 ', 'Showing 2 to 17 ');
        n += 1;
      }
    }
    return n;
  });
  expect(footerEdited, 'the footer was found').toBeGreaterThan(0);
  const footer = await verdict(context, 'contradiction: footer says 2 to 17');
  expect(JSON.stringify(footer.found)).toMatch(/says rows 2 to 17, and rows 1 to 16 are wholly in view/);

  // The other way: the footer put back, and the last row in view given another position.
  const gridEdited = await frameFor(page)?.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('*')) {
      if (element.children.length === 0 && /^Showing 2 to 17 /.test(element.textContent ?? '')) {
        element.textContent = (element.textContent ?? '').replace('Showing 2 to 17 ', 'Showing 1 to 16 ');
      }
    }
    const row = document.querySelector<HTMLElement>('#rsGridData tr[aria-rowindex="17"]');
    row?.setAttribute('aria-rowindex', '41');
    return Boolean(row);
  });
  expect(gridEdited, 'the row at position 16 was found').toBe(true);
  const grid = await verdict(context, 'contradiction: row 16 numbered 40');
  expect(JSON.stringify(grid.found)).toMatch(/says rows 1 to 16, and rows 1 to 40 are wholly in view/);
});

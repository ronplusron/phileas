import type { ElectronApplication, Frame, Page } from '@playwright/test';
import { clickMenuItem, createTest, expect, settle, type AppCheckContext } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';
import { dataViewerFooterColumnsInView as check } from '../phileas/checks/data-viewer/data-viewer-footer-columns-in-view';
import { shownViewer } from '../phileas/checks/data-viewer/viewer';
import { dataViewerWide } from '../phileas/fixes/data-viewer/data-viewer-wide';

/**
 * The test every check is to have (docs/HISTORY.md, 2026-10-16), for
 * `data-viewer-footer-columns-in-view`: on the screens it is written for it
 * applies and is quiet, where it has nothing to compare it does not apply,
 * and with the page made to contradict itself, each way, it fires. Written on
 * 2026-10-22.
 *
 * Starts from the `data-viewer-wide` Fix, run here outside a Route, as
 * `data-viewer-rows-check.spec.ts` does with `data-viewer-paged`. Each move
 * is followed by the engine's settle wait, as a Hop is, since the footer lags
 * a sideways scroll until the grid has drawn the new columns.
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
  return page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes('obj=wide&'));
}

/**
 * Moves the grid's viewport sideways to a share of its width, settles, then
 * across by a share of a column, and settles. Where a share lands depends on
 * where the grid was before, since its width changes with the columns the
 * page has fetched: 0.6 landed at column 301 from 181 and at 237 from 301.
 * So it returns where it landed: the leftmost column partly in view, by its
 * title, and how much of it shows.
 */
async function scroll(page: Page, share: number, columns = 0): Promise<string> {
  await frameFor(page)?.evaluate((share) => {
    const viewport = document.getElementById('gridViewport');
    if (viewport) viewport.scrollLeft = Math.round((viewport.scrollWidth - viewport.clientWidth) * share);
  }, share);
  await settle(page, 10_000);
  if (columns !== 0) {
    await frameFor(page)?.evaluate((columns) => {
      const viewport = document.getElementById('gridViewport');
      const column = document.querySelector<HTMLElement>('#rsGridData th[role="columnheader"]')?.getBoundingClientRect().width ?? 0;
      if (viewport) viewport.scrollLeft += Math.round(column * columns);
    }, columns);
    await settle(page, 10_000);
  }
  return (
    (await frameFor(page)
      ?.evaluate(() => {
        const view = document.getElementById('gridViewport')?.getBoundingClientRect();
        if (!view) return 'no viewport';
        for (const header of document.querySelectorAll<HTMLElement>('#rsGridData th[role="columnheader"]')) {
          const box = header.getBoundingClientRect();
          if (box.width === 0 || box.right <= view.left + 1) continue;
          const shows = (Math.min(box.right, view.right) - Math.max(box.left, view.left)) / box.width;
          return `${(header.getAttribute('title') ?? '').replace(/:.*/, '')} leftmost, ${shows.toFixed(2)} of it showing`;
        }
        return 'no column in view';
      })
      .catch(() => 'unreadable')) ?? 'no frame'
  );
}

/** Scrolls the grid 1 px right and back, which makes the footer work out its range again, and settles. */
async function nudge(page: Page): Promise<void> {
  for (const by of [1, -1]) {
    await frameFor(page)?.evaluate((by) => {
      const viewport = document.getElementById('gridViewport');
      if (viewport) viewport.scrollLeft += by;
    }, by);
    await page.waitForTimeout(500);
  }
  await settle(page, 10_000);
}

async function clickInViewer(page: Page, name: string): Promise<void> {
  await frameFor(page)?.getByRole('button', { name, exact: true }).first().click({ timeout: 5_000 });
  await settle(page, 10_000);
}

/** Sets the footer's "columns X to Y" to the range given, and returns the range it said before. */
async function sayColumns(page: Page, from: number, to: number): Promise<{ from: number; to: number } | undefined> {
  return frameFor(page)?.evaluate(
    ([from, to]) => {
      for (const element of document.querySelectorAll<HTMLElement>('*')) {
        const match = /columns ([\d,]+) to ([\d,]+) of/.exec(element.textContent ?? '');
        if (element.children.length === 0 && match?.[1] && match[2]) {
          element.textContent = (element.textContent ?? '').replace(match[0], `columns ${from} to ${to} of`);
          return { from: Number(match[1].replace(/,/g, '')), to: Number(match[2].replace(/,/g, '')) };
        }
      }
      return undefined;
    },
    [from, to] as const
  );
}

async function verdict(context: AppCheckContext, state: string): Promise<{ applies: boolean; found?: unknown }> {
  const applies = (await check.appliesWhen?.(context)) ?? true;
  const result = applies ? { applies, found: await check.run(context) } : { applies };
  // The footer of whichever viewer the Source pane shows, not always wide's.
  const shown = await shownViewer(context.page);
  const footer = await (shown?.frame.getByText(/^Showing /).first().innerText().catch(() => '') ?? Promise.resolve(''));
  const said = !applies ? 'does not apply' : Array.isArray(result.found) && result.found.length ? `FIRES: ${result.found.join('; ')}` : `applies, ${JSON.stringify(result.found)}`;
  process.stdout.write(`check: ${state.padEnd(44)} footer "${footer}" -> ${said}\n`);
  return result;
}

test('data-viewer-footer-columns-in-view applies, stays quiet, and fires on a contradiction each way', async ({ page, app }) => {
  test.setTimeout(10 * 60_000);
  const context = { page, app, tree: undefined };
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  expect(await verdict(context, 'nothing open')).toEqual({ applies: false });

  // The Fix, as a Route would run it.
  await dataViewerWide({
    page,
    app,
    step: async (step: { kind: 'act' } | { kind: 'code'; action: () => Promise<unknown> }) => {
      // The Fix's one act step is View > Move Focus to Console.
      if (step.kind === 'act') await menuEntry(app, page, [/^View$/, /^Move Focus to Console$/]);
      else await step.action();
    },
  } as unknown as Parameters<typeof dataViewerWide>[0]);
  await page.waitForTimeout(3_000);
  await settle(page, 10_000);
  expect(await verdict(context, 'wide, as opened')).toEqual({ applies: true, found: [] });

  // Sideways, past the ~200 columns the page fetches, and at part-column
  // offsets, where whether a column partly in view at either edge is named
  // depends on the footer's rounding.
  for (const [share, columns] of [
    [0.3, 0],
    [0.3, 0.5],
    [0.6, 0],
    [0.6, 0.3],
    [0.6, 0.7],
    [1, 0],
  ] as const) {
    const landed = await scroll(page, share, columns);
    expect(await verdict(context, `sideways ${share}+${columns}: ${landed}`)).toEqual({ applies: true, found: [] });
  }

  // The way a Route moves sideways: a "Scroll to column" button in the
  // sidebar, which builds only the dozen near its top.
  await scroll(page, 0);
  await clickInViewer(page, 'Scroll to column n010');
  expect(await verdict(context, 'sidebar: scroll to column n010')).toEqual({ applies: true, found: [] });

  // A column pinned, as opened, where the footer happens to stay right.
  await scroll(page, 0);
  await clickInViewer(page, 'Pin column n003');
  expect(await verdict(context, 'n003 pinned, at the start')).toEqual({ applies: true, found: [] });

  // RStudio's own: a second pin narrows the view again, and the footer is
  // not worked out again until the next scroll, as on route 8 of Journey
  // d67de3d75474, whose steps these are (probes/viewer-footer-columns-routes.spec.ts).
  // The check fires on it, and a 1 px scroll, which puts the footer right,
  // quiets it.
  await clickInViewer(page, 'Pin column n005');
  const stale = await verdict(context, "n005 pinned too: RStudio's stale footer");
  expect(stale.applies).toBe(true);
  expect(JSON.stringify(stale.found)).toMatch(/says columns 1 to 5, and names column 5, neither in view nor pinned/);
  await nudge(page);
  expect(await verdict(context, 'scrolled 1 px and back, the control')).toEqual({ applies: true, found: [] });
  await scroll(page, 0.5);
  expect(await verdict(context, 'two pinned, sideways to 0.5')).toEqual({ applies: true, found: [] });

  // A column hidden, where the footer counts what is left.
  await scroll(page, 0);
  await clickInViewer(page, 'Hide column n001');
  expect(await verdict(context, 'n001 hidden, two pinned, at the start')).toEqual({ applies: true, found: [] });
  await scroll(page, 0.3);
  expect(await verdict(context, 'n001 hidden, two pinned, sideways to 0.3')).toEqual({ applies: true, found: [] });

  // The view widened by closing the summary panel, as on route 6: the footer
  // names the column at the view's new edge before the grid draws it.
  await clickInViewer(page, 'Toggle column summary panel');
  expect(await verdict(context, 'summary panel closed, the view widened')).toEqual({ applies: true, found: [] });
  await scroll(page, 0.3);
  expect(await verdict(context, 'summary panel closed, sideways to 0.3')).toEqual({ applies: true, found: [] });

  // Where it has nothing to compare: a frame under ~200 columns, whose
  // footer says "120 total columns".
  await menuEntry(app, page, [/^View$/, /^Move Focus to Console$/]);
  await page.keyboard.type('narrow <- wide[, 1:120]; View(narrow)');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5_000);
  await settle(page, 10_000);
  expect(await verdict(context, 'narrow, 120 columns')).toEqual({ applies: false });
  // A viewer's tab is named for its icon too, as "CSV wide Close document tab".
  await page.getByRole('tablist', { name: 'Documents' }).getByRole('tab', { name: /\bwide Close document tab$/ }).first().click();
  await page.waitForTimeout(2_500);
  await settle(page, 10_000);
  expect(await verdict(context, 'wide selected again, the control')).toEqual({ applies: true, found: [] });

  // The contradictions below are made with n001 still hidden, so the footer
  // says "(1 hidden)" and one place it names may be neither in view nor pinned.

  // One way: the footer narrowed to its first column alone, leaving out the
  // columns wholly in view after it. Half a column across, so the last
  // column the footer names is drawn and partly in view, not one at the
  // view's very edge, which the check allows only as the footer's last.
  await scroll(page, 0.3, 0.5);
  const before = await sayColumns(page, 0, 0);
  expect(before, 'the footer was found').toBeDefined();
  const { from, to } = before as { from: number; to: number };
  await sayColumns(page, from, from);
  const narrowed = await verdict(context, `contradiction: footer says ${from} to ${from}`);
  expect(JSON.stringify(narrowed.found)).toMatch(new RegExp(`says columns ${from} to ${from}, and leaves out columns? [\\d to,]+, wholly in view`));

  // The other way: the footer widened past the view, by one column, which
  // the one hidden column allows, as the control, and then by two, which
  // it does not.
  await sayColumns(page, from, to + 1);
  expect(await verdict(context, `footer says ${from} to ${to + 1}, one hidden, the control`)).toEqual({ applies: true, found: [] });
  await sayColumns(page, from, to + 2);
  const widened = await verdict(context, `contradiction: footer says ${from} to ${to + 2}`);
  expect(JSON.stringify(widened.found)).toMatch(
    new RegExp(`says columns ${from} to ${to + 2}, and names columns ${to + 1} to ${to + 2}, neither in view nor pinned, where it says 1 is hidden`)
  );

  // And from the grid's side: the footer put back, and a column wholly in
  // view given place 999 in its title, far past what the footer names. The
  // place it no longer holds is the one the hidden column allows.
  await sayColumns(page, from, to);
  const retitled = await frameFor(page)?.evaluate(() => {
    const view = document.getElementById('gridViewport')?.getBoundingClientRect();
    for (const header of document.querySelectorAll<HTMLElement>('#rsGridData th[role="columnheader"]')) {
      const box = header.getBoundingClientRect();
      const at = /^column (\d+):/.exec(header.getAttribute('title') ?? '');
      if (view && at && box.left >= view.left && box.right <= view.right) {
        header.setAttribute('title', (header.getAttribute('title') ?? '').replace(at[0], 'column 999:'));
        return Number(at[1]);
      }
    }
    return 0;
  });
  expect(retitled, 'a column wholly in view was found').toBeGreaterThan(0);
  const grid = await verdict(context, `contradiction: column ${retitled} titled 999`);
  expect(JSON.stringify(grid.found)).toMatch(new RegExp(`says columns ${from} to ${to}, and leaves out column 999, wholly in view: `));
});

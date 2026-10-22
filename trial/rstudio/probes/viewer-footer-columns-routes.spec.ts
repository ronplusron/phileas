import type { ElectronApplication, Frame, Page } from '@playwright/test';
import { clickMenuItem, createTest, settle } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';
import { dataViewerFooterColumnsInView as check } from '../phileas/checks/data-viewer/data-viewer-footer-columns-in-view';
import { dataViewerWide } from '../phileas/fixes/data-viewer/data-viewer-wide';

/**
 * Why `data-viewer-footer-columns-in-view` failed 3 of 10 Routes of Journey
 * d67de3d75474 on 2026-10-22, its first Journey. Each Route's footer named
 * one column past those drawn, after a column was pinned or hidden:
 * - route 8: Pin column n003, Pin column n005; "columns 1 to 5", 5 not drawn.
 * - route 6: Hide column n005, Pin column n002, then the sidebar's "Toggle
 *   column summary panel"; "1 to 10 (1 hidden)", 6 hidden and 10 not drawn.
 * - route 9: Scroll to column n005, Hide column n007, then the main page's
 *   button "Summary"; "4 to 13 (1 hidden)", 8 hidden and 13 not drawn.
 *
 * Each is replayed here from the `data-viewer-wide` Fix in a launch of its
 * own, by those steps alone. After each step the page is read at once,
 * after the engine's settle wait, and 3 s later: the footer, the viewport's
 * box, and every header with its place from its title, its box, how much of
 * it shows, and whether it is pinned. Then the grid is scrolled 1 px right
 * and back, and read again, to tell a footer that is wrong from one that
 * was not recomputed after the grid's width changed. After the settle wait
 * the check itself is run too, to show what it says there.
 */
const test = createTest(rstudio);

function say(line: string): void {
  process.stdout.write(`probe footer routes: ${line}\n`);
}

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

async function openWide(page: Page, app: ElectronApplication): Promise<void> {
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await dataViewerWide({
    page,
    app,
    step: async (step: { kind: 'act' } | { kind: 'code'; action: () => Promise<unknown> }) => {
      if (step.kind === 'act') await menuEntry(app, page, [/^View$/, /^Move Focus to Console$/]);
      else await step.action();
    },
  } as unknown as Parameters<typeof dataViewerWide>[0]);
  await page.waitForTimeout(3_000);
  await settle(page, 10_000);
}

/** The footer, the viewport's box, and every header with a box, left to right. */
async function readout(page: Page): Promise<string[]> {
  const frame = frameFor(page);
  if (!frame) return ['no frame for wide'];
  return frame
    .evaluate(() => {
      const footer = [...document.querySelectorAll<HTMLElement>('*')].find((element) =>
        [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim().startsWith('Showing '))
      );
      const viewport = document.getElementById('gridViewport');
      const view = viewport?.getBoundingClientRect();
      const lines = [
        `footer "${(footer?.innerText ?? 'no footer').trim()}"`,
        `viewport ${Math.round(view?.left ?? 0)} to ${Math.round(view?.right ?? 0)}, clientWidth ${viewport?.clientWidth}, scrollLeft ${viewport?.scrollLeft}; frame window ${window.innerWidth}`,
      ];
      const headers = [...document.querySelectorAll<HTMLElement>('th[role="columnheader"]')]
        .map((header) => ({ header, box: header.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 && view && box.right > view.left - 200 && box.left < view.right + 200)
        .sort((a, b) => a.box.left - b.box.left);
      lines.push(
        'headers: ' +
          headers
            .map(({ header, box }) => {
              const place = (header.getAttribute('title') ?? '').replace(/:.*/, '').replace('column ', '');
              const pinned = header.closest('#pinnedTable') ? ' pinned' : '';
              const shows = view ? Math.max(0, Math.min(box.right, view.right) - Math.max(box.left, view.left)) / box.width : 0;
              return `${place}[${Math.round(box.left)}-${Math.round(box.right)} ${shows.toFixed(2)}${pinned}]`;
            })
            .join(' ')
      );
      return lines;
    })
    .catch((error: Error) => [`unreadable: ${error.message}`]);
}

async function readThrice(page: Page, after: string): Promise<void> {
  say(`--- after ${after}`);
  for (const line of await readout(page)) say(`  at once: ${line}`);
  await settle(page, 10_000);
  for (const line of await readout(page)) say(`  settled: ${line}`);
  const context = { page, app: undefined, tree: undefined } as unknown as Parameters<typeof check.run>[0];
  const applies = (await check.appliesWhen?.(context)) ?? true;
  say(`  check:   ${applies ? JSON.stringify(await check.run(context)) : 'does not apply'}`);
  await page.waitForTimeout(3_000);
  for (const line of await readout(page)) say(`  3 s on:  ${line}`);
}

async function nudge(page: Page): Promise<void> {
  for (const by of [1, -1]) {
    await frameFor(page)?.evaluate((by) => {
      const viewport = document.getElementById('gridViewport');
      if (viewport) viewport.scrollLeft += by;
    }, by);
    await page.waitForTimeout(500);
  }
  await settle(page, 10_000);
  for (const line of await readout(page)) say(`  nudged:  ${line}`);
}

async function inViewer(page: Page, name: string): Promise<void> {
  await frameFor(page)?.getByRole('button', { name, exact: true }).first().click({ timeout: 5_000 }).catch((error: Error) => say(`could not click "${name}": ${error.message.split('\n')[0]}`));
}

test('route 8: two columns pinned', async ({ page, app }) => {
  test.setTimeout(5 * 60_000);
  await openWide(page, app);
  await readThrice(page, 'the Fix');
  await inViewer(page, 'Pin column n003');
  await readThrice(page, 'Pin column n003');
  await inViewer(page, 'Pin column n005');
  await readThrice(page, 'Pin column n005');
  await nudge(page);
});

test('route 6: hidden, pinned, then the summary panel toggled', async ({ page, app }) => {
  test.setTimeout(5 * 60_000);
  await openWide(page, app);
  await inViewer(page, 'Hide column n005');
  await readThrice(page, 'Hide column n005');
  await inViewer(page, 'Pin column n002');
  await readThrice(page, 'Pin column n002');
  await inViewer(page, 'Toggle column summary panel');
  await readThrice(page, 'Toggle column summary panel');
  await nudge(page);
});

test('route 9: scrolled to n005, n007 hidden, then Summary', async ({ page, app }) => {
  test.setTimeout(5 * 60_000);
  await openWide(page, app);
  await inViewer(page, 'Scroll to column n005');
  await readThrice(page, 'Scroll to column n005');
  await inViewer(page, 'Hide column n007');
  await readThrice(page, 'Hide column n007');
  await page.getByRole('button', { name: 'Summary', exact: true }).first().click({ timeout: 5_000 }).catch((error: Error) => say(`could not click Summary: ${error.message.split('\n')[0]}`));
  await readThrice(page, 'Summary');
  await nudge(page);
});

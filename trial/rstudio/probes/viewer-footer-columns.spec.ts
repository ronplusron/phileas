import type { ElectronApplication, Frame, Page } from '@playwright/test';
import { clickMenuItem, createTest, settle } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * What a check of the footer's "columns X to Y of N" could compare it with,
 * before one is written. Written on 2026-10-22, after
 * `viewer-footer-range.spec.ts` left two things open: a header's
 * `data-col-idx` counts within the ~200 columns the page fetches, not across
 * the frame, and the footer lagged a sideways scroll by up to 500 ms.
 *
 * Builds `wide`, 1,000 rows by 450 columns, as that probe does, whose columns
 * are in a known order: `id`, `n001` to `n149`, `t001` to `t150` and `f001`
 * to `f150`. Then:
 * - **The sidebar's column list:** every "Scroll to column" button in the
 *   frame's document, in document order, shown or not, and whether that
 *   order is the frame's, as the known order says.
 * - **What a header carries:** every attribute of the first headers drawn,
 *   and of the grid's own elements, for anything giving a place in the whole.
 * - **When the footer catches up:** after each move, the footer and the
 *   headers wholly in view read every 50 ms for 1.5 s inside the page, with
 *   the time of each change. The moves are a sideways scroll of the grid's
 *   viewport, and a click on a sidebar "Scroll to column" button, which is
 *   the way a Route moves sideways.
 * - **After the engine's settle wait:** the same moves from the start again,
 *   then `settle`, as a Hop does, and the footer read once beside each header
 *   in view, with its place by the known order, by the sidebar's order, and
 *   its `data-col-idx`.
 * - **A pinned column:** n002 pinned, as opened and scrolled away from it.
 */
const test = createTest(rstudio);

function say(line: string): void {
  process.stdout.write(`probe footer columns: ${line}\n`);
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

/** The frame's columns in order, from how `wide` is built, not from the page. */
const KNOWN = [
  'id',
  ...Array.from({ length: 149 }, (_, i) => `n${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 150 }, (_, i) => `t${String(i + 1).padStart(3, '0')}`),
  ...Array.from({ length: 150 }, (_, i) => `f${String(i + 1).padStart(3, '0')}`),
];
const knownPlace = new Map(KNOWN.map((name, i) => [name, i + 1]));

/** A move, as a description the page acts on itself, so its timing starts in the page. */
type Move = { across: number } | { scrollTo: string };

const describe = (move: Move) => ('across' in move ? `viewport scrolled sideways to ${move.across}` : `sidebar "Scroll to column ${move.scrollTo}" clicked`);

/** Starts a move in the page and returns at once with what it did. */
async function start(frame: Frame, move: Move): Promise<string> {
  return frame
    .evaluate((move) => {
      const viewport = document.getElementById('gridViewport');
      if (!viewport) return 'no #gridViewport';
      if ('across' in move) {
        viewport.scrollLeft = Math.round((viewport.scrollWidth - viewport.clientWidth) * move.across);
        return `scrollLeft ${viewport.scrollLeft} of ${viewport.scrollWidth - viewport.clientWidth}`;
      }
      const name = `Scroll to column ${move.scrollTo}`;
      const button = [...document.querySelectorAll<HTMLElement>('button, [role="button"]')].find(
        (element) => (element.getAttribute('aria-label') ?? element.getAttribute('title') ?? element.textContent ?? '').trim() === name
      );
      if (!button) return `no button "${name}"`;
      button.click();
      return `clicked "${name}"`;
    }, move)
    .catch((error: Error) => `unreadable: ${error.message}`);
}

/** The footer and the first and last headers wholly in view, every 50 ms for a while, kept only where either changed. */
async function timeline(frame: Frame, forMs: number): Promise<{ ms: number; footer: string; whole: string }[]> {
  return frame
    .evaluate(async (forMs) => {
      const read = () => {
        const footer = [...document.querySelectorAll<HTMLElement>('*')].find((element) =>
          [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim().startsWith('Showing '))
        );
        const view = document.getElementById('gridViewport')?.getBoundingClientRect();
        const names = [...document.querySelectorAll<HTMLElement>('th[role="columnheader"]')]
          .map((cell) => ({ box: cell.getBoundingClientRect(), name: [...cell.querySelectorAll('span')].map((span) => (span.textContent ?? '').trim()).find(Boolean) ?? '' }))
          .filter(({ box }) => box.width > 0 && view && box.left >= view.left - 1 && box.right <= view.right + 1)
          .sort((a, b) => a.box.left - b.box.left)
          .map(({ name }) => name);
        return { footer: (footer?.innerText ?? 'no footer').trim(), whole: names.length ? `${names[0]} .. ${names[names.length - 1]} (${names.length})` : 'none' };
      };
      const began = performance.now();
      const seen: { ms: number; footer: string; whole: string }[] = [];
      while (performance.now() - began < forMs) {
        const now = read();
        const last = seen[seen.length - 1];
        if (!last || last.footer !== now.footer || last.whole !== now.whole) seen.push({ ms: Math.round(performance.now() - began), ...now });
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return seen;
    }, forMs)
    .catch(() => []);
}

/** The sidebar's "Scroll to column" names, in document order, shown or not. */
async function sidebarOrder(frame: Frame): Promise<{ names: string[]; nameFrom: string }> {
  return frame
    .evaluate(() => {
      const found: { name: string; from: string }[] = [];
      for (const element of document.querySelectorAll<HTMLElement>('button, [role="button"]')) {
        for (const [from, value] of [
          ['aria-label', element.getAttribute('aria-label')],
          ['title', element.getAttribute('title')],
          ['text', element.textContent],
        ] as const) {
          const text = (value ?? '').trim();
          if (text.startsWith('Scroll to column ')) {
            found.push({ name: text.slice('Scroll to column '.length), from });
            break;
          }
        }
      }
      return { names: found.map((f) => f.name), nameFrom: [...new Set(found.map((f) => f.from))].join(', ') };
    })
    .catch(() => ({ names: [], nameFrom: 'unreadable' }));
}

/** Every attribute of the first few headers drawn, and of the grid's own elements. */
async function attributes(frame: Frame): Promise<string[]> {
  return frame
    .evaluate(() => {
      const describe = (label: string, element: Element | null) =>
        element ? `${label}: ${[...element.attributes].map((a) => `${a.name}="${a.value.slice(0, 80)}"`).join(' ')}` : `${label}: absent`;
      const headers = [...document.querySelectorAll('th[role="columnheader"]')].slice(0, 3);
      return [
        ...headers.map((header, i) => describe(`header ${i + 1}`, header)),
        describe('#gridViewport', document.getElementById('gridViewport')),
        describe('#rsGridData', document.getElementById('rsGridData')),
        describe('#pinnedTable', document.getElementById('pinnedTable')),
        describe('table of #rsGridData', document.getElementById('rsGridData')?.closest('table') ?? null),
      ];
    })
    .catch((error: Error) => [`unreadable: ${error.message}`]);
}

/** The footer, and every header with some width, where it sits against the view, and what it carries. */
async function footerAndHeaders(frame: Frame): Promise<{ footer: string; headers: { name: string; where: string; colIndex: string | null; title: string; pinned: boolean }[] }> {
  return frame
    .evaluate(() => {
      const footer = [...document.querySelectorAll<HTMLElement>('*')].find((element) =>
        [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim().startsWith('Showing '))
      );
      const view = document.getElementById('gridViewport')?.getBoundingClientRect();
      const left = view?.left ?? 0;
      const right = view?.right ?? Infinity;
      const headers = [...document.querySelectorAll<HTMLElement>('th[role="columnheader"]')]
        .map((cell) => {
          const box = cell.getBoundingClientRect();
          const where = box.width === 0 ? 'no width' : box.left >= left - 1 && box.right <= right + 1 ? 'whole' : box.right > left + 1 && box.left < right - 1 ? 'part' : 'out';
          return {
            at: box.left,
            name: [...cell.querySelectorAll('span')].map((span) => (span.textContent ?? '').trim()).find(Boolean) ?? '',
            where,
            colIndex: cell.getAttribute('data-col-idx'),
            title: (cell.getAttribute('title') ?? '').replace(/:.*/, ''),
            pinned: Boolean(cell.closest('#pinnedTable')) || /pinned/.test(String(cell.className)),
          };
        })
        .filter((header) => header.where === 'whole' || header.where === 'part')
        .sort((a, b) => a.at - b.at)
        .map(({ at: _at, ...rest }) => rest);
      return { footer: (footer?.innerText ?? 'no footer').trim(), headers };
    })
    .catch(() => ({ footer: 'unreadable', headers: [] }));
}

async function backToStart(page: Page): Promise<void> {
  const frame = viewerFrame(page, 'wide');
  if (frame) await start(frame, { across: 0 });
  await page.waitForTimeout(1_500);
}

test("what the footer's columns can be compared with, and when it catches up", async ({ page, app }) => {
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
  const frame = () => viewerFrame(page, 'wide');
  if (!frame()) return say('no viewer frame for wide');

  // The sidebar's column list, against the known order.
  const sidebar = await sidebarOrder(frame() as Frame);
  const sameOrder = sidebar.names.length === KNOWN.length && sidebar.names.every((name, i) => name === KNOWN[i]);
  say(
    `sidebar: ${sidebar.names.length} "Scroll to column" buttons, named from ${sidebar.nameFrom}; first ${JSON.stringify(sidebar.names.slice(0, 3))}, last ${JSON.stringify(sidebar.names.slice(-3))}; the known order exactly: ${sameOrder}`
  );
  const firstDiffering = sidebar.names.findIndex((name, i) => name !== KNOWN[i]);
  if (firstDiffering >= 0) say(`first difference at ${firstDiffering + 1}: sidebar ${JSON.stringify(sidebar.names[firstDiffering])}, known ${JSON.stringify(KNOWN[firstDiffering])}`);
  const sidebarPlace = new Map(sidebar.names.map((name, i) => [name, i + 1]));

  for (const line of await attributes(frame() as Frame)) say(`attributes: ${line}`);

  const moves: Move[] = [{ across: 0.3 }, { across: 0.6 }, { across: 1 }, { scrollTo: 't100' }, { scrollTo: 'f120' }, { scrollTo: 'n010' }, { scrollTo: 'f150' }];

  // When the footer catches up, read in the page.
  for (const move of moves) {
    await backToStart(page);
    say(`--- timeline: ${describe(move)}: ${await start(frame() as Frame, move)}`);
    for (const point of await timeline(frame() as Frame, 1_500)) say(`  ${String(point.ms).padStart(5)} ms  "${point.footer}"  whole: ${point.whole}`);
  }

  // After the engine's settle wait, as a Hop reads it.
  for (const move of moves) {
    await backToStart(page);
    const did = await start(frame() as Frame, move);
    const settled = await settle(page, 10_000);
    const { footer, headers } = await footerAndHeaders(frame() as Frame);
    say(`--- after settle: ${describe(move)}: ${did}; settled ${settled.settled} in ${settled.ms} ms`);
    say(`  footer "${footer}"`);
    say(
      `  in view: ${headers
        .map((h) => `${h.name}[${h.where}${h.pinned ? ', pinned' : ''}; known ${knownPlace.get(h.name) ?? '?'}, sidebar ${sidebarPlace.get(h.name) ?? '?'}, col-idx ${h.colIndex}, title "${h.title}"]`)
        .join(' ')}`
    );
  }

  // A pinned column, as opened and scrolled away from it.
  await backToStart(page);
  await frame()?.getByRole('button', { name: 'Pin column n002' }).first().click({ timeout: 5_000 }).catch((error: Error) => say(`could not pin: ${error.message.split('\n')[0]}`));
  await page.waitForTimeout(2_000);
  for (const move of [{ across: 0 }, { across: 0.5 }] as Move[]) {
    const did = await start(frame() as Frame, move);
    await settle(page, 10_000);
    await page.waitForTimeout(1_000);
    const { footer, headers } = await footerAndHeaders(frame() as Frame);
    say(`--- n002 pinned, ${describe(move)}: ${did}`);
    const pinnedCells = await (frame() as Frame)
      .evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('th')]
          .filter((cell) => (cell.textContent ?? '').includes('n002'))
          .map((cell) => {
            const box = cell.getBoundingClientRect();
            const view = document.getElementById('gridViewport')?.getBoundingClientRect();
            const attributes = [...cell.attributes].map((a) => `${a.name}="${a.value.slice(0, 60)}"`).join(' ');
            return `<th ${attributes}> in ${cell.closest('table')?.id || 'a table with no id'}, box ${Math.round(box.left)} to ${Math.round(box.right)}, viewport ${Math.round(view?.left ?? 0)} to ${Math.round(view?.right ?? 0)}`;
          })
      )
      .catch((error: Error) => [`unreadable: ${error.message}`]);
    for (const line of pinnedCells) say(`  a th naming n002: ${line}`);
    say(`  footer "${footer}"`);
    say(`  in view: ${headers.map((h) => `${h.name}[${h.where}${h.pinned ? ', pinned' : ''}; known ${knownPlace.get(h.name) ?? '?'}, col-idx ${h.colIndex}, title "${h.title}"]`).join(' ')}`);
  }
});

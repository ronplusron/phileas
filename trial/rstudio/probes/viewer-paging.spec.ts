import fs from 'node:fs';
import path from 'node:path';
import type { ElectronApplication, Frame, Page } from '@playwright/test';
import { clickMenuItem, createExclusionTally, createTest, outOfSightCounts, survey } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * How RStudio's data viewer pages a frame too big to show at once, before any
 * check or Fix is written for it. Written on 2026-10-19: `mtcars`, 32 rows by
 * 11 columns, never pages. RStudio's User Guide says the viewer shows 50
 * columns at a time with "Cols >" arrows; that is unmeasured on any build
 * here.
 *
 * Builds `paged`, 1,000 rows by 120 columns, or as many columns as
 * PROBE_COLUMNS says, from sequences with no randomness, so every launch sees
 * the same data: an id, then numbers, text and factors in about equal
 * thirds. At 120, the first run on 2026-10-19 found no column paging; the
 * viewer's own address carries `max_display_columns=200`, so 450 asks
 * whether paging starts past 200. Views it, then prints at each state: the
 * Environment pane's row for it, the viewer's footer, the column headers
 * shown, every button in the viewer's frame whose name speaks of columns or
 * paging, the first and last row ids shown, and what a survey offers in the
 * frame and counts out of sight. The states: as opened; scrolled to the
 * bottom; and after each paging control found, if any.
 *
 * PROBE_OUT, when set, gets the frame's accessibility tree at each state, for
 * reading by hand.
 */
const test = createTest(rstudio);

const COLUMNS = Number(process.env.PROBE_COLUMNS ?? 120);
const OTHERS = COLUMNS - 1;
const NUMBERS = Math.floor(OTHERS / 3);
const TEXTS = Math.floor((OTHERS - NUMBERS) / 2);
const FACTORS = OTHERS - NUMBERS - TEXTS;
const WIDTH = Math.max(2, String(Math.max(NUMBERS, TEXTS, FACTORS)).length);
const BUILD =
  'paged <- data.frame(id = 1:1000, ' +
  `setNames(lapply(1:${NUMBERS}, function(j) (1:1000 * j) %% 997 / 10), sprintf("n%0${WIDTH}d", 1:${NUMBERS})), ` +
  `setNames(lapply(1:${TEXTS}, function(j) sprintf("r%04d-%d", 1:1000, j)), sprintf("t%0${WIDTH}d", 1:${TEXTS})), ` +
  `setNames(lapply(1:${FACTORS}, function(j) factor(letters[(1:1000 + j) %% 5 + 1])), sprintf("f%0${WIDTH}d", 1:${FACTORS})))`;

function say(line: string): void {
  process.stdout.write(`probe viewer paging: ${line}\n`);
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
  return page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes('obj=paged&'));
}

async function report(page: Page, app: ElectronApplication, state: string): Promise<void> {
  say(`--- ${state}`);
  const rows = await page
    .getByRole('tabpanel', { name: 'Environment' })
    .getByRole('row')
    .evaluateAll((all) => all.map((row) => (row.textContent ?? '').replace(/\s+/g, ' ').trim()).filter((text) => text.includes('paged')))
    .catch(() => []);
  say(`Environment: ${JSON.stringify(rows)}`);
  const frame = viewerFrame(page);
  if (!frame) {
    say('no viewer frame for paged');
    return;
  }
  const footer = await frame.getByText(/^Showing /).first().innerText().catch((error: Error) => `unreadable: ${error.message.split('\n')[0]}`);
  say(`footer: "${footer}"`);
  // Every element whose own text starts "Showing ", and whether it shows:
  // past 200 columns, on 2026-10-19, the tree held a footer reading "columns
  // 1 to 5 of 450" while the first match above read "450 total columns".
  const footers = await frame
    .evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('*')]
        .filter((element) => [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim().startsWith('Showing ')))
        .map((element) => {
          const box = element.getBoundingClientRect();
          return `${element.tagName.toLowerCase()}#${element.id}${box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden' ? ' shown' : ' not shown'}: "${(element.textContent ?? '').trim()}"`;
        })
    )
    .catch((error: Error) => [`unreadable: ${error.message}`]);
  say(`every footer: ${JSON.stringify(footers)}`);
  say(`frame address: ${frame.url().replace(/^http:\/\/127\.0\.0\.1:\d+/, '')}`);
  const grid = await frame
    .evaluate(() => {
      // Only headers in the grid's view: at 450 columns the page builds 200
      // header cells whatever shows, measured on 2026-10-19.
      const view = document.getElementById('gridViewport')?.getBoundingClientRect();
      const headers = [...document.querySelectorAll('[role="columnheader"]')]
        .filter((cell) => {
          const box = cell.getBoundingClientRect();
          return box.width > 0 && (!view || (box.right > view.left && box.left < view.right));
        })
        .map((cell) => (cell.textContent ?? '').trim())
        .filter(Boolean);
      const ids = [...document.querySelectorAll('[role="row"]')]
        .map((row) => (row.querySelector('[role="gridcell"]')?.textContent ?? '').trim())
        .filter((text) => /^\d+$/.test(text))
        .map(Number);
      return { headers, ids };
    })
    .catch(() => ({ headers: [] as string[], ids: [] as number[] }));
  say(
    `columns shown: ${grid.headers.length}, first ${JSON.stringify(grid.headers.slice(0, 3))}, last ${JSON.stringify(grid.headers.slice(-3))}; ` +
      `row ids shown: ${grid.ids.length}, from ${grid.ids[0]} to ${grid.ids.at(-1)}`
  );
  const controls = await frame
    .getByRole('button')
    .evaluateAll((all) =>
      all
        .map((button) => `${button.getAttribute('aria-label') ?? ''}|${(button.textContent ?? '').trim()}`)
        .filter((text) => /col|page|next|prev|<|>|»|«/i.test(text) && !/^(Scroll to|Toggle summary|Pin|Hide|Filter|Sort|Show and scroll) column /.test(text))
    )
    .catch(() => []);
  say(`paging-like buttons in the frame: ${JSON.stringify(controls)}`);
  const found = await survey({
    page,
    app,
    exclusions: rstudio.exclusions,
    hopIndex: 0,
    tally: createExclusionTally(rstudio.exclusions),
    timeoutMs: 5_000,
  }).catch((error: Error) => error.message.split('\n')[0]);
  if (typeof found === 'string' || found === undefined) say(`survey: ${found ?? 'no answer'}`);
  else {
    const framed = found.candidates.filter((candidate) => candidate.source === 'page' && candidate.frame);
    say(`survey: ${found.candidates.length} candidates, ${framed.length} in frames; out of sight ${JSON.stringify(outOfSightCounts(found.outOfSight))}`);
  }
  const out = process.env.PROBE_OUT;
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    const snapshot = await frame.locator('body').ariaSnapshot({ timeout: 10_000 }).catch((error: Error) => `unreadable: ${error.message}`);
    fs.writeFileSync(path.join(out, `${state.replace(/[^a-z0-9]+/gi, '-')}.yaml`), snapshot);
  }
}

test(`how the data viewer pages 1,000 rows by ${COLUMNS} columns`, async ({ page, app }) => {
  test.setTimeout(10 * 60_000);
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await menu(app, page, [/^View$/, /^Move Focus to Console$/]);
  await page.keyboard.type(BUILD);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3_000);
  await page.keyboard.type('View(paged)');
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: /paged/ }).first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(3_000);
  await report(page, app, 'as opened');

  // Scrolled to the bottom, in the grid's own scrolling container.
  const frame = viewerFrame(page);
  const scrolled = await frame
    ?.evaluate(() => {
      const scrollers = [...document.querySelectorAll<HTMLElement>('*')].filter(
        (element) => element.scrollHeight > element.clientHeight + 20 && getComputedStyle(element).overflowY !== 'visible'
      );
      for (const element of scrollers) element.scrollTop = element.scrollHeight;
      return scrollers.map((element) => `${element.tagName.toLowerCase()}#${element.id}.${String(element.className).slice(0, 30)}`);
    })
    .catch((error: Error) => `unreadable: ${error.message}`);
  say(`scrolled: ${JSON.stringify(scrolled)}`);
  await page.waitForTimeout(3_000);
  await report(page, app, 'scrolled to the bottom');

  // Sideways, in the grid's own viewport: halfway, then to the last column.
  // The first run, on 2026-10-19, found no column paging on 2026.11.0-daily+78:
  // 9 columns drawn of 120, and only vertical scrolling tried.
  for (const [label, share] of [
    ['scrolled sideways halfway', 0.5],
    ['scrolled sideways to the end', 1],
  ] as const) {
    const sideways = await viewerFrame(page)
      ?.evaluate((to) => {
        const viewport = document.getElementById('gridViewport');
        if (!viewport) return 'no #gridViewport';
        viewport.scrollLeft = Math.round((viewport.scrollWidth - viewport.clientWidth) * to);
        return `scrollLeft ${viewport.scrollLeft} of ${viewport.scrollWidth - viewport.clientWidth}`;
      }, share)
      .catch((error: Error) => `unreadable: ${error.message}`);
    say(`${label}: ${sideways}`);
    await page.waitForTimeout(3_000);
    await report(page, app, label);
  }

  // Each paging-like control the frame offers, clicked once in turn.
  const candidates = await viewerFrame(page)
    ?.getByRole('button')
    .evaluateAll((all) =>
      all
        .map((button) => button.getAttribute('aria-label') ?? (button.textContent ?? '').trim())
        .filter((name) => /cols?\b|page|next|prev|>|<|»|«/i.test(name) && !/ column /.test(name))
    )
    .catch(() => [] as string[]);
  for (const name of candidates ?? []) {
    const target = viewerFrame(page)?.getByRole('button', { name, exact: true }).first();
    if (!target) continue;
    say(`clicking "${name}"`);
    await target.click({ timeout: 5_000 }).catch((error: Error) => say(`could not click: ${error.message.split('\n')[0]}`));
    await page.waitForTimeout(3_000);
    await report(page, app, `after ${name}`);
  }
});

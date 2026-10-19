import type { ElectronApplication, Frame, Page } from '@playwright/test';
import { clickMenuItem, createTest, expect, type AppCheckContext } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';
import { dataViewerCountsMatchEnvironment as check } from '../phileas/checks/data-viewer/data-viewer-counts-match-environment';
import { dataViewerPaged } from '../phileas/fixes/data-viewer/data-viewer-paged';

/**
 * The test every check is to have (docs/HISTORY.md, 2026-10-16), for
 * `data-viewer-counts-match-environment`: on the screens it is written for it
 * applies and is quiet, where it has nothing to compare it does not apply,
 * and with the page made to contradict itself, each way, it fires. Written on
 * 2026-10-19.
 *
 * Starts from the `data-viewer-paged` Fix, run here outside a Route. Two
 * states are measured rather than asserted, since nothing says yet what they
 * should do: a column hidden, and `paged` changed in the console while the
 * viewer shows it.
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

async function inConsole(app: ElectronApplication, page: Page, line: string, settleMs = 3_000): Promise<void> {
  await menuEntry(app, page, [/^View$/, /^Move Focus to Console$/]);
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(settleMs);
}

function frameFor(page: Page, object: string): Frame | undefined {
  return page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes(`obj=${object}&`));
}

async function verdict(context: AppCheckContext, state: string, object = 'paged'): Promise<{ applies: boolean; found?: unknown }> {
  const applies = (await check.appliesWhen?.(context)) ?? true;
  const result = applies ? { applies, found: await check.run(context) } : { applies };
  const footer = await (frameFor(context.page, object)?.getByText(/^Showing /).first().innerText().catch(() => '') ?? Promise.resolve(''));
  const said = !applies ? 'does not apply' : Array.isArray(result.found) && result.found.length ? `FIRES: ${result.found.join('; ')}` : `applies, ${JSON.stringify(result.found)}`;
  process.stdout.write(`check: ${state.padEnd(42)} footer "${footer}" -> ${said}\n`);
  return result;
}

test('data-viewer-counts-match-environment applies, stays quiet, and fires on a contradiction each way', async ({ page, app }) => {
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
  expect(await verdict(context, 'paged, as opened')).toEqual({ applies: true, found: [] });

  await page.getByRole('textbox', { name: 'Search data table' }).first().fill('r0005');
  await page.waitForTimeout(2_500);
  expect(await verdict(context, 'searched for r0005')).toEqual({ applies: true, found: [] });
  await page.getByRole('textbox', { name: 'Search data table' }).first().fill('');
  await page.waitForTimeout(2_500);

  // Measured, not asserted: a column hidden.
  await frameFor(page, 'paged')?.getByRole('button', { name: 'Hide column n01' }).first().click().catch(() => undefined);
  await page.waitForTimeout(2_500);
  await verdict(context, 'measured: column n01 hidden');

  // Where it has nothing to compare.
  await page.getByRole('tab', { name: 'History' }).first().click();
  await page.waitForTimeout(1_500);
  expect(await verdict(context, 'History shown, Environment hidden')).toEqual({ applies: false });
  await page.getByRole('tab', { name: 'Environment' }).first().click();
  await page.waitForTimeout(1_500);
  await inConsole(app, page, 'View(mtcars)');
  expect(await verdict(context, 'mtcars, which Environment does not list')).toEqual({ applies: false });
  await page.getByRole('tablist', { name: 'Documents' }).getByRole('tab', { name: /paged/ }).first().click();
  await page.waitForTimeout(2_500);
  expect(await verdict(context, 'paged selected again, the control')).toMatchObject({ applies: true });

  // One way: the viewer's footer says one row fewer.
  await frameFor(page, 'paged')?.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('*')) {
      if (element.children.length === 0 && (element.textContent ?? '').startsWith('Showing ')) {
        element.textContent = (element.textContent ?? '').replace('of 1,000 entries', 'of 999 entries');
      }
    }
  });
  const rows = await verdict(context, 'contradiction: footer says 999 rows');
  expect(JSON.stringify(rows.found)).toMatch(/999 rows against the Environment pane's 1000/);

  // The other way: the Environment pane says one column fewer.
  await frameFor(page, 'paged')?.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>('*')) {
      if (element.children.length === 0 && (element.textContent ?? '').startsWith('Showing ')) {
        element.textContent = (element.textContent ?? '').replace('of 999 entries', 'of 1,000 entries');
      }
    }
  });
  const edited = await page.evaluate(() => {
    let n = 0;
    for (const element of document.querySelectorAll<HTMLElement>('[role="tabpanel"][aria-label="Environment"] *')) {
      if (element.children.length === 0 && element.textContent === '1000 obs. of 120 variables') {
        element.textContent = '1000 obs. of 119 variables';
        n += 1;
      }
    }
    return n;
  });
  expect(edited, "the Environment pane's count was found").toBeGreaterThan(0);
  const columns = await verdict(context, 'contradiction: Environment says 119 cols');
  expect(JSON.stringify(columns.found)).toMatch(/120 columns against the Environment pane's 119/);

  // Measured, not asserted: paged changed in the console while viewed.
  await inConsole(app, page, 'paged <- paged[1:500, ]', 4_000);
  await page.getByRole('tablist', { name: 'Documents' }).getByRole('tab', { name: /paged/ }).first().click();
  await page.waitForTimeout(3_000);
  await verdict(context, 'measured: paged cut to 500 rows');
});

/**
 * Past 200 columns the viewer's footer counts the columns in view, "columns 1
 * to 5 of 450", measured on 2026-10-19; the check read only "450 total
 * columns" and recorded such a frame as not run. `wide`, 1,000 rows by 450
 * columns, is built as the paging probe builds it at PROBE_COLUMNS=450.
 */
test('data-viewer-counts-match-environment reads a frame past 200 columns, and fires on it', async ({ page, app }) => {
  test.setTimeout(10 * 60_000);
  const context = { page, app, tree: undefined };
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
  const footer = frameFor(page, 'wide')?.getByText(/^Showing /).first();
  await expect(footer ?? page.locator('nothing'), 'the footer in its form past 200 columns').toHaveText(/columns \d+ to \d+ of 450/, { timeout: 10_000 });
  expect(await verdict(context, 'wide, as opened', 'wide')).toEqual({ applies: true, found: [] });

  // Sideways, where the footer's columns in view change and its total does not.
  await frameFor(page, 'wide')?.evaluate(() => {
    const viewport = document.getElementById('gridViewport');
    if (viewport) viewport.scrollLeft = viewport.scrollWidth;
  });
  await page.waitForTimeout(2_500);
  expect(await verdict(context, 'wide, scrolled to its last column', 'wide')).toEqual({ applies: true, found: [] });

  // A contradiction: the Environment pane made to say 449 columns.
  const edited = await page.evaluate(() => {
    let n = 0;
    for (const element of document.querySelectorAll<HTMLElement>('[role="tabpanel"][aria-label="Environment"] *')) {
      if (element.children.length === 0 && element.textContent === '1000 obs. of 450 variables') {
        element.textContent = '1000 obs. of 449 variables';
        n += 1;
      }
    }
    return n;
  });
  expect(edited, "the Environment pane's count was found").toBeGreaterThan(0);
  const wrong = await verdict(context, 'contradiction: Environment says 449 cols', 'wide');
  expect(JSON.stringify(wrong.found)).toMatch(/450 columns against the Environment pane's 449/);
});

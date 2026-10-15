import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenuItem, createTest } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * Whether each of the ten candidate checks in docs/OUTSTANDING.md 2.30 holds
 * on RStudio 2026.10.0, and whether both sides of it can be read. Written on
 * 2026-10-15, after `intent-screens.spec.ts` showed how each pane names what
 * it shows. It writes no check and asserts nothing about RStudio: each test
 * sets up the state its candidate reads, reads both sides, and prints them.
 * Where a candidate depends on how a pane follows a change, it reads before
 * and after the change, the before as the control.
 *
 * PROBE_OUT, when set, gets the snapshot of each dialog a test opens, for
 * reading by hand.
 */
const test = createTest(rstudio);

function say(n: number, line: string): void {
  process.stdout.write(`probe intent ${n}: ${line}\n`);
}

function keep(name: string, text: string): void {
  const out = process.env.PROBE_OUT;
  if (!out) return;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `${name}.yaml`), text);
}

async function ready(page: Page): Promise<void> {
  const prompt = page.getByRole('textbox', { name: 'Cursor at row 1' }).first();
  await prompt.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await prompt.click();
}

async function run(page: Page, line: string, settleMs = 1_500): Promise<void> {
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(settleMs);
}

/** The console's last output block, as its document reads. */
async function lastOutput(page: Page): Promise<string> {
  const blocks = page.getByRole('document', { name: 'Console Output' }).getByRole('document');
  return (await blocks.last().innerText()).replace(/\s+/g, ' ').trim();
}

/** The Environment pane's object rows, as the accessibility tree names them. */
async function environmentRows(page: Page): Promise<string[]> {
  const panel = page.getByRole('tabpanel', { name: 'Environment' });
  return panel.getByRole('row').evaluateAll((rows) =>
    rows.map((row) => (row.getAttribute('aria-label') ?? row.textContent ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  );
}

/** The menu's label paths, as Electron holds them, `&` markers kept. */
async function menuPaths(app: ElectronApplication): Promise<string[][]> {
  return app.evaluate(({ Menu }) => {
    const paths: string[][] = [];
    const walk = (items: Electron.MenuItem[], above: string[]) => {
      for (const item of items) {
        if (item.type === 'separator') continue;
        const here = [...above, item.label];
        if (item.submenu) walk(item.submenu.items, here);
        else paths.push(here);
      }
    };
    walk(Menu.getApplicationMenu()?.items ?? [], []);
    return paths;
  });
}

async function menu(app: ElectronApplication, page: Page, wanted: RegExp[]): Promise<string[]> {
  const plain = (label: string) => label.replace(/&/g, '');
  const found = (await menuPaths(app)).find(
    (labels) => labels.length === wanted.length && labels.every((label, i) => wanted[i]?.test(plain(label)))
  );
  if (!found) throw new Error(`no menu entry matches ${wanted.map(String).join(' > ')}`);
  await clickMenuItem(app, found, page);
  return found;
}

test('1. the Environment pane and the data viewer count the same rows and columns', async ({ page, app }) => {
  await ready(page);
  await run(page, 'df <- data.frame(id = 1:5, score = c(3.2, 4.1, 2.8, 5.0, 3.9), group = c("a", "b", "a", "b", "a"))');
  await run(page, 'cars2 <- mtcars');
  // `mtcars` itself is not in the global environment, so the pane lists it
  // nowhere: the case where the rule has nothing to compare.
  for (const object of ['df', 'cars2', 'mtcars']) {
    await menu(app, page, [/^View$/, /^Move Focus to Console$/]);
    await page.waitForTimeout(500);
    await run(page, `View(${object})`, 3_000);
    const rows = await environmentRows(page);
    say(1, `${object}: Environment rows ${JSON.stringify(rows.filter((row) => row.includes(object)))}`);
    // Each viewer has a frame of its own; its address names the object.
    say(1, `${object}: frames ${JSON.stringify(page.frames().map((frame) => `${frame.name()} ${frame.url().replace(/^http:\/\/127\.0\.0\.1:\d+/, '').slice(0, 60)}`))}`);
    const viewer = page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes(`obj=${object}&`));
    const footer = viewer
      ? await viewer.getByText(/^Showing /).first().innerText().catch((error: Error) => `unreadable: ${error.message.split('\n')[0]}`)
      : '(no viewer frame for it)';
    say(1, `${object}: viewer footer "${footer}"`);
    const tab = await page.getByRole('tablist', { name: 'Documents' }).getByRole('tab', { selected: true }).getAttribute('aria-label').catch(() => null);
    say(1, `${object}: selected document tab ${JSON.stringify((tab ?? (await page.getByRole('tablist', { name: 'Documents' }).getByRole('tab', { selected: true }).innerText())).trim())}`);
  }
  // Searched: the viewer's own count changes, the object's does not. On the
  // last viewer opened, `mtcars`.
  await page.getByRole('textbox', { name: 'Search data table' }).last().fill('Merc');
  await page.waitForTimeout(2_500);
  const searched = page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes('obj=mtcars&'));
  const filtered = searched ? await searched.getByText(/^Showing /).first().innerText().catch(() => 'unreadable') : '(no viewer frame)';
  say(1, `mtcars searched for "Merc": viewer footer "${filtered}"`);
});

test('2. a source tab marked unsaved matches Save, and saving clears both', async ({ page }) => {
  await ready(page);
  const documents = page.getByRole('tablist', { name: 'Documents' });
  const mainSave = page.getByRole('toolbar', { name: 'Main' }).getByRole('button', { name: 'Save current document (⌘S)' });
  const read = async (when: string) => {
    const tab = await documents.getByRole('tab', { selected: true }).innerText().catch(() => '(no tab)');
    say(2, `${when}: tab "${tab.replace(/\s+/g, ' ').trim()}", main Save ${(await mainSave.isDisabled()) ? 'disabled' : 'enabled'}`);
  };
  await read('no document open, the control');
  await run(page, 'file.edit("unsaved-mark.R")', 3_000);
  await read('opened, nothing typed');
  await page.keyboard.type('y <- 2');
  await page.waitForTimeout(1_500);
  await read('typed into');
  await page.keyboard.press('Meta+s');
  await page.waitForTimeout(2_000);
  await read('after ⌘S');
  await page.keyboard.type('\nz <- 3');
  await page.waitForTimeout(1_500);
  await read('typed into again');
  await run(page, '', 0);
  await page.getByRole('textbox', { name: 'Cursor at row 1' }).first().click();
  await run(page, 'cat(readLines("unsaved-mark.R"), sep = " | ")');
  say(2, `on disk, from R: ${await lastOutput(page)}`);
});

test('3. the Files pane lists what is on disk in the home', async ({ page }) => {
  await ready(page);
  await run(page, 'cat(normalizePath(getwd()))');
  const home = (await lastOutput(page)).replace(/^> cat\(normalizePath\(getwd\(\)\)\)\s*/, '');
  const listed = async () =>
    page
      .getByRole('tabpanel', { name: 'Files' })
      .getByRole('checkbox')
      .evaluateAll((boxes) => boxes.map((box) => box.getAttribute('aria-label') ?? '').filter((name) => name && name !== 'Select all files'));
  const disk = () => fs.readdirSync(home).sort();
  say(3, `home is a folder on disk: ${fs.existsSync(home)}`);
  say(3, `at start: pane ${JSON.stringify((await listed()).sort())}, disk ${JSON.stringify(disk())}`);
  await run(page, 'writeLines("written by R", "written-by-r.txt")', 3_000);
  say(3, `after R writes a file: pane ${JSON.stringify((await listed()).sort())}, disk ${JSON.stringify(disk())}`);
  fs.writeFileSync(path.join(home, 'written-from-outside.txt'), 'written from outside');
  await page.waitForTimeout(4_000);
  say(3, `after a file is written from outside, 4 s: pane ${JSON.stringify((await listed()).sort())}, disk ${JSON.stringify(disk())}`);
});

test('4. the Console path, the Files pane and getwd() agree', async ({ page }) => {
  await ready(page);
  const read = async (when: string) => {
    const consolePath = (await page.getByRole('toolbar', { name: 'Console Tab' }).innerText()).replace(/\s+/g, ' ').trim();
    const filesPath = await page
      .getByRole('tabpanel', { name: 'Files' })
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => (link.textContent ?? '').trim()));
    await page.getByRole('textbox', { name: 'Cursor at row 1' }).first().click();
    await run(page, 'cat(getwd())');
    say(4, `${when}: console toolbar "${consolePath}", Files path ${JSON.stringify(filesPath)}, ${await lastOutput(page)}`);
  };
  await read('at start');
  await run(page, 'dir.create("working-folder"); setwd("working-folder")', 2_500);
  await read('after setwd("working-folder") in the console');
});

test('5. each command run appears last in History, in order', async ({ page }) => {
  await ready(page);
  const lines = ['a1 <- 1', 'a2 <- 2', 'a3 <- a1 + a2'];
  for (const line of lines) await run(page, line);
  await page.getByRole('tab', { name: 'History' }).click();
  await page.waitForTimeout(1_500);
  const panel = page.getByRole('tabpanel', { name: 'History' });
  const rows = await panel.getByRole('row').allInnerTexts().catch(() => []);
  say(5, `History rows: ${JSON.stringify(rows.map((row) => row.replace(/\s+/g, ' ').trim()))}`);
  if (!rows.length) keep('05-history', await panel.ariaSnapshot().catch((error: Error) => `unreadable: ${error.message}`));
  await page.getByRole('textbox', { name: 'Cursor at row 1' }).first().click();
  await run(page, 'a4 <- 4');
  const after = await panel.getByRole('row').allInnerTexts().catch(() => []);
  say(5, `History rows after one more, History showing: ${JSON.stringify(after.map((row) => row.replace(/\s+/g, ' ').trim()))}`);
});

test('6. a pane zoomed, then Show All Panes, restores every pane', async ({ page, app }) => {
  await ready(page);
  const regions = async () =>
    page.getByRole('main', { name: 'Workbench' }).evaluate((main) =>
      [...main.querySelectorAll('[role="region"]')].map((region) => {
        const box = region.getBoundingClientRect();
        return `${region.getAttribute('aria-label')} ${Math.round(box.width)}x${Math.round(box.height)}`;
      })
    );
  say(6, `at start: ${JSON.stringify(await regions())}`);
  const panes = (await menuPaths(app)).filter((labels) => /Panes/.test(labels.join(' ')));
  say(6, `View > Panes entries: ${JSON.stringify(panes.map((labels) => labels.map((label) => label.replace(/&/g, '')).join(' > ')))}`);
  await menu(app, page, [/^View$/, /^Panes$/, /^Zoom Plots/]);
  await page.waitForTimeout(2_000);
  say(6, `after Zoom Plots: ${JSON.stringify(await regions())}`);
  await menu(app, page, [/^View$/, /^Panes$/, /^Show All Panes/]);
  await page.waitForTimeout(2_000);
  say(6, `after Show All Panes: ${JSON.stringify(await regions())}`);
});

test('7. a Global Options setting kept by OK and not by Cancel', async ({ page, app }) => {
  await ready(page);
  const open = async () => {
    await menu(app, page, [/^Tools$/, /^Global Options/]);
    const dialog = page.getByRole('dialog').first();
    await dialog.waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1_500);
    return dialog;
  };
  let dialog = await open();
  keep('07-global-options', await dialog.ariaSnapshot());
  const box = dialog.getByRole('checkbox').first();
  const name = (await box.getAttribute('aria-label')) ?? (await box.evaluate((node) => node.parentElement?.textContent ?? ''));
  say(7, `first checkbox "${name.trim()}", checked ${await box.isChecked()}`);
  const buttons = await dialog.getByRole('button').allInnerTexts();
  say(7, `dialog buttons: ${JSON.stringify(buttons.map((text) => text.trim()).filter(Boolean))}`);

  for (const close of ['Cancel', 'OK']) {
    const before = await dialog.getByRole('checkbox').first().isChecked();
    await dialog.getByRole('checkbox').first().click();
    const changed = await dialog.getByRole('checkbox').first().isChecked();
    await dialog.getByRole('button', { name: close, exact: true }).click();
    await page.waitForTimeout(2_000);
    dialog = await open();
    const reopened = await dialog.getByRole('checkbox').first().isChecked();
    say(7, `${close}: was ${before}, set to ${changed}, reopened ${reopened}`);
  }
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('8. Previous then Next returns to the same Help topic and the same plot', async ({ page }) => {
  await ready(page);
  const topic = async () => {
    const button = await page.getByRole('toolbar', { name: 'Help Tab Second' }).getByRole('button').first().innerText().catch(() => '(none)');
    const url = page.frames().find((frame) => frame.name() === 'rstudio_help_frame')?.url() ?? '(no frame)';
    return `"${button.trim()}" ${url.replace(/^http:\/\/127\.0\.0\.1:\d+/, '')}`;
  };
  const helpToolbar = page.getByRole('toolbar', { name: 'Help Tab' });
  await run(page, '?mean', 3_000);
  await run(page, '?median', 3_000);
  say(8, `Help after ?mean, ?median: ${await topic()}; Next ${(await helpToolbar.getByRole('button', { name: /^Next topic/ }).isDisabled()) ? 'disabled' : 'enabled'}`);
  await helpToolbar.getByRole('button', { name: /^Previous topic/ }).click();
  await page.waitForTimeout(2_000);
  say(8, `after Previous topic: ${await topic()}`);
  await helpToolbar.getByRole('button', { name: /^Next topic/ }).click();
  await page.waitForTimeout(2_000);
  say(8, `after Next topic: ${await topic()}`);
  await helpToolbar.getByRole('button', { name: /^Next topic/ }).click();
  await page.waitForTimeout(2_000);
  say(8, `after Next topic again, at the end: ${await topic()}`);

  const plot = async () => {
    const frame = page.frames().find((candidate) => candidate.name() === 'rstudio_plot_image_frame');
    return frame
      ? frame.evaluate(() => [...document.images].map((image) => image.src.replace(/^http:\/\/127\.0\.0\.1:\d+/, '')).join(' ') || `(no image; body "${document.body?.innerText.slice(0, 60)}")`).catch((error: Error) => `unreadable: ${error.message}`)
      : '(no frame)';
  };
  await page.getByRole('textbox', { name: 'Cursor at row 1' }).first().click();
  await run(page, 'plot(1:3)', 2_500);
  await run(page, 'plot(4:6)', 2_500);
  const plots = page.getByRole('toolbar', { name: 'Plots Pane' });
  say(8, `Plots after two plots: ${await plot()}`);
  await plots.getByRole('button', { name: /^Previous plot/ }).click();
  await page.waitForTimeout(2_000);
  say(8, `after Previous plot: ${await plot()}`);
  await plots.getByRole('button', { name: /^Next plot/ }).click();
  await page.waitForTimeout(2_000);
  say(8, `after Next plot: ${await plot()}`);
});

test('9. a column sorted ascending is in order, and its summary matches a separate R', async ({ page }) => {
  await ready(page);
  await run(page, 'View(mtcars)', 3_000);
  const viewer = page.frameLocator('#rstudio_data_viewer_frame');
  const mpg = async () =>
    viewer.getByRole('grid').evaluate((grid) => {
      const headers = [...grid.querySelectorAll('[role="columnheader"]')].map((cell) => (cell.textContent ?? '').trim());
      const at = headers.findIndex((name) => name.startsWith('mpg'));
      const rows = [...grid.querySelectorAll('[role="row"]')].slice(1);
      return { headers: headers.slice(0, 4), values: rows.map((row) => (row.querySelectorAll('[role="gridcell"]')[at]?.textContent ?? '').trim()).filter(Boolean) };
    });
  say(9, `before sorting: ${JSON.stringify(await mpg())}`);
  await viewer.getByRole('button', { name: 'Sort column mpg ascending' }).click();
  await page.waitForTimeout(2_000);
  const sorted = await mpg();
  const numbers = sorted.values.map(Number);
  const ordered = numbers.every((value, i) => i === 0 || (numbers[i - 1] ?? value) <= value);
  say(9, `after Sort column mpg ascending: ${numbers.length} values read, in order ${ordered}: ${JSON.stringify(sorted.values)}`);
  const sortButtons = await viewer.getByRole('button', { name: /^Sort column mpg/ }).evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')));
  say(9, `the mpg sort button now reads ${JSON.stringify(sortButtons)}`);

  await viewer.getByRole('button', { name: 'Toggle summary for column mpg' }).click();
  await page.waitForTimeout(1_500);
  const summary = await viewer.getByRole('listitem').filter({ hasText: 'mpg' }).first().innerText();
  say(9, `mpg's summary: "${summary.replace(/\s+/g, ' ').trim()}"`);
  const frame = page.frames().find((candidate) => candidate.name() === 'rstudio_data_viewer_frame');
  if (frame) keep('09-mpg-summary', await frame.locator('body').ariaSnapshot().catch((error: Error) => `unreadable: ${error.message}`));
  // The independent answer: a separate R, not RStudio's session.
  const separate = execFileSync('Rscript', ['-e', 'cat(mean(mtcars$mpg), median(mtcars$mpg), min(mtcars$mpg), max(mtcars$mpg))'], { encoding: 'utf8' });
  say(9, `a separate R: mean, median, min, max ${separate.trim()}`);
});

test('10. after Clear objects, the Environment pane is empty and ls() is too', async ({ page }) => {
  await ready(page);
  await run(page, 'b1 <- 1; b2 <- data.frame(q = 1:3)', 2_000);
  say(10, `before: Environment rows ${JSON.stringify(await environmentRows(page))}`);
  await page.getByRole('button', { name: 'Clear objects from the workspace' }).click();
  // An alertdialog, "Confirm Remove Objects", seen on the first run.
  const dialog = page.getByRole('alertdialog').first();
  await dialog.waitFor({ timeout: 10_000 });
  say(10, `dialog: "${(await dialog.innerText()).replace(/\s+/g, ' ').trim()}"`);
  await dialog.getByRole('button', { name: 'Yes', exact: true }).click();
  await page.waitForTimeout(2_500);
  say(10, `after Yes: Environment rows ${JSON.stringify(await environmentRows(page))}`);
  await page.getByRole('textbox', { name: 'Cursor at row 1' }).first().click();
  await run(page, 'cat(length(ls()))');
  say(10, `ls(): ${await lastOutput(page)}`);
});

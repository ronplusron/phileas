import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenuItem, createTest } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * What the main toolbar's Save follows on RStudio 2026.10.0, before the
 * check that an unsaved tab goes with Save enabled is written. Written on
 * 2026-10-16: `intent-candidates.spec.ts` measured that rule on one R script
 * alone, and a check after every Hop also meets a data viewer selected, a
 * clean document selected beside an unsaved one, Help or the console with
 * the focus, and a new untitled document.
 *
 * One launch walks through each of those states and prints, at each, every
 * document tab's text, which is selected, and whether the main toolbar's
 * Save and Save All, and a Save in the selected document's own toolbar, are
 * enabled. Nothing open at all is read first, as the control.
 */
const test = createTest(rstudio);

const SAVE = 'Save current document (⌘S)';
const SAVE_ALL = 'Save all open documents (⌥⌘S)';

function say(line: string): void {
  process.stdout.write(`probe save follows: ${line}\n`);
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

async function menu(app: ElectronApplication, page: Page, wanted: RegExp[]): Promise<void> {
  const plain = (label: string) => label.replace(/&/g, '');
  const found = (await menuPaths(app)).find(
    (labels) => labels.length === wanted.length && labels.every((label, i) => wanted[i]?.test(plain(label)))
  );
  if (!found) throw new Error(`no menu entry matches ${wanted.map(String).join(' > ')}`);
  await clickMenuItem(app, found, page);
  await page.waitForTimeout(800);
}

async function inConsole(app: ElectronApplication, page: Page, line: string, settleMs = 2_000): Promise<void> {
  await menu(app, page, [/^View$/, /^Move Focus to Console$/]);
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(settleMs);
}

async function selectTab(page: Page, name: RegExp): Promise<void> {
  await page.getByRole('tablist', { name: 'Documents' }).getByRole('tab', { name }).first().click();
  await page.waitForTimeout(1_500);
}

async function read(page: Page, state: string): Promise<void> {
  const documents = page.getByRole('tablist', { name: 'Documents' });
  const tabs = await documents
    .getByRole('tab')
    .evaluateAll((all) =>
      // innerText, the text that shows: textContent also holds a hidden
      // unsaved mark, and read every tab as unsaved on the first run.
      all.map((tab) => `${tab.getAttribute('aria-selected') === 'true' ? '[selected] ' : ''}"${(tab as HTMLElement).innerText.replace(/\s+/g, ' ').trim()}"`)
    )
    .catch(() => []);
  const main = page.getByRole('toolbar', { name: 'Main' });
  const state_ = async (button: ReturnType<Page['getByRole']>) =>
    (await button.count()) === 0 ? 'absent' : (await button.first().isDisabled()) ? 'disabled' : 'enabled';
  const mainSave = await state_(main.getByRole('button', { name: SAVE, exact: true }));
  const mainSaveAll = await state_(main.getByRole('button', { name: SAVE_ALL, exact: true }));
  // The selected document's own toolbar, where it has one: the tabpanel the
  // Source pane shows.
  const panel = page.getByRole('region', { name: 'Source' }).getByRole('tabpanel');
  const panelName = await panel.first().getAttribute('aria-label').catch(() => null);
  const panelSave = (await panel.count()) ? await state_(panel.first().getByRole('button', { name: SAVE, exact: true })) : 'no panel';
  const focused = await page.evaluate(() => {
    const element = document.activeElement;
    return element ? `${element.tagName.toLowerCase()}${element.getAttribute('aria-label') ? ` "${element.getAttribute('aria-label')}"` : ''}` : 'none';
  });
  say(`${state}: tabs ${tabs.join(' ') || '(none)'}; main Save ${mainSave}, Save All ${mainSaveAll}; panel ${JSON.stringify(panelName)} Save ${panelSave}; focus ${focused}`);
}

test('what the main Save follows', async ({ page, app }) => {
  test.setTimeout(10 * 60_000);
  await page.getByRole('textbox', { name: 'Cursor at row 1' }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await read(page, '1. nothing open, the control');

  await inConsole(app, page, 'df <- data.frame(id = 1:3)');
  await inConsole(app, page, 'file.edit("unsaved-mark.R")', 3_000);
  await page.keyboard.type('y <- 2');
  await page.waitForTimeout(1_500);
  await read(page, '2. one R script, unsaved, selected');

  await inConsole(app, page, 'View(df)', 3_000);
  await read(page, '3. a data viewer selected, the script unsaved behind it');

  await selectTab(page, /unsaved-mark\.R/);
  await page.keyboard.press('Meta+s');
  await page.waitForTimeout(2_000);
  await read(page, '4. the script saved, and selected');

  await selectTab(page, /\bdf\b/);
  await read(page, '5. the data viewer selected, the script saved behind it');

  await inConsole(app, page, 'file.edit("clean-script.R")', 3_000);
  await read(page, '6. a second script, clean, selected');
  await selectTab(page, /unsaved-mark\.R/);
  await page.keyboard.type('\nz <- 3');
  await page.waitForTimeout(1_500);
  await selectTab(page, /clean-script\.R/);
  await read(page, '7. the clean script selected, the first unsaved behind it');

  await inConsole(app, page, '?mean', 3_000);
  await read(page, '8. Help shown in its pane, the Source pane as in 7');

  await menu(app, page, [/^View$/, /^Move Focus to Console$/]);
  await read(page, '9. the console focused, the Source pane as in 7');

  await menu(app, page, [/^File$/, /^New File$/, /^R Script$/]);
  await page.waitForTimeout(2_000);
  await read(page, '10. a new untitled R script, nothing typed');
  await page.keyboard.type('w <- 4');
  await page.waitForTimeout(1_500);
  await read(page, '11. the untitled script typed into');
});

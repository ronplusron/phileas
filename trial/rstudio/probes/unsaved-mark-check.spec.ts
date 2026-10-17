import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenuItem, createTest, expect, type AppCheckContext } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';
import { unsavedMarkMatchesSave as check } from '../phileas/checks/source/unsaved-mark-matches-save';

/**
 * The test every check is to have, agreed on 2026-10-16 (docs/HISTORY.md),
 * for `unsaved-mark-matches-save`, on RStudio 2026.10.0: on the screens it is
 * written for it applies and is quiet, where nothing is open it does not
 * apply, and with the page made to contradict itself on purpose, each way,
 * it fires. No defect can be planted in RStudio, so the contradiction is
 * made in its page, as Positron's checks were shown to fire on 2026-09-27.
 * Written on 2026-10-16.
 *
 * The check is called directly, with the live page, as the engine calls it
 * after a step. It does not read the tree, so none is handed to it.
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
  const labels = paths.find((path) => path.length === wanted.length && path.every((label, i) => wanted[i]?.test(label.replace(/&/g, ''))));
  if (!labels) throw new Error(`no menu entry matches ${wanted.map(String).join(' > ')}`);
  await clickMenuItem(app, labels, page);
  await page.waitForTimeout(800);
}

async function inConsole(app: ElectronApplication, page: Page, line: string, settleMs = 2_500): Promise<void> {
  await menuEntry(app, page, [/^View$/, /^Move Focus to Console$/]);
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(settleMs);
}

/**
 * Ask the check as the engine does after a step, and print what it saw and
 * decided, so a run shows the check at work: the selected tab as it shows,
 * the main Save's state, whether the check applied, and what it found.
 * PHILEAS_HOP_DELAY_MS pauses after each, so a shown window can be watched.
 */
async function verdict(context: AppCheckContext, state: string): Promise<{ applies: boolean; found?: unknown }> {
  const applies = (await check.appliesWhen?.(context)) ?? true;
  const result = applies ? { applies, found: await check.run(context) } : { applies };
  const { page } = context;
  const tab = page.getByRole('tablist', { name: 'Documents' }).getByRole('tab', { selected: true }).first();
  const shown = (await tab.count()) ? `"${(await tab.innerText()).replace(/\s+/g, ' ').trim()}"` : '(none)';
  const save = page.getByRole('toolbar', { name: 'Main' }).getByRole('button', { name: 'Save current document (⌘S)', exact: true }).first();
  const saveState = (await save.isDisabled()) ? 'disabled' : 'enabled';
  const said = !applies
    ? 'does not apply'
    : Array.isArray(result.found) && result.found.length
      ? `FIRES: ${result.found.join('; ')}`
      : 'applies, quiet';
  process.stdout.write(`check: ${state.padEnd(44)} tab ${shown.padEnd(22)} Save ${saveState.padEnd(9)} -> ${said}\n`);
  const delay = Number(process.env.PHILEAS_HOP_DELAY_MS ?? 0);
  if (delay > 0) await page.waitForTimeout(delay);
  return result;
}

test('unsaved-mark-matches-save applies, stays quiet, and fires on a contradiction each way', async ({ page, app }) => {
  test.setTimeout(10 * 60_000);
  const context = { page, app, tree: undefined };
  await page.getByRole('textbox', { name: 'Cursor at row 1' }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);

  // The control for applying: with no document open, it has nothing to read.
  expect(await verdict(context, 'nothing open')).toEqual({ applies: false });

  await inConsole(app, page, 'file.edit("unsaved-mark.R")', 3_000);
  await page.keyboard.type('y <- 2');
  await page.waitForTimeout(1_500);
  expect(await verdict(context, 'an unsaved script'), 'an unsaved script').toEqual({ applies: true, found: [] });

  await page.keyboard.press('Meta+s');
  await page.waitForTimeout(2_000);
  expect(await verdict(context, 'the script saved'), 'the script saved').toEqual({ applies: true, found: [] });

  await inConsole(app, page, 'df <- data.frame(id = 1:3); View(df)', 3_000);
  expect(await verdict(context, 'a data viewer selected'), 'a data viewer selected').toEqual({ applies: true, found: [] });

  await menuEntry(app, page, [/^File$/, /^New File$/, /^R Script$/]);
  await page.waitForTimeout(2_000);
  expect(await verdict(context, 'a new Untitled document, nothing typed'), 'a new Untitled document, nothing typed').toEqual({ applies: true, found: [] });

  // One way: an unsaved document whose mark is hidden in the page, so the tab
  // reads clean while Save stays enabled.
  await page.getByRole('tablist', { name: 'Documents' }).getByRole('tab', { name: /unsaved-mark\.R/ }).first().click();
  await page.waitForTimeout(1_500);
  await page.keyboard.type('\nz <- 3');
  await page.waitForTimeout(1_500);
  const hidden = await page.evaluate(() => {
    const tab = document.querySelector('[role="tablist"][aria-label="Documents"] [role="tab"][aria-selected="true"]');
    let count = 0;
    for (const element of tab ? [...tab.querySelectorAll<HTMLElement>('*')] : []) {
      if (element.children.length === 0 && element.innerText.trim() === '*') {
        element.style.display = 'none';
        count += 1;
      }
    }
    return count;
  });
  expect(hidden, 'the mark to hide was found').toBeGreaterThan(0);
  const unmarked = await verdict(context, 'contradiction: unsaved, its mark hidden');
  expect(unmarked.applies).toBe(true);
  expect(JSON.stringify(unmarked.found)).toMatch(/is not marked unsaved, and the main toolbar's Save is enabled/);

  // The other way: the mark shown again, and Save disabled in the page.
  await page.evaluate(() => {
    const tab = document.querySelector('[role="tablist"][aria-label="Documents"] [role="tab"][aria-selected="true"]');
    for (const element of tab ? [...tab.querySelectorAll<HTMLElement>('*')] : []) element.style.removeProperty('display');
  });
  expect(await verdict(context, 'the mark shown again, the control'), 'the mark shown again, the control').toEqual({ applies: true, found: [] });
  const disabled = await page.evaluate(() => {
    const toolbar = document.querySelector('[role="toolbar"][aria-label="Main"]');
    const save = [...(toolbar?.querySelectorAll('[aria-label="Save current document (⌘S)"], [title="Save current document (⌘S)"]') ?? [])];
    for (const element of save) {
      element.setAttribute('aria-disabled', 'true');
      element.setAttribute('disabled', '');
    }
    return save.length;
  });
  expect(disabled, "the main toolbar's Save was found").toBeGreaterThan(0);
  const marked = await verdict(context, 'contradiction: unsaved, Save disabled');
  expect(JSON.stringify(marked.found)).toMatch(/is marked unsaved, and the main toolbar's Save is disabled/);
});

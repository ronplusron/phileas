import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { createTest } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * What RStudio 2026.10.0 shows for the ten candidate checks in
 * docs/OUTSTANDING.md 2.30, read before any of them is written, since every
 * detail there was from memory. Written on 2026-10-15.
 *
 * Sets up the state each candidate reads, a step at a time from the console,
 * and writes the accessibility snapshot of the page, and of each frame, after
 * each step into PROBE_OUT, one file per step. It judges nothing: the files
 * are read by hand to learn how each pane names what it shows. The start
 * screen is written first, as the control.
 */
const test = createTest(rstudio);

const out = process.env.PROBE_OUT;

function say(line: string): void {
  process.stdout.write(`probe intent screens: ${line}\n`);
}

async function dump(page: Page, step: string): Promise<void> {
  if (!out) throw new Error('PROBE_OUT is unset: name a folder for the snapshots.');
  fs.mkdirSync(out, { recursive: true });
  const parts: string[] = [];
  for (const frame of page.frames()) {
    const label = frame === page.mainFrame() ? 'page' : `frame ${frame.name() || '(no name)'} ${frame.url().slice(0, 80)}`;
    const snapshot = await frame.locator('body').ariaSnapshot({ timeout: 10_000 }).catch((error: Error) => `unreadable: ${error.message.split('\n')[0]}`);
    parts.push(`=== ${label}\n${snapshot}`);
  }
  const file = path.join(out, `${step}.yaml`);
  fs.writeFileSync(file, parts.join('\n\n'));
  say(`${step}: ${page.frames().length} frame(s), ${parts.join('').length} characters`);
}

async function run(page: Page, line: string, settleMs = 1_500): Promise<void> {
  await page.keyboard.type(line);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(settleMs);
}

test('the screens the ten candidates read', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const prompt = page.getByRole('textbox', { name: 'Cursor at row 1' }).first();
  await prompt.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2_000);
  await dump(page, '01-start');

  await prompt.click();
  await run(page, 'df <- data.frame(id = 1:5, score = c(3.2, 4.1, 2.8, 5.0, 3.9), group = c("a", "b", "a", "b", "a"))');
  await run(page, 'x <- 1:10');
  await run(page, 'getwd()');
  await run(page, 'writeLines("written by R", "listed-in-files.txt")');
  await dump(page, '02-objects-and-a-file');

  await run(page, 'View(df)', 3_000);
  await dump(page, '03-data-viewer');

  await prompt.click();
  await run(page, 'plot(1:3)', 2_500);
  await run(page, 'plot(4:6)', 2_500);
  await dump(page, '04-two-plots');

  await run(page, '?mean', 3_000);
  await run(page, '?median', 3_000);
  await dump(page, '05-help-two-topics');

  await run(page, 'file.edit("unsaved-mark.R")', 3_000);
  await page.keyboard.type('y <- 2');
  await page.waitForTimeout(1_500);
  await dump(page, '06-unsaved-script');
});

import type { ElectronApplication, Page } from '@playwright/test';
import { createExclusionTally, createTest, outOfSightCounts, survey } from '@drugstoresushi/phileas';
import { readFramed } from '../../../dist/frames.js';
import { rstudio } from '../phileas/adapter';

/**
 * Where a survey's time goes on RStudio's Help showing "Writing R
 * Extensions". Written on 2026-10-12: in the data-viewer run of that day,
 * Route 2 of seed 278f39f6a354 clicked that link in Help's home page, and
 * each survey after it took about 45 minutes, while its pool held no
 * control from the Help frame.
 *
 * Opens Help's home page with help.start(), clicks the link inside the Help
 * frame, then times, each capped: the frame-aware read, its frames, and a
 * whole survey. Help's home page itself is timed first, as the control.
 */
const test = createTest(rstudio);
const CAP_MS = 180_000;

function say(line: string): void {
  process.stdout.write(`probe help: ${line}\n`);
}

async function capped<T>(what: string, call: () => Promise<T>): Promise<T | undefined> {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race([
      call(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`still going after ${CAP_MS} ms`)), CAP_MS);
      }),
    ]);
    say(`${what}: ${Date.now() - started} ms`);
    return result;
  } catch (error) {
    say(`${what}: ${(error as Error).message.split('\n')[0]} (after ${Date.now() - started} ms)`);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function measure(page: Page, app: ElectronApplication, label: string): Promise<void> {
  say(`--- ${label}`);
  const read = await capped('readFramed, no timeout', () => readFramed(page));
  if (read) {
    say(`  frames read: ${read.frames.map((frame) => `[${frame.path.map((name) => name.label).join(' > ') || 'page'}]`).join(' ')}; unread ${JSON.stringify(read.unread)}`);
    say(`  snapshot size: ${JSON.stringify(read.snapshot).length} characters`);
  }
  for (const frame of page.frames()) {
    const links = await frame.locator('a').count().catch(() => -1);
    // A count apart from the survey's own test (R32): links whose box meets
    // the frame's view at all, by plain geometry.
    const inView = await frame
      .evaluate(() =>
        [...document.querySelectorAll('a')].filter((link) => {
          const box = link.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < window.innerHeight && box.left < window.innerWidth;
        }).map((link) => `${link.getAttribute('href') ?? '(no href)'} "${(link.textContent ?? '').trim().slice(0, 30)}"`)
      )
      .catch(() => undefined);
    const seen = Array.isArray(inView) ? inView : [];
    say(`  frame ${frame.url().slice(0, 80)}: ${links} <a> elements, ${seen.length} meeting its view${seen.length && seen.length < 5 ? `: ${seen.join(', ')}` : ''}`);
  }
  const found = await capped('survey, timeout 3 s per read', () =>
    survey({ page, app, exclusions: rstudio.exclusions, hopIndex: 0, tally: createExclusionTally(rstudio.exclusions), timeoutMs: 3_000 })
  );
  if (found) {
    const framed = found.candidates.filter((candidate) => candidate.source === 'page' && candidate.frame).length;
    say(`  survey: ${found.candidates.length} candidates, ${framed} in frames, ${found.excluded.length} excluded, ${found.covered.length} covered, ${found.hidden.length} hidden, ${found.outOfSight.length} out of sight, unread ${JSON.stringify(found.unreadFrames)}`);
    for (const entry of outOfSightCounts(found.outOfSight)) say(`  out of sight: ${JSON.stringify(entry)}`);
  }
}

test('a survey of Help on Writing R Extensions', async ({ page, app }) => {
  test.setTimeout(20 * 60_000);
  const prompt = page.getByRole('textbox', { name: 'Cursor at row 1' }).first();
  await prompt.waitFor({ timeout: 30_000 });
  await prompt.click();
  await page.keyboard.type('help.start()');
  await page.keyboard.press('Enter');
  const help = page.locator('#rstudio_help_frame').contentFrame();
  await help.getByRole('link', { name: 'Writing R Extensions' }).first().waitFor({ timeout: 30_000 });
  await measure(page, app, "Help's home page, the control");

  await help.getByRole('link', { name: 'Writing R Extensions' }).first().click();
  await help.getByRole('heading', { name: /Writing R Extensions/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2_000);
  await measure(page, app, 'Writing R Extensions');
});

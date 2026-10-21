import type { ElectronApplication, Frame, Page } from '@playwright/test';
import { clickMenuItem, createTest } from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';

/**
 * What a hidden window tells the page about itself, against the layout the
 * data viewer draws in it. Written on 2026-10-21 for an engine defect, a
 * hidden window laying the application out as no shown window does, fixed
 * the same day (docs/HISTORY.md, 2026-10-21): on 2026.11.0-daily+78 a hidden window that opened fitted to
 * the screen, at y 33, drew all 120 of `paged`'s columns and wrapped them,
 * and one that opened at y 0 drew 10, as every shown window did.
 *
 * In each launch it prints, from the main process, the window's bounds,
 * whether it is visible, and whether background throttling is on; and from
 * the page and the viewer's frame, the visibility state, how many animation
 * frames run in half a second, and whether an IntersectionObserver reports
 * the grid's first header cell in view. Then the layout: the first row's
 * height and how many cells it draws. Run hidden with `--repeat-each` to
 * meet both kinds of hidden launch, and once shown as the control.
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

function say(line: string): void {
  process.stdout.write(`probe hidden window: ${line}\n`);
}

/** What a document says of its own visibility, and whether frames and intersections are delivered. */
async function signals(target: Page | Frame, observed?: string): Promise<unknown> {
  return target
    .evaluate(async (selector) => {
      let frames = 0;
      const counting = (): void => {
        frames += 1;
        if (frames < 1_000) requestAnimationFrame(counting);
      };
      requestAnimationFrame(counting);
      const element = selector ? document.querySelector(selector) : document.body;
      const intersection = await new Promise<string>((resolve) => {
        if (!element) return resolve('no element to observe');
        const observer = new IntersectionObserver((entries) => {
          observer.disconnect();
          resolve(entries[0]?.isIntersecting ? 'in view' : 'reported not in view');
        });
        observer.observe(element);
        setTimeout(() => resolve('no callback within 500 ms'), 500);
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { visibilityState: document.visibilityState, hidden: document.hidden, hasFocus: document.hasFocus(), framesIn500ms: frames, intersection };
    }, observed ?? '')
    .catch((error: Error) => `unreadable: ${error.message.split('\n')[0]}`);
}

test('what a hidden window tells the page, against the layout drawn', async ({ page, app }) => {
  test.setTimeout(5 * 60_000);
  await page.getByRole('textbox', { name: /^Cursor at row \d+$/ }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  const main = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.webContents.getURL().startsWith('http'));
    return window
      ? {
          bounds: window.getBounds(),
          visible: window.isVisible(),
          minimized: window.isMinimized(),
          throttling: window.webContents.getBackgroundThrottling(),
        }
      : 'no window';
  });
  say(`main ${JSON.stringify(main)}`);

  // PROBE_SHOW_THEN_HIDE=1 shows the window inactive, which the engine's own
  // hiding answers by hiding it on its `show` event, as it does when a window
  // shows by itself: the state the fitted hidden launches were measured in.
  // PROBE_UNTHROTTLE=1 then turns the window's background throttling off.
  if (process.env.PROBE_SHOW_THEN_HIDE === '1' || process.env.PROBE_UNTHROTTLE === '1') {
    const done = await app.evaluate(({ BrowserWindow }, { showThenHide, unthrottle }) => {
      const window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.webContents.getURL().startsWith('http'));
      if (!window) return 'no window';
      if (showThenHide) window.showInactive();
      if (unthrottle) window.webContents.setBackgroundThrottling(false);
      return `showThenHide ${showThenHide}, unthrottle ${unthrottle}`;
    }, { showThenHide: process.env.PROBE_SHOW_THEN_HIDE === '1', unthrottle: process.env.PROBE_UNTHROTTLE === '1' });
    await page.waitForTimeout(1_500);
    const after = await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.webContents.getURL().startsWith('http'));
      return window ? { bounds: window.getBounds(), visible: window.isVisible(), throttling: window.webContents.getBackgroundThrottling() } : 'no window';
    });
    say(`set: ${done}; then main ${JSON.stringify(after)}`);
  }
  say(`page ${JSON.stringify(await signals(page))}`);

  await menuEntry(app, page, [/^View$/, /^Move Focus to Console$/]);
  await page.keyboard.type(
    'paged <- data.frame(id = 1:1000, ' +
      'setNames(lapply(1:39, function(j) (1:1000 * j) %% 997 / 10), sprintf("n%02d", 1:39)), ' +
      'setNames(lapply(1:40, function(j) sprintf("r%04d-%d", 1:1000, j)), sprintf("t%02d", 1:40)), ' +
      'setNames(lapply(1:40, function(j) factor(letters[(1:1000 + j) %% 5 + 1])), sprintf("f%02d", 1:40)))'
  );
  await page.keyboard.press('Enter');
  await page.getByText('1000 obs. of 120 variables').first().waitFor({ timeout: 15_000 });
  await page.keyboard.type('View(paged)');
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: /paged/ }).first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(3_000);

  const frame = page.frames().find((f) => f.url().includes('gridviewer.html') && f.url().includes('obj=paged&'));
  if (!frame) throw new Error('no viewer frame for paged');
  say(`viewer ${JSON.stringify(await signals(frame, 'th[role="columnheader"]'))}`);
  const layout = await frame.evaluate(() => {
    const row = document.querySelector<HTMLElement>('#rsGridData tr[aria-rowindex]');
    return { rowHeight: row?.getBoundingClientRect().height, cells: row?.querySelectorAll('td').length, frame: `${window.innerWidth}x${window.innerHeight}` };
  });
  say(`layout ${JSON.stringify(layout)}`);
});

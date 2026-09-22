import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import type { AppUnderTest } from './app-under-test';
import { resolveBundle } from './bundle';
import { stubOpenExternal, clearOpenExternal } from './external';

export interface LaunchedApp {
  app: ElectronApplication;
  stderr: string[];
  pageErrors: Error[];
  consoleErrors: string[];
}

export async function makeUserDataDir(cfg: AppUnderTest): Promise<string> {
  const slug = cfg.productName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return fs.promises.mkdtemp(path.join(os.tmpdir(), `${slug}-e2e-`));
}

/** Whether app windows should be visible on the desktop. Off unless E2E_SHOW is set. */
export function showWindows(): boolean {
  return Boolean(process.env.E2E_SHOW);
}

/**
 * Keep the app's windows off the screen for the run.
 *
 * Electron has no headless mode. It accepts --headless and silently ignores it:
 * the window still appears and the run takes exactly as long, which is worse
 * than rejecting the flag, because it looks like it worked. Measured, not
 * assumed.
 *
 * So this does it in two parts, because either alone leaves a gap:
 *
 *   1. Replace show() on the prototype, so nothing can reveal a window later.
 *      Apps that create a window hidden and reveal it on 'ready-to-show' (which
 *      this one does, and which is the right pattern) never draw at all.
 *   2. Hide whatever is already visible, for an app that shows its window
 *      immediately on creation. That one still flashes briefly; it just does not
 *      stay up.
 *
 * Set E2E_SHOW=1 to watch a run instead, which is genuinely useful when working
 * out why something fails.
 *
 * The show() replacement is a real intrusion into the app under test and worth
 * knowing about: a test that needs show() to actually work has to run with
 * E2E_SHOW set. Failure screenshots are unaffected, since page.screenshot goes
 * through the compositor over CDP and works fine on a hidden window.
 */
export async function hideWindows(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.prototype.show = function () {};
    for (const window of BrowserWindow.getAllWindows()) window.hide();
  });
}

/**
 * Launch the app with its state redirected somewhere disposable.
 *
 * --user-data-dir is what keeps a test run from writing over the real
 * window-state.json in ~/Library/Application Support. Without it, resizing a
 * window in a test changes the size the app opens at tomorrow.
 *
 * Launched once per worker, not once per test. See fixtures.ts for what that
 * buys, and resetApp below for what it costs.
 */
export async function launchApp(cfg: AppUnderTest, userDataDir: string): Promise<LaunchedApp> {
  // E2E_TARGET=source runs the working tree instead of the bundle. It exists for
  // the inner loop only, when repackaging between every edit is too slow to
  // bear. It is never the default, and the staleness guard does not apply to it,
  // so a green run in this mode says nothing about what ships.
  const target =
    process.env.E2E_TARGET === 'source'
      ? { args: [cfg.repoRoot] }
      : { executablePath: resolveBundle(cfg).executable, args: [] as string[] };

  const app = await electron.launch({
    ...target,
    args: [...target.args, `--user-data-dir=${userDataDir}`, ...(cfg.launchArgs ?? [])],
    timeout: 20_000,
  });

  // Before firstWindow(), which is the earliest the main process can be reached
  // and, for an app that defers display, before anything has been drawn.
  if (!showWindows()) await hideWindows(app);

  const launched: LaunchedApp = { app, stderr: [], pageErrors: [], consoleErrors: [] };

  app.process().stderr?.on('data', (chunk) => launched.stderr.push(String(chunk)));

  await stubOpenExternal(app);

  // Attached once, to the one page that lives for the whole worker. Reloading
  // between tests does not replace the Page object, so these listeners survive.
  // The arrays are emptied per test in resetApp instead.
  const page = await app.firstWindow();
  page.on('pageerror', (error) => launched.pageErrors.push(error));
  page.on('console', (message) => {
    if (message.type() === 'error') launched.consoleErrors.push(message.text());
  });

  return launched;
}

/**
 * Put the shared app back into the state a freshly launched one would be in.
 *
 * This is the price of reusing one process across a worker's tests. The app
 * keeps `filters`, `query` and `compare` in module-level state that no
 * navigation clears, which this suite's own browse and search specs pin as real
 * behaviour. Left alone, one test's leftover search term quietly narrows the
 * next test's library and fails an assertion that has nothing to do with the
 * bug.
 *
 * A reload is the honest reset: it re-runs the renderer's boot function and
 * rebuilds that state from scratch. Reaching in and setting fields back by hand
 * would work until someone adds a field and forgets this list.
 */
export async function resetApp(cfg: AppUnderTest, launched: LaunchedApp): Promise<Page> {
  const page = await launched.app.firstWindow();

  await page.reload();
  await cfg.waitForReady(page);

  // Main-process state outlives a renderer reload, so it gets cleared here.
  // Skipping this makes the second outbound-link assertion see the first test's
  // URL alongside its own.
  await clearOpenExternal(launched.app);

  launched.pageErrors.length = 0;
  launched.consoleErrors.length = 0;
  launched.stderr.length = 0;

  return page;
}

export async function closeApp(launched: LaunchedApp): Promise<void> {
  await launched.app.close();
}

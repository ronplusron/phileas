import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import type { AppUnderTest, UniversalCheck } from './app-under-test';
import { resolveBundle, assertBundleFresh, type GuardVerdict } from './bundle';
import { stubOpenExternal, clearOpenExternal } from './external';

/**
 * How the engine got into the application.
 *
 * 'electron' is Playwright's own Electron launch, which reaches the main
 * process as well as the renderer, and is what three builds in four allow.
 * 'debugging-port' is the fallback for a build that refuses it, and it reaches
 * only the part of the application that draws the screen.
 *
 * The fallback is not implemented. This type exists now because the reporting
 * around it does: a run under a lossy launch has to say which checks it could
 * not run, and a mechanism added afterwards would touch the launch layer and
 * the report together. Adding the second path later is then additive.
 */
export type LaunchPath = 'electron' | 'debugging-port';

/**
 * Checks that cannot run under a given launch path, which is constraint C1b.
 *
 * Under the debugging-port path the external-link stub records nothing and the
 * main-process half of "still responding" cannot run. Two further things are
 * lost that are not checks and so cannot appear here -- the menu offers no
 * candidates, and windows cannot be kept off the screen -- and they are
 * reported elsewhere rather than being missing from this map. An earlier
 * version of this comment listed all four, which invited a later reader to
 * "fix" the map by adding two names that are not UniversalCheck values.
 *
 * Each entry would otherwise read as a check that found nothing wrong, which
 * is the failure this exists to prevent.
 *
 * `as const` rather than a mutable Record: a consumer could otherwise assign
 * `UNAVAILABLE_UNDER['debugging-port'] = []` and turn exactly that failure
 * back on.
 */
export const UNAVAILABLE_UNDER = {
  electron: [],
  'debugging-port': ['no-navigation-away', 'still-responding'],
} as const satisfies Record<LaunchPath, readonly UniversalCheck[]>;

/**
 * A launched application, and what the way in allows it to carry.
 *
 * A union on the path rather than a flat record, because the two paths cannot
 * collect the same evidence. `stderr` comes from the application's own process,
 * which the debugging-port path never reaches: as a shared field it would be
 * present and permanently empty there, and a check reading it could not tell
 * "the application wrote nothing" from "this path cannot see what it wrote".
 * That is the failure UNAVAILABLE_UNDER exists to prevent, one level below
 * where it was stated.
 *
 * Absent rather than empty, so a check that needs it fails to compile instead
 * of reading clean. Done while the second path does not exist and there are no
 * consumers, which is the cheapest it will ever be.
 */
export type LaunchedApp = {
  app: ElectronApplication;
  /** What the staleness guard did, for the report (R23, C1a). */
  guard: GuardVerdict;
  pageErrors: Error[];
  consoleErrors: string[];
} & (
  | {
      /** Launched as a process, so everything the engine can collect is here. */
      path: 'electron';
      /** The application's own standard error. */
      stderr: string[];
    }
  | {
      /** Attached over the debugging protocol, which reaches no process. */
      path: 'debugging-port';
    }
);

export async function makeUserDataDir(cfg: AppUnderTest): Promise<string> {
  // productName is optional now, so the slug falls back rather than throwing on
  // an application that declares no name anywhere. The directory is temporary
  // and its name is a convenience for whoever reads `ls /tmp`, nothing more.
  const slug = (cfg.productName ?? 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return fs.promises.mkdtemp(path.join(os.tmpdir(), `phileas-${slug}-`));
}

/**
 * Whether application windows should be visible on the desktop.
 *
 * Off unless PHILEAS_SHOW is set. A Journey runs unattended (C5), and this is
 * for watching one when working out why something failed.
 */
export function showWindows(): boolean {
  return Boolean(process.env.PHILEAS_SHOW);
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
 *      Apps that create a window hidden and reveal it on 'ready-to-show',
 *      which is the common pattern and the right one, never draw at all.
 *   2. Hide whatever is already visible, for an app that shows its window
 *      immediately on creation. That one still flashes briefly; it just does not
 *      stay up.
 *
 * Set PHILEAS_SHOW=1 to watch a run instead, which is genuinely useful when
 * working out why something fails.
 *
 * The show() replacement is a real intrusion into the app under test and worth
 * knowing about: a check that needs show() to actually work has to run with
 * PHILEAS_SHOW set. Failure screenshots are unaffected, since page.screenshot
 * goes through the compositor over CDP and works fine on a hidden window.
 */
export async function hideWindows(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.prototype.show = function () {};
    for (const window of BrowserWindow.getAllWindows()) window.hide();
  });
}

/**
 * Launch the application with its state redirected somewhere disposable.
 *
 * --user-data-dir is what keeps a run from writing over the application's real
 * user data, wherever the platform puts it. Without it, resizing a window
 * during a Route changes the size the application opens at tomorrow.
 *
 * Launched once per Route, not once per worker. A Route that began from state
 * the previous Route left behind is exactly the inheritance R3 forbids, and a
 * leak there would be reported against the wrong Route.
 *
 * Source mode is deliberately gone. The lifted code could run the working tree
 * instead of the bundle, for an inner loop where repackaging was too slow; the
 * staleness guard does not apply to it, so a green run in that mode says
 * nothing about what ships, which is what C1 exists to prevent.
 */
export async function launchApp(cfg: AppUnderTest, userDataDir: string): Promise<LaunchedApp> {
  const bundle = resolveBundle(cfg);
  const guard = assertBundleFresh(cfg, bundle.asarPath);

  // Settings that decide whether automation is possible at all have to be on
  // disk before the process starts, not after it.
  await cfg.beforeLaunch?.(userDataDir);

  // An adapter's own --user-data-dir would be appended after the engine's, and
  // which one Chromium honors is not something this should rest on. The
  // guarantee above is that a Journey never writes over the application's real
  // state, and an argument list is not the place to negotiate it.
  const ownUserDataDir = (cfg.launchArgs ?? []).find((arg) => arg.startsWith('--user-data-dir'));
  if (ownUserDataDir) {
    throw new Error(
      `launchArgs sets ${ownUserDataDir}, which the engine supplies itself so that a run ` +
        `cannot write over the application's real user data. Remove it from launchArgs.`
    );
  }

  const app = await electron.launch({
    executablePath: bundle.executable,
    args: [`--user-data-dir=${userDataDir}`, ...(cfg.launchArgs ?? [])],
    env: { ...process.env, ...(cfg.env ?? {}) } as Record<string, string>,
    timeout: 20_000,
  });

  // Before firstWindow(), which is the earliest the main process can be reached
  // and, for an app that defers display, before anything has been drawn.
  if (!showWindows()) await hideWindows(app);

  const launched: LaunchedApp = {
    app,
    path: 'electron',
    guard,
    stderr: [],
    pageErrors: [],
    consoleErrors: [],
  };

  app.process().stderr?.on('data', (chunk) => launched.stderr.push(String(chunk)));

  await stubOpenExternal(app);

  // Which page is the application, rather than which window appeared first: an
  // application with a splash has more than one, and firstWindow() would hand
  // back the splash.
  const page = cfg.selectPage ? await cfg.selectPage(app) : await app.firstWindow();
  page.on('pageerror', (error) => launched.pageErrors.push(error));
  page.on('console', (message) => {
    if (message.type() === 'error') launched.consoleErrors.push(message.text());
  });

  return launched;
}

/**
 * Reload the renderer and clear what the engine collected.
 *
 * NOT the per-Route reset, and deliberately not exported as one. A reload
 * rebuilds renderer state and leaves main-process state exactly where it was,
 * so a Route beginning this way would inherit whatever the previous Route left
 * in the main process. That is the inheritance R3 forbids, and a leak there
 * would be reported against the Route that found it rather than the Route that
 * caused it. launchApp is the per-Route reset.
 *
 * Kept for the one case that can show a reload reaches its initial state, and
 * for an inner loop where relaunching is too slow to bear. The lifted comments
 * measured the saving at roughly half a second per test.
 */
export async function reloadRenderer(cfg: AppUnderTest, launched: LaunchedApp): Promise<Page> {
  const page = cfg.selectPage ? await cfg.selectPage(launched.app) : await launched.app.firstWindow();

  await page.reload();
  await cfg.waitForReady(page);

  // Main-process state outlives a renderer reload, so it gets cleared here.
  // Skipping this leaves one pass's recorded URLs visible to the next.
  await clearOpenExternal(launched.app);

  launched.pageErrors.length = 0;
  launched.consoleErrors.length = 0;
  if (launched.path === 'electron') launched.stderr.length = 0;

  return page;
}

/**
 * Close the application.
 *
 * An application-specific shutdown runs first where one is supplied, because
 * closing the connection does not always terminate the process. At one launch
 * per Route, a shutdown that leaks costs one stray process per Route rather
 * than one per run.
 */
export async function closeApp(cfg: AppUnderTest, launched: LaunchedApp): Promise<void> {
  if (cfg.shutdown) await cfg.shutdown(launched.app);
  await launched.app.close();
}

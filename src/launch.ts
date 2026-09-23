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

/** The variable an adapter reads the application's checkout from. */
export const APP_DIR_VARIABLE = 'PHILEAS_APP_DIR';

/**
 * The application's checkout, for an adapter that lives outside it.
 *
 * One name for every adapter, rather than one each. The deployment shape the
 * project settled on is adapters in a repository of their own, pointed at a
 * checkout of the application that someone built, and in that shape where the
 * checkout sits is the one fact that differs from machine to machine. Left to
 * each adapter, every application came with its own variable to discover and
 * document, and the command to run a Journey looked different for each. A run
 * tests one application at a time, so one variable is enough.
 *
 * Kept out of the adapter's own file because a committed path names someone's
 * folders, and it would be wrong on every other machine anyway.
 *
 * An adapter that lives inside the application's own repository does not need
 * this: it finds the application relative to itself, as `buggy`'s does.
 *
 * **Refuses rather than guessing**, for R24. Unset, the adapter would otherwise
 * build a path out of nothing and the run would fail later, somewhere that says
 * nothing about why. So an unset variable, or one naming something that is not
 * a folder, is reported here, by name, with what to set it to.
 */
export function requireAppDir(): string {
  const raw = process.env[APP_DIR_VARIABLE];
  if (!raw || raw.trim() === '') {
    throw new Error(
      `${APP_DIR_VARIABLE} is not set. This adapter lives outside the application it tests, ` +
        `and reads where that application's checkout is from ${APP_DIR_VARIABLE}. Set it to ` +
        `the folder holding the checkout you built.`
    );
  }

  const dir = path.resolve(raw);
  let isFolder = false;
  try {
    isFolder = fs.statSync(dir).isDirectory();
  } catch {
    isFolder = false;
  }
  if (!isFolder) {
    throw new Error(
      `${APP_DIR_VARIABLE} is ${JSON.stringify(raw)}, which is not a folder` +
        (dir === raw ? '' : ` (resolved to ${dir})`) +
        `. Set it to the folder holding the application's checkout.`
    );
  }
  return dir;
}

/**
 * What the run does with the application's windows.
 *
 * Four values rather than a switch, because "visible" turned out to be three
 * different things and only one of them is what watching a run needs.
 *
 * Measured on 2026-09-22, which is why the middle two exist: showing a window
 * does not ACTIVATE the application. A GUI process launched from a terminal
 * does not become frontmost on macOS, so the window is drawn correctly, at a
 * sensible size, in the middle of the display, and sits behind whatever the
 * viewer is actually looking at. If that frontmost application is full-screen
 * in its own Space, the window does not appear to the viewer at all. Reported
 * from inside the process every reading said the window was fine, which is
 * exactly the shape of failure this project keeps meeting.
 */
export type WindowMode =
  /** Off the screen entirely. The default, and what an unattended run uses. */
  | 'hidden'
  /**
   * On the screen, behind whatever is frontmost.
   *
   * The useful default for watching, because the run does not take the screen
   * away from you: the window is there to be selected when you want it.
   */
  | 'back'
  /** On the screen and activated, so it comes forward and can be left. */
  | 'front'
  /**
   * On the screen, activated, and kept above every other window.
   *
   * Deliberately last and deliberately awkward. This is what a viewer cannot
   * get away from: it was measured by trapping one, and it earns its place only
   * for a run somebody is watching on purpose and wants nothing to cover.
   */
  | 'top';

/** The variable the mode is read from. Named because the message quotes it. */
export const WINDOW_MODE_VARIABLE = 'PHILEAS_SHOW';

/**
 * Read the window mode for this run.
 *
 * **An unrecognized value is refused rather than treated as hidden.** A
 * mistyped mode quietly meaning "off the screen" would look exactly like a run
 * somebody asked to watch and then could not see, and they would spend the
 * afternoon looking for the window rather than at the spelling.
 *
 * `1` still means what it always meant, which is `back`. Nothing written
 * against the older switch changes behavior.
 */
export function windowMode(): WindowMode {
  const raw = (process.env[WINDOW_MODE_VARIABLE] ?? '').trim().toLowerCase();

  if (raw === '' || raw === '0' || raw === 'hidden') return 'hidden';
  if (raw === '1' || raw === 'back') return 'back';
  if (raw === 'front') return 'front';
  if (raw === 'top') return 'top';

  throw new Error(
    `${WINDOW_MODE_VARIABLE}=${JSON.stringify(process.env[WINDOW_MODE_VARIABLE])} is not a ` +
      `window mode. Use hidden (or 0, or leave it unset) to keep windows off the screen, ` +
      `back (or 1) to show them behind whatever is frontmost, front to show and activate ` +
      `them, or top to show, activate and keep them above everything else.`
  );
}

/**
 * Whether application windows should be visible on the desktop.
 *
 * A Journey runs unattended (C5), and every mode but the default is for
 * watching one when working out why something failed.
 */
export function showWindows(): boolean {
  return windowMode() !== 'hidden';
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
 * Do whatever the mode asks before any window has been drawn.
 *
 * Called before `firstWindow()`, which is the earliest the main process can be
 * reached and, for an application that defers display, before anything is on
 * the screen. `top` is handled here rather than after the fact because a window
 * created later has to get the same treatment, and replacing `show` is the only
 * hook that reaches one.
 */
export async function prepareWindows(app: ElectronApplication, mode: WindowMode): Promise<void> {
  if (mode === 'hidden') {
    await hideWindows(app);
    return;
  }

  if (mode === 'top') {
    await app.evaluate(({ BrowserWindow }) => {
      const show = BrowserWindow.prototype.show;
      BrowserWindow.prototype.show = function (this: Electron.BrowserWindow) {
        show.call(this);
        this.setAlwaysOnTop(true);
      };
      for (const window of BrowserWindow.getAllWindows()) window.setAlwaysOnTop(true);
    });
  }
}

/**
 * Bring the application forward, for the modes that ask for it.
 *
 * Separate from `prepareWindows` because of an ordering constraint rather than
 * for tidiness: hiding has to happen before a window is drawn, and activating
 * has to happen after one exists. One function would have to be wrong about one
 * of them.
 *
 * `focus({ steal: true })` is what the plain `focus()` is not. A process
 * launched from a terminal is not the active application, and asking politely
 * leaves it where it is, which is the measured behavior this whole mode exists
 * to correct.
 *
 * **A Route launches its own application**, so a Journey of five Routes takes
 * the screen five times rather than once. That is inherent in the Route being
 * the test and is worth knowing before starting a long one in `front`.
 */
export async function activateWindows(app: ElectronApplication, mode: WindowMode): Promise<void> {
  if (mode !== 'front' && mode !== 'top') return;

  await app.evaluate(({ app: electronApp, BrowserWindow }) => {
    electronApp.focus({ steal: true });
    BrowserWindow.getAllWindows()[0]?.focus();
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

  const mode = windowMode();

  // Before firstWindow(), which is the earliest the main process can be reached
  // and, for an app that defers display, before anything has been drawn.
  await prepareWindows(app, mode);

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

  // After a window exists, which is what activation needs and hiding could not
  // wait for.
  await activateWindows(app, mode);

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

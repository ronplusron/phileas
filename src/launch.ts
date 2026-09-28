import fs from 'node:fs';
import path from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import type { AppUnderTest, UniversalCheck } from './app-under-test';
import { resolveBundle, assertBundleFresh, type GuardVerdict } from './bundle';
import { stubOpenExternal, clearOpenExternal } from './external';
import { stubNativeDialogs } from './dialogs';

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
 * Nothing consults it yet: the debugging-port path it describes is not built,
 * and when it is, the watch has to be handed the path and read this.
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
 * of reading clean. Done while the second path does not exist, which is the
 * cheapest it will ever be.
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

/**
 * The variable that hands every Route its run's own folder in the system temp
 * folder, set once by `startTempFolder` in start.ts, like the run's name.
 */
export const TEMP_FOLDER_VARIABLE = 'PHILEAS_TEMP_FOLDER';

/**
 * An application's name as the engine's folder names carry it. productName is
 * optional, so it falls back rather than throwing on an application that
 * declares no name anywhere. The name is a convenience for whoever lists the
 * system temp folder.
 */
export function folderName(cfg: Pick<AppUnderTest, 'productName'>): string {
  return (cfg.productName ?? 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * The run's own folder in the system temp folder, refused by name when none
 * was made. Never the shared temp folder instead: a folder made there is one
 * another run's leftover check would see.
 */
export function runTempFolder(forWhat = 'a profile'): string {
  const folder = process.env[TEMP_FOLDER_VARIABLE];
  if (!folder) {
    throw new Error(
      `${TEMP_FOLDER_VARIABLE} is not set, so there is no run folder to make ${forWhat} in. ` +
        `startJourney() makes it in a Journey's global setup, and startTempFolder() in a scripted suite's.`
    );
  }
  return folder;
}

/**
 * A Route's profile, inside the run's own folder rather than beside every
 * other run's, so that two runs at once never see each other's folders. The
 * profile's own name is kept to mkdtemp's six characters: Positron puts a
 * socket inside it, and a socket's path is limited to 103 characters.
 */
export async function makeUserDataDir(cfg: AppUnderTest): Promise<string> {
  return fs.promises.mkdtemp(runTempFolder(`${cfg.productName ?? 'the application'}'s profile`) + path.sep);
}

/** Make everything under a folder writable by its owner, so it can be deleted. */
async function makeWritable(dir: string): Promise<void> {
  let entries: fs.Dirent[];
  try {
    await fs.promises.chmod(dir, 0o700);
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await makeWritable(full);
  }
}

/**
 * Delete a Route's profile folder, and keep trying while it is still changing.
 *
 * A single delete lost a race on Positron on 2026-09-26: the application's
 * child processes were still exiting and writing into the profile, the
 * delete failed with "directory not empty", and the folder was left in the
 * system temp folder. So the delete retries with Node's own backoff, which
 * covers exactly that error. A folder the run made read-only is made writable
 * first, since otherwise nothing inside it can be removed.
 *
 * Then it watches the folder for `watchMs` and deletes it again if something
 * recreated it, a few times over. A delete that succeeded was still not the
 * end on Positron the same day: a helper started as the application closed
 * and wrote its log into the Route's home folder afterwards, bringing the
 * profile back. A writer later than the watch can still leak one, and the
 * end of a Journey fails the run on it, naming the folder: see
 * `startTempFolder` in start.ts.
 *
 * Throws if the folder cannot be removed or keeps coming back, rather than
 * leaving it silently: the fixture's teardown then fails, naming it.
 */
export async function removeProfile(dir: string, watchMs: number = DEFAULT_PROFILE_WATCH_MS): Promise<void> {
  for (let attempt = 0; attempt <= PROFILE_RETURNS_ALLOWED; attempt += 1) {
    await makeWritable(dir);
    await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await new Promise((resolve) => setTimeout(resolve, watchMs));
    if (!fs.existsSync(dir)) return;
  }
  throw new Error(
    `The profile folder ${dir} kept coming back after it was deleted, ` +
      `${PROFILE_RETURNS_ALLOWED + 1} times: something is still writing into it.`
  );
}

/** How long `removeProfile` watches a deleted profile by default. */
export const DEFAULT_PROFILE_WATCH_MS = 250;

/** How many times a deleted profile may come back before that is an error. */
const PROFILE_RETURNS_ALLOWED = 3;

/** The variable an adapter reads the application's checkout from. */
export const APP_DIR_VARIABLE = 'PHILEAS_APP_DIR';

/**
 * The application's checkout, or an installed bundle, for an adapter that
 * lives outside it. The Positron trial points it at an installed `.app`.
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
        `the folder holding the checkout you built, or the installed application.`
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
        `. Set it to the folder holding the application's checkout, or the installed application.`
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
 * So this does it in three parts, because each alone leaves a gap:
 *
 *   1. Replace show() on the prototype, so nothing can reveal a window later.
 *      Apps that create a window hidden and reveal it on 'ready-to-show',
 *      which is the common pattern and the right one, never draw at all.
 *   2. Hide whatever is already visible.
 *   3. Hide every window created from now on, as it is created. An app that
 *      creates its window with `show: true` never calls show(), and usually
 *      creates it after this runs, so the first two parts never reach it:
 *      measured on Positron on 2026-09-26, whose window stayed on the screen
 *      for whole runs that reported hidden mode. Such a window still flashes
 *      briefly; it just does not stay up.
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
  await app.evaluate(({ app: electronApp, BrowserWindow }) => {
    BrowserWindow.prototype.show = function () {};
    // **Full screen, too.** On macOS it gives a window a Space of its own,
    // which hiding does not reach: measured on Positron on 2026-09-27, where
    // a Route's Zen Mode took over the screen of whoever was running the
    // Journey. So every way in is replaced, and a window that gets there
    // anyway is brought back out and hidden.
    const leaveFullScreen = BrowserWindow.prototype.setFullScreen;
    const proto = BrowserWindow.prototype as unknown as Record<string, unknown>;
    for (const name of ['setFullScreen', 'setSimpleFullScreen', 'setKiosk']) proto[name] = function () {};
    // **And moveTop,** which on macOS brings a hidden window forward and
    // visible without a 'show' event: measured on Positron on 2026-09-27,
    // whose editor moved into a window of its own was revealed by it alone
    // and stayed on the screen.
    proto.moveTop = function () {};
    const keepOff = (window: Electron.BrowserWindow) => {
      window.on('show', () => window.hide());
      window.on('enter-full-screen', () => {
        leaveFullScreen.call(window, false);
        window.hide();
      });
    };
    for (const window of BrowserWindow.getAllWindows()) {
      keepOff(window);
      window.hide();
    }
    // On its 'show' event rather than on creation: a window created with
    // show: true is shown after 'browser-window-created' fires, so hiding it
    // there was undone at once. This also catches showInactive() and any
    // other way in that does not go through the replaced show().
    electronApp.on('browser-window-created', (_event, window) => {
      keepOff(window);
      window.hide();
    });
  });
}

/** What Playwright says when the main process drops the answer to a call. */
const DROPPED_ANSWER = 'Resulting promise was garbage collected';

/** How many times the first call into the main process is tried. */
export const MAIN_PROCESS_ATTEMPTS = 5;

/**
 * Reach the main process once, with a call that changes nothing, before
 * anything that does.
 *
 * Positron 2024.11, on Electron 30.4, drops the answer to the first call made
 * into its main process on most launches, and Playwright reports "Resulting
 * promise was garbage collected". Measured on 2026-09-27: the first call
 * failed on 6 launches in 8 and the second succeeded on all 6, about 28 ms
 * later; 2025.01 and 2025.02 failed on none of 10. The first call used to be
 * the one that hides windows, so the launch failed and the Route with it.
 *
 * A call that changes nothing makes the retry safe: whether a dropped attempt
 * ran its body or not makes no difference. Only that message is retried; any
 * other failure is the launch's to report, and is thrown at once.
 */
export async function reachMainProcess(
  app: Pick<ElectronApplication, 'evaluate'>,
  attempts: number = MAIN_PROCESS_ATTEMPTS
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await app.evaluate(() => undefined);
      return;
    } catch (error) {
      if (!String(error).includes(DROPPED_ANSWER)) throw error;
      if (attempt >= attempts) {
        throw new Error(
          `The main process dropped the answer to ${attempts} calls in a row ("${DROPPED_ANSWER}"), ` +
            `so the engine could not reach it.`,
          { cause: error }
        );
      }
    }
  }
}

/**
 * Do whatever the mode asks before any window has been drawn.
 *
 * Called before `firstWindow()`, which is the earliest the main process can be
 * reached and, for an application that defers display, before anything is on
 * the screen. `top` is handled here rather than after the fact because a window
 * created later has to get the same treatment. Replacing `show` reaches one
 * revealed later; one created with `show: true` never calls it, so
 * `browser-window-created` reaches that one, as it does for hidden mode.
 */
export async function prepareWindows(app: ElectronApplication, mode: WindowMode): Promise<void> {
  if (mode === 'hidden') {
    await hideWindows(app);
    return;
  }

  if (mode === 'top') {
    await app.evaluate(({ app: electronApp, BrowserWindow }) => {
      const show = BrowserWindow.prototype.show;
      BrowserWindow.prototype.show = function (this: Electron.BrowserWindow) {
        show.call(this);
        this.setAlwaysOnTop(true);
      };
      for (const window of BrowserWindow.getAllWindows()) window.setAlwaysOnTop(true);
      electronApp.on('browser-window-created', (_event, window) => {
        window.setAlwaysOnTop(true);
        window.on('show', () => window.setAlwaysOnTop(true));
      });
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
  const launchArgs =
    typeof cfg.launchArgs === 'function' ? cfg.launchArgs(userDataDir) : (cfg.launchArgs ?? []);
  const ownUserDataDir = launchArgs.find((arg) => arg.startsWith('--user-data-dir'));
  if (ownUserDataDir) {
    throw new Error(
      `launchArgs sets ${ownUserDataDir}, which the engine supplies itself so that a run ` +
        `cannot write over the application's real user data. Remove it from launchArgs.`
    );
  }

  const app = await electron.launch({
    executablePath: bundle.executable,
    // The profile rather than wherever the run was started, which is the
    // consumer's repository. An application writing a file by a relative path
    // then writes into what the Route throws away: measured on Positron on
    // 2026-09-26, where a bundled extension left a log in the Journey's folder.
    cwd: userDataDir,
    args: [`--user-data-dir=${userDataDir}`, ...launchArgs],
    env: {
      ...process.env,
      ...(typeof cfg.env === 'function' ? cfg.env(userDataDir) : (cfg.env ?? {})),
    } as Record<string, string>,
    timeout: 20_000,
  });

  // Everything after the launch is inside this, so a step that throws closes
  // the application rather than leaking it: the fixture never receives a
  // launch that did not return, so nothing else would.
  try {
    const mode = windowMode();

    // Before any call that changes something, since some releases drop the
    // answer to the first call made.
    await reachMainProcess(app);

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
    await stubNativeDialogs(app);

    // Which page is the application, rather than which window appeared first: an
    // application with a splash has more than one, and firstWindow() would hand
    // back the splash.
    const page = await openedWindow(cfg, launched);
    page.on('pageerror', (error) => launched.pageErrors.push(error));
    page.on('console', (message) => {
      if (message.type() === 'error') launched.consoleErrors.push(message.text());
    });

    // After a window exists, which is what activation needs and hiding could not
    // wait for.
    await activateWindows(app, mode);

    return launched;
  } catch (error) {
    // Bounded, since an application that failed to set up may not answer, and
    // guarded, so that cleaning up can never replace the error that says why
    // the launch failed. The process is taken first: once the application
    // has closed, Playwright no longer hands it over.
    try {
      const child = app.process();
      await Promise.race([app.close().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5_000))]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    } catch {
      // Already closed, which is what this was for.
    }
    throw error;
  }
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
 * Exported for a consumer's own use, such as an inner loop where relaunching is
 * too slow to bear; nothing in the engine calls it. The lifted comments
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
 * Lines Electron itself prints on standard error because of the flags the
 * launch passes, which say nothing about why an application failed.
 */
const LAUNCH_NOISE = [/^Debugger listening on /, /^For help, see: /, /^Debugger attached\.$/, /^DevTools listening on /];

/**
 * The application's page, or an error in the application's own words.
 *
 * An application can start, find it cannot go on, say why on standard error,
 * and never open a window. Waiting for the window then timed out saying only
 * that no window came, although the reason had been collected: measured on
 * `buggy` on 2026-09-26. So the reason goes into the error, and the
 * application is closed first, since nothing else would close a launch that
 * never finished.
 *
 * What the application printed before Playwright's launch returned is not
 * here: the engine starts listening only then. docs/DEFECTS.md carries that.
 */
async function openedWindow(cfg: AppUnderTest, launched: LaunchedApp & { path: 'electron' }): Promise<Page> {
  try {
    return cfg.selectPage ? await cfg.selectPage(launched.app) : await launched.app.firstWindow();
  } catch (error) {
    const said = launched.stderr
      .join('')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !LAUNCH_NOISE.some((noise) => noise.test(line)));
    const closed = await closeApp(cfg, launched, 5_000).catch((closeError: Error) => ({
      forced: true as const,
      detail: `Closing it failed: ${closeError.message.split('\n')[0]}`,
    }));
    throw new Error(
      `${error instanceof Error ? error.message.split('\n')[0] : String(error)}\n\n` +
        (said.length
          ? `The application's standard error since the launch returned:\n\n${said.map((line) => `  ${line}`).join('\n')}`
          : 'The application printed nothing on standard error after the launch returned.') +
        (closed.forced ? `\n\n${closed.detail}` : '')
    );
  }
}

/** How long an orderly close may take before the process is killed. */
export const DEFAULT_CLOSE_TIMEOUT_MS = 10_000;

/** How long to wait for a killed process to be gone. */
const KILL_WAIT_MS = 5_000;

/**
 * How the application was closed, for the report.
 *
 * A forced kill is a finding of its own: an application that will not close is
 * a defect class this engine exists to find. Returned rather than thrown so it
 * never replaces the Route's own verdict, which is usually the hang that
 * caused it.
 */
export type CloseVerdict = { forced: false } | { forced: true; detail: string };

/**
 * Close the application, and kill it if it will not close.
 *
 * An application-specific shutdown runs first where one is supplied, because
 * closing the connection does not always terminate the process. At one launch
 * per Route, a shutdown that leaks costs one stray process per Route rather
 * than one per run.
 *
 * **Bounded, because a hang is what this engine finds.** Neither `shutdown`
 * nor `app.close()` has a limit of its own, and against a process that never
 * answers again `app.close()` never returns: the Route had found the hang, and
 * the Journey sat at teardown instead of reporting it. Measured on Positron on
 * 2026-09-26, which also ignored an ordinary stop signal while its main process
 * was blocked, since Electron's handling of one needs the event loop. So the
 * kill is SIGKILL, which the process cannot refuse.
 */
export async function closeApp(
  cfg: AppUnderTest,
  launched: LaunchedApp,
  timeoutMs: number = DEFAULT_CLOSE_TIMEOUT_MS
): Promise<CloseVerdict> {
  const orderly = (async () => {
    if (cfg.shutdown) await cfg.shutdown(launched.app);
    await launched.app.close();
  })();

  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<'timed-out'>((resolve) => {
    timer = setTimeout(() => resolve('timed-out'), timeoutMs);
  });

  // An orderly close that throws still propagates, as it always has: the
  // fixture attaches that as its own finding. **But only after the kill.** A
  // shutdown that threw never reached app.close(), and propagating straight
  // away left the process running with nothing left to stop it.
  let orderlyError: unknown;
  try {
    const settled = await Promise.race([
      orderly.then(
        () => 'closed' as const,
        (error: unknown) => {
          orderlyError = error;
          return 'threw' as const;
        }
      ),
      timedOut,
    ]);
    if (settled === 'closed') return { forced: false };
  } finally {
    clearTimeout(timer);
  }

  // Abandoned, and it may settle once the process is gone; nothing waits on it.
  orderly.catch(() => undefined);
  const verdict = await forceClose(launched, timeoutMs);
  if (orderlyError !== undefined) throw orderlyError;
  return verdict;
}

/** Kill what an orderly close did not end, where this launch path reaches a process. */
async function forceClose(launched: LaunchedApp, timeoutMs: number): Promise<CloseVerdict> {

  if (launched.path !== 'electron') {
    return {
      forced: true,
      detail:
        `The application did not close within ${timeoutMs} ms, and this launch path reaches ` +
        `no process to kill, so it may still be running.`,
    };
  }

  const child = launched.app.process();
  const exited =
    child.exitCode !== null || child.signalCode !== null
      ? Promise.resolve(true)
      : new Promise<boolean>((resolve) => {
          const give = setTimeout(() => resolve(false), KILL_WAIT_MS);
          child.once('exit', () => {
            clearTimeout(give);
            resolve(true);
          });
        });
  child.kill('SIGKILL');

  return {
    forced: true,
    detail:
      `The application did not close within ${timeoutMs} ms, so its process ` +
      `(pid ${child.pid}) was killed with SIGKILL` +
      ((await exited) ? '.' : `, and had still not exited ${KILL_WAIT_MS} ms later.`),
  };
}

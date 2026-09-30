import type { ElectronApplication } from '@playwright/test';

export const RECORDER = '__phileasOpenExternal';

/**
 * Replace shell.openExternal in the main process with a recorder.
 *
 * Without this, a Route that hops an outbound link opens the real browser on
 * the machine running the Journey.
 *
 * **It reaches an application only if that application looks `openExternal` up
 * on the module object at call time.** One that captured the function at
 * startup keeps Electron's own, the assignment here still succeeds, a browser
 * opens, and the recorder stays empty -- which reads exactly like nothing
 * having opened. `docs/DEFECTS.md` carries that as an open defect and
 * `docs/PLAN.md` has the measurement behind it: three applications out of three
 * write it as a property lookup, which is not the same as the technique being
 * sound for one nobody has read.
 *
 * Installed on every launch rather than only where a link is expected, so no
 * Route can open a browser by accident.
 */
export async function stubOpenExternal(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ shell }, key) => {
    const calls: string[] = [];
    // When each call came, beside it: `caught.ts` has why.
    const times: number[] = [];
    (globalThis as Record<string, unknown>)[key] = calls;
    (globalThis as Record<string, unknown>)[`${key}At`] = times;
    shell.openExternal = async (url: string) => {
      calls.push(url);
      times.push(Date.now());
    };
  }, RECORDER);
}

/**
 * URLs the application handed to the stub since the last reset.
 *
 * **An empty list means the stub caught nothing. It does not mean nothing
 * opened** -- see the defect named above, which is why this does not say so.
 *
 * Throws when the recorder is absent rather than answering with an empty list.
 * The two used to be the same answer, so a run where the stub was never
 * installed reported exactly what a run where nothing was opened reports. That
 * narrow case is detectable here and now costs a loud failure instead of a
 * quiet clean result; the wider case, where the stub installed and did not take
 * effect, needs evidence from outside this file.
 */
export async function openedExternally(app: ElectronApplication): Promise<string[]> {
  const calls = await app.evaluate(
    (_electron, key) => (globalThis as Record<string, unknown>)[key] as string[] | undefined,
    RECORDER
  );

  if (calls === undefined) {
    throw new Error(
      'The outbound-link recorder is not installed in this application, so nothing ' +
        'can be said about what it opened. A run that answered "none" here would be ' +
        'reporting the absence of its own evidence as a clean result.'
    );
  }

  return calls;
}

/**
 * Empty the recorder.
 *
 * The stub lives in the main process, which a renderer reload does not touch,
 * so a reset that reloads the renderer leaves everything recorded before it in
 * place. Its only caller is `reloadRenderer`, which `launch.ts` records as
 * deliberately not the per-Route reset.
 *
 * Throws when the recorder is absent, for the reason `openedExternally` gives:
 * clearing nothing and clearing an uninstalled recorder must not look alike.
 */
export async function clearOpenExternal(app: ElectronApplication): Promise<void> {
  const cleared = await app.evaluate((_electron, key) => {
    const calls = (globalThis as Record<string, unknown>)[key] as string[] | undefined;
    if (!calls) return false;
    calls.length = 0;
    // The times beside the calls, so the two stay the same length.
    const times = (globalThis as Record<string, unknown>)[`${key}At`] as number[] | undefined;
    if (times) times.length = 0;
    return true;
  }, RECORDER);

  if (!cleared) {
    throw new Error('The outbound-link recorder is not installed, so there is nothing to clear.');
  }
}

export const PATHS_RECORDER = '__phileasOpenedPaths';

/**
 * Replace `shell.openPath` and `shell.showItemInFolder` in the main process
 * with a recorder, answering each as though it had opened.
 *
 * Without this, a Route can open Finder, or whatever application a file type
 * belongs to, on the machine running the Journey. On RStudio on 2026-09-28 a
 * Route did: a report it compiled was opened from the run's temp folder and a
 * Finder window appeared on the screen. Measured the same day, stubs on both
 * caught RStudio's Files pane -> More -> Show Folder in New Window, which
 * called `shell.openPath` with the Route's home folder, and no window opened.
 *
 * The same limit as `stubOpenExternal`: it reaches an application only if it
 * looks the functions up on `shell` at call time. RStudio does.
 */
export async function stubOpenPaths(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ shell }, key) => {
    const calls: string[] = [];
    const times: number[] = [];
    (globalThis as Record<string, unknown>)[key] = calls;
    (globalThis as Record<string, unknown>)[`${key}At`] = times;
    // openPath answers with an error message, and the empty string for success.
    shell.openPath = async (path: string) => {
      calls.push(`openPath ${path}`);
      times.push(Date.now());
      return '';
    };
    shell.showItemInFolder = (path: string) => {
      calls.push(`showItemInFolder ${path}`);
      times.push(Date.now());
    };
  }, PATHS_RECORDER);
}

/**
 * What the application asked to open or reveal since launch, each as the
 * function called and its path. Throws when the recorder is absent, for the
 * reason `openedExternally` gives.
 */
export async function openedPaths(app: ElectronApplication): Promise<string[]> {
  const calls = await app.evaluate(
    (_electron, key) => (globalThis as Record<string, unknown>)[key] as string[] | undefined,
    PATHS_RECORDER
  );
  if (calls === undefined) {
    throw new Error(
      'The recorder for opened files and folders is not installed in this application, so ' +
        'nothing can be said about what it opened.'
    );
  }
  return calls;
}

export const SELF_LAUNCH_RECORDER = '__phileasSelfLaunches';

/**
 * Replace `child_process.spawn` in the main process with one that records a
 * launch of the application's own program and starts nothing, and passes every
 * other command through unchanged.
 *
 * Without this, an application that opens a second copy of itself escapes the
 * Route. The copy gets the environment but not the command line, so it has no
 * `--user-data-dir` and none of the window settings, which reach only the copy
 * Playwright launched. On RStudio on 2026-09-29, Open Project in New Session
 * started one: it came up on the real screen and wrote into RStudio's real
 * Application Support folder. A Route could not have traveled it either, so
 * stubbing gives up nothing a Route could reach, only the second copy's own
 * startup.
 *
 * The launch is answered with a stand-in child process that reports it
 * started and never exits, which is what a detached copy looks like to the
 * application that started it. RStudio only calls `unref()` on it.
 *
 * The same limit as `stubOpenExternal`: it reaches an application only if it
 * looks `spawn` up on the `child_process` module at call time. RStudio's
 * release bundle does, measured on 2026-09-29 as `(0,o.spawn)(process.execPath,
 * ...)`. It does not reach `app.relaunch()`, `execFile` or `fork`, none of which
 * RStudio uses to start itself.
 */
export async function stubSelfLaunch(app: ElectronApplication): Promise<void> {
  await app.evaluate((_electron, key) => {
    type Loader = (name: string) => unknown;
    const load: Loader | undefined =
      (process as unknown as { getBuiltinModule?: Loader }).getBuiltinModule ??
      (process as unknown as { mainModule?: { require: Loader } }).mainModule?.require;
    if (!load) {
      throw new Error('Neither process.getBuiltinModule nor the main module can load child_process here.');
    }
    const childProcess = load('child_process') as typeof import('child_process');
    const { EventEmitter } = load('events') as typeof import('events');
    const path = load('path') as typeof import('path');

    const calls: string[][] = [];
    const times: number[] = [];
    (globalThis as Record<string, unknown>)[key] = calls;
    (globalThis as Record<string, unknown>)[`${key}At`] = times;
    const spawn = childProcess.spawn;

    childProcess.spawn = function (this: unknown, command: string, ...rest: unknown[]) {
      if (typeof command !== 'string' || path.resolve(command) !== process.execPath) {
        return (spawn as (...a: unknown[]) => unknown).call(this, command, ...rest);
      }
      const args = Array.isArray(rest[0]) ? (rest[0] as unknown[]).map(String) : [];
      calls.push(args);
      times.push(Date.now());
      const child = Object.assign(new EventEmitter(), {
        pid: undefined,
        exitCode: null,
        signalCode: null,
        killed: false,
        stdin: null,
        stdout: null,
        stderr: null,
        stdio: [null, null, null],
        unref() {},
        ref() {},
        kill() {
          return false;
        },
      });
      setImmediate(() => child.emit('spawn'));
      return child;
    } as typeof childProcess.spawn;
  }, SELF_LAUNCH_RECORDER);
}

/**
 * The arguments of each launch of the application's own program since launch,
 * one list per launch. Throws when the recorder is absent, for the reason
 * `openedExternally` gives.
 */
export async function selfLaunches(app: ElectronApplication): Promise<string[][]> {
  const calls = await app.evaluate(
    (_electron, key) => (globalThis as Record<string, unknown>)[key] as string[][] | undefined,
    SELF_LAUNCH_RECORDER
  );
  if (calls === undefined) {
    throw new Error(
      'The recorder for launches of the application itself is not installed, so nothing ' +
        'can be said about what it started.'
    );
  }
  return calls;
}

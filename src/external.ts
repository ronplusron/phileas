import type { ElectronApplication } from '@playwright/test';

const RECORDER = '__phileasOpenExternal';

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
    (globalThis as Record<string, unknown>)[key] = calls;
    shell.openExternal = async (url: string) => {
      calls.push(url);
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
    return true;
  }, RECORDER);

  if (!cleared) {
    throw new Error('The outbound-link recorder is not installed, so there is nothing to clear.');
  }
}

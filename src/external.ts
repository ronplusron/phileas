import type { ElectronApplication } from '@playwright/test';

/**
 * Replace shell.openExternal in the main process with a recorder.
 *
 * Without this, a test that clicks an outbound link opens the machine's real
 * default browser. That is not a hypothetical: the app routes every external
 * navigation through shell.openExternal by design.
 *
 * This works because main.js destructures `shell` from require('electron') once,
 * but calls `shell.openExternal(...)` as a property lookup at click time. The
 * destructured binding and the module export are the same object, so replacing
 * the property is visible to the handler that was installed at startup.
 *
 * Installed on every launch rather than only in the link test, so no test can
 * open a browser window by accident.
 */
export async function stubOpenExternal(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ shell }) => {
    const calls: string[] = [];
    (globalThis as Record<string, unknown>).__e2eOpenExternal = calls;
    shell.openExternal = async (url: string) => {
      calls.push(url);
    };
  });
}

/** URLs the app asked to open externally since the last reset. Nothing actually opened. */
export function openedExternally(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(
    () => ((globalThis as Record<string, unknown>).__e2eOpenExternal ?? []) as string[]
  );
}

/**
 * Empty the recorder between tests.
 *
 * Needed because the stub lives in the main process, which a renderer reload
 * does not touch. Without it the list accumulates across every test sharing a
 * worker, and an exact-match assertion starts failing on a URL that an earlier
 * test opened.
 */
export async function clearOpenExternal(app: ElectronApplication): Promise<void> {
  await app.evaluate(() => {
    const calls = (globalThis as Record<string, unknown>).__e2eOpenExternal as
      | string[]
      | undefined;
    if (calls) calls.length = 0;
  });
}

import type { ElectronApplication } from '@playwright/test';
import { RECORDER as DIALOGS } from './dialogs';
import type { NativeDialogCall } from './dialogs';
import { PATHS_RECORDER, RECORDER as OUTBOUND, SELF_LAUNCH_RECORDER } from './external';

/**
 * What the engine's stubs caught during one Hop: the calls the application
 * made that would have reached outside the Route, and did nothing instead.
 *
 * Written on the Hop's journal line, and only when there is something to say.
 * Without it the journal shows the menu click and not that a browser, a
 * Finder window, a native dialog or a second copy of the application was
 * asked for and suppressed, so a reader later cannot tell a Hop that did
 * nothing from one whose effect was stopped.
 */
export interface CaughtByStubs {
  /** URLs handed to `shell.openExternal`. */
  readonly outbound?: readonly string[];
  /** Files and folders handed to `shell.openPath` or `shell.showItemInFolder`. */
  readonly opened?: readonly string[];
  /** Native dialogs, each answered as cancelled. */
  readonly dialogs?: readonly NativeDialogCall[];
  /** Launches of the application's own program, as the arguments of each. */
  readonly selfLaunches?: readonly (readonly string[])[];
  /**
   * Stubs whose recorder was absent, so what they caught cannot be said. A
   * stub never installed and a stub that caught nothing must not look alike.
   */
  readonly notInstalled?: readonly string[];
  /** Why the recorders could not be read at all, such as the application having gone. */
  readonly unreadable?: string;
}

const RECORDERS = {
  outbound: OUTBOUND,
  opened: PATHS_RECORDER,
  dialogs: DIALOGS,
  selfLaunches: SELF_LAUNCH_RECORDER,
} as const;

type Field = keyof typeof RECORDERS;

/**
 * A reader that answers, each time it is asked, what the stubs caught since it
 * was last asked: undefined when nothing was.
 *
 * One call into the main process reads all four recorders. A recorder that
 * shrank was cleared, which `clearOpenExternal` does on a renderer reload, so
 * everything in it is new.
 *
 * Bounded, since it runs after every Hop and an application that has stopped
 * answering would otherwise hold the Route there for good: the still-responding
 * check reports the hang, and this says only that it could not read. Measured
 * on 2026-09-29, when the unbounded first version kept a planted hang's Route
 * waiting until Playwright's own timeout.
 */
export function caughtSince(
  app: ElectronApplication,
  timeoutMs: number
): () => Promise<CaughtByStubs | undefined> {
  const seen: Record<Field, number> = { outbound: 0, opened: 0, dialogs: 0, selfLaunches: 0 };

  return async () => {
    let read: Record<Field, unknown[] | undefined>;
    let timer: NodeJS.Timeout | undefined;
    try {
      const reading = app.evaluate((_electron, keys) => {
        const all = globalThis as Record<string, unknown>;
        return Object.fromEntries(
          Object.entries(keys).map(([field, key]) => [field, all[key] as unknown[] | undefined])
        ) as Record<string, unknown[] | undefined>;
      }, RECORDERS);
      // A reading given up on must not surface later as an unhandled rejection.
      reading.catch(() => undefined);
      const late = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`the main process did not answer within ${timeoutMs} ms`)),
          timeoutMs
        );
      });
      read = await Promise.race([reading, late]);
    } catch (error) {
      return { unreadable: error instanceof Error ? error.message.split('\n')[0] : String(error) };
    } finally {
      clearTimeout(timer);
    }

    const caught: Record<string, unknown> = {};
    const notInstalled: string[] = [];
    for (const field of Object.keys(RECORDERS) as Field[]) {
      const calls = read[field];
      if (!Array.isArray(calls)) {
        notInstalled.push(field);
        continue;
      }
      const from = calls.length < seen[field] ? 0 : seen[field];
      seen[field] = calls.length;
      if (calls.length > from) caught[field] = calls.slice(from);
    }
    if (notInstalled.length) caught.notInstalled = notInstalled;
    return Object.keys(caught).length ? (caught as CaughtByStubs) : undefined;
  };
}

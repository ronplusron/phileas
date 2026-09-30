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
  /**
   * When each call above came, as ISO times in the same order, since
   * 2026-09-30 and absent before. **The line these are written on is the Hop
   * that read them, which is not always the Hop that asked:** an application
   * can open a link or a dialog seconds after the click that started it, as
   * it can log an error. The renderer says how far into the Hop each came, or
   * how long before it.
   */
  readonly at?: { readonly [F in Field]?: readonly string[] };
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
    let read: Record<Field, { calls?: unknown[]; times?: unknown[] }>;
    let timer: NodeJS.Timeout | undefined;
    try {
      // Each recorder with the times its stub keeps beside it, under the
      // recorder's name and `At`.
      const reading = app.evaluate((_electron, keys) => {
        const all = globalThis as Record<string, unknown>;
        return Object.fromEntries(
          Object.entries(keys).map(([field, key]) => [
            field,
            { calls: all[key] as unknown[] | undefined, times: all[`${key}At`] as unknown[] | undefined },
          ])
        ) as Record<string, { calls?: unknown[]; times?: unknown[] }>;
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
    const at: Partial<Record<Field, string[]>> = {};
    const notInstalled: string[] = [];
    for (const field of Object.keys(RECORDERS) as Field[]) {
      const { calls, times } = read[field] ?? {};
      if (!Array.isArray(calls)) {
        notInstalled.push(field);
        continue;
      }
      const from = calls.length < seen[field] ? 0 : seen[field];
      seen[field] = calls.length;
      if (calls.length > from) {
        caught[field] = calls.slice(from);
        // Only where every call has its time, so a time is never paired with
        // the wrong call. A stub from before the times were kept has none.
        if (Array.isArray(times) && times.length === calls.length) {
          at[field] = times.slice(from).map((time) => new Date(Number(time)).toISOString());
        }
      }
    }
    if (Object.keys(at).length) caught.at = at;
    if (notInstalled.length) caught.notInstalled = notInstalled;
    return Object.keys(caught).length ? (caught as CaughtByStubs) : undefined;
  };
}

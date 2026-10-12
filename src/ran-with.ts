import type { ElectronApplication, Page } from '@playwright/test';
import type { AppUnderTest } from './app-under-test.js';
import type { ClosingEntry, JournalEntry } from './journal.js';
import { responsesOf } from './launch.js';

/** How long the adapter's `ranWith` is given each time, so a stuck read cannot hold a Route. */
export const RAN_WITH_TIMEOUT_MS = 5_000;

/**
 * Asks the adapter what the running application was seen to run with, and
 * journals what is new, for one Route. See `AppUnderTest.ranWith`.
 *
 * Read from the running application rather than its setup, which is
 * `runsWith` on the opening line: RStudio on Windows can be told another R
 * in its own settings, and Positron starts an interpreter only when a Route
 * asks, from among those it found. So the value is learned partway through a
 * Route, and the note line it lands on says where.
 */
export interface RanWithTracker {
  /** Ask the adapter, and write a note for anything not seen before, numbered for the Hop about to be taken. */
  read(hop: number): Promise<void>;
  /** What the outcome line carries: everything seen, `none`, and the last reason a read failed. */
  closing(): Pick<ClosingEntry, 'ranWith' | 'ranWithUnread'>;
}

export function trackRanWith(
  cfg: Pick<AppUnderTest, 'ranWith'>,
  context: { app: ElectronApplication; page: Page; userDataDir: string | undefined },
  journal: { write(entry: JournalEntry): void },
  timeoutMs: number = RAN_WITH_TIMEOUT_MS
): RanWithTracker {
  const seen = new Map<string, string[]>();
  let unread: string | undefined;

  return {
    async read(hop) {
      if (!cfg.ranWith) return;
      let values: Readonly<Record<string, string>>;
      try {
        let timer: NodeJS.Timeout | undefined;
        values = await Promise.race([
          Promise.resolve(cfg.ranWith({ ...context, responses: (pattern) => responsesOf(context.app, pattern) })),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`gave no answer within ${timeoutMs / 1000} s`)), timeoutMs);
          }),
        ]).finally(() => clearTimeout(timer));
      } catch (error) {
        unread = `the adapter's ranWith failed: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`;
        return;
      }
      const fresh: Record<string, string> = {};
      for (const [name, value] of Object.entries(values)) {
        if (typeof value !== 'string' || value === '') {
          unread = `the adapter's ranWith gave a value that is not text for ${name}`;
          continue;
        }
        const before = seen.get(name) ?? [];
        if (before.includes(value)) continue;
        seen.set(name, [...before, value]);
        fresh[name] = value;
      }
      if (!Object.keys(fresh).length) return;
      journal.write({
        kind: 'note',
        hop,
        note: `Ran with ${Object.entries(fresh).map(([name, value]) => `${name} ${value}`).join(', ')}`,
        ranWith: fresh,
        at: new Date().toISOString(),
      });
    },
    closing() {
      if (!cfg.ranWith) return {};
      // `none` only where every read answered: a read that failed may have
      // missed what started, so nothing seen then is not nothing started.
      if (!seen.size) return unread ? { ranWithUnread: unread } : { ranWith: 'none' };
      return { ranWith: Object.fromEntries(seen), ...(unread ? { ranWithUnread: unread } : {}) };
    },
  };
}

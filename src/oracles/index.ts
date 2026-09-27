import fs from 'node:fs';
import type { ElectronApplication, Page } from '@playwright/test';
import type { AppUnderTest, UniversalCheck } from '../app-under-test';
import type { JournaledCheck } from '../journal';
import { findingId, signatureOf, type KnownFindings } from '../known.mjs';

/**
 * The checks, run after every Hop, Fix steps included (R15).
 *
 * **This is the part of phase 5 the Positron trial needs, not all of it.**
 * `docs/PLAN.md` has the trial and why it comes first. Six checks run here:
 * uncaught errors in either process, console errors, still responding, the
 * window still showing something, no unexpected dialog, and an error appended
 * to a log the adapter names. Two are not built yet, the foreign-process half
 * of no navigation away and named controls, and every Hop's journal line says
 * so rather than leaving them out.
 *
 * **Every check here was made to fire on a planted defect before it shipped.**
 * `tests/checks.spec.ts` has one per check, against `buggy` launched with that
 * defect's flag. A check that reads the same on a healthy and a broken
 * application is worse than none, because a Route that ends at the first
 * violation would never end.
 *
 * What is watched starts when the Route does. An error during boot, before
 * the Route's first Hop, is not a Hop's doing; the fixture still fails the test
 * on an uncaught renderer error from boot, as it did before.
 */

/** The order every Hop's line lists the checks in, so two lines compare by eye. */
export const CHECK_ORDER: readonly UniversalCheck[] = [
  'uncaught-error',
  'console-error',
  'still-responding',
  'window-showing-content',
  'no-unexpected-dialog',
  'log-error',
  'no-navigation-away',
  'named-controls',
];

/**
 * How long each process has to answer a round trip before the application is
 * called unresponsive, in milliseconds.
 *
 * A hang has to be a failure after a stated wait rather than a run that hangs
 * (R17, and section 9 of the requirements). Five seconds is longer than any
 * Hop has been measured to take to settle, on the IDEs included, and short
 * enough that a hung application costs a Route five seconds rather than its
 * whole deadline.
 */
export const DEFAULT_RESPONSIVE_TIMEOUT_MS = 5_000;

/** Where the main-process listener keeps what it caught. */
const MAIN_ERRORS = '__phileasMainErrors';

/**
 * Short, since it is written on every Hop. `docs/PLAN.md` has the trial that
 * built the rest first, and says when these follow.
 */
const NOT_BUILT = 'not built yet (docs/PLAN.md)';

/**
 * A Hop's checks found something wrong, and the Route ends here (R16).
 *
 * Its own class so that a check failing is told apart from the engine
 * breaking. Where it happens after a Fix step, it arrives inside a
 * `FixFailure`, since a Fix that breaks the application is one problem however
 * many Routes run it (R11).
 */
export class CheckFailure extends Error {
  constructor(
    readonly where: string,
    readonly failed: readonly JournaledCheck[]
  ) {
    super(
      `${failed.length === 1 ? 'A check' : `${failed.length} checks`} failed after ${where}:\n\n` +
        failed
          .map((check) => {
            const ids = (check.findings ?? []).filter((finding) => !finding.known).map((finding) => finding.id);
            return `  ${check.check}: ${check.observation ?? ''}${ids.length ? `\n  finding ${ids.join(', ')}` : ''}`;
          })
          .join('\n')
    );
    this.name = 'CheckFailure';
  }
}

/** What the checks read, gathered from the moment the Route starts. */
export interface Watch {
  /** Run every check against what has happened since the last call, and the settled tree. */
  check(tree: unknown): Promise<JournaledCheck[]>;
  /**
   * Run one of the engine's own bounded calls, such as a Hop's action or the
   * settle wait, and note it for the still-responding check when it overran
   * its bound by more than the responsive wait. Gives up waiting at that
   * point, returning `STALLED`, so a hung application cannot hang the Route.
   * See `startWatching` for why this is where a hang shows.
   */
  bounded<T>(what: string, call: Promise<T>, boundMs: number): Promise<T | typeof STALLED>;
}

/** What `Watch.bounded` returns when a call outran its bound and the responsive wait together. */
export const STALLED = Symbol('stalled');

export interface WatchOptions {
  readonly page: Page;
  readonly app: ElectronApplication;
  readonly cfg: AppUnderTest;
  readonly responsiveTimeoutMs?: number;
  /** The Route's profile folder, which `logPaths` written as a function needs. */
  readonly userDataDir?: string;
  /**
   * Findings already known, which the Route records and carries on past
   * instead of ending. Read once, when the Route starts. See `known.mjs`.
   */
  readonly known?: KnownFindings;
}

/**
 * Start gathering what the checks need, and hand back the function that
 * judges it.
 *
 * **The main-process listener is an intrusion, and worth knowing about.**
 * Electron's own handling of an uncaught main-process exception is a native
 * dialog, which is off the screen for nobody and blocks the process until a
 * person dismisses it: C5 broken, and the check that fires would say the
 * application stopped responding rather than that it threw. Installing a
 * listener replaces that handling for the rest of the Route. An application
 * that installs its own listener still gets its own, since listeners add up.
 *
 * **A hang shows first in the engine's own calls, not in a round trip
 * afterwards.** Measured 2026-09-26 on `buggy`'s planted hangs: with either
 * process busy for six seconds, a click bounded to one second returned after
 * 6.4, and by the time a round trip was sent the hang had ended and it answered
 * at once. Electron's main process serves the debugging connection every
 * Playwright call goes through, and a busy renderer holds back the answer to
 * the click that made it busy, so a call's own timeout cannot fire until the
 * application answers. So `bounded` times each such call from this side, and
 * a call that overran its bound by more than the responsive wait is the
 * finding, even when everything answers again by the time the checks run.
 */
/**
 * The logs to read, from a list or from the Route's profile folder.
 *
 * Refuses when the adapter names its logs by folder and no folder was given,
 * rather than reading none. The log check would then report "not run" on every
 * Hop for a reason that is the caller's mistake and not the adapter's choice.
 */
function resolveLogPaths(cfg: AppUnderTest, userDataDir: string | undefined): string[] {
  if (typeof cfg.logPaths !== 'function') return cfg.logPaths ?? [];
  if (userDataDir === undefined) {
    throw new Error(
      "The adapter names its logs from the Route's profile folder, and runRoute was not given " +
        "one. Pass userDataDir from the test's fixture to runRoute."
    );
  }
  return cfg.logPaths(userDataDir);
}

export async function startWatching(options: WatchOptions): Promise<Watch> {
  const { page, app, cfg } = options;
  const known = new Map((options.known?.entries ?? []).map((entry) => [entry.signature, entry]));
  const responsiveTimeoutMs = options.responsiveTimeoutMs ?? DEFAULT_RESPONSIVE_TIMEOUT_MS;

  const pageErrors: string[] = [];
  const stalls: string[] = [];
  const consoleErrors: string[] = [];
  const dialogs: string[] = [];

  page.on('pageerror', (error) => pageErrors.push(firstLines(error.stack ?? error.message)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  // A listener means Playwright no longer dismisses dialogs by itself, so this
  // one has to, or the page waits on a dialog nobody will answer.
  page.on('dialog', (dialog) => {
    dialogs.push(`${dialog.type()}: ${dialog.message()}`);
    dialog.dismiss().catch(() => undefined);
  });

  let mainWatched: string | undefined;
  try {
    await app.evaluate((_electron, key) => {
      const errors: string[] = [];
      (globalThis as Record<string, unknown>)[key] = errors;
      const text = (value: unknown) =>
        value instanceof Error ? (value.stack ?? value.message) : String(value);
      process.on('uncaughtException', (error) => errors.push(text(error)));
      process.on('unhandledRejection', (reason) => errors.push(`unhandled rejection: ${text(reason)}`));
    }, MAIN_ERRORS);
  } catch (error) {
    mainWatched = error instanceof Error ? error.message.split('\n')[0] : String(error);
  }

  // Where each log ended when the Route started, so only what a Hop appended
  // is read. A file that does not exist yet starts at nothing.
  const logOffsets = new Map<string, number>();
  for (const file of resolveLogPaths(cfg, options.userDataDir)) logOffsets.set(file, sizeOf(file));

  const readMain = async (): Promise<string[] | string> => {
    if (mainWatched !== undefined) return `the main process could not be watched: ${mainWatched}`;
    const read = app.evaluate(
      (_electron, key) => ((globalThis as Record<string, unknown>)[key] as string[]).splice(0),
      MAIN_ERRORS
    );
    const answer = await within(read, responsiveTimeoutMs);
    if (answer === TIMED_OUT) return 'the main process did not answer, so its errors could not be read';
    if (!Array.isArray(answer)) return 'the main process could not be read, so its errors are unknown';
    return answer.map(firstLines);
  };

  const readLogs = (): string[] => {
    const found: string[] = [];
    for (const [file, offset] of logOffsets) {
      const size = sizeOf(file);
      // A log that shrank was rotated or truncated; read it from the start.
      const from = size < offset ? 0 : offset;
      if (size > from) {
        const handle = fs.openSync(file, 'r');
        try {
          const buffer = Buffer.alloc(size - from);
          fs.readSync(handle, buffer, 0, buffer.length, from);
          for (const line of buffer.toString('utf8').split('\n')) {
            if (/\berror\b/i.test(line)) found.push(`${file}: ${line.trim()}`);
          }
        } finally {
          fs.closeSync(handle);
        }
      }
      logOffsets.set(file, size);
    }
    return found;
  };

  const bounded: Watch['bounded'] = async (what, call, boundMs) => {
    const startedAt = Date.now();
    const answer = await within(call, boundMs + responsiveTimeoutMs, 'rejections-too');
    const tookMs = Date.now() - startedAt;
    if (answer === TIMED_OUT) {
      stalls.push(
        `${what} was bounded to ${boundMs} ms and had not returned after ${tookMs} ms: the application stopped answering`
      );
      return STALLED;
    }
    if (tookMs > boundMs + responsiveTimeoutMs) {
      stalls.push(
        `${what} was bounded to ${boundMs} ms and returned after ${tookMs} ms: the application did not answer for about ${Math.round((tookMs - boundMs) / 1000)} s`
      );
    }
    return answer.ok ? answer.value : Promise.reject(answer.error);
  };

  const roundTrips = async (): Promise<string[]> => {
    const [renderer, main] = await Promise.all([
      within(page.evaluate(() => true), responsiveTimeoutMs),
      within(app.evaluate(() => true), responsiveTimeoutMs),
    ]);
    const slow: string[] = stalls.splice(0);
    if (renderer === TIMED_OUT) slow.push(`the renderer did not answer within ${responsiveTimeoutMs} ms`);
    if (main === TIMED_OUT) slow.push(`the main process did not answer within ${responsiveTimeoutMs} ms`);
    return slow;
  };

  return {
    bounded,
    async check(tree) {
      const judge = (check: UniversalCheck, run: () => Promise<Verdict> | Verdict) =>
        judged(check, cfg, known, run);

      return Promise.all(
        CHECK_ORDER.map((check) => {
          switch (check) {
            case 'uncaught-error':
              return judge(check, async () => {
                const renderer = pageErrors.splice(0).map((error) => `renderer: ${error}`);
                const main = await readMain();
                if (typeof main === 'string') {
                  // Renderer errors are still evidence; only an empty result
                  // would claim something the unread main process cannot back.
                  return renderer.length ? renderer : { notRun: main };
                }
                return [...renderer, ...main.map((error) => `main process: ${error}`)];
              });
            case 'console-error':
              return judge(check, () => consoleErrors.splice(0));
            case 'still-responding':
              return judge(check, roundTrips);
            case 'window-showing-content':
              return judge(check, () =>
                tree === undefined
                  ? { notRun: 'the page did not answer, so what it shows could not be read' }
                  : showsNothing(tree)
                    ? ['the window shows nothing a screen reader could read: no text and no named element']
                    : []
              );
            case 'no-unexpected-dialog':
              return judge(check, () => dialogs.splice(0));
            case 'log-error':
              return judge(check, () =>
                logOffsets.size === 0 ? { notRun: 'the adapter names no log in logPaths' } : readLogs()
              );
            case 'no-navigation-away':
            case 'named-controls':
              return judge(check, () => ({ notRun: NOT_BUILT }));
          }
        })
      );
    },
  };
}

/** What a check found: its violations, or why it could not look. */
type Verdict = string[] | { notRun: string };

/**
 * One check's verdict, with the adapter's narrowing applied (R19).
 *
 * A check switched off is recorded as not run, with the adapter's reason,
 * and is never run at all, so a check that would hang is not waited on.
 */
async function judged(
  check: UniversalCheck,
  cfg: AppUnderTest,
  known: ReadonlyMap<string, { readonly issue?: string }>,
  run: () => Promise<Verdict> | Verdict
): Promise<JournaledCheck> {
  const narrowing = cfg.narrowedChecks?.[check];
  if (narrowing?.kind === 'off') {
    return { check, result: 'not-run', observation: 'switched off by the adapter', narrowed: narrowing.reason };
  }

  const verdict = await run();
  if (!Array.isArray(verdict)) return { check, result: 'not-run', observation: verdict.notRun };

  const reason = narrowing ? { narrowed: narrowing.reason } : {};
  const accepted = narrowing ? verdict.filter((observation) => narrowing.accept(observation)) : [];
  const violations = verdict.filter((observation) => !accepted.includes(observation));

  // Each violation by its signature. A known one is recorded and does not fail
  // the check, so the Route carries on past a bug already found; any other
  // violation on the same check still fails it.
  const findings = violations.map((violation) => {
    const signature = signatureOf(check, violation);
    const entry = known.get(signature);
    return {
      violation,
      record: {
        id: findingId(signature),
        signature,
        known: entry !== undefined,
        ...(entry?.issue ? { issue: entry.issue } : {}),
      },
    };
  });
  const unknown = findings.filter((finding) => !finding.record.known);
  const recorded = findings.length ? { findings: findings.map((finding) => finding.record) } : {};

  if (unknown.length) {
    return {
      check,
      result: 'failed',
      observation: unknown.map((finding) => finding.violation).join('\n'),
      ...reason,
      ...recorded,
    };
  }
  const notes = [
    ...(accepted.length ? [`accepted by the narrowing: ${accepted.join('\n')}`] : []),
    ...findings.map(
      ({ record }) => `known finding ${record.id}${record.issue ? `, issue ${record.issue}` : ', unfiled'}: ${record.signature}`
    ),
  ];
  return { check, result: 'passed', ...(notes.length ? { observation: notes.join('\n') } : {}), ...reason, ...recorded };
}

/** The checks that failed, if any. */
export function failedChecks(checks: readonly JournaledCheck[]): JournaledCheck[] {
  return checks.filter((check) => check.result === 'failed');
}

/**
 * Whether an accessibility tree holds nothing a person using a screen reader
 * could read: no text and no named element anywhere.
 *
 * **Narrow on purpose.** `docs/PLAN.md` carries "blank" as a hazard, since a
 * legitimately empty state would set off a broad definition. A screen with a
 * single word or a single named button on it is not blank here. Tuned against
 * `buggy`, and to be tuned again against the first real application rather
 * than against imagined cases.
 */
export function showsNothing(tree: unknown): boolean {
  const readable = (node: unknown): boolean => {
    if (typeof node === 'string') return node.trim() !== '';
    if (Array.isArray(node)) return node.some(readable);
    if (!node || typeof node !== 'object') return false;
    const { name, text, children } = node as { name?: unknown; text?: unknown; children?: unknown };
    return readable(name) || readable(text) || readable(children);
  };
  return !readable(tree);
}

const TIMED_OUT = Symbol('timed out');

/** How a call settled, where it did in time. */
type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * A promise's value, or TIMED_OUT when it has not settled within the wait.
 *
 * A promise that rejects rather than hangs has answered, just badly: the
 * process is there to reject. By default that counts as an answer with no
 * value; `rejections-too` hands the rejection back for the caller to rethrow.
 */
async function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined | typeof TIMED_OUT>;
async function within<T>(promise: Promise<T>, ms: number, keep: 'rejections-too'): Promise<Settled<T> | typeof TIMED_OUT>;
async function within<T>(
  promise: Promise<T>,
  ms: number,
  keep?: 'rejections-too'
): Promise<T | undefined | Settled<T> | typeof TIMED_OUT> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  const answered = keep
    ? promise.then(
        (value): Settled<T> => ({ ok: true, value }),
        (error: unknown): Settled<T> => ({ ok: false, error })
      )
    : promise.catch(() => undefined);
  try {
    return await Promise.race([answered, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function sizeOf(file: string): number {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

/** An error's message and the first frames, which is what a reader needs from a journal line. */
function firstLines(text: string): string {
  return text.split('\n').slice(0, 4).join('\n');
}

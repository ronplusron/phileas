import fs from 'node:fs';
import type { ElectronApplication, Page } from '@playwright/test';
import {
  UNIVERSAL_CHECKS,
  type AppCheck,
  type AppCheckContext,
  type AppUnderTest,
  type LogPath,
  type Narrowing,
  type UniversalCheck,
} from '../app-under-test.js';
import type { JournaledCheck } from '../journal.js';
import { currentSignature, findingId, refuseUnfitVarying, signatureOf, type KnownFindings } from '../known.mjs';
import {
  arrivalFields,
  arrivalOf,
  describePlaced,
  placeArrival,
  stepsBefore,
  type Arrival,
  type Observed,
  type StepSpan,
} from '../timeline.js';

/**
 * The checks, run after every Hop, Fix steps included (R15).
 *
 * **This is the part of phase 5 the Positron trial needs, not all of it.**
 * `docs/PLAN.md` has the trial and why it comes first. Six checks run here:
 * uncaught errors in either process, console errors, still responding, the
 * window still showing something, no unexpected dialog, and an error appended
 * to a log the adapter names. Two are not built yet, no navigation away (none
 * of it: the stub's recorder is read only by a fixture, and the
 * foreign-process half does not exist) and named controls, and every Hop's
 * journal line says so rather than leaving them out. After them run the checks
 * an adapter declares for its own application (R18), judged the same way;
 * `AppCheck` says where what they assert must come from.
 *
 * **Every check here was made to fire on a planted defect before it shipped.**
 * `tests/checks.spec.ts` has one per check, against `buggy` launched with that
 * defect's flag. A check that reads the same on a healthy and a broken
 * application is worse than none, because a Route that ends at the first
 * violation would never end.
 *
 * What is watched starts when the Route does. An uncaught renderer error no
 * Route saw, such as one during boot, is not a Hop's doing, and the page
 * fixture judges it instead. **Each error has exactly one judge:** the watch
 * notes every renderer error it saw, and the fixture leaves those alone, so a
 * known finding the Route carried on past does not fail the test at its end.
 * See `judgedByTheWatch`.
 */

/**
 * The order every Hop's line lists the checks in, so two lines compare by eye.
 * The list itself, since the check type is derived from it, so no check can
 * be left out.
 */
export const CHECK_ORDER: readonly UniversalCheck[] = UNIVERSAL_CHECKS;

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

/** The renderer errors a Route's watch saw, by page, so the fixture judges only the rest. */
const watched = new WeakMap<Page, Set<Error>>();

/**
 * Whether a Route's checks already judged this renderer error. The page
 * fixture fails a test on an uncaught renderer error at its end, and one the
 * watch saw was already judged on the Hop it happened, known finding and
 * narrowing included, so judging it again would second-guess that verdict.
 */
export function judgedByTheWatch(page: Page, error: Error): boolean {
  return watched.get(page)?.has(error) ?? false;
}

/**
 * An uncaught renderer error as the checks and a narrowing see it, so an
 * adapter's `accept` is handed one form wherever the error is judged.
 */
export function rendererObservation(error: Error): string {
  return `renderer: ${firstLines(error.stack ?? error.message)}`;
}

/**
 * A rejection saying the target is gone, rather than slow. A round trip to a
 * crashed or closed process rejects at once, and read as an answer that would
 * make a dead application pass still-responding.
 */
const GONE = /Target (?:page, context or browser )?(?:has been )?closed|crashed|has been closed|Process exited/i;

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
    readonly failed: readonly JournaledCheck[],
    /**
     * The Route's steps so far, Fix steps and Trip hops, so the failure can
     * say when each finding arrived and list the steps before it. Without
     * them it says only where the checks ran.
     */
    readonly steps?: readonly StepSpan[]
  ) {
    super(failureMessage(where, failed, steps));
    this.name = 'CheckFailure';
  }
}

/**
 * The failure's text. **Where the checks ran is not named as the cause.**
 * `timeline.ts` has the measured case: an error logged five Hops after the
 * Hop that caused it was charged to a button that triggers a different bug.
 */
function failureMessage(where: string, failed: readonly JournaledCheck[], steps: readonly StepSpan[] | undefined): string {
  // What failed each check: the unknown findings, or every one for
  // still-responding, which a known finding still fails.
  const failing = (check: JournaledCheck) =>
    (check.findings ?? []).filter((finding) => check.check === 'still-responding' || !finding.known);
  const blocks = failed.map((check) => {
    // One id per finding, however many times it was seen: a line logged
    // twice was listed as "finding 6f037ab8, 6f037ab8" until 2026-09-30.
    const ids = [...new Set(failing(check).map((finding) => finding.id))];
    const arrivals = steps
      ? [
          ...new Set(
            failing(check).flatMap((finding) => {
              const placed = placeArrival(arrivalOf(finding));
              return placed ? [`arrived ${describePlaced(placed, steps)}`] : [];
            })
          ),
        ]
      : [];
    return [
      `  ${check.check}: ${check.observation ?? ''}`,
      ...(ids.length ? [`  finding ${ids.join(', ')}`] : []),
      ...arrivals.map((arrival) => `  ${arrival}`),
    ].join('\n');
  });
  const count = failed.length === 1 ? 'A check' : `${failed.length} checks`;
  if (!steps?.length) return `${count} failed after ${where}:\n\n${blocks.join('\n')}`;

  // The steps before the earliest arrival, the first sign of what went wrong.
  // A span counts from its end, so no step that could have caused it is left
  // out; a finding with no time counts from now.
  const references = failed.flatMap((check) =>
    failing(check).flatMap((finding) => {
      const placed = placeArrival(arrivalOf(finding));
      return placed ? [placed.kind === 'moment' ? placed.at : placed.to] : [];
    })
  );
  const reference = references.length ? Math.min(...references) : Date.now();
  return (
    `${count} failed after ${where}, which is when the checks read it. The cause may be an earlier ` +
    `step: when it arrived, and the steps before it, are below.\n\n${blocks.join('\n')}\n\n` +
    `  Steps before it, latest first:\n${stepsBefore(reference, steps)
      .map((line) => `    ${line}`)
      .join('\n')}`
  );
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
 * The one console error the engine makes itself, which the console check sets
 * aside, matched whole.
 *
 * Every Route records a Playwright trace with DOM snapshots, and the trace's
 * snapshotter runs script in every frame. In a frame sandboxed without
 * `allow-scripts`, Chromium blocks it and logs this line. Reported on
 * 2026-10-03 from Bobolink Inbox, whose reader inserts such a frame and gives
 * it its content a moment later, where every Route that opened a message
 * failed on it and plain Playwright never saw it. Measured on `buggy` with five
 * frames inserted each: a trace with snapshots logged it 5 times, one with
 * screenshots only 0, and no trace 0. Chosen over tracing screenshots only,
 * which would lose the page's structure at each step from a failed Route's
 * trace. What it costs: an application that itself tries to run script in a
 * blank sandboxed frame goes unseen by this check.
 */
export const TRACE_SNAPSHOT_IN_SANDBOX =
  "Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.";

/**
 * What makes a log line a failure, for every application: a word ending in
 * "error", such as TypeError, GmailError or error itself, or one of fatal,
 * failed, failure, exception and panic.
 *
 * It was `error` as a whole word until 2026-10-03, which never matched an
 * error's class name, so "fatal: uncaught: TypeError" read as clean: reported
 * from Bobolink Inbox, whose log writes a failure's class and never its
 * message. Widened that day after counting real Positron and VS Code logs,
 * 6,533 lines: a word ending in "error" added 8 matches, each a real
 * exception, and the other words added 91, most of them debug lines such as
 * "Failed to find pixi". Chosen with both, in the words "I want 1 and 2".
 * A log whose own words for failure are none of these names a pattern of its
 * own, `LogPath.failsOn`, matched as well as this one.
 */
export const LOG_FAILURE = /\w*error\b|\b(?:fatal|failed|failure|exception|panic)\b/i;

/**
 * A stack frame at the start of a log line: `at fn (file:1:2)`, `at
 * file:1:2`, `at async Promise.all (index 0)`, or a Rust frame's `at
 * file.rs:263`. Measured on 2026-10-05 against every frame in 6,591 lines of
 * real Positron, VS Code and RStudio logs, 255 frames, and it matched all of
 * them, a tab or spaces before each and paths with spaces in them included.
 * The bare form is tried first, so a frame in parentheses never reaches past
 * its own closing one.
 */
export const STACK_FRAME = /^\s+at\s+(?:[^()\n]*?:\d+(?::\d+)?(?=\s|$)|[^()\n]*\([^()]*\))/;

/**
 * Whether a log line is a failure, by `LOG_FAILURE` or the log's own pattern.
 *
 * **A stack frame is read as part of the error above it, never as one of its
 * own.** A frame such as `at Object.error (…)` names a function called error,
 * and on Positron on 2026-09-27 one logged error became up to three findings
 * that way, each ending Routes until filed. What follows a frame on its line
 * is still read: the same measurement found a logger writing its next message
 * onto the last frame of a stack, "[Copilot] Failed to refresh models", which
 * is a failure of its own.
 */
export function logLineFails(line: string, own?: RegExp): boolean {
  const read = line.replace(STACK_FRAME, '');
  return LOG_FAILURE.test(read) || own?.test(read) === true;
}

/**
 * The logs to read, from a list or from the Route's profile folder.
 *
 * Refuses when the adapter names its logs by folder and no folder was given,
 * rather than reading none. The log check would then report "not run" on every
 * Hop for a reason that is the caller's mistake and not the adapter's choice.
 */
function resolveLogPaths(cfg: AppUnderTest, userDataDir: string | undefined): LogPath[] {
  if (typeof cfg.logPaths !== 'function') return cfg.logPaths ?? [];
  if (userDataDir === undefined) {
    throw new Error(
      "The adapter names its logs from the Route's profile folder, and runRoute was not given " +
        "one. Pass userDataDir from the test's fixture to runRoute."
    );
  }
  return cfg.logPaths(userDataDir);
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
export async function startWatching(options: WatchOptions): Promise<Watch> {
  const { page, app, cfg } = options;
  const appChecks = cfg.checks ?? [];
  // Before anything is watched, so a mistake in the declaration stops the
  // Route at its start rather than on its first Hop.
  assertAppChecks(appChecks);
  const varying = cfg.varyingInSignatures ?? [];
  refuseUnfitVarying(varying);
  // Under the rules in force now, so an entry written before a rule changed
  // still matches from a Route's first Hop, not only once a Journey's end has
  // rewritten the file.
  const known = new Map((options.known?.entries ?? []).map((entry) => [currentSignature(entry, varying), entry]));
  const responsiveTimeoutMs = options.responsiveTimeoutMs ?? DEFAULT_RESPONSIVE_TIMEOUT_MS;

  // Which of the application's windows this page is, read once at the start,
  // so that a page Playwright calls closed can be checked against the window
  // itself. Undefined where it could not be read, and then a close is taken
  // at its word, as it always was.
  const pageWindow = await within(
    app.browserWindow(page).then((window) => window.evaluate((w) => w.id)),
    responsiveTimeoutMs
  );
  const pageWindowId = typeof pageWindow === 'number' ? pageWindow : undefined;

  // **Each stamped when it arrives, not when a check reads it.** A check reads
  // what piled up since the last Hop, and the Hop it runs after is not always
  // the one that caused it; `timeline.ts` has the measured case.
  const pageErrors: Observed[] = [];
  const stalls: Observed[] = [];
  const consoleErrors: Observed[] = [];
  const dialogs: Observed[] = [];
  // Kept rather than drained: an application that has gone stays gone, and
  // the Route ends on the first Hop that reads it.
  const gone: Observed[] = [];
  const arrived = (text: string): Observed => ({ text, arrival: { at: Date.now() } });

  const seen = watched.get(page) ?? new Set<Error>();
  watched.set(page, seen);
  page.on('pageerror', (error) => {
    seen.add(error);
    pageErrors.push(arrived(rendererObservation(error)));
  });
  // **An application that stops is a failure, never an answer.** A crashed or
  // closed target rejects at once rather than hanging, so without these a
  // dead application passed still-responding, its other checks read "not
  // run", and a crash on the last Hop reported the Route as passed.
  page.on('crash', () => gone.push(arrived('the renderer crashed')));
  page.on('close', () => gone.push(arrived(WINDOW_CLOSED)));
  app.on('close', () => gone.push(arrived('the application closed')));
  app.process().on('exit', (code, signal) =>
    gone.push(arrived(`the main process exited${signal ? ` on ${signal}` : ` with code ${code}`}`))
  );
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text() !== TRACE_SNAPSHOT_IN_SANDBOX) {
      consoleErrors.push(arrived(message.text()));
    }
  });
  // A listener means Playwright no longer dismisses dialogs by itself, so this
  // one has to, or the page waits on a dialog nobody will answer.
  page.on('dialog', (dialog) => {
    dialogs.push(arrived(`${dialog.type()}: ${dialog.message()}`));
    dialog.dismiss().catch(() => undefined);
  });

  let mainWatched: string | undefined;
  try {
    await app.evaluate((_electron, key) => {
      // Stamped in the main process, on the machine's one clock, so an error
      // there is placed by when it was thrown rather than when it was read.
      const errors: { text: string; at: number }[] = [];
      (globalThis as Record<string, unknown>)[key] = errors;
      const text = (value: unknown) =>
        value instanceof Error ? (value.stack ?? value.message) : String(value);
      process.on('uncaughtException', (error) => errors.push({ text: text(error), at: Date.now() }));
      process.on('unhandledRejection', (reason) =>
        errors.push({ text: `unhandled rejection: ${text(reason)}`, at: Date.now() })
      );
    }, MAIN_ERRORS);
  } catch (error) {
    mainWatched = error instanceof Error ? error.message.split('\n')[0] : String(error);
  }

  // Where each log ended when the Route started, so only what a Hop appended
  // is read. A file that does not exist yet starts at nothing.
  const logOffsets = new Map<string, number>();
  // Logs the adapter marked as created on their first write, whose absence is
  // not a reason to say the check did not run.
  const createdOnFirstWrite = new Set<string>();
  // Each log's own reader of a line's time, where the adapter gives one.
  const timeOf = new Map<string, (line: string) => number | undefined>();
  // Each log's own failure pattern, where the adapter gives one, read beside LOG_FAILURE.
  const failsOn = new Map<string, RegExp>();
  // Since when each log's unread bytes may date: the last read that left
  // nothing behind. A line split across two reads started before the second.
  const unreadSince = new Map<string, number>();
  const watchedFrom = Date.now();
  for (const log of resolveLogPaths(cfg, options.userDataDir)) {
    const file = typeof log === 'string' ? log : log.path;
    if (typeof log !== 'string' && log.createdOnFirstWrite) createdOnFirstWrite.add(file);
    if (typeof log !== 'string' && log.timeOf) timeOf.set(file, log.timeOf);
    // Without its global and sticky flags, which make a pattern's test depend
    // on where the last one stopped: the same line could then fail one read
    // and pass the next.
    if (typeof log !== 'string' && log.failsOn) {
      failsOn.set(file, new RegExp(log.failsOn.source, log.failsOn.flags.replace(/[gy]/g, '')));
    }
    logOffsets.set(file, sizeOf(file) ?? 0);
    unreadSince.set(file, watchedFrom);
  }

  const readMain = async (): Promise<Observed[] | string> => {
    if (mainWatched !== undefined) return `the main process could not be watched: ${mainWatched}`;
    const read = app.evaluate(
      (_electron, key) => ((globalThis as Record<string, unknown>)[key] as { text: string; at: number }[]).splice(0),
      MAIN_ERRORS
    );
    const answer = await within(read, responsiveTimeoutMs);
    if (answer === TIMED_OUT) return 'the main process did not answer, so its errors could not be read';
    if (!Array.isArray(answer)) return 'the main process could not be read, so its errors are unknown';
    return answer.map((error) => ({ text: firstLines(error.text), arrival: { at: error.at } }));
  };

  /** A log line's own time, where the adapter reads one. A reader that throws is the adapter's fault, and says so. */
  const loggedAt = (file: string, line: string): number | undefined => {
    const read = timeOf.get(file);
    if (!read) return undefined;
    let at: number | undefined;
    try {
      at = read(line);
    } catch (error) {
      throw new Error(`The adapter's timeOf for ${file} threw on a line, which is a fault in the adapter: ${firstLine(error)}`);
    }
    return at !== undefined && Number.isFinite(at) ? at : undefined;
  };

  const readLogs = (): Verdict => {
    const found: Observed[] = [];
    const missing: string[] = [];
    const readAt = Date.now();
    for (const [file, offset] of logOffsets) {
      const size = sizeOf(file);
      // **A named log that does not exist is not a clean log.** Read as
      // nothing, a mistyped path or a log that moved passed on every Hop while
      // checking nothing; Positron's is named by a path measured once.
      if (size === undefined) {
        // Not written yet, for a log the adapter marked as appearing that way.
        if (!createdOnFirstWrite.has(file)) missing.push(file);
        continue;
      }
      // A log that shrank was rotated or truncated; read it from the start.
      const from = size < offset ? 0 : offset;
      if (size > from) {
        const handle = fs.openSync(file, 'r');
        try {
          const buffer = Buffer.alloc(size - from);
          fs.readSync(handle, buffer, 0, buffer.length, from);
          // **Whole lines only.** A logger that flushes by buffer size can end
          // a write mid-line, and reading to the end split "ERROR" across two
          // Hops, so neither half matched. What follows the last newline is
          // left for the next read.
          const end = buffer.lastIndexOf(0x0a) + 1;
          const since = unreadSince.get(file) ?? watchedFrom;
          const own = failsOn.get(file);
          for (const line of buffer.subarray(0, end).toString('utf8').split('\n')) {
            if (!logLineFails(line, own)) continue;
            const logged = loggedAt(file, line);
            const arrival: Arrival = { after: since, before: readAt, ...(logged === undefined ? {} : { loggedAt: logged }) };
            found.push({ text: `${file}: ${line.trim()}`, arrival });
          }
          logOffsets.set(file, from + end);
          if (end === buffer.length) unreadSince.set(file, readAt);
        } finally {
          fs.closeSync(handle);
        }
      } else {
        logOffsets.set(file, size);
        unreadSince.set(file, readAt);
      }
    }
    if (found.length === 0 && missing.length) {
      return { notRun: `${missing.join(', ')} does not exist, so it could not be read` };
    }
    return found;
  };

  const bounded: Watch['bounded'] = async (what, call, boundMs) => {
    const startedAt = Date.now();
    const answer = await within(call, boundMs + responsiveTimeoutMs, 'rejections-too');
    const tookMs = Date.now() - startedAt;
    // Stamped with when the call began, since that is when the application
    // stopped answering it.
    if (answer === TIMED_OUT) {
      stalls.push({
        text: `${what} was bounded to ${boundMs} ms and had not returned after ${tookMs} ms: the application stopped answering`,
        arrival: { at: startedAt },
      });
      return STALLED;
    }
    if (tookMs > boundMs + responsiveTimeoutMs) {
      stalls.push({
        text: `${what} was bounded to ${boundMs} ms and returned after ${tookMs} ms: the application did not answer for about ${Math.round((tookMs - boundMs) / 1000)} s`,
        arrival: { at: startedAt },
      });
    }
    return answer.ok ? answer.value : Promise.reject(answer.error);
  };

  const roundTrips = async (): Promise<Observed[]> => {
    const sentAt = Date.now();
    const [renderer, main] = await Promise.all([
      within(page.evaluate(() => true), responsiveTimeoutMs, 'rejections-too'),
      within(app.evaluate(() => true), responsiveTimeoutMs, 'rejections-too'),
    ]);
    const slow: Observed[] = [...gone, ...stalls.splice(0)];
    const judge = (answer: typeof renderer, who: string) => {
      if (answer === TIMED_OUT) {
        slow.push({ text: `the ${who} did not answer within ${responsiveTimeoutMs} ms`, arrival: { at: sentAt } });
      }
      // Any other rejection has answered, just badly: a reload destroying the
      // context mid-call is one, and the process is there to reject.
      else if (!answer.ok && GONE.test(firstLine(answer.error))) {
        slow.push({ text: `the ${who} could not be reached: ${firstLine(answer.error)}`, arrival: { at: sentAt } });
      }
    };
    judge(renderer, 'renderer');
    judge(main, 'main process');

    // **A page Playwright calls closed is not always a window the application
    // closed.** When the Mac slept for five seconds on 2026-09-28, two Routes
    // on two applications failed here with "the window closed", and one of
    // those windows was measured still open eleven minutes later. So where
    // the page's close is all that went, and the main process answers, it is
    // asked whether the page's own window still exists. If it does, the
    // engine lost its connection, which says nothing about the application:
    // the Route ends with that reason, and no finding is recorded against it.
    if (gone.length === 1 && gone[0]?.text === WINDOW_CLOSED && pageWindowId !== undefined && main !== TIMED_OUT && main.ok) {
      const open = await within(
        app.evaluate(({ BrowserWindow }, id) => {
          const window = BrowserWindow.fromId(id);
          return window !== null && !window.isDestroyed();
        }, pageWindowId),
        responsiveTimeoutMs,
        'rejections-too'
      );
      if (open !== TIMED_OUT && open.ok && open.value) throw new PageConnectionLost();
    }
    // One of each, the earliest kept, as the set of texts this replaced did.
    return slow.filter((observed, index) => slow.findIndex((other) => other.text === observed.text) === index);
  };

  return {
    bounded,
    async check(tree) {
      const judge = (check: UniversalCheck, run: () => Promise<Verdict> | Verdict) =>
        judged(check, cfg.narrowedChecks?.[check], known, varying, run);

      const universal = await Promise.all(
        CHECK_ORDER.map((check) => {
          switch (check) {
            case 'uncaught-error':
              return judge(check, async () => {
                // Already in `rendererObservation`'s form, prefix included.
                // Adding it here too once made every renderer finding read
                // "renderer: renderer: ", and a narrowing see a different form
                // here than in the fixture.
                const renderer = pageErrors.splice(0);
                const main = await readMain();
                if (typeof main === 'string') {
                  // Renderer errors are still evidence; only an empty result
                  // would claim something the unread main process cannot back.
                  return renderer.length ? renderer : { notRun: main };
                }
                return [...renderer, ...main.map((error) => ({ ...error, text: `main process: ${error.text}` }))];
              });
            case 'console-error':
              return judge(check, () => consoleErrors.splice(0));
            case 'still-responding':
              return judge(check, roundTrips);
            case 'window-showing-content':
              return judge(check, async () => {
                if (tree === undefined) return { notRun: 'the page did not answer, so what it shows could not be read' };
                if (!showsNothing(tree)) return [];
                // **A blank must last to fail.** Measured on RStudio 2026.10.0
                // on 2026-10-08: Session > Terminate R, then Yes, blanked the
                // page while it redrew for the session that went away, and the
                // next Hop, 0.3 s on, surveyed a full page; four Routes of 600
                // failed on it, and replays met it 2 times in 3. So the window
                // is read again until it shows something, for up to
                // BLANK_RECOVERY_MS, and only a window still blank fails. One
                // that recovers passes, recorded with how long it took, so a
                // brief blank that is a bug is still seen and counted.
                const afterMs = await shownAgainWithin(page, BLANK_RECOVERY_MS);
                return afterMs === undefined
                  ? [BLANK]
                  : { recovered: { afterMs, observation: `${BLANK}, and showed something again ${afterMs} ms later` } };
              });
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

      // The adapter's own, after the built-in ones and one at a time, so each
      // Hop's line lists them in the order they were declared. An adapter's
      // check is never narrowed: the adapter wrote it.
      const own: JournaledCheck[] = [];
      for (const appCheck of appChecks) {
        own.push(
          await judged(appCheck.name, undefined, known, varying, () =>
            runAppCheck(appCheck, { page, app, tree }, responsiveTimeoutMs)
          )
        );
      }
      return [...universal, ...own];
    },
  };
}

/**
 * An adapter's check broke, as opposed to finding something wrong.
 *
 * Its own class, and thrown rather than recorded as not run, so that a broken
 * check fails loudly instead of reading on every Hop like one that could not
 * look. A check that fails silently is the worst kind, since a Route that
 * ends at the first violation would never end.
 */
/** What still-responding records when the page's close is its evidence. */
const WINDOW_CLOSED = 'the window closed';

/**
 * Thrown when Playwright's page closed while the application's own window for
 * it is still open: the engine lost its connection, which is not a finding
 * about the application. Measured on 2026-09-28 after the Mac slept, when a
 * window reported closed was still open eleven minutes later.
 */
export class PageConnectionLost extends Error {
  constructor() {
    super(
      "The engine lost its connection to the page, while the application's window for it is still " +
        'open, so the Route cannot go on. This is not a finding about the application: it was ' +
        'seen after the Mac slept.'
    );
    this.name = 'PageConnectionLost';
  }
}

export class AdapterCheckError extends Error {
  constructor(
    readonly check: string,
    override readonly cause: unknown
  ) {
    super(`The adapter's check ${check} threw, which is a fault in the check rather than a finding: ${firstLine(cause)}`);
    this.name = 'AdapterCheckError';
  }
}

/**
 * Refuse checks an adapter declared that could not be told apart in a
 * journal or a signature: a name that is not lower-case words joined by
 * hyphens, one used twice, one a built-in check already has, or a check with
 * no reason given.
 */
export function assertAppChecks(checks: readonly AppCheck[]): void {
  const builtIn = new Set<string>(UNIVERSAL_CHECKS);
  const seen = new Set<string>();
  for (const check of checks) {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(check.name)) {
      throw new Error(`The adapter's check ${JSON.stringify(check.name)} is not named in lower-case words joined by hyphens.`);
    }
    if (builtIn.has(check.name)) {
      throw new Error(`The adapter's check ${check.name} has the name of a built-in check. Name it for what it asserts.`);
    }
    if (seen.has(check.name)) {
      throw new Error(`The adapter declares two checks named ${check.name}, and a journal could not tell them apart.`);
    }
    if (!check.why.trim()) {
      throw new Error(`The adapter's check ${check.name} gives no reason in why, which the report needs.`);
    }
    seen.add(check.name);
  }
}

/**
 * One adapter check, bounded by the responsive wait.
 *
 * A check that does not answer in time, or cannot reach an application that
 * has gone, could not look, and says so; still-responding is the check that
 * judges a hang or a crash. Anything else it throws is the check's own fault.
 */
async function runAppCheck(check: AppCheck, context: AppCheckContext, responsiveTimeoutMs: number): Promise<Verdict> {
  const answer = await within(
    Promise.resolve().then(() => check.run(context)),
    responsiveTimeoutMs,
    'rejections-too'
  );
  if (answer === TIMED_OUT) return { notRun: `it did not answer within ${responsiveTimeoutMs} ms` };
  if (!answer.ok) {
    if (GONE.test(firstLine(answer.error))) {
      return { notRun: `the application could not be reached: ${firstLine(answer.error)}` };
    }
    throw new AdapterCheckError(check.name, answer.error);
  }
  const verdict = answer.value;
  return 'notRun' in verdict ? { notRun: verdict.notRun } : [...verdict];
}

/**
 * What a check found: its violations, or why it could not look. A violation
 * is stamped with when it arrived where the check knows; a bare string was
 * seen when the check ran.
 */
type Verdict =
  | (string | Observed)[]
  | { notRun: string }
  | { recovered: { afterMs: number; observation: string } };

/** What window-showing-content observes of a window that shows nothing. */
const BLANK = 'the window shows nothing a screen reader could read: no text and no named element';

/**
 * How long a blank window is read again before window-showing-content fails
 * it, and how often. Two seconds is a reading, not a measurement: RStudio's
 * blank on ending its R session was gone within 0.3 s, and this leaves room
 * for a slower machine without holding a Hop long.
 */
export const BLANK_RECOVERY_MS = 2_000;
const BLANK_REREAD_MS = 200;

/**
 * How many milliseconds after now the page showed something again, read every
 * `BLANK_REREAD_MS`, or undefined if it was still blank, or never answered,
 * when `waitMs` ran out. Bounded: each read is given only what is left.
 */
async function shownAgainWithin(page: Page, waitMs: number): Promise<number | undefined> {
  const started = Date.now();
  for (;;) {
    const left = waitMs - (Date.now() - started);
    if (left <= 0) return undefined;
    await new Promise((resolve) => setTimeout(resolve, Math.min(BLANK_REREAD_MS, left)));
    const remaining = waitMs - (Date.now() - started);
    if (remaining <= 0) return undefined;
    const tree = await page
      .locator('body')
      .ariaSnapshotJSON({ timeout: remaining })
      .catch(() => undefined);
    if (tree !== undefined && !showsNothing(tree)) return Date.now() - started;
  }
}

/**
 * One check's verdict, with the adapter's narrowing applied (R19).
 *
 * A check switched off is recorded as not run, with the adapter's reason,
 * and is never run at all, so a check that would hang is not waited on.
 */
async function judged(
  check: string,
  narrowing: Narrowing | undefined,
  known: ReadonlyMap<string, { readonly issue?: string; readonly falseAlarm?: string }>,
  varying: readonly (readonly [RegExp, string])[],
  run: () => Promise<Verdict> | Verdict
): Promise<JournaledCheck> {
  if (narrowing?.kind === 'off') {
    return { check, result: 'not-run', observation: 'switched off by the adapter', narrowed: narrowing.reason };
  }

  const verdict = await run();
  if (!Array.isArray(verdict)) {
    if ('recovered' in verdict) {
      const { afterMs, observation } = verdict.recovered;
      return { check, result: 'passed', observation, recovered: { afterMs }, ...(narrowing ? { narrowed: narrowing.reason } : {}) };
    }
    return { check, result: 'not-run', observation: verdict.notRun };
  }
  const checkedAt = Date.now();
  const observed = verdict.map((entry): Observed => (typeof entry === 'string' ? { text: entry, arrival: { at: checkedAt } } : entry));

  const reason = narrowing ? { narrowed: narrowing.reason } : {};
  const accepted = narrowing ? observed.filter((entry) => narrowing.accept(entry.text)).map((entry) => entry.text) : [];
  const violations = observed.filter((entry) => !accepted.includes(entry.text));

  // Each violation by its signature. A known one is recorded and does not fail
  // the check, so the Route carries on past a bug already found; any other
  // violation on the same check still fails it. When it arrived goes on the
  // record beside the signature and never into it, so a finding that arrives
  // late keeps its id.
  const findings = violations.map(({ text: violation, arrival }) => {
    const signature = signatureOf(check, violation, undefined, varying);
    const entry = known.get(signature);
    return {
      violation,
      record: {
        id: findingId(signature),
        signature,
        known: entry !== undefined,
        ...(entry?.issue ? { issue: entry.issue } : {}),
        ...(entry?.falseAlarm !== undefined ? { falseAlarm: entry.falseAlarm } : {}),
        ...arrivalFields(arrival),
      },
    };
  });
  // **Except an application that has stopped answering.** A hung application
  // cannot be traveled, and a Route carried past a known hang walks into
  // calls that wait on it, so that check ends the Route known or not (R16).
  // The finding is still recorded as known, so the Journey's summary counts
  // it as seen rather than new.
  const unknown = check === 'still-responding' ? findings : findings.filter((finding) => !finding.record.known);
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

/** A file's size, or undefined when it does not exist. Any other failure to read it is thrown. */
function sizeOf(file: string): number | undefined {
  try {
    return fs.statSync(file).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** The first line of whatever was thrown. */
function firstLine(error: unknown): string {
  return error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
}

/** An error's message and the first frames, which is what a reader needs from a journal line. */
function firstLines(text: string): string {
  return text.split('\n').slice(0, 4).join('\n');
}

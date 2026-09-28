import fs from 'node:fs';
import { test as base, expect, type ElectronApplication, type Page } from '@playwright/test';
import type { AppUnderTest } from './app-under-test';
import { launchApp, closeApp, makeUserDataDir, removeProfile, type LaunchedApp } from './launch';
import { openedExternally } from './external';
import { judgedByTheWatch, rendererObservation } from './oracles/index';
import { answered } from './survey';

/** How long each diagnostic at a test's end may wait on the application. */
const DIAGNOSTIC_TIMEOUT_MS = 5_000;

export type PhileasFixtures = {
  /** A disposable userData directory, thrown away when the test ends. */
  userDataDir: string;
  /** The launched application, with what the engine collected from it. */
  launched: LaunchedApp;
  app: ElectronApplication;
  page: Page;
  /** URLs the application tried to hand to shell.openExternal. Nothing opened. */
  externalUrls: () => Promise<string[]>;
};

/**
 * Build a Playwright `test` bound to one application.
 *
 * The application is TEST-scoped: launched fresh for each test, with its own
 * userData directory, and closed when the test ends. The lifted version reused
 * one process across every test a worker ran and reset by reloading the
 * renderer, which saved roughly half a second per test and cost correctness
 * the engine cannot afford: main-process state survives a reload, so a test
 * would begin from whatever the previous one left behind. Under the Route
 * mapping that is the inheritance R3 forbids, and a state-leakage bug is
 * exactly what this engine exists to find, so it must not be the thing hiding
 * one.
 *
 * Overriding the built-in `page` fixture is not cosmetic, it is what the rest
 * depends on: the stock one resolves `context`, which resolves `browser`,
 * which would try to launch a Chromium that is not installed here. Fixtures
 * are lazy, so as long as no spec touches `context` or `browser`, they are
 * never built.
 *
 * House rule that follows: no spec may use the `context` or `browser` fixtures.
 *
 * Each Route is already a test built on this, with its own timeout from the
 * Journey's terms. Not done yet: the Fix as a `beforeEach`, each Hop as a
 * `test.step`, and a way to show a stranded Route as neither passed nor
 * failed, which phase 5 schedules.
 */
export function createTest(cfg: AppUnderTest) {
  return base.extend<PhileasFixtures>({
    userDataDir: async ({}, use) => {
      const dir = await makeUserDataDir(cfg);
      await use(dir);
      await removeProfile(dir, cfg.profileWatchMs);
    },

    launched: async ({ userDataDir }, use, testInfo) => {
      const launched = await launchApp(cfg, userDataDir);

      // The staleness guard not running is not the same as it passing, and a
      // reader who is told nothing will read it as the second. C1a and the
      // deliberate skip both land here.
      //
      // Attached where the application is launched rather than where a page is
      // resolved. It used to live in the `page` fixture, which made reporting
      // the verdict a property of which fixture a spec happened to touch: a
      // spec using `launched` or `app` and never `page` produced no attachment
      // at all, and this engine's own suite is written exactly that way.
      if (!launched.guard.ran) {
        await testInfo.attach('staleness-guard.txt', {
          body: launched.guard.detail,
          contentType: 'text/plain',
        });
      }

      try {
        await use(launched);
      } finally {
        // Attached in the teardown that always runs, rather than after the test
        // body. A boot failure is the likeliest way for a Route to end early
        // and the one whose reason is almost always in main-process stderr,
        // and it was the one case that discarded it.
        // Narrowed rather than read through an optional. Under the
        // debugging-port path there is no process to have written anything, and
        // an empty attachment there would say "the application printed nothing"
        // when the truth is that nobody could have seen it.
        if (launched.path === 'electron' && launched.stderr.length) {
          await testInfo.attach('main-stderr.txt', {
            body: launched.stderr.join(''),
            contentType: 'text/plain',
          });
        }
        if (launched.consoleErrors.length) {
          await testInfo.attach('renderer-console-errors.txt', {
            body: launched.consoleErrors.join('\n'),
            contentType: 'text/plain',
          });
        }

        // A shutdown that throws is a finding, not noise: an application that
        // hangs on exit is a defect class this engine exists to find, and at
        // one launch per Route a leak costs one stray process per Route. It
        // must not replace the test's own failure, so it is reported rather
        // than thrown.
        try {
          const closed = await closeApp(cfg, launched);
          if (closed.forced) {
            await testInfo.attach('teardown-forced-kill.txt', {
              body: closed.detail,
              contentType: 'text/plain',
            });
          }
        } catch (error) {
          await testInfo.attach('teardown-failure.txt', {
            body: error instanceof Error ? (error.stack ?? error.message) : String(error),
            contentType: 'text/plain',
          });
        }
      }
    },

    app: async ({ launched }, use) => {
      await use(launched.app);
    },

    page: async ({ launched }, use, testInfo) => {
      const page = cfg.selectPage
        ? await cfg.selectPage(launched.app)
        : await launched.app.firstWindow();

      // Started before readiness is waited on, not after. A boot failure used
      // to happen outside the trace entirely, so the one ending whose reason is
      // hardest to guess was the one with no recording of it.
      await launched.app.context().tracing.start({ screenshots: true, snapshots: true });

      let thrown: unknown;
      try {
        await cfg.waitForReady(page);
        await use(page);
      } catch (error) {
        // Held rather than allowed to propagate, so that the evidence below is
        // collected first, and rethrown unchanged once it has been.
        thrown = error;
      }

      // The renderer-exception verdict is reached BEFORE the trace is stopped.
      // It used to be decided afterwards, so the one failure the check exists
      // for -- the application throwing where nothing happens to look -- was
      // the one that reached the report with the trace already discarded.
      //
      // Only the errors no Route's watch saw. One the watch saw was judged on
      // the Hop it happened, with known findings and the narrowing applied,
      // and judging it again here failed a test whose Route had correctly
      // carried on past a known finding. What is left is what happened before
      // a Route watched, such as during boot, or with no Route at all.
      const narrowed = cfg.narrowedChecks?.['uncaught-error'];
      const { unjudged, unacceptable } = rendererVerdict(cfg, page, launched.pageErrors);

      // R19: every narrowing reaches the report, whatever the outcome. The
      // interface states that as a contract and nothing read `reason`, so a
      // check switched off was indistinguishable from one that passed -- which
      // is the thing the contract was written to prevent.
      if (narrowed) {
        const suppressed = unjudged.filter((error) => !unacceptable.includes(error));
        await testInfo.attach('narrowed-checks.txt', {
          body:
            `uncaught-error was narrowed for this run.\n\nReason: ${narrowed.reason}\n\n` +
            (narrowed.kind === 'off' ? 'The check is off entirely for this run.\n\n' : '') +
            (suppressed.length
              ? `Suppressed by it:\n\n${suppressed
                  .map((error) => error.stack ?? error.message)
                  .join('\n\n')}`
              : 'Nothing was suppressed by it during this test.'),
          contentType: 'text/plain',
        });
      }

      const failed =
        testInfo.status !== testInfo.expectedStatus || thrown !== undefined || unacceptable.length > 0;

      if (failed) {
        // page.screenshot goes through the compositor over CDP, so it works on
        // a machine that grants no screen-recording permission at all.
        //
        // The reason a diagnostic is missing is itself a diagnostic: a
        // screenshot that fails because the renderer is hung says something
        // about the application, and a report that simply lacks the file does
        // not distinguish that from a page that had already closed.
        //
        // Bounded, like everything else that talks to the application: a hung
        // one would otherwise hold the test's end for as long as it hangs.
        const shot = await screenshotWithin(page, DIAGNOSTIC_TIMEOUT_MS);
        if (Buffer.isBuffer(shot)) {
          await testInfo.attach('window.png', { body: shot, contentType: 'image/png' });
        } else {
          await testInfo.attach('window-png-failed.txt', {
            body: shot.stack ?? shot.message,
            contentType: 'text/plain',
          });
        }

        const html = await answered('the page, asked for its DOM,', page.content(), DIAGNOSTIC_TIMEOUT_MS).catch(
          (error: Error) => error
        );
        if (typeof html === 'string') {
          await testInfo.attach('dom.html', { body: html, contentType: 'text/html' });
        } else {
          await testInfo.attach('dom-html-failed.txt', {
            body: html.stack ?? html.message,
            contentType: 'text/plain',
          });
        }
      }

      // Guarded, like the screenshot and the DOM above: an application that
      // has gone takes its trace with it, and the reason the trace is missing
      // must not replace the failure that explains why it went.
      const tracePath = testInfo.outputPath('trace.zip');
      const traced = await answered(
        'the application, asked to stop its trace,',
        launched.app.context().tracing.stop(failed ? { path: tracePath } : {}),
        DIAGNOSTIC_TIMEOUT_MS
      ).then(
          () => undefined,
          (error: Error) => error
        );
      if (traced) {
        await testInfo.attach('trace-failed.txt', { body: traced.stack ?? traced.message, contentType: 'text/plain' });
      } else if (failed && fs.existsSync(tracePath)) {
        await testInfo.attach('trace', { path: tracePath, contentType: 'application/zip' });
      }

      if (thrown !== undefined) throw thrown;

      // An uncaught renderer exception fails the test even when every assertion
      // passed: the application throwing where nothing happens to look is
      // precisely the failure a green suite would otherwise hide.
      if (testInfo.status === testInfo.expectedStatus && unacceptable.length > 0) {
        throw new Error(
          `The renderer threw during this test:\n\n` +
            unacceptable.map((error) => error.stack ?? error.message).join('\n\n')
        );
      }
    },

    externalUrls: async ({ app }, use) => {
      await use(() => openedExternally(app));
    },
  });
}

export { expect };

/**
 * The page fixture's own verdict on uncaught renderer errors: those no Route's
 * watch saw, and of those the ones the adapter's narrowing does not accept.
 * Its own function so the verdict can be tested without failing a test to see it.
 */
/**
 * A screenshot of the page, or why there is none, within a bound the engine
 * keeps itself.
 *
 * Playwright's own screenshot timeout is not enough. On RStudio on
 * 2026-09-28, with a native print dialog blocking the page, a screenshot given
 * a 5-second timeout had not returned 60 seconds later, and returned only
 * when the process was killed. The failed Route's teardown waited on it, so
 * the whole Journey sat until someone closed the dialog, three times that
 * day: twice after a print dialog and once after the Mac slept. Every other
 * diagnostic here was already bounded by the engine, and this one alone
 * trusted Playwright's.
 */
export function screenshotWithin(page: Pick<Page, 'screenshot'>, timeoutMs: number): Promise<Buffer | Error> {
  return answered(
    'the page, asked for a screenshot,',
    page.screenshot({ timeout: timeoutMs }),
    timeoutMs
  ).catch((error: Error) => error);
}

export function rendererVerdict(
  cfg: AppUnderTest,
  page: Page,
  errors: readonly Error[]
): { unjudged: Error[]; unacceptable: Error[] } {
  const narrowed = cfg.narrowedChecks?.['uncaught-error'];
  const unjudged = errors.filter((error) => !judgedByTheWatch(page, error));
  if (!narrowed) return { unjudged, unacceptable: unjudged };
  if (narrowed.kind === 'off') return { unjudged, unacceptable: [] };
  // Handed the same form the check hands it, so one predicate serves both.
  return { unjudged, unacceptable: unjudged.filter((error) => !narrowed.accept(rendererObservation(error))) };
}

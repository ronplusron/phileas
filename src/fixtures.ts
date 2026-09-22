import fs from 'node:fs';
import { test as base, expect, type ElectronApplication, type Page } from '@playwright/test';
import type { AppUnderTest } from './app-under-test';
import { launchApp, closeApp, makeUserDataDir, type LaunchedApp } from './launch';
import { openedExternally } from './external';

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
 * This is not yet the Route fixture. Fix as `beforeEach`, the hop steps, the
 * Route's own timeout and the stranded outcome arrive with the phase that
 * makes a Route a test; what is here is the launch and teardown they build on.
 */
export function createTest(cfg: AppUnderTest) {
  return base.extend<PhileasFixtures>({
    userDataDir: async ({}, use) => {
      const dir = await makeUserDataDir(cfg);
      await use(dir);
      await fs.promises.rm(dir, { recursive: true, force: true });
    },

    launched: async ({ userDataDir }, use) => {
      const launched = await launchApp(cfg, userDataDir);
      try {
        await use(launched);
      } finally {
        await closeApp(cfg, launched).catch(() => {});
      }
    },

    app: async ({ launched }, use) => {
      await use(launched.app);
    },

    page: async ({ launched }, use, testInfo) => {
      const page = cfg.selectPage
        ? await cfg.selectPage(launched.app)
        : await launched.app.firstWindow();
      await cfg.waitForReady(page);

      // The staleness guard not running is not the same as it passing, and a
      // reader who is told nothing will read it as the second. C1a and the
      // deliberate skip both land here.
      if (!launched.guard.ran) {
        await testInfo.attach('staleness-guard.txt', {
          body: launched.guard.detail,
          contentType: 'text/plain',
        });
      }

      await launched.app.context().tracing.start({ screenshots: true, snapshots: true });

      await use(page);

      const failed = testInfo.status !== testInfo.expectedStatus;

      if (failed) {
        // page.screenshot goes through the compositor over CDP. It needs no
        // Screen Recording permission, which is withheld on this machine on
        // purpose.
        const shot = await page.screenshot().catch(() => null);
        if (shot) await testInfo.attach('window.png', { body: shot, contentType: 'image/png' });
        const html = await page.content().catch(() => null);
        if (html) await testInfo.attach('dom.html', { body: html, contentType: 'text/html' });
      }

      const tracePath = testInfo.outputPath('trace.zip');
      await launched.app.context().tracing.stop(failed ? { path: tracePath } : {});
      if (failed && fs.existsSync(tracePath)) {
        await testInfo.attach('trace', { path: tracePath, contentType: 'application/zip' });
      }

      if (launched.stderr.length) {
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

      // An uncaught renderer exception fails the test even when every assertion
      // passed: the application throwing where nothing happens to look is
      // precisely the failure a green suite would otherwise hide. Skipped when
      // the test already failed, so the original failure stays the reported one.
      //
      // The switch is R19's general narrowing rather than a flag of its own. An
      // application that declares this check narrowed says why, and the reason
      // reaches the report instead of being a silent boolean.
      const narrowed = cfg.narrowedChecks?.['uncaught-error'];
      if (!failed && launched.pageErrors.length > 0) {
        const unacceptable = narrowed?.accept
          ? launched.pageErrors.filter(
              (error) => !narrowed.accept?.(error.stack ?? error.message)
            )
          : narrowed
            ? []
            : launched.pageErrors;
        if (unacceptable.length > 0) {
          throw new Error(
            `The renderer threw during this test:\n\n` +
              unacceptable.map((error) => error.stack ?? error.message).join('\n\n')
          );
        }
      }
    },

    externalUrls: async ({ app }, use) => {
      await use(() => openedExternally(app));
    },
  });
}

export { expect };

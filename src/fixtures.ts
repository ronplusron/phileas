import fs from 'node:fs';
import { test as base, expect, type ElectronApplication, type Page } from '@playwright/test';
import type { AppUnderTest } from './app-under-test';
import { launchApp, closeApp, resetApp, makeUserDataDir, type LaunchedApp } from './launch';
import { openedExternally } from './external';

export type KitWorkerFixtures = {
  /** A disposable userData directory, shared by every test in the worker. */
  userDataDir: string;
  /** The app process, launched once per worker. Prefer `app` and `page`. */
  launched: LaunchedApp;
};

export type KitFixtures = {
  app: ElectronApplication;
  page: Page;
  /** URLs the app tried to hand to shell.openExternal. Nothing actually opened. */
  externalUrls: () => Promise<string[]>;
  /**
   * An app instance of this test's own, with its own userData directory, closed
   * when the test ends.
   *
   * For the few tests that cannot share the worker's app: ones that break the
   * main process on purpose, or that need to quit and relaunch to check what
   * persisted. Reaching for this instead of restoring whatever was broken means
   * a test that fails halfway still cannot damage the tests after it.
   *
   * Lazy, like every fixture: a test that does not ask for it pays nothing.
   * Tests using it should not also use `page`, which would start the shared app
   * as well.
   */
  freshApp: LaunchedApp;
};

/**
 * Build a Playwright `test` bound to one app.
 *
 * The app is WORKER-scoped: launched once and reused across every test the
 * worker runs, rather than a fresh process per test. That trades roughly half a
 * second per test for having to reset between tests, which resetApp does.
 *
 * What makes this safe rather than merely fast is Playwright's own rule:
 * "Workers are always shutdown after a test failure to guarantee pristine
 * environment for following tests." So a failed test, or one that takes the app
 * down with it, cannot poison the tests after it; the next test gets a new
 * worker and therefore a newly launched app. The cost lands on failing runs,
 * which pay a relaunch per failure.
 *
 * Overriding the built-in `page` fixture is not cosmetic, it is what the rest
 * depends on: the stock one resolves `context`, which resolves `browser`, which
 * would try to launch a Chromium that is not installed here. Fixtures are lazy,
 * so as long as no spec touches `context` or `browser`, they are never built.
 *
 * House rule that follows: no spec may use the `context` or `browser` fixtures.
 */
export function createTest(cfg: AppUnderTest) {
  return base.extend<KitFixtures, KitWorkerFixtures>({
    userDataDir: [
      async ({}, use) => {
        const dir = await makeUserDataDir(cfg);
        await use(dir);
        await fs.promises.rm(dir, { recursive: true, force: true });
      },
      { scope: 'worker' },
    ],

    launched: [
      async ({ userDataDir }, use) => {
        const launched = await launchApp(cfg, userDataDir);
        await use(launched);
        await closeApp(launched);
      },
      { scope: 'worker' },
    ],

    app: async ({ launched }, use) => {
      await use(launched.app);
    },

    page: async ({ launched }, use, testInfo) => {
      // Reset BEFORE the test rather than after. A test that fails partway
      // leaves the app wherever it stopped, and cleaning up in teardown puts a
      // possible second failure somewhere much harder to read. Resetting up
      // front also means the first test in a worker takes the same path as
      // every other one, instead of being the single case that skips it.
      const page = await resetApp(cfg, launched);

      // Tracing is per test, started on the shared context after the reset so a
      // trace holds this test and nothing that ran before it.
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
      // passed: the app throwing where nothing happens to look is precisely the
      // failure a green suite would otherwise hide. Skipped when the test
      // already failed, so the original failure stays the reported one.
      if ((cfg.failOnPageError ?? true) && launched.pageErrors.length > 0 && !failed) {
        throw new Error(
          `The renderer threw during this test:\n\n` +
            launched.pageErrors.map((error) => error.stack ?? error.message).join('\n\n')
        );
      }
    },

    externalUrls: async ({ app }, use) => {
      await use(() => openedExternally(app));
    },

    freshApp: async ({}, use) => {
      const dir = await makeUserDataDir(cfg);
      const launched = await launchApp(cfg, dir);
      try {
        await use(launched);
      } finally {
        await closeApp(launched).catch(() => {});
        await fs.promises.rm(dir, { recursive: true, force: true });
      }
    },
  });
}

export { expect };

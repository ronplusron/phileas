import type { Page } from '@playwright/test';

/**
 * The whole contract between the reusable kit and one particular app.
 *
 * Everything else in e2e/kit/ depends only on this interface and Playwright.
 * Nothing in here knows a selector, a view name, or anything about a corpus.
 * That is deliberate: this directory is meant to be lifted out into a shared
 * package that the sibling Electron apps consume, each supplying its own
 * implementation of this interface and nothing else.
 */
export interface AppUnderTest {
  /**
   * Must match `productName` in package.json. Both the dist directory and the
   * executable inside Contents/MacOS/ are named after it.
   */
  productName: string;

  /** Absolute path to the repo root. */
  repoRoot: string;

  /**
   * Override when the packager output is laid out differently. Default is
   * dist/<productName>-darwin-arm64/<productName>.app
   */
  bundleDir?: string;

  /**
   * Repo-relative files and directories that the packager copies into app.asar
   * and the app actually loads. This drives the staleness guard, so anything
   * omitted here can drift out of date without the suite noticing. Keep it in
   * sync with the --ignore flags in the package script.
   */
  packagedInputs: string[];

  /** Return true to skip a path under packagedInputs (caches, .DS_Store, and so on). */
  ignoreInput?: (relativePath: string) => boolean;

  /**
   * Resolve once the app is usable.
   *
   * Must THROW, with the app's own message, when the app booted into an error
   * state. An implementation that only waits for a success marker turns a clear
   * failure into a timeout, which reports as "did not appear" and says nothing
   * about why.
   */
  waitForReady(page: Page): Promise<void>;

  /** Extra command-line arguments added to every launch. */
  launchArgs?: string[];

  /** Whether an uncaught renderer exception fails the test. Defaults to true. */
  failOnPageError?: boolean;
}

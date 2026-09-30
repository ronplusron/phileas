import path from 'node:path';
import { requireAppDir, showWindows, type AppUnderTest } from '@drugstoresushi/phileas';
import type { ElectronApplication, Page } from '@playwright/test';

/**
 * The adapter for Bobolink Editor, pointed at a checkout of it that has been
 * built and packaged.
 *
 * PHILEAS_APP_DIR names the checkout, not the bundle: the bundle is found
 * inside it, and the checkout is what the staleness guard compares against.
 * This is the second deployment shape, chosen on 2026-09-30 over a directory
 * in the editor's own repository, whose CI runs `npm ci` and could not reach
 * this one.
 *
 * Everything the editor is told at launch it already reads for its own
 * end-to-end suite, in `tests/e2e/harness.ts` there; nothing here adds a
 * switch to the application.
 */
const appDir = requireAppDir();

export const editor: AppUnderTest = {
  productName: 'Bobolink Editor',

  // electron-builder's layout for an arm64 Mac, from `productName` in
  // electron-builder.yml. Neither part matches the engine's old default,
  // confirmed against the built bundle on 2026-09-21.
  bundleDir: path.join(appDir, 'dist', 'mac-arm64', 'Bobolink Editor.app'),

  // What electron-builder.yml's `files` puts into app.asar: the build in
  // `out/`, less the licenses, which go to Resources instead. `out/` is
  // itself built from `src/` by `npm run build`, and this guard cannot see
  // that step: an edit to `src/` that was never built is invisible to it.
  // `npm run dist` does both, so a bundle made that way is current.
  staleness: {
    sourceRoot: appDir,
    packagedInputs: ['out', 'package.json'],
    ignoreInput: (relative) => relative.startsWith('out/licenses/') || path.basename(relative) === '.DS_Store',
  },

  env: (userDataDir) => ({
    // Never show the window on its own; the engine's window mode decides.
    // Also the gate on EDITOR_SEARCH_HOME below, which the app honors only
    // with this set.
    EDITOR_HEADLESS: '1',
    // Show it after all, without focus, when the run is to be watched. Under
    // EDITOR_HEADLESS the app otherwise never calls show() at all, so a run
    // with PHILEAS_SHOW=back drew nothing.
    ...(showWindows() ? { EDITOR_SHOW_WINDOW: '1' } : {}),
    // The editor sets its own settings folder with app.setPath, over the
    // --user-data-dir the engine passes, so the profile has to be named to it
    // here too, or every Route would share the real one.
    EDITOR_USER_DATA: userDataDir,
    // The home folder whose Desktop, Documents and Downloads a moved file is
    // looked for in: the Route's profile rather than the real one.
    EDITOR_SEARCH_HOME: userDataDir,
  }),

  exclusions: {
    // Nothing yet. Quit, Hide and the clipboard are standard entries the
    // engine skips by default, and the app's own File, Edit, Format, View,
    // Document and Help menus are drawn in the page with nothing in them
    // that leaves the application. Open, Save As and Export go through
    // native dialogs, which the engine answers as cancelled.
  },

  /**
   * Quit without the unsaved-work question.
   *
   * Quitting asks first when anything is unsaved, and a Route that typed
   * anything has something unsaved. The question is drawn in the page, so
   * nothing would answer it and every close would wait for the engine's
   * forced kill. The editor's own suite closes the same way, through
   * `closeApp` in its harness, and the session is still written as the page
   * goes away.
   */
  async shutdown(app: ElectronApplication): Promise<void> {
    await app.evaluate(() => {
      (globalThis as { editorQuitWithoutAsking?: boolean }).editorQuitWithoutAsking = true;
    });
  },

  /**
   * Ready once the menu bar the page draws is showing. What the editor shows
   * when it boots into an error is not measured, so there is nothing yet to
   * report in its own words, and a failed boot ends as a timeout.
   */
  async waitForReady(page: Page): Promise<void> {
    await page.getByRole('menubar').first().waitFor({ state: 'visible', timeout: 30_000 });
  },
};

export default editor;

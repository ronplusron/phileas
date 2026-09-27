import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppUnderTest } from '@drugstoresushi/phileas';
import type { Page } from '@playwright/test';

/** The adapter for Eighty Days: how to start it, when it is ready, what to leave alone. */
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..', '..');

/** The ship's log, one per Route, in the Route's own profile folder. */
const shipLog = (userDataDir: string) => path.join(userDataDir, 'ship.log');

export const eightyDays: AppUnderTest = {
  productName: 'Eighty Days',
  bundleDir: path.join(appRoot, 'dist', 'Eighty Days-darwin-arm64', 'Eighty Days.app'),

  staleness: {
    sourceRoot: appRoot,
    packagedInputs: ['main.cjs', 'preload.cjs', 'renderer', 'data', 'package.json'],
  },

  // The game writes its log where it is told, and the log check reads the
  // same file.
  env: (userDataDir) => ({ EIGHTY_DAYS_LOG: shipLog(userDataDir) }),
  logPaths: (userDataDir) => [shipLog(userDataDir)],

  exclusions: {
    // The one way out of the game from the page. Quit and the Edit menu's
    // entries are standard ones, which the engine skips by default.
    names: ['Read the book at Project Gutenberg'],
  },

  async waitForReady(page: Page): Promise<void> {
    const settled = page.locator('#status[data-ready="true"], #status[data-ready="failed"]');
    await settled.waitFor({ state: 'attached', timeout: 10_000 });
    const status = page.locator('#status');
    if ((await status.getAttribute('data-ready')) === 'failed') {
      throw new Error(`Eighty Days did not start: ${await status.textContent()}`);
    }
  },
};

export default eightyDays;

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppUnderTest } from '@drugstoresushi/phileas';
import type { Page } from '@playwright/test';

/**
 * The adapter for the example application.
 *
 * This is the reference implementation of `AppUnderTest`, and the shape a
 * consuming repository copies. It says how to start the application, how to
 * tell it is ready, and what must never be touched. It says nothing about what
 * the application means, and it judges nothing.
 *
 * It imports the engine by relative path rather than by package name, because
 * this example lives inside the engine's own repository. A real consumer
 * imports `@drugstoresushi/phileas` from a `file:` or registry dependency;
 * everything else about this file is what theirs looks like.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..', '..');

export const buggy: AppUnderTest = {
  productName: 'Buggy',

  // Required since phase 1: no default layout is worth having, because two
  // real consumers package into two different ones and neither matched.
  bundleDir: path.join(appRoot, 'dist', 'Buggy-darwin-arm64', 'Buggy.app'),

  staleness: {
    sourceRoot: appRoot,
    packagedInputs: ['main.cjs', 'preload.cjs', 'renderer', 'data', 'package.json'],
  },

  exclusions: {
    // Two ways out of the application, both named rather than derived. A
    // derived list is what a real consumer should build; this one is small
    // enough to state, and stating it is what the engine is handed either way.
    names: ['Quit Buggy', 'Read about the journey'],
    menuPaths: [['Buggy', 'Quit Buggy']],
  },

  /**
   * Resolve once the data has arrived, not merely once a window exists.
   *
   * Throws with the application's own message when it booted into an error
   * state, which is R24: waiting for the success marker alone would turn a
   * clear failure into a timeout that says nothing about why.
   */
  async waitForReady(page: Page): Promise<void> {
    const status = page.locator('#status');
    await status.waitFor({ state: 'attached', timeout: 10_000 });

    const text = await status.textContent();
    if (text?.startsWith('failed:')) {
      throw new Error(`Buggy booted into an error state: ${text}`);
    }

    await page.locator('#items li').first().waitFor({ timeout: 10_000 });
  },
};

export default buggy;

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppUnderTest } from '@drugstoresushi/phileas';
import type { Page } from '@playwright/test';

/** The adapter for Rail Itinerary: how to start it, when it is ready, what to leave alone. */
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..', '..');

export const railItinerary: AppUnderTest = {
  productName: 'Rail Itinerary',
  bundleDir: path.join(appRoot, 'dist', 'Rail Itinerary-darwin-arm64', 'Rail Itinerary.app'),

  staleness: {
    sourceRoot: appRoot,
    packagedInputs: ['main.cjs', 'preload.cjs', 'renderer', 'data', 'package.json'],
  },

  exclusions: {
    // The one way out of the application from the page.
    names: ["Visit the rail network's site"],
    // Quitting ends the demo, and the clipboard entries reach the watcher's own
    // clipboard, for the reasons docs/HISTORY.md gives under the clipboard fix.
    menuPaths: [
      ['Rail Itinerary', 'Quit Rail Itinerary'],
      ['Edit', 'Cut'],
      ['Edit', 'Copy'],
      ['Edit', 'Paste'],
    ],
  },

  async waitForReady(page: Page): Promise<void> {
    const settled = page.locator('#status[data-ready="true"], #status[data-ready="failed"]');
    await settled.waitFor({ state: 'attached', timeout: 10_000 });
    const status = page.locator('#status');
    if ((await status.getAttribute('data-ready')) === 'failed') {
      throw new Error(`Rail Itinerary did not start: ${await status.textContent()}`);
    }
  },
};

export default railItinerary;

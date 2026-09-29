import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppUnderTest } from '@drugstoresushi/phileas';
import type { Page } from '@playwright/test';

/** The adapter for Rail Itinerary: how to start it, when it is ready, what to leave alone. */
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..', '..');

/** The planted bugs the application knows, from the list the application itself reads. */
const { PLANTS } = createRequire(import.meta.url)('../../plants.cjs') as { PLANTS: readonly string[] };

/**
 * The application's flags from RAIL_DEMO_PLANT, a comma-separated list of
 * planted bugs. A name the application does not know is refused here, by
 * name, before anything launches.
 */
function plantFlags(): string[] {
  const plants = (process.env.RAIL_DEMO_PLANT ?? '').split(',').map((name) => name.trim()).filter(Boolean);
  for (const plant of plants) {
    if (!PLANTS.includes(plant)) {
      throw new Error(`RAIL_DEMO_PLANT names "${plant}", which is no planted bug. The plants are ${PLANTS.join(', ')}.`);
    }
  }
  return plants.map((plant) => `--plant=${plant}`);
}

// Read once when the adapter loads, so a misspelt name stops the run before
// the first Route rather than inside each one.
plantFlags();

export const railItinerary: AppUnderTest = {
  productName: 'Rail Itinerary',
  bundleDir: path.join(appRoot, 'dist', 'Rail Itinerary-darwin-arm64', 'Rail Itinerary.app'),

  staleness: {
    sourceRoot: appRoot,
    packagedInputs: ['main.cjs', 'preload.cjs', 'plants.cjs', 'renderer', 'data', 'package.json'],
  },

  // The demo's own switch, as the application's flags.
  launchArgs: () => plantFlags(),

  exclusions: {
    // The one way out of the application from the page. Quit and the Edit
    // menu's entries are standard ones, which the engine skips by default.
    names: ["Visit the rail network's site"],
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

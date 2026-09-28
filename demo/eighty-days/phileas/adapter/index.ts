import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppUnderTest } from '@drugstoresushi/phileas';
import type { Page } from '@playwright/test';

/** The adapter for Eighty Days: how to start it, when it is ready, what to leave alone. */
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..', '..');

/** The plants and layouts the game knows, from the list the game itself reads. */
const { PLANTS, LAYOUTS } = createRequire(import.meta.url)('../../plants.cjs') as {
  PLANTS: readonly string[];
  LAYOUTS: readonly string[];
};

/**
 * The game's flags from the demo's own switches: EIGHTY_DAYS_PLANT, a
 * comma-separated list of planted bugs, and EIGHTY_DAYS_LAYOUT. A name the
 * game does not know is refused here, by name, before anything launches.
 */
function gameFlags(): string[] {
  const plants = (process.env.EIGHTY_DAYS_PLANT ?? '').split(',').map((name) => name.trim()).filter(Boolean);
  for (const plant of plants) {
    if (!PLANTS.includes(plant)) {
      throw new Error(`EIGHTY_DAYS_PLANT names "${plant}", which is no planted bug. The plants are ${PLANTS.join(', ')}.`);
    }
  }
  const layout = process.env.EIGHTY_DAYS_LAYOUT;
  if (layout && !LAYOUTS.includes(layout)) {
    throw new Error(`EIGHTY_DAYS_LAYOUT is "${layout}", which is no layout. The layouts are ${LAYOUTS.join(' and ')}.`);
  }
  return [...plants.map((plant) => `--plant=${plant}`), ...(layout ? [`--layout=${layout}`] : [])];
}

// Read once when the adapter loads, so a misspelt name stops the run before
// the first Route rather than inside each one.
gameFlags();

/** The ship's log, one per Route, in the Route's own profile folder. */
const shipLog = (userDataDir: string) => path.join(userDataDir, 'ship.log');

export const eightyDays: AppUnderTest = {
  productName: 'Eighty Days',
  bundleDir: path.join(appRoot, 'dist', 'Eighty Days-darwin-arm64', 'Eighty Days.app'),

  staleness: {
    sourceRoot: appRoot,
    packagedInputs: ['main.cjs', 'preload.cjs', 'plants.cjs', 'renderer', 'data', 'package.json'],
  },

  // The game writes its log where it is told, and the log check reads the
  // same file.
  env: (userDataDir) => ({ EIGHTY_DAYS_LOG: shipLog(userDataDir) }),
  logPaths: (userDataDir) => [shipLog(userDataDir)],

  // The demo's own switches, as the game's flags.
  launchArgs: () => gameFlags(),

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

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppUnderTest } from '@drugstoresushi/phileas';
import type { Page } from '@playwright/test';
import { checks, relations } from '../checks';

/**
 * The adapter for the proving-ground application.
 *
 * This is the reference implementation of `AppUnderTest`, and the shape a
 * consuming repository copies. It says how to start the application, how to
 * tell it is ready, and what must never be touched, and it runs one check of
 * buggy's own, from `../checks/`. The application judges nothing; this
 * adapter's test code judges what that check asserts.
 *
 * It imports the engine by package name through a `file:` dependency, which is
 * what a real consumer does. The symlink lands back inside the engine's own
 * repository because this adapter lives there, so nothing here says whether
 * Playwright transpiles a package whose source sits outside the consumer.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..', '..');

/**
 * The planted defects a Journey switches on, from BUGGY_PLANT, a list
 * separated by commas, each passed to buggy as its own --buggy-plant flag.
 * Added on 2026-10-05 for the baseline that phase 8 brought forward: one
 * Journey finding the plants by traveling rather than by being steered.
 * A name buggy does not know is refused by buggy itself as it boots, in its
 * own words, so the list lives in one place, main.cjs.
 */
export const PLANT_VARIABLE = 'BUGGY_PLANT';
export const plantsAsked = (): string[] =>
  (process.env[PLANT_VARIABLE] ?? '').split(',').map((name) => name.trim()).filter(Boolean);

/** The log the log plants write to, in a Route's own profile folder. */
const plantLog = (userDataDir: string) => path.join(userDataDir, 'buggy.log');

export const buggy: AppUnderTest = {
  productName: 'Buggy',

  launchArgs: () => plantsAsked().map((plant) => `--buggy-plant=${plant}`),

  // Named only while plants are on, so the log check of every other Route of
  // buggy reports that it did not run, as it always has. Created on its first
  // write, since only a plant writes to it. Decided as the adapter loads, not
  // per call, because a log named from the profile folder needs runRoute to
  // be handed that folder, and the engine's own tests run buggy without one.
  ...(plantsAsked().length
    ? {
        env: (userDataDir: string) => ({ BUGGY_LOG: plantLog(userDataDir) }),
        logPaths: (userDataDir: string) => [{ path: plantLog(userDataDir), createdOnFirstWrite: true }],
      }
    : {}),

  // Required since phase 1: no default layout is worth having, because two
  // real consumers package into two different ones and neither matched.
  bundleDir: path.join(appRoot, 'dist', 'Buggy-darwin-arm64', 'Buggy.app'),

  staleness: {
    sourceRoot: appRoot,
    packagedInputs: ['main.cjs', 'preload.cjs', 'renderer', 'data', 'package.json'],
  },

  exclusions: {
    // The outbound link is a page element and is excluded by name.
    //
    // No menu entry is listed. Quit, Cut, Copy, Paste and Select All are the
    // standard entries Electron builds from a role, and the engine skips every
    // one of those by default since 2026-09-26; this adapter used to list
    // Quit and the clipboard by hand. The clipboard mattered because a shown
    // run reaches the real one through them, overwriting what the person
    // running the Journey had copied and putting state from outside the seed
    // into the page. The menu entries buggy's own code wrote, Show Inventory,
    // Show Summary and About Buggy, carry no role and stay in the draw.
    //
    // The name is written by hand rather than derived from the application's
    // source. A derived list is what keeps a rail from going stale the day
    // another way out appears, and docs/DEFECTS.md carries that it is not
    // built; tests/proving-ground-baseline.spec.ts at least fails when a clipboard
    // entry is left reachable.
    names: ['Read about the journey'],
  },

  checks,
  relations,

  /**
   * Resolve once the data has arrived, not merely once a window exists.
   *
   * Throws with the application's own message when it booted into an error
   * state, which is R24: waiting for the success marker alone would turn a
   * clear failure into a timeout that says nothing about why.
   *
   * **Waits for either terminal state rather than sampling one.** An earlier
   * version waited for #status to be attached and read it once. The element
   * ships in the static HTML, so that resolved at parse time, always read the
   * initial value, and could never see a failure written later -- delivering
   * the timeout R24 exists to prevent, from the code that claims to prevent it.
   * One selector matching both terminal values is what removes the ordering
   * from the question.
   *
   * A boot that never reaches either state, because the renderer script never
   * ran at all, still ends as a timeout. That case has no message to report,
   * so a timeout is the honest outcome rather than a missed one.
   */
  async waitForReady(page: Page): Promise<void> {
    const settled = page.locator('#status[data-boot="ready"], #status[data-boot="failed"]');
    await settled.waitFor({ state: 'attached', timeout: 10_000 });

    const status = page.locator('#status');
    if ((await status.getAttribute('data-boot')) === 'failed') {
      throw new Error(`Buggy booted into an error state: ${await status.textContent()}`);
    }
  },
};

export default buggy;

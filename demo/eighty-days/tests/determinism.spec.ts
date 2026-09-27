import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { RUN_VARIABLE, type AppUnderTest } from '@drugstoresushi/phileas';
import { railItinerary } from '../../rail-itinerary/phileas/adapter/index';
import { firstDifference, playRecorded } from './determinism';

/**
 * Eighty Days answers the same moves the same way, every time.
 *
 * Run from the repository root:
 *
 *   npx playwright test --config demo/eighty-days/playwright.config.ts
 *
 * **The two tests of the game fail until the game exists**, on purpose.
 * `docs/DEMO_PLAN_EIGHTY_DAYS.md` has them written before the first event is,
 * so that no event is ever written without the check that it is not random.
 * Until then they fail naming the missing adapter, not a difference.
 *
 * **The two tests of the comparison run today**, against the rail demo, and
 * are what make the other two worth believing. One plays the rail demo twice
 * and finds no difference, which shows nothing in a screen varies between
 * launches on its own. The other plants a difference in one play and finds
 * it, which shows the comparison can fail at all: a check that cannot be made
 * to fail is worse than none. Once the game exists, a planted coin flip in
 * the game itself joins them as the control that matters most.
 */

process.env[RUN_VARIABLE] = 'determinism';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The game's adapter, loaded when a test runs rather than imported, so the
 * repository typechecks before the adapter exists and the failure is this
 * message rather than a missing module.
 */
async function eightyDays(): Promise<AppUnderTest> {
  const file = path.join(here, '..', 'phileas', 'adapter', 'index.ts');
  if (!fs.existsSync(file)) {
    throw new Error(
      'Eighty Days is not built yet: there is no adapter at demo/eighty-days/phileas/adapter/index.ts. ' +
        'This test is written first, per build step 2 of docs/DEMO_PLAN_EIGHTY_DAYS.md, and passes once the game exists.'
    );
  }
  const loaded = (await import(pathToFileURL(file).href)) as { default: AppUnderTest };
  return loaded.default;
}

/** A Trip long enough to reach several places once the game exists. Tuned with the balance measurement. */
const GAME_TRIP = 60;

test.describe('Eighty Days', () => {
  test.setTimeout(10 * 60_000);

  test('answers the same moves the same way in two launches', async ({}, testInfo) => {
    const cfg = await eightyDays();
    const play = (n: number) =>
      playRecorded(cfg, { seed: 'same-twice', tripLength: GAME_TRIP, journalsRoot: testInfo.outputPath(`play-${n}`) });
    const first = await play(1);
    const second = await play(2);
    expect(firstDifference(first, second)).toBeUndefined();
  });

  test('answers the same at two hop delays', async ({}, testInfo) => {
    const cfg = await eightyDays();
    const play = (hopDelayMs: number) =>
      playRecorded(cfg, {
        seed: 'two-delays',
        tripLength: GAME_TRIP,
        journalsRoot: testInfo.outputPath(`delay-${hopDelayMs}`),
        hopDelayMs,
      });
    const quick = await play(0);
    const slow = await play(700);
    expect(firstDifference(quick, slow)).toBeUndefined();
  });
});

test.describe('the comparison', () => {
  test.setTimeout(3 * 60_000);

  const RAIL_TRIP = 15;

  test('finds no difference between two launches of the rail demo', async ({}, testInfo) => {
    const play = (n: number) =>
      playRecorded(railItinerary, {
        seed: 'rail-twice',
        tripLength: RAIL_TRIP,
        journalsRoot: testInfo.outputPath(`play-${n}`),
      });
    const first = await play(1);
    const second = await play(2);
    expect(first.screens).toHaveLength(RAIL_TRIP + 1);
    expect(firstDifference(first, second)).toBeUndefined();
  });

  test('finds a difference planted in one of two plays', async ({}, testInfo) => {
    const first = await playRecorded(railItinerary, {
      seed: 'rail-planted',
      tripLength: RAIL_TRIP,
      journalsRoot: testInfo.outputPath('play-1'),
    });
    // What a random event would do: text on the screen that differs between
    // plays, appearing before hop 4 of the second.
    const second = await playRecorded(railItinerary, {
      seed: 'rail-planted',
      tripLength: RAIL_TRIP,
      journalsRoot: testInfo.outputPath('play-2'),
      beforeReading: async (page, hop) => {
        if (hop !== 4) return;
        await page.evaluate(() => {
          const note = document.createElement('p');
          note.textContent = `a coin came down at ${Date.now()}`;
          document.body.prepend(note);
        });
      },
    });
    const difference = firstDifference(first, second);
    expect(difference).toBeDefined();
    expect(difference).toContain('before Trip hop 4');
  });
});

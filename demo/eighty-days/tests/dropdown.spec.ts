import { expect, test } from '@playwright/test';
import { closeApp, launchApp, makeUserDataDir, removeProfile, WINDOW_MODE_VARIABLE } from '@drugstoresushi/phileas';
import { eightyDays } from '../phileas/adapter/index';

/**
 * What the engine's keys do to a focused native dropdown, hidden and shown.
 *
 * Run from the repository root:
 *
 *   npx playwright test --config demo/eighty-days/playwright.config.ts dropdown
 *
 * **Why.** A Hop can focus a dropdown, which the engine does rather than
 * click it, since a click opens a list it cannot use, and a later Hop can
 * press a common key on whatever has focus. `OUTSTANDING.md` 1.6 recorded
 * whether an arrow key then changes the dropdown's choice on macOS as
 * unmeasured. It was seen on 2026-09-28 in a watched Eighty Days run: a small
 * list opened on the Hotel's three-option dropdown, a choice was made, and it
 * closed. A seed is replayed hidden and watched shown, so if a key did one
 * thing to a dropdown hidden and another shown, a seed could play two games.
 *
 * **What is required is agreement, not a particular answer.** Each step is
 * done as a Hop does it, focus through the locator and keys through the page's
 * keyboard, and the dropdown's value read after each, once with the window
 * hidden and once shown behind other windows. The two readings must match.
 * The values themselves are attached to the test, since whether an arrow
 * changes the choice at all is the measurement 1.6 asked for.
 */

/** The steps, each a Hop's action, and the dropdown's value after each. */
async function probe(mode: 'hidden' | 'back'): Promise<string[]> {
  const before = process.env[WINDOW_MODE_VARIABLE];
  process.env[WINDOW_MODE_VARIABLE] = mode;
  const userDataDir = await makeUserDataDir(eightyDays);
  const launched = await launchApp(eightyDays, userDataDir).catch(async (error: unknown) => {
    await removeProfile(userDataDir, eightyDays.profileWatchMs);
    throw error;
  });
  try {
    const page = await launched.app.firstWindow();
    await eightyDays.waitForReady(page);
    await page.getByRole('button', { name: 'Accept the wager' }).click();
    await page.getByRole('tab', { name: 'Hotel' }).click();
    const stay = page.getByRole('combobox', { name: 'Stay' });
    const value = () => stay.inputValue({ timeout: 5_000 });

    const readings: string[] = [];
    await stay.focus({ timeout: 5_000 });
    readings.push(`focused: ${await value()}`);
    for (const key of ['ArrowDown', 'ArrowDown', 'Enter', 'ArrowUp', 'Escape']) {
      await page.keyboard.press(key);
      // Long enough for a native list to open and settle, as a Hop's settle wait would allow.
      await page.waitForTimeout(500);
      readings.push(`${key}: ${await value()}`);
    }

    // An arrow on macOS may open the dropdown's native list without changing
    // its value, and an open list may take the next click for itself. So the
    // list is opened again and a Hop's click is aimed at another tab: whether
    // it lands, and how long it takes, must not depend on the window mode.
    await stay.focus({ timeout: 5_000 });
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(500);
    const telegraph = page.getByRole('tab', { name: 'Telegraph Office' });
    const started = Date.now();
    const clicked = await telegraph.click({ timeout: 3_000 }).then(
      () => 'returned',
      (error: unknown) => `threw ${error instanceof Error ? error.name : String(error)}`
    );
    const took = Date.now() - started;
    const selected = await telegraph.getAttribute('aria-selected', { timeout: 5_000 });
    readings.push(`click after ArrowDown: ${clicked}, tab selected ${selected}, ${took < 1_500 ? 'quick' : 'slow'}`);
    return readings;
  } finally {
    await closeApp(eightyDays, launched);
    await removeProfile(userDataDir, eightyDays.profileWatchMs);
    if (before === undefined) delete process.env[WINDOW_MODE_VARIABLE];
    else process.env[WINDOW_MODE_VARIABLE] = before;
  }
}

test('keys do the same to a focused dropdown hidden and shown', async ({}, testInfo) => {
  test.setTimeout(3 * 60_000);
  const hidden = await probe('hidden');
  const shown = await probe('back');
  await testInfo.attach('readings', {
    body: `hidden: ${hidden.join(' | ')}\nshown:  ${shown.join(' | ')}\n`,
    contentType: 'text/plain',
  });
  console.log(`hidden: ${hidden.join(' | ')}`);
  console.log(`shown:  ${shown.join(' | ')}`);
  expect(shown).toEqual(hidden);
});

import { createTest, deriveRouteStreams, requireSeed, runRoute, type Chooser, type Fix } from '@drugstoresushi/phileas';
import { positron } from '../phileas/adapter';
import { session } from '../phileas/fixes/session';
import { knownFindings } from '../phileas/paths';
import { probeJournals } from './paths';

/**
 * posit-dev/positron issue 6480, on 2025.02: a data explorer whose R session
 * quits stays as it was, where it should show that its connection closed.
 * Fixed by 2025.03, so the current release is the control.
 *
 * The session Fix starts R, the probe's own steps show mtcars and then quit
 * R with q(), and a single Trip hop presses Escape, so every check runs after
 * the quit as after any Hop. Then the probe reads whether "Connection Closed"
 * shows.
 *
 * Its own steps rather than the data explorer Fix's, since that Fix finds the
 * console's input inside a tab panel, and on 2025.02 it is not in one: the
 * input is the code editor's text area, measured on 2026-10-06. The probe
 * takes whichever is on screen.
 */
const test = createTest(positron);

/** How the probe ends the R session the explorer reads: q() typed, or a button by its name. */
type Ending = { kind: 'q' } | { kind: 'button'; name: RegExp };

const endR = (ending: Ending): Fix => async (context) => {
  await session(context);
  const { page, step } = context;
  // Inside a tab panel on the current release, as the data explorer Fix finds
  // it; outside one on 2025.02. Whichever is on screen.
  const consoleInput = async () => {
    const inPanel = page.getByRole('tabpanel').getByRole('textbox').visible().last();
    return (await inPanel.count()) ? inPanel : page.locator('textarea.inputarea').visible().last();
  };
  await step({
    kind: 'code',
    label: 'show mtcars in the data explorer',
    action: async () => {
      await (await consoleInput()).focus();
      await page.keyboard.type('View(mtcars)');
      await page.keyboard.press('Enter');
      await page.getByRole('tab', { name: /mtcars/ }).first().waitFor({ timeout: 30_000 });
    },
  });
  // The console's buttons that could end a session, so the power button's
  // name is known, since no journal has recorded it.
  const buttons = page.getByRole('button', { name: /shut|stop|power|restart|delete|end|quit/i });
  for (let i = 0; i < (await buttons.count()); i += 1) {
    console.log(`probe: button ${JSON.stringify(await buttons.nth(i).getAttribute('aria-label') ?? await buttons.nth(i).textContent())} visible ${await buttons.nth(i).isVisible()}`);
  }
  await step({
    kind: 'code',
    label: ending.kind === 'q' ? 'quit R with q()' : `end R with ${ending.name}`,
    action: async () => {
      if (ending.kind === 'q') {
        await (await consoleInput()).focus();
        await page.keyboard.type('q()');
        await page.keyboard.press('Enter');
      } else {
        await page.getByRole('button', { name: ending.name }).visible().first().click();
      }
      // Long enough for the session to end and the explorer to hear of it.
      await page.waitForTimeout(10_000);
    },
  });
};

const escape: Chooser = {
  choose: (candidates) => {
    const target = candidates.find((candidate) => candidate.source === 'key' && candidate.name === 'Escape');
    if (!target) throw new Error('Escape is not on offer');
    return { target };
  },
};

const endings: [string, Ending][] = [
  ['q()', { kind: 'q' }],
  // "Restart R" on the current release, "Restart console" on 2025.02.
  ['Restart', { kind: 'button', name: /^Restart (R|console)\b/ }],
];

endings.forEach(([label, ending], index) => test(`6480: the data explorer after ${label} ends its R session`, async ({ page, app, userDataDir }, testInfo) => {
  const journeySeed = requireSeed();
  // A Route number of its own for each test and each repeat, so no two write
  // one journal.
  const routeNumber = testInfo.repeatEachIndex * endings.length + index + 1;
  try {
    await runRoute({
      page,
      app,
      cfg: positron,
      streams: deriveRouteStreams(journeySeed, routeNumber),
      journeySeed,
      routeNumber,
      tripLength: 1,
      fix: endR(ending),
      chooser: escape,
      journalsRoot: probeJournals,
      userDataDir,
      knownFindings,
    });
    console.log(`6480 probe, ${label}: no check failed`);
  } catch (error) {
    console.log(`6480 probe, ${label}: the Route ended on ${(error as Error).name}: ${(error as Error).message.split('\n').slice(0, 6).join(' | ')}`);
  }
  const closed = await page.getByText(/connection closed/i).count();
  console.log(`6480 probe, ${label}: "Connection Closed" shown ${closed} time(s)`);
  await page.screenshot({ path: testInfo.outputPath('after.png') });
}));

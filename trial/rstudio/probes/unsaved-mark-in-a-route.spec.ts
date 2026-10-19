import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CheckFailure,
  createTest,
  deriveRouteStreams,
  expect,
  runRoute,
  seededChooser,
  type Chooser,
  type Fix,
} from '@drugstoresushi/phileas';
import { rstudio } from '../phileas/adapter';
import { script } from '../phileas/fixes/source/script';

/**
 * `unsaved-mark-matches-save` firing inside a real Route, to show it at work
 * where it runs: after each Fix step and each Hop, on the steps where it
 * applies, ending the Route at the first violation. Written on 2026-10-16.
 *
 * **The bug is planted, since RStudio has none of this kind that is known.**
 * The Fix is the `script` Fix, then the script saved as `unsaved-mark.R`
 * through RStudio's Save File dialog, since a script never saved opens the
 * dialog rather than saving, then a step that makes RStudio's page hide the
 * unsaved mark, " *", whenever it appears, as `buggy`'s launch flags plant
 * its defects. Every check after the Fix still holds: the script is saved,
 * so it carries no mark and Save is disabled.
 *
 * **One Hop is steered,** as the engine's planted-defect tests steer to their
 * control: from hop 3, the first Hop that offers the script's editor types
 * into it, which makes the script unsaved with its mark hidden and Save
 * enabled. Every other Hop is the seeded draw. Without steering, a Route
 * could travel many Hops before typing into the editor.
 *
 * **The editor is named for where its cursor is,** "Cursor at row 3" and so
 * on, so it is matched by that shape and never by one row: the first run, on
 * 2026-10-16, matched "Cursor at row 1", never found the editor after three
 * lines were typed, and steered nothing. It is the first such text box in
 * the pool, since the Source pane comes before the console in the page.
 *
 * Prints the journal's path, for `phileas show`.
 */
const test = createTest(rstudio);
const here = path.dirname(fileURLToPath(import.meta.url));

/** The editor's name, and the console's: each says the row its cursor is on. */
const EDITOR = /^Cursor at row \d+$/;

const planted: Fix = async (context) => {
  await script(context);
  const { page, step } = context;
  await step({
    kind: 'code',
    label: 'save the script as unsaved-mark.R',
    action: async () => {
      // A script never saved opens the Save File dialog, measured on the
      // first run of this probe, where the Trip happened to finish the save.
      await page.keyboard.press('Meta+s');
      const name = page.getByRole('textbox', { name: 'File name:' });
      await name.waitFor({ timeout: 10_000 });
      await name.fill('unsaved-mark');
      await page.keyboard.press('Enter');
      await page.getByRole('tablist', { name: 'Documents' }).getByRole('tab', { name: /unsaved-mark\.R/ }).first().waitFor({ timeout: 10_000 });
    },
  });
  await step({
    kind: 'code',
    label: 'plant: hide every unsaved mark',
    action: () =>
      page.evaluate(() => {
        const hide = () => {
          for (const element of document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Documents"] [role="tab"] *')) {
            if (element.children.length === 0 && element.innerText.trim() === '*') element.style.display = 'none';
          }
        };
        new MutationObserver(hide).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
        hide();
      }),
  });
};

/** The seeded draw, except that from hop 3 the first Hop offering the editor types into it. */
function steeredFrom(hop: number): Chooser {
  let calls = 0;
  let steered = false;
  return {
    choose: (candidates, rng) => {
      calls += 1;
      const editor = candidates.find(
        (candidate) => candidate.source === 'page' && candidate.role === 'textbox' && EDITOR.test(candidate.name)
      );
      if (!steered && calls >= hop && editor) {
        steered = true;
        return { target: editor };
      }
      return seededChooser.choose(candidates, rng);
    },
  };
}

test('unsaved-mark-matches-save ends a Route where the mark goes missing', async ({ page, app, userDataDir }) => {
  test.setTimeout(10 * 60_000);
  const journalsRoot = path.join(here, '.phileas-journals');
  const error = await runRoute({
    page,
    app,
    cfg: rstudio,
    streams: deriveRouteStreams('unsaved-mark-demo', 1),
    journeySeed: 'unsaved-mark-demo',
    routeNumber: 1,
    tripLength: 12,
    journalsRoot,
    fix: planted,
    chooser: steeredFrom(3),
    userDataDir,
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );
  const folder = path.join(journalsRoot, 'unsaved-mark-demo', process.env.PHILEAS_RUN ?? '');
  for (const file of fs.readdirSync(folder)) process.stdout.write(`journal: ${path.join(folder, file)}\n`);
  expect(error).toBeInstanceOf(CheckFailure);
  expect((error as CheckFailure).failed.map((check) => check.check)).toEqual(['unsaved-mark-matches-save']);
});

import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix that shows a dataset in RStudio's data viewer, so every Route's Trip
 * begins with one open: `View(mtcars)`, a dataset that ships with R, run in
 * the console. The counterpart of Positron's `data-explorer` Fix, asked for
 * on 2026-10-08.
 *
 * The viewer's grid is drawn in a frame, and the survey does not read inside
 * frames (docs/OUTSTANDING.md 1.9), so a Trip reaches only what RStudio draws
 * around the grid. The focus is moved by RStudio's own menu entry and the
 * line typed by Playwright, as in `session-data`, since the console and an
 * open editor are two text boxes with one name. The last step waits for the
 * viewer's tab, which also shows that the line ran.
 */
export const dataViewer: Fix = async ({ page, step }) => {
  await step({ kind: 'act', target: 'menu &View > Move Focus to &Console' });
  await step({
    kind: 'code',
    label: 'run View(mtcars)',
    action: async () => {
      await page.keyboard.type('View(mtcars)');
      await page.keyboard.press('Enter');
    },
  });
  await step({
    kind: 'code',
    label: "wait for the data viewer's tab",
    action: () => page.getByRole('tab', { name: /mtcars/ }).first().waitFor({ timeout: 15_000 }),
  });
};

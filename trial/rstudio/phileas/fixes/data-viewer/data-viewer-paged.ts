import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix that shows a frame too big to draw at once in the data viewer, so a
 * Trip begins where rows load as the grid scrolls and columns are drawn only
 * near the view. `paged`, 1,000 rows by 120 columns, is built in the global
 * environment from sequences with no randomness, so every Route sees the same
 * data and the Environment pane lists it: an id, 39 numbers, 40 text columns
 * and 40 factors. Written on 2026-10-19, beside `data-viewer`, whose `mtcars`
 * is 32 rows by 11 columns and is not in the global environment.
 *
 * Measured first by `trial/rstudio/probes/viewer-paging.spec.ts` on
 * 2026.11.0-daily+78: no column paging, 9 to 12 of the 120 columns drawn at a
 * time, and the footer counting rows correctly at every scroll position.
 *
 * The R is written inside the `code` step's action, not in a constant beside
 * it, so the step's recorded source holds the line it typed: a Fix's
 * fingerprint misses a constant outside the function (docs/DEFECTS.md).
 */
export const dataViewerPaged: Fix = async ({ page, step }) => {
  await step({ kind: 'act', target: 'menu &View > Move Focus to &Console' });
  await step({
    kind: 'code',
    label: 'build paged, 1,000 rows by 120 columns',
    action: async () => {
      await page.keyboard.type(
        'paged <- data.frame(id = 1:1000, ' +
          'setNames(lapply(1:39, function(j) (1:1000 * j) %% 997 / 10), sprintf("n%02d", 1:39)), ' +
          'setNames(lapply(1:40, function(j) sprintf("r%04d-%d", 1:1000, j)), sprintf("t%02d", 1:40)), ' +
          'setNames(lapply(1:40, function(j) factor(letters[(1:1000 + j) %% 5 + 1])), sprintf("f%02d", 1:40)))'
      );
      await page.keyboard.press('Enter');
    },
  });
  await step({
    kind: 'code',
    label: 'wait for the Environment pane to list it',
    action: () => page.getByText('1000 obs. of 120 variables').first().waitFor({ timeout: 15_000 }),
  });
  await step({
    kind: 'code',
    label: 'run View(paged)',
    action: async () => {
      await page.keyboard.type('View(paged)');
      await page.keyboard.press('Enter');
    },
  });
  await step({
    kind: 'code',
    label: "wait for the data viewer's tab",
    action: () => page.getByRole('tab', { name: /paged/ }).first().waitFor({ timeout: 20_000 }),
  });
};

import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix that shows a frame past ~200 columns in the data viewer, where the
 * footer adds "columns X to Y of N", counting the columns in view, so a Trip
 * begins where `data-viewer-footer-columns-in-view` applies. `wide`, 1,000
 * rows by 450 columns, is built in the global environment from sequences with
 * no randomness, so every Route sees the same data and the Environment pane
 * lists it: an id, 149 numbers, 150 text columns and 150 factors. Written on
 * 2026-10-22, beside `data-viewer-paged`, whose 120 columns the footer counts
 * only as "120 total columns".
 *
 * Measured first by `trial/rstudio/probes/viewer-footer-columns.spec.ts` on
 * 2026.11.0-daily+78, which builds the same frame.
 *
 * The R is written inside the `code` step's action, not in a constant beside
 * it, so the step's recorded source holds the line it typed: a Fix's
 * fingerprint misses a constant outside the function (docs/DEFECTS.md).
 */
export const dataViewerWide: Fix = async ({ page, step }) => {
  await step({ kind: 'act', target: 'menu &View > Move Focus to &Console' });
  await step({
    kind: 'code',
    label: 'build wide, 1,000 rows by 450 columns',
    action: async () => {
      await page.keyboard.type(
        'wide <- data.frame(id = 1:1000, ' +
          'setNames(lapply(1:149, function(j) (1:1000 * j) %% 997 / 10), sprintf("n%03d", 1:149)), ' +
          'setNames(lapply(1:150, function(j) sprintf("r%04d-%d", 1:1000, j)), sprintf("t%03d", 1:150)), ' +
          'setNames(lapply(1:150, function(j) factor(letters[(1:1000 + j) %% 5 + 1])), sprintf("f%03d", 1:150)))'
      );
      await page.keyboard.press('Enter');
    },
  });
  await step({
    kind: 'code',
    label: 'wait for the Environment pane to list it',
    action: () => page.getByText('1000 obs. of 450 variables').first().waitFor({ timeout: 15_000 }),
  });
  await step({
    kind: 'code',
    label: 'run View(wide)',
    action: async () => {
      await page.keyboard.type('View(wide)');
      await page.keyboard.press('Enter');
    },
  });
  await step({
    kind: 'code',
    label: "wait for the data viewer's tab",
    action: () => page.getByRole('tab', { name: /wide/ }).first().waitFor({ timeout: 20_000 }),
  });
};

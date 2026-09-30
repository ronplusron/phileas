import type { Fix } from '@drugstoresushi/phileas';

/** What the script holds: a few lines a Route's Run and Source can act on. */
const CODE = ['x <- c(3, 1, 2)', 'y <- sort(x)', 'summary(y)'];

/**
 * A Fix that opens a new R script with a few lines of code in it, so every
 * Route's Trip begins with the editor's saving, running and Code menu live.
 *
 * Written one step at a time from `phileas survey`, on 2026-09-28. The code
 * is typed by Playwright in a `code` step rather than by an `act` step: the
 * survey shows the editor and the console as two text boxes with one name,
 * "Cursor at row 1", and an `act` step naming it would reach whichever comes
 * first. A new script takes the
 * focus, so the keys land in it, and the last step waits for the code to be
 * drawn, which also shows that it did.
 */
export const script: Fix = async ({ page, step }) => {
  await step({ kind: 'act', target: 'button "New File"' });
  await step({ kind: 'act', target: 'menuitem "R Script ⇧⌘N"' });
  await step({
    kind: 'code',
    label: 'type the code into the new script',
    action: () => page.keyboard.type(CODE.join('\n')),
  });
  await step({
    kind: 'code',
    label: 'wait for the code to be drawn in the editor',
    action: () =>
      page.locator('.ace_text-layer').getByText('y <- sort(x)').first().waitFor({ timeout: 10_000 }),
  });
};

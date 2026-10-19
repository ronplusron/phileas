import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix that zooms the Plots pane, so every Route's Trip begins with the
 * other panes hidden, each zero pixels wide, and their controls left out of
 * the draw as hidden (R32).
 *
 * Written on 2026-10-02 from `phileas survey`'s line for the menu entry, to
 * travel from the state that showed RStudio's hidden panes being offered.
 * The last step waits for the button that restores the zoomed tab set, which
 * RStudio shows only while a pane is zoomed, so the Fix shows that it took.
 */
export const zoomedPlots: Fix = async ({ page, step }) => {
  await step({ kind: 'act', target: 'menu &View > P&anes > Zoom Pl&ots' });
  await step({
    kind: 'code',
    label: 'wait for the zoomed tab set to offer Restore',
    action: () => page.getByRole('button', { name: /^Restore TabSet/ }).first().waitFor({ timeout: 10_000 }),
  });
};

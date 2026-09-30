import type { Fix } from '@drugstoresushi/phileas';

/**
 * What the console runs: a data frame, a model fitted to it, and a plot of it,
 * so the Environment, History and Plots panes each have something in them.
 */
const CODE = [
  'df <- data.frame(id = 1:5, score = c(3.2, 4.1, 2.8, 5.0, 3.9), group = c("a", "b", "a", "b", "a"))',
  'm <- lm(score ~ id, data = df)',
  'plot(df$id, df$score)',
];

/**
 * A Fix that runs a few lines in the console, so every Route's Trip begins
 * with objects in the session, commands in the history and a plot drawn.
 *
 * Written one step at a time from `phileas survey`, on 2026-09-28. The focus
 * is moved by RStudio's own menu entry, and the lines are typed by Playwright:
 * the console and an open editor are two text boxes with one name. The last
 * step waits for the Environment pane to describe the data frame, which is
 * also how it shows that the lines ran.
 */
export const sessionData: Fix = async ({ page, step }) => {
  await step({ kind: 'act', target: 'menu &View > Move Focus to &Console' });
  for (const line of CODE) {
    await step({
      kind: 'code',
      label: `run ${line.split(' <- ')[0]}`,
      action: async () => {
        await page.keyboard.type(line);
        await page.keyboard.press('Enter');
      },
    });
  }
  await step({
    kind: 'code',
    label: 'wait for the Environment pane to list the data frame',
    action: () =>
      page.getByText('5 obs. of 3 variables').first().waitFor({ timeout: 15_000 }),
  });
};

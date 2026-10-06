import type { Fix } from '@drugstoresushi/phileas';

/** What is added at the end of the new document: a line of text, then an R chunk. */
const ADDED = ['', 'Text added by the Fix.', '', '```{r}', 'x <- c(3, 1, 2)', 'mean(x)', '```', ''].join('\n');

/**
 * A Fix that goes on from where `r-markdown` stops: it creates the R Markdown
 * document with the dialog's defaults, then adds a line of text and an R
 * chunk at its end, so every Route's Trip begins in an open document whose
 * chunks can be run, knitted and edited.
 *
 * Written on 2026-10-02, the dialog's OK from `phileas survey`. The text is
 * inserted rather than typed key by key, since the editor pairs some
 * characters as they are typed, and the last step waits for the added line to
 * be drawn, which also shows that it went in.
 */
export const rMarkdownFurther: Fix = async ({ page, step }) => {
  await step({ kind: 'act', target: 'button "New File"' });
  await step({ kind: 'act', target: 'menuitem "R Markdown..."' });
  await step({ kind: 'act', target: 'textbox "Title:"', value: 'Trip report' });
  await step({ kind: 'act', target: 'textbox "Author:"', value: 'Phileas' });
  await step({ kind: 'act', target: 'radio "HTML"' });
  await step({ kind: 'act', target: 'button "OK"' });
  await step({
    kind: 'code',
    label: 'wait for the new document',
    action: () => page.locator('.ace_text-layer').getByText('title:').first().waitFor({ timeout: 15_000 }),
  });
  await step({
    kind: 'code',
    label: 'move to the end of the document',
    action: () => page.keyboard.press('Meta+ArrowDown'),
  });
  await step({
    kind: 'code',
    label: 'add a line of text and an R chunk',
    action: () => page.keyboard.insertText(ADDED),
  });
  await step({
    kind: 'code',
    label: 'wait for the added text to be drawn',
    action: () =>
      page.locator('.ace_text-layer').getByText('Text added by the Fix.').first().waitFor({ timeout: 10_000 }),
  });
};

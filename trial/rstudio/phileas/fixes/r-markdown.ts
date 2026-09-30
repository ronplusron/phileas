import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix that opens RStudio's dialog for creating an R Markdown document and
 * stops there, so every Route's Trip begins inside the dialog: its document,
 * presentation, Shiny and template kinds, its fields and its output formats.
 * Chosen on 2026-09-28 in place of a Fix that created a project.
 *
 * Written one step at a time from `phileas survey`, on 2026-09-28. rmarkdown,
 * knitr and tinytex are installed in the machine's R, so the dialog does not
 * stop to install them first.
 */
export const rMarkdown: Fix = async ({ step }) => {
  await step({ kind: 'act', target: 'button "New File"' });
  await step({ kind: 'act', target: 'menuitem "R Markdown..."' });
};

import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix that opens a new Quarto document, so every Route's Trip begins
 * inside one.
 *
 * Written one step at a time from `phileas survey`.
 */
export const quarto: Fix = async ({ step }) => {
  await step({ kind: 'act', target: 'button "New"' });
  await step({ kind: 'act', target: 'menuitem "New File... ⌃⌥⌘N"' });
  await step({ kind: 'act', target: 'option "Quarto Document, Quarto, Quarto"' });
};

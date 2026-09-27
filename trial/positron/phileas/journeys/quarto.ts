import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix that opens a new Quarto document, so every Route's Trip begins
 * inside one.
 *
 * Written one step at a time from `phileas survey`.
 */
export const quarto: Fix = async ({ hop }) => {
  await hop('button "New"');
  await hop('menuitem "New File... ⌃⌥⌘N"');
  await hop('option "Quarto Document, Quarto, Quarto"');
};

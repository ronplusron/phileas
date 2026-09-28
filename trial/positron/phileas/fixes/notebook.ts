import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix that opens a new notebook, so every Route's Trip begins inside one.
 *
 * Written one step at a time from `phileas survey`.
 */
export const notebook: Fix = async ({ hop }) => {
  await hop('button "New"');
  await hop('menuitem "New File... ⌃⌥⌘N"');
  await hop('option "Jupyter Notebook, Classic .ipynb Support, Notebook"');
};

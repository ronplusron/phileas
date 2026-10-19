import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix that opens a new notebook, so every Route's Trip begins inside one.
 *
 * Written one step at a time from `phileas survey`.
 */
export const notebook: Fix = async ({ step }) => {
  await step({ kind: 'act', target: 'button "New"' });
  await step({ kind: 'act', target: 'menuitem "New File... ⌃⌥⌘N"' });
  await step({ kind: 'act', target: 'option "Jupyter Notebook, Classic .ipynb Support, Notebook"' });
};

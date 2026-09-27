import type { Fix } from '@drugstoresushi/phileas';

/**
 * A Fix that starts an R session, so every Route's Trip begins with one
 * running. The trial's session checks compare what the console and the
 * Variables pane say about running sessions, and with none running both say
 * nothing; a fresh profile starts none by itself, measured on 2026-09-27.
 *
 * Written one step at a time from `phileas survey`.
 */
export const rSession: Fix = async ({ page, hop, step }) => {
  await hop('button "Start New Console Session"');
  // Not a copied line: the list names each interpreter with this machine's
  // version and path, and its order changed between two launches on
  // 2026-09-27, so the step names R by pattern instead.
  await step('choose R in the interpreter list', () =>
    page.getByRole('option', { name: /^R \d/ }).first().click()
  );
  // The console announces the session when it is up; a Trip starting sooner
  // would land on a session still starting.
  await step('wait for R to start', () =>
    page.getByText(/R \d+\.\d+\.\d+ started\./).first().waitFor({ timeout: 30_000 })
  );
};

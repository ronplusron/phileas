import fs from 'node:fs';
import type { Fix } from '@drugstoresushi/phileas';
import { EARLY_R_BINARY, positronFamily, positronVersion } from '../adapter';

/**
 * A Fix that starts an interpreter session, so every Route's Trip begins with
 * one running. The trial's session checks compare what the console and the
 * Variables pane say about running sessions, and with none running both say
 * nothing; a fresh profile starts none by itself, measured on 2026-09-27.
 *
 * Written one step at a time from `phileas survey`. Each family of releases
 * starts a session its own way, and a release with no family is refused by
 * name rather than guessed at.
 */
export const session: Fix = async ({ page, hop, step }) => {
  if (positronFamily === 'current') {
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
    return;
  }

  if (positronFamily === 'early') {
    // R 4.4.3 rather than the machine's R 4.6.0, which crashes as it starts
    // on 2025.01 and 2025.02; the adapter's EARLY_R_BINARY says why.
    if (!fs.existsSync(EARLY_R_BINARY)) {
      throw new Error(`The early releases need R 4.4.3 at ${EARLY_R_BINARY}, and it is not there. Install it with: rig add 4.4.3`);
    }
    await hop('button "Start Interpreter"');
    // The dialog shows one interpreter per language, the machine's current
    // R; the row's first button expands it to the others.
    await step('show the other R versions', () =>
      page.getByRole('dialog').getByRole('button', { name: /^R \d/ }).first().getByRole('button').first().click()
    );
    await step('choose R 4.4.3', () =>
      page.getByRole('dialog').getByRole('button', { name: /^4\.4\.3 / }).first().click()
    );
    await step('wait for R to start', () =>
      page.getByText(/R 4\.4\.3 started\./).first().waitFor({ timeout: 30_000 })
    );
    return;
  }

  throw new Error(
    `Positron ${positronVersion} has no measured way to start a session. ` +
      'Measure it and add the release to FAMILIES in the adapter.'
  );
};

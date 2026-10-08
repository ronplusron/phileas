import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import type { Fix } from '@drugstoresushi/phileas';
import { EARLY_R_BINARY, positronFamily, positronVersion } from '../adapter';

/**
 * A Fix that starts an interpreter session, so every Route's Trip begins with
 * one running; a fresh profile starts none by itself, measured on 2026-09-27.
 * The data explorer's Fix starts from it too.
 *
 * Written one step at a time from `phileas survey`. Each family of releases
 * starts a session its own way, and a release with no family is refused by
 * name rather than guessed at.
 */
/**
 * The version of the R on this machine's PATH, which the current release is
 * to start, so a Route runs on whatever R the machine has now. Without it,
 * "R " in the list's filter left R 4.4.3, kept for the early releases, first
 * among two Rs: all 100 Routes of step 6's session rerun ran on it on
 * 2026-10-06.
 */
function machineRVersion(): string {
  // Both streams: older Rs print it to standard error.
  const run = spawnSync('Rscript', ['--version'], { encoding: 'utf8' });
  const said = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  // "Rscript (R) version 4.6.0 (2026-04-24)" on R 4.6; older Rs said "R
  // scripting front-end version", so only the version is matched.
  const version = /\bversion (\d+\.\d+\.\d+)/.exec(said)?.[1];
  if (!version) throw new Error(`Rscript on the PATH did not say its version: ${said.trim()}`);
  return version;
}

export const session: Fix = async ({ page, step }) => {
  if (positronFamily === 'current') {
    const version = machineRVersion();
    await step({ kind: 'act', target: 'button "Start New Console Session"' });
    // Not a copied line: the list names each interpreter with this machine's
    // version and path, and its order changed between two launches on
    // 2026-09-27, so the step names R by pattern instead.
    //
    // **Filtered to R, then chosen with Enter, never clicked.** The list is
    // still filling in as interpreters are discovered, and a click aimed at R
    // could land on whatever moved under it: on 2026-10-06, 17 of 100 Routes
    // of step 6's session Journey started Python 3.14 this way and failed
    // waiting for R. Typing into the list's filter leaves only R, whatever
    // the order. Filtered to the machine's own R by its version, since the
    // early releases' R 4.4.3 is in the list too.
    await step({
      kind: 'code',
      label: 'choose R in the interpreter list',
      action: async () => {
        await page.getByRole('option', { name: /^R \d/ }).first().waitFor({ timeout: 30_000 });
        await page.keyboard.type(`R ${version}`);
        await page.getByRole('option').first().filter({ hasText: `R ${version}` }).waitFor({ timeout: 10_000 });
        await page.keyboard.press('Enter');
      },
    });
    // The console announces the session when it is up; a Trip starting sooner
    // would land on a session still starting. Another interpreter's start is
    // refused at once, by name, rather than waited out.
    await step({
      kind: 'code',
      label: 'wait for R to start',
      action: async () => {
        const started = page.getByText(/\d+\.\d+\.\d+ started\./).first();
        await started.waitFor({ timeout: 30_000 });
        const said = ((await started.textContent()) ?? '').trim();
        if (!said.includes(`R ${version} started.`)) throw new Error(`The session Fix asked for R ${version}, and "${said}"`);
      },
    });
    return;
  }

  if (positronFamily === 'early') {
    // R 4.4.3 rather than the machine's R 4.6.0, which crashes as it starts
    // on 2025.01 and 2025.02; the adapter's EARLY_R_BINARY says why.
    if (!fs.existsSync(EARLY_R_BINARY)) {
      throw new Error(`The early releases need R 4.4.3 at ${EARLY_R_BINARY}, and it is not there. Install it with: rig add 4.4.3`);
    }
    await step({ kind: 'act', target: 'button "Start Interpreter"' });
    // The dialog shows one interpreter per language, the machine's current
    // R; the row's first button expands it to the others.
    await step({
      kind: 'code',
      label: 'show the other R versions',
      action: () =>
        page.getByRole('dialog').getByRole('button', { name: /^R \d/ }).first().getByRole('button').first().click(),
    });
    await step({
      kind: 'code',
      label: 'choose R 4.4.3',
      action: () =>
        page.getByRole('dialog').getByRole('button', { name: /^4\.4\.3 / }).first().click(),
    });
    await step({
      kind: 'code',
      label: 'wait for R to start',
      action: () =>
        page.getByText(/R 4\.4\.3 started\./).first().waitFor({ timeout: 30_000 }),
    });
    return;
  }

  throw new Error(
    `Positron ${positronVersion} has no measured way to start a session. ` +
      'Measure it and add the release to FAMILIES in the adapter.'
  );
};

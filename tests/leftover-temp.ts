import fs from 'node:fs';
import os from 'node:os';

/**
 * Fails the run if it leaves a `phileas-*` folder in the system temp folder.
 *
 * Global setup, returning its own teardown. The suite once left about eighty
 * folders per run, roughly 1,300 of them before anyone looked, because nothing
 * failed when a test forgot to remove what it made. Each cleanup is now in the
 * test or fixture that creates the folder, and this is the check that fails
 * when one is missing, rather than a note asking for care.
 *
 * Compares folder names, not counts, so folders from earlier runs do not
 * count against this one, and the report names each folder that was left.
 *
 * Something else making `phileas-*` folders during the run, such as a Journey
 * in another terminal, would be reported too. Setting
 * PHILEAS_ALLOW_TEMP_LEFTOVERS=1 skips the check for that run, and says so.
 */

const OVERRIDE = 'PHILEAS_ALLOW_TEMP_LEFTOVERS';

function phileasFolders(): Set<string> {
  return new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('phileas-')));
}

export default function globalSetup() {
  const before = phileasFolders();

  return () => {
    const left = [...phileasFolders()].filter((name) => !before.has(name)).sort();
    if (left.length === 0) return;

    const listing = left.map((name) => `  ${name}`).join('\n');
    if (process.env[OVERRIDE] === '1') {
      console.warn(
        `${OVERRIDE}=1, so the leftover check is skipped. This run left ` +
          `${left.length} folder(s) in ${os.tmpdir()}:\n${listing}`
      );
      return;
    }
    throw new Error(
      `This run left ${left.length} folder(s) in ${os.tmpdir()}:\n${listing}\n\n` +
        `Whatever created each one should remove it, even when its test fails. ` +
        `If another run was making phileas-* folders at the same time, ` +
        `set ${OVERRIDE}=1 to skip this check.`
    );
  };
}

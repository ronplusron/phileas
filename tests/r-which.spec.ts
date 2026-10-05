import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { machineLibraries } from '../trial/rstudio/phileas/r-library-guard';
import { WHICH_R_VARIABLE, rscript } from '../trial/rstudio/phileas/which-r';

/**
 * The RStudio trial asks the R that RStudio starts about its libraries, which
 * RSTUDIO_WHICH_R names where it is set. Measured on 2026-10-05: under R 4.4.3
 * the R library guard had watched R 4.6's library, and read clean.
 */

test('the Rscript beside the R named, the PATH one where none is, and a name that is no R refused', () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'r-which-test-'));
  try {
    const r = path.join(bin, 'R');
    fs.writeFileSync(r, '');
    // Named R with no Rscript beside it: refused, not answered from the PATH.
    expect(() => rscript(r)).toThrow(/RSTUDIO_WHICH_R=".*" has no Rscript beside it/);
    fs.writeFileSync(path.join(bin, 'Rscript'), '');
    expect(rscript(r)).toBe(path.join(bin, 'Rscript'));
    expect(() => rscript(path.join(bin, 'no-such-R'))).toThrow(/names nothing/);
    expect(rscript(undefined)).toBe('Rscript');
    expect(rscript('  ')).toBe('Rscript');
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

// The R installed beside the machine's for the early Positron releases, and
// the R 4.4.3 the replay proof ran under.
const R_443 = '/Library/Frameworks/R.framework/Versions/4.4-arm64/Resources/bin/R';

test("the guard watches the library of the R RStudio starts, not the PATH's", () => {
  test.skip(!fs.existsSync(R_443), `R 4.4.3 is not installed at ${R_443}, so which library the guard reads under it cannot be checked`);
  const before = process.env[WHICH_R_VARIABLE];
  try {
    process.env[WHICH_R_VARIABLE] = R_443;
    const under443 = machineLibraries();
    expect(under443).toContain('/Library/Frameworks/R.framework/Versions/4.4-arm64/Resources/library');
    // The control: unset, the guard asks the PATH's R, which lists another
    // library, or the line above would hold whatever the variable said.
    delete process.env[WHICH_R_VARIABLE];
    const onPath = machineLibraries();
    expect(onPath).not.toContain('/Library/Frameworks/R.framework/Versions/4.4-arm64/Resources/library');
  } finally {
    if (before === undefined) delete process.env[WHICH_R_VARIABLE];
    else process.env[WHICH_R_VARIABLE] = before;
  }
});

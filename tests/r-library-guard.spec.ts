import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  ALLOW_R_LIBRARY_WRITES_VARIABLE,
  changesSince,
  guardRLibraries,
  snapshotLibraries,
} from '../trial/rstudio/phileas/r-library-guard';

/**
 * The RStudio trial's R library guard, against a library made for the test.
 * It has to fire on a change, or its silence after a real Journey says
 * nothing.
 */

let library: string;

/** A package folder with a DESCRIPTION, an hour old, as one installed earlier would be. */
function installEarlier(name: string): void {
  const folder = path.join(library, name);
  fs.mkdirSync(folder);
  const description = path.join(folder, 'DESCRIPTION');
  fs.writeFileSync(description, `Package: ${name}\n`);
  const anHourAgo = new Date(Date.now() - 3_600_000);
  fs.utimesSync(description, anHourAgo, anHourAgo);
  fs.utimesSync(folder, anHourAgo, anHourAgo);
}

test.beforeEach(() => {
  library = fs.mkdtempSync(path.join(os.tmpdir(), 'r-library-guard-test-'));
  installEarlier('abind');
  installEarlier('backports');
});

test.afterEach(() => {
  fs.rmSync(library, { recursive: true, force: true });
});

test("nothing changed, nothing found, though the library folder's own time moved", () => {
  // What every RStudio launch does: an entry made and taken away again.
  const snapshot = snapshotLibraries([library]);
  const passing = path.join(library, '00LOCK-check');
  fs.mkdirSync(passing);
  fs.rmdirSync(passing);
  expect(changesSince(snapshot)).toEqual([]);
});

test('a package added, removed or rewritten is found', () => {
  const snapshot = snapshotLibraries([library]);
  installEarlier('cli');
  fs.rmSync(path.join(library, 'abind'), { recursive: true });
  // Rewritten in place, as an update replaces a DESCRIPTION.
  fs.writeFileSync(path.join(library, 'backports', 'DESCRIPTION'), 'Package: backports\nVersion: 2\n');
  expect(changesSince(snapshot)).toEqual([
    `added: ${path.join(library, 'cli')}`,
    `changed: ${path.join(library, 'backports')}`,
    `removed: ${path.join(library, 'abind')}`,
  ].sort());
});

test('a library that cannot be read is refused, not read as empty', () => {
  expect(() => snapshotLibraries([path.join(library, 'not-there')])).toThrow(/ENOENT/);
});

test('the guard fails the run naming what changed, and the override says it skipped', () => {
  const check = guardRLibraries([library]);
  installEarlier('cli');
  expect(check).toThrow(/changed:\n\n {2}added: .*cli/);

  process.env[ALLOW_R_LIBRARY_WRITES_VARIABLE] = '1';
  try {
    const skipped = guardRLibraries([library]);
    installEarlier('glue');
    expect(skipped).not.toThrow();
  } finally {
    delete process.env[ALLOW_R_LIBRARY_WRITES_VARIABLE];
  }
});

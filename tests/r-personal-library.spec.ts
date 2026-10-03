import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  describePersonalLibrary,
  libraryList,
  resolvePersonalLibrary,
} from '../trial/rstudio/phileas/personal-library';
import { librariesToGuard } from '../trial/rstudio/phileas/r-library-guard';

/**
 * Which personal R library an RStudio Route sees, from
 * PHILEAS_R_PERSONAL_LIBRARY, without asking the machine's R: the default is
 * handed in, so each case says what R would have named.
 */

let scratch: string;

test.beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'r-personal-library-test-'));
});

test.afterEach(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

/** A library holding the named packages, each a folder with a DESCRIPTION. */
function libraryWith(name: string, packages: string[]): string {
  const folder = path.join(scratch, name);
  for (const pkg of packages) {
    fs.mkdirSync(path.join(folder, pkg), { recursive: true });
    fs.writeFileSync(path.join(folder, pkg, 'DESCRIPTION'), `Package: ${pkg}\n`);
  }
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

const never = () => {
  throw new Error('the default was asked for');
};

test("unset or 1 includes R's default, after the Route's own library", () => {
  const mine = libraryWith('mine', ['abind', 'backports']);
  for (const raw of [undefined, '', '1', ' 1 ']) {
    const personal = resolvePersonalLibrary(raw, () => [mine]);
    expect(personal, String(raw)).toEqual({ kind: 'default', folders: [mine], named: [mine] });
    expect(libraryList('/route/library', personal)).toBe(`/route/library:${mine}`);
  }
  expect(describePersonalLibrary(resolvePersonalLibrary('1', () => [mine]))).toBe(
    `R personal library: included, ${mine}, 2 packages`
  );
});

test("a default that does not exist adds nothing, and says what R named", () => {
  const missing = path.join(scratch, 'Library', 'R', 'arm64', '4.6', 'library');
  const personal = resolvePersonalLibrary(undefined, () => [missing]);
  expect(personal.folders).toEqual([]);
  expect(libraryList('/route/library', personal)).toBe('/route/library');
  expect(describePersonalLibrary(personal)).toBe(`R personal library: none, R's default ${missing} does not exist`);
});

test('0 leaves it out without asking R', () => {
  const personal = resolvePersonalLibrary('0', never);
  expect(personal).toEqual({ kind: 'off', folders: [] });
  expect(libraryList('/route/library', personal)).toBe('/route/library');
  expect(describePersonalLibrary(personal)).toBe('R personal library: left out, by PHILEAS_R_PERSONAL_LIBRARY=0');
});

test('a folder given by path is included in place of the default, without asking R', () => {
  const given = libraryWith('given', ['yaml']);
  const personal = resolvePersonalLibrary(given, never);
  expect(personal).toEqual({ kind: 'given', folders: [given] });
  expect(libraryList('/route/library', personal)).toBe(`/route/library:${given}`);
  expect(describePersonalLibrary(personal)).toBe(
    `R personal library: included, ${given}, 1 package, given by PHILEAS_R_PERSONAL_LIBRARY`
  );
});

test('anything else is refused, saying it belongs to the RStudio trial', () => {
  const file = path.join(scratch, 'a-file');
  fs.writeFileSync(file, '');
  const refusals: Array<[string, RegExp]> = [
    ['yes', /is not 1, 0 or an absolute path/],
    ['relative/library', /is not 1, 0 or an absolute path/],
    [path.join(scratch, 'nowhere'), /names no folder/],
    [file, /names no folder/],
    [`${scratch}:${scratch}`, /holds a colon/],
  ];
  for (const [raw, why] of refusals) {
    expect(() => resolvePersonalLibrary(raw, never), raw).toThrow(why);
    expect(() => resolvePersonalLibrary(raw, never), raw).toThrow(/belongs to the RStudio trial/);
  }
});

test('the R library guard watches a library given by path, and the default only once', () => {
  const machine = ['/Users/someone/Library/R/arm64/4.6/library', '/Library/Frameworks/R.framework/library'];
  expect(librariesToGuard(machine, [machine[0]!])).toEqual(machine);
  expect(librariesToGuard(machine, ['/given/library'])).toEqual([...machine, '/given/library']);
  expect(librariesToGuard(machine, [])).toEqual(machine);
});

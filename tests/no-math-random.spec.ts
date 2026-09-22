import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/**
 * `Math.random` must not appear in the engine.
 *
 * One unseeded draw anywhere in the traversal makes every recorded seed
 * reproduce a different route, and nothing about the run looks wrong: the
 * Journey passes, the report names a seed, and the seed is worthless. That is
 * R13's failure with no symptom, so the rule is checked rather than stated.
 *
 * It reads the files on disk rather than the compiled output, because what it
 * is guarding is what somebody typed.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, '..', 'src');

function typeScriptFilesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return typeScriptFilesUnder(full);
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : [];
  });
}

/**
 * Deliberately matches the words even inside a comment. A comment that names
 * the call is cheap to reword, and a check that has to understand where a
 * comment ends is not.
 */
const UNSEEDED = /Math\s*\.\s*random/;

test('no file in src/ calls Math.random', () => {
  const files = typeScriptFilesUnder(srcDir);

  // Two positive controls, because a clean zero is worthless until the search
  // is shown to find things, and this search has two ways to report one
  // falsely.
  //
  // That the pattern matches what it is for:
  expect(UNSEEDED.test('const draw = Math.random();')).toBe(true);
  expect(UNSEEDED.test('const draw = Math . random ();')).toBe(true);
  // ...and that the walk reaches real files with real contents in them:
  expect(files.length).toBeGreaterThan(5);
  expect(files.filter((file) => fs.readFileSync(file, 'utf8').includes('export')).length)
    .toBeGreaterThan(5);

  const offenders = files.filter((file) => UNSEEDED.test(fs.readFileSync(file, 'utf8')));

  expect(offenders.map((file) => path.relative(srcDir, file))).toEqual([]);
});

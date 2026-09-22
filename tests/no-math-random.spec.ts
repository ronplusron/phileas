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
const repoRoot = path.join(here, '..');

/**
 * Everywhere an unseeded draw would destroy replay, and why each one counts.
 *
 * `src/` is the engine. `testbed/buggy/phileas/` is the consumer layout, where
 * an adapter and a Fix live: a Fix drawing unseeded breaks replay exactly as a
 * draw in the engine would, and it was outside this scan until review. The
 * application itself is here because assumption 12 of the requirements is that
 * it behaves the same way twice, and R8 rests on it -- an application that
 * draws unseeded makes every recorded seed fail to reproduce, and the engine
 * takes the blame for it.
 */
const ROOTS = ['src', path.join('testbed', 'buggy')];

const SKIP = new Set(['node_modules', 'dist', 'test-results']);

// Not only .ts. The application is written in .cjs and .js, which the earlier
// version of this scan could not see at all, and those are the files where an
// unseeded draw does the most damage.
const SOURCE = /\.(ts|cjs|mjs|js)$/;

function sourceFilesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(full);
    return entry.isFile() && SOURCE.test(entry.name) ? [full] : [];
  });
}

/**
 * Deliberately matches the words even inside a comment. A comment that names
 * the call is cheap to reword, and a check that has to understand where a
 * comment ends is not.
 */
const UNSEEDED = /Math\s*\.\s*random/;

test('nothing the engine depends on calls Math.random', () => {
  const files = ROOTS.flatMap((root) => sourceFilesUnder(path.join(repoRoot, root)));

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

  // ...and that the walk reaches each root, not merely the first one. A scan
  // that silently covered src/ alone would report the same clean zero.
  for (const root of ROOTS) {
    expect(
      files.filter((file) => file.startsWith(path.join(repoRoot, root))).length,
      `the walk reached nothing under ${root}`
    ).toBeGreaterThan(0);
  }

  const offenders = files.filter((file) => UNSEEDED.test(fs.readFileSync(file, 'utf8')));

  expect(offenders.map((file) => path.relative(repoRoot, file))).toEqual([]);
});

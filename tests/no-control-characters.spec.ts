import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

/**
 * No source file holds a raw control character.
 *
 * **This is not style.** A file containing one is classified as binary by grep
 * and by other tools, which then skip it in silence. Every search against that
 * file returns a clean zero, and a clean zero from a broken search cannot be
 * told apart from a clean zero from a working one. That is the same shape as
 * every other failure this project cares about: the answer a correct run
 * produces, produced by something that is not working.
 *
 * `random.ts` already knew this and says so at the one place it needs a NUL,
 * where it writes the escape rather than the character. `survey.ts` was then
 * written with a literal NUL in a template string the next day, and it hid the
 * whole file from every search for a session before a positive control caught
 * it. Prose was the control and prose lost, which is what makes this a test.
 *
 * fileURLToPath, not .pathname: the latter stays percent-encoded and breaks on
 * any repository path containing a space, which this one has.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Tab, newline and carriage return are ordinary text; nothing else is. */
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/**
 * Every file git would keep, tracked or not yet added, and nothing it ignores.
 *
 * It walked the folder until 2026-10-14, skipping only `node_modules`, `dist`
 * and dot-folders. Then a failed Route began writing its page to
 * `test-results/` as `dom.html`, and RStudio's pages hold a U+0002, so the
 * suite failed on output Playwright makes and git ignores, which is no
 * source file at all.
 */
function sourceFiles(): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter((name) => /[.](ts|js|cjs|mjs|json|md|html|css)$/.test(name))
    .map((name) => path.join(ROOT, name))
    .filter((file) => fs.existsSync(file));
}

test('no source file hides itself from search with a control character', () => {
  const offenders: string[] = [];

  for (const file of sourceFiles()) {
    const contents = fs.readFileSync(file, 'utf8');
    const match = FORBIDDEN.exec(contents);
    if (!match) continue;

    const line = contents.slice(0, match.index).split(String.fromCharCode(10)).length;
    const code = match[0].charCodeAt(0).toString(16).padStart(4, '0').toUpperCase();
    offenders.push(path.relative(ROOT, file) + ':' + line + ' holds U+' + code);
  }

  expect(
    offenders,
    'Write the escape sequence instead, as random.ts does. A raw control character makes ' +
      'grep treat the file as binary and skip it silently, so every search against it comes ' +
      'back clean whatever is in it.'
  ).toEqual([]);
});

test('the scan reads the source and not what git ignores', () => {
  // The control for the list itself: a list that came back empty would pass
  // the test above on every repository.
  const files = sourceFiles().map((file) => path.relative(ROOT, file));
  expect(files).toContain(path.join('src', 'random.ts'));
  expect(files.some((file) => file.split(path.sep).includes('test-results'))).toBe(false);
});

test('the scan can actually find one', () => {
  // The positive control, and the whole reason this file is trustworthy. A scan
  // whose pattern was wrong would report the same empty list as a clean
  // repository, which is the failure the test above exists to prevent, one
  // level up.
  expect(FORBIDDEN.test('role' + String.fromCharCode(0) + 'name')).toBe(true);

  // The escape sequence itself is six ordinary characters and must not match.
  expect(FORBIDDEN.test('role' + '\\u0000' + 'name')).toBe(false);

  // Nor may the whitespace that every source file is full of.
  const whitespace = ['a', 'b', 'c'].join(String.fromCharCode(9)) +
    String.fromCharCode(10) + String.fromCharCode(13);
  expect(FORBIDDEN.test(whitespace)).toBe(false);
});

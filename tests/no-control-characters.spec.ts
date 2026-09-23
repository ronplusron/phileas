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

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/[.](ts|js|cjs|mjs|json|md|html|css)$/.test(entry.name)) found.push(full);
  }
  return found;
}

test('no source file hides itself from search with a control character', () => {
  const offenders: string[] = [];

  for (const file of sourceFiles(ROOT)) {
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

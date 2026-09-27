import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  ALLOW_HOME_WRITES_VARIABLE,
  guardHome,
  snapshotHome,
  writesSince,
} from '../trial/positron/phileas/home-guard';

/**
 * The Positron trial's home folder guard, against a home folder made for the
 * test. It has to fire on a write, or its silence after a real Journey says
 * nothing.
 */

let home: string;

test.beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-guard-test-'));
  // Already there before the Journey, as on a machine that has run Positron.
  fs.mkdirSync(path.join(home, '.copilot', 'logs'), { recursive: true });
  const earlier = path.join(home, '.copilot', 'logs', 'earlier.log');
  fs.writeFileSync(earlier, 'before');
  // An hour ago, as a file left by an earlier session would be. Written now,
  // it lands within the same instant as the snapshot.
  const anHourAgo = new Date(Date.now() - 3_600_000);
  fs.utimesSync(earlier, anHourAgo, anHourAgo);
  fs.mkdirSync(path.join(home, 'Library', 'Application Support'), { recursive: true });
});

test.afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

test('nothing written, nothing found, including files older than the Journey', () => {
  expect(writesSince(snapshotHome(home))).toEqual([]);
});

test('a file written under a folder Positron uses is found', () => {
  const snapshot = snapshotHome(home, Date.now() - 1_000);
  fs.writeFileSync(path.join(home, '.copilot', 'logs', 'during.log'), 'during');
  expect(writesSince(snapshot)).toEqual(['~/.copilot/logs/during.log']);
});

test('a new folder at the top of the home folder or Application Support is found, wherever it is', () => {
  // The case a list of Positron's folders cannot cover: somewhere new.
  const snapshot = snapshotHome(home);
  fs.mkdirSync(path.join(home, '.somewhere-new'));
  fs.mkdirSync(path.join(home, 'Library', 'Application Support', 'SomeApp'));
  expect(writesSince(snapshot)).toEqual(['~/.somewhere-new', '~/Library/Application Support/SomeApp']);
});

test('the guard fails the run naming what was written, and the override says it skipped', () => {
  const check = guardHome(home);
  fs.mkdirSync(path.join(home, '.positron'));
  expect(check).toThrow(/written into the real home folder or the Journey's folder:\n\n {2}~\/\.positron/);

  process.env[ALLOW_HOME_WRITES_VARIABLE] = '1';
  try {
    const skipped = guardHome(home);
    fs.mkdirSync(path.join(home, '.posit'));
    expect(skipped).not.toThrow();
  } finally {
    delete process.env[ALLOW_HOME_WRITES_VARIABLE];
  }
});

test("a new file in the Journey's folder is found, and the run's own output there is not", () => {
  // Where a relative write lands when an application runs from where the
  // Journey started, as a bundled Positron extension's log did.
  const journeyDir = path.join(home, 'journey');
  fs.mkdirSync(journeyDir);
  const snapshot = snapshotHome(home, Date.now(), { dir: journeyDir, ownEntries: ['.phileas-journals'] });
  fs.writeFileSync(path.join(journeyDir, 'snowflake.log'), 'written by the application');
  fs.mkdirSync(path.join(journeyDir, '.phileas-journals'));
  expect(writesSince(snapshot)).toEqual([path.join(journeyDir, 'snowflake.log')]);
});

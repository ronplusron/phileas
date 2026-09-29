import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  ALLOW_TEMP_LEFTOVERS_VARIABLE,
  RUN_VARIABLE,
  SEED_VARIABLE,
  TEMP_FOLDER_VARIABLE,
  defineJourney,
  finishJourney,
  makeUserDataDir,
  runEveryCheck,
  startJourney,
} from '../src/index';

/**
 * A Journey's end fails the run on a profile folder it left in its own folder
 * in the system temp folder, and sees nothing outside it. Measured on Positron
 * on 2026-09-27: a helper wrote into a profile later than the engine watched
 * for, recreating it, and nothing looked. Then, the same day, the Eighty Days
 * demo failed on a profile the Positron trial had made while both ran, because
 * the check read the whole temp folder.
 */

const journey = defineJourney({ routes: 1, tripLength: 1 });

// The override as the suite was started with it. Cleared for each test and
// put back after, because a suite run with the override set would otherwise
// skip the very check these tests expect to fire.
const callersOverride = process.env[ALLOW_TEMP_LEFTOVERS_VARIABLE];

// The suite's own folder, which a Journey started here must put back.
const suitesFolder = process.env[TEMP_FOLDER_VARIABLE];

test.beforeEach(() => {
  process.env[SEED_VARIABLE] = 'journey-end';
  delete process.env[ALLOW_TEMP_LEFTOVERS_VARIABLE];
});
test.afterEach(() => {
  delete process.env[SEED_VARIABLE];
  delete process.env[RUN_VARIABLE];
  if (callersOverride === undefined) delete process.env[ALLOW_TEMP_LEFTOVERS_VARIABLE];
  else process.env[ALLOW_TEMP_LEFTOVERS_VARIABLE] = callersOverride;
  if (suitesFolder === undefined) delete process.env[TEMP_FOLDER_VARIABLE];
  else process.env[TEMP_FOLDER_VARIABLE] = suitesFolder;
});

/**
 * Start a Journey, run `body` with its folder, and remove that folder after
 * whatever happened. A Journey's folder is made in the system temp folder, not
 * the suite's, so the suite's own check would never see one left by a test.
 */
function withJourney(body: (tempFolder: string) => void): void {
  const { tempFolder } = startJourney(journey, buggy);
  try {
    body(tempFolder);
  } finally {
    fs.rmSync(tempFolder, { recursive: true, force: true });
  }
}

test('a Journey that left a profile behind fails, naming it', () => {
  withJourney((folder) => {
    const left = fs.mkdtempSync(folder + path.sep);
    expect(() => finishJourney()).toThrow(
      new RegExp(`This Journey left 1 folder\\(s\\) in ${folder}[\\s\\S]*${path.basename(left)}`)
    );
  });
});

test('a Journey that left nothing passes and removes its folder, which is the control', () => {
  withJourney((folder) => {
    expect(path.basename(folder)).toMatch(/^phileas-buggy-[A-Za-z0-9]{6}$/);
    expect(() => finishJourney()).not.toThrow();
    expect(fs.existsSync(folder)).toBe(false);
  });
});

test("another run's folder in the system temp folder does not fail this Journey", () => {
  // The same kind of folder the first test leaves, made where a run beside
  // this one would make it. That test is the control: the check finds such a
  // folder when it is this Journey's.
  withJourney(() => {
    const others = fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-positron-'));
    try {
      expect(() => finishJourney()).not.toThrow();
    } finally {
      fs.rmSync(others, { recursive: true, force: true });
    }
  });
});

test('the override skips the check and says what was left', () => {
  withJourney((folder) => {
    const left = fs.mkdtempSync(folder + path.sep);
    process.env[ALLOW_TEMP_LEFTOVERS_VARIABLE] = '1';
    const warnings: string[] = [];
    const warn = console.warn;
    console.warn = (message: string) => warnings.push(message);
    try {
      expect(() => finishJourney()).not.toThrow();
      expect(warnings.join('\n')).toContain(path.basename(left));
    } finally {
      console.warn = warn;
    }
  });
});

test("a Journey's end puts back the run folder that was in force before it", () => {
  withJourney((folder) => {
    expect(process.env[TEMP_FOLDER_VARIABLE]).toBe(folder);
    finishJourney();
  });
  expect(process.env[TEMP_FOLDER_VARIABLE]).toBe(suitesFolder);
});

test('a profile asked for with no run folder is refused by name, never made in the shared temp folder', async () => {
  delete process.env[TEMP_FOLDER_VARIABLE];
  await expect(makeUserDataDir(buggy)).rejects.toThrow(/PHILEAS_TEMP_FOLDER is not set/);
});

test('every check at the end runs when an earlier one fails, and both are reported', () => {
  const ran: string[] = [];
  const fail = (message: string) => () => {
    ran.push(message);
    throw new Error(message);
  };
  expect(() => runEveryCheck([fail('first guard fired'), fail('second guard fired')])).toThrow(
    /2 checks failed[\s\S]*first guard fired[\s\S]*second guard fired/
  );
  expect(ran).toEqual(['first guard fired', 'second guard fired']);
});

test('known findings failing to record does not hide a profile left behind', () => {
  withJourney((folder) => {
    const left = fs.mkdtempSync(folder + path.sep);
    // No journalsRoot, so recording the known findings throws first.
    expect(() => finishJourney({ knownFindings: 'known-findings.json' })).toThrow(
      new RegExp(`needs journalsRoot[\\s\\S]*This Journey left 1 folder\\(s\\)[\\s\\S]*${path.basename(left)}`)
    );
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  ALLOW_TEMP_LEFTOVERS_VARIABLE,
  RUN_VARIABLE,
  SEED_VARIABLE,
  defineJourney,
  finishJourney,
  runEveryCheck,
  startJourney,
} from '../src/index';

/**
 * A Journey's end fails the run on a profile folder it left in the temp
 * folder. Measured on Positron on 2026-09-27: a helper wrote into a profile
 * later than the engine watched for, recreating it, and nothing looked.
 */

const journey = defineJourney({ routes: 1, tripLength: 1 });

test.beforeEach(() => {
  process.env[SEED_VARIABLE] = 'journey-end';
});
test.afterEach(() => {
  delete process.env[SEED_VARIABLE];
  delete process.env[RUN_VARIABLE];
  delete process.env[ALLOW_TEMP_LEFTOVERS_VARIABLE];
});

test('a Journey that left a profile behind fails, naming it', () => {
  startJourney(journey);
  const left = fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-positron-'));
  try {
    expect(() => finishJourney()).toThrow(new RegExp(`This Journey left 1 folder\\(s\\)[\\s\\S]*${path.basename(left)}`));
  } finally {
    fs.rmSync(left, { recursive: true, force: true });
  }
});

test('a Journey that left nothing passes, which is the control', () => {
  startJourney(journey);
  expect(() => finishJourney()).not.toThrow();
});

test('the override skips the check and says what was left', () => {
  startJourney(journey);
  const left = fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-positron-'));
  process.env[ALLOW_TEMP_LEFTOVERS_VARIABLE] = '1';
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    expect(() => finishJourney()).not.toThrow();
    expect(warnings.join('\n')).toContain(path.basename(left));
  } finally {
    console.warn = warn;
    fs.rmSync(left, { recursive: true, force: true });
  }
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
  startJourney(journey);
  const left = fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-positron-'));
  try {
    // No journalsRoot, so recording the known findings throws first.
    expect(() => finishJourney({ knownFindings: 'known-findings.json' })).toThrow(
      new RegExp(`needs journalsRoot[\\s\\S]*This Journey left 1 folder\\(s\\)[\\s\\S]*${path.basename(left)}`)
    );
  } finally {
    fs.rmSync(left, { recursive: true, force: true });
  }
});

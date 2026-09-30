import { test, expect } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  FIX_OVERRIDE_VARIABLE,
  NO_FIX,
  defineFixes,
  defineJourney,
  finishJourney,
  fixFor,
  fixName,
  startJourney,
  type Fix,
} from '../src/index';

/**
 * A consumer's Fixes, listed by name, and the Journey choosing one: in its
 * terms, or for one run with `--fix`, which travels as PHILEAS_FIX.
 */

const opens: Fix = async ({ step }) => step({ kind: 'act', target: 'button "Summary"' });
const types: Fix = async ({ step }) => step({ kind: 'act', target: 'textbox "Search"', value: 'trunk' });
const fixes = defineFixes({ opens, 'types-a-word': types });

const callersFix = process.env[FIX_OVERRIDE_VARIABLE];
test.afterEach(() => {
  if (callersFix === undefined) delete process.env[FIX_OVERRIDE_VARIABLE];
  else process.env[FIX_OVERRIDE_VARIABLE] = callersFix;
});
test.beforeEach(() => {
  delete process.env[FIX_OVERRIDE_VARIABLE];
});

test('a Journey opens with the Fix its terms name, and with none when they name none', () => {
  expect(fixFor(defineJourney({ routes: 1, tripLength: 1, fix: 'opens' }), fixes)).toBe(opens);
  expect(fixFor(defineJourney({ routes: 1, tripLength: 1 }), fixes)).toBeUndefined();
});

test('--fix chooses another Fix for one run, and none turns it off', () => {
  process.env[FIX_OVERRIDE_VARIABLE] = 'types-a-word';
  expect(fixFor(defineJourney({ routes: 1, tripLength: 1, fix: 'opens' }), fixes)).toBe(types);
  process.env[FIX_OVERRIDE_VARIABLE] = NO_FIX;
  expect(fixFor(defineJourney({ routes: 1, tripLength: 1, fix: 'opens' }), fixes)).toBeUndefined();
});

test('a Fix name that is not listed is refused, naming those that are', () => {
  process.env[FIX_OVERRIDE_VARIABLE] = 'opnes';
  expect(() => fixFor(defineJourney({ routes: 1, tripLength: 1 }), fixes)).toThrow(
    /"opnes" \(from PHILEAS_FIX\), which is not one of this consumer's Fixes\. It has "opens", "types-a-word", or "none"/
  );
  delete process.env[FIX_OVERRIDE_VARIABLE];
  expect(() => fixFor(defineJourney({ routes: 1, tripLength: 1, fix: 'opens' }), undefined)).toThrow(
    /names the Fix "opens", but no Fixes were given/
  );
});

test('startJourney refuses an unlisted Fix before anything launches, and prints the one in force', () => {
  process.env[FIX_OVERRIDE_VARIABLE] = 'opnes';
  expect(() => startJourney(defineJourney({ routes: 1, tripLength: 1 }), buggy, fixes)).toThrow(/"opnes"/);

  process.env[FIX_OVERRIDE_VARIABLE] = 'types-a-word';
  const { settings } = startJourney(defineJourney({ routes: 1, tripLength: 1, fix: 'opens' }), buggy, fixes);
  finishJourney();
  expect(settings.find((line) => line.startsWith('Fix:'))).toMatch(/^Fix: types-a-word\s+set for this run$/);

  delete process.env[FIX_OVERRIDE_VARIABLE];
  const unset = startJourney(defineJourney({ routes: 1, tripLength: 1 }), buggy, fixes).settings;
  finishJourney();
  expect(unset.find((line) => line.startsWith('Fix:'))).toBe('Fix: none');
});

test('a Fix name must be one --fix can take, and none is kept for no Fix', () => {
  expect(() => defineFixes({ 'Opens It': opens })).toThrow(/lower case words joined by hyphens/);
  expect(() => defineFixes({ none: opens })).toThrow(/cannot be named "none"/);
  expect(fixName(types)).toBe('types-a-word');
});

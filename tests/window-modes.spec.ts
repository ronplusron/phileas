import { test, expect } from '@playwright/test';
import {
  windowMode,
  showWindows,
  hopDelayFromEnvironment,
  WINDOW_MODE_VARIABLE,
  HOP_DELAY_VARIABLE,
} from '../src/index';

/**
 * How a run is asked to show itself, and how it is asked to slow down.
 *
 * Both are read from the environment, and both refuse a value they do not
 * recognize. That refusal is the point of most of these tests: a mistyped mode
 * quietly meaning "off the screen" looks exactly like a run somebody asked to
 * watch and then could not see, and they would spend the afternoon looking for
 * a window rather than at their own spelling.
 *
 * Pure functions, so nothing is launched here. What they decide is checked
 * against a real application in the launch tests.
 */

function withVariable<T>(name: string, value: string | undefined, body: () => T): T {
  const before = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return body();
  } finally {
    if (before === undefined) delete process.env[name];
    else process.env[name] = before;
  }
}

test('unset, 0 and hidden all mean off the screen', () => {
  for (const value of [undefined, '', '0', 'hidden', 'HIDDEN', '  hidden  ']) {
    expect(withVariable(WINDOW_MODE_VARIABLE, value, windowMode)).toBe('hidden');
    expect(withVariable(WINDOW_MODE_VARIABLE, value, showWindows)).toBe(false);
  }
});

test('1 still means what it always meant, which is back', () => {
  // Nothing written against the older switch changes behavior. `1` was the only
  // documented way to show a window before the mode existed, and it showed one
  // without activating the application, which is exactly `back`.
  expect(withVariable(WINDOW_MODE_VARIABLE, '1', windowMode)).toBe('back');
  expect(withVariable(WINDOW_MODE_VARIABLE, 'back', windowMode)).toBe('back');
});

test('front and top are their own modes, and both count as shown', () => {
  for (const value of ['front', 'top', 'FRONT', 'Top']) {
    expect(withVariable(WINDOW_MODE_VARIABLE, value, showWindows)).toBe(true);
  }
  expect(withVariable(WINDOW_MODE_VARIABLE, 'front', windowMode)).toBe('front');
  expect(withVariable(WINDOW_MODE_VARIABLE, 'top', windowMode)).toBe('top');
});

test('a mode nobody recognizes is refused, not read as hidden', () => {
  // The failure this prevents: a typo meaning "off the screen" is
  // indistinguishable from a run that was asked to hide, so the viewer looks
  // for a window that was never going to appear.
  for (const typo of ['fornt', 'show', 'true', 'yes', '2']) {
    expect(() => withVariable(WINDOW_MODE_VARIABLE, typo, windowMode)).toThrow(
      /is not a window mode/
    );
  }

  // And the message names every mode, because a refusal that does not say what
  // to type instead has only moved the afternoon somewhere else.
  const message = (() => {
    try {
      withVariable(WINDOW_MODE_VARIABLE, 'fornt', windowMode);
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : '';
    }
  })();
  for (const mode of ['hidden', 'back', 'front', 'top']) expect(message).toContain(mode);
});

test('no delay unless one is asked for', () => {
  for (const value of [undefined, '', '0']) {
    expect(withVariable(HOP_DELAY_VARIABLE, value, hopDelayFromEnvironment)).toBe(0);
  }
  expect(withVariable(HOP_DELAY_VARIABLE, '1000', hopDelayFromEnvironment)).toBe(1_000);
});

test('a delay that is not a whole number of milliseconds is refused', () => {
  // Same reason as the mode above, and one case of its own: a negative delay
  // read as zero would be a watched run that quietly refused to slow down.
  for (const bad of ['-1', '1.5', 'slow', '1s', '1000ms']) {
    expect(() => withVariable(HOP_DELAY_VARIABLE, bad, hopDelayFromEnvironment)).toThrow(
      RangeError
    );
  }
});

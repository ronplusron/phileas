import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { buggy } from '../testbed/buggy/phileas/adapter/index';
import { closeApp, makeUserDataDir, WINDOW_MODE_VARIABLE, type AppUnderTest } from '../src/index';
import { launchOrRemove } from './scratch';

/**
 * What each window mode does to a real window.
 *
 * The parser tests next door prove a string becomes a mode. These prove the
 * mode reaches the application, which is the part that can silently fail: the
 * whole reason these modes exist is that showing a window and activating the
 * application turned out to be different things, and everything readable from
 * inside the process said the window was fine while the viewer saw nothing.
 *
 * **One of the four cannot be verified here, and saying so is the point.**
 * `front` differs from `back` only in whether the operating system makes this
 * application frontmost, and nothing inside the process reports that:
 * `isVisible` and `isFocused` both read the same under either. Confirming it
 * needs the screen, and screen access is deliberately unavailable to this
 * shell. It was confirmed by a person looking at the screen on 2026-09-22, and
 * that is the only evidence there is for it. A test asserting `front` works,
 * written from inside, would be asserting something it cannot see.
 */

async function windowState(mode: string | undefined, cfg: AppUnderTest = buggy) {
  const before = process.env[WINDOW_MODE_VARIABLE];
  if (mode === undefined) delete process.env[WINDOW_MODE_VARIABLE];
  else process.env[WINDOW_MODE_VARIABLE] = mode;

  const userDataDir = await makeUserDataDir(cfg);
  const launched = await launchOrRemove(cfg, userDataDir);
  try {
    // Synchronized on the application being ready before anything is read.
    // `buggy` creates its window hidden and calls show() on 'ready-to-show',
    // which is the common pattern and the right one, so reading visibility
    // straight after launch races the application: two of these tests failed
    // that way and the third passed on the luck of an extra round trip, which
    // is worse than all three failing.
    await cfg.waitForReady(await launched.app.firstWindow());

    return await launched.app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return {
        exists: window !== undefined,
        visible: window?.isVisible() ?? false,
        alwaysOnTop: window?.isAlwaysOnTop() ?? false,
      };
    });
  } finally {
    try {
      await closeApp(cfg, launched);
    } finally {
      await fs.promises.rm(userDataDir, { recursive: true, force: true });
      if (before === undefined) delete process.env[WINDOW_MODE_VARIABLE];
      else process.env[WINDOW_MODE_VARIABLE] = before;
    }
  }
}

test('hidden keeps the window off the screen', async () => {
  const state = await windowState(undefined);
  expect(state.exists).toBe(true);
  expect(state.visible).toBe(false);
});

test('back puts the window on the screen without pinning it', async () => {
  const state = await windowState('back');
  expect(state.visible).toBe(true);

  // The distinction from `top`, and the reason `back` is the useful default for
  // watching: the run does not take the screen away from whoever is watching.
  expect(state.alwaysOnTop).toBe(false);
});

test('front shows the window and does not pin it either', async () => {
  const state = await windowState('front');
  expect(state.visible).toBe(true);
  expect(state.alwaysOnTop).toBe(false);

  // What is NOT asserted here is the activation, which is the only thing
  // separating this from `back`. See the note at the top of this file: it is
  // not observable from inside the process, so it is not claimed here.
});

test('top shows the window and keeps it above everything', async () => {
  const state = await windowState('top');
  expect(state.visible).toBe(true);

  // Observable from inside, unlike the activation, so this one is genuinely
  // checked. It is also the mode that a viewer cannot get away from, which was
  // measured by trapping one.
  expect(state.alwaysOnTop).toBe(true);
});

test('top keeps a window created already shown above everything too', async () => {
  // Such a window never calls show(), which is all top used to replace: the
  // same gap hidden mode closed for Positron, left open here.
  const state = await windowState('top', { ...buggy, launchArgs: ['--buggy-shown-at-creation'] });
  expect(state.visible).toBe(true);
  expect(state.alwaysOnTop).toBe(true);
});

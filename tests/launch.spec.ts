import fs from 'node:fs';
import path from 'node:path';
import { test, expect, _electron, type ElectronApplication } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  launchApp,
  closeApp,
  makeUserDataDir,
  resolveBundle,
  assertBundleFresh,
  reachMainProcess,
  prepareWindows,
  MAIN_PROCESS_ATTEMPTS,
} from '../src/index';
import { openedExternally, nativeDialogs } from '../src/index';
import type { AppUnderTest } from '../src/index';
import { launchOrRemove } from './scratch';

/**
 * The phase 2 boundary, stated as tests.
 *
 * Each one holds up a claim docs/PLAN.md makes about this boundary: it
 * launches a packaged build (C1), refuses a stale one (R23), reports what is
 * missing rather than timing out (R24), and stays off the screen (C5).
 *
 * Nothing here travels through the application; tests/route.spec.ts does.
 */

async function withApp(cfg: AppUnderTest, body: (launched: Awaited<ReturnType<typeof launchApp>>) => Promise<void>) {
  const dir = await makeUserDataDir(cfg);
  const launched = await launchOrRemove(cfg, dir);
  try {
    await body(launched);
  } finally {
    await closeApp(cfg, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

test('it launches the packaged bundle, not a source directory', async () => {
  const bundle = resolveBundle(buggy);

  // The executable is inside the .app, which is what C1 asks for. Asserting
  // the path rather than merely that something launched: a source-directory
  // launch would also produce a running application and prove nothing.
  expect(bundle.executable).toContain('.app/Contents/MacOS/');
  expect(bundle.asarPath !== undefined && fs.existsSync(bundle.asarPath)).toBe(true);

  await withApp(buggy, async (launched) => {
    await buggy.waitForReady(await launched.app.firstWindow());
    expect(launched.path).toBe('electron');
  });
});

test('the staleness guard runs, and says so', async () => {
  const bundle = resolveBundle(buggy);
  const verdict = assertBundleFresh(buggy, bundle.asarPath);

  // Not merely "it did not throw". A guard that skipped reports the same
  // silence as one that passed, which is the whole reason it returns a
  // verdict rather than exiting quietly.
  expect(verdict.ran).toBe(true);
});

test('it refuses a stale bundle, naming the file that differs', async () => {
  const bundle = resolveBundle(buggy);
  const target = path.join(String(buggy.staleness?.sourceRoot), 'data', 'items.json');
  const original = await fs.promises.readFile(target);

  // Edit a packaged input so the working tree and the bundle disagree, then
  // put it back. This is the positive control for the guard: without it, a
  // passing guard is indistinguishable from one that checks nothing.
  await fs.promises.writeFile(target, original.toString('utf8').replace('2200', '2201'));
  try {
    expect(() => assertBundleFresh(buggy, bundle.asarPath)).toThrow(/STALE/);
    expect(() => assertBundleFresh(buggy, bundle.asarPath)).toThrow(/items\.json/);
  } finally {
    await fs.promises.writeFile(target, original);
  }

  // And it passes again once the edit is undone, which proves the failure
  // above came from the edit rather than from the guard being broken.
  expect(assertBundleFresh(buggy, bundle.asarPath).ran).toBe(true);
});

test("a real boot failure reports the application's own message, not a timeout", async () => {
  // The application is told to fail its own items request, and everything after
  // that is its own code path: the handler throws, the renderer's catch writes
  // the marker, and the adapter reads it.
  //
  // The earlier version of this test set the marker itself with page.evaluate,
  // after a successful boot. It passed against an adapter that could never see
  // a real failure, because it supplied the state it was checking for. R24 is
  // about the ordering a real boot produces, so the test has to produce one.
  const failing: AppUnderTest = { ...buggy, launchArgs: ['--buggy-fail-items'] };

  await withApp(failing, async (launched) => {
    const page = await launched.app.firstWindow();

    const started = Date.now();
    await expect(failing.waitForReady(page)).rejects.toThrow(/the trunk could not be opened/);

    // It reported rather than waited. Without this the test would also pass on
    // an adapter that timed out and happened to mention the right text, which
    // is the distinction R24 is entirely about.
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});

test('an application that opens no window is reported in its own words, and closed', async () => {
  // It says why on standard error once Electron is ready, and opens nothing.
  // Waiting for the window used to time out saying only that no window came.
  test.setTimeout(90_000);
  const noWindow: AppUnderTest = { ...buggy, launchArgs: ['--buggy-no-window'] };
  const dir = await makeUserDataDir(noWindow);
  try {
    await expect(launchApp(noWindow, dir)).rejects.toThrow(
      /Timeout.*\n\nThe application's standard error since the launch returned:\n\n {2}Buggy cannot start: the luggage room is locked/
    );

    // And nothing was left running on that profile to be cleaned up by hand.
    const { execFileSync } = await import('node:child_process');
    const running = execFileSync('ps', ['-axo', 'command'], { encoding: 'utf8' })
      .split('\n')
      .filter((line) => line.includes(`--user-data-dir=${dir}`));
    expect(running).toEqual([]);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test("launch arguments written as a function are given the launch's own profile folder", async () => {
  // For an argument that has to name a fresh folder each Route, such as
  // Positron's --extensions-dir. The flag reaching the application is shown by
  // its own failure message, as in the test above, so the function's result
  // was used and not merely called.
  const handed: string[] = [];
  const failing: AppUnderTest = {
    ...buggy,
    launchArgs: (userDataDir) => {
      handed.push(userDataDir);
      return ['--buggy-fail-items'];
    },
  };

  const dir = await makeUserDataDir(failing);
  const launched = await launchOrRemove(failing, dir);
  try {
    expect(handed).toEqual([dir]);
    await expect(failing.waitForReady(await launched.app.firstWindow())).rejects.toThrow(
      /the trunk could not be opened/
    );
  } finally {
    await closeApp(failing, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('a healthy boot reaches the ready state, not merely an attached marker', async () => {
  // The positive control for the test above. An adapter that always threw would
  // satisfy that one, and this is what says the two outcomes differ.
  await withApp(buggy, async (launched) => {
    const page = await launched.app.firstWindow();
    await buggy.waitForReady(page);

    await expect(page.locator('#status')).toHaveAttribute('data-boot', 'ready');
  });
});

test("the application runs from its own profile folder, not from where the run started", async () => {
  // A relative write then lands in what the Route throws away rather than in
  // the consumer's repository. Compared through realpath, since the system temp
  // folder is reached through a symbolic link on macOS.
  const dir = await makeUserDataDir(buggy);
  const launched = await launchOrRemove(buggy, dir);
  try {
    const cwd = await launched.app.evaluate(() => process.cwd());
    expect(fs.realpathSync(cwd)).toBe(fs.realpathSync(dir));
    expect(fs.realpathSync(cwd)).not.toBe(fs.realpathSync(process.cwd()));
  } finally {
    await closeApp(buggy, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('it stays off the screen', async () => {
  await withApp(buggy, async (launched) => {
    await buggy.waitForReady(await launched.app.firstWindow());

    const visible = await launched.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((w) => w.isVisible())
    );

    // Assert a window exists before asserting it is hidden. An empty list
    // would satisfy "none are visible" while proving nothing at all.
    expect(visible, 'no window exists, so this asserts nothing').toHaveLength(1);
    expect(visible).toEqual([false]);
  });
});

test('a window created already shown is off the screen too', async () => {
  // The way Positron creates its main window, with show: true, which never
  // calls the show() the test above relies on replacing, and which comes after
  // the windows open at launch were hidden. Its window stayed up for whole runs
  // that reported hidden mode.
  const shownAtCreation: AppUnderTest = { ...buggy, launchArgs: ['--buggy-shown-at-creation'] };
  await withApp(shownAtCreation, async (launched) => {
    await shownAtCreation.waitForReady(await launched.app.firstWindow());

    const visible = await launched.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((w) => w.isVisible())
    );

    expect(visible, 'no window exists, so this asserts nothing').toHaveLength(1);
    expect(visible).toEqual([false]);
  });
});

/** What buggy saw of its own window: each moment it was visible and not transparent. */
const sightings = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as unknown as { buggySightings?: { at: number; opacity: number }[] }).buggySightings);

test('a window created already shown is never visible, not even for a moment', async () => {
  // Hiding it on its 'show' event left it on the screen for about 300 ms first,
  // at full opacity, on every launch. The evidence is buggy's own record of its
  // window, polled every 2 ms from its main process, so it does not rest on the
  // engine's hiding having worked.
  const shownAtCreation: AppUnderTest = { ...buggy, launchArgs: ['--buggy-shown-at-creation'] };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 1_500));

  // The control: the hiding as it was, installed after a plain launch. It has
  // to catch the flash, or the empty record below could mean the record is
  // blind rather than that the window stayed off the screen.
  const dir = await makeUserDataDir(shownAtCreation);
  const plain = await _electron.launch({
    executablePath: resolveBundle(shownAtCreation).executable,
    cwd: dir,
    args: [`--user-data-dir=${dir}`, '--buggy-shown-at-creation'],
  });
  try {
    await reachMainProcess(plain);
    await prepareWindows(plain, 'hidden');
    await plain.firstWindow();
    await settle();
    expect(await sightings(plain), 'the record never started, so this asserts nothing').toBeDefined();
    expect((await sightings(plain))?.length).toBeGreaterThan(0);
  } finally {
    await plain.close().catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }

  await withApp(shownAtCreation, async (launched) => {
    await shownAtCreation.waitForReady(await launched.app.firstWindow());
    await settle();
    expect(await sightings(launched.app), 'the record never started, so this asserts nothing').toBeDefined();
    expect(await sightings(launched.app)).toEqual([]);
  });
});

test('the outbound-link stub took effect, and nothing opened', async () => {
  // The positive control docs/PLAN.md schedules here. Until this exists, an
  // empty recorder is indistinguishable from a stub that never took, which is
  // the hazard the plan records against external.ts.
  await withApp(buggy, async (launched) => {
    const page = await launched.app.firstWindow();
    await buggy.waitForReady(page);

    expect(await openedExternally(launched.app)).toEqual([]);

    await page.locator('#view-summary').click();

    // noWaitAfter, and this is a finding rather than a detail of this test.
    // The link schedules a navigation that the main process cancels in
    // will-navigate, so from the renderer's side it never resolves. An
    // ordinary click waits for it and times out after thirty seconds. Phase 4
    // has to hop without waiting for navigation, or every outbound link an
    // exclusion list missed costs a Route the rest of its Trip in one hop.
    await page.locator('#outbound').click({ noWaitAfter: true });

    await expect
      .poll(() => openedExternally(launched.app))
      .toEqual(['https://example.com/buggy']);
  });
});

type Planted = { buggy: { plant(name: string): Promise<unknown> } };

test('a window asked to go full screen in a hidden run stays off the screen', async () => {
  // Measured on Positron: a Route's Zen Mode took the window full screen,
  // which on macOS is a Space of its own that hiding does not reach. Not run
  // with the block removed, since that would put the window over the screen
  // of whoever runs the suite; the plant's answer is the evidence the request
  // was made.
  const cfg: AppUnderTest = { ...buggy, launchArgs: ['--buggy-plant=full-screen'] };
  await withApp(cfg, async (launched) => {
    const page = await launched.app.firstWindow();
    await buggy.waitForReady(page);
    expect(await page.evaluate(() => (window as unknown as Planted).buggy.plant('full-screen'))).toBe('asked');
    await page.waitForTimeout(1_500);
    const windows = await launched.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((window) => ({ fullScreen: window.isFullScreen(), visible: window.isVisible() }))
    );
    expect(windows).toEqual([{ fullScreen: false, visible: false }]);
  });
});

test('a second window brought forward with moveTop in a hidden run stays off the screen', async () => {
  // Measured on Positron: an editor moved into a window of its own was
  // revealed by moveTop alone, which fires no 'show' event, and stayed on the
  // screen. Not run with the replacement removed, for the reason the
  // full-screen test gives.
  const cfg: AppUnderTest = { ...buggy, launchArgs: ['--buggy-plant=second-window'] };
  await withApp(cfg, async (launched) => {
    const page = await launched.app.firstWindow();
    await buggy.waitForReady(page);
    expect(await page.evaluate(() => (window as unknown as Planted).buggy.plant('second-window'))).toBe('opened');
    await page.waitForTimeout(1_000);
    const visible = await launched.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((window) => window.isVisible())
    );
    expect(visible, 'the second window was not created, so this asserts nothing').toHaveLength(2);
    expect(visible).toEqual([false, false]);
  });
});

test('a native dialog is answered as cancelled and recorded, never shown', async () => {
  // Measured on Positron: the native menu's File > Open entries opened the
  // operating system's dialog on the screen of whoever ran the Journey. The
  // application's own side is the evidence the stub answered: a real dialog
  // would wait for a person, and this call would not return.
  const cfg: AppUnderTest = { ...buggy, launchArgs: ['--buggy-plant=native-dialog'] };
  await withApp(cfg, async (launched) => {
    const page = await launched.app.firstWindow();
    await buggy.waitForReady(page);
    expect(await nativeDialogs(launched.app)).toEqual([]);
    const answer = await page.evaluate(() => (window as unknown as Planted).buggy.plant('native-dialog'));
    expect(answer).toEqual({ canceled: true, filePaths: [] });
    expect(await nativeDialogs(launched.app)).toEqual([{ kind: 'showOpenDialog', text: 'Choose a map' }]);

    // A message box is answered with its cancel, by Electron's own rule.
    const answers = await launched.app.evaluate(({ dialog }) => [
      dialog.showMessageBoxSync({ message: 'a', buttons: ['Save', 'Cancel'] }),
      dialog.showMessageBoxSync({ message: 'b', buttons: ['Yes', '&No'] }),
      dialog.showMessageBoxSync({ message: 'c', buttons: ['Keep', 'Discard'] }),
      dialog.showMessageBoxSync({ message: 'd', buttons: ['Keep', 'Discard'], cancelId: 1 }),
    ]);
    expect(answers).toEqual([1, 1, 0, 1]);
  });
});

/**
 * The first call into the main process, against a stand-in that fails the
 * way Positron 2024.11 did, since no application here drops an answer.
 */
const DROPPED = 'electronApplication.evaluate: Resulting promise was garbage collected.';

function mainProcessFailing(failures: string[]) {
  let calls = 0;
  const app = {
    evaluate: async () => {
      const failure = failures[calls++];
      if (failure !== undefined) throw new Error(failure);
    },
  } as unknown as Pick<ElectronApplication, 'evaluate'>;
  return { app, calls: () => calls };
}

test('a dropped answer to the first call is tried again', async () => {
  const main = mainProcessFailing([DROPPED, DROPPED]);
  await reachMainProcess(main.app);
  expect(main.calls()).toBe(3);
});

test('any other failure of the first call is thrown at once', async () => {
  const main = mainProcessFailing(['Target page, context or browser has been closed', DROPPED]);
  await expect(reachMainProcess(main.app)).rejects.toThrow('has been closed');
  expect(main.calls()).toBe(1);
});

test('a main process that keeps dropping answers is given up on, and the error says so', async () => {
  const main = mainProcessFailing(Array(MAIN_PROCESS_ATTEMPTS + 1).fill(DROPPED));
  await expect(reachMainProcess(main.app)).rejects.toThrow(
    `dropped the answer to ${MAIN_PROCESS_ATTEMPTS} calls in a row`
  );
  expect(main.calls()).toBe(MAIN_PROCESS_ATTEMPTS);
});

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { buggy } from '../testbed/buggy/phileas/adapter/index';
import { launchApp, closeApp, makeUserDataDir, resolveBundle, assertBundleFresh } from '../src/index';
import { openedExternally } from '../src/index';
import type { AppUnderTest } from '../src/index';

/**
 * The phase 2 boundary, stated as tests.
 *
 * Each one holds up a claim docs/PLAN.md makes about this boundary: it
 * launches a packaged build (C1), refuses a stale one (R23), reports what is
 * missing rather than timing out (R24), and stays off the screen (C5).
 *
 * Nothing here travels through the application. There is no traversal yet.
 */

async function withApp(cfg: AppUnderTest, body: (launched: Awaited<ReturnType<typeof launchApp>>) => Promise<void>) {
  const dir = await makeUserDataDir(cfg);
  const launched = await launchApp(cfg, dir);
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
  expect(fs.existsSync(bundle.asarPath)).toBe(true);

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

test('a broken readiness hook reports the application own message, not a timeout', async () => {
  await withApp(buggy, async (launched) => {
    const page = await launched.app.firstWindow();
    await buggy.waitForReady(page);

    // Drive the application into the error state its own code reports, then
    // check the adapter throws with that text rather than waiting. R24 exists
    // because a timeout says "did not appear" and nothing about why.
    await page.evaluate(() => {
      const status = document.getElementById('status');
      if (status) status.textContent = 'failed: the trunk could not be opened';
    });

    await expect(buggy.waitForReady(page)).rejects.toThrow(/the trunk could not be opened/);
  });
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
    // exclusion list missed costs a Route its whole budget in one hop.
    await page.locator('#outbound').click({ noWaitAfter: true });

    await expect
      .poll(() => openedExternally(launched.app))
      .toEqual(['https://example.com/buggy']);
  });
});

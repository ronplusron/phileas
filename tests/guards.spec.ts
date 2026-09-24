import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { buggy } from '../testbed/buggy/phileas/adapter/index';
import {
  assertBundleFresh,
  clickMenuItem,
  closeApp,
  launchApp,
  makeUserDataDir,
  openedExternally,
  resolveBundle,
} from '../src/index';
import type { AppUnderTest } from '../src/index';
import { launchOrRemove } from './scratch';

/**
 * The engine's guards, tested for the case where they have nothing to say.
 *
 * Each of these used to answer a question it could not actually answer: the
 * staleness guard reported that it ran after comparing nothing, the outbound
 * recorder reported an empty list when it had never been installed, and
 * `clickMenuItem` reported a click it had not made. All three produced the
 * answer a working run produces, which is the failure this project cares about
 * more than any other.
 *
 * Every test here asserts a refusal. A guard that refuses is one whose silence
 * afterwards means something.
 */

function withStaleness(overrides: Partial<NonNullable<AppUnderTest['staleness']>>): AppUnderTest {
  const staleness = buggy.staleness;
  if (!staleness) throw new Error('buggy has no staleness guard, so these tests assert nothing');
  return { ...buggy, staleness: { ...staleness, ...overrides } };
}

test('the guard refuses an empty list of packaged inputs', () => {
  const bundle = resolveBundle(buggy);

  // Measured against this bundle before the refusal existed: it returned
  // ran: true having compared nothing, which is the same affirmative answer a
  // real pass gives.
  expect(() => assertBundleFresh(withStaleness({ packagedInputs: [] }), bundle.asarPath)).toThrow(
    /compare nothing/
  );
});

test('the guard refuses an ignore rule that excludes everything', () => {
  const bundle = resolveBundle(buggy);

  // The likelier way to reach the same state. ignoreInput is applied in both
  // directions, so one broader than its author meant switches the whole guard
  // off while the verdict still says it ran.
  expect(() =>
    assertBundleFresh(withStaleness({ ignoreInput: () => true }), bundle.asarPath)
  ).toThrow(/compared no files/);
});

test('a passing guard says how many files it compared', () => {
  const bundle = resolveBundle(buggy);
  const verdict = assertBundleFresh(buggy, bundle.asarPath);

  expect(verdict.ran).toBe(true);
  // The count is what separates this from the two refusals above. Without it,
  // ran: true is an assertion the caller cannot check.
  if (verdict.ran) expect(verdict.filesCompared).toBeGreaterThan(5);
});

test('the guard notices a file the bundle still carries and the tree has lost', async () => {
  // The reverse direction, which had no positive control at all. The existing
  // staleness test edits a file in place, which exercises only the forward
  // loop; deleting that loop's counterpart left every test green.
  const bundle = resolveBundle(buggy);
  const sourceRoot = String(buggy.staleness?.sourceRoot);
  const target = path.join(sourceRoot, 'data', 'items.json');
  const original = await fs.promises.readFile(target);
  const parked = path.join(sourceRoot, 'data', 'items.json.parked');

  // Moved rather than deleted, because deleting is not available here and
  // because a move restores exactly.
  await fs.promises.rename(target, parked);
  try {
    expect(() => assertBundleFresh(buggy, bundle.asarPath)).toThrow(/STALE/);
    expect(() => assertBundleFresh(buggy, bundle.asarPath)).toThrow(/items\.json/);
  } finally {
    await fs.promises.rename(parked, target);
    await fs.promises.writeFile(target, original);
  }

  // And it passes again, which is what says the failure came from the missing
  // file rather than from the guard having broken.
  expect(assertBundleFresh(buggy, bundle.asarPath).ran).toBe(true);
});

test('the launch refuses an adapter that supplies its own user data directory', async () => {
  const intruding: AppUnderTest = { ...buggy, launchArgs: ['--user-data-dir=/tmp/somewhere-else'] };
  const dir = await makeUserDataDir(intruding);

  try {
    await expect(launchApp(intruding, dir)).rejects.toThrow(/--user-data-dir/);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('the outbound recorder refuses to answer when it is not installed', async () => {
  const dir = await makeUserDataDir(buggy);
  const launched = await launchOrRemove(buggy, dir);
  try {
    await buggy.waitForReady(await launched.app.firstWindow());

    // Installed, so it answers.
    expect(await openedExternally(launched.app)).toEqual([]);

    // Removed, standing in for a run where the stub never took. The two used to
    // give the same empty list, so a Journey that never installed the stub
    // reported the same "nothing opened" as one where nothing opened.
    await launched.app.evaluate(() => {
      delete (globalThis as Record<string, unknown>).__phileasOpenExternal;
    });

    await expect(openedExternally(launched.app)).rejects.toThrow(/not installed/);
  } finally {
    await closeApp(buggy, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('clicking a menu item refuses an empty path', async () => {
  const dir = await makeUserDataDir(buggy);
  const launched = await launchOrRemove(buggy, dir);
  try {
    const page = await launched.app.firstWindow();
    await buggy.waitForReady(page);

    // It used to walk nothing, click nothing, and return success. Phase 4
    // builds these paths from Candidate.menuPath, which is optional.
    await expect(clickMenuItem(launched.app, [], page)).rejects.toThrow(/at least one label/);

    // The positive control: a real path still works, so the refusal above is
    // the empty case rather than the function being broken.
    await clickMenuItem(launched.app, ['View', 'Show Summary'], page);
  } finally {
    await closeApp(buggy, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

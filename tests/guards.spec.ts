import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { buggy } from '../testbed/buggy/phileas/adapter/index';
import {
  assertBundleFresh,
  ALLOW_STALE_VARIABLE,
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

test('the reverse direction also runs for inputs written as ./folder or with a trailing slash', async () => {
  // './data' once made the root '/./data', which no bundle path starts with,
  // so the reverse direction checked nothing for it and said nothing. The
  // parked copy is ignored so only the reverse direction can see the loss.
  const bundle = resolveBundle(buggy);
  const sourceRoot = String(buggy.staleness?.sourceRoot);
  const target = path.join(sourceRoot, 'data', 'items.json');
  const parked = path.join(sourceRoot, 'data', 'items.json.parked');
  for (const spelling of ['./data', 'data/', '/data']) {
    const cfg = withStaleness({
      packagedInputs: ['main.cjs', 'preload.cjs', 'renderer', spelling, 'package.json'],
      ignoreInput: (relative) => relative.endsWith('.parked'),
    });
    await fs.promises.rename(target, parked);
    try {
      expect(() => assertBundleFresh(cfg, bundle.asarPath), spelling).toThrow(/items\.json: in the bundle but gone/);
    } finally {
      await fs.promises.rename(parked, target);
    }
    expect(assertBundleFresh(cfg, bundle.asarPath).ran, spelling).toBe(true);
  }
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

test('the launch refuses its own user data directory from launch arguments written as a function', async () => {
  // The function form is the one an adapter reaches for when an argument names
  // a folder, so it is the likelier place for this to slip back in.
  const intruding: AppUnderTest = {
    ...buggy,
    launchArgs: (userDataDir) => [`--user-data-dir=${userDataDir}-elsewhere`],
  };
  const dir = await makeUserDataDir(intruding);

  try {
    await expect(launchApp(intruding, dir)).rejects.toThrow(/--user-data-dir/);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

/**
 * A bundle holding an executable and nothing else, in the shape of an
 * installed application that ships its code unpacked rather than in app.asar.
 */
function bundleWithNoArchive(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unpacked-bundle-'));
  const appDir = path.join(root, 'Unpacked.app');
  fs.mkdirSync(path.join(appDir, 'Contents', 'MacOS'), { recursive: true });
  fs.mkdirSync(path.join(appDir, 'Contents', 'Resources', 'app'), { recursive: true });
  fs.writeFileSync(path.join(appDir, 'Contents', 'MacOS', 'Unpacked'), '');
  return appDir;
}

test('a bundle with no app.asar resolves when there is no staleness guard to read one', () => {
  const appDir = bundleWithNoArchive();
  try {
    const unguarded: AppUnderTest = { ...buggy, bundleDir: appDir, staleness: undefined };
    const bundle = resolveBundle(unguarded);

    expect(bundle.executable).toBe(path.join(appDir, 'Contents', 'MacOS', 'Unpacked'));
    expect(bundle.asarPath).toBeUndefined();
    // And the guard says it did not run, rather than that it passed.
    expect(assertBundleFresh(unguarded, bundle.asarPath)).toMatchObject({ ran: false, reason: 'no-sources' });
  } finally {
    fs.rmSync(path.dirname(appDir), { recursive: true, force: true });
  }
});

test('a bundle with no app.asar is still refused where a staleness guard is configured', () => {
  // The positive control for the test above: the refusal is lifted only where
  // nothing would read the archive, not everywhere.
  const appDir = bundleWithNoArchive();
  try {
    expect(() => resolveBundle({ ...buggy, bundleDir: appDir })).toThrow(/has no app\.asar/);
    expect(() => assertBundleFresh(buggy, undefined)).toThrow(/no app\.asar was given/);
  } finally {
    fs.rmSync(path.dirname(appDir), { recursive: true, force: true });
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

    // It used to walk nothing, click nothing, and return success. The type
    // requires a menu path but not a non-empty one.
    await expect(clickMenuItem(launched.app, [], page)).rejects.toThrow(/at least one label/);

    // The positive control: a real path still works, so the refusal above is
    // the empty case rather than the function being broken.
    await clickMenuItem(launched.app, ['View', 'Show Summary'], page);
  } finally {
    await closeApp(buggy, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('the guard notices a file on disk that the bundle does not carry', async () => {
  const bundle = resolveBundle(buggy);
  const extra = path.join(String(buggy.staleness?.sourceRoot), 'renderer', 'added-since.txt');
  await fs.promises.writeFile(extra, 'new since the bundle was built\n');
  try {
    expect(() => assertBundleFresh(buggy, bundle.asarPath)).toThrow(/added-since\.txt: on disk but not in the bundle/);
  } finally {
    await fs.promises.rm(extra, { force: true });
  }
  expect(assertBundleFresh(buggy, bundle.asarPath).ran).toBe(true);
});

test('package.json is stale on a key the bundle kept, and not on one it dropped', async () => {
  const bundle = resolveBundle(buggy);
  const file = path.join(String(buggy.staleness?.sourceRoot), 'package.json');
  const original = await fs.promises.readFile(file, 'utf8');
  const edited = (change: (json: Record<string, unknown>) => void) => {
    const json = JSON.parse(original) as Record<string, unknown>;
    change(json);
    return `${JSON.stringify(json, null, 2)}\n`;
  };
  try {
    // Kept by the packager, so the running application sees it.
    await fs.promises.writeFile(file, edited((json) => (json.version = '9.9.9')));
    expect(() => assertBundleFresh(buggy, bundle.asarPath)).toThrow(/package\.json: version changed/);
    // Dropped by the packager, so it cannot go stale in the running application.
    await fs.promises.writeFile(file, edited((json) => (json.scripts = { package: 'something else' })));
    expect(assertBundleFresh(buggy, bundle.asarPath).ran).toBe(true);
  } finally {
    await fs.promises.writeFile(file, original);
  }
});

test('the skip switch is 1 or 0, and anything else is refused rather than read as on', () => {
  const bundle = resolveBundle(buggy);
  const saved = process.env[ALLOW_STALE_VARIABLE];
  try {
    process.env[ALLOW_STALE_VARIABLE] = '1';
    expect(assertBundleFresh(buggy, bundle.asarPath)).toMatchObject({ ran: false, reason: 'skipped-by-switch' });
    // Read as "don't", which it once skipped the guard for.
    process.env[ALLOW_STALE_VARIABLE] = '0';
    expect(assertBundleFresh(buggy, bundle.asarPath).ran).toBe(true);
    process.env[ALLOW_STALE_VARIABLE] = 'yes';
    expect(() => assertBundleFresh(buggy, bundle.asarPath)).toThrow(/PHILEAS_ALLOW_STALE="yes" is not on or off/);
  } finally {
    if (saved === undefined) delete process.env[ALLOW_STALE_VARIABLE];
    else process.env[ALLOW_STALE_VARIABLE] = saved;
  }
});

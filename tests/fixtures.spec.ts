import { execFileSync, spawn } from 'node:child_process';
import { test as plain } from '@playwright/test';
import {
  caughtSince,
  createTest,
  expect,
  openedPaths,
  rendererVerdict,
  screenshotWithin,
  selfLaunches,
} from '../src/index';
import { buggy } from '../testbed/buggy/phileas/adapter/index';

/**
 * The fixture layer: the launch, the ready page, the stub, and the verdict it
 * reaches on its own at a test's end.
 *
 * That verdict is on uncaught renderer errors that no Route's checks saw, such
 * as one thrown during boot or in a test with no Route at all. An error a
 * Route saw was judged on its Hop and is left alone here; `checks.spec.ts`
 * shows that for a planted one, and `known.spec.ts` for a known finding.
 */
const test = createTest(buggy);

test('the fixture layer launches the application and hands over a ready page', async ({
  page,
  launched,
}) => {
  // Ready rather than merely attached, which is the adapter's contract and the
  // thing the page fixture awaits on the caller's behalf.
  await expect(page.locator('#status')).toHaveAttribute('data-boot', 'ready');
  await expect(page.locator('#items li')).toHaveCount(12);

  // The guard verdict is on the launch, which is where it is now reported from.
  expect(launched.guard.ran).toBe(true);
});

test('the stub is installed before the application can reach a browser', async ({
  externalUrls,
}) => {
  // Reaching this at all means the recorder was installed: it throws when it is
  // not, rather than answering with an empty list.
  expect(await externalUrls()).toEqual([]);
});

test('opening a file or folder is caught by the stub and opens nothing', async ({ app }) => {
  // A fresh launch has caught nothing, and reaching this means the recorder is
  // installed: openedPaths throws when it is not.
  expect(await openedPaths(app)).toEqual([]);
  // The application's own calls, as RStudio's Show Folder in New Window makes
  // them: answered as opened, and noted instead of reaching Finder.
  const answer = await app.evaluate(async ({ shell }) => {
    const opened = await shell.openPath('/phileas-test/a-folder');
    shell.showItemInFolder('/phileas-test/a-file.txt');
    return opened;
  });
  expect(answer).toBe('');
  expect(await openedPaths(app)).toEqual(['openPath /phileas-test/a-folder', 'showItemInFolder /phileas-test/a-file.txt']);
});

test('a launch of the application itself is caught by the stub and starts nothing', async ({ app }) => {
  expect(await selfLaunches(app)).toEqual([]);
  // A marker no other process carries, so the process table can say on its own
  // whether a copy started: the recorder is the stub's evidence, and must not
  // be the only evidence that the stub worked.
  const marker = `--phileas-self-launch-probe-${process.pid}-${Date.now()}`;
  // Launched the way RStudio's Open Project in New Session launches itself.
  const answer = await app.evaluate(async (_electron, flag) => {
    const load = (process as unknown as { getBuiltinModule: (name: string) => unknown }).getBuiltinModule;
    const childProcess = load('child_process') as typeof import('child_process');
    const child = childProcess.spawn(process.execPath, [flag], { detached: true, stdio: 'ignore' });
    child.unref();
    const spawned = await new Promise<boolean>((resolve) => child.once('spawn', () => resolve(true)));
    // Any other program still runs.
    const other = childProcess.spawnSync('/bin/echo', ['still runs'], { encoding: 'utf8' }).stdout.trim();
    return { spawned, pid: child.pid, other };
  }, marker);
  expect(answer).toEqual({ spawned: true, pid: undefined, other: 'still runs' });
  expect(await selfLaunches(app)).toEqual([[marker]]);
  const running = (flag: string) =>
    execFileSync('ps', ['-axwwo', 'command'], { encoding: 'utf8' })
      .split('\n')
      .filter((line) => line.includes(flag) && !line.startsWith('ps '));
  // The control: a process started with a marker of its own is found, so the
  // empty answer below is the table's and not a search that finds nothing.
  const control = `${marker}-control`;
  const probe = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)', '--', control], { stdio: 'ignore' });
  try {
    await expect.poll(() => running(control).length).toBe(1);
  } finally {
    probe.kill();
  }
  expect(running(marker).filter((line) => !line.includes(control))).toEqual([]);
});

test('a stub whose recorder is missing is named, not read as having caught nothing', async ({ app }) => {
  const caught = caughtSince(app, 5_000);
  // Every recorder installed, and nothing caught at launch.
  expect(await caught()).toBeUndefined();
  await app.evaluate(() => {
    delete (globalThis as Record<string, unknown>).__phileasSelfLaunches;
  });
  expect(await caught()).toEqual({ notInstalled: ['selfLaunches'] });
});

const thrower = { ...buggy, launchArgs: ['--buggy-plant=renderer-throw'] };
const throwerTest = createTest(thrower);

/** Throw in the renderer with no Route watching, and wait until the fixture has it. */
async function throwUnwatched(page: import('@playwright/test').Page, launched: { pageErrors: Error[] }) {
  await page.getByRole('button', { name: 'Weigh the trunk' }).click();
  await expect.poll(() => launched.pageErrors.length).toBe(1);
}

// Asked of the verdict directly: a test marked to fail cannot watch the
// fixture fail it, because the fixture reports only a test that otherwise
// passed.
throwerTest('a renderer error no Route saw is one the fixture fails the test on', async ({ page, launched }) => {
  await throwUnwatched(page, launched);
  expect(rendererVerdict(thrower, page, launched.pageErrors).unacceptable).toHaveLength(1);
  // Cleared only because this test has already read the verdict it is about;
  // otherwise the fixture would, rightly, fail it.
  launched.pageErrors.length = 0;
});

const narrowedThrower = {
  ...thrower,
  narrowedChecks: {
    'uncaught-error': {
      kind: 'narrowed' as const,
      reason: 'the trunk is known to be too heavy',
      // Written against the form the checks hand it, "renderer: ...", so one
      // predicate serves the Route's check and the fixture alike.
      accept: (observation: string) => /^renderer: Error: the trunk is too heavy/.test(observation),
    },
  },
};
const narrowedTest = createTest(narrowedThrower);

narrowedTest('a narrowing written against the checks\' form accepts the error in the fixture too', async ({
  page,
  launched,
}) => {
  await throwUnwatched(page, launched);
  const verdict = rendererVerdict(narrowedThrower, page, launched.pageErrors);
  expect(verdict.unjudged).toHaveLength(1);
  expect(verdict.unacceptable).toHaveLength(0);
  // And the test passes at its end, which is the fixture reaching the same verdict.
});

plain('a screenshot that never returns is given up on within the bound, and says why', async () => {
  // As on RStudio behind a native print dialog, where Playwright's own
  // screenshot timeout was not honored and the Journey sat until the dialog
  // was closed by hand.
  const never = { screenshot: () => new Promise<Buffer>(() => undefined) };
  const startedAt = Date.now();
  const shot = await screenshotWithin(never, 200);
  expect(Date.now() - startedAt).toBeLessThan(2_000);
  expect(shot).toBeInstanceOf(Error);
  expect((shot as Error).message).toMatch(/screenshot/);

  // The control: a page that answers gives its picture.
  const answers = { screenshot: async () => Buffer.from('png') };
  expect(await screenshotWithin(answers, 200)).toEqual(Buffer.from('png'));
});

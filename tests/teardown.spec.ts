import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { buggy } from '../testbed/buggy/phileas/adapter/index';
import {
  ApplicationStoppedAnswering,
  CheckFailure,
  RUN_VARIABLE,
  createExclusionTally,
  closeApp,
  createTest,
  deriveRouteStreams,
  makeUserDataDir,
  runRoute,
  survey,
  type AppUnderTest,
  type Chooser,
} from '../src/index';
import { launchOrRemove, removeScratch, scratch } from './scratch';

/**
 * Closing an application that will never answer again.
 *
 * `buggy`'s ordinary planted hangs end after six seconds, so the process
 * answers again before teardown and every test passed while the teardown was
 * unbounded. `endless-hang` never ends, which is the case measured on Positron
 * on 2026-09-26: the Route found the hang, then the Journey sat at teardown,
 * and the process ignored an ordinary stop signal.
 */

process.env[RUN_VARIABLE] = 'test-run';

const endless: AppUnderTest = { ...buggy, launchArgs: ['--buggy-plant=endless-hang'] };
const CONTROL = 'Wait for the last ferry';

function isRunning(pid: number | undefined): boolean {
  if (pid === undefined) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test('an application that never answers again is killed, and the close says so', async () => {
  const dir = await makeUserDataDir(endless);
  const launched = await launchOrRemove(endless, dir);
  const pid = launched.app.process().pid;
  try {
    const page = await launched.app.firstWindow();
    await endless.waitForReady(page);

    // Not awaited: the click itself waits on the main process, which never
    // answers again.
    page.getByRole('button', { name: CONTROL }).click().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    const started = Date.now();
    const verdict = await closeApp(endless, launched, 2_000);

    expect(verdict.forced).toBe(true);
    expect(verdict.forced && verdict.detail).toMatch(/killed with SIGKILL\.$/);
    expect(Date.now() - started).toBeLessThan(2_000 + 5_000);
    expect(isRunning(pid)).toBe(false);
  } finally {
    if (isRunning(pid)) process.kill(pid as number, 'SIGKILL');
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('an application that closes in time is not killed', async () => {
  // The positive control for the test above: the kill is for a close that
  // does not finish, not for every close.
  const dir = await makeUserDataDir(buggy);
  const launched = await launchOrRemove(buggy, dir);
  try {
    await buggy.waitForReady(await launched.app.firstWindow());
    expect(await closeApp(buggy, launched)).toEqual({ forced: false });
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

const always: Chooser = {
  choose: (candidates) => {
    const target = candidates.find((candidate) => candidate.name === CONTROL);
    if (!target) throw new Error(`${CONTROL} is not on offer: the planted control did not appear`);
    return { target };
  },
};

const routeTest = createTest(endless);
routeTest.afterEach(removeScratch);

routeTest('a Route that finds an endless hang reports it, and the test still finishes', async ({ page, app }) => {
  // The whole of the defect this closes: the finding is made, and then the
  // test has to end rather than wait at teardown. Playwright's own timeout is
  // the bound, and it covers fixture teardown too.
  routeTest.setTimeout(60_000);

  const error = await runRoute({
    page,
    app,
    cfg: endless,
    streams: deriveRouteStreams('endless-hang', 1),
    journeySeed: 'endless-hang',
    routeNumber: 1,
    tripLength: 3,
    journalsRoot: scratch('phileas-teardown-test-'),
    chooser: always,
    hopTimeoutMs: 1_000,
    settleTimeoutMs: 1_000,
    responsiveTimeoutMs: 1_000,
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );

  expect(error).toBeInstanceOf(CheckFailure);
  expect((error as CheckFailure).failed.map((check) => check.check)).toContain('still-responding');
});

// The survey's own reads are bounded too. A main process that never answers
// again held the menu read forever, and a Route carried past a known hang, or
// a Fix, walked straight into it with nothing to end the Journey.
routeTest('a survey gives up on a main process that never answers, and says so', async ({ page, app }) => {
  routeTest.setTimeout(60_000);
  // Not awaited: the click itself waits on the main process.
  page.getByRole('button', { name: CONTROL }).click().catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  const started = Date.now();
  const error = await survey({
    page,
    app,
    exclusions: endless.exclusions,
    hopIndex: 0,
    tally: createExclusionTally(endless.exclusions),
    timeoutMs: 1_000,
  }).then(
    () => undefined,
    (thrown: unknown) => thrown
  );

  expect(error).toBeInstanceOf(ApplicationStoppedAnswering);
  // Whichever read reaches the main process first: the page's own reads wait
  // on it too, since it serves the debugging connection.
  expect((error as Error).message).toMatch(/did not answer within 1000 ms: the application stopped answering/);
  expect(Date.now() - started).toBeLessThan(10_000);
});

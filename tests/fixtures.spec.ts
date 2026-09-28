import { test as plain } from '@playwright/test';
import { createTest, expect, rendererVerdict, screenshotWithin } from '../src/index';
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

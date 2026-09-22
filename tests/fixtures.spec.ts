import { createTest, expect } from '../src/index';
import { buggy } from '../testbed/buggy/phileas/adapter/index';

/**
 * The fixture layer, exercised at all.
 *
 * `createTest` had no callers anywhere: this engine's own suite hand-rolls its
 * own launch helper, and the testbed's journey spec imports Playwright's `test`
 * directly. So the whole of it -- the trace, the failure attachments, the
 * staleness-guard note, the uncaught-renderer-error gate -- ran nowhere, which
 * is how three defects in it survived until a review read it.
 *
 * This covers the path a Route will take. What it does not cover is the R19
 * narrowing branch, which needs an application that throws on purpose and an
 * adapter that declares the narrowing. `docs/OUTSTANDING.md` carries that as
 * work for phase 5, where `fixtures.ts` is reshaped anyway.
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

import { test, expect, type Page } from '@playwright/test';
import { settle } from '../src/index';

/**
 * The settle wait against a page that keeps changing past its budget.
 *
 * Measured on Positron on 2026-09-26: while extensions were still activating,
 * the wait ran out its budget, gave its last read a few milliseconds, and
 * reported the page as having stopped answering, though both processes
 * answered throughout. A real page reproduces it only when a read happens to be
 * slower than what is left, which `buggy`'s small page never is, so a stand-in
 * page is used: every read takes 150 ms, every read differs, and a read given
 * less than that times out, as Playwright's does. That hits the short last read
 * on every run.
 */

const READ_MS = 150;

/** A page whose accessibility tree changes on every read, and never hangs. */
function busyPage(): Page {
  let reads = 0;
  const read = async ({ timeout }: { timeout: number }) => {
    reads += 1;
    const tree = { reads };
    if (timeout < READ_MS) {
      await new Promise((resolve) => setTimeout(resolve, timeout));
      throw new Error(`Timeout ${timeout}ms exceeded.`);
    }
    await new Promise((resolve) => setTimeout(resolve, READ_MS));
    return tree;
  };
  return {
    locator: () => ({ ariaSnapshotJSON: read }),
    evaluate: async () => undefined,
  } as unknown as Page;
}

/** A page that never answers a read at all. */
function silentPage(): Page {
  return {
    locator: () => ({
      ariaSnapshotJSON: async ({ timeout }: { timeout: number }) => {
        await new Promise((resolve) => setTimeout(resolve, timeout));
        throw new Error(`Timeout ${timeout}ms exceeded.`);
      },
    }),
    evaluate: async () => undefined,
  } as unknown as Page;
}

test('a page still changing when the budget runs out is unsettled, with its last reading', async () => {
  const result = await settle(busyPage(), 1_000, 400);

  expect(result.settled).toBe(false);
  // The reading is kept, so what the Hop did is recorded rather than called
  // unreadable.
  expect(result.tree).toBeDefined();
  // Past the budget by no more than the floor a last read is given.
  expect(result.ms).toBeLessThan(1_000 + 500);
});

test('a page that gives no answer is still reported as not answering', async () => {
  // The other half: the fix must not turn a page that stopped answering into
  // one that merely kept moving.
  const result = await settle(silentPage(), 1_000, 400);

  expect(result.settled).toBe(false);
  expect(result.tree).toBeUndefined();
});

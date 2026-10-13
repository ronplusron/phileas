import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import { RUN_VARIABLE, createTest, deriveRouteStreams, readJournal, runRoute, type JournalEntry } from '../src/index';

/**
 * A Route whose deadline passes records nothing it sees after that, because
 * what it sees is the application being closed under it. On `buggy` on
 * 2026-10-13 a 3-second Route deadline became a `still-responding` finding,
 * "the window closed", which the Journey's end then filed as known.
 *
 * Two tests in order: the first is cut off by its deadline, which is what it
 * expects; the second reads the journal the first left, once the Route has
 * noticed. Playwright does not stop a timed-out test's body, so the Route
 * carries on in the background until it does.
 */

const test = createTest(buggy);
test.describe.configure({ mode: 'serial' });

const TEST_RUN = 'test-run';
process.env[RUN_VARIABLE] = TEST_RUN;
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-cut-off-'));
test.afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

test('a Route cut off by its deadline', async ({ page, app }) => {
  // Cut off on purpose: a timeout is its own status, which test.fail does not cover.
  test.info().expectedStatus = 'timedOut';
  // Long enough to launch under a full suite's load and travel, short of the Trip.
  test.setTimeout(15_000);
  await runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams('cut-off', 1),
    journeySeed: 'cut-off',
    routeNumber: 1,
    tripLength: 1_000,
    journalsRoot: root,
  });
});

test('records that it was cut off, and no outcome or finding from after it', async () => {
  const file = () => {
    const run = path.join(root, 'cut-off', TEST_RUN);
    const name = fs.existsSync(run) ? fs.readdirSync(run).find((entry) => entry.endsWith('.jsonl')) : undefined;
    return name && path.join(run, name);
  };
  const entries = (): JournalEntry[] => {
    const found = file();
    return found ? readJournal(found) : [];
  };
  const noted = () => entries().some((entry) => entry.kind === 'note' && /^Cut off by its deadline/.test(entry.note));

  await expect.poll(noted, { timeout: 30_000 }).toBe(true);

  const all = entries();
  // The control: the Route did travel before its deadline.
  expect(all.some((entry) => entry.kind === 'trip-hop')).toBe(true);
  expect(all.some((entry) => entry.kind === 'outcome')).toBe(false);
  const failed = all.flatMap((entry) =>
    entry.kind === 'trip-hop' || entry.kind === 'fix-step' ? entry.checks.filter((check) => check.result === 'failed') : []
  );
  expect(failed).toEqual([]);
});

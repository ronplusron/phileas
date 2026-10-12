import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import { closeApp, makeUserDataDir, responsesOf, trackRanWith, type AppUnderTest, type JournalEntry } from '../src/index';
import { ranWithText } from '../src/report/render.mjs';
import { launchOrRemove } from './scratch';

/**
 * What the running application was seen to run with, asked of the adapter at
 * each step and journaled where it was first seen (C1). Measured against
 * RStudio and Positron by each trial's `probes/ran-with.spec.ts`; these
 * check the engine's part with no application.
 */

const context = { app: {} as ElectronApplication, page: {} as Page, userDataDir: undefined };

function tracked(ranWith: AppUnderTest['ranWith'], timeoutMs?: number) {
  const written: JournalEntry[] = [];
  const tracker = trackRanWith({ ranWith }, context, { write: (entry) => written.push(entry) }, timeoutMs);
  return { tracker, written };
}

test('each new value is noted once, where it was first seen, and every value is rolled up', async () => {
  const answers: Record<string, string>[] = [{}, { R: '4.6.0' }, { R: '4.6.0' }, { R: '4.4.3', Python: '3.12.4' }];
  let call = 0;
  const { tracker, written } = tracked(() => answers[call++] ?? {});
  for (const hop of [1, 1, 2, 3]) await tracker.read(hop);

  expect(written.map((entry) => entry.kind === 'note' && [entry.hop, entry.note, entry.ranWith])).toEqual([
    [1, 'Ran with R 4.6.0', { R: '4.6.0' }],
    [3, 'Ran with R 4.4.3, Python 3.12.4', { R: '4.4.3', Python: '3.12.4' }],
  ]);
  expect(tracker.closing()).toEqual({ ranWith: { R: ['4.6.0', '4.4.3'], Python: ['3.12.4'] } });
});

test('nothing seen is none, an adapter with no hook says nothing, and a failed read is never none', async () => {
  const quiet = tracked(() => ({}));
  await quiet.tracker.read(1);
  expect(quiet.tracker.closing()).toEqual({ ranWith: 'none' });
  expect(quiet.written).toEqual([]);

  const absent = tracked(undefined);
  await absent.tracker.read(1);
  expect(absent.tracker.closing()).toEqual({});

  // A read that failed may have missed what started, so nothing seen is not nothing started.
  const failing = tracked(() => {
    throw new Error('client_init answered without its version\nand more');
  });
  await failing.tracker.read(1);
  expect(failing.tracker.closing()).toEqual({ ranWithUnread: "the adapter's ranWith failed: client_init answered without its version" });

  const slow = tracked(() => new Promise(() => undefined), 50);
  await slow.tracker.read(1);
  expect(slow.tracker.closing()).toEqual({ ranWithUnread: "the adapter's ranWith failed: gave no answer within 0.05 s" });

  // What was seen before a failure stays, with the failure beside it.
  let fail = false;
  const mixed = tracked(() => {
    if (fail) throw new Error('log unreadable');
    return { R: '4.6.0' };
  });
  await mixed.tracker.read(1);
  fail = true;
  await mixed.tracker.read(2);
  expect(mixed.tracker.closing()).toEqual({ ranWith: { R: ['4.6.0'] }, ranWithUnread: "the adapter's ranWith failed: log unreadable" });

  const notText = tracked(() => ({ R: 4.6 as unknown as string }));
  await notText.tracker.read(1);
  expect(notText.tracker.closing()).toEqual({ ranWithUnread: "the adapter's ranWith gave a value that is not text for R" });
});

test('the outcome line says what ran, nothing started, or why it could not be read', () => {
  const outcome = { kind: 'outcome' as const, outcome: 'passed' as const, hops: 2, endedAt: '' };
  expect(ranWithText({ ...outcome, ranWith: { R: ['4.6.0', '4.4.3'], Python: ['3.12.4'] } })).toBe('ran with R 4.6.0 then 4.4.3, Python 3.12.4');
  expect(ranWithText({ ...outcome, ranWith: 'none' })).toBe('ran with nothing started');
  expect(ranWithText({ ...outcome, ranWithUnread: 'it threw' })).toBe('ran with not all read: it threw');
  expect(ranWithText(outcome)).toBe('');
});

test('responses whose address matches are kept, and others are not', async () => {
  const server = http.createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.end(JSON.stringify({ result: { asked: request.url } }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const cfg: AppUnderTest = { ...buggy, captureResponses: [/\/rpc\/hello$/, /never-asked-for/] };
  const dir = await makeUserDataDir(cfg);
  const launched = await launchOrRemove(cfg, dir);
  try {
    const page = await launched.app.firstWindow();
    await buggy.waitForReady(page);
    // Buggy's own page loaded before the launch returned, and a page's body
    // cannot be read after it loads anyway, so a call the page makes, as
    // RStudio's client_init is, is what is kept. Measured on 2026-10-12.
    for (const call of ['/rpc/hello', '/rpc/other', '/rpc/hello']) {
      await page.evaluate((url) => fetch(url).then((answer) => answer.text()), `http://127.0.0.1:${port}${call}`);
    }
    await expect.poll(() => responsesOf(launched.app, /\/rpc\/hello$/).length).toBe(2);
    expect(responsesOf(launched.app, /\/rpc\/hello$/)).toEqual(Array(2).fill(JSON.stringify({ result: { asked: '/rpc/hello' } })));
    expect(responsesOf(launched.app, /never-asked-for/)).toEqual([]);
    // A pattern the adapter never declared has nothing, rather than everything.
    expect(responsesOf(launched.app, /./)).toEqual([]);
  } finally {
    await closeApp(cfg, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
    server.close();
  }
});

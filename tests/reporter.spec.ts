import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { routeLines, summaryLines } from '../src/report/reporter.mjs';
import { firstSentence, renderEntry } from '../src/report/render.mjs';
import { ownReporter, runReporter } from '../bin/phileas.mjs';
import type { JournalEntry } from '../src/index';
import { removeScratch, scratch } from './scratch';

/**
 * The engine's reporter, which `phileas run` prints through: each Route's
 * ending read from its journal, and a summary last. Asked for on 2026-10-02,
 * when a Route that failed on a finding ended its run looking like an error
 * in the engine.
 */

test.afterEach(removeScratch);

const CHECK_FAILURE =
  '3 checks failed after hop 56, which is when the checks read it. The cause may be an earlier step: when it arrived, and the steps before it, are below.\n\n  console-error: Error running command\n  finding 643cb31a';

const opening = { kind: 'route', journeySeed: 'seed', routeSeed: 'abc', routeNumber: 2, tripLength: 100, settleQuietMs: 400, startedAt: '2026-10-02T17:33:27.776Z' };

function hop(n: number, checks: unknown[] = []) {
  return {
    kind: 'trip-hop',
    hop: n,
    target: { source: 'page', role: 'button', name: 'Configure', nth: 1 },
    action: 'click',
    pool: 'p',
    startedAt: '2026-10-02T17:34:01.840Z',
    durationMs: 400,
    settled: true,
    settleMs: 400,
    effect: { readable: true, changed: false, appeared: [], appearedMore: 0, wentAway: [], wentAwayMore: 0 },
    checks,
  };
}

const failedCheck = (check: string, id: string, observation: string) => ({
  check,
  result: 'failed',
  observation,
  findings: [{ id, signature: `${check}: ${observation}`, known: false }],
});

/** A journal holding these entries, and the annotation naming it. */
function journalOf(entries: unknown[]) {
  const file = path.join(scratch('phileas-reporter-test-'), 'route-002-abc.jsonl');
  fs.writeFileSync(file, entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n');
  return { file, annotations: [{ type: 'phileas-journal', description: file }] };
}

const STACK = 'CheckFailure: 3 checks failed after hop 56\n    at runRoute (dist/route.js:638:23)';

test('a Route that failed on checks names each finding once, by id, and prints no stack', () => {
  const { file, annotations } = journalOf([
    opening,
    hop(55),
    hop(56, [
      failedCheck('console-error', '643cb31a', 'Error running command openremotessh.explorer.configure'),
      failedCheck('no-error-notification', 'fb1bc714', 'error notification: Error running command'),
      { check: 'still-responding', result: 'passed' },
    ]),
    { kind: 'outcome', outcome: 'failed', hops: 56, reason: CHECK_FAILURE, endedAt: '2026-10-02T17:34:03Z' },
  ]);
  const ended = routeLines(
    {
      title: 'route 2',
      status: 'failed',
      annotations,
      errors: [{ message: CHECK_FAILURE, stack: STACK }],
      attachments: [
        { name: 'trace', path: '/results/route-2/trace.zip' },
        { name: 'dom.html', path: '/results/route-2/dom.html' },
      ],
    },
    { follow: false, cwd: '/' }
  );
  const text = ended.lines.join('\n');

  expect(ended.lines[0]).toBe('route 2  failed after 56 hops: 3 checks failed after hop 56, which is when the checks read it.');
  expect(text).toContain('failed checks after hop 56, click button "Configure":');
  expect(text).toMatch(/console-error\s+643cb31a\s+Error running command openremotessh/);
  expect(text).toMatch(/no-error-notification\s+fb1bc714\s+error notification/);
  expect(text).not.toContain('still-responding');
  expect(text).not.toContain('at runRoute');
  expect(text).toContain(`phileas show ${path.relative('/', file)}`);
  expect(text).toContain('trace    results/route-2/trace.zip');
  expect(text).toContain('also     dom.html, in results/route-2');
  expect(ended).toMatchObject({ outcome: 'failed', routeNumber: 2, hops: 56, tripLength: 100 });
});

test('a Route that failed on anything but a check prints the error whole, stack and all', () => {
  const { annotations } = journalOf([
    opening,
    hop(3),
    { kind: 'outcome', outcome: 'failed', hops: 3, reason: 'The page could not be surveyed after hop 3.', endedAt: 'x' },
  ]);
  const ended = routeLines(
    {
      title: 'route 2',
      status: 'failed',
      annotations,
      errors: [{ message: 'The page could not be surveyed after hop 3.', stack: 'PageUnreachable: The page could not be surveyed after hop 3.\n    at survey (dist/route.js:803:11)' }],
      attachments: [],
    },
    { follow: false, cwd: '/' }
  );
  expect(ended.lines.join('\n')).toContain('    at survey (dist/route.js:803:11)');
});

test('a stranded Route is shown as stranded with its reason, and a passed one is one line', () => {
  const stranded = journalOf([opening, hop(7), { kind: 'outcome', outcome: 'stranded', hops: 7, reason: 'No candidate was available.', endedAt: 'x' }]);
  const out = routeLines(
    { title: 'route 2', status: 'failed', annotations: stranded.annotations, errors: [{ message: 'stranded: No candidate', stack: 'Error: stranded\n    at spec.ts:56' }], attachments: [] },
    { follow: false, cwd: '/' }
  );
  expect(out.outcome).toBe('stranded');
  expect(out.lines[0]).toBe('route 2  stranded after 7 hops: No candidate was available.');
  expect(out.lines.join('\n')).not.toContain('at spec.ts');

  const passed = journalOf([opening, hop(1), { kind: 'outcome', outcome: 'passed', hops: 100, endedAt: 'x' }]);
  const ok = routeLines({ title: 'route 2', status: 'passed', annotations: passed.annotations, errors: [], attachments: [] }, { follow: false, cwd: '/' });
  expect(ok.lines).toEqual(['route 2  passed after 100 hops']);
});

test("following, the Route's own line is left to the journal, which printed it", () => {
  const { annotations } = journalOf([opening, { kind: 'outcome', outcome: 'passed', hops: 100, endedAt: 'x' }]);
  expect(routeLines({ title: 'route 2', status: 'passed', annotations, errors: [], attachments: [] }, { follow: true, cwd: '/' }).lines).toEqual([]);
});

test('a Route with no outcome line says how it ended, and one with no journal says it never opened', () => {
  const { annotations } = journalOf([opening, hop(1), hop(2)]);
  const cut = routeLines({ title: 'route 2', status: 'timedOut', annotations, errors: [{ message: 'Test timeout of 30000ms exceeded.' }], attachments: [] }, { follow: true, cwd: '/' });
  expect(cut.lines[0]).toBe('route 2  cut off by its deadline after 2 hops');
  expect(cut.outcome).toBe('unfinished');

  const never = routeLines(
    { title: 'route 3', status: 'failed', annotations: [], errors: [{ message: 'The packaged build is stale', stack: 'Error: The packaged build is stale\n    at bundle.js:1' }], attachments: [] },
    { follow: false, cwd: '/' }
  );
  expect(never.lines[0]).toBe('route 3  failed before its journal was opened');
  expect(never.lines.join('\n')).toContain('at bundle.js:1');
});

test('a test that passed with no journal is said to have passed, named by its title', () => {
  // Measured on 2026-10-02: a probe run through a Journey's config passed,
  // and was reported as "route ?  failed before its journal was opened".
  const probe = routeLines({ title: 'probe: template radios', status: 'passed', annotations: [], errors: [], attachments: [] }, { follow: false, cwd: '/' });
  expect(probe.lines).toEqual(['"probe: template radios"  passed, with no journal']);
  expect(probe.outcome).toBe('passed');
});

test('the summary counts the Routes by outcome and Hops, prints the known findings, and how to run it again', () => {
  const lines = summaryLines({
    routes: [
      { outcome: 'passed', routeNumber: 1, hops: 100, tripLength: 100, journal: '/j/seed/run/route-001-a.jsonl' },
      { outcome: 'failed', routeNumber: 2, hops: 56, tripLength: 100 },
      { outcome: 'stranded', routeNumber: 3, hops: 7, tripLength: 100 },
    ],
    journeyEnd: {
      findings: { added: [{ id: '643cb31a', signature: 'console-error: x', sightings: 1 }], known: [], notSeen: [] },
      file: 'phileas/known-findings.json',
    },
    endErrors: [{ message: 'The home folder guard found a write' }],
    config: 'trial/positron/phileas',
    env: { PHILEAS_SEED: '64156c12293c', PHILEAS_RUN: 'r1', PHILEAS_TRIP_LENGTH: '100', PHILEAS_FIX: 'none', PHILEAS_ALLOW_EXCLUDED: 'new-windows' },
    cwd: '/',
  });
  const text = lines.join('\n');
  expect(text).toContain('Journey 64156c12293c, run r1: 3 Routes, 1 passed, 1 failed, 1 stranded; 163 of 300 Hops');
  expect(text).toContain('Journals: j/seed/run');
  expect(text).toMatch(/UNFILED, seen 1 time\(s\): 643cb31a/);
  expect(text).toContain("The Journey's end failed:\n  The home folder guard found a write");
  expect(text).toContain('Run it again: phileas run trial/positron/phileas --seed 64156c12293c --trip-length 100 --fix none --allow new-windows');
  expect(text).toContain(
    'Route 2 alone: phileas run trial/positron/phileas --seed 64156c12293c --routes 2 --trip-length 100 --fix none --allow new-windows -- --grep "route 2$"'
  );
  // The summary is last: nothing of Playwright's own report follows it.
  expect(lines.at(-1)).toMatch(/^Route 2 alone: /);
});

test('the Route named alone is the lowest-numbered that did not pass, whatever order they finished in', () => {
  // Measured on 2026-10-03: Routes run two at a time finished 1, 2's partner
  // 3, then 2, and the hint named Route 3.
  const lines = summaryLines({
    routes: [
      { outcome: 'passed', routeNumber: 1, hops: 10, tripLength: 10 },
      { outcome: 'failed', routeNumber: 3, hops: 4, tripLength: 10 },
      { outcome: 'failed', routeNumber: 2, hops: 7, tripLength: 10 },
    ],
    endErrors: [],
    config: 'phileas',
    env: { PHILEAS_SEED: 's' },
  });
  expect(lines.at(-1)).toBe('Route 2 alone: phileas run phileas --seed s --routes 2 -- --grep "route 2$"');
});

test('the first Route alone needs no grep, since --routes 1 runs only it', () => {
  const lines = summaryLines({
    routes: [{ outcome: 'failed', routeNumber: 1, hops: 5, tripLength: 10 }, { outcome: 'passed', routeNumber: 2, hops: 10, tripLength: 10 }],
    endErrors: [],
    config: 'phileas',
    env: { PHILEAS_SEED: 's' },
  });
  expect(lines.at(-1)).toBe('Route 1 alone: phileas run phileas --seed s --routes 1');
});

test('brief, a failed Hop names its checks and findings without what they saw, and the ending keeps its first sentence', () => {
  const entry = hop(56, [failedCheck('console-error', '643cb31a', 'a very long observation')]) as unknown as JournalEntry;
  expect(renderEntry(entry, 1)).toContain('console-error: a very long observation');
  const brief = renderEntry(entry, 1, { brief: true }) ?? '';
  expect(brief).toMatch(/CHECK FAILED: console-error \(finding 643cb31a/);
  expect(brief).not.toContain('a very long observation');

  const ending = { kind: 'outcome', outcome: 'failed', hops: 56, reason: CHECK_FAILURE, endedAt: 'x' } as unknown as JournalEntry;
  expect(renderEntry(ending, 1, { brief: true })).toBe('route 1  failed after 56 hops: 3 checks failed after hop 56, which is when the checks read it.');
  expect(renderEntry(ending, 1)).toContain('finding 643cb31a');
  expect(firstSentence('A check failed after hop 5:\n\n  x')).toBe('A check failed after hop 5');
});

test("phileas run uses the engine's reporter unless Playwright's arguments name one", () => {
  expect(runReporter([])[0]).toMatch(/^--reporter=.*src[\\/]report[\\/]reporter\.mjs$/);
  expect(runReporter(['--grep', 'route 1$']).slice(1)).toEqual(['--grep', 'route 1$']);
  for (const own of [['--reporter=line'], ['--reporter', 'dot']]) {
    expect(ownReporter(own)).toBe(true);
    expect(runReporter(own)).toEqual(own);
  }
});

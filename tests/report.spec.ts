import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  followFromEnvironment,
  renderJournal,
  renderEntry,
  shortened,
  FOLLOW_VARIABLE,
  runTempFolder,
  type JournalEntry,
  type TripHopEntry,
} from '../src/index';
import { journalsFor } from '../bin/phileas.mjs';
import { journalSteps } from '../src/report/render.mjs';

/**
 * The journal read by a person (R30): the renderer, `phileas show`, and
 * `phileas run --follow`.
 *
 * The entries below are written by hand in the journal's shape rather than
 * produced by a Route, so each case the renderer has to handle is present on
 * purpose instead of by luck of the draw. One test runs a real Route, so the
 * shape written here cannot drift from the one the engine writes unnoticed.
 */

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = path.join(repo, 'bin', 'phileas.mjs');

const effect = (appeared: string[], wentAway: string[]) => ({
  readable: true as const,
  changed: appeared.length + wentAway.length > 0,
  appeared,
  appearedMore: 0,
  wentAway,
  wentAwayMore: 0,
});

const ENTRIES: JournalEntry[] = [
  {
    kind: 'route',
    journeySeed: 'j',
    routeSeed: 'r0',
    routeNumber: 3,
    tripLength: 3,
    settleQuietMs: 400,
    startedAt: '2026-09-24T00:00:00.000Z',
  },
  { kind: 'pool', id: 'p1', candidates: [] },
  {
    kind: 'trip-hop',
    hop: 1,
    target: { source: 'page', role: 'button', name: 'Summary' },
    action: 'click',
    pool: 'p1',
    startedAt: '',
    durationMs: 1,
    settled: true,
    settleMs: 400,
    effect: effect(['Total weight'], ['Inventory']),
    checks: [],
  },
  {
    kind: 'trip-hop',
    hop: 2,
    target: { source: 'page', role: 'searchbox', name: 'Search items' },
    action: 'type',
    value: 'a value longer than twelve',
    pool: 'p1',
    startedAt: '',
    durationMs: 1,
    settled: true,
    settleMs: 400,
    effect: effect([], []),
    checks: [],
  },
  {
    kind: 'trip-hop',
    hop: 3,
    target: { source: 'menu', role: 'menuitem', name: 'Show Summary', menuPath: ['View', 'Show Summary'] },
    action: 'menu-click',
    pool: 'p1',
    startedAt: '',
    durationMs: 1,
    settled: false,
    settleMs: 400,
    effect: { readable: false, reason: 'the page stopped answering' },
    checks: [],
  },
  { kind: 'outcome', outcome: 'passed', hops: 3, endedAt: '' },
];

const text = (entries: readonly JournalEntry[]) => entries.map((e) => JSON.stringify(e)).join('\n') + '\n';

test('a journal reads as one line per Hop, with what each did', () => {
  expect(renderJournal(text(ENTRIES))).toEqual([
    'route 3  seed r0, from Journey seed j, Trip of 3 hops, build not recorded',
    `${'route 3  hop 1'.padEnd(18)}${'click'.padEnd(11)}${'button "Summary"'.padEnd(44)}+ Total weight   - Inventory`,
    `${'route 3  hop 2'.padEnd(18)}${'type'.padEnd(11)}${'searchbox "Search items"'.padEnd(44)}"a value ..." (26 characters)   no change`,
    `${'route 3  hop 3'.padEnd(18)}${'menu-click'.padEnd(11)}${'menu View > Show Summary'.padEnd(44)}could not read the screen: the page stopped answering`,
    'route 3  passed after 3 hops',
  ]);
});

test('a journal cut off mid-write reads up to the cut, and says the Route did not finish', () => {
  const whole = text(ENTRIES.slice(0, 4));
  const cut = whole + JSON.stringify(ENTRIES[4]).slice(0, 30);
  const lines = renderJournal(cut);
  expect(lines.slice(0, 3)).toEqual(renderJournal(whole).slice(0, 3));
  expect(lines.at(-2)).toMatch(/ends partway through a line/);
  expect(lines.at(-1)).toMatch(/no outcome recorded: the Route did not finish/);
});

test('a broken line in the middle is reported where it sits, and reading goes on', () => {
  const lines = text(ENTRIES).split('\n');
  lines.splice(3, 0, '{"kind": "trip-hop", broken');
  const rendered = renderJournal(lines.join('\n'));
  expect(rendered).toContain('route 3  line 4 of the journal cannot be read');
  expect(rendered.at(-1)).toBe('route 3  passed after 3 hops');
});

test('Routes read from 1, and a journal with no opening line names no Route', () => {
  // The record's routeNumber is what a person reads.
  expect(renderJournal(text(ENTRIES))[0]).toMatch(/^route 3  seed /);
  // Without the opening line there is no index at all, and inventing one would
  // point at a Route that may not be this one.
  const headless = renderJournal(text(ENTRIES.slice(1)));
  expect(headless.at(-1)).toBe('route ?  passed after 3 hops');
});

test('a long name is cut to its column, a menu path in the middle, and never runs into the effect', () => {
  const long = 'x'.repeat(300);
  const menu = 'menu Edit > Substitutions > Text Replacement';
  expect(shortened(`button "${long}"`, 43)).toBe(`button "${'x'.repeat(32)}...`);
  expect(menu).toHaveLength(44);
  expect(shortened(menu, 44)).toBe(menu);
  expect(shortened(menu, 43)).toBe('menu Edit > ... > Text Replacement');
  expect(shortened('menu Window > Bring All to Front', 43)).toBe('menu Window > Bring All to Front');

  const sample = ENTRIES.find((entry) => entry.kind === 'trip-hop');
  if (sample?.kind !== 'trip-hop') throw new Error('the sample journal has no Trip hop');
  const line = renderEntry(
    {
      ...sample,
      action: 'click',
      target: { source: 'page', role: 'button', name: long, nth: 1 },
      effect: { readable: true, changed: false, appeared: [], appearedMore: 0, wentAway: [], wentAwayMore: 0 },
    },
    1
  );
  // The effect starts in its column, after the cut name and a space.
  expect(line).toBe(`${'route 1  hop 1'.padEnd(18)}${'click'.padEnd(11)}${`button "${'x'.repeat(32)}...`} no change`);
});

test("a Fix step's line names its kind, and one from before kinds were recorded leaves it blank", () => {
  const step = {
    kind: 'fix-step' as const,
    step: 1,
    label: 'button "Summary"',
    startedAt: '',
    durationMs: 1,
    effect: effect(['Total weight'], []),
    checks: [],
  };
  expect(renderEntry({ ...step, stepKind: 'act' }, 1)).toBe(
    `${'route 1  fix 1'.padEnd(18)}${'act'.padEnd(11)}${'button "Summary"'.padEnd(44)}+ Total weight`
  );
  expect(renderEntry({ ...step, label: 'some code', stepKind: 'code' }, 1)).toBe(
    `${'route 1  fix 1'.padEnd(18)}${'code'.padEnd(11)}${'some code'.padEnd(44)}+ Total weight`
  );
  expect(renderEntry(step, 1)).toBe(
    `${'route 1  fix 1'.padEnd(18)}${''.padEnd(11)}${'button "Summary"'.padEnd(44)}+ Total weight`
  );
});

test('show finds the latest run from a run, a seed, or the journals folder', () => {
  const root = fs.mkdtempSync(path.join(runTempFolder(), 'report-test-'));
  try {
    const write = (seed: string, run: string, route: string) => {
      fs.mkdirSync(path.join(root, seed, run), { recursive: true });
      fs.writeFileSync(path.join(root, seed, run, route), text(ENTRIES));
    };
    write('alpha', '2026-09-24T10-00-00-000Z', 'route-001-a.jsonl');
    write('alpha', '2026-09-24T12-00-00-000Z', 'route-001-b.jsonl');
    write('alpha', '2026-09-24T12-00-00-000Z', 'route-002-c.jsonl');
    write('beta', '2026-09-24T11-00-00-000Z', 'route-001-d.jsonl');

    const run = path.join(root, 'alpha', '2026-09-24T12-00-00-000Z');
    // A seed's folder and the journals folder both mean their latest run, which
    // is alpha's noon run: its name sorts last because runs are named in UTC.
    expect(journalsFor(path.join(root, 'alpha')).from).toBe(run);
    expect(journalsFor(root).from).toBe(run);
    expect(journalsFor(run).files.map((f: string) => path.basename(f))).toEqual([
      'route-001-b.jsonl',
      'route-002-c.jsonl',
    ]);
    const one = path.join(root, 'beta', '2026-09-24T11-00-00-000Z', 'route-001-d.jsonl');
    expect(journalsFor(one).files).toEqual([one]);

    const empty = path.join(root, 'empty');
    fs.mkdirSync(empty);
    expect(() => journalsFor(empty)).toThrow(/holds no journals/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('following is on or off, and anything else is refused', () => {
  const before = process.env[FOLLOW_VARIABLE];
  try {
    for (const [raw, on] of [['', false], ['0', false], ['1', true]] as const) {
      process.env[FOLLOW_VARIABLE] = raw;
      expect(followFromEnvironment(), raw).toBe(on);
    }
    process.env[FOLLOW_VARIABLE] = 'yes';
    expect(() => followFromEnvironment()).toThrow(/PHILEAS_FOLLOW="yes" is not on or off/);
  } finally {
    if (before === undefined) delete process.env[FOLLOW_VARIABLE];
    else process.env[FOLLOW_VARIABLE] = before;
  }
});

test('run --follow prints what the journal records, and show prints the same', () => {
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (name.startsWith('PHILEAS_')) delete env[name];
  const seed = `follow-${Date.now()}`;
  const followed = spawnSync(
    process.execPath,
    [command, 'run', 'proving-ground/buggy/phileas', '--routes', '1', '--trip-length', '4', '--seed', seed, '--follow'],
    { cwd: repo, env, encoding: 'utf8', timeout: 120_000 }
  );
  expect(followed.status, followed.stderr).toBe(0);
  const printed = followed.stdout.split('\n').filter((line) => line.startsWith('route 1  '));

  // The positive control for the comparison below: four hops were printed, so
  // an empty match cannot pass it.
  expect(printed.filter((line) => /^route 1 {2}hop \d/.test(line))).toHaveLength(4);

  const shown = spawnSync(
    process.execPath,
    [command, 'show', path.join('proving-ground', 'buggy', 'phileas', '.phileas-journals', seed)],
    { cwd: repo, env, encoding: 'utf8' }
  );
  expect(shown.status, shown.stderr).toBe(0);
  const fromShow = shown.stdout.split('\n').filter((line) => line.startsWith('route 1  '));
  // One renderer, so a Route followed live and the same Route shown later read
  // identically, line for line.
  expect(fromShow).toEqual(printed);

  fs.rmSync(path.join(repo, 'proving-ground', 'buggy', 'phileas', '.phileas-journals', seed), {
    recursive: true,
    force: true,
  });
});

/**
 * When a finding or a stubbed call arrived, on the line of the step that read
 * it. The step a check runs after is not always the one that caused what it
 * read, so a line naming only its own step would say so by omission. The times
 * are the RStudio Route of 2026-09-29 whose install error arrived during hop 32.
 */
const hop32 = (checks: TripHopEntry['checks'], caught?: TripHopEntry['caught']): TripHopEntry => ({
  kind: 'trip-hop',
  hop: 32,
  target: { source: 'page', role: 'button', name: 'Refresh Find in Files results' },
  action: 'click',
  pool: 'p1',
  startedAt: '2026-09-29T14:49:51.922Z',
  durationMs: 3500,
  settled: true,
  settleMs: 400,
  effect: effect([], []),
  checks,
  ...(caught ? { caught } : {}),
});
const logError = (finding: Record<string, string>) => ({
  check: 'log-error',
  result: 'failed' as const,
  observation: 'rsession-ann.log: ERROR system error 2',
  findings: [
    { id: '6f037ab8', signature: 's', known: false, ...finding },
    { id: '6f037ab8', signature: 's', known: false, ...finding },
  ],
});

test("a failed check's line says when its finding arrived, against that line's own step", () => {
  const byLog = renderEntry(
    hop32([
      logError({
        seenAfter: '2026-09-29T14:49:51.890Z',
        seenBefore: '2026-09-29T14:49:55.400Z',
        loggedAt: '2026-09-29T14:49:52.997Z',
      }),
    ]),
    11
  );
  // Named once though seen twice, and placed by the log's own time.
  expect(byLog).toContain('CHECK FAILED: log-error: rsession-ann.log: ERROR system error 2 (finding 6f037ab8, arrived 1.1 s into hop 32)');

  // No time of its own: the reads around it, one before the step began.
  const between = renderEntry(
    hop32([logError({ seenAfter: '2026-09-29T14:49:51.890Z', seenBefore: '2026-09-29T14:49:55.400Z' })]),
    11
  );
  expect(between).toContain('(finding 6f037ab8, arrived between 0.0 s before hop 32 started and 3.5 s into hop 32)');

  // Seen by the engine before the step started, as in the survey between two.
  const before = renderEntry(hop32([logError({ seenAt: '2026-09-29T14:49:51.600Z' })]), 11);
  expect(before).toContain('(finding 6f037ab8, arrived 0.3 s before hop 32 started)');
});

test('a line from a journal with no times says only the finding, as before', () => {
  expect(renderEntry(hop32([logError({})]), 11)).toContain('ERROR system error 2 (finding 6f037ab8)');
});

test("what the stubs caught says when each came, against the line's own step", () => {
  const line = renderEntry(
    hop32([], {
      outbound: ['https://example.com/a', 'https://example.com/b'],
      at: { outbound: ['2026-09-29T14:49:52.022Z', '2026-09-29T14:49:51.022Z'] },
    }),
    11
  );
  expect(line).toContain(
    '(stubbed: link https://example.com/a (0.1 s into hop 32); link https://example.com/b (0.9 s before hop 32 started))'
  );
  // Without times, as a journal from before 2026-09-30 has, nothing is added.
  expect(renderEntry(hop32([], { outbound: ['https://example.com/a'] }), 11)).toContain('(stubbed: link https://example.com/a)');
});

test('a journal as data keeps each part of a step apart, in the words the printed line uses', () => {
  const failing: JournalEntry[] = [
    { ...ENTRIES[0], fix: { name: 'open-summary', fingerprint: 'f' } } as JournalEntry,
    {
      kind: 'fix-step',
      step: 1,
      label: 'button "Summary"',
      stepKind: 'act',
      startedAt: '',
      durationMs: 1,
      effect: effect(['Total weight'], []),
      checks: [],
    },
    { ...(ENTRIES[3] as TripHopEntry), abandoned: 'locator.click: Timeout 3000ms exceeded.', interceptedBy: '<div class="veil"></div> intercepts pointer events' },
    { kind: 'note', hop: 3, note: 'the menu bar could not be read', at: '' },
    {
      ...(ENTRIES[4] as TripHopEntry),
      checks: [
        { check: 'uncaught-error', result: 'passed' },
        {
          check: 'console-error',
          result: 'failed',
          observation: 'console-error: Boom\nsecond line',
          findings: [
            { id: 'aaaa1111', signature: 's1', known: false },
            { id: 'aaaa1111', signature: 's1', known: false },
            { id: 'bbbb2222', signature: 's2', known: true, issue: '87' },
          ],
        },
      ],
    },
    { kind: 'outcome', outcome: 'failed', hops: 3, reason: 'A check failed after hop 3.', endedAt: '' },
  ];
  const { opening, steps, outcome, unreadable } = journalSteps(text(failing));

  expect(opening).toEqual({
    routeNumber: 3,
    routeSeed: 'r0',
    journeySeed: 'j',
    tripLength: 3,
    fix: 'open-summary',
    build: 'build not recorded',
    platform: 'platform not recorded',
  });
  expect(steps.map((step) => step.kind)).toEqual(['fix', 'hop', 'note', 'hop']);
  expect(steps[0]).toMatchObject({ kind: 'fix', number: 1, action: 'act', target: 'button "Summary"', effect: '+ Total weight', failed: [], known: [] });
  // The value is shortened as the printed line shortens it, and what took an
  // abandoned click is named with the pointer-events tail taken off.
  expect(steps[1]).toMatchObject({
    kind: 'hop',
    number: 2,
    action: 'type',
    target: 'searchbox "Search items"',
    value: '"a value ..." (26 characters)',
    effect: 'no change',
    abandoned: 'locator.click: Timeout 3000ms exceeded.; under <div class="veil"></div>',
  });
  expect(steps[2]).toEqual({ kind: 'note', before: 3, text: 'the menu bar could not be read' });
  // A failed check keeps the first line of what it saw and each new finding
  // once; the known one it carried past is apart, with how it stood.
  expect(steps[3]).toMatchObject({
    target: 'menu View > Show Summary',
    failed: [{ check: 'console-error', observation: 'console-error: Boom', findings: [{ id: 'aaaa1111' }] }],
    known: [{ id: 'bbbb2222', standing: 'issue 87' }],
  });
  expect(outcome).toEqual({ outcome: 'failed', hops: 3, reason: 'A check failed after hop 3.', ranWith: '' });
  expect(unreadable).toEqual([]);
});

test('a journal as data cut off mid-write has no outcome, and says where it ended', () => {
  const whole = text(ENTRIES.slice(0, 4));
  const cut = journalSteps(whole + JSON.stringify(ENTRIES[4]).slice(0, 30));
  expect(cut.steps.map((step) => step.kind === "note" ? null : step.number)).toEqual([1, 2]);
  expect(cut.outcome).toBeNull();
  expect(cut.unreadable).toEqual(['the journal ends partway through a line, where the Route stopped']);
  // The same journal whole, as its control, has its outcome and nothing unreadable.
  const finished = journalSteps(text(ENTRIES));
  expect(finished.outcome).toMatchObject({ outcome: 'passed', hops: 3 });
  expect(finished.unreadable).toEqual([]);
});

// docs/HISTORY.md, 2026-10-16: a step's line counts the checks besides the
// universal ones that ran on it, out of the opening line's checksInForce, and
// names only a failure, which `CHECK FAILED` already does.
test("a step's line counts the checks besides the universal ones that ran, and an older journal prints no count", () => {
  const opening = { ...(ENTRIES[0] as Extract<JournalEntry, { kind: 'route' }>), checksInForce: ['viewer-sort', 'viewer-range', 'options-kept'] };
  const sample = ENTRIES.find((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
  if (!sample) throw new Error('the sample journal has no Trip hop');
  const hop = (checks: TripHopEntry['checks']): TripHopEntry => ({ ...sample, checks });
  const universal = { check: 'uncaught-error', result: 'passed' as const };

  const two = renderEntry(hop([universal, { check: 'viewer-sort', result: 'passed' }, { check: 'viewer-range', result: 'passed' }]), 3, { opening });
  expect(two).toMatch(/ {3}checked: 2$/);
  // A check that could not look on this step checked nothing, and is not counted.
  const one = renderEntry(hop([universal, { check: 'viewer-sort', result: 'passed' }, { check: 'viewer-range', result: 'not-run', observation: 'it did not answer' }]), 3, { opening });
  expect(one).toMatch(/ {3}checked: 1$/);
  // A step where none applied adds nothing, and nor does a universal check alone.
  expect(renderEntry(hop([universal]), 3, { opening })).not.toContain('checked:');
  // A failure is counted, and named by CHECK FAILED as before.
  const failed = renderEntry(
    hop([universal, { check: 'viewer-sort', result: 'passed' }, { check: 'viewer-range', result: 'failed', observation: 'the range is wrong' }]),
    3,
    { opening }
  );
  expect(failed).toContain('   checked: 2   CHECK FAILED: viewer-range: the range is wrong');
  // An older journal, every check on every step and no checksInForce, prints no count.
  expect(renderEntry(hop([universal, { check: 'viewer-sort', result: 'passed' }]), 3, { opening: ENTRIES[0] as Extract<JournalEntry, { kind: 'route' }> })).not.toContain('checked:');

  // The page reads the same count, from the same journal.
  const lines = [opening, hop([universal, { check: 'viewer-sort', result: 'passed' }, { check: 'options-kept', result: 'passed' }])];
  const steps = journalSteps(lines.map((entry) => JSON.stringify(entry)).join('\n'));
  expect(steps.steps[0]).toMatchObject({ kind: 'hop', checked: 2 });
});

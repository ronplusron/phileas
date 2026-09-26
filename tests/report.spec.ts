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
  type JournalEntry,
} from '../src/index';
import { journalsFor } from '../bin/phileas.mjs';

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
    'route 3  seed r0, from Journey seed j, Trip of 3 hops',
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

test('show finds the latest run from a run, a seed, or the journals folder', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-report-test-'));
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
    [command, 'run', 'testbed/buggy/phileas', '--routes', '1', '--trip-length', '4', '--seed', seed, '--follow'],
    { cwd: repo, env, encoding: 'utf8', timeout: 120_000 }
  );
  expect(followed.status, followed.stderr).toBe(0);
  const printed = followed.stdout.split('\n').filter((line) => line.startsWith('route 1  '));

  // The positive control for the comparison below: four hops were printed, so
  // an empty match cannot pass it.
  expect(printed.filter((line) => /^route 1 {2}hop \d/.test(line))).toHaveLength(4);

  const shown = spawnSync(
    process.execPath,
    [command, 'show', path.join('testbed', 'buggy', 'phileas', '.phileas-journals', seed)],
    { cwd: repo, env, encoding: 'utf8' }
  );
  expect(shown.status, shown.stderr).toBe(0);
  const fromShow = shown.stdout.split('\n').filter((line) => line.startsWith('route 1  '));
  // One renderer, so a Route followed live and the same Route shown later read
  // identically, line for line.
  expect(fromShow).toEqual(printed);

  fs.rmSync(path.join(repo, 'testbed', 'buggy', 'phileas', '.phileas-journals', seed), {
    recursive: true,
    force: true,
  });
});

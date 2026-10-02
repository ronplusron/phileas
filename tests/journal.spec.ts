import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { Journal, journalPath, readJournal } from '../src/index';
import { scratch as makeScratch, removeScratch } from './scratch';

/**
 * The journal, tested for the endings it exists to survive.
 *
 * R9 asks that a Route's record be readable after anything that ends the run
 * abruptly: the application crashing, the application hanging and being given
 * up on, the run being stopped by hand or by its deadline, and the machine
 * running it dying. Every one of those is a case where end-of-test reporting
 * never happens, which is why Playwright's own attachments and trace cannot
 * stand in for this.
 *
 * So the tests here are mostly about damage. A journal that only reads back
 * when the Route finished cleanly would be a record of the cases nobody needs
 * a record of.
 */

test.afterEach(removeScratch);

function scratch(): string {
  return makeScratch('phileas-journal-test-');
}

const opening = {
  journeySeed: 'abc123',
  routeSeed: 'def456',
  routeNumber: 3,
  tripLength: 5,
  settleQuietMs: 400,
};

function hop(index: number) {
  return {
    kind: 'trip-hop' as const,
    hop: index + 1,
    target: { source: 'page' as const, role: 'button', name: `Button ${index}`, nth: 1 },
    action: 'click' as const,
    pool: 'pool-id',
    startedAt: new Date().toISOString(),
    durationMs: 1,
    settled: true,
    settleMs: 1,
    effect: {
      readable: true as const,
      changed: false,
      appeared: [],
      appearedMore: 0,
      wentAway: [],
      wentAwayMore: 0,
    },
    checks: [],
  };
}

test('every hop is on disk before the next one starts', () => {
  const dir = scratch();
  const journal = Journal.open(dir, opening);

  // Read back between writes rather than at the end. Reading only at the end
  // would pass just as well against a journal that buffered everything and
  // flushed once, which is the implementation this must rule out: a crash is
  // exactly the case where the final flush never happens, and a crash is
  // exactly what this engine is hunting.
  for (let index = 0; index < 3; index += 1) {
    journal.write(hop(index));
    const entries = readJournal(journalPath(dir, opening.routeNumber, opening.routeSeed));
    expect(entries.filter((entry) => entry.kind === 'trip-hop')).toHaveLength(index + 1);
  }

  journal.close({ outcome: 'passed', hops: 3 });
});

test('the opening entry is written before the Route does anything', () => {
  const dir = scratch();
  const journal = Journal.open(dir, opening);

  // A Route that dies inside its Fix has completed no hops, and a journal
  // created lazily on the first successful hop would not exist at all for
  // exactly that failure. The seed has to be recoverable from a Route that
  // never traveled.
  const entries = readJournal(journalPath(dir, opening.routeNumber, opening.routeSeed));
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ kind: 'route', routeSeed: 'def456', tripLength: 5 });

  journal.abandon();
});

test('a journal truncated mid-write still reads back every completed hop', () => {
  const dir = scratch();
  const journal = Journal.open(dir, opening);
  for (let index = 0; index < 4; index += 1) journal.write(hop(index));
  journal.abandon();

  // Cut the file inside the last line, which is what a process killed mid-write
  // leaves behind. A single JSON array would be unparseable from end to end
  // here, taking the three complete hops with it; that is the whole reason for
  // one object per line.
  const file = journalPath(dir, opening.routeNumber, opening.routeSeed);
  const whole = fs.readFileSync(file, 'utf8');
  const lastLineStart = whole.lastIndexOf('\n', whole.length - 2) + 1;
  fs.writeFileSync(file, whole.slice(0, lastLineStart + 30));

  const entries = readJournal(file);
  expect(entries.filter((entry) => entry.kind === 'trip-hop')).toHaveLength(3);
  expect(entries[0]?.kind).toBe('route');
});

test('a broken line in the MIDDLE is refused rather than skipped', () => {
  const dir = scratch();
  const journal = Journal.open(dir, opening);
  for (let index = 0; index < 3; index += 1) journal.write(hop(index));
  journal.close({ outcome: 'passed', hops: 3 });

  const file = journalPath(dir, opening.routeNumber, opening.routeSeed);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines[2] = '{"kind":"hop", this is not json';
  fs.writeFileSync(file, lines.join('\n'));

  // A truncated last line is expected and is read past. A broken line with
  // content after it means the file was corrupted rather than cut off, and
  // quietly dropping it would leave a journal that reads clean while missing a
  // hop. A journal is evidence, and evidence that silently discards what it
  // cannot parse is worth less than one that says so.
  expect(() => readJournal(file)).toThrow(/unparseable line at 3/);
});

test('an unfinished Route leaves no outcome line, rather than a guessed one', () => {
  const dir = scratch();
  const journal = Journal.open(dir, opening);
  journal.write(hop(0));
  journal.abandon();

  const entries = readJournal(journalPath(dir, opening.routeNumber, opening.routeSeed));
  expect(entries.some((entry) => entry.kind === 'outcome')).toBe(false);
});

test('writing after the outcome is refused', () => {
  const dir = scratch();
  const journal = Journal.open(dir, opening);
  journal.close({ outcome: 'passed', hops: 0 });

  // The outcome is the last thing a Route writes. Anything after it would be a
  // hop recorded as having happened after the Route ended, which is a record of
  // something that did not occur.
  expect(() => journal.write(hop(0))).toThrow(/closed/);
});

test('the file name carries the seed, so a report names a findable journal', () => {
  const file = journalPath('/tmp/journeys', 8, 'abcdef0123456789');

  // R12: someone who did not run the Journey reproduces a finding from the
  // report alone. The report names a route seed, and a directory listing has to
  // be enough to find the journal for it without opening anything.
  expect(path.basename(file)).toBe('route-008-abcdef0123456789.jsonl');
});

test('a pool is written once, and before the first hop that names it', () => {
  const dir = scratch();
  const journal = Journal.open(dir, opening);
  const inventory = [
    { source: 'page' as const, role: 'button', name: 'Inventory', nth: 1 },
    { source: 'page' as const, role: 'button', name: 'Summary', nth: 1 },
  ];
  const summary = [{ source: 'page' as const, role: 'button', name: 'Inventory', nth: 1 }];

  // Three hops over two distinct lists, the way a Route moves between two views
  // and back.
  const first = journal.pool(inventory);
  journal.write({ ...hop(0), pool: first });
  const second = journal.pool(summary);
  journal.write({ ...hop(1), pool: second });
  const third = journal.pool(inventory);
  journal.write({ ...hop(2), pool: third });
  journal.close({ outcome: 'passed', hops: 3 });

  // The same list gets the same id, and a list that merely differs gets another.
  // An id drawn from anything but the contents would write the unchanging menu
  // out again on every hop, which is the size problem pools exist to remove.
  expect(third).toBe(first);
  expect(second).not.toBe(first);

  const entries = readJournal(journalPath(dir, opening.routeNumber, opening.routeSeed));
  const pools = entries.filter((entry) => entry.kind === 'pool');
  expect(pools).toHaveLength(2);

  // Every hop names a pool that appears EARLIER in the file. That ordering is
  // what makes a file cut off mid-write safe to read: it can lose the last hop,
  // but it can never hold a hop pointing at a list that is not there.
  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry.kind === 'pool') seen.add(entry.id);
    if (entry.kind === 'trip-hop') expect(seen.has(entry.pool)).toBe(true);
  }
});

test('a pool id depends on order, not only on membership', () => {
  const dir = scratch();
  const journal = Journal.open(dir, opening);
  const a = { source: 'page' as const, role: 'button', name: 'A', nth: 1 };
  const b = { source: 'page' as const, role: 'button', name: 'B', nth: 1 };

  // The draw picks by position, so a list that only reordered sends the same
  // draw to a different target. Treating [A, B] and [B, A] as one pool would let
  // a replay report a match where the Route actually diverged.
  expect(journal.pool([a, b])).not.toBe(journal.pool([b, a]));
  journal.abandon();
});

test('hidden controls are written on the pool and change its id, and none leaves the id as it was', () => {
  const dir = scratch();
  const journal = Journal.open(dir, opening);
  const shown = [{ source: 'page' as const, role: 'button', name: 'Inventory', nth: 1 }];
  const away = {
    candidate: { source: 'page' as const, role: 'button', name: 'Summary', nth: 1 },
    by: '<div id="pane">',
  };

  // A screen hiding nothing keeps the id it had before hidden controls were
  // recorded, so a journal from before is still compared like for like.
  const plain = journal.pool(shown);
  expect(journal.pool(shown, [], [])).toBe(plain);
  const withHidden = journal.pool(shown, [], [away]);
  expect(withHidden).not.toBe(plain);
  // Hidden is not covered: the same control under each is a different screen.
  expect(journal.pool(shown, [away], [])).not.toBe(withHidden);
  journal.close({ outcome: 'passed', hops: 0 });

  const pools = readJournal(journalPath(dir, opening.routeNumber, opening.routeSeed)).filter(
    (entry) => entry.kind === 'pool'
  );
  const written = pools.find((entry) => entry.id === withHidden);
  expect(written).toMatchObject({ hidden: [away] });
  expect(written).not.toHaveProperty('covered');
  expect(pools.find((entry) => entry.id === plain)).not.toHaveProperty('hidden');
});

test('an existing journal is refused, never overwritten', () => {
  // Each run writes to a folder of its own, so a journal already at this path
  // means two runs were handed one folder. The earlier record is what a replay
  // compares against, so it is kept and the second open fails loudly.
  const dir = scratch();
  const first = Journal.open(dir, opening);
  first.write(hop(0));
  first.close({ outcome: 'passed', hops: 1 });
  const before = fs.readFileSync(first.file, 'utf8');

  expect(() => Journal.open(dir, opening)).toThrow(/already exists/);
  expect(fs.readFileSync(first.file, 'utf8')).toBe(before);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { Journal, journalPath, readJournal } from '../src/index';

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

function scratch(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-journal-test-'));
}

const opening = {
  journeySeed: 'abc123',
  routeSeed: 'def456',
  routeIndex: 3,
  hopBudget: 5,
};

function hop(index: number) {
  return {
    kind: 'hop' as const,
    hop: index,
    phase: 'traversal' as const,
    chosen: { source: 'page' as const, role: 'button', name: `Button ${index}`, nth: 0 },
    candidates: [{ source: 'page' as const, role: 'button', name: `Button ${index}`, nth: 0 }],
    startedAt: new Date().toISOString(),
    durationMs: 1,
    settled: true,
    settleMs: 1,
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
    const entries = readJournal(journalPath(dir, opening.routeIndex, opening.routeSeed));
    expect(entries.filter((entry) => entry.kind === 'hop')).toHaveLength(index + 1);
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
  const entries = readJournal(journalPath(dir, opening.routeIndex, opening.routeSeed));
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ kind: 'route', routeSeed: 'def456', hopBudget: 5 });

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
  const file = journalPath(dir, opening.routeIndex, opening.routeSeed);
  const whole = fs.readFileSync(file, 'utf8');
  const lastLineStart = whole.lastIndexOf('\n', whole.length - 2) + 1;
  fs.writeFileSync(file, whole.slice(0, lastLineStart + 30));

  const entries = readJournal(file);
  expect(entries.filter((entry) => entry.kind === 'hop')).toHaveLength(3);
  expect(entries[0]?.kind).toBe('route');
});

test('a broken line in the MIDDLE is refused rather than skipped', () => {
  const dir = scratch();
  const journal = Journal.open(dir, opening);
  for (let index = 0; index < 3; index += 1) journal.write(hop(index));
  journal.close({ outcome: 'passed', hops: 3 });

  const file = journalPath(dir, opening.routeIndex, opening.routeSeed);
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

  const entries = readJournal(journalPath(dir, opening.routeIndex, opening.routeSeed));
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
  const file = journalPath('/tmp/journeys', 7, 'abcdef0123456789');

  // R12: someone who did not run the Journey reproduces a finding from the
  // report alone. The report names a route seed, and a directory listing has to
  // be enough to find the journal for it without opening anything.
  expect(path.basename(file)).toBe('route-007-abcdef0123456789.jsonl');
});

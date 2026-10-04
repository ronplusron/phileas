import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  CheckFailure,
  RUN_VARIABLE,
  SEED_VARIABLE,
  createTest,
  defineJourney,
  deriveRouteStreams,
  findingId,
  finishJourney,
  journalFolder,
  markFiled,
  dismissFinding,
  removeFinding,
  resignKnownFindings,
  readJournal,
  readKnownFindings,
  recordJourneyFindings,
  renderJourneyFindings,
  runRoute,
  refuseUnfitVarying,
  signatureOf,
  startJourney,
  type AppUnderTest,
  type Chooser,
  type KnownFinding,
  type TripHopEntry,
} from '../src/index';
import { journalsBeside, listKnownFindings } from '../src/known.mjs';
import { knownFileIn, parse } from '../bin/phileas.mjs';
import { removeScratch, scratch } from './scratch';

/**
 * Known findings: a bug already found is recorded and the Route carries on.
 * docs/PLAN.md has the design, under "Before the rest of the trial: known
 * findings".
 */

test.afterEach(removeScratch);

// Two runs of issue 44, from the trial's journals of 2026-09-26 and
// 2026-09-27: different profile folders and timestamps, the same bug.
const ISSUE_44 = [
  "/var/folders/qd/7kw1mv0tn3r58bx62hcyl4f90000gq/T/phileas-positron-Y2Bp11/logs/window1/exthost/exthost.log: 2026-09-26 20:03:03.448 [error] An error occurred when deactivating the extension 'positron.positron-connections':",
  "/var/folders/qd/7kw1mv0tn3r58bx62hcyl4f90000gq/T/phileas-positron-hKzIxA/logs/window1/exthost/exthost.log: 2026-09-27 02:37:59.900 [error] An error occurred when deactivating the extension 'positron.positron-connections':",
];

test('two runs of the same bug have the same signature, and what varies is taken out', () => {
  const [first, second] = ISSUE_44.map((line) => signatureOf('log-error', line));
  expect(first).toBe(
    "log-error: exthost.log: [error] An error occurred when deactivating the extension 'positron.positron-connections':"
  );
  expect(second).toBe(first);
  expect(findingId(first as string)).toBe(findingId(second as string));
});

test("a profile inside its run's folder signs the same as one directly in the temp folder", () => {
  // Profiles moved into a folder per run on 2026-09-28. A finding filed
  // before then carries the old layout, and must still match the new one.
  const opening = (profile: string) =>
    signatureOf('uncaught-error', `ENOENT: no such file or directory, open '${profile}/User/settings.json'`);
  const before = opening('/var/folders/qd/7kw1mv0tn3r58bx62hcyl4f90000gq/T/phileas-positron-Y2Bp11');
  const after = opening('/private/var/folders/qd/7kw1mv0tn3r58bx62hcyl4f90000gq/T/phileas-positron-a1b2c3/qSDPVM');
  expect(before).toBe("uncaught-error: ENOENT: no such file or directory, open '<profile>/User/settings.json'");
  expect(after).toBe(before);
});

test('a hang keeps its control and loses its Hop and its timings', () => {
  const hang = (hop: number, ms: number) =>
    signatureOf(
      'still-responding',
      `hop ${hop}'s menu-click on menuitem "Clear Recently Opened..." was bounded to 3000 ms and had not returned after ${ms} ms: the application stopped answering`
    );
  expect(hang(11, 8002)).toBe(hang(14, 8001));
  expect(hang(11, 8002)).toContain('"Clear Recently Opened..."');
});

test('a stack keeps its first frame and loses the frame position', () => {
  const at = (line: number) =>
    signatureOf(
      'uncaught-error',
      `main process: unhandled rejection: Canceled: Canceled\n    at UniqueContainer.value (file:///Applications/Positron.app/Contents/Resources/app/out/main.js:${line}:14)`
    );
  expect(at(7225)).toBe('uncaught-error: main process: unhandled rejection: Canceled: Canceled at UniqueContainer.value (main.js)');
  expect(at(9000)).toBe(at(7225));
});

test("the name of whoever ran it becomes <user>, as a whole word only", () => {
  // RStudio's session log names itself for the user on every line. The name
  // here is invented; the default reads the running user's.
  const logged = (user: string) =>
    signatureOf(
      'log-error',
      `/var/folders/qd/7kw1mv0tn3r58bx62hcyl4f90000gq/T/phileas-rstudio-a1b2c3/qSDPVM/home/.local/share/rstudio/log/rsession-${user}.log: ` +
        `2026-09-28T14:44:54.756633Z [rsession-${user}] ERROR annotate failed for ${user}`,
      user
    );
  expect(logged('ann')).toBe('log-error: rsession-<user>.log: [rsession-<user>] ERROR annotate failed for <user>');
  // Filed on one machine, it matches on another.
  expect(logged('bea')).toBe(logged('ann'));
  // The running user by default, whoever that is, never left in.
  expect(signatureOf('log-error', `ERROR for ${os.userInfo().username}`)).toBe('log-error: ERROR for <user>');
});

test("an adapter's own patterns take out an id made fresh each time, and one without g is refused", () => {
  // An id of a shape the engine does not know, as an application might print.
  const closed = (handle: string, varying?: readonly (readonly [RegExp, string])[]) =>
    signatureOf('log-error', `ERROR socket closed for terminal ${handle}`, 'ann', varying);
  const terminal: readonly [RegExp, string] = [/terminal term-\d+/g, 'terminal term-<n>'];
  expect(closed('term-7')).not.toBe(closed('term-9'));
  expect(closed('term-7', [terminal])).toBe(closed('term-9', [terminal]));

  expect(() => refuseUnfitVarying([terminal])).not.toThrow();
  expect(() => refuseUnfitVarying([[/terminal term-\d+/, 'x']])).toThrow(/without the g flag/);
});

test('an id made fresh each time, a UUID or eight or more hex digits, is taken out; a short value or an error code is not', () => {
  const said = (text: string) => signatureOf('console-error', text, 'ann');
  // Positron's R session, measured with five of them on 2026-09-27 and 28.
  expect(said('Session R 4.6.0 (r-058df68c) is not active.')).toBe(said('Session R 4.6.0 (r-357d668c) is not active.'));
  expect(said('Session R 4.6.0 (r-058df68c) is not active.')).toContain('(r-<id>)');
  // RStudio's terminal handle, and a UUID in one piece.
  expect(said('Unknown handle: "3968F855"')).toBe(said('Unknown handle: "64E9346F"'));
  expect(said('Client-ID: 5b1f0c8e-2d47-4a93-b6e1-9c3a7f0d2e84')).toBe('console-error: Client-ID: <id>');
  // Kept: seven digits, a value inside a word, and an error code written 0x...
  expect(said('build 1a2b3c4')).toBe('console-error: build 1a2b3c4');
  expect(said('failed: 0xC0000005')).toBe('console-error: failed: 0xC0000005');
  expect(said('failed: 0xC0000005')).not.toBe(said('failed: 0xC0000409'));
});

test('an adapter pattern runs before the engine, so its own choice stands', () => {
  const handle: readonly [RegExp, string] = [/Unknown handle: "[0-9A-F]{8}"/g, 'Unknown handle: "<handle>"'];
  expect(signatureOf('log-error', 'Unknown handle: "3968F855"', 'ann', [handle])).toBe('log-error: Unknown handle: "<handle>"');
});

test('stored entries are re-signed under the rules in force, merged where they now agree, and a clash is left and named', () => {
  const olderForm = (id: string, added: string, issue?: string): KnownFinding => {
    const signature = `console-error: Session (r-${id}) is not active.`;
    return { id: findingId(signature), check: 'console-error', signature, added, source: 'journey', ...(issue ? { issue } : {}) };
  };
  const { entries, merged, clashes } = resignKnownFindings([
    olderForm('058df68c', '2026-09-28'),
    olderForm('6eaf3abc', '2026-09-27', 'ronplusron/phileas#70'),
    olderForm('cfbb872a', '2026-09-28'),
  ]);
  expect(clashes).toEqual([]);
  expect(entries).toHaveLength(1);
  const [one] = entries;
  // The issue kept, the earliest date, and an id that is its new signature's.
  expect(one).toMatchObject({ signature: 'console-error: Session (r-<id>) is not active.', issue: 'ronplusron/phileas#70', added: '2026-09-27' });
  expect(one?.id).toBe(findingId(one?.signature ?? ''));
  expect(merged).toEqual([{ into: one?.id, from: expect.arrayContaining([findingId('console-error: Session (r-058df68c) is not active.')]) }]);

  // Two issues for what is now one finding: only a person can say which.
  const clash = resignKnownFindings([olderForm('058df68c', '2026-09-28', 'ronplusron/phileas#1'), olderForm('6eaf3abc', '2026-09-27', 'ronplusron/phileas#2')]);
  expect(clash.entries).toHaveLength(2);
  expect(clash.clashes).toHaveLength(1);
});

test("a Journey's end rewrites the file under the rules in force and says what it merged", () => {
  const olderSignature = (id: string) => `console-error: Session (r-${id}) is not active.`;
  const file = knownFile([finding(olderSignature('058df68c')), finding(olderSignature('357d668c'), 'ronplusron/phileas#5')]);
  const today = 'console-error: Session (r-<id>) is not active.';
  const result = recordJourneyFindings(runWith([{ signature: today, known: true }]), file, '2026-09-29');
  expect(readKnownFindings(file).entries.map((entry) => [entry.signature, entry.issue])).toEqual([[today, 'ronplusron/phileas#5']]);
  expect(result.known).toEqual([{ id: findingId(today), signature: today, sightings: 1, issue: 'ronplusron/phileas#5' }]);
  expect(renderJourneyFindings(result, file).join('\n')).toMatch(/merged, now one finding under the rules in force: \w{8}, \w{8} into \w{8}/);
});

test('a message worded differently is a different finding', () => {
  expect(signatureOf('console-error', 'the tickets could not be checked')).not.toBe(
    signatureOf('console-error', 'the tickets could not be printed')
  );
});

function knownFile(entries: KnownFinding[] | string): string {
  const file = path.join(scratch('phileas-known-test-'), 'known-findings.json');
  fs.writeFileSync(file, typeof entries === 'string' ? entries : JSON.stringify(entries, null, 2));
  return file;
}

function finding(signature: string, issue?: string): KnownFinding {
  return { id: findingId(signature), check: signature.split(':')[0] as string, signature, added: '2026-09-27', source: 'journey', ...(issue ? { issue } : {}) };
}

test('no file is no known findings, and a file that is not a list is refused', () => {
  expect(readKnownFindings(path.join(scratch('phileas-known-test-'), 'absent.json'))).toEqual({ version: 'none', entries: [] });
  // Read as empty, it would end every Route at a bug somebody marked known.
  expect(() => readKnownFindings(knownFile('{ not json'))).toThrow(/not valid JSON/);
  expect(() => readKnownFindings(knownFile('{"signature": "x"}'))).toThrow(/not a list/);
});

test('marking a finding filed sets its issue, and an id matching nothing is refused with the list', () => {
  const signature = 'console-error: the tickets could not be checked';
  const file = knownFile([finding(signature)]);

  const filed = markFiled(file, findingId(signature).slice(0, 4), 'ronplusron/phileas#99');
  expect(filed.issue).toBe('ronplusron/phileas#99');
  expect(readKnownFindings(file).entries[0]?.issue).toBe('ronplusron/phileas#99');

  expect(() => markFiled(file, 'ffffffff', 'x')).toThrow(/No finding has the id ffffffff[\s\S]*the tickets could not be checked/);
});

/** A run folder holding one Route's journal, with the findings given on one Hop. */
function runWith(findings: { signature: string; known: boolean; issue?: string }[]): string {
  const run = scratch('phileas-known-test-');
  const hop = {
    kind: 'trip-hop',
    hop: 1,
    checks: [
      {
        check: 'console-error',
        result: findings.some((f) => !f.known) ? 'failed' : 'passed',
        findings: findings.map((f) => ({ id: findingId(f.signature), ...f })),
      },
    ],
  };
  fs.writeFileSync(path.join(run, 'route-001-abc.jsonl'), `${JSON.stringify({ kind: 'route' })}\n${JSON.stringify(hop)}\n`);
  return run;
}

test("a Journey's end adds what it found as unfiled, and says what was seen and what was not", () => {
  const seen = 'console-error: seen again';
  const gone = 'console-error: not seen this time';
  const fresh = 'console-error: found for the first time';
  const file = knownFile([finding(seen, 'ronplusron/phileas#1'), finding(gone)]);

  const result = recordJourneyFindings(runWith([{ signature: seen, known: true }, { signature: fresh, known: false }]), file, '2026-09-27');

  expect(result.known).toEqual([{ id: findingId(seen), signature: seen, sightings: 1, issue: 'ronplusron/phileas#1' }]);
  expect(result.added).toEqual([{ id: findingId(fresh), signature: fresh, sightings: 1 }]);
  expect(result.notSeen.map((entry) => entry.signature)).toEqual([gone]);

  const added = readKnownFindings(file).entries.find((entry) => entry.signature === fresh);
  expect(added).toMatchObject({ id: findingId(fresh), source: 'journey', added: '2026-09-27' });
  expect(added?.issue).toBeUndefined();

  const printed = renderJourneyFindings(result, file).join('\n');
  expect(printed).toMatch(/UNFILED, seen 1 time\(s\): \w{8} {2}console-error: found for the first time/);
  // Counted, not listed: a line per finding not met buried the ones met.
  expect(printed).not.toContain('console-error: not seen this time');
  expect(printed).toContain(`1 other known finding(s) not met this Journey; to list every one: phileas known list ${file}`);
  expect(printed).toContain('phileas known add <id> --issue <issue>');
  // The default file needs no argument, so the command printed is the one typed.
  expect(renderJourneyFindings(result, path.join('phileas', 'known-findings.json')).join('\n')).toMatch(
    /to list every one: phileas known list$/m
  );
});

test("finishJourney finds the Journey's run by its seed and run name", () => {
  // Every scratch folder is made before the Journey starts, since one made
  // after would count as something the Journey left behind.
  const root = scratch('phileas-known-test-');
  const found = runWith([{ signature: 'console-error: from the run', known: false }]);
  process.env[SEED_VARIABLE] = 'known-seed';
  try {
    const { run } = startJourney(defineJourney({ routes: 1, tripLength: 1 }), buggy);
    const folder = journalFolder(root, 'known-seed', run);
    fs.mkdirSync(folder, { recursive: true });
    fs.copyFileSync(path.join(found, 'route-001-abc.jsonl'), path.join(folder, 'route-001-abc.jsonl'));
    const file = path.join(root, 'known-findings.json');

    expect(finishJourney({ journalsRoot: root, knownFindings: file })?.added.map((a) => a.signature)).toEqual([
      'console-error: from the run',
    ]);
  } finally {
    delete process.env[SEED_VARIABLE];
    delete process.env[RUN_VARIABLE];
  }
});

test('a false alarm keeps its reason, is refused for a filed bug or without a reason, and filing one clears it', () => {
  const alarm = 'console-error: normal while R restarts';
  const bug = 'console-error: a real bug';
  const file = knownFile([finding(alarm), finding(bug, 'ronplusron/phileas#9')]);

  expect(dismissFinding(file, findingId(alarm).slice(0, 4), 'RStudio logs it on every restart').falseAlarm).toBe(
    'RStudio logs it on every restart'
  );
  expect(() => dismissFinding(file, findingId(bug), 'no')).toThrow(/is filed as ronplusron\/phileas#9, and a filed bug is not a false alarm/);
  expect(() => dismissFinding(file, findingId(alarm), '  ')).toThrow(/needs a reason/);

  // Filing it after all says it was a bug, so the reason goes.
  const filed = markFiled(file, findingId(alarm), 'ronplusron/phileas#10');
  expect(filed.falseAlarm).toBeUndefined();
  expect(readKnownFindings(file).entries.find((entry) => entry.signature === alarm)).toMatchObject({ issue: 'ronplusron/phileas#10' });
});

test('an entry both filed and a false alarm is refused when the file is read', () => {
  const signature = 'console-error: both at once';
  const file = knownFile([{ ...finding(signature, 'ronplusron/phileas#1'), falseAlarm: 'and not a bug' }]);
  expect(() => readKnownFindings(file)).toThrow(/is both filed as a bug and marked a false alarm/);
});

test("a Journey's end never adds back a false alarm, counts it apart, and reports a removed finding as new", () => {
  const alarm = 'console-error: dismissed';
  const removed = 'console-error: removed after a fix';
  const file = knownFile([{ ...finding(alarm), falseAlarm: 'normal for the application' }, finding(removed, 'ronplusron/phileas#2')]);
  expect(removeFinding(file, findingId(removed)).signature).toBe(removed);
  expect(readKnownFindings(file).entries.map((entry) => entry.signature)).toEqual([alarm]);

  const result = recordJourneyFindings(runWith([{ signature: alarm, known: true }, { signature: removed, known: false }]), file, '2026-09-29');
  expect(result.known).toEqual([{ id: findingId(alarm), signature: alarm, sightings: 1, falseAlarm: 'normal for the application' }]);
  expect(result.added.map((finding) => finding.signature)).toEqual([removed]);
  // Held once: the false alarm was not written again beside itself.
  expect(readKnownFindings(file).entries.filter((entry) => entry.signature === alarm)).toHaveLength(1);

  const printed = renderJourneyFindings(result, file).join('\n');
  expect(printed).toMatch(/false alarm, seen 1 time\(s\) \(normal for the application\): \w{8} {2}console-error: dismissed/);
  expect(printed).toMatch(/UNFILED, seen 1 time\(s\): \w{8} {2}console-error: removed after a fix/);
  expect(printed).not.toMatch(/UNFILED[^\n]*dismissed/);
  expect(printed).toContain('phileas known dismiss <id> --reason <why>');
});

test("known finds the folder's own file when run from inside phileas/, and says alone what is missing", () => {
  // Run from inside a consumer's phileas/, the default phileas/known-findings.json
  // is not there and known-findings.json is.
  const inside = scratch('phileas-known-inside-');
  const atRoot = scratch('phileas-known-root-');
  const empty = scratch('phileas-known-empty-');
  const signature = 'console-error: the tickets could not be checked';
  fs.writeFileSync(path.join(inside, 'known-findings.json'), JSON.stringify([finding(signature)]));
  fs.mkdirSync(path.join(atRoot, 'phileas'));
  fs.writeFileSync(path.join(atRoot, 'phileas', 'known-findings.json'), '[]');
  const fallback = path.join('phileas', 'known-findings.json');
  expect(knownFileIn(fallback, inside)).toBe('known-findings.json');
  expect(knownFileIn(fallback, atRoot)).toBe(fallback);
  expect(knownFileIn(fallback, empty)).toBe(fallback);
  // A file named is taken as named.
  expect(knownFileIn('other.json', inside)).toBe('other.json');

  const command = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'phileas.mjs');
  const run = (cwd: string) =>
    spawnSync(process.execPath, [command, 'known', 'dismiss', findingId(signature).slice(0, 4), '--reason', 'a test'], {
      cwd,
      encoding: 'utf8',
    });
  const worked = run(inside);
  expect(worked.status, worked.stderr).toBe(0);
  expect(worked.stdout).toMatch(/is marked a false alarm \(a test\)/);

  // Nothing to find: the one line saying so, with no usage text after it.
  const refused = run(empty);
  expect(refused.status).toBe(2);
  expect(refused.stderr.trim()).toBe(`phileas: there is no ${fallback}; a Journey writes it when it ends, or give the file`);
});

test('the command parses known dismiss and known remove, and refuses dismiss without a reason', () => {
  expect(parse(['known', 'dismiss', 'd37a', '--reason', 'normal while R restarts'])).toEqual({
    command: 'known-dismiss',
    id: 'd37a',
    reason: 'normal while R restarts',
    file: path.join('phileas', 'known-findings.json'),
  });
  expect(parse(['known', 'remove', 'd37a', 'other.json'])).toEqual({ command: 'known-remove', id: 'd37a', file: 'other.json' });
  expect(() => parse(['known', 'dismiss', 'd37a'])).toThrow(/needs --reason/);
  expect(() => parse(['known', 'remove', 'd37a', '--reason', 'x'])).toThrow(/unknown flag --reason/);
  expect(() => parse(['known', 'remove'])).toThrow(/needs the id/);
});

test('the command parses known add, and refuses it without an id or an issue', () => {
  expect(parse(['known', 'add', 'baa530b2', '--issue', 'ronplusron/phileas#44'])).toEqual({
    command: 'known-add',
    id: 'baa530b2',
    issue: 'ronplusron/phileas#44',
    file: path.join('phileas', 'known-findings.json'),
  });
  expect(parse(['known', 'add', 'baa5', '--issue=x', 'other.json'])).toMatchObject({ file: 'other.json', issue: 'x' });
  expect(() => parse(['known', 'add', '--issue', 'x'])).toThrow(/needs the id/);
  expect(() => parse(['known', 'add', 'baa5'])).toThrow(/needs --issue/);
  expect(() => parse(['known', 'show'])).toThrow(/known takes add, dismiss, remove or list/);
});

test('the command parses known list, with a file or without', () => {
  expect(parse(['known', 'list'])).toEqual({ command: 'known-list', file: path.join('phileas', 'known-findings.json') });
  expect(parse(['known', 'list', 'other.json'])).toEqual({ command: 'known-list', file: 'other.json' });
  expect(() => parse(['known', 'list', 'a.json', 'b.json'])).toThrow(/takes one file/);
  expect(() => parse(['known', 'list', '--all'])).toThrow(/takes no flags/);
});

test('the list shows every finding, unfiled first, with when each was last met in the journals beside it', () => {
  const met = 'console-error: met in the later run';
  const older = 'console-error: met in the earlier run only';
  const never = 'console-error: never met here';
  const filed = 'console-error: filed and met';
  const file = knownFile([finding(met), finding(older), finding(never), finding(filed, 'ronplusron/phileas#7')]);
  const root = path.join(path.dirname(file), '.phileas-journals');
  const runOf = (name: string, signatures: string[]) => {
    const run = path.join(root, 'seed', name);
    fs.mkdirSync(run, { recursive: true });
    fs.copyFileSync(
      path.join(runWith(signatures.map((signature) => ({ signature, known: true }))), 'route-001-abc.jsonl'),
      path.join(run, 'route-001-abc.jsonl')
    );
  };
  runOf('2026-09-30T10-00-00-000Z', [older, met]);
  runOf('2026-10-02T10-00-00-000Z', [met, filed]);

  expect(journalsBeside(file)).toBe(root);
  const lines = listKnownFindings(file, journalsBeside(file));
  expect(lines[0]).toBe(`Known findings in ${file}: 4, 3 unfiled, 1 filed, 0 false alarm(s)`);
  const row = (signature: string) => lines.find((line) => line.endsWith(signature)) ?? '';
  expect(row(met)).toMatch(/unfiled\s+last met 2026-10-02/);
  expect(row(older)).toMatch(/unfiled\s+last met 2026-09-30/);
  expect(row(never)).toMatch(/unfiled\s+not met in these journals/);
  expect(row(filed)).toMatch(/ronplusron\/phileas#7\s+last met 2026-10-02/);
  // Unfiled first, the most recently met first among them; filed after.
  expect(lines.slice(1, 5).map((line) => line.slice(line.indexOf('console-error')))).toEqual([met, older, never, filed]);
  expect(lines.at(-1)).toBe(`Last met is read from 2 run(s) kept in ${root}.`);

  // With no journals, it says so rather than calling every one unmet.
  const alone = knownFile([finding(met)]);
  expect(journalsBeside(alone)).toBeUndefined();
  expect(listKnownFindings(alone, undefined).at(-1)).toBe(`No journals beside ${alone}, so when each was last met is not known.`);
});

test("finishJourney hands its findings to the engine's reporter when one is present, and prints nothing", () => {
  const root = scratch('phileas-known-test-');
  const found = runWith([{ signature: 'console-error: handed over', known: false }]);
  const shared = globalThis as Record<symbol, unknown>;
  process.env[SEED_VARIABLE] = 'handed-seed';
  shared[Symbol.for('phileas.reporterPresent')] = true;
  const printed: string[] = [];
  const log = console.log;
  console.log = (...args: unknown[]) => void printed.push(args.join(' '));
  try {
    const { run } = startJourney(defineJourney({ routes: 1, tripLength: 1 }), buggy);
    const folder = journalFolder(root, 'handed-seed', run);
    fs.mkdirSync(folder, { recursive: true });
    fs.copyFileSync(path.join(found, 'route-001-abc.jsonl'), path.join(folder, 'route-001-abc.jsonl'));
    printed.length = 0;
    finishJourney({ journalsRoot: root, knownFindings: path.join(root, 'known-findings.json') });
  } finally {
    console.log = log;
    delete process.env[SEED_VARIABLE];
    delete process.env[RUN_VARIABLE];
    delete shared[Symbol.for('phileas.reporterPresent')];
  }
  const handed = shared[Symbol.for('phileas.journeyEnd')] as { findings: { added: { signature: string }[] }; file: string };
  delete shared[Symbol.for('phileas.journeyEnd')];
  expect(handed.findings.added.map((a) => a.signature)).toEqual(['console-error: handed over']);
  expect(printed.join('\n')).not.toContain('Known findings');
});

// A Route over buggy's planted log error, which writes into the Route's own
// profile, as Positron's logs are written.
const logbookIn = (userDataDir: string) => path.join(userDataDir, 'logbook.log');
const planted: AppUnderTest = {
  ...buggy,
  launchArgs: ['--buggy-plant=log-error'],
  env: (userDataDir) => ({ BUGGY_LOG: logbookIn(userDataDir) }),
  logPaths: (userDataDir) => [logbookIn(userDataDir)],
};
const WRITE = 'Write in the logbook';
const chooser: Chooser = {
  choose: (candidates) => {
    const target = candidates.find((candidate) => candidate.name === WRITE) ?? candidates[0];
    if (!target) throw new Error('nothing on offer');
    return { target };
  },
};
const LOGBOOK = 'log-error: logbook.log: ERROR the logbook page is torn';

const route = createTest(planted);
route.afterEach(removeScratch);

async function travel(page: Parameters<typeof runRoute>[0]['page'], app: Parameters<typeof runRoute>[0]['app'], userDataDir: string, knownFindings?: string) {
  process.env[RUN_VARIABLE] = 'test-run';
  const root = scratch('phileas-known-test-');
  const outcome = await runRoute({
    page,
    app,
    cfg: planted,
    streams: deriveRouteStreams('known', 1),
    journeySeed: 'known',
    routeNumber: 1,
    tripLength: 3,
    journalsRoot: root,
    chooser,
    userDataDir,
    ...(knownFindings ? { knownFindings } : {}),
    hopTimeoutMs: 1_000,
    settleTimeoutMs: 1_000,
    responsiveTimeoutMs: 1_000,
  }).catch((error: unknown) => error);
  const folder = journalFolder(root, 'known', 'test-run');
  const journal = readJournal(path.join(folder, fs.readdirSync(folder)[0] ?? ''));
  return { outcome, journal };
}

route('a Route meeting a known finding records it and carries on', async ({ page, app, userDataDir }) => {
  // The timestamp buggy writes is taken out, so the signature is the one below.
  const file = knownFile([finding(LOGBOOK, 'ronplusron/phileas#99')]);
  const { outcome, journal } = await travel(page, app, userDataDir, file);

  expect(outcome).toMatchObject({ kind: 'passed', hops: 3 });
  const hops = journal.filter((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
  const logCheck = hops[0]?.checks.find((check) => check.check === 'log-error');
  expect(logCheck?.result).toBe('passed');
  expect(logCheck?.findings).toEqual([
    {
      id: findingId(LOGBOOK),
      signature: LOGBOOK,
      known: true,
      issue: 'ronplusron/phileas#99',
      // A log line is known only to have been written between two reads.
      seenAfter: expect.any(String),
      seenBefore: expect.any(String),
    },
  ]);
  const opening = journal.find((entry) => entry.kind === 'route');
  expect(opening).toMatchObject({ knownFindings: { entries: 1 } });
});

route('the same Route with no known findings ends there, naming the finding', async ({ page, app, userDataDir }) => {
  // The control for the test above: the planted error does end a Route.
  const { outcome } = await travel(page, app, userDataDir);
  expect(outcome).toBeInstanceOf(CheckFailure);
  expect((outcome as CheckFailure).message).toContain(`finding ${findingId(LOGBOOK)}`);
});

// A known renderer error: judged on the Hop, where the Route carries on past
// it, and then left alone by the page fixture at the test's end. It used to be
// judged a second time there, ignoring known findings, so the Route passed and
// the test failed anyway.
const thrower: AppUnderTest = { ...buggy, launchArgs: ['--buggy-plant=renderer-throw'] };
const WEIGH = 'Weigh the trunk';
const weighs: Chooser = {
  choose: (candidates) => {
    const target = candidates.find((candidate) => candidate.name === WEIGH);
    if (!target) throw new Error(`${WEIGH} is not on offer`);
    return { target };
  },
};
const throwing = createTest(thrower);
throwing.afterEach(removeScratch);

throwing('a known renderer error lets the Route carry on and the test pass', async ({ page, app }) => {
  process.env[RUN_VARIABLE] = 'test-run';
  const common = {
    page,
    app,
    cfg: thrower,
    routeNumber: 1,
    chooser: weighs,
    hopTimeoutMs: 1_000,
    settleTimeoutMs: 1_000,
    responsiveTimeoutMs: 1_000,
  };

  // First with nothing known, to learn the finding's signature from the
  // failure itself rather than restating how signatures are made.
  const first = await runRoute({
    ...common,
    streams: deriveRouteStreams('renderer-unknown', 1),
    journeySeed: 'renderer-unknown',
    tripLength: 1,
    journalsRoot: scratch('phileas-known-test-'),
  }).catch((error: unknown) => error);
  expect(first).toBeInstanceOf(CheckFailure);
  const signature = (first as CheckFailure).failed[0]?.findings?.[0]?.signature ?? '';
  expect(signature).toMatch(/^uncaught-error: renderer: (?!renderer: )/);

  const outcome = await runRoute({
    ...common,
    streams: deriveRouteStreams('renderer-known', 1),
    journeySeed: 'renderer-known',
    tripLength: 3,
    journalsRoot: scratch('phileas-known-test-'),
    knownFindings: knownFile([finding(signature)]),
  });
  expect(outcome).toMatchObject({ kind: 'passed', hops: 3 });
  // The test passing at its end is the other half: the fixture did not judge
  // the four watched errors again.
});

// A known hang still ends the Route (R16): a hung application cannot be
// traveled, so being known changes how it is counted and nothing else.
const hanger: AppUnderTest = { ...buggy, launchArgs: ['--buggy-plant=renderer-hang'] };
const hanging = createTest(hanger);
hanging.afterEach(removeScratch);

hanging('a known hang still ends the Route, recorded as known', async ({ page, app }) => {
  process.env[RUN_VARIABLE] = 'test-run';
  const TIDE = 'Wait for the tide';
  // Both of what the hang shows, so that nothing unknown is left to end the
  // Route: the stalled click, and the round trip after it.
  const signature = signatureOf('still-responding', 'the renderer did not answer within 1000 ms');
  const stalled = signatureOf(
    'still-responding',
    `hop 1's click on button "${TIDE}" was bounded to 1000 ms and had not returned after 2001 ms: the application stopped answering`
  );
  const outcome = await runRoute({
    page,
    app,
    cfg: hanger,
    streams: deriveRouteStreams('known-hang', 1),
    journeySeed: 'known-hang',
    routeNumber: 1,
    tripLength: 3,
    journalsRoot: scratch('phileas-known-test-'),
    chooser: {
      choose: (candidates) => {
        const target = candidates.find((candidate) => candidate.name === TIDE);
        if (!target) throw new Error(`${TIDE} is not on offer`);
        return { target };
      },
    },
    knownFindings: knownFile([finding(signature), finding(stalled)]),
    hopTimeoutMs: 1_000,
    settleTimeoutMs: 1_000,
    responsiveTimeoutMs: 1_000,
  }).catch((error: unknown) => error);

  expect(outcome).toBeInstanceOf(CheckFailure);
  const check = (outcome as CheckFailure).failed.find((failed) => failed.check === 'still-responding');
  // Every violation was known, so this failure is the rule and nothing else.
  expect(check?.findings?.length).toBeGreaterThan(0);
  expect(check?.findings?.every((found) => found.known)).toBe(true);
});

test('a hand-edited finding whose id no longer matches its signature is refused by name', () => {
  const signature = 'console-error: the tickets could not be checked';
  expect(readKnownFindings(knownFile([finding(signature)])).entries).toHaveLength(1);
  // Edited in the file after it was written, so the id a Route prints and the
  // id `phileas known add` matches would differ.
  const edited = { ...finding(signature), signature: 'console-error: the tickets could not be read' };
  expect(() => readKnownFindings(knownFile([edited]))).toThrow(/Known finding 1 .* was the signature edited\?/);
  expect(() => readKnownFindings(knownFile([{ ...finding(signature), source: 'someone' } as unknown as KnownFinding]))).toThrow(
    /neither journey nor command/
  );
});

test('filing a finding keeps where it came from', () => {
  const file = knownFile([finding('console-error: the tickets could not be checked')]);
  const id = findingId('console-error: the tickets could not be checked');
  expect(markFiled(file, id, 'ronplusron/phileas#7')).toMatchObject({ source: 'journey', issue: 'ronplusron/phileas#7' });
});

test("a Journey's end refuses a run it cannot read, rather than calling every finding unseen", () => {
  const root = scratch('phileas-known-test-');
  const file = knownFile([finding('console-error: the tickets could not be checked')]);
  // Both ways a run's folder goes missing are named, so a Journey whose Routes
  // all failed early is not sent to check a setting that is correct.
  expect(() => recordJourneyFindings(path.join(root, 'absent'), file)).toThrow(
    /No Route wrote a journal at .*every Route failed before its first Hop.*journalsRoot is not where the spec writes/
  );

  const empty = path.join(root, 'empty');
  fs.mkdirSync(empty);
  expect(() => recordJourneyFindings(empty, file)).toThrow(/holds no journals/);

  // A broken last line is a Route that died mid-write, and is read up to it;
  // a broken line with more after it is damage, and refused.
  const run = path.join(root, 'run');
  fs.mkdirSync(run);
  const good = JSON.stringify({ kind: 'trip-hop', checks: [] });
  fs.writeFileSync(path.join(run, 'route-001-a.jsonl'), `${good}\n{"kind": "trip-h`);
  expect(recordJourneyFindings(run, file).notSeen).toHaveLength(1);
  fs.writeFileSync(path.join(run, 'route-002-b.jsonl'), `{"kind": "trip-h\n${good}\n`);
  expect(() => recordJourneyFindings(run, file)).toThrow(/Line 1 of .*route-002-b\.jsonl is not valid JSON, and lines follow it/);
});

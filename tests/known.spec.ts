import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { buggy } from '../testbed/buggy/phileas/adapter/index';
import {
  CheckFailure,
  RUN_VARIABLE,
  SEED_VARIABLE,
  createTest,
  deriveRouteStreams,
  findingId,
  finishJourney,
  journalFolder,
  markFiled,
  readJournal,
  readKnownFindings,
  recordJourneyFindings,
  renderJourneyFindings,
  runRoute,
  signatureOf,
  type AppUnderTest,
  type Chooser,
  type KnownFinding,
  type TripHopEntry,
} from '../src/index';
import { parse } from '../bin/phileas.mjs';
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
  "/var/folders/z3/2pspvgp54fb7n5339skyhfsc0000gn/T/phileas-positron-Y2Bp11/logs/window1/exthost/exthost.log: 2026-09-26 20:03:03.448 [error] An error occurred when deactivating the extension 'positron.positron-connections':",
  "/var/folders/z3/2pspvgp54fb7n5339skyhfsc0000gn/T/phileas-positron-hKzIxA/logs/window1/exthost/exthost.log: 2026-09-27 02:37:59.900 [error] An error occurred when deactivating the extension 'positron.positron-connections':",
];

test('two runs of the same bug have the same signature, and what varies is taken out', () => {
  const [first, second] = ISSUE_44.map((line) => signatureOf('log-error', line));
  expect(first).toBe(
    "log-error: exthost.log: [error] An error occurred when deactivating the extension 'positron.positron-connections':"
  );
  expect(second).toBe(first);
  expect(findingId(first as string)).toBe(findingId(second as string));
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
  expect(printed).toMatch(/not seen this Journey, possibly fixed or not reached: \w{8} {2}unfiled {2}console-error: not seen/);
  expect(printed).toContain('phileas known add <id> --issue <issue>');
});

test("finishJourney finds the Journey's run by its seed and run name", () => {
  const root = scratch('phileas-known-test-');
  process.env[SEED_VARIABLE] = 'known-seed';
  process.env[RUN_VARIABLE] = 'known-run';
  try {
    const run = journalFolder(root, 'known-seed', 'known-run');
    fs.mkdirSync(run, { recursive: true });
    fs.copyFileSync(path.join(runWith([{ signature: 'console-error: from the run', known: false }]), 'route-001-abc.jsonl'), path.join(run, 'route-001-abc.jsonl'));
    const file = path.join(root, 'known-findings.json');

    expect(finishJourney({ journalsRoot: root, knownFindings: file }).added.map((a) => a.signature)).toEqual([
      'console-error: from the run',
    ]);
  } finally {
    delete process.env[SEED_VARIABLE];
    delete process.env[RUN_VARIABLE];
  }
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
  expect(() => parse(['known', 'list'])).toThrow(/known takes add/);
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
  expect(logCheck?.findings).toEqual([{ id: findingId(LOGBOOK), signature: LOGBOOK, known: true, issue: 'ronplusron/phileas#99' }]);
  const opening = journal.find((entry) => entry.kind === 'route');
  expect(opening).toMatchObject({ knownFindings: { entries: 1 } });
});

route('the same Route with no known findings ends there, naming the finding', async ({ page, app, userDataDir }) => {
  // The control for the test above: the planted error does end a Route.
  const { outcome } = await travel(page, app, userDataDir);
  expect(outcome).toBeInstanceOf(CheckFailure);
  expect((outcome as CheckFailure).message).toContain(`finding ${findingId(LOGBOOK)}`);
});

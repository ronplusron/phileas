import { test, expect } from '@playwright/test';
import { CheckFailure, type JournaledCheck } from '../src/index';
import {
  LOG_TIME_SLACK_MS,
  arrivalFields,
  arrivalOf,
  describePlaced,
  placeArrival,
  stepAt,
  stepsBefore,
  type StepSpan,
} from '../src/timeline';

/**
 * When a finding arrived, and the failure that says so, without launching
 * anything.
 *
 * **The case these exist for was measured on RStudio on 2026-09-29.** A Route
 * answered Yes to installing a package at hop 27, the install logged an error
 * 5.6 s later, during hop 32, and the Route failed "after hop 32, which acted
 * on" a button that triggers a different known bug. The steps below are that
 * Route's, from its journal, so each case is the real shape rather than an
 * imagined one. `checks.spec.ts` has the same thing through a real Route.
 */

const T = Date.parse('2026-09-29T14:49:40.000Z');
const at = (iso: string) => Date.parse(`2026-09-29T${iso}Z`);

// Hops 26 to 32 of that Route, started and ended as its journal recorded them.
const ROUTE: StepSpan[] = [
  { name: 'Fix step 1', what: 'new R script', startedAt: T, endedAt: T + 900 },
  { name: 'hop 26', what: 'click button "ODBC"', startedAt: at('14:49:46.668'), endedAt: at('14:49:47.380') },
  { name: 'hop 27', what: 'click button "Yes"', startedAt: at('14:49:47.413'), endedAt: at('14:49:47.890') },
  { name: 'hop 28', what: 'menu-click menu View > Zoom Environment', startedAt: at('14:49:47.920'), endedAt: at('14:49:48.350') },
  { name: 'hop 29', what: 'click button "Cancel"', startedAt: at('14:49:48.386'), endedAt: at('14:49:50.500') },
  { name: 'hop 30', what: 'click button "R"', startedAt: at('14:49:50.546'), endedAt: at('14:49:51.380') },
  { name: 'hop 31', what: 'menu-click menu View > Show Find in Files', startedAt: at('14:49:51.409'), endedAt: at('14:49:51.890') },
  {
    name: 'hop 32',
    what: 'click button "Refresh Find in Files results"',
    startedAt: at('14:49:51.922'),
    endedAt: at('14:49:55.422'),
    abandoned: true,
  },
];
const LOGGED = at('14:49:52.997');

test('an arrival the engine saw is a moment by its clock', () => {
  expect(placeArrival({ at: LOGGED })).toEqual({ kind: 'moment', at: LOGGED, by: 'engine' });
  expect(placeArrival({})).toBeUndefined();
});

test("a log line is a moment by the log's own time when that falls within the reads around it", () => {
  const reads = { after: at('14:49:51.890'), before: at('14:49:55.400') };
  expect(placeArrival({ ...reads, loggedAt: LOGGED })).toEqual({ kind: 'moment', at: LOGGED, by: 'log' });
  // A log stamping whole seconds writes a time up to a second early.
  expect(placeArrival({ ...reads, loggedAt: reads.after - LOG_TIME_SLACK_MS })).toMatchObject({ by: 'log' });
});

test("a log line is only a span when the log gives no time, or one its clock cannot back", () => {
  const reads = { after: at('14:49:51.890'), before: at('14:49:55.400') };
  expect(placeArrival(reads)).toEqual({ kind: 'span', from: reads.after, to: reads.before });
  // A time with no zone parsed as local, four hours off here: kept to print, never trusted.
  const hoursOff = LOGGED + 4 * 3_600_000;
  expect(placeArrival({ ...reads, loggedAt: hoursOff })).toEqual({
    kind: 'span',
    from: reads.after,
    to: reads.before,
    untrustedLogTime: hoursOff,
  });
});

test('a moment falls during a step, between two, or before the first', () => {
  expect(stepAt(LOGGED, ROUTE)).toBe('during hop 32, 1.1 s after it started');
  // Between hop 31's line being written and hop 32's start is the survey.
  expect(stepAt(at('14:49:51.900'), ROUTE)).toBe('between hop 31 and hop 32, 0.0 s after hop 31 ended');
  expect(stepAt(T - 1, ROUTE)).toBe('before the first step');
  expect(stepAt(at('14:49:56.000'), ROUTE)).toBe('after hop 32 ended');
  // A step still running has no end yet, and holds every moment after its start.
  const running = [...ROUTE.slice(0, -1), { ...ROUTE[ROUTE.length - 1], endedAt: undefined } as StepSpan];
  expect(stepAt(at('14:49:59.000'), running)).toBe('during hop 32, 7.1 s after it started');
});

test('a span names the steps that ran while the line could have been written, and why it is a span', () => {
  const span = placeArrival({ after: at('14:49:47.000'), before: at('14:49:48.000') });
  expect(span && describePlaced(span, ROUTE)).toBe(
    'between 14:49:47.000Z and 14:49:48.000Z, while hop 26 to hop 28 ran; the log gave no time the engine could read'
  );
  const untrusted = placeArrival({ after: at('14:49:47.000'), before: at('14:49:48.000'), loggedAt: T - 3_600_000 });
  expect(untrusted && describePlaced(untrusted, ROUTE)).toContain(
    "the log's own time, 2026-09-29T13:49:40.000Z, falls outside that, so its clock is not this one"
  );
});

test('the steps before a moment are listed latest first, capped, with a Hop that gave up marked', () => {
  const lines = stepsBefore(LOGGED, ROUTE, 7);
  expect(lines).toHaveLength(7);
  expect(lines[0]).toBe('hop 32  started  1.1 s before  click button "Refresh Find in Files results"  (gave up)');
  // The step that caused it, five back, is in the list: the reason for listing any.
  expect(lines[5]).toBe('hop 27  started  5.6 s before  click button "Yes"');
  expect(lines[6]).toContain('hop 26');
  // A Fix step is a step like any other, and is listed when the count reaches it.
  expect(stepsBefore(LOGGED, ROUTE).at(-1)).toContain('Fix step 1');
  // Nothing that started after the moment.
  expect(stepsBefore(at('14:49:48.000'), ROUTE)[0]).toContain('hop 28');
});

test('the times on a finding go into the journal and come back unchanged', () => {
  const arrival = { after: at('14:49:51.890'), before: at('14:49:55.400'), loggedAt: LOGGED };
  const fields = arrivalFields(arrival);
  expect(fields).toEqual({
    seenAfter: '2026-09-29T14:49:51.890Z',
    seenBefore: '2026-09-29T14:49:55.400Z',
    loggedAt: '2026-09-29T14:49:52.997Z',
  });
  expect(arrivalOf(fields)).toEqual(arrival);
  // A journal written before these fields existed has none, and places nothing.
  expect(placeArrival(arrivalOf({}))).toBeUndefined();
});

/** The failed log check of that Route, with its line logged twice, as it was. */
function logged(extra: NonNullable<JournaledCheck['findings']> = []): JournaledCheck {
  const finding = {
    id: '6f037ab8',
    signature: 'log-error: rsession-<user>.log: ERROR system error 2 (No such file or directory) [path: ]',
    known: false,
    seenAfter: '2026-09-29T14:49:51.890Z',
    seenBefore: '2026-09-29T14:49:55.400Z',
    loggedAt: '2026-09-29T14:49:52.997Z',
  };
  return {
    check: 'log-error',
    result: 'failed',
    observation: 'rsession-ann.log: ERROR system error 2 (No such file or directory) [path: ]',
    findings: [finding, finding, ...extra],
  };
}

test('a failure says where the checks ran and when the finding arrived, and names no cause', () => {
  const message = new CheckFailure('hop 32', [logged()], ROUTE).message;
  expect(message).toContain('A check failed after hop 32, which is when the checks read it.');
  expect(message).toContain("arrived during hop 32, 1.1 s after it started (by the log's own time, 14:49:52.997Z)");
  expect(message).toMatch(/hop 27 +started +5\.6 s before +click button "Yes"/);
  // The claim that was wrong: the Hop the checks ran after, named as what it acted on.
  expect(message).not.toContain('which acted on');
});

test('a finding seen twice is named once, and two findings are both named', () => {
  const once = new CheckFailure('hop 32', [logged()], ROUTE).message;
  expect(once).toContain('finding 6f037ab8\n');
  expect(once).not.toContain('6f037ab8, 6f037ab8');
  // The positive control: a second, different finding on the same check still shows.
  const two = new CheckFailure('hop 32', [logged([{ id: '0a1b2c3d', signature: 'other', known: false }])], ROUTE).message;
  expect(two).toContain('finding 6f037ab8, 0a1b2c3d');
});

test('without the steps, a failure says only where the checks ran', () => {
  const message = new CheckFailure('hop 32', [logged()]).message;
  expect(message).toMatch(/^A check failed after hop 32:\n\n {2}log-error: /);
  expect(message).not.toContain('Steps before it');
});

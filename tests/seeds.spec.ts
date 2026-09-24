import { test, expect } from '@playwright/test';
import {
  createRng,
  deriveRouteSeed,
  deriveRouteStreams,
  defineJourney,
  routeIndices,
  requireSeed,
  resolveSeed,
  generateSeed,
  SEED_VARIABLE,
  resolveRun,
  requireRun,
  RUN_VARIABLE,
  SHORTEST_DEADLINE_MS,
  playwrightTimeouts,
} from '../src/index';

/**
 * The phase 3 boundary, stated as tests.
 *
 * These prove the reproducibility mechanism and nothing about traveling. No
 * Electron is launched and nothing is surveyed; every function under test here
 * is pure, apart from the two that read and write one environment variable.
 *
 * What they are worth: a seeded engine whose seeds do not reproduce reports
 * findings nobody can retrace, and it looks identical to one that works. There
 * is no later phase where that becomes visible on its own, so it is asserted
 * here.
 */

function drawMany(seed: string, count: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng.next());
}

/**
 * Known-answer vectors: the generator's output frozen as literals.
 *
 * Every other test in this file compares the implementation against itself in
 * one process, so all of them pass after any change to the algorithm. Measured
 * rather than assumed: changing the warm-up count from 12 to 13 and the digest
 * from 16 characters to 20 left all fourteen of them green. The whole reason
 * the generator is written in this repository rather than taken as a dependency
 * is that it must produce the same sequence across machines and Node versions,
 * and nothing asserted that.
 *
 * **These literals pin this implementation; they are not an independent
 * oracle.** They were generated from the code they now guard, so they cannot
 * say the algorithm is correct. They say it has not changed, which is the
 * property R13 actually needs. A seed recorded in a report or in DEFECTS.md
 * retraces the same route only while these hold.
 *
 * If one of these fails, the question is whether the change to the generator
 * was intended -- not how to make the literal match. Every seed recorded before
 * the change stops reproducing, and that has to be a decision rather than a
 * repair.
 */
test('the generator produces the sequence it produced when this was written', () => {
  const rng = createRng('travel');
  expect([rng.next(), rng.next(), rng.next()]).toEqual([
    0.003605337580665946, 0.8016686923801899, 0.17208942957222462,
  ]);

  const ints = createRng('range');
  expect([ints.int(7), ints.int(7), ints.int(7)]).toEqual([0, 5, 0]);
});

test('route seeds are derived to the same values they were', () => {
  expect([0, 1, 2].map((index) => deriveRouteSeed('stability', index))).toEqual([
    '0321430daf79314e',
    '1abf7e9d14678865',
    '667536290b279857',
  ]);
});

test('both of a Route\'s streams start where they started', () => {
  const streams = deriveRouteStreams('split', 0);
  expect(streams.routeSeed).toBe('8541bf9b5e3f115e');
  expect([streams.fix.next(), streams.fix.next()]).toEqual([
    0.035913600819185376, 0.5903206907678396,
  ]);
  // Changed on 2026-09-23, deliberately: the second stream was renamed from
  // 'traversal' to 'trip', and its name is hashed into its seed. These values
  // were not copied from what the engine produced after the change. They were
  // computed by a separate implementation of the same algorithm, written in
  // another language and sharing no code with src/random.ts, which first had to
  // reproduce every value pinned in this file before the rename. The Fix
  // stream's values above did not move, and that is part of the check.
  expect([streams.trip.next(), streams.trip.next()]).toEqual([
    0.2970382689964026, 0.29075332870706916,
  ]);
});

test('the same seed gives the same sequence', () => {
  expect(drawMany('travel', 20)).toEqual(drawMany('travel', 20));
});

test('a different seed gives a different sequence', () => {
  // Not a guarantee of the algorithm, but a collision here would mean the seed
  // is not reaching the generator state at all, which is the mistake worth
  // catching.
  expect(drawMany('travel', 20)).not.toEqual(drawMany('travels', 20));
});

test('draws stay inside their stated range', () => {
  const rng = createRng('range');
  for (let i = 0; i < 500; i += 1) {
    const next = rng.next();
    expect(next).toBeGreaterThanOrEqual(0);
    expect(next).toBeLessThan(1);
    expect(rng.int(7)).toBeLessThan(7);
  }
});

test('int and pick refuse an empty range rather than inventing one', () => {
  const rng = createRng('empty');
  expect(() => rng.int(0)).toThrow(/at least 1/);
  expect(() => rng.int(2.5)).toThrow(/whole number/);
  expect(() => rng.pick([])).toThrow(/empty list/);
});

test("route k's stream is unaffected by whether the routes before it ran", () => {
  const journeySeed = 'independence';

  // Route 3 drawn on its own, as a replay of one Route would.
  const alone = deriveRouteStreams(journeySeed, 3);
  const aloneDraws = Array.from({ length: 10 }, () => alone.trip.next());

  // Route 3 drawn after routes 0 through 2 have each spent draws, as it would
  // be inside a full Journey. One shared stream across Routes would make these
  // two differ, and every Route would still pass.
  for (let index = 0; index < 3; index += 1) {
    const earlier = deriveRouteStreams(journeySeed, index);
    for (let draw = 0; draw < 50; draw += 1) {
      earlier.trip.next();
      earlier.fix.next();
    }
  }
  const inJourney = deriveRouteStreams(journeySeed, 3);
  const inJourneyDraws = Array.from({ length: 10 }, () => inJourney.trip.next());

  expect(inJourneyDraws).toEqual(aloneDraws);
});

test('consuming from the Fix stream leaves the Trip stream unchanged', () => {
  const untouched = deriveRouteStreams('split', 0);
  const expected = Array.from({ length: 10 }, () => untouched.trip.next());

  // A Fix edited to make one more draw is the case this protects: without the
  // split, every Trip draw after it shifts, and a recorded failing seed
  // stops reproducing while reading as a fixed bug.
  const consumed = deriveRouteStreams('split', 0);
  for (let i = 0; i < 37; i += 1) consumed.fix.next();
  const after = Array.from({ length: 10 }, () => consumed.trip.next());

  expect(after).toEqual(expected);
});

test('the Fix and Trip streams are not the same stream', () => {
  const streams = deriveRouteStreams('split', 0);
  const fix = Array.from({ length: 10 }, () => streams.fix.next());
  const trip = Array.from({ length: 10 }, () => streams.trip.next());
  expect(fix).not.toEqual(trip);
});

test('each route index gets its own seed, stable across runs', () => {
  const seeds = [0, 1, 2, 3, 4].map((index) => deriveRouteSeed('stability', index));
  expect(new Set(seeds).size).toBe(seeds.length);
  expect(seeds).toEqual([0, 1, 2, 3, 4].map((index) => deriveRouteSeed('stability', index)));
});

test('a route seed refuses an index that is not a route', () => {
  expect(() => deriveRouteSeed('seed', -1)).toThrow(/at least 0/);
  expect(() => deriveRouteSeed('seed', 1.5)).toThrow(/whole number/);
});

test('a Journey refuses terms that cannot fail', () => {
  expect(() => defineJourney({ routes: 0, tripLength: 10 })).toThrow(/routes/);
  expect(() => defineJourney({ routes: 5, tripLength: 0 })).toThrow(/tripLength/);
  expect(() => defineJourney({ routes: 5, tripLength: 10, seed: '' })).toThrow(/empty string/);
});

test('a Journey registers one index per Route', () => {
  const journey = defineJourney({ routes: 4, tripLength: 10 });
  expect(routeIndices(journey)).toEqual([0, 1, 2, 3]);
});

test('requireSeed returns the seed that was settled, not a fresh one', () => {
  const before = process.env[SEED_VARIABLE];
  try {
    process.env[SEED_VARIABLE] = 'settled-for-this-run';
    expect(requireSeed()).toBe('settled-for-this-run');

    // Twice, because a requireSeed that generated on each call would satisfy a
    // single read against whatever it had just written. Measured: replacing the
    // return with a freshly generated seed left every test in this file green.
    expect(requireSeed()).toBe(requireSeed());
  } finally {
    if (before === undefined) delete process.env[SEED_VARIABLE];
    else process.env[SEED_VARIABLE] = before;
  }
});

test('both deadlines are optional, and leaving them out means no limit', () => {
  // The common case: a Journey takes as long as its Routes take.
  const unbounded = defineJourney({ routes: 5, tripLength: 10 });
  expect(unbounded.journeyDeadlineMs).toBeUndefined();
  expect(unbounded.routeDeadlineMs).toBeUndefined();
});

test('a deadline that is a count rather than a duration is refused, for either', () => {
  // One millisecond passed the original check, which was the same whole-number
  // test the two counts use. The deadline then expires before the first
  // application has launched: every Route unfinished and nothing wrong.
  for (const name of ['journeyDeadlineMs', 'routeDeadlineMs'] as const) {
    expect(() => defineJourney({ routes: 5, tripLength: 10, [name]: 1 })).toThrow(
      /duration in milliseconds/
    );
    expect(() =>
      defineJourney({ routes: 5, tripLength: 10, [name]: SHORTEST_DEADLINE_MS })
    ).not.toThrow();
  }
});

test('a zero deadline is refused rather than read as no limit', () => {
  // Playwright reads zero as no limit, and allowing it here would give one value
  // two meanings: a reader could not tell no limit from a mistake. No limit is
  // said by leaving the deadline out, and the refusal says so.
  for (const name of ['journeyDeadlineMs', 'routeDeadlineMs'] as const) {
    expect(() => defineJourney({ routes: 5, tripLength: 10, [name]: 0 })).toThrow(
      /leave it out for no limit/
    );
  }
});

test('an unset deadline reaches Playwright as zero, never as its default', () => {
  // The case the helper exists for. A Route deadline left out of a Playwright
  // configuration means Playwright's thirty-second default, which cuts long
  // Routes off; it has to arrive as an explicit zero to mean no limit.
  expect(playwrightTimeouts(defineJourney({ routes: 1, tripLength: 1 }))).toEqual({
    timeout: 0,
    globalTimeout: 0,
  });

  // And a stated one reaches the right setting, not the other.
  expect(
    playwrightTimeouts(
      defineJourney({
        routes: 1,
        tripLength: 1,
        journeyDeadlineMs: 600_000,
        routeDeadlineMs: 90_000,
      })
    )
  ).toEqual({ timeout: 90_000, globalTimeout: 600_000 });
});

test('a missing seed is an error, never an invented one', () => {
  const before = process.env[SEED_VARIABLE];
  try {
    delete process.env[SEED_VARIABLE];
    expect(() => requireSeed()).toThrow(/is not set/);
  } finally {
    if (before === undefined) delete process.env[SEED_VARIABLE];
    else process.env[SEED_VARIABLE] = before;
  }
});

test('a pinned seed wins over the environment, which wins over a fresh one', () => {
  const before = process.env[SEED_VARIABLE];
  try {
    process.env[SEED_VARIABLE] = 'from-the-environment';
    expect(resolveSeed('pinned-for-replay')).toBe('pinned-for-replay');

    process.env[SEED_VARIABLE] = 'from-the-environment';
    expect(resolveSeed()).toBe('from-the-environment');

    delete process.env[SEED_VARIABLE];
    const generated = resolveSeed();
    expect(generated).toMatch(/^[0-9a-f]{12}$/);
    // Settled, not merely returned: the workers read it from here.
    expect(process.env[SEED_VARIABLE]).toBe(generated);
  } finally {
    if (before === undefined) delete process.env[SEED_VARIABLE];
    else process.env[SEED_VARIABLE] = before;
  }
});

test('generated seeds differ', () => {
  const seeds = new Set(Array.from({ length: 50 }, () => generateSeed()));
  expect(seeds.size).toBe(50);
});

test('every run gets a fresh name, even with one left in the environment', () => {
  // A run name left over in a shell must not send a second run's journals into
  // the first run's folder, which is the defect this closes.
  const before = process.env[RUN_VARIABLE];
  try {
    process.env[RUN_VARIABLE] = 'left-over-from-an-earlier-run';
    const run = resolveRun(new Date('2026-09-24T09:12:33.456Z'));
    expect(run).toBe('2026-09-24T09-12-33-456Z');
    expect(process.env[RUN_VARIABLE]).toBe(run);
    expect(requireRun()).toBe(run);

    // Names sort in the order the runs happened, and hold nothing a file name
    // cannot.
    const later = resolveRun(new Date('2026-09-24T09:12:33.457Z'));
    expect([later, run].sort()).toEqual([run, later]);
    expect(later).not.toMatch(/[:/\\]/);
  } finally {
    if (before === undefined) delete process.env[RUN_VARIABLE];
    else process.env[RUN_VARIABLE] = before;
  }
});

test('a missing run name is an error, never an invented one', () => {
  const before = process.env[RUN_VARIABLE];
  try {
    delete process.env[RUN_VARIABLE];
    expect(() => requireRun()).toThrow(/is not set/);
  } finally {
    if (before === undefined) delete process.env[RUN_VARIABLE];
    else process.env[RUN_VARIABLE] = before;
  }
});

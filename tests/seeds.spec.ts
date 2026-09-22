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
  const aloneDraws = Array.from({ length: 10 }, () => alone.traversal.next());

  // Route 3 drawn after routes 0 through 2 have each spent draws, as it would
  // be inside a full Journey. One shared stream across Routes would make these
  // two differ, and every Route would still pass.
  for (let index = 0; index < 3; index += 1) {
    const earlier = deriveRouteStreams(journeySeed, index);
    for (let draw = 0; draw < 50; draw += 1) {
      earlier.traversal.next();
      earlier.fix.next();
    }
  }
  const inJourney = deriveRouteStreams(journeySeed, 3);
  const inJourneyDraws = Array.from({ length: 10 }, () => inJourney.traversal.next());

  expect(inJourneyDraws).toEqual(aloneDraws);
});

test('consuming from the Fix stream leaves the traversal stream unchanged', () => {
  const untouched = deriveRouteStreams('split', 0);
  const expected = Array.from({ length: 10 }, () => untouched.traversal.next());

  // A Fix edited to make one more draw is the case this protects: without the
  // split, every traversal draw after it shifts, and a recorded failing seed
  // stops reproducing while reading as a fixed bug.
  const consumed = deriveRouteStreams('split', 0);
  for (let i = 0; i < 37; i += 1) consumed.fix.next();
  const after = Array.from({ length: 10 }, () => consumed.traversal.next());

  expect(after).toEqual(expected);
});

test('the Fix and traversal streams are not the same stream', () => {
  const streams = deriveRouteStreams('split', 0);
  const fix = Array.from({ length: 10 }, () => streams.fix.next());
  const traversal = Array.from({ length: 10 }, () => streams.traversal.next());
  expect(fix).not.toEqual(traversal);
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
  expect(() => defineJourney({ routes: 0, hopsPerRoute: 10, deadlineMs: 1000 })).toThrow(/routes/);
  expect(() => defineJourney({ routes: 5, hopsPerRoute: 0, deadlineMs: 1000 })).toThrow(
    /hopsPerRoute/
  );
  expect(() => defineJourney({ routes: 5, hopsPerRoute: 10, deadlineMs: 0 })).toThrow(/deadlineMs/);
  expect(() => defineJourney({ routes: 5, hopsPerRoute: 10, deadlineMs: 1000, seed: '' })).toThrow(
    /empty string/
  );
});

test('a Journey registers one index per Route', () => {
  const journey = defineJourney({ routes: 4, hopsPerRoute: 10, deadlineMs: 1000 });
  expect(routeIndices(journey)).toEqual([0, 1, 2, 3]);
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

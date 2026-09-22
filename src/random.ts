import { createHash } from 'node:crypto';

/**
 * The only source of randomness in the engine.
 *
 * Nothing in src/ calls the platform's own unseeded generator, and
 * tests/no-math-random.spec.ts fails if anything starts to. A single unseeded
 * draw anywhere in the traversal would make every recorded seed reproduce a
 * different route, and nothing would look wrong: the Journey would still pass,
 * the report would still name a seed, and the seed would be worthless. That is
 * R13's failure arriving silently, which is why the check is mechanical rather
 * than a convention.
 *
 * The generator is written here rather than taken as a dependency. It has to
 * produce the same sequence across machines and Node versions, and a
 * dependency's algorithm can change under a version bump, which would be the
 * same failure arriving from outside the code. The derivation uses Node's own
 * SHA-256, which is stable by definition.
 */

/** A seedable source of draws. Deterministic given its seed. */
export interface Rng {
  /** The next draw, in [0, 1). */
  next(): number;

  /** An integer in [0, maxExclusive). Throws if maxExclusive is not >= 1. */
  int(maxExclusive: number): number;

  /** One item, drawn uniformly. Throws on an empty list. */
  pick<T>(items: readonly T[]): T;
}

/**
 * The two independent streams a Route draws from.
 *
 * Separate generators rather than one, because a Fix and the traversal must not
 * share a position. Editing a Fix so that it consumes one more draw would
 * otherwise shift every draw the traversal makes afterwards, and routes that
 * used to fail would stop reproducing. A recorded failing seed that no longer
 * reproduces reads as a fixed bug, which is worse than never having recorded
 * it.
 */
export interface RouteStreams {
  /** The seed these streams came from, for the report and for a replay. */
  routeSeed: string;

  /** Draws made while following the Fix. */
  fix: Rng;

  /** Draws made while traveling. */
  traversal: Rng;
}

/**
 * sfc32, seeded from four 32-bit words.
 *
 * Small, fast, and entirely integer arithmetic, so it gives the same sequence
 * on any machine that agrees about 32-bit integers. Chosen for being short
 * enough to read in one sitting: the whole reproducibility guarantee rests on
 * this function, so it should be verifiable by eye rather than trusted.
 */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function draw(): number {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4_294_967_296;
  };
}

/**
 * A separator that cannot occur inside a seed or a route index, so that the
 * parts ('ab', 1) and ('a', 'b1') cannot hash to the same digest.
 *
 * Written as an escape rather than typed literally: a raw control character in
 * a source file makes git treat it as binary and hides it from every search.
 */
const SEPARATOR = '\u0000';

/**
 * Hash arbitrary text to a hex digest.
 *
 * Sixteen characters, which is sixty-four bits: far more than enough to keep
 * one Journey's route seeds apart, and short enough that a seed printed in a
 * report can be retyped without transcription errors. Reproducibility depends
 * on the digest being stable, not on it being long.
 */
function digest(...parts: readonly (string | number)[]): string {
  const hash = createHash('sha256');
  hash.update(parts.join(SEPARATOR));
  return hash.digest('hex').slice(0, 16);
}

/**
 * Build a generator from a seed.
 *
 * The seed is text rather than a number, because it is meant to be copied out
 * of a report and pasted into a replay. Any text works; the hash is what turns
 * it into generator state.
 */
export function createRng(seed: string): Rng {
  const state = createHash('sha256').update(seed).digest();

  const rng = sfc32(
    state.readUInt32BE(0),
    state.readUInt32BE(4),
    state.readUInt32BE(8),
    state.readUInt32BE(12)
  );

  // sfc32 is conventionally advanced a few times before use, so that the first
  // draw does not expose the raw seed state.
  for (let i = 0; i < 12; i += 1) rng();

  return {
    next: rng,

    int(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
        throw new RangeError(
          `int() needs a whole number of at least 1, and was given ${maxExclusive}`
        );
      }
      return Math.floor(rng() * maxExclusive);
    },

    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        // A Route with nothing to choose from is stranded, which is an outcome
        // the traversal reports rather than an error it recovers from. Drawing
        // from an empty list means that outcome was not handled where it should
        // have been.
        throw new RangeError('pick() was given an empty list');
      }
      const chosen = items[Math.floor(rng() * items.length)];
      if (chosen === undefined) {
        throw new RangeError('pick() drew past the end of the list');
      }
      return chosen;
    },
  };
}

/**
 * The seed for one Route, derived from the Journey's seed and its index.
 *
 * Derived rather than drawn from a shared stream. One stream across all Routes
 * would make route 7 reproducible only by replaying routes 1 through 6, which
 * is exactly the dependence between Routes that the design exists to avoid,
 * and it would hide quietly: every Route would still pass, and re-running one
 * on its own would produce a different route than it produced in the Journey.
 */
export function deriveRouteSeed(journeySeed: string, routeIndex: number): string {
  if (!Number.isInteger(routeIndex) || routeIndex < 0) {
    throw new RangeError(`routeIndex must be a whole number of at least 0, got ${routeIndex}`);
  }
  return digest(journeySeed, routeIndex);
}

/**
 * The two streams for one Route.
 *
 * Each stream is seeded from its own digest of the Route's seed, so the two
 * never share a position and consuming from one cannot move the other.
 */
export function deriveRouteStreams(journeySeed: string, routeIndex: number): RouteStreams {
  const routeSeed = deriveRouteSeed(journeySeed, routeIndex);
  return {
    routeSeed,
    fix: createRng(digest(routeSeed, 'fix')),
    traversal: createRng(digest(routeSeed, 'traversal')),
  };
}

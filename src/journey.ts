/**
 * The terms of a Journey, and where its seed comes from.
 *
 * R1: a Journey is a seed, a number of Routes, a maximum number of Hops per
 * Route, and a deadline. Stating those four is enough to repeat the run, which
 * is the whole reason this file holds them together rather than letting them
 * accumulate as arguments.
 *
 * Nothing here travels. The Journey is the run; the Route is the test. This
 * file does not decide what gets explored, and it must not start: `PLAN.md`
 * records planner-assigned route bias as declined, and the place it would
 * reappear is here.
 */

/**
 * What a Journey is defined by.
 *
 * Both deadlines are durations rather than moments in time, because a Journey's
 * definition has to be repeatable. A wall-clock deadline would describe one
 * afternoon and nothing else.
 */
export interface JourneyTerms {
  /**
   * Pinned only for a replay.
   *
   * Left out for an ordinary run, where the seed is resolved once per run by
   * `resolveSeed` instead. A seed written into a journey definition means every
   * run travels the same route, which is a replay rather than exploration.
   */
  seed?: string;

  /** How many Routes to register. Each is a test, with its own verdict. */
  routes: number;

  /**
   * How many Hops each Route's Trip takes, counted in hops, not time.
   *
   * The Trip only: Fix hops come first and do not count toward it, so a Route
   * with a three-step Fix and a Trip length of 20 takes 23 hops. A Route that
   * completes its Trip has finished. One that runs out of moves first is
   * stranded, which is why this is a length the Route is meant to reach rather
   * than a ceiling it may stop short of.
   */
  tripLength: number;

  /**
   * How long the whole Journey may run, in milliseconds from its start.
   *
   * Optional, and left out means no limit, which is the common case: a Journey
   * takes as long as its Routes take. That is still bounded, by the number of
   * Routes and their Trip length, just not by the clock. When one is set and
   * passes, the Routes that finished are reported, the one running is cut off,
   * and the rest never start (R4).
   */
  journeyDeadlineMs?: number;

  /**
   * How long one Route may run, in milliseconds from its start.
   *
   * Optional, and left out means no limit. Stated rather than derived from the
   * Trip length, because how long a Hop takes depends on the application, and a
   * formula guessing it cut Routes off as timeouts instead of reporting what
   * they found. Every Trip hop is already bounded by its own action and settle
   * limits; the part a Route deadline guards is the Fix, which is the Journey
   * author's own code and can wait on anything.
   */
  routeDeadlineMs?: number;
}

/**
 * The shortest deadline either the Journey or a Route may be given.
 *
 * A second is not a useful Journey or Route and is not meant to be. It is low enough to
 * accept anything deliberate and high enough to reject a duration that was
 * meant to be a count.
 */
export const SHORTEST_DEADLINE_MS = 1_000;

declare const checked: unique symbol;

/**
 * A Journey whose terms have been checked.
 *
 * Branded, so that `defineJourney` is the only way to make one. TypeScript's
 * types are structural and `readonly` does not affect assignability, so
 * `Readonly<JourneyTerms>` alone let a hand-written object typecheck as a
 * Journey and skip every check below: `{ routes: 0, tripLength: 0 }` compiled,
 * registered no tests at all, and reported green having traveled nowhere. That
 * is the failure the comment on `defineJourney` calls the one this engine is
 * least able to notice about itself, and the validation guarding against it was
 * entirely optional.
 *
 * The brand is a compile-time marker and nothing exists at run time. Taken
 * deliberately as an API decision while no consumer writes a Journey by hand.
 */
export type Journey = Readonly<JourneyTerms> & { readonly [checked]: true };

/**
 * Check a Journey's terms and freeze them.
 *
 * The checks are deliberately unforgiving. A Journey of zero Routes, or a Route
 * with a Trip length of zero, passes every test it registers by doing nothing,
 * and reads in a report exactly like a Journey that traveled and found nothing.
 * A run that cannot fail is the failure mode this engine is least able to
 * notice about itself.
 */
export function defineJourney(terms: JourneyTerms): Journey {
  requireWholeNumberAtLeastOne('routes', terms.routes);
  requireWholeNumberAtLeastOne('tripLength', terms.tripLength);

  requireDeadlineIfGiven('journeyDeadlineMs', terms.journeyDeadlineMs);
  requireDeadlineIfGiven('routeDeadlineMs', terms.routeDeadlineMs);

  if (terms.seed !== undefined && terms.seed.length === 0) {
    throw new RangeError('seed was given as an empty string; leave it out instead');
  }

  return Object.freeze({ ...terms }) as Journey;
}

/**
 * Check a deadline, where one was given.
 *
 * A duration, not a count. The same check as the two above would accept one
 * millisecond, which produces a deadline that passes before the first
 * application has launched: every Route unfinished, nothing wrong, and a report
 * that reads like a catastrophe. R27 asks a Journey that could not do what was
 * asked of it to say so, and the cheaper answer is refusing terms that cannot
 * work.
 *
 * Zero is refused too, although Playwright reads zero as no limit. No limit is
 * said by leaving the deadline out, and a zero that meant it would be one value
 * with two meanings: a reader could not tell no limit from a mistake.
 */
function requireDeadlineIfGiven(name: string, value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < SHORTEST_DEADLINE_MS) {
    throw new RangeError(
      `${name} must be a whole number of at least ${SHORTEST_DEADLINE_MS}, got ${value}. ` +
        `It is a duration in milliseconds, not a count; leave it out for no limit.`
    );
  }
}

/**
 * The two deadlines, in the shape Playwright's configuration takes them.
 *
 * Spread into the consumer's Playwright configuration. Playwright reads the
 * Route deadline as its per-test `timeout` and the Journey deadline as its
 * `globalTimeout`, and in both, zero means no limit.
 *
 * **This exists because leaving `timeout` out of a configuration does not mean
 * no limit.** It means Playwright's default of thirty seconds, which cuts a long
 * Route off and reports a timeout instead of whatever it found. A Journey with
 * no Route deadline has to be translated into an explicit zero, and every
 * consumer remembering that on their own is how one of them eventually does not.
 */
export function playwrightTimeouts(journey: Journey): { timeout: number; globalTimeout: number } {
  return {
    timeout: journey.routeDeadlineMs ?? 0,
    globalTimeout: journey.journeyDeadlineMs ?? 0,
  };
}

function requireWholeNumberAtLeastOne(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a whole number of at least 1, got ${value}`);
  }
}

/** The indices a Journey's Routes are registered under. */
export function routeIndices(journey: Journey): number[] {
  return Array.from({ length: journey.routes }, (_, index) => index);
}

/**
 * The environment variable that carries the seed from the run to its workers.
 *
 * Named rather than written inline, because both halves of the mechanism have
 * to agree about it and they run in different processes.
 */
export const SEED_VARIABLE = 'PHILEAS_SEED';

/**
 * Generate a seed.
 *
 * Twelve hex characters: enough that two runs will not collide, short enough to
 * read aloud off a report and type back in.
 */
export function generateSeed(): string {
  // The platform's cryptographic generator rather than its plain one, for the
  // reason random.ts gives. This draw is genuinely unseeded, which is the point
  // of it, and it happens once per run rather than inside any Route.
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Settle the seed for this run. Global setup only.
 *
 * Playwright's workers are separate processes with no channel between them, so
 * a spec file's top-level code runs once per worker. A seed generated there is
 * a different seed in every worker: every Route reports a seed that reproduces
 * nothing, and every Route still passes. Global setup runs once, and what it
 * puts in the environment reaches the workers, which is why the seed is settled
 * here and read inside each Route's body by `requireSeed`.
 *
 * Order: a seed pinned in the journey definition wins, then one already in the
 * environment, which is how a replay is asked for from the command line. Only
 * when neither exists is one generated.
 */
export function resolveSeed(pinned?: string): string {
  const seed = pinned || process.env[SEED_VARIABLE] || generateSeed();
  process.env[SEED_VARIABLE] = seed;
  return seed;
}

/**
 * Read the seed settled for this run. Inside a Route's body only.
 *
 * Throws rather than generating one. A missing seed means the run was started
 * without global setup, and a Route that quietly invented its own would travel
 * somewhere real and report a seed that retraces nothing.
 */
export function requireSeed(): string {
  const seed = process.env[SEED_VARIABLE];
  if (!seed) {
    throw new Error(
      `${SEED_VARIABLE} is not set. The seed is settled once per run by resolveSeed() ` +
        `in global setup and read inside a Route's body. Reading it at a spec file's ` +
        `top level gets a different seed in every Playwright worker.`
    );
  }
  return seed;
}

/**
 * The environment variable that carries this run's name to its workers.
 *
 * The run is named separately from the seed because a seed is replayed and a
 * run is not: two runs of one seed are two runs, and their journals must not
 * land in the same folder.
 */
export const RUN_VARIABLE = 'PHILEAS_RUN';

/**
 * Name this run. Global setup only, for the same reason as `resolveSeed`.
 *
 * Always a fresh name, never one already in the environment. A run name left
 * over in a shell would otherwise send a second run's journals into the first
 * one's folder, which is the defect this exists to close. The name is when the
 * run started, in UTC to the millisecond, with the colons a file name cannot
 * hold replaced, so that folders sort in the order the runs happened.
 */
export function resolveRun(now: Date = new Date()): string {
  const run = now.toISOString().replace(/:/g, '-').replace('.', '-');
  process.env[RUN_VARIABLE] = run;
  return run;
}

/**
 * Read this run's name. Inside a Route's body only.
 *
 * Throws rather than inventing one, for the reason `requireSeed` gives: a
 * worker that named its own run would write its Routes' journals into a folder
 * no other worker of the run shares.
 */
export function requireRun(): string {
  const run = process.env[RUN_VARIABLE];
  if (!run) {
    throw new Error(
      `${RUN_VARIABLE} is not set. The run is named once by resolveRun() in global ` +
        `setup and read inside a Route's body, like the seed.`
    );
  }
  return run;
}

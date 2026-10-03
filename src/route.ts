import { test, type ElectronApplication, type Page } from '@playwright/test';
import type { AppUnderTest } from './app-under-test.js';
import type { Rng, RouteStreams } from './random.js';
import { caughtSince, type CaughtByStubs } from './caught.js';
import { effectOf, type HopEffect } from './effect.js';
import { fixName } from './fixes.js';
import {
  Journal,
  fixFingerprint,
  journalFolder,
  sourceHash,
  type FixStepEntry,
  type HopAction,
  type JournaledCandidate,
  type JournaledCheck,
} from './journal.js';
import { requireRun } from './journey.js';
import { clickMenuItem } from './menu.js';
import { renderEntry, targetText } from './report/render.mjs';
import { readKnownFindings } from './known.mjs';
import { CheckFailure, DEFAULT_RESPONSIVE_TIMEOUT_MS, failedChecks, startWatching, STALLED, type Watch } from './oracles/index.js';
import type { StepSpan } from './timeline.js';
import {
  answered,
  ApplicationStoppedAnswering,
  allowedGroupsFromEnvironment,
  createExclusionTally,
  neverMatched,
  survey,
  NondeterministicExclusion,
  takesTypedValue,
  type SurveyedCandidate,
  type SurveyResult,
  type ExclusionTally,
} from './survey.js';

/**
 * One Route: the Fix, then hops until the Trip is complete or there is nowhere
 * left to go.
 *
 * The Route is the test, not the Journey. That mapping is what gives a Route
 * its own verdict, its own timeout and its own trace, and it is why ten Routes
 * do not share one result where a single failure would take the other nine
 * with it.
 */

/**
 * Choosing the next candidate, as a named seam.
 *
 * There is exactly one implementation and it is a seeded draw, so this reads as
 * ceremony around a single line. It is not. It is what lets a different chooser
 * be added later without the hop loop being rewritten around it, and
 * docs/OUTSTANDING.md section 2.1 records what that later chooser is expected
 * to be. Inlining it is the specific change that turns a cheap addition into an
 * expensive one, which is why ../CLAUDE.md names it at the point somebody would
 * reach for the simplification.
 */
export interface Chooser {
  choose(candidates: readonly SurveyedCandidate[], rng: Rng): Choice | Promise<Choice>;
}

/**
 * What a chooser returns: the target, and the draw that selected it if a draw
 * did.
 *
 * The draw is optional because only a seeded chooser has one. It is recorded in
 * the journal so a replay can name the hop where the seeded sequence broke,
 * including when a broken draw happens to land on the same target, and so the
 * file can be checked on its own: the target is always the entry the draw points
 * at within the side the share draw chose. A chooser that is not a seeded draw has nothing to put here, and
 * leaves it out rather than inventing one.
 */
export interface Choice {
  readonly target: SurveyedCandidate;
  readonly draw?: number;
  /**
   * The draw that decided which side of the pool the Hop was drawn from --
   * the common keys, the menu bar or the page -- where a seeded draw did. See
   * `sideOfShareDraw`.
   */
  readonly shareDraw?: number;
}

/**
 * The default share of Hops that press one of the common keys, when anything
 * else is on offer too. An adapter can set its own as `keyShare`.
 *
 * Chosen on 2026-09-24 as a quarter. Drawn as seven equal candidates among the
 * rest, the keys took 7 Hops in 8 on a screen with one control, crowding out
 * the controls where there are fewest of them. So a first draw decides which
 * side a Hop is drawn from, and a second picks within it. Printed shortcuts are
 * drawn with the controls, since each belongs to one.
 *
 * Cut to an eighth the same day, with the menu given its own eighth, once the
 * rail demo's journals were counted: 138 key hops changed the screen 6 times,
 * against 199 of 306 page hops. An eighth still presses a key about 6 times in
 * a 50-hop Trip, which is what reaches a console's history. Provisional until an
 * IDE is measured; docs/OUTSTANDING.md holds it.
 */
export const DEFAULT_KEY_SHARE = 1 / 8;

/**
 * The default share of Hops that click a menu bar entry, when anything else is
 * on offer too. An adapter can set its own as `menuShare`.
 *
 * Chosen on 2026-09-24, when the menu began to be offered in every window mode.
 * Drawn evenly with the page, it took a share set by how sparse the screen was
 * rather than by anything about the menu: 45% of Hops on trickster-tales'
 * Library screen, whose 15 entries changed the screen in none of the 44 hops
 * its journals hold, and a large application's menu would crowd the page out
 * entirely. Provisional on the same terms as DEFAULT_KEY_SHARE.
 */
export const DEFAULT_MENU_SHARE = 1 / 8;

/** The shares a Route draws its sides with, as a journal records them. */
export interface Shares {
  readonly keyShare: number;
  readonly menuShare: number;
}

/**
 * The shares an adapter asks for, or the defaults, refused by name when they
 * cannot be drawn with.
 *
 * Checked before the Route does anything. A share of 1 or more, or two that
 * leave the page nothing, would still run, and would draw every Hop from a
 * side that cannot keep a Route going.
 */
export function sharesFor(cfg: Pick<AppUnderTest, 'keyShare' | 'menuShare'>): Shares {
  const shares = {
    keyShare: cfg.keyShare ?? DEFAULT_KEY_SHARE,
    menuShare: cfg.menuShare ?? DEFAULT_MENU_SHARE,
  };
  for (const [name, value] of Object.entries(shares)) {
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error(`${name} is ${value}, and must be a fraction from 0 up to but not including 1.`);
    }
  }
  if (shares.keyShare + shares.menuShare >= 1) {
    throw new Error(
      `keyShare ${shares.keyShare} and menuShare ${shares.menuShare} sum to 1 or more, which ` +
        'leaves the page no share of the draw. They must sum to less than 1.'
    );
  }
  return shares;
}

/** Which side of the pool a share draw chose, before falling back from an empty side. */
export type Side = 'keys' | 'menu' | 'page';

/**
 * The side a share draw points at, as a pure function of the draw, so that a
 * journal can be checked against it from the file alone.
 */
export function sideOfShareDraw(shareDraw: number, shares: Shares): Side {
  const fraction = shareDraw / 4_294_967_296;
  if (fraction < shares.keyShare) return 'keys';
  if (fraction < shares.keyShare + shares.menuShare) return 'menu';
  return 'page';
}

/**
 * The candidates a Hop is drawn from, given the side its share draw chose.
 *
 * A chosen side with nothing on it falls back to the page, and the page to the
 * keys and then the menu, so a draw always lands somewhere. The Route strands
 * before choosing when the page offers nothing, so on a Route the last two
 * fallbacks are only reached by a chooser handed a pool directly.
 */
export function sideCandidates<T extends { source: string; role: string }>(
  pool: readonly T[],
  side: Side
): readonly T[] {
  const keys = pool.filter((c) => c.source === 'key' && c.role === 'key');
  const menu = pool.filter((c) => c.source === 'menu');
  const page = pool.filter((c) => c.source !== 'menu' && !(c.source === 'key' && c.role === 'key'));
  const chosen = side === 'keys' ? keys : side === 'menu' ? menu : page;
  return [chosen, page, keys, menu].find((candidates) => candidates.length) ?? [];
}

/** Whether a candidate is one of the common keys, which draw from their own share. */
export function isCommonKey(candidate: SurveyedCandidate): boolean {
  return candidate.source === 'key' && candidate.role === 'key';
}

/**
 * Whether a candidate counts toward a Route having somewhere to go.
 *
 * The common keys and the menu bar are on offer on every screen, so counting
 * either would mean no Route ever stranded, and a dead end or a trap would read
 * as passed. Both stay in the draw; they just cannot keep a Route going on
 * their own. Decided 2026-09-24 for the keys, and the same day for the menu
 * once it was offered in every window mode. The cost is a page whose only way
 * onward is a menu entry: it strands, which is reported apart from failures.
 */
export function keepsRouteGoing(candidate: SurveyedCandidate): boolean {
  return candidate.source !== 'menu' && !isCommonKey(candidate);
}

/**
 * The only chooser there is today: drawn from the seed, in two steps.
 *
 * The share draw is taken on every Hop, even when a side is empty, so the
 * stream advances the same way whatever the screen offered. The journal
 * records both draws and the shares, and the target is always the entry the
 * second draw points at within the side the first chose, in pool order. The
 * draw is taken as a fraction of 2^32 and read by sideOfShareDraw.
 */
export function createSeededChooser(shares: Shares): Chooser {
  return {
    choose: (candidates, rng) => {
      // One draw, wanted for its raw value: sideOfShareDraw reads the side from it.
      const share = rng.pickWithDraw([0]);
      const side = sideCandidates(candidates, sideOfShareDraw(share.draw, shares));
      const { item, draw } = rng.pickWithDraw(side);
      return { target: item, draw, shareDraw: share.draw };
    },
  };
}

/** The seeded chooser with the engine's default shares. */
export const seededChooser: Chooser = createSeededChooser({
  keyShare: DEFAULT_KEY_SHARE,
  menuShare: DEFAULT_MENU_SHARE,
});

/**
 * Generating a value to type, as a second seam.
 *
 * Separate from choosing a control, and at lower stakes: a different value
 * generator does not cost seeded replay, because the control being acted on is
 * still drawn from the seed. That is the whole reason the two are not one seam.
 */
export interface ValueGenerator {
  generate(candidate: SurveyedCandidate, rng: Rng): string;
}

/**
 * Values a Hop fills in, drawn from the Trip stream.
 *
 * Small and ordinary on purpose. Hostile input belongs to fault injection,
 * which is a later phase with its own reporting; a value generator that reached
 * for it now would make every Route's failures about the input rather than
 * about the application, and bury what the Route itself finds.
 *
 * **"1" and "2" are here so a field that asks for a count can be filled.**
 * Until 2026-09-27 the only digit was "0", so a field that refuses anything
 * outside a range until it is retyped was a dead end no chooser could get
 * past. Measured on the Eighty Days demo's ticket office, whose berth count
 * takes 1 to 3; docs/HISTORY.md has it. Fixed values rather than a range read
 * from the page, because a read that can fail on one run and not the next
 * would type different values from one seed. Adding them changed what every
 * seed types from that day.
 */
const VALUE_CORPUS = ['', 'a', 'travel', 'Carpet', '0', '1', '2', '  ', 'x'.repeat(200)] as const;

export const seededValues: ValueGenerator = {
  generate: (_candidate, rng) => rng.pick(VALUE_CORPUS),
};

/**
 * One step of a Fix, which names its kind.
 *
 * `act` acts on a target by the name the engine gives it, exactly as `phileas
 * survey` and `phileas show` print it: `button "Open Alps by rail"`, `menu
 * View > Show Timetable`, `key Enter`. It is acted on the way a Trip hop would
 * act on it, and `value` is what to type into a text field. So a Fix can be
 * written by copying a line from `phileas survey`, with no reading of the
 * application's code. A target that is not on screen fails the Fix and lists
 * what is, so a wrong one says what the right one is. The first candidate
 * printed that way is used, and the exclusion list still applies.
 *
 * `code` runs any code the Fix's author writes, such as typing into one of
 * two text boxes that share a name, or waiting for proof that earlier steps
 * worked. `label` names it in the journal.
 *
 * One function with the kind named, rather than a `hop()` beside a `step()`,
 * decided 2026-09-29: a Fix is a script of steps, and a Hop is a Trip's jump.
 * A tag rather than two signatures, because a `code` step missing its action
 * must fail to compile, not be read as a target and fail mid-Journey.
 */
export type FixStep =
  | { readonly kind: 'act'; readonly target: string; readonly value?: string }
  | { readonly kind: 'code'; readonly label: string; readonly action: () => Promise<void> };

/**
 * What the Fix is handed.
 *
 * `step` is how a Fix reaches the journal. A Fix that ran as one opaque call
 * would leave R10 with nothing to record about it, and R11 with no way to say
 * which part of a known start went wrong.
 */
export interface FixContext {
  readonly page: Page;
  readonly app: ElectronApplication;
  /** Draws made while following the Fix. Never the Trip's stream. */
  readonly rng: Rng;
  /**
   * Run one step of the Fix, then settle, run the checks, and record it as one
   * `fix-step` line. A step cannot be taken inside another step's `code`.
   */
  step(what: FixStep): Promise<void>;
}

/**
 * A fixed sequence of steps that anchors the start of every Route.
 *
 * It runs fresh at the start of every Route and is never cached. Running it
 * fresh IS the independence guarantee rather than merely a way of getting a
 * clean state: a cached Fix means Route 5 begins from whatever Route 4 left
 * behind, every Route still reports green, and the failures it hides are
 * precisely the state-leakage bugs this engine exists to find.
 *
 * Optional, and usually present. A Journey with no Fix is the unanchored mode
 * this engine's predecessor was, which is kept on purpose and is the less
 * interesting of the two.
 */
export type Fix = (context: FixContext) => Promise<void>;

/**
 * A failure inside the Fix, which is a different finding from a failed Route.
 *
 * R11: ten Routes failing on one broken precondition is one problem, not ten,
 * and the Fix is fixed, so a failure in it says nothing about the Route that
 * was about to be traveled. If the two reported through one channel, a single
 * broken setup step would look like a catastrophic morning and bury whatever
 * else the Journey found.
 */
export class FixFailure extends Error {
  constructor(
    readonly step: string,
    // `override`, because this is Error's own `cause` field rather than a new
    // one beside it. Anything reading a cause chain finds it where it expects.
    override readonly cause: unknown
  ) {
    super(
      `The Fix failed at step "${step}", so this Route never started traveling. ` +
        `A Fix failure is a broken precondition, not a finding about the route ahead: ` +
        `expect every Route in this Journey to report the same thing.\n\n` +
        (cause instanceof Error ? (cause.stack ?? cause.message) : String(cause))
    );
    this.name = 'FixFailure';
  }
}

/**
 * Thrown when the page stops answering after a Hop.
 *
 * **The measured case is an outbound link, and the shape is worth knowing
 * before it is met again.** Every Playwright locator call waits for any pending
 * navigation to finish. An application that routes external links through
 * `will-navigate` and calls `preventDefault` leaves a navigation that never
 * finishes, so the page stays alive and answers `evaluate` in milliseconds
 * while every locator call blocks: measured against the proving ground on 2026-09-22,
 * still blocked 8.8 seconds after the click with no sign of clearing.
 *
 * So the Route is over, and the honest thing is to say so once rather than to
 * spend the rest of the Trip on Hops that will each time out. This is not
 * stranded: moves were available and the Route took one. It is a finding,
 * and phase 5 is where it becomes a named check rather than an error.
 *
 * **The exclusion list is the first defense and this is the second.** A Route
 * should not reach an outbound link at all; docs/PLAN.md says the rail is what
 * keeps it off one, and this fires on the ones a list missed, which is exactly
 * the case nobody writes a test for.
 */
export class PageUnreachable extends Error {
  constructor(
    readonly afterHop: number,
    readonly target: string,
    cause: unknown
  ) {
    const why = cause instanceof Error ? (cause.message.split('\n')[0] ?? '') : String(cause);
    // Only a survey that timed out earns the navigation explanation. Anything
    // else -- an adapter's predicate throwing, the application gone -- is
    // named as itself, rather than blamed on a link the exclusion list missed.
    const timedOut = cause instanceof Error && (cause.name === 'TimeoutError' || /Timeout \d+ms exceeded/.test(cause.message));
    super(
      `The page could not be surveyed after hop ${afterHop}, which acted on ${target}: ${why}` +
        (timedOut
          ? `\n\nEvery locator call waits for a pending navigation to finish, and a navigation ` +
            `an application prevents in will-navigate never finishes, so the page stays alive ` +
            `while nothing can be surveyed. The Route ends here rather than spending the rest ` +
            `of its Trip on hops that would each time out. If this was an outbound link, the ` +
            `adapter's exclusion list is what should have kept the Route off it.`
          : ''),
      { cause }
    );
    this.name = 'PageUnreachable';
  }
}

/**
 * Whether an action's error is one a Hop is abandoned over rather than one that
 * ends the Route: out of time, the target gone since the survey, or the
 * application gone, which the checks report on the same Hop.
 */
function isAbandonment(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'TimeoutError' ||
    /Timeout \d+ms exceeded|No menu item at|not attached|detached|Target (?:page, context or browser )?(?:has been )?closed|crashed/i.test(
      error.message
    )
  );
}

/**
 * How a Route ended.
 *
 * Three outcomes, and stranded is the third. It is not a failure, because
 * nothing has been shown to be wrong: a dead end, an inescapable dialog and a
 * trap all strand, and so does a perfectly reasonable corner of the application
 * with nothing further to do in it. Calling it a failure would assert a defect
 * the engine has not found. It is not a pass either, because the Route did not
 * do what was asked of it.
 */
export type RouteOutcome =
  | { readonly kind: 'passed'; readonly hops: number }
  | { readonly kind: 'stranded'; readonly hops: number; readonly reason: string }
  /**
   * Only a survey was asked for, with `PHILEAS_SURVEY=1`, and nothing was
   * traveled. Not a pass: a Journey run with the variable left over would
   * otherwise read green having gone nowhere. A consumer's spec marks its
   * test skipped on it.
   */
  | { readonly kind: 'surveyed' };

export interface RunRouteOptions {
  readonly page: Page;
  readonly app: ElectronApplication;
  readonly cfg: AppUnderTest;
  readonly streams: RouteStreams;
  readonly journeySeed: string;
  /** Which Route of the Journey this is, counting from 1. */
  readonly routeNumber: number;
  readonly tripLength: number;
  /**
   * The folder all journals go under. The engine writes this Route's journal
   * to `<root>/<journey seed>/<run>/`, the run named by `startJourney` in
   * global setup; see `journalFolder`. Only the root is the consumer's.
   */
  readonly journalsRoot: string;
  readonly fix?: Fix;
  readonly chooser?: Chooser;
  readonly values?: ValueGenerator;
  /** How long one Hop's action may take before it is abandoned. */
  readonly hopTimeoutMs?: number;
  /** How long to wait for the page to stop moving after a Hop. */
  readonly settleTimeoutMs?: number;
  /**
   * How long each process has to answer the still-responding check's round
   * trip, and the reading of what the stubs caught. Overrides the adapter's
   * `responsiveTimeoutMs`. See `DEFAULT_RESPONSIVE_TIMEOUT_MS`.
   */
  readonly responsiveTimeoutMs?: number;
  /**
   * How long to pause after each Hop so a person can watch: every Trip hop,
   * every step of the Fix, and each listing a survey prints, since a Fix or a
   * survey that flashes past cannot be watched either.
   *
   * Defaults to whatever `PHILEAS_HOP_DELAY_MS` says, so a run can be slowed
   * down from the command line without editing a Journey. See
   * `hopDelayFromEnvironment`.
   */
  readonly hopDelayMs?: number;
  /** Only print what the start screen offers, and stop. See `SURVEY_VARIABLE`. */
  readonly surveyOnly?: boolean;
  /**
   * Print the journal as it is written. Read from the environment when left
   * out, as `followFromEnvironment`.
   */
  readonly follow?: boolean;
  /**
   * The Route's profile folder, from the test's `userDataDir` fixture. Needed
   * only where the adapter's `logPaths` is written as a function of it.
   */
  readonly userDataDir?: string;
  /**
   * The consumer's known findings file, which may not exist yet. A violation
   * it holds is recorded and the Route carries on. Read once, here, and never
   * written during a Journey: `finishJourney` adds what a Journey found when
   * it ends. See `known.mjs`.
   */
  readonly knownFindings?: string;
}

/**
 * How long a single action may take before the Hop gives up on it.
 *
 * **A Hop must not wait for navigation to finish, and this was measured rather
 * than reasoned about.** Clicking the proving ground's outbound link with an ordinary
 * Playwright click hangs for the full default timeout: the link schedules a
 * navigation, the main process cancels it in `will-navigate`, and from the
 * renderer's side that navigation never resolves, so the click waits forever
 * for something that was already prevented. Every application that routes
 * external links this way behaves identically, which is all three that have
 * been read.
 *
 * The cost if this is missed is that one Hop consumes a Route's entire timeout
 * and the Route reports a timeout rather than whatever it had found. The
 * exclusion list is what should keep a Route off an outbound link in the first
 * place, so this fires on the ones a list missed, which is exactly the case
 * nobody tests for.
 */
const DEFAULT_HOP_TIMEOUT_MS = 3_000;

/**
 * A Fix's name for the journal: the one `defineFixes` listed it under, or the
 * function's own, which JavaScript takes from the constant it was assigned to.
 */
function namedFix(fix: Fix): { name?: string } {
  const name = fixName(fix) ?? fix.name;
  return name ? { name } : {};
}

/** How often a Fix step surveys again while its target has not appeared. */
const FIX_TARGET_POLL_MS = 250;

/** How long to wait for the page to stop moving. See `settle`. */
const DEFAULT_SETTLE_TIMEOUT_MS = 2_000;

/**
 * The shortest time a settle read is given, even when less of the budget is
 * left, so the wait can run past its budget by up to this much. Well above the
 * slowest healthy read measured, 276 ms on Positron at rest on 2026-09-26, so a
 * read that runs out of it is a page that gave no answer, not one that ran out
 * of budget.
 */
const MIN_SETTLE_READ_MS = 500;

/**
 * How long the page must stay unchanged to count as settled. See `settle`.
 *
 * Measured on 2026-09-24, not chosen. The longest pause measured inside one
 * Hop's real effect was 337 ms, Positron drawing a help page; RStudio's longest
 * was 173 ms, and `buggy`'s effects are single changes inside 46 ms. So the
 * window is longer than any of those. It is also short enough that both IDEs'
 * resource monitors, which tick about once a second, leave room for it between
 * ticks. The price is paid on every Hop, so an adapter can set its own with
 * `settleQuietMs`.
 */
export const DEFAULT_SETTLE_QUIET_MS = 400;

/** The variable a watching delay is read from. Named because errors quote it. */
export const HOP_DELAY_VARIABLE = 'PHILEAS_HOP_DELAY_MS';

/**
 * Whether each Route prints its journal as it is written, one readable line
 * per entry, which `phileas run --follow` sets.
 *
 * A viewing aid like the hop delay: it changes no draw and no verdict. Off by
 * default, so an unattended run's output stays one line per Route.
 */
export const FOLLOW_VARIABLE = 'PHILEAS_FOLLOW';

/**
 * Whether a Route only prints what it sees and stops: the start screen, then,
 * where there is a Fix, each Fix step and the screen after it, where the Trip
 * would begin. No Trip and no journal. `phileas survey` sets it, so that a Fix
 * can be written by copying lines from what the engine itself finds.
 */
export const SURVEY_VARIABLE = 'PHILEAS_SURVEY';

/** Read whether to survey only, refusing anything but on or off. */
export function surveyFromEnvironment(): boolean {
  const raw = (process.env[SURVEY_VARIABLE] ?? '').trim();
  if (raw === '' || raw === '0') return false;
  if (raw === '1') return true;
  throw new RangeError(`${SURVEY_VARIABLE}=${JSON.stringify(raw)} is not on or off. Use 1 or 0.`);
}

/**
 * What a survey found, as lines a person can copy into a Fix's `act` step.
 *
 * The common keys are on one line rather than seven, since they are on offer
 * everywhere. An excluded control is listed with its rule, because a Fix that
 * names it will be refused and should be refused by name.
 */
export function surveyLines(found: SurveyResult): string[] {
  const keys = found.candidates.filter(isCommonKey).map((c) => c.name);
  return [
    ...found.candidates.filter((c) => !isCommonKey(c)).map((c) => targetText(journaled(c))),
    ...found.excluded.map((entry) => `${targetText(entry.candidate)}   (excluded: ${entry.rule})`),
    ...found.covered.map((entry) => `${targetText(journaled(entry.candidate))}   (covered by ${entry.by})`),
    ...found.hidden.map((entry) => `${targetText(journaled(entry.candidate))}   (hidden: ${entry.by} has no area)`),
    ...(keys.length ? [`and the common keys: ${keys.join(', ')}`] : []),
  ];
}

/** Read whether to follow, refusing anything but on or off. */
export function followFromEnvironment(): boolean {
  const raw = (process.env[FOLLOW_VARIABLE] ?? '').trim();
  if (raw === '' || raw === '0') return false;
  if (raw === '1') return true;
  throw new RangeError(
    `${FOLLOW_VARIABLE}=${JSON.stringify(raw)} is not on or off. Use 1 to print each Route's ` +
      `journal as it is written, and 0 or leave it unset for one line per Route.`
  );
}

/**
 * How long to pause after each Hop, so that a person can watch one happen.
 *
 * **This is a viewing aid and nothing else.** Hops pass faster than they can
 * be watched, often under half a second each, most of it the settle wait, even
 * with the windows frontmost, and
 * showing windows is pointless if what they show is a blur. It changes no draw
 * and no verdict: the same seed retraces the same Route with any delay, because
 * the delay consumes nothing from either stream.
 *
 * Named for its units. The deadlines carry a comment about a duration being
 * mistaken for a count, and a bare `PHILEAS_HOP_DELAY` invites exactly that.
 *
 * **It is not free of consequences, and they are both timeouts.** The pause
 * lands inside the Route's own timeout and inside the Journey's deadline, so a
 * delay of a second against a Trip of twenty Hops adds twenty seconds to
 * every Route. A watched run that reports a timeout is usually this rather than
 * the application.
 */
export function hopDelayFromEnvironment(): number {
  const raw = (process.env[HOP_DELAY_VARIABLE] ?? '').trim();
  if (raw === '') return 0;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(
      `${HOP_DELAY_VARIABLE}=${JSON.stringify(raw)} is not a delay. It is a whole number of ` +
        `milliseconds to pause after each Hop so a person can watch, and zero or unset means ` +
        `no pause.`
    );
  }
  return value;
}

/** The annotation naming a Route's journal, which the engine's reporter reads its ending from. */
export const JOURNAL_ANNOTATION = 'phileas-journal';

/**
 * Name the Route's journal on its test, so the engine's reporter can read how
 * the Route ended from the record rather than from the error a test threw.
 * A Route run outside a test, which only the engine's own code might do, has
 * nothing to name it on, and needs nothing.
 */
function noteJournal(file: string): void {
  let info: ReturnType<typeof test.info>;
  try {
    info = test.info();
  } catch {
    return;
  }
  info.annotations.push({ type: JOURNAL_ANNOTATION, description: file });
}

export async function runRoute(options: RunRouteOptions): Promise<RouteOutcome> {
  const {
    page,
    app,
    cfg,
    streams,
    journeySeed,
    routeNumber,
    tripLength,
    journalsRoot,
    fix,
    values = seededValues,
    hopTimeoutMs = DEFAULT_HOP_TIMEOUT_MS,
    settleTimeoutMs = DEFAULT_SETTLE_TIMEOUT_MS,
    hopDelayMs = hopDelayFromEnvironment(),
    follow = followFromEnvironment(),
    surveyOnly = surveyFromEnvironment(),
    responsiveTimeoutMs,
    userDataDir,
    knownFindings,
  } = options;
  const settleQuietMs = cfg.settleQuietMs ?? DEFAULT_SETTLE_QUIET_MS;
  // This Route's own setting first, which the engine's tests use, then the
  // adapter's, then the default.
  const responsiveMs = responsiveTimeoutMs ?? cfg.responsiveTimeoutMs ?? DEFAULT_RESPONSIVE_TIMEOUT_MS;
  // Refused rather than obeyed: zero or less would report every Hop as a hang,
  // and a value that is not a number would never time out at all.
  if (!Number.isInteger(responsiveMs) || responsiveMs <= 0) {
    throw new Error(`responsiveTimeoutMs must be a whole number of milliseconds above 0, and is ${responsiveMs}.`);
  }
  const shares = sharesFor(cfg);
  const chooser = options.chooser ?? createSeededChooser(shares);
  // Read once, so the survey, the Fix and the opening line all use the same.
  const allowedGroups = allowedGroupsFromEnvironment(cfg.exclusions);

  // Before the journal opens, so that a survey leaves no record behind that
  // could be mistaken for a Route that traveled nowhere.
  if (surveyOnly) {
    const tally = createExclusionTally(cfg.exclusions, allowedGroups);
    const print = async (heading: string) => {
      const found = await survey({
        page,
        app,
        exclusions: cfg.exclusions,
        hopIndex: 0,
        tally,
        timeoutMs: hopTimeoutMs,
      });
      console.log(`${heading}\n`);
      for (const line of surveyLines(found)) console.log(`  ${line}`);
      console.log('');
      await pauseToWatch(hopDelayMs);
    };

    // With no Fix, the start is where the Trip begins, so the one listing says
    // both rather than leaving the second to be inferred from its absence.
    await print(
      fix
        ? 'What the engine sees at the start, before any Fix:'
        : 'What the engine sees at the start, which is where the Trip begins, since there is no Fix:'
    );
    if (fix) {
      // The Fix runs as it would on a Route, with each step printed instead of
      // journaled, so a Fix of several steps can be written one step at a time:
      // write a step, survey, copy the next line from what it now shows. A step
      // that fails stops the survey with the list of what was on screen.
      await runFix(fix, {
        page,
        app,
        rng: streams.fix,
        journal: {
          write: (entry) => {
            const line = renderEntry(entry, routeNumber);
            if (line) console.log(line);
          },
        },
        settleTimeoutMs,
        settleQuietMs,
        exclusions: cfg.exclusions,
        tally,
        hopTimeoutMs,
        hopDelayMs,
      });
      console.log('');
      await print('What the engine sees after the Fix, where the Trip begins:');
    }
    return { kind: 'surveyed' };
  }

  // Read before the journal opens, so a file that cannot be read stops the Route
  // before it has anything to record, and the opening line can name its version.
  const known = knownFindings === undefined ? undefined : readKnownFindings(knownFindings);

  // Opened and flushed before the Route does anything, so that a Route which
  // dies inside its Fix still leaves a file naming the seed that produced it.
  const journal = Journal.open(journalFolder(journalsRoot, journeySeed, requireRun()), {
    journeySeed,
    routeSeed: streams.routeSeed,
    routeNumber,
    tripLength: tripLength,
    settleQuietMs,
    responsiveTimeoutMs: responsiveMs,
    ...shares,
    allowStandardMenuRoles: (cfg.exclusions.allowStandardMenuRoles ?? []).map((role) => role.toLowerCase()),
    ...(cfg.exclusions.groups ? { allowedExclusionGroups: allowedGroups } : {}),
    ...(known ? { knownFindings: { version: known.version, entries: known.entries.length } } : {}),
    ...(cfg.varyingInSignatures?.length
      ? { varyingInSignatures: cfg.varyingInSignatures.map(([pattern, replacement]) => [String(pattern), replacement] as const) }
      : {}),
    ...(fix ? { fix: { ...namedFix(fix), fingerprint: fixFingerprint(fix) } } : {}),
  }, { follow });
  noteJournal(journal.file);

  const tally = createExclusionTally(cfg.exclusions, allowedGroups);
  let hops = 0;
  let menuVerdictNoted = false;

  try {
    // Started before the Fix, since the checks run after Fix steps too, and
    // inside the try, so a Route whose watching cannot start still closes its
    // journal with the reason.
    const watch = await startWatching({ page, app, cfg, responsiveTimeoutMs: responsiveMs, userDataDir, known });

    // Asked once here, so anything the stubs caught while the application
    // started is not put down to the first Hop.
    const caught = caughtSince(app, responsiveMs);
    const atLaunch = await caught();
    if (atLaunch) {
      journal.write({
        kind: 'note',
        hop: 1,
        note: `Caught by the engine's stubs as the application started, before any Hop: ${JSON.stringify(atLaunch)}`,
        at: new Date().toISOString(),
      });
    }

    // Every step so far, Fix and Trip, with when each ran, so a failure can
    // say which step was running when what it found arrived.
    const timeline: StepSpan[] = [];

    if (fix) {
      await runFix(fix, {
        page,
        app,
        rng: streams.fix,
        journal,
        watch,
        caught,
        timeline,
        settleTimeoutMs,
        settleQuietMs,
        exclusions: cfg.exclusions,
        tally,
        hopTimeoutMs,
        hopDelayMs,
      });
    }

    let lastTarget: string | undefined;
    let abandonedHops = 0;

    while (hops < tripLength) {
      let found: SurveyResult;
      try {
        found = await survey({
          page,
          app,
          exclusions: cfg.exclusions,
          hopIndex: hops,
          tally,
          timeoutMs: hopTimeoutMs,
        });
      } catch (error) {
        // A survey that cannot be taken is different from a survey that found
        // nothing, and folding the two together would report a poisoned Route
        // as a dead end in the application. The first hop has no previous
        // choice to name, so a survey failing there is something else and is
        // rethrown unchanged.
        if (lastTarget === undefined || error instanceof NondeterministicExclusion) throw error;
        // `hops` is the count of Trip hops completed, which is also the number
        // of the last one, since Trip hops count from 1.
        throw new PageUnreachable(hops, lastTarget, error);
      }

      // Recorded once per Route rather than per Hop. A Route that never hopped
      // to a menu because none was offered would otherwise look exactly like a
      // Route that was offered menus and drew elsewhere every time.
      if (!menuVerdictNoted && !found.menuSource.offered) {
        menuVerdictNoted = true;
        journal.write({
          kind: 'note',
          hop: hops + 1,
          note: `Menu candidates withheld: ${found.menuSource.reason}`,
          at: new Date().toISOString(),
        });
      }

      // Only what the page offers keeps a Route going. See keepsRouteGoing.
      if (!found.candidates.some(keepsRouteGoing)) {
        // R5. Naming the hop is the requirement, and it is what separates "this
        // application has a dead end at hop 3" from "this Route found nothing
        // to do", which are different findings about different things.
        const reason = strandedReason(found);
        journal.close({
          outcome: 'stranded',
          hops,
          reason,
          exclusionsNeverMatched: neverMatched(tally),
        });
        return { kind: 'stranded', hops, reason };
      }

      const startedAt = new Date();
      const { target, draw, shareDraw } = await chooser.choose(found.candidates, streams.trip);
      // The chooser is a seam other implementations will fill. One that hands
      // back something the survey did not offer would have the journal record
      // a Hop against a pool that does not hold its target (R10).
      if (!found.candidates.includes(target)) {
        throw new Error(`The chooser returned ${target.role} "${target.name}", which is not among the candidates it was given.`);
      }
      lastTarget = `${target.role} "${target.name}"`;
      const action = await actionFor(target, hopTimeoutMs);
      const span: StepSpan = {
        name: `hop ${hops + 1}`,
        what: `${action} ${targetText(journaled(target))}`,
        startedAt: startedAt.getTime(),
      };
      timeline.push(span);

      // Drawn whether or not it is used, so that the stream advances the same
      // way regardless of which control was the target. A value drawn only for a
      // text box would make every later draw depend on what the survey happened
      // to offer, and two runs of one seed would diverge at the first hop that
      // chose a button where the other chose a field.
      const value = values.generate(target, streams.trip);

      // A bounded action that ran out of time ends the Hop, not the Route. The
      // measured case is an outbound link: the click schedules a navigation the
      // main process cancels, so from the renderer's side it never resolves.
      // Letting that end the Route would throw away every Hop the Trip still
      // had, which is the cost the bound exists to prevent in the first place.
      // An action the application held past the bound is a finding, which the
      // still-responding check reports on this Hop; the Route has to be alive
      // for that check to run.
      //
      // Timed from this side too, through the watch: an application that has
      // stopped answering holds back even the action's own timeout, and how
      // long it held it back is what the still-responding check reads.
      let abandoned: string | undefined;
      let interceptedBy: string | undefined;
      try {
        const acted = await watch.bounded(
          `hop ${hops + 1}'s ${action} on ${lastTarget}`,
          act(app, page, target, action, value, hopTimeoutMs),
          hopTimeoutMs
        );
        if (acted === STALLED) abandoned = 'the application stopped answering';
      } catch (error) {
        // Only what an action can meet in a working engine: running out of
        // time, the target gone from a menu or page since the survey, or the
        // application gone, which the checks just below then report. Anything
        // else is the engine or the adapter breaking, and ends the Route as
        // itself rather than being journaled as a Hop that did nothing.
        if (!isAbandonment(error)) throw error;
        abandoned = error instanceof Error ? error.message.split('\n')[0] : String(error);
        interceptedBy = error instanceof Error ? interceptorIn(error.message) : undefined;
      }
      if (abandoned !== undefined) abandonedHops += 1;

      const settling = await settledOrStalled(watch, page, settleTimeoutMs, settleQuietMs);

      // After the settle wait, so the checks judge the page the Hop left
      // rather than one still changing, and before the line is written, so the
      // line carries them (R10).
      const checks = await watch.check(settling.tree);
      const stopped = await caught();

      // The pool is written first, if this file has not seen it, so the Hop
      // line below never names a pool that is not already on disk.
      const pool = journal.pool(
        found.candidates.map(journaled),
        found.covered.map((entry) => ({ candidate: journaled(entry.candidate), by: entry.by })),
        found.hidden.map((entry) => ({ candidate: journaled(entry.candidate), by: entry.by })),
        found.layered.map((entry) => ({ candidate: journaled(entry.candidate), by: entry.by })),
        found.labeled.map((entry) => ({ candidate: journaled(entry.candidate), by: entry.by }))
      );

      span.endedAt = Date.now();
      if (abandoned !== undefined) span.abandoned = true;
      journal.write({
        kind: 'trip-hop',
        hop: hops + 1,
        target: journaled(target),
        action,
        pool,
        ...(draw === undefined ? {} : { draw }),
        ...(shareDraw === undefined ? {} : { shareDraw }),
        ...(action === 'type' ? { value } : {}),
        ...(abandoned === undefined ? {} : { abandoned }),
        ...(interceptedBy === undefined ? {} : { interceptedBy }),
        startedAt: startedAt.toISOString(),
        durationMs: span.endedAt - startedAt.getTime(),
        settled: settling.settled,
        settleMs: settling.ms,
        effect: effectOf(
          found.tree,
          settling.tree,
          'The page stopped answering while the settle wait read it, so what the Hop did could not be read.'
        ),
        checks,
        ...(stopped ? { caught: stopped } : {}),
      });

      hops += 1;

      // The first violation ends the Route (R16). Hops after it would only
      // record what a known-broken state does next, and bury the Hop that
      // mattered.
      const failed = failedChecks(checks);
      // Where the checks ran, not what caused it: the timeline says when each
      // finding arrived and lists the steps before it.
      if (failed.length) throw new CheckFailure(`hop ${hops}`, failed, timeline);

      // After the entry is written, not before, so that `durationMs` stays the
      // Hop's own cost and a watched journal is comparable with an unwatched
      // one. The pause is for eyes; it must not end up in the record as though
      // the application took that long.
      await pauseToWatch(hopDelayMs);
    }

    // A Trip whose every Hop was abandoned went nowhere: every action timed
    // out or met nothing, as when an overlay swallows every click. That is
    // running out of moves by another road, so it strands (R5) rather than
    // claiming a Trip that never happened.
    if (hops > 0 && abandonedHops === hops) {
      const reason =
        `Every one of the ${hops} Hops was abandoned: each action timed out or met nothing, ` +
        `so the Route moved nowhere. The journal has what each one met.`;
      journal.close({ outcome: 'stranded', hops, reason, exclusionsNeverMatched: neverMatched(tally) });
      return { kind: 'stranded', hops, reason };
    }
    journal.close({ outcome: 'passed', hops, exclusionsNeverMatched: neverMatched(tally) });
    return { kind: 'passed', hops };
  } catch (error) {
    // Closed with an outcome rather than abandoned, because this ending was
    // caught and is therefore known. A journal with no outcome line means the
    // Route did not finish and nothing saw it stop, which is a different thing
    // and must stay distinguishable.
    //
    // Guarded: a journal that cannot be written, a full disk say, must not
    // replace the error that ended the Route with its own.
    try {
      journal.close({
        outcome: 'failed',
        hops,
        reason: error instanceof Error ? error.message : String(error),
        exclusionsNeverMatched: neverMatched(tally),
      });
    } catch (closing) {
      if (error instanceof Error && error.cause === undefined) (error as { cause?: unknown }).cause = closing;
    }
    throw error;
  }
}

/**
 * What took a click instead, from the error Playwright gave up with: the last
 * line of its call log saying an element intercepts pointer events, without
 * its colors. Undefined where the click gave up for another reason.
 */
export function interceptorIn(message: string): string | undefined {
  const lines = message
    .replace(/\u001b\[\d+m/g, '')
    .split('\n')
    .map((line) => line.trim().replace(/^- /, ''))
    .filter((line) => line.endsWith('intercepts pointer events'));
  return lines.at(-1);
}

/** Why the Route had nowhere left to go, in terms a reader can act on. */
function strandedReason(found: SurveyResult): string {
  // Everything left on the page is under something: a screen a pointer cannot
  // get into, such as an overlay with no way out. Named first, with what
  // covers each control, since that is what a reader would go and look at.
  if (found.covered.length) {
    return (
      `No candidate was available on the page. ${found.covered.length} control(s) were found under ` +
      `something else, so a click could not reach them: ` +
      `${found.covered.map((entry) => `${targetText(journaled(entry.candidate))} under ${entry.by}`).join('; ')}.`
    );
  }
  // Everything left is hidden by the application itself, such as every pane
  // but one zoomed away (R32).
  if (found.hidden.length) {
    return (
      `No candidate was available on the page. ${found.hidden.length} control(s) were found hidden ` +
      `inside something with no area, so no person could see them: ` +
      `${found.hidden.map((entry) => `${targetText(journaled(entry.candidate))} inside ${entry.by}`).join('; ')}.`
    );
  }
  // Menu exclusions fire on every hop, so they say nothing about this page.
  const excluded = found.excluded.filter((entry) => entry.candidate.source !== 'menu');
  if (excluded.length) {
    return (
      `No candidate was available on the page. ${excluded.length} were found and every one ` +
      `was excluded: ${excluded.map((entry) => entry.rule).join(', ')}.`
    );
  }
  if (found.unnamed.length) {
    return (
      `No candidate was available on the page. ${found.unnamed.length} element(s) carried a hoppable ` +
      `role and no accessible name, so the Route could not reach them: ` +
      `${found.unnamed.map((element) => element.role).join(', ')}.`
    );
  }
  return (
    'No candidate was available but the common keys and the menu bar: the survey found ' +
    'nothing on the page with a hoppable role.'
  );
}

/**
 * The settle wait, timed through the watch so a hang is noticed there too. A
 * wait the application never let finish reads as unsettled, with no tree, so
 * the Hop's effect is recorded as unreadable rather than as nothing changed.
 */
async function settledOrStalled(
  watch: Watch,
  page: Page,
  timeoutMs: number,
  quietMs: number
): Promise<{ settled: boolean; ms: number; tree?: unknown }> {
  const startedAt = Date.now();
  const settling = await watch.bounded('the settle wait', settle(page, timeoutMs, quietMs), timeoutMs);
  return settling === STALLED ? { settled: false, ms: Date.now() - startedAt } : settling;
}

/** The pause for watching, which changes no draw and is never recorded as time a Hop took. */
async function pauseToWatch(ms: number): Promise<void> {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

/** What a Fix step is, as its `fix-step` line records it beside the label. See `FixStepEntry`. */
type StepContent = {
  -readonly [K in 'stepKind' | 'target' | 'action' | 'value' | 'source' | 'sourceHash']?: FixStepEntry[K];
};

/** Run the Fix, journaling each step, and wrap any failure as R11 asks. */
async function runFix(
  fix: Fix,
  context: {
    page: Page;
    app: ElectronApplication;
    rng: Rng;
    /** Where each step is recorded: the Route's journal, or a survey's printout. */
    journal: Pick<Journal, 'write'>;
    /** The checks, run after every step. Absent for a survey, which judges nothing. */
    watch?: Watch;
    /** What the stubs caught since last asked. Absent for a survey, which records nothing. */
    caught?: () => Promise<CaughtByStubs | undefined>;
    /** The Route's steps, which each Fix step joins. Absent for a survey, which judges nothing. */
    timeline?: StepSpan[];
    settleTimeoutMs: number;
    settleQuietMs: number;
    exclusions: AppUnderTest['exclusions'];
    tally: ExclusionTally;
    hopTimeoutMs: number;
    /** The pause after each step, for watching; see `RunRouteOptions.hopDelayMs`. */
    hopDelayMs: number;
  }
): Promise<void> {
  const {
    page,
    app,
    rng,
    journal,
    watch,
    caught,
    timeline,
    settleTimeoutMs,
    settleQuietMs,
    exclusions,
    tally,
    hopTimeoutMs,
    hopDelayMs,
  } = context;
  let steps = 0;

  // The "before" of the first step. Every later step's "before" is the reading
  // the previous step's settle wait ended on, so this is the only extra read.
  let before: unknown = await page
    .locator('body')
    .ariaSnapshotJSON({ timeout: settleTimeoutMs })
    .catch(() => undefined);

  // A full settle wait after each step, as after a Trip hop, rather than one
  // snapshot, which could catch the screen mid-change and record the wrong
  // effect. Decided 2026-09-24; a Fix is usually a handful of steps.
  const effectAfter = async (): Promise<{ effect: HopEffect; checks: JournaledCheck[]; stopped?: CaughtByStubs }> => {
    const settling = watch
      ? await settledOrStalled(watch, page, settleTimeoutMs, settleQuietMs)
      : await settle(page, settleTimeoutMs, settleQuietMs);
    const effect = effectOf(
      before,
      settling.tree,
      'The page did not answer before or after this step, so what it did could not be read.'
    );
    before = settling.tree;
    // The checks run after every Fix step as after every Trip hop, decided
    // 2026-09-23: a Fix that breaks the application should be caught at the
    // step that broke it, not by whichever Trip hop meets it first.
    const checks = watch ? await watch.check(settling.tree) : [];
    const stopped = await caught?.();
    return { effect, checks, ...(stopped ? { stopped } : {}) };
  };

  // The label of the step running now, so a step taken inside another step's
  // `code` is refused. Both would take the same number, the inner one would be
  // written first, and the settle and checks would run twice: a journal no
  // longer readable on its own.
  let running: string | undefined;

  /**
   * Record one step: run it, settle, check, and write its line. `content` is
   * what the step is, written on its line whether or not it fails; an `act`
   * step adds its target and action to it once it finds them.
   */
  const record = async (label: string, content: StepContent, action: () => Promise<void>): Promise<void> => {
    if (running !== undefined) {
      throw new Error(
        `The Fix step "${label}" was taken inside the step "${running}". A step cannot hold another ` +
          'step: take them one after the other.'
      );
    }
    running = label;
    const startedAt = new Date();
    const number = steps + 1;
    const span: StepSpan = { name: `Fix step ${number}`, what: label, startedAt: startedAt.getTime() };
    timeline?.push(span);
    try {
      await action();
    } catch (error) {
      running = undefined;
      // The failed step gets its own line, with the error on it, before the
      // failure is thrown. R11 wants a broken Fix told apart from a failed
      // Route, and that means saying which step broke rather than leaving it
      // as a sentence inside the outcome's reason.
      // Guarded: a check that throws here must not take the step's own
      // error, and the line that names it, with it.
      const after = await effectAfter().catch(() => undefined);
      const effect: HopEffect = after?.effect ?? {
        readable: false,
        reason: 'The checks after this step failed, so what it did could not be read.',
      };
      const checks = after?.checks ?? [];
      span.endedAt = Date.now();
      journal.write({
        kind: 'fix-step',
        step: number,
        label,
        ...content,
        error: error instanceof Error ? error.message.split('\n')[0] : String(error),
        startedAt: startedAt.toISOString(),
        durationMs: span.endedAt - startedAt.getTime(),
        effect,
        checks,
        ...(after?.stopped ? { caught: after.stopped } : {}),
      });
      throw error instanceof FixFailure ? error : new FixFailure(label, error);
    }
    running = undefined;
    // Before the entry, as for a Trip hop, so that `durationMs` includes the
    // settle wait on both.
    const { effect, checks, stopped } = await effectAfter();
    span.endedAt = Date.now();
    journal.write({
      kind: 'fix-step',
      step: number,
      label,
      ...content,
      startedAt: startedAt.toISOString(),
      durationMs: span.endedAt - startedAt.getTime(),
      effect,
      checks,
      ...(stopped ? { caught: stopped } : {}),
    });
    steps += 1;

    // A check failing after a Fix step is a Fix failure, not a failed Route
    // (R11): ten Routes failing on one broken step is one problem.
    const failed = failedChecks(checks);
    if (failed.length) throw new FixFailure(label, new CheckFailure(`Fix step ${number}, "${label}"`, failed, timeline));
    // After the entry, as on a Trip hop, so the pause never reads as the
    // step's own cost.
    await pauseToWatch(hopDelayMs);
  };

  /**
   * An `act` step's action: find the target on screen and act on it as a Trip
   * hop would, adding what it found to the step's `content`.
   */
  const actOn = (target: string, value: string | undefined, content: StepContent) => async () => {
    // Surveyed again until the target appears, within the hop timeout, since
    // a list can fill in after the step that opened it has settled: Positron's
    // New File list, measured 2026-09-27, lost 1 of 7 `quarto` Routes to a
    // single survey. A survey takes no draw, so waiting changes nothing a
    // replay depends on. An excluded target fails at once: waiting cannot
    // change a rule.
    const deadline = Date.now() + hopTimeoutMs;
    let found = await survey({ page, app, exclusions, hopIndex: steps, tally, timeoutMs: hopTimeoutMs });
    let match = found.candidates.find((candidate) => targetText(journaled(candidate)) === target);
    while (!match && !found.excluded.some((entry) => targetText(entry.candidate) === target) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, FIX_TARGET_POLL_MS));
      found = await survey({ page, app, exclusions, hopIndex: steps, tally, timeoutMs: hopTimeoutMs });
      match = found.candidates.find((candidate) => targetText(journaled(candidate)) === target);
    }
    if (!match) {
      const refused = found.excluded.find((entry) => targetText(entry.candidate) === target);
      // Waited for like a target not yet drawn, since a cover can go away and
      // a hidden pane can come back; named if neither did.
      const under = found.covered.find((entry) => targetText(journaled(entry.candidate)) === target);
      const inside = found.hidden.find((entry) => targetText(journaled(entry.candidate)) === target);
      throw new Error(
        refused
          ? `${target} is on screen but excluded (${refused.rule}), so a Fix cannot act on it either.`
          : under
          ? `${target} is on screen but covered by ${under.by} after ${hopTimeoutMs} ms, so a click cannot reach it.`
          : inside
          ? `${target} is in the page but hidden: ${inside.by} has no area, after ${hopTimeoutMs} ms, so no person could see it.`
          : `${target} is not on screen after ${hopTimeoutMs} ms. What is: ${found.candidates
              .filter((candidate) => !isCommonKey(candidate))
              .map((candidate) => targetText(journaled(candidate)))
              .join('; ')}.`
      );
    }
    const action = await actionFor(match, hopTimeoutMs);
    content.target = journaled(match);
    content.action = action;
    if (action === 'type' && value === undefined) {
      throw new Error(`${target} takes typing, so give the value to type: { kind: 'act', target, value }.`);
    }
    // Bounded like a Trip hop's action. A menu click takes no timeout of its
    // own, and a Fix step onto a menu entry whose handler blocks the main
    // process, as one of Positron's did, would otherwise hang the Journey.
    const what = `Fix step ${steps + 1}'s ${action} on ${target}`;
    const acting = act(app, page, match, action, value ?? '', hopTimeoutMs);
    if (watch) {
      if ((await watch.bounded(what, acting, hopTimeoutMs)) === STALLED) {
        throw new ApplicationStoppedAnswering(what, hopTimeoutMs);
      }
    } else await answered(what, acting, hopTimeoutMs + DEFAULT_RESPONSIVE_TIMEOUT_MS);
  };

  const step: FixContext['step'] = (what) => {
    // Checked at run time too, for a Fix the compiler did not see.
    if (what?.kind === 'act' && typeof what.target === 'string') {
      const label = what.value === undefined ? what.target : `${what.target}, typing ${JSON.stringify(what.value)}`;
      const content: StepContent = { stepKind: 'act', ...(what.value === undefined ? {} : { value: what.value }) };
      return record(label, content, actOn(what.target, what.value, content));
    }
    if (what?.kind === 'code' && typeof what.label === 'string' && typeof what.action === 'function') {
      const source = what.action.toString();
      return record(what.label, { stepKind: 'code', source, sourceHash: sourceHash(source) }, what.action);
    }
    return Promise.reject(
      new FixFailure(
        String((what as { label?: unknown; target?: unknown })?.label ?? (what as { target?: unknown })?.target ?? 'a step'),
        new Error(
          `A Fix step must be { kind: 'act', target, value? } or { kind: 'code', label, action }, and was ${JSON.stringify(what)}.`
        )
      )
    );
  };

  await fix({ page, app, rng, step });
}

/** The plain-data form of a candidate, for the record. */
function journaled(candidate: SurveyedCandidate): JournaledCandidate {
  if (candidate.source === 'key') {
    return {
      source: 'key',
      role: candidate.role,
      name: candidate.name,
      key: candidate.key,
      ...(candidate.controls.length ? { controls: candidate.controls.map((c) => c.name) } : {}),
    };
  }
  return candidate.source === 'menu'
    ? {
        source: 'menu',
        role: candidate.role,
        name: candidate.name,
        menuPath: candidate.menuPath,
      }
    : { source: 'page', role: candidate.role, name: candidate.name, nth: candidate.nth };
}

/**
 * What a Hop will do to its target.
 *
 * Decided once, recorded in the journal, and then carried out by `act` exactly
 * as recorded. Working it out twice, once to write down and once to do, would
 * leave room for the record and the behavior to disagree, and the record is the
 * thing a replay trusts.
 */
async function actionFor(target: SurveyedCandidate, timeoutMs: number): Promise<HopAction> {
  if (target.source === 'menu') return 'menu-click';
  if (target.source === 'key') return 'press';
  if (takesTypedValue(target)) return 'type';
  if (target.role === 'option' || target.role === 'combobox') {
    const part = await nativeDropdownPart(target, timeoutMs);
    if (part === 'option') return 'select';
    if (part === 'dropdown') return 'focus';
  }
  return 'click';
}

/**
 * Which part of a native `<select>` a candidate is, if any.
 *
 * Asked of the page, because the accessibility tree calls a native dropdown and
 * a list built from ordinary elements by the same roles, and only the document
 * says which is which. They need different actions. In a custom list, the
 * dropdown and its options are clicked like anything else. In a native one, an
 * option cannot be clicked at all and is chosen through its dropdown, and the
 * dropdown itself is focused rather than clicked, since a click opens a popup
 * list the engine cannot use and that holds the application open. Asked only
 * for options and dropdowns, so it costs one round trip on the Hops that need
 * it and none on the rest.
 *
 * A page that does not answer is treated as no native dropdown. The click that
 * follows then times out and the Hop is recorded as abandoned, which is the
 * honest outcome for a page that has stopped answering.
 */
async function nativeDropdownPart(
  target: SurveyedCandidate,
  timeoutMs: number
): Promise<'dropdown' | 'option' | undefined> {
  if (target.source !== 'page') return undefined;
  return target.locator
    .evaluate(
      (element) => {
        if (element.tagName === 'SELECT') return 'dropdown' as const;
        if (element.closest('select') !== null) return 'option' as const;
        return undefined;
      },
      undefined,
      { timeout: timeoutMs }
    )
    .catch(() => undefined);
}

/**
 * Do the one thing this Hop does.
 *
 * Page and key actions are bounded by `timeoutMs`. **A menu click is not:** it
 * goes through the main process, which takes no timeout, so every caller wraps
 * this in a bound of its own, as the Trip and a Fix's `act` step both do. The
 * caller is also what decides that a timeout ends the Hop rather than the
 * Route. This function only acts and reports what happened.
 */
async function act(
  app: ElectronApplication,
  page: Page,
  target: SurveyedCandidate,
  action: HopAction,
  value: string,
  timeoutMs: number
): Promise<void> {
  if (target.source === 'menu') {
    await clickMenuItem(app, [...target.menuPath], page);
    return;
  }

  if (target.source === 'key') {
    // Bounded like every other action. A key press has no timeout of its own,
    // and one that opened something holding the page would otherwise hang the
    // Hop.
    await Promise.race([
      page.keyboard.press(target.key),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`press ${target.key} timed out`)), timeoutMs)
      ),
    ]);
    return;
  }

  if (action === 'type') {
    // Emptied first, so the field ends up holding the drawn value as `fill` used
    // to leave it; the emptying is not keystrokes. Then one key per character,
    // which is what reaches a handler that reacts as you type.
    //
    // **Only a field `fill` can empty is emptied.** An element marked as a
    // text box need not be an input: on Positron one was not, `fill` threw,
    // and the Route ended as though the engine had broken. Such an element
    // still takes keys, as it would from a person, so it is typed into as it
    // stands.
    await target.locator.fill('', { timeout: timeoutMs }).catch((error: unknown) => {
      if (!(error instanceof Error && /is not an <input>, <textarea>/.test(error.message))) throw error;
    });
    if (value) await target.locator.pressSequentially(value, { timeout: timeoutMs });
    return;
  }

  if (action === 'select') {
    // By the option's position in its dropdown rather than by its label, since
    // two options in one dropdown may share a label and the position cannot be
    // ambiguous. selectOption fires the input and change events a person's
    // choice would, which is what the application listens for.
    const index = await target.locator.evaluate(
      (option) => (option as HTMLOptionElement).index,
      undefined,
      { timeout: timeoutMs }
    );
    const dropdown = target.locator.locator('xpath=ancestor::select[1]');
    await dropdown.selectOption({ index }, { timeout: timeoutMs });
    return;
  }

  if (action === 'focus') {
    await target.locator.focus({ timeout: timeoutMs });
    return;
  }

  // Through its label where the control has no area of its own; see
  // `LabeledCandidate` in survey.ts.
  await (target.via ?? target.locator).click({ timeout: timeoutMs });
}

/**
 * Wait for the page to stop moving.
 *
 * **This is the second difficulty of the project after survey itself, and the
 * engine cannot delegate it.** The obvious design is for the adapter to supply
 * a signal meaning the application has settled. docs/HISTORY.md records why
 * that cannot be required: in the most favorable real case available, an
 * application that already shipped an automation bridge with someone who knew
 * exactly what signal was wanted, it was still never built. So the strategy has
 * to work with no cooperation at all.
 *
 * Harder for an explorer than for a scripted test, not easier. A test waits for
 * the one thing it is about to touch. A Route does not know what it is about to
 * touch until it has surveyed, so whatever it waits for is generic by
 * necessity.
 *
 * What this does: read the accessibility tree over and over, a frame apart,
 * and return settled once it has stayed the same for `quietMs`. That measures
 * the thing the Route actually depends on, which is the survey being stable,
 * rather than a proxy for it. R8 rests on the candidate list being identical
 * hop for hop.
 *
 * **Why a window and not two reads.** It used to stop as soon as two reads a
 * frame apart agreed. Measured on RStudio and Positron on 2026-09-24, a console
 * printing a line every 200 ms changed the tree at every sample and still read
 * as settled every time, because two reads a frame apart fall between changes.
 * docs/HISTORY.md has the measurement, and `DEFAULT_SETTLE_QUIET_MS` says how
 * the window's length was chosen.
 *
 * **An element marked `aria-busy="true"` holds the window open.** Nothing is
 * required of an application, but one that marks what it is still loading
 * gets a survey that waits for it, which a quiet tree alone cannot promise.
 *
 * **An application that never settles is not stopped here.** The wait is
 * bounded and returns unsettled, because a page that keeps moving is a finding
 * for the checks to make rather than a reason to abandon a Hop.
 */
export async function settle(
  page: Page,
  timeoutMs: number,
  quietMs: number = DEFAULT_SETTLE_QUIET_MS
): Promise<{ settled: boolean; ms: number; tree?: unknown }> {
  const startedAt = Date.now();
  let previous: string | undefined;
  let tree: unknown;
  let unchangedSince = startedAt;

  try {
    while (Date.now() - startedAt < timeoutMs) {
      // Bounded by whatever is left of the budget, and never by less than a
      // read needs. An unbounded snapshot here waits on any pending navigation,
      // and a navigation the application prevented never resolves, so the
      // settle wait would outlast its own timeout by Playwright's default
      // instead of returning unsettled.
      //
      // The floor is what keeps a busy page from reading as a stuck one. A
      // page still changing near the end of the budget used to get a last read
      // of a few milliseconds, which timed out and was reported as the page
      // having stopped answering, with the reading thrown away: measured on
      // Positron on 2026-09-26, while both of its processes answered
      // throughout. So the wait can run past its budget by up to the floor,
      // and a read that times out means the page gave no answer for that long.
      const remaining = Math.max(MIN_SETTLE_READ_MS, timeoutMs - (Date.now() - startedAt));
      tree = await page.locator('body').ariaSnapshotJSON({ timeout: remaining });
      const current = JSON.stringify(tree);
      // A page that says it is still filling something in is not settled,
      // however still it looks. `aria-busy` is the standard way to say so,
      // and the one cooperation this takes when it is offered: measured on
      // Bobolink Editor on 2026-10-01, its font list arrives after a pause in
      // which nothing on the page changes, and 3 of 25 replays of one seed
      // surveyed before it, drew from a shorter list, and chose another font.
      const busy = await page
        .evaluate(() =>
          [...document.querySelectorAll('[aria-busy="true"]')].some((element) =>
            (element as HTMLElement).checkVisibility()
          )
        )
        .catch(() => false);
      const readAt = Date.now();
      if (current !== previous || busy === true) unchangedSince = readAt;
      else if (readAt - unchangedSince >= quietMs) {
        return { settled: true, ms: readAt - startedAt, tree };
      }
      previous = current;

      // One frame, so consecutive reads span a repaint rather than two reads
      // the renderer had no chance to change anything between.
      await page
        .evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
        .catch(() => undefined);
    }
  } catch {
    // The snapshot itself timed out, given at least MIN_SETTLE_READ_MS, which
    // means the page stopped answering rather than that it kept moving. Both are "not settled" from here; the
    // hop loop is what tells them apart, because it is what has to decide
    // whether the Route can continue. No tree is handed back, so the Hop's
    // effect is recorded as unreadable rather than as nothing having changed.
    return { settled: false, ms: Date.now() - startedAt };
  }

  // Unsettled, but the last reading is still the best account of what the Hop
  // did, and the Hop's own line says it was unsettled.
  return { settled: false, ms: Date.now() - startedAt, tree };
}

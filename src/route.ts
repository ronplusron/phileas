import type { ElectronApplication, Page } from '@playwright/test';
import type { AppUnderTest } from './app-under-test';
import type { Rng, RouteStreams } from './random';
import { effectOf, type HopEffect } from './effect';
import { Journal, journalFolder, type HopAction, type JournaledCandidate } from './journal';
import { requireRun } from './journey';
import { clickMenuItem } from './menu';
import {
  createExclusionTally,
  neverMatched,
  survey,
  NondeterministicExclusion,
  takesTypedValue,
  type SurveyedCandidate,
  type SurveyResult,
} from './survey';

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
 * file can be checked on its own: the target is always the pool entry the draw
 * points at. A chooser that is not a seeded draw has nothing to put here, and
 * leaves it out rather than inventing one.
 */
export interface Choice {
  readonly target: SurveyedCandidate;
  readonly draw?: number;
  /**
   * The draw that decided between a common key and everything else, where a
   * seeded draw did. See `COMMON_KEY_SHARE`.
   */
  readonly shareDraw?: number;
}

/**
 * The share of Hops that press one of the common keys, when anything else is
 * on offer too.
 *
 * Chosen on 2026-09-24. Drawn as seven equal candidates among the rest, the
 * keys took 7 Hops in 8 on a screen with one control, crowding out the
 * controls where there are fewest of them. So a first draw decides between the
 * keys and everything else, with the keys getting this share, and a second
 * draw picks within whichever side won. At a quarter, Up is pressed about one
 * Hop in 28 on any screen, which is what reaches a console's history, and
 * controls keep three quarters of every Trip. Printed shortcuts are drawn with
 * the controls, since each belongs to one.
 */
export const COMMON_KEY_SHARE = 1 / 4;

/** Whether a candidate is one of the common keys, which draw from their own share. */
export function isCommonKey(candidate: SurveyedCandidate): boolean {
  return candidate.source === 'key' && candidate.role === 'key';
}

/**
 * The only chooser there is today: drawn from the seed, in two steps.
 *
 * The share draw is taken on every Hop, even when one side is empty, so the
 * stream advances the same way whatever the screen offered. The journal
 * records both draws, and the target is always the entry the second draw
 * points at within the side the first chose, in pool order.
 */
export const seededChooser: Chooser = {
  choose: (candidates, rng) => {
    const keys = candidates.filter(isCommonKey);
    const rest = candidates.filter((candidate) => !isCommonKey(candidate));
    const sides = Math.round(1 / COMMON_KEY_SHARE);
    const share = rng.pickWithDraw(Array.from({ length: sides }, (_, index) => index === 0));
    const side = (share.item && keys.length) || !rest.length ? keys : rest;
    const { item, draw } = rng.pickWithDraw(side);
    return { target: item, draw, shareDraw: share.draw };
  },
};

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
 */
const VALUE_CORPUS = ['', 'a', 'travel', 'Carpet', '0', '  ', 'x'.repeat(200)] as const;

export const seededValues: ValueGenerator = {
  generate: (_candidate, rng) => rng.pick(VALUE_CORPUS),
};

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
  /** Record one step of the Fix, and run it. */
  step(name: string, action: () => Promise<void>): Promise<void>;
}

/**
 * A fixed sequence of Hops that anchors the start of every Route.
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
 * while every locator call blocks: measured against the testbed on 2026-09-22,
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
    readonly target: string
  ) {
    super(
      `The page stopped answering after hop ${afterHop}, which acted on ${target}. ` +
        `Every locator call waits for a pending navigation to finish, and a navigation ` +
        `an application prevents in will-navigate never finishes, so the page stays alive ` +
        `while nothing can be surveyed. The Route ends here rather than spending the rest ` +
        `of its Trip on hops that would each time out. If this was an outbound link, the ` +
        `adapter's exclusion list is what should have kept the Route off it.`
    );
    this.name = 'PageUnreachable';
  }
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
  | { readonly kind: 'stranded'; readonly hops: number; readonly reason: string };

export interface RunRouteOptions {
  readonly page: Page;
  readonly app: ElectronApplication;
  readonly cfg: AppUnderTest;
  readonly streams: RouteStreams;
  readonly journeySeed: string;
  readonly routeIndex: number;
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
   * How long to pause after each Hop so a person can watch.
   *
   * Defaults to whatever `PHILEAS_HOP_DELAY_MS` says, so a run can be slowed
   * down from the command line without editing a Journey. See
   * `hopDelayFromEnvironment`.
   */
  readonly hopDelayMs?: number;
}

/**
 * How long a single action may take before the Hop gives up on it.
 *
 * **A Hop must not wait for navigation to finish, and this was measured rather
 * than reasoned about.** Clicking the testbed's outbound link with an ordinary
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

/** How long to wait for the page to stop moving. See `settle`. */
const DEFAULT_SETTLE_TIMEOUT_MS = 2_000;

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
 * How long to pause after each Hop, so that a person can watch one happen.
 *
 * **This is a viewing aid and nothing else.** A Route travels twenty Hops in
 * about a second, which is unwatchable even with the windows frontmost, and
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

export async function runRoute(options: RunRouteOptions): Promise<RouteOutcome> {
  const {
    page,
    app,
    cfg,
    streams,
    journeySeed,
    routeIndex,
    tripLength,
    journalsRoot,
    fix,
    chooser = seededChooser,
    values = seededValues,
    hopTimeoutMs = DEFAULT_HOP_TIMEOUT_MS,
    settleTimeoutMs = DEFAULT_SETTLE_TIMEOUT_MS,
    hopDelayMs = hopDelayFromEnvironment(),
  } = options;
  const settleQuietMs = cfg.settleQuietMs ?? DEFAULT_SETTLE_QUIET_MS;

  // Opened and flushed before the Route does anything, so that a Route which
  // dies inside its Fix still leaves a file naming the seed that produced it.
  const journal = Journal.open(journalFolder(journalsRoot, journeySeed, requireRun()), {
    journeySeed,
    routeSeed: streams.routeSeed,
    routeIndex,
    tripLength: tripLength,
    settleQuietMs,
  });

  const tally = createExclusionTally(cfg.exclusions);
  let hops = 0;
  let menuVerdictNoted = false;

  try {
    if (fix) {
      await runFix(fix, {
        page,
        app,
        rng: streams.fix,
        journal,
        settleTimeoutMs,
        settleQuietMs,
      });
    }

    let lastTarget: string | undefined;

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
        throw new PageUnreachable(hops, lastTarget);
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

      // The common keys alone do not keep a Route going: they are always on
      // offer, so counting them would mean no Route ever stranded, and a dead
      // end or a trap would read as passed. Decided 2026-09-24.
      if (found.candidates.every(isCommonKey)) {
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
      lastTarget = `${target.role} "${target.name}"`;
      const action = await actionFor(target, hopTimeoutMs);

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
      // Whether an action that never returns is itself a finding is phase 5's
      // question, and it needs the Route alive to ask it.
      let abandoned: string | undefined;
      try {
        await act(app, page, target, action, value, hopTimeoutMs);
      } catch (error) {
        abandoned = error instanceof Error ? error.message.split('\n')[0] : String(error);
      }

      const settling = await settle(page, settleTimeoutMs, settleQuietMs);

      // The pool is written first, if this file has not seen it, so the Hop
      // line below never names a pool that is not already on disk.
      const pool = journal.pool(found.candidates.map(journaled));

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
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        settled: settling.settled,
        settleMs: settling.ms,
        effect: effectOf(
          found.tree,
          settling.tree,
          'The page stopped answering while the settle wait read it, so what the Hop did could not be read.'
        ),
        checks: [],
      });

      hops += 1;

      // After the entry is written, not before, so that `durationMs` stays the
      // Hop's own cost and a watched journal is comparable with an unwatched
      // one. The pause is for eyes; it must not end up in the record as though
      // the application took that long.
      if (hopDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, hopDelayMs));
    }

    journal.close({ outcome: 'passed', hops, exclusionsNeverMatched: neverMatched(tally) });
    return { kind: 'passed', hops };
  } catch (error) {
    // Closed with an outcome rather than abandoned, because this ending was
    // caught and is therefore known. A journal with no outcome line means the
    // Route did not finish and nothing saw it stop, which is a different thing
    // and must stay distinguishable.
    journal.close({
      outcome: 'failed',
      hops,
      reason: error instanceof Error ? error.message : String(error),
      exclusionsNeverMatched: neverMatched(tally),
    });
    throw error;
  }
}

/** Why the Route had nowhere left to go, in terms a reader can act on. */
function strandedReason(found: SurveyResult): string {
  if (found.excluded.length) {
    return (
      `No candidate was available. ${found.excluded.length} were found and every one was ` +
      `excluded: ${found.excluded.map((entry) => entry.rule).join(', ')}.`
    );
  }
  if (found.unnamed.length) {
    return (
      `No candidate was available. ${found.unnamed.length} element(s) carried a hoppable ` +
      `role and no accessible name, so the Route could not reach them: ` +
      `${found.unnamed.map((element) => element.role).join(', ')}.`
    );
  }
  return (
    'No candidate was available but the common keys: the survey found nothing ' +
    'with a hoppable role.'
  );
}

/** Run the Fix, journaling each step, and wrap any failure as R11 asks. */
async function runFix(
  fix: Fix,
  context: {
    page: Page;
    app: ElectronApplication;
    rng: Rng;
    journal: Journal;
    settleTimeoutMs: number;
    settleQuietMs: number;
  }
): Promise<void> {
  const { page, app, rng, journal, settleTimeoutMs, settleQuietMs } = context;
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
  const effectAfter = async (): Promise<HopEffect> => {
    const settling = await settle(page, settleTimeoutMs, settleQuietMs);
    const effect = effectOf(
      before,
      settling.tree,
      'The page did not answer before or after this step, so what it did could not be read.'
    );
    before = settling.tree;
    return effect;
  };

  await fix({
    page,
    app,
    rng,
    step: async (name, action) => {
      const startedAt = new Date();
      const hop = steps + 1;
      try {
        await action();
      } catch (error) {
        // The failed step gets its own line, with the error on it, before the
        // failure is thrown. R11 wants a broken Fix told apart from a failed
        // Route, and that means saying which step broke rather than leaving it
        // as a sentence inside the outcome's reason.
        const effect = await effectAfter();
        journal.write({
          kind: 'fix-hop',
          hop,
          name,
          error: error instanceof Error ? error.message.split('\n')[0] : String(error),
          startedAt: startedAt.toISOString(),
          durationMs: Date.now() - startedAt.getTime(),
          effect,
          checks: [],
        });
        throw new FixFailure(name, error);
      }
      // Before the entry, as for a Trip hop, so that `durationMs` includes the
      // settle wait on both kinds of Hop.
      const effect = await effectAfter();
      journal.write({
        kind: 'fix-hop',
        hop,
        name,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        effect,
        checks: [],
      });
      steps += 1;
    },
  });
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
 * Every path through here is bounded by the caller's timeout, and the caller is
 * what decides that a timeout ends the Hop rather than the Route. This function
 * only acts and reports what happened.
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
    await clickMenuItem(app, [...target.menuPath]);
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
    await target.locator.fill('', { timeout: timeoutMs });
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

  await target.locator.click({ timeout: timeoutMs });
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
      // Bounded by whatever is left of the budget. An unbounded snapshot here
      // waits on any pending navigation, and a navigation the application
      // prevented never resolves, so the settle wait would outlast its own
      // timeout by Playwright's default instead of returning unsettled.
      const remaining = Math.max(1, timeoutMs - (Date.now() - startedAt));
      tree = await page.locator('body').ariaSnapshotJSON({ timeout: remaining });
      const current = JSON.stringify(tree);
      const readAt = Date.now();
      if (current !== previous) unchangedSince = readAt;
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
    // The snapshot itself timed out, which means the page stopped answering
    // rather than that it kept moving. Both are "not settled" from here; the
    // hop loop is what tells them apart, because it is what has to decide
    // whether the Route can continue. No tree is handed back, so the Hop's
    // effect is recorded as unreadable rather than as nothing having changed.
    return { settled: false, ms: Date.now() - startedAt };
  }

  // Unsettled, but the last reading is still the best account of what the Hop
  // did, and the Hop's own line says it was unsettled.
  return { settled: false, ms: Date.now() - startedAt, tree };
}

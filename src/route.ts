import type { ElectronApplication, Page } from '@playwright/test';
import type { AppUnderTest } from './app-under-test';
import type { Rng, RouteStreams } from './random';
import { Journal, type JournaledCandidate } from './journal';
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
 * One Route: the Fix, then hops until the budget is spent or there is nowhere
 * left to go.
 *
 * The Route is the test, not the Journey. That mapping is what gives a Route
 * its own verdict, its own timeout and its own trace, and it is why ten
 * traversals do not share one result where a single failure would take the
 * other nine with it.
 */

/**
 * Choosing the next candidate, as a named seam.
 *
 * There is exactly one implementation and it is a seeded draw, so this reads as
 * ceremony around a single line. It is not. It is what lets a different chooser
 * be added later without the traversal loop being rewritten around it, and
 * docs/OUTSTANDING.md section 2.1 records what that later chooser is expected
 * to be. Inlining it is the specific change that turns a cheap addition into an
 * expensive one, which is why ../CLAUDE.md names it at the point somebody would
 * reach for the simplification.
 */
export interface Chooser {
  choose(
    candidates: readonly SurveyedCandidate[],
    rng: Rng
  ): SurveyedCandidate | Promise<SurveyedCandidate>;
}

/** The only chooser there is today: one candidate, drawn from the seed. */
export const seededChooser: Chooser = {
  choose: (candidates, rng) => rng.pick(candidates),
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
 * Values a Hop types, drawn from the traversal stream.
 *
 * Small and ordinary on purpose. Hostile input belongs to fault injection,
 * which is a later phase with its own reporting; a value generator that reached
 * for it now would make every Route's failures about the input rather than
 * about the application, and bury what traversal itself finds.
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
  /** Draws made while following the Fix. Never the traversal's stream. */
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
/**
 * Thrown when the page stops answering the traversal after a Hop.
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
 * spend the remaining budget on Hops that will each time out. This is not
 * stranded: moves were available and the traversal took one. It is a finding,
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
    readonly chosen: string
  ) {
    super(
      `The page stopped answering after hop ${afterHop}, which acted on ${chosen}. ` +
        `Every locator call waits for a pending navigation to finish, and a navigation ` +
        `an application prevents in will-navigate never finishes, so the page stays alive ` +
        `while nothing can be surveyed. The Route ends here rather than spending the rest ` +
        `of its budget on hops that would each time out. If this was an outbound link, the ` +
        `adapter's exclusion list is what should have kept the traversal off it.`
    );
    this.name = 'PageUnreachable';
  }
}

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
  readonly hopsPerRoute: number;
  /** Where this Route's journal file is written. */
  readonly journalDir: string;
  readonly fix?: Fix;
  readonly chooser?: Chooser;
  readonly values?: ValueGenerator;
  /** How long one Hop's action may take before it is abandoned. */
  readonly hopTimeoutMs?: number;
  /** How long to wait for the page to stop moving after a Hop. */
  readonly settleTimeoutMs?: number;
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
 * The cost if this is missed is that one Hop consumes a Route's entire budget
 * and the Route reports a timeout rather than whatever it had found. The
 * exclusion list is what should keep a Route off an outbound link in the first
 * place, so this fires on the ones a list missed, which is exactly the case
 * nobody tests for.
 */
const DEFAULT_HOP_TIMEOUT_MS = 3_000;

/** How long to wait for the page to stop moving. See `settle`. */
const DEFAULT_SETTLE_TIMEOUT_MS = 2_000;

export async function runRoute(options: RunRouteOptions): Promise<RouteOutcome> {
  const {
    page,
    app,
    cfg,
    streams,
    journeySeed,
    routeIndex,
    hopsPerRoute,
    journalDir,
    fix,
    chooser = seededChooser,
    values = seededValues,
    hopTimeoutMs = DEFAULT_HOP_TIMEOUT_MS,
    settleTimeoutMs = DEFAULT_SETTLE_TIMEOUT_MS,
  } = options;

  // Opened and flushed before the Route does anything, so that a Route which
  // dies inside its Fix still leaves a file naming the seed that produced it.
  const journal = Journal.open(journalDir, {
    journeySeed,
    routeSeed: streams.routeSeed,
    routeIndex,
    hopBudget: hopsPerRoute,
  });

  const tally = createExclusionTally(cfg.exclusions);
  let hops = 0;
  let menuVerdictNoted = false;

  try {
    if (fix) await runFix(fix, { page, app, rng: streams.fix, journal });

    let lastChosen: string | undefined;

    while (hops < hopsPerRoute) {
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
        if (lastChosen === undefined || error instanceof NondeterministicExclusion) throw error;
        throw new PageUnreachable(hops - 1, lastChosen);
      }

      // Recorded once per Route rather than per Hop. A Route that never hopped
      // to a menu because none was offered would otherwise look exactly like a
      // Route that was offered menus and drew elsewhere every time.
      if (!menuVerdictNoted && !found.menuSource.offered) {
        menuVerdictNoted = true;
        journal.write({
          kind: 'note',
          hop: hops,
          note: `Menu candidates withheld: ${found.menuSource.reason}`,
          at: new Date().toISOString(),
        });
      }

      if (found.candidates.length === 0) {
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
      const chosen = await chooser.choose(found.candidates, streams.traversal);
      lastChosen = `${chosen.role} "${chosen.name}"`;

      // Drawn whether or not it is used, so that the stream advances the same
      // way regardless of which control was chosen. A value drawn only for a
      // text box would make every later draw depend on what the survey happened
      // to offer, and two runs of one seed would diverge at the first hop that
      // chose a button where the other chose a field.
      const value = values.generate(chosen, streams.traversal);

      // A bounded action that ran out of time ends the Hop, not the Route. The
      // measured case is an outbound link: the click schedules a navigation the
      // main process cancels, so from the renderer's side it never resolves.
      // Letting that end the Route would throw away every Hop the budget still
      // had, which is the cost the bound exists to prevent in the first place.
      // Whether an action that never returns is itself a finding is phase 5's
      // question, and it needs the Route alive to ask it.
      let abandoned: string | undefined;
      try {
        await act(app, chosen, takesTypedValue(chosen) ? value : undefined, hopTimeoutMs);
      } catch (error) {
        abandoned = error instanceof Error ? error.message.split('\n')[0] : String(error);
      }

      const settling = await settle(page, settleTimeoutMs);

      journal.write({
        kind: 'hop',
        hop: hops,
        phase: 'traversal',
        chosen: journaled(chosen),
        candidates: found.candidates.map(journaled),
        ...(takesTypedValue(chosen) ? { value } : {}),
        ...(abandoned === undefined ? {} : { abandoned }),
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        settled: settling.settled,
        settleMs: settling.ms,
        checks: [],
      });

      hops += 1;
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
      `role and no accessible name, so the traversal could not reach them: ` +
      `${found.unnamed.map((element) => element.role).join(', ')}.`
    );
  }
  return 'No candidate was available: the survey found nothing with a hoppable role.';
}

/** Run the Fix, journaling each step, and wrap any failure as R11 asks. */
async function runFix(
  fix: Fix,
  context: { page: Page; app: ElectronApplication; rng: Rng; journal: Journal }
): Promise<void> {
  const { page, app, rng, journal } = context;
  let index = 0;

  await fix({
    page,
    app,
    rng,
    step: async (name, action) => {
      const startedAt = new Date();
      try {
        await action();
      } catch (error) {
        throw new FixFailure(name, error);
      }
      journal.write({
        kind: 'hop',
        hop: index,
        phase: 'fix',
        chosen: { source: 'page', role: 'fix-step', name },
        candidates: [],
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        // A Fix step waits for whatever it is about to touch, because a Fix
        // knows what it is doing and the traversal does not. Reporting it as
        // settled would claim a wait that never ran.
        settled: false,
        settleMs: 0,
        checks: [],
      });
      index += 1;
    },
  });
}

/** The plain-data form of a candidate, for the record. */
function journaled(candidate: SurveyedCandidate): JournaledCandidate {
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
 * Do the one thing this Hop does.
 *
 * Every path through here is bounded by the caller's timeout, and the caller is
 * what decides that a timeout ends the Hop rather than the Route. This function
 * only acts and reports what happened.
 */
async function act(
  app: ElectronApplication,
  candidate: SurveyedCandidate,
  value: string | undefined,
  timeoutMs: number
): Promise<void> {
  if (candidate.source === 'menu') {
    await clickMenuItem(app, [...candidate.menuPath]);
    return;
  }

  if (value !== undefined) {
    await candidate.locator.fill(value, { timeout: timeoutMs });
    return;
  }

  await candidate.locator.click({ timeout: timeoutMs });
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
 * What this does: read the accessibility tree twice with a frame between, and
 * stop when two consecutive reads agree. That measures the thing the traversal
 * actually depends on, which is the survey being stable, rather than a proxy
 * for it. R8 rests on the candidate list being identical hop for hop.
 *
 * **An application that never settles is not stopped here.** The wait is
 * bounded and returns unsettled, because a page that keeps moving is a finding
 * for the checks to make rather than a reason to abandon a Hop.
 */
export async function settle(
  page: Page,
  timeoutMs: number
): Promise<{ settled: boolean; ms: number }> {
  const startedAt = Date.now();
  let previous: string | undefined;

  try {
  while (Date.now() - startedAt < timeoutMs) {
    // Bounded by whatever is left of the budget. An unbounded snapshot here
    // waits on any pending navigation, and a navigation the application
    // prevented never resolves, so the settle wait would outlast its own
    // timeout by Playwright's default instead of returning unsettled.
    const remaining = Math.max(1, timeoutMs - (Date.now() - startedAt));
    const current = JSON.stringify(
      await page.locator('body').ariaSnapshotJSON({ timeout: remaining })
    );
    if (previous !== undefined && current === previous) {
      return { settled: true, ms: Date.now() - startedAt };
    }
    previous = current;

    // One frame, so the comparison spans a repaint rather than two reads the
    // renderer had no chance to change anything between.
    await page
      .evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
      .catch(() => undefined);
  }

  } catch {
    // The snapshot itself timed out, which means the page stopped answering
    // rather than that it kept moving. Both are "not settled" from here; the
    // hop loop is what tells them apart, because it is what has to decide
    // whether the Route can continue.
    return { settled: false, ms: Date.now() - startedAt };
  }

  return { settled: false, ms: Date.now() - startedAt };
}

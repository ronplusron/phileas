import { readJournal, sourceHash, type FixStepEntry, type JournaledCandidate, type JournalEntry, type TripHopEntry } from './journal.js';
import { REPLAY_SKIPPED, targetText } from './report/render.mjs';
import type { Chooser, Fix, FixStep, ValueGenerator } from './route.js';
import type { SurveyedCandidate } from './survey.js';

/**
 * Replaying a Route from its journal rather than from its seed (R12).
 *
 * A seed replays only an unchanged application: a Hop's draw picks a position
 * in the pool, so anything that changes the pool sends it elsewhere. The
 * journal records each Hop's target by role, name and position, menu path or
 * key, and a replay acts on those by name instead of drawing, so a different
 * pool no longer sends it somewhere else as long as the control is there.
 * `docs/OUTSTANDING.md` 1.18 has the decisions, taken on 2026-10-02 and
 * 2026-10-04.
 *
 * **It is a chooser, not a runner of its own,** chosen on 2026-10-04: the
 * choosing seam was kept a named interface for exactly this, so the hop loop,
 * its checks and its journal are the ones every Route uses.
 */

/** What a replay needs from one journal: the Route it opened as, its Fix steps and Trip hops in order, and how it ended. */
export interface Recorded {
  readonly file: string;
  readonly opening: Extract<JournalEntry, { kind: 'route' }>;
  readonly fixSteps: readonly FixStepEntry[];
  readonly hops: readonly TripHopEntry[];
  readonly outcome?: Extract<JournalEntry, { kind: 'outcome' }>;
}

/** Read a journal for replaying, refusing one with no opening line, since it names no Route. */
export function readRecorded(file: string): Recorded {
  const entries = readJournal(file);
  const opening = entries.find((entry): entry is Extract<JournalEntry, { kind: 'route' }> => entry.kind === 'route');
  if (!opening) throw new Error(`${file} has no opening line, so it names no Route to replay.`);
  const outcome = entries.find((entry): entry is Extract<JournalEntry, { kind: 'outcome' }> => entry.kind === 'outcome');
  return {
    file,
    opening,
    fixSteps: entries.filter((entry): entry is FixStepEntry => entry.kind === 'fix-step'),
    hops: entries.filter((entry): entry is TripHopEntry => entry.kind === 'trip-hop'),
    ...(outcome ? { outcome } : {}),
  };
}

/** The variables `phileas replay` travels in. */
export const REPLAY_VARIABLE = 'PHILEAS_REPLAY';
export const REPLAY_WHOLE_VARIABLE = 'PHILEAS_REPLAY_WHOLE';
export const REPLAY_CURRENT_FIX_VARIABLE = 'PHILEAS_REPLAY_CURRENT_FIX';

/** How many Hops a replay covers past the one a finding came on, for one that arrives late. */
export const REPLAY_HOPS_AFTER = 3;

/** One replay, as a Route runs it. */
export interface ReplayPlan {
  readonly recorded: Recorded;
  /** How many of its Trip hops are replayed. */
  readonly count: number;
  readonly whole: boolean;
  readonly withCurrentFix: boolean;
  /** The signatures of the finding replayed, set aside from the known findings. */
  readonly setAside: readonly string[];
}

/**
 * The finding a journal records its Route failing on: every finding of every
 * failed check on the last step it wrote, the Fix's or the Trip's, that was
 * not already known. Empty for a Route that did not fail on a check.
 */
export function findingOf(recorded: Recorded): { hop?: number; signatures: string[] } {
  if (recorded.outcome?.outcome !== 'failed') return { signatures: [] };
  const steps = [...recorded.fixSteps, ...recorded.hops];
  const last = steps[steps.length - 1];
  const signatures = (last?.checks ?? [])
    .filter((check) => check.result === 'failed')
    .flatMap((check) => (check.findings ?? []).filter((finding) => !finding.known).map((finding) => finding.signature));
  return { ...(last?.kind === 'trip-hop' ? { hop: last.hop } : {}), signatures: [...new Set(signatures)] };
}

/**
 * The replay a journal asks for: to the Hop its finding came on and
 * `REPLAY_HOPS_AFTER` more, or every Hop with `whole` or where there is no
 * finding. Refused, naming the step, where a Fix step cannot be replayed from
 * the journal: one from before step kinds were recorded, or a `code` step
 * without `withCurrentFix`.
 */
export function planReplay(file: string, { whole = false, withCurrentFix = false } = {}): ReplayPlan {
  const recorded = readRecorded(file);
  for (const step of recorded.fixSteps) {
    if (step.stepKind === undefined) {
      throw new Error(
        `${file} was written before Fix steps recorded their kind, so its Fix step ${step.step}, "${step.label}", ` +
          'cannot be told apart from code. Replay a journal written since 2026-10-03.'
      );
    }
    if (step.stepKind === 'code' && !withCurrentFix) {
      throw new Error(
        `Fix step ${step.step}, "${step.label}", is code, which a journal cannot hold. Replay with ` +
          `--with-current-fix to run the current Fix's step ${step.step} in its place, checked against what was recorded.`
      );
    }
  }
  const finding = findingOf(recorded);
  const count =
    whole || finding.hop === undefined ? recorded.hops.length : Math.min(recorded.hops.length, finding.hop + REPLAY_HOPS_AFTER);
  return { recorded, count, whole, withCurrentFix, setAside: finding.signatures };
}

/** The replay this run asks for, from `phileas replay`'s variables, or none. */
export function replayFromEnvironment(): ReplayPlan | undefined {
  const file = (process.env[REPLAY_VARIABLE] ?? '').trim();
  if (!file) return undefined;
  return planReplay(file, {
    whole: process.env[REPLAY_WHOLE_VARIABLE] === '1',
    withCurrentFix: process.env[REPLAY_CURRENT_FIX_VARIABLE] === '1',
  });
}

/** An `act` step as the recorded line describes it, in the form a Fix step takes. */
function actStepOf(recorded: FixStepEntry): FixStep {
  if (!recorded.target) {
    throw new Error(`Fix step ${recorded.step}, "${recorded.label}", recorded no target, since it failed before finding one.`);
  }
  return { kind: 'act', target: targetText(recorded.target), ...(recorded.value === undefined ? {} : { value: recorded.value }) };
}

/**
 * The Fix a replay opens with. From the journal alone, its `act` steps; or,
 * with `withCurrentFix`, the consumer's current Fix, each step checked against
 * the step of the same number recorded: an `act` step must name the same
 * target and value, and a `code` step carry the same label and source hash.
 * A step that differs, or a count that differs, stops the replay: running a
 * different opening proves nothing about the recorded Route.
 */
export function replayFix(plan: ReplayPlan, current: Fix | undefined): Fix | undefined {
  const steps = plan.recorded.fixSteps;
  if (!steps.length && !plan.withCurrentFix) return undefined;
  if (!plan.withCurrentFix) {
    return async ({ step }) => {
      for (const recorded of steps) await step(actStepOf(recorded));
    };
  }
  if (!current) throw new Error('The replay was asked to run the current Fix, and the consumer gave none.');
  return async (context) => {
    let taken = 0;
    const checked: typeof context.step = async (what) => {
      const recorded = steps[taken];
      taken += 1;
      if (!recorded) throw new Error(`The current Fix takes a step ${taken}, and the recorded one took ${steps.length}.`);
      if (what.kind === 'act') {
        const value = what.value === undefined ? '' : `, typing ${JSON.stringify(what.value)}`;
        if (recorded.stepKind !== 'act' || recorded.label !== `${what.target}${value}`) {
          throw new Error(`The current Fix's step ${taken} is ${what.target}${value}, and the recorded one was "${recorded.label}".`);
        }
        return context.step(actStepOf(recorded));
      }
      if (recorded.stepKind !== 'code' || recorded.label !== what.label || recorded.sourceHash !== sourceHash(what.action.toString())) {
        throw new Error(
          `The current Fix's step ${taken}, "${what.label}", is not the code recorded as step ${recorded.step}, ` +
            `"${recorded.label}": its label or its source differs.`
        );
      }
      return context.step(what);
    };
    await current({ ...context, step: checked });
    if (taken !== steps.length) throw new Error(`The current Fix took ${taken} steps, and the recorded one took ${steps.length}.`);
  };
}

/**
 * A replay that could not go on: the recorded target is not among what the
 * screen offers now. Never a pass, and never a finding about the application:
 * the replay proves nothing past this Hop (R13, R14).
 */
export class CouldNotReplay extends Error {
  constructor(
    readonly hop: number,
    readonly wanted: JournaledCandidate,
    readonly offered: readonly JournaledCandidate[]
  ) {
    super(
      `Could not replay hop ${hop}: ${targetText(wanted)} is not on offer now. What is: ` +
        `${offered.map((candidate) => targetText(candidate)).join('; ') || 'nothing'}.`
    );
    this.name = 'CouldNotReplay';
  }
}

/**
 * Whether a candidate on offer is the recorded target, exactly: its role, name
 * and position, its menu path or its key, as the journal writes them. Exact
 * first, decided 2026-10-02; the rule loosens only where a real replay shows
 * the need.
 */
export function sameTarget(offered: JournaledCandidate, recorded: JournaledCandidate): boolean {
  return JSON.stringify(offered) === JSON.stringify(recorded);
}

/**
 * The chooser and the value generator that replay `hops`, in order, the first
 * `count` of them. `journaled` turns a surveyed candidate into the form the
 * journal writes, so the comparison is with what was recorded and not with
 * how a candidate prints.
 *
 * One pair per Route: each keeps its own count of Hops, since the seams are
 * handed no Hop number.
 */
export function replayOf(
  hops: readonly TripHopEntry[],
  journaled: (candidate: SurveyedCandidate) => JournaledCandidate,
  count = hops.length
): { chooser: Chooser; values: ValueGenerator } {
  let chosen = 0;
  const chooser: Chooser = {
    choose: (candidates) => {
      const recorded = hops[chosen];
      chosen += 1;
      if (!recorded || chosen > count) {
        throw new Error(`The replay was asked for hop ${chosen}, and replays ${Math.min(count, hops.length)}.`);
      }
      const match = candidates.find((candidate) => sameTarget(journaled(candidate), recorded.target));
      if (match) return { target: match };
      // A Hop that was abandoned did nothing, so a target no longer on offer
      // costs the replay nothing: the Hop keeps its place and is skipped. Its
      // pool was likely read while the page was still changing. See Skip.
      if (recorded.abandoned !== undefined) {
        return {
          skip: `${REPLAY_SKIPPED}: abandoned then (${recorded.abandoned}), and its target is not on offer now`,
          recorded,
        };
      }
      throw new CouldNotReplay(recorded.hop, recorded.target, candidates.map(journaled));
    },
  };
  // The value of the Hop just chosen, rather than a count of its own, so a
  // skipped Hop, which asks for no value, never shifts the ones after it.
  const values: ValueGenerator = {
    generate: () => hops[chosen - 1]?.value ?? '',
  };
  return { chooser, values };
}

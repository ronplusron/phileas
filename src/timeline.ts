/**
 * When a finding arrived, and which step of the Route was running then.
 *
 * **A check reads what piled up since it last ran, so the Hop it runs after
 * is not the Hop that caused what it read.** Measured on RStudio on
 * 2026-09-29: a Route answered Yes to installing a package at hop 27, the
 * install logged an error 5.6 s later, and the Route failed "after hop 32,
 * which acted on" a button that triggers a different known bug. So every
 * observation carries when it arrived, the failure says which step's span
 * holds that moment, and it lists the steps before it rather than naming one
 * as the cause. Nothing observed can name the cause; what this fixes is the
 * claim.
 *
 * Pure functions over plain data, so what they print is tested without
 * launching anything.
 */

import { arrivalOf, clock, LOG_TIME_SLACK_MS, placeArrival, seconds } from './arrival.mjs';
import type { Arrival, Placed } from './arrival.mjs';

// Placing an arrival lives in plain JavaScript, since `phileas show` needs it
// too and loads no TypeScript; these are the same functions.
export { arrivalOf, clock, LOG_TIME_SLACK_MS, placeArrival, seconds };
export type { Arrival, Placed };

/** An observation and when it arrived. */
export interface Observed {
  readonly text: string;
  readonly arrival: Arrival;
}

/** One step of a Route, a Fix step or a Trip hop, as a failure lists it. */
export interface StepSpan {
  /** `hop 32` or `Fix step 3`. */
  readonly name: string;
  /** What it did, as a reader would say it: `click button "Save"`. */
  readonly what: string;
  readonly startedAt: number;
  /** When its line was written, after its checks. Absent while it runs. */
  endedAt?: number;
  /** The Hop's action timed out or met nothing, so it may have done nothing. */
  abandoned?: boolean;
}

/**
 * How many steps a failure lists before its finding arrived. Ten covered the
 * measured case with room: the cause was five steps back. The journal keeps
 * every step, so this changes only what is printed.
 */
export const STEPS_LISTED = 10;

/**
 * Where a moment falls among the Route's steps: during one, between two,
 * before the first, or after the last had ended.
 *
 * **A step's span runs from its start to when its line was written**, which
 * is after its checks. The survey for the next step comes between the two, so
 * a moment there is between them, and is said to be.
 */
export function stepAt(at: number, steps: readonly StepSpan[]): string {
  const during = steps.find((step) => step.startedAt <= at && (step.endedAt === undefined || at <= step.endedAt));
  if (during) return `during ${during.name}, ${seconds(at - during.startedAt)} after it started`;
  const first = steps[0];
  if (!first || at < first.startedAt) return 'before the first step';
  const previous = [...steps].reverse().find((step) => step.endedAt !== undefined && step.endedAt < at);
  const next = steps.find((step) => step.startedAt > at);
  if (previous && next) return `between ${previous.name} and ${next.name}, ${seconds(at - (previous.endedAt ?? at))} after ${previous.name} ended`;
  if (previous) return `after ${previous.name} ended`;
  return 'before the first step';
}

/** A placed arrival, as the failure prints it. */
export function describePlaced(placed: Placed, steps: readonly StepSpan[]): string {
  if (placed.kind === 'moment') {
    const source = placed.by === 'log' ? `by the log's own time, ${clock(placed.at)}` : `at ${clock(placed.at)}`;
    return `${stepAt(placed.at, steps)} (${source})`;
  }
  const running = steps.filter(
    (step) => step.startedAt <= placed.to && (step.endedAt === undefined || step.endedAt >= placed.from)
  );
  const names = running.length
    ? running.length === 1
      ? `while ${running[0]?.name} ran`
      : `while ${running[0]?.name} to ${running[running.length - 1]?.name} ran`
    : stepAt(placed.from, steps);
  const untrusted =
    placed.untrustedLogTime === undefined
      ? '; the log gave no time the engine could read'
      : `; the log's own time, ${new Date(placed.untrustedLogTime).toISOString()}, falls outside that, so its clock is not this one`;
  return `between ${clock(placed.from)} and ${clock(placed.to)}, ${names}${untrusted}`;
}

/**
 * The steps that started at or before a moment, latest first, as the failure
 * lists them: how long before the moment each began, and what it did.
 */
export function stepsBefore(at: number, steps: readonly StepSpan[], count = STEPS_LISTED): string[] {
  const before = steps.filter((step) => step.startedAt <= at).slice(-count).reverse();
  const width = Math.max(0, ...before.map((step) => step.name.length));
  return before.map(
    (step) =>
      `${step.name.padEnd(width)}  started ${seconds(at - step.startedAt).padStart(6)} before  ${step.what}` +
      (step.abandoned ? '  (gave up)' : '')
  );
}

/** An arrival as the journal records it on a finding: times as ISO strings, absent where unknown. */
export function arrivalFields(arrival: Arrival): {
  seenAt?: string;
  seenAfter?: string;
  seenBefore?: string;
  loggedAt?: string;
} {
  const iso = (ms: number | undefined) => (ms === undefined ? undefined : new Date(ms).toISOString());
  const fields = {
    seenAt: iso(arrival.at),
    seenAfter: iso(arrival.after),
    seenBefore: iso(arrival.before),
    loggedAt: iso(arrival.loggedAt),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

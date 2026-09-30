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

/** When one observation arrived, in milliseconds since the epoch. */
export interface Arrival {
  /** When the engine saw it arrive: a listener on arrival, or the check when it ran. */
  readonly at?: number;
  /**
   * For a log line: the read before the one that found it, and that read. It
   * was written between them, and when exactly is not known unless the log
   * says.
   */
  readonly after?: number;
  readonly before?: number;
  /** A log line's own time, as the adapter's `timeOf` read it. */
  readonly loggedAt?: number;
}

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
 * How far a log's own time may fall outside the reads around it and still be
 * trusted, in milliseconds. A log that stamps whole seconds writes a time up
 * to a second before the moment itself.
 */
export const LOG_TIME_SLACK_MS = 1_000;

/**
 * How many steps a failure lists before its finding arrived. Ten covered the
 * measured case with room: the cause was five steps back. The journal keeps
 * every step, so this changes only what is printed.
 */
export const STEPS_LISTED = 10;

/** Where an arrival falls: a moment, or only a span of time. */
export type Placed =
  | { readonly kind: 'moment'; readonly at: number; readonly by: 'engine' | 'log' }
  | { readonly kind: 'span'; readonly from: number; readonly to: number; readonly untrustedLogTime?: number };

/**
 * Pin an arrival to a moment where it can be, and to the span it could lie in
 * where it cannot.
 *
 * **A log's own time is trusted only inside the reads around it.** A log can
 * stamp in another zone, whole seconds, or a time of the application's own
 * making, and a time outside the span the line could have been written in
 * says the log's clock is not this one. Then the span stands, and the log's
 * time is kept to be printed beside it. The same rule every time, so the
 * same journal always places a finding the same way.
 */
export function placeArrival(arrival: Arrival): Placed | undefined {
  const { at, after, before, loggedAt } = arrival;
  if (after !== undefined && before !== undefined) {
    if (loggedAt !== undefined && loggedAt >= after - LOG_TIME_SLACK_MS && loggedAt <= before + LOG_TIME_SLACK_MS) {
      return { kind: 'moment', at: loggedAt, by: 'log' };
    }
    return { kind: 'span', from: after, to: before, ...(loggedAt !== undefined ? { untrustedLogTime: loggedAt } : {}) };
  }
  if (at !== undefined) return { kind: 'moment', at, by: 'engine' };
  return undefined;
}

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

/** Milliseconds as seconds to a tenth, the precision a reader compares steps at. */
export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** A moment as its time of day in UTC, to the millisecond, as the journal writes times. */
export function clock(ms: number): string {
  return `${new Date(ms).toISOString().slice(11, 23)}Z`;
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

/** A finding's recorded times back into an arrival. */
export function arrivalOf(fields: {
  readonly seenAt?: string;
  readonly seenAfter?: string;
  readonly seenBefore?: string;
  readonly loggedAt?: string;
}): Arrival {
  const ms = (iso: string | undefined) => (iso === undefined ? undefined : Date.parse(iso));
  return Object.fromEntries(
    Object.entries({
      at: ms(fields.seenAt),
      after: ms(fields.seenAfter),
      before: ms(fields.seenBefore),
      loggedAt: ms(fields.loggedAt),
    }).filter(([, value]) => value !== undefined && Number.isFinite(value))
  );
}

// When something arrived, placed as a moment or a span, and said against one
// step. `timeline.ts` has why: the step a check runs after is not always the
// step that caused what it read.
//
// **Plain JavaScript, for the reason `report/render.mjs` gives:** the
// `phileas` command loads the renderer directly, from wherever a consumer
// keeps the engine, and the renderer says when each finding and each stubbed
// call arrived. `timeline.ts` re-exports what the engine needs from here.

/**
 * When one observation arrived, in milliseconds since the epoch.
 * @typedef {object} Arrival
 * @property {number} [at] When the engine saw it arrive: a listener on arrival, or the check when it ran.
 * @property {number} [after] For a log line: the read before the one that found it.
 * @property {number} [before] For a log line: the read that found it.
 * @property {number} [loggedAt] A log line's own time, as the adapter's `timeOf` read it.
 */

/**
 * Where an arrival falls: a moment, or only a span of time.
 * @typedef {{ kind: 'moment', at: number, by: 'engine' | 'log' } | { kind: 'span', from: number, to: number, untrustedLogTime?: number }} Placed
 */

/**
 * How far a log's own time may fall outside the reads around it and still be
 * trusted, in milliseconds. A log that stamps whole seconds writes a time up
 * to a second before the moment itself.
 */
export const LOG_TIME_SLACK_MS = 1_000;

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
 * @param {Arrival} arrival
 * @returns {Placed | undefined}
 */
export function placeArrival(arrival) {
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
 * A finding's recorded times back into an arrival. Times that do not parse
 * are left out, so a damaged journal places less rather than wrongly.
 * @param {{ seenAt?: string, seenAfter?: string, seenBefore?: string, loggedAt?: string }} fields
 * @returns {Arrival}
 */
export function arrivalOf(fields) {
  /** @param {string | undefined} iso */
  const ms = (iso) => (iso === undefined ? undefined : Date.parse(iso));
  return Object.fromEntries(
    Object.entries({
      at: ms(fields.seenAt),
      after: ms(fields.seenAfter),
      before: ms(fields.seenBefore),
      loggedAt: ms(fields.loggedAt),
    }).filter(([, value]) => value !== undefined && Number.isFinite(value))
  );
}

/**
 * Milliseconds as seconds to a tenth, the precision a reader compares steps at.
 * @param {number} ms
 * @returns {string}
 */
export function seconds(ms) {
  return `${(ms / 1000).toFixed(1)} s`;
}

/**
 * A moment as its time of day in UTC, to the millisecond, as the journal writes times.
 * @param {number} ms
 * @returns {string}
 */
export function clock(ms) {
  return `${new Date(ms).toISOString().slice(11, 23)}Z`;
}

/**
 * An arrival said against one step, as a Hop's own line prints it: how far
 * into the step it arrived, or how long before the step started. The line
 * knows only its own step, so it says nothing about any other; the failure's
 * reason places it among all of them.
 * @param {Arrival} arrival
 * @param {string} name The step, such as `hop 32` or `Fix step 2`.
 * @param {number} startedAt When the step started.
 * @returns {string | undefined}
 */
export function arrivalAgainst(arrival, name, startedAt) {
  const placed = placeArrival(arrival);
  if (!placed) return undefined;
  // A line whose start is missing or unreadable says the time of day instead.
  if (!Number.isFinite(startedAt)) {
    return placed.kind === 'moment' ? `at ${clock(placed.at)}` : `between ${clock(placed.from)} and ${clock(placed.to)}`;
  }
  /** @param {number} at */
  const against = (at) =>
    at >= startedAt ? `${seconds(at - startedAt)} into ${name}` : `${seconds(startedAt - at)} before ${name} started`;
  return placed.kind === 'moment' ? against(placed.at) : `between ${against(placed.from)} and ${against(placed.to)}`;
}

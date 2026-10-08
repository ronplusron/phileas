// A journal, rendered for a person to read (R30). One line per Hop.
//
// The first piece of phase 7's `report/`, moved forward on 2026-09-24 as
// docs/PLAN.md allowed: reading journals by hand was already costing time, and
// phase 5 runs Journeys many times over. It is the one reader. The journal
// stays a format made for the engine and for replay, and anything that shows a
// journal to a person goes through here: `phileas run --follow` as each line is
// written, `phileas show` for a run that has finished, and the train demo.
//
// **Plain JavaScript on purpose, checked against the journal's types.** The
// `phileas` command is plain JavaScript and loads this file directly. Node can
// load TypeScript by erasing its types, but measured on 2026-09-24 it refuses
// to for any file that sits inside node_modules, which is where a consumer that
// installs a copy of the engine keeps it. So this is JavaScript, with its types
// written as comments that the compiler checks (tsconfig's checkJs), and it
// imports only plain JavaScript, `../legacy.mjs`, so it loads from anywhere.

import { arrivalAgainst, arrivalOf } from '../arrival.mjs';
import { currentEntry } from '../legacy.mjs';

/** @typedef {import('../effect').HopEffect} HopEffect */
/** @typedef {import('../journal').JournalEntry} JournalEntry */
/** @typedef {import('../journal').JournaledCandidate} JournaledCandidate */

/**
 * Set to 1 by `phileas run` when the engine's own reporter prints the run, so
 * what a Route prints as it goes, and what a Journey's end prints, leave to
 * it what it says once and better. A run without it, such as plain
 * `playwright test`, prints everything where it happens, as before.
 */
export const REPORTER_VARIABLE = 'PHILEAS_REPORTER';

/** Whether the engine's reporter is printing this run. */
export function reporterInUse() {
  return process.env[REPORTER_VARIABLE] === '1';
}

/**
 * Where a Journey's end leaves what it did to the known findings for the
 * reporter, which runs in the same process: `{ findings, file }`.
 */
export const JOURNEY_END = Symbol.for('phileas.journeyEnd');

/**
 * Set by the reporter as it is made, in the process that later runs the
 * Journey's end, which hands its findings over only when this is set. Read
 * there rather than the variable, so a variable left in the shell cannot make
 * a Journey's end hand its findings to a reporter that is not there.
 */
export const REPORTER_PRESENT = Symbol.for('phileas.reporterPresent');

/**
 * How a replay's skipped Hop's `abandoned` begins: one recorded as abandoned
 * whose target is not on offer now, skipped in its place. The replay writes
 * it and the reporter counts it, so a replay is never said to have landed
 * every Hop when it skipped one.
 */
export const REPLAY_SKIPPED = 'replayed as recorded';

/** Whether the engine's reporter is in this process, waiting for a Journey's end. */
export function reporterPresent() {
  return /** @type {Record<symbol, unknown>} */ (globalThis)[REPORTER_PRESENT] === true;
}

/**
 * A Route as a person reads it. Routes count from 1, as Hops do.
 *
 * A journal whose opening line is missing has no Route number, and says so
 * rather than printing one.
 * @param {number} routeNumber
 * @returns {string}
 */
export function routeLabel(routeNumber) {
  return routeNumber >= 1 ? `route ${routeNumber}` : 'route ?';
}

/**
 * The effect of a Hop, as a person reads it.
 * @param {HopEffect | undefined} effect
 * @returns {string}
 */
export function effectText(effect) {
  if (!effect) return '';
  if (!effect.readable) return `could not read the screen: ${effect.reason}`;
  if (!effect.changed) return 'no change';
  const parts = [
    ...effect.appeared.map((heading) => `+ ${heading}`),
    ...(effect.appearedMore ? [`+ ${effect.appearedMore} more`] : []),
    ...effect.wentAway.map((heading) => `- ${heading}`),
    ...(effect.wentAwayMore ? [`- ${effect.wentAwayMore} more`] : []),
  ];
  return parts.length ? parts.join('   ') : 'changed, no heading moved';
}

/**
 * What a Hop acted on, as a person reads it.
 * @param {JournaledCandidate} target
 * @returns {string}
 */
export function targetText(target) {
  if (target.source === 'key') return target.role === 'shortcut' ? `shortcut ${target.name}` : `key ${target.name}`;
  if (target.source === 'menu') return `menu ${(target.menuPath ?? [target.name]).join(' > ')}`;
  return `${target.role} "${target.name}"`;
}

/**
 * Text padded to a column, and never run into the next one: something that
 * fills its column still gets one space after it.
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
function column(text, width) {
  return text.length < width ? text.padEnd(width) : `${text} `;
}

/**
 * Text cut to fit `limit` characters, for the screen; the journal keeps it
 * whole, and a Fix step still names a control by its full line.
 *
 * Measured on trickster-tales on 2026-09-26: a tale card is one button whose
 * accessible name is the whole story, several hundred characters, which pushed
 * what changed off the end of the line with no space before it.
 *
 * A menu path is cut in the middle, keeping its first menu and the entry
 * itself, since the entry is what was clicked: `menu Edit > ... > Text
 * Replacement`. Anything else, or a menu path still too long that way, is cut
 * at the end.
 * @param {string} text
 * @param {number} limit
 * @returns {string}
 */
export function shortened(text, limit) {
  if (text.length <= limit) return text;
  const parts = text.startsWith('menu ') ? text.slice('menu '.length).split(' > ') : [];
  if (parts.length > 2) {
    const middle = `menu ${parts[0]} > ... > ${parts[parts.length - 1]}`;
    if (middle.length <= limit) return middle;
  }
  return `${text.slice(0, limit - 3)}...`;
}

/**
 * A typed value, shortened for the screen; the journal keeps it whole.
 * @param {string | undefined} value
 * @returns {string}
 */
function valueText(value) {
  if (value === undefined) return '';
  return value.length > 12 ? `"${value.slice(0, 8)}..." (${value.length} characters)` : `"${value}"`;
}

/**
 * The checks that failed on a Hop, as a suffix to its line, or nothing.
 *
 * Only failures are printed. A line listing eight passes per Hop would bury
 * the one Hop that matters, and the journal keeps every result, not-run
 * included, for anyone who wants them.
 * A failed check gives the id of what it found, which is what
 * `phileas known add` takes to file it, and when it arrived against this
 * step: the step a check runs after is not always the one that caused what it
 * read, and a line that named only its own step would say so by omission.
 *
 * Brief, the observations are left out and only each check's name and
 * finding stay, for a run whose reporter prints the observations once under
 * the Route's ending: a line carrying three of them ran to a thousand
 * characters, measured on Positron on 2026-10-02.
 * @param {readonly { check: string, result?: string, observation?: string, findings?: readonly { id: string, known: boolean, seenAt?: string, seenAfter?: string, seenBefore?: string, loggedAt?: string }[] }[] | undefined} checks
 * @param {Step} step
 * @param {boolean} [brief]
 * @returns {string}
 */
function failedText(checks, step, brief = false) {
  const failed = (checks ?? []).filter((check) => check.result === 'failed');
  if (!failed.length) return '';
  return `   CHECK FAILED: ${failed
    .map((check) => {
      const unknown = (check.findings ?? []).filter((finding) => !finding.known);
      // One id per finding, however many times the Hop saw it, with when the
      // first of them arrived. A journal from before 2026-09-30 has no times.
      const ids = unknown
        .filter((finding, index) => unknown.findIndex((other) => other.id === finding.id) === index)
        .map((finding) => {
          const arrived = arrivalAgainst(arrivalOf(finding), step.name, step.startedAt);
          return arrived ? `finding ${finding.id}, arrived ${arrived}` : `finding ${finding.id}`;
        });
      if (brief) return `${check.check}${ids.length ? ` (${ids.join('; ')})` : ''}`;
      return `${check.check}: ${(check.observation ?? '').split('\n')[0]}${ids.length ? ` (${ids.join('; ')})` : ''}`;
    })
    .join('; ')}`;
}

/**
 * The step a line is for, as its arrivals are said against it.
 * @typedef {{ name: string, startedAt: number }} Step
 */

/**
 * The known findings a Hop carried on past, as a suffix to its line, or
 * nothing. Printed, since a Route traveling past a bug should never read as
 * a Hop where nothing happened.
 * @param {readonly { findings?: readonly { id: string, known: boolean, issue?: string, falseAlarm?: string }[] }[] | undefined} checks
 * @returns {string}
 */
function knownText(checks) {
  const every = (checks ?? []).flatMap((check) => (check.findings ?? []).filter((finding) => finding.known));
  const known = every.filter((finding, index) => every.findIndex((other) => other.id === finding.id) === index);
  if (!known.length) return '';
  return `   known: ${known.map((finding) => `${finding.id} (${finding.issue ? `issue ${finding.issue}` : finding.falseAlarm !== undefined ? 'false alarm' : 'unfiled'})`).join(', ')}`;
}

/**
 * A window found blank and then showing something again within the check's
 * wait, as a suffix to the step's line, or nothing. Printed, since the check
 * passed and a brief blank can still be a bug.
 * @param {readonly { recovered?: { afterMs: number } }[] | undefined} checks
 * @returns {string}
 */
export function recoveredText(checks) {
  const recovered = (checks ?? []).find((check) => check.recovered)?.recovered;
  return recovered ? `   (window blank, then showed something again ${recovered.afterMs} ms later)` : '';
}

/**
 * What took an abandoned Hop's click, as `; under <element>`, or the empty
 * string where the journal does not say. Shortened, since Playwright names
 * the element with its attributes and the element around it.
 * @param {string | undefined} interceptedBy
 * @returns {string}
 */
export function underText(interceptedBy) {
  if (!interceptedBy) return '';
  return `; under ${shortened(interceptedBy.replace(/ intercepts pointer events$/, ''), 80)}`;
}

/**
 * What the engine's stubs caught on a Hop, or the empty string for a Hop where
 * they caught nothing, so a Hop whose effect was stopped does not read like one
 * that did nothing. Each with when it came against this step, where the
 * journal has it: a call that came after a delay is read on a later step, as
 * a late error is.
 * @param {import('../caught').CaughtByStubs | undefined} caught
 * @param {Step} [step]
 * @returns {string}
 */
export function caughtText(caught, step) {
  if (!caught) return '';
  /**
   * @param {'selfLaunches' | 'outbound' | 'opened' | 'dialogs'} field
   * @param {number} index
   */
  const when = (field, index) => {
    const at = caught.at?.[field]?.[index];
    const arrived = at === undefined || !step ? undefined : arrivalAgainst(arrivalOf({ seenAt: at }), step.name, step.startedAt);
    return arrived ? ` (${arrived})` : '';
  };
  const parts = [
    ...(caught.selfLaunches ?? []).map((_, i) => `a second copy of the application${when('selfLaunches', i)}`),
    ...(caught.outbound ?? []).map((url, i) => `link ${url}${when('outbound', i)}`),
    ...(caught.opened ?? []).map((call, i) => `open ${call}${when('opened', i)}`),
    ...(caught.dialogs ?? []).map(
      (call, i) => `native dialog ${call.kind}${call.text ? ` "${call.text}"` : ''}${when('dialogs', i)}`
    ),
    ...(caught.notInstalled ?? []).map((field) => `stub not installed: ${field}`),
    ...(caught.unreadable ? [`stubs unreadable: ${caught.unreadable}`] : []),
  ];
  return parts.length ? `   (stubbed: ${parts.join('; ')})` : '';
}

/**
 * The first sentence of a reason, without a colon it ends on: "3 checks failed
 * after hop 56, which is when the checks read it." from the whole failure.
 * @param {string} text
 * @returns {string}
 */
export function firstSentence(text) {
  const line = text.split('\n')[0] ?? '';
  const end = line.search(/[.:](\s|$)/);
  const sentence = end === -1 ? line : line.slice(0, end + (line[end] === '.' ? 1 : 0));
  return sentence.trim();
}

/**
 * One journal entry as one line, or nothing for an entry a person has no use
 * for, which is a pool: every Hop already names what it acted on.
 *
 * The Route's number comes from the caller for every entry but the opening one,
 * since a Hop line does not carry it.
 *
 * `brief` is for a run the engine's reporter is printing, which says what a
 * failed check saw once, under the Route's ending: a failed Hop names each
 * check and its finding without what it saw, and a failed Route's line keeps
 * the first sentence of its reason. `phileas show` is never brief, since a
 * journal read on its own has nothing printed under it.
 * @param {JournalEntry} entry
 * @param {number} routeNumber
 * @param {{ brief?: boolean }} [options]
 * @returns {string | undefined}
 */
export function renderEntry(entry, routeNumber, { brief = false } = {}) {
  const route = routeLabel(routeNumber);
  switch (entry.kind) {
    case 'route':
      return (
        `${route}  seed ${entry.routeSeed}, from Journey seed ${entry.journeySeed}, ` +
        `Trip of ${entry.tripLength} hops`
      );
    case 'pool':
      return undefined;
    case 'fix-step': {
      const step = { name: `Fix step ${entry.step}`, startedAt: Date.parse(entry.startedAt) };
      // The step's kind sits where a Trip hop's action does, blank in a
      // journal written before kinds were recorded.
      return [
        column(`${route}  fix ${entry.step}`, 18),
        column(entry.stepKind ?? '', 11),
        column(shortened(entry.label, 43), 44),
        entry.error ? `failed: ${entry.error}` : effectText(entry.effect),
        caughtText(entry.caught, step),
        recoveredText(entry.checks),
        knownText(entry.checks),
        failedText(entry.checks, step, brief),
      ].join('');
    }
    case 'trip-hop': {
      const step = { name: `hop ${entry.hop}`, startedAt: Date.parse(entry.startedAt) };
      const value = entry.action === 'type' || entry.action === 'fill' ? valueText(entry.value) : '';
      return [
        column(`${route}  hop ${entry.hop}`, 18),
        column(entry.action, 11),
        column(shortened(targetText(entry.target), 43), 44),
        value ? `${value}   ` : '',
        effectText(entry.effect),
        entry.abandoned ? `   (gave up: ${entry.abandoned}${underText(entry.interceptedBy)})` : '',
        caughtText(entry.caught, step),
        recoveredText(entry.checks),
        knownText(entry.checks),
        failedText(entry.checks, step, brief),
      ].join('');
    }
    case 'note':
      return `${route}  note before hop ${entry.hop}: ${entry.note}`;
    case 'outcome': {
      const reason = entry.reason && brief && entry.outcome === 'failed' ? firstSentence(entry.reason) : entry.reason;
      return `${route}  ${entry.outcome} after ${entry.hops} hops${reason ? `: ${reason}` : ''}`;
    }
    default:
      return undefined;
  }
}

/**
 * A whole journal file's text, as lines, from the journal alone.
 *
 * Reads a file cut off mid-write, as R30 asks, and says so rather than ending
 * quietly: a Route with no outcome line did not finish, which is worth knowing.
 * A broken line in the middle is reported where it sits and reading goes on,
 * since a person wants every Hop that can still be read.
 * @param {string} text
 * @returns {string[]}
 */
export function renderJournal(text) {
  const lines = text.split('\n');
  /** @type {string[]} */
  const out = [];
  let routeNumber = 0; // unknown until the opening line is read
  let finished = false;
  for (const [index, raw] of lines.entries()) {
    if (raw.trim() === '') continue;
    /** @type {JournalEntry} */
    let entry;
    try {
      entry = currentEntry(JSON.parse(raw));
    } catch {
      const last = lines.slice(index + 1).every((rest) => rest.trim() === '');
      out.push(
        last
          ? `${routeLabel(routeNumber)}  the journal ends partway through a line, where the Route stopped`
          : `${routeLabel(routeNumber)}  line ${index + 1} of the journal cannot be read`
      );
      continue;
    }
    if (entry.kind === 'route') routeNumber = entry.routeNumber;
    if (entry.kind === 'outcome') finished = true;
    const line = renderEntry(entry, routeNumber);
    if (line) out.push(line);
  }
  if (!finished) out.push(`${routeLabel(routeNumber)}  no outcome recorded: the Route did not finish`);
  return out;
}

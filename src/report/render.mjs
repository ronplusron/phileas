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

import { currentEntry } from '../legacy.mjs';

/** @typedef {import('../effect').HopEffect} HopEffect */
/** @typedef {import('../journal').JournalEntry} JournalEntry */
/** @typedef {import('../journal').JournaledCandidate} JournaledCandidate */

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
 * `phileas known add` takes to file it.
 * @param {readonly { check: string, result?: string, observation?: string, findings?: readonly { id: string, known: boolean }[] }[] | undefined} checks
 * @returns {string}
 */
function failedText(checks) {
  const failed = (checks ?? []).filter((check) => check.result === 'failed');
  if (!failed.length) return '';
  return `   CHECK FAILED: ${failed
    .map((check) => {
      // One id per finding, however many times the Hop saw it.
      const ids = [...new Set((check.findings ?? []).filter((finding) => !finding.known).map((finding) => finding.id))];
      return `${check.check}: ${(check.observation ?? '').split('\n')[0]}${ids.length ? ` (finding ${ids.join(', ')})` : ''}`;
    })
    .join('; ')}`;
}

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
 * that did nothing.
 * @param {import('../caught').CaughtByStubs | undefined} caught
 * @returns {string}
 */
export function caughtText(caught) {
  if (!caught) return '';
  const parts = [
    ...(caught.selfLaunches ?? []).map(() => 'a second copy of the application'),
    ...(caught.outbound ?? []).map((url) => `link ${url}`),
    ...(caught.opened ?? []).map((call) => `open ${call}`),
    ...(caught.dialogs ?? []).map((call) => `native dialog ${call.kind}${call.text ? ` "${call.text}"` : ''}`),
    ...(caught.notInstalled ?? []).map((field) => `stub not installed: ${field}`),
    ...(caught.unreadable ? [`stubs unreadable: ${caught.unreadable}`] : []),
  ];
  return parts.length ? `   (stubbed: ${parts.join('; ')})` : '';
}

/**
 * One journal entry as one line, or nothing for an entry a person has no use
 * for, which is a pool: every Hop already names what it acted on.
 *
 * The Route's number comes from the caller for every entry but the opening one,
 * since a Hop line does not carry it.
 * @param {JournalEntry} entry
 * @param {number} routeNumber
 * @returns {string | undefined}
 */
export function renderEntry(entry, routeNumber) {
  const route = routeLabel(routeNumber);
  switch (entry.kind) {
    case 'route':
      return (
        `${route}  seed ${entry.routeSeed}, from Journey seed ${entry.journeySeed}, ` +
        `Trip of ${entry.tripLength} hops`
      );
    case 'pool':
      return undefined;
    case 'fix-step':
      return [
        column(`${route}  fix ${entry.step}`, 18),
        column(shortened(entry.label, 39), 40),
        entry.error ? `failed: ${entry.error}` : effectText(entry.effect),
        caughtText(entry.caught),
        knownText(entry.checks),
        failedText(entry.checks),
      ].join('');
    case 'trip-hop': {
      const value = entry.action === 'type' || entry.action === 'fill' ? valueText(entry.value) : '';
      return [
        column(`${route}  hop ${entry.hop}`, 18),
        column(entry.action, 11),
        column(shortened(targetText(entry.target), 43), 44),
        value ? `${value}   ` : '',
        effectText(entry.effect),
        entry.abandoned ? `   (gave up: ${entry.abandoned}${underText(entry.interceptedBy)})` : '',
        caughtText(entry.caught),
        knownText(entry.checks),
        failedText(entry.checks),
      ].join('');
    }
    case 'note':
      return `${route}  note before hop ${entry.hop}: ${entry.note}`;
    case 'outcome':
      return `${route}  ${entry.outcome} after ${entry.hops} hops${entry.reason ? `: ${entry.reason}` : ''}`;
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

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
// imports nothing, so it loads from anywhere.

/** @typedef {import('../effect').HopEffect} HopEffect */
/** @typedef {import('../journal').JournalEntry} JournalEntry */
/** @typedef {import('../journal').JournaledCandidate} JournaledCandidate */

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
 * A typed value, shortened for the screen; the journal keeps it whole.
 * @param {string | undefined} value
 * @returns {string}
 */
function valueText(value) {
  if (value === undefined) return '';
  return value.length > 12 ? `"${value.slice(0, 8)}..." (${value.length} characters)` : `"${value}"`;
}

/**
 * One journal entry as one line, or nothing for an entry a person has no use
 * for, which is a pool: every Hop already names what it acted on.
 *
 * The Route's index comes from the caller for every entry but the opening one,
 * since a Hop line does not carry it.
 * @param {JournalEntry} entry
 * @param {number} routeIndex
 * @returns {string | undefined}
 */
export function renderEntry(entry, routeIndex) {
  const route = `route ${routeIndex}`;
  switch (entry.kind) {
    case 'route':
      return (
        `${route}  seed ${entry.routeSeed}, from Journey seed ${entry.journeySeed}, ` +
        `Trip of ${entry.tripLength} hops`
      );
    case 'pool':
      return undefined;
    case 'fix-hop':
      return [
        `${route}  fix ${entry.hop}`.padEnd(18),
        entry.name.padEnd(40),
        entry.error ? `failed: ${entry.error}` : effectText(entry.effect),
      ].join('');
    case 'trip-hop': {
      const value = entry.action === 'type' || entry.action === 'fill' ? valueText(entry.value) : '';
      return [
        `${route}  hop ${entry.hop}`.padEnd(18),
        entry.action.padEnd(11),
        targetText(entry.target).padEnd(44),
        value ? `${value}   ` : '',
        effectText(entry.effect),
        entry.abandoned ? `   (gave up: ${entry.abandoned})` : '',
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
  let routeIndex = -1;
  let finished = false;
  for (const [index, raw] of lines.entries()) {
    if (raw.trim() === '') continue;
    /** @type {JournalEntry} */
    let entry;
    try {
      entry = JSON.parse(raw);
    } catch {
      const last = lines.slice(index + 1).every((rest) => rest.trim() === '');
      out.push(
        last
          ? `route ${routeIndex}  the journal ends partway through a line, where the Route stopped`
          : `route ${routeIndex}  line ${index + 1} of the journal cannot be read`
      );
      continue;
    }
    if (entry.kind === 'route') routeIndex = entry.routeIndex;
    if (entry.kind === 'outcome') finished = true;
    const line = renderEntry(entry, routeIndex);
    if (line) out.push(line);
  }
  if (!finished) out.push(`route ${routeIndex}  no outcome recorded: the Route did not finish`);
  return out;
}

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
/** @typedef {import('../build').JournaledBuild} JournaledBuild */
/** @typedef {import('../platform').JournaledPlatform} JournaledPlatform */
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
 * What a Hop acted on, as a person reads it. A control drawn in a frame is
 * named after each frame it sits inside, outermost first, as `frameText`
 * names one: `frame "Data Browser" > button "Pin column mpg"`, which is also
 * what a Fix's `act` step takes.
 * @param {JournaledCandidate} target
 * @returns {string}
 */
export function targetText(target) {
  if (target.source === 'key') return target.role === 'shortcut' ? `shortcut ${target.name}` : `key ${target.name}`;
  if (target.source === 'menu') return `menu ${(target.menuPath ?? [target.name]).join(' > ')}`;
  const frames = (target.frame ?? []).map((frame) => `${frameText(frame)} > `).join('');
  return `${frames}${target.role} "${target.name}"`;
}

/**
 * How a frame is named in a target: `frame "Luggage tags"`, and the second
 * of two sharing that label `frame "Luggage tags" #2`, so a Fix step can name
 * either. The first prints no position, so every line printed before
 * positions were prints as it did.
 * @param {{ label: string, nth: number }} frame
 * @returns {string}
 */
export function frameText(frame) {
  return frame.nth > 1 ? `frame "${frame.label}" #${frame.nth}` : `frame "${frame.label}"`;
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
 * How many of the checks other than the universal ones ran on a step, as a
 * suffix to its line, or nothing: `checked: 10`. Agreed on 2026-10-16
 * (docs/HISTORY.md, 2026-10-16) so a step says how much was looked at without
 * naming checks that passed; a failed one is still named, by `failedText`.
 * Out of the opening line's `checksInForce`, so a journal from before that
 * date, which has none, prints no count rather than one counted from lines
 * that held every check.
 * @param {readonly { check: string, result?: string }[] | undefined} checks
 * @param {Extract<JournalEntry, { kind: 'route' }> | undefined} opening
 * @returns {string}
 */
function checkedText(checks, opening) {
  const count = checkedOf(checks, opening);
  return count ? `   checked: ${count}` : '';
}

/**
 * The count `checkedText` prints, or undefined where there is nothing to say.
 * A check recorded as not run on the step, one that could not look, is not
 * counted, since it checked nothing.
 * @param {readonly { check: string, result?: string }[] | undefined} checks
 * @param {Extract<JournalEntry, { kind: 'route' }> | undefined} opening
 * @returns {number | undefined}
 */
function checkedOf(checks, opening) {
  const inForce = new Set(opening?.checksInForce ?? []);
  if (!inForce.size) return undefined;
  const count = (checks ?? []).filter((check) => inForce.has(check.check) && check.result !== 'not-run').length;
  return count || undefined;
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
  const failed = failedOf(checks, step);
  if (!failed.length) return '';
  return `   CHECK FAILED: ${failed
    .map((check) => {
      const ids = check.findings.map((finding) =>
        finding.arrived ? `finding ${finding.id}, arrived ${finding.arrived}` : `finding ${finding.id}`
      );
      if (brief) return `${check.check}${ids.length ? ` (${ids.join('; ')})` : ''}`;
      return `${check.check}: ${check.observation}${ids.length ? ` (${ids.join('; ')})` : ''}`;
    })
    .join('; ')}`;
}

/**
 * The checks that failed on a Hop, each with the first line of what it saw
 * and the new findings it made, each once, with when the first of them
 * arrived against this step. A journal from before 2026-09-30 has no times.
 * @param {readonly { check: string, result?: string, observation?: string, findings?: readonly { id: string, known: boolean, seenAt?: string, seenAfter?: string, seenBefore?: string, loggedAt?: string }[] }[] | undefined} checks
 * @param {Step} step
 * @returns {{ check: string, observation: string, findings: { id: string, arrived?: string }[] }[]}
 */
function failedOf(checks, step) {
  return (checks ?? [])
    .filter((check) => check.result === 'failed')
    .map((check) => {
      const unknown = (check.findings ?? []).filter((finding) => !finding.known);
      return {
        check: check.check,
        observation: (check.observation ?? '').split('\n')[0] ?? '',
        findings: unknown
          .filter((finding, index) => unknown.findIndex((other) => other.id === finding.id) === index)
          .map((finding) => {
            const arrived = arrivalAgainst(arrivalOf(finding), step.name, step.startedAt);
            return arrived ? { id: finding.id, arrived } : { id: finding.id };
          }),
      };
    });
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
  const known = knownOf(checks);
  if (!known.length) return '';
  return `   known: ${known.map((finding) => `${finding.id} (${finding.standing})`).join(', ')}`;
}

/**
 * The known findings a Hop carried on past, each once, with how it stood
 * when the Route ran: `issue <n>`, `false alarm` or `unfiled`.
 * @param {readonly { findings?: readonly { id: string, known: boolean, issue?: string, falseAlarm?: string }[] }[] | undefined} checks
 * @returns {{ id: string, standing: string }[]}
 */
function knownOf(checks) {
  const every = (checks ?? []).flatMap((check) => (check.findings ?? []).filter((finding) => finding.known));
  return every
    .filter((finding, index) => every.findIndex((other) => other.id === finding.id) === index)
    .map((finding) => ({
      id: finding.id,
      standing: finding.issue ? `issue ${finding.issue}` : finding.falseAlarm !== undefined ? 'false alarm' : 'unfiled',
    }));
}

/**
 * A window found blank and then showing something again within the check's
 * wait, as a suffix to the step's line, or nothing. Printed, since the check
 * passed and a brief blank can still be a bug.
 * @param {readonly { recovered?: { afterMs: number } }[] | undefined} checks
 * @returns {string}
 */
export function recoveredText(checks) {
  const { recovered } = recoveredOf(checks);
  return recovered ? `   (${recovered})` : '';
}

/**
 * A window found blank and then showing something again, as `{ recovered }`
 * in words, or nothing.
 * @param {readonly { recovered?: { afterMs: number } }[] | undefined} checks
 * @returns {{ recovered?: string }}
 */
function recoveredOf(checks) {
  const recovered = (checks ?? []).find((check) => check.recovered)?.recovered;
  return recovered ? { recovered: `window blank, then showed something again ${recovered.afterMs} ms later` } : {};
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
  const parts = caughtParts(caught, step);
  return parts.length ? `   (stubbed: ${parts.join('; ')})` : '';
}

/**
 * What the engine's stubs caught on a Hop, one item each, as `caughtText`
 * prints them.
 * @param {import('../caught').CaughtByStubs | undefined} caught
 * @param {Step} [step]
 * @returns {string[]}
 */
function caughtParts(caught, step) {
  if (!caught) return [];
  /**
   * @param {'selfLaunches' | 'outbound' | 'opened' | 'dialogs'} field
   * @param {number} index
   */
  const when = (field, index) => {
    const at = caught.at?.[field]?.[index];
    const arrived = at === undefined || !step ? undefined : arrivalAgainst(arrivalOf({ seenAt: at }), step.name, step.startedAt);
    return arrived ? ` (${arrived})` : '';
  };
  return [
    ...(caught.selfLaunches ?? []).map((_, i) => `a second copy of the application${when('selfLaunches', i)}`),
    ...(caught.outbound ?? []).map((url, i) => `link ${url}${when('outbound', i)}`),
    ...(caught.opened ?? []).map((call, i) => `open ${call}${when('opened', i)}`),
    ...(caught.dialogs ?? []).map(
      (call, i) => `native dialog ${call.kind}${call.text ? ` "${call.text}"` : ''}${when('dialogs', i)}`
    ),
    ...(caught.notInstalled ?? []).map((field) => `stub not installed: ${field}`),
    ...(caught.unreadable ? [`stubs unreadable: ${caught.unreadable}`] : []),
  ];
}

/**
 * Which build a Route ran against, as its opening line says it: the name and
 * version, the adapter's name for the release beside the bundle's version
 * where the two differ, what the adapter says it runs with, and whether the
 * staleness guard compared it with its sources. Whatever could not be read
 * says so, and a journal from before builds were recorded says that (C1).
 * Without `setup`, what the adapter said it set the application up with is
 * left out, for a reader that says it beside what ran, by `setupText`.
 * @param {JournaledBuild | undefined} build
 * @param {{ setup?: boolean }} [options]
 * @returns {string}
 */
export function buildText(build, { setup = true } = {}) {
  if (!build) return 'build not recorded';
  const version = build.release ?? build.version;
  // A name or version left out here is named in `unread`, which follows.
  const parts = [
    [
      build.name,
      version,
      build.release && build.version && build.release !== build.version ? `(bundle ${build.version})` : '',
      build.build ? `build ${build.build}` : '',
    ]
      .filter(Boolean)
      .join(' ') || 'a build whose name and version were not read',
  ];
  if (build.unread) parts.push(`not all read: ${build.unread}`);
  const runsWith = Object.entries(build.runsWith ?? {});
  if (setup && runsWith.length) parts.push(`with ${runsWith.map(([name, value]) => `${name} ${value}`).join(', ')}`);
  if (setup && build.runsWithUnread) parts.push(`what it runs with unread: ${build.runsWithUnread}`);
  const sources = build.sources;
  if (sources && 'compared' in sources) parts.push(`checked against its sources, ${sources.compared} files`);
  else if (sources?.notCompared === 'no-sources') parts.push('no sources to check it against');
  else if (sources?.notCompared === 'skipped-by-switch') parts.push('not checked against its sources, by PHILEAS_ALLOW_STALE');
  return parts.join('; ');
}

/**
 * Which operating system and architecture a Route ran on, as its opening line
 * says them: the system and its version and build, the machine's
 * architecture, and the application's own where it ran as another. The
 * kernel is named only where the system's own version was not read, since it
 * is then the only version there is. Whatever could not be read says so, and
 * a journal from before 2026-10-12 says the platform was not recorded.
 * @param {JournaledPlatform | undefined} platform
 * @returns {string}
 */
export function platformText(platform) {
  if (!platform) return 'platform not recorded';
  const parts = [
    [
      platform.os,
      platform.version,
      platform.osBuild ? `(${platform.osBuild})` : '',
      !platform.version && platform.kernel ? `kernel ${platform.kernel}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  ];
  if (platform.arch) parts.push(platform.arch);
  if (platform.appArch && platform.appArch !== platform.arch) parts.push(`the application ran as ${platform.appArch}`);
  if (platform.unread) parts.push(`not all read: ${platform.unread}`);
  return parts.join(', ');
}

/**
 * What a Route's application was seen to run with, from its outcome line:
 * each name with every value it took, `nothing started` where the adapter
 * reads it and saw nothing, and why a read failed. Empty where the adapter
 * does not read it, or the journal is from before 2026-10-12.
 * @param {Extract<JournalEntry, { kind: 'outcome' }>} outcome
 * @returns {string}
 */
export function ranWithText(outcome) {
  const parts = [];
  if (outcome.ranWith === 'none') parts.push('nothing started');
  else if (outcome.ranWith) parts.push(Object.entries(outcome.ranWith).map(([name, values]) => `${name} ${values.join(' then ')}`).join(', '));
  if (outcome.ranWithUnread) parts.push(`not all read: ${outcome.ranWithUnread}`);
  return parts.length ? `ran with ${parts.join('; ')}` : '';
}

/**
 * What the adapter set the application up with, from the opening line, said
 * only where what ran does not bear it out: "set up for R (PATH) 4.6.0".
 * Empty where every value of the setup was seen running, so a Route whose
 * setup and run agree says only what it ran with.
 *
 * Asked for on 2026-10-14, after "with R (PATH) 4.6.0" on the opening line
 * read as what ran: the setup is the adapter's account before launch, and
 * the application may start something else. It is still worth saying where
 * what ran is missing, as for a Route that ended before the application
 * answered, or where it differs, as for an R named in RStudio's own settings.
 *
 * A setup's name is matched to what ran without the source it carries in
 * brackets, `R (PATH)` to `R`, and its value must be among what that name
 * took. A setup value nothing confirms is said, so an interpreter Positron
 * offered and no session started is named.
 * @param {JournaledBuild | undefined} build
 * @param {Extract<JournalEntry, { kind: 'outcome' }> | undefined} outcome
 * @returns {string}
 */
export function setupText(build, outcome) {
  if (!build) return '';
  /** @type {Readonly<Record<string, readonly string[]>>} */
  const ran = outcome && outcome.ranWith && outcome.ranWith !== 'none' ? outcome.ranWith : {};
  const unconfirmed = Object.entries(build.runsWith ?? {}).filter(([name, value]) => {
    const values = ran[name.replace(/\s*\([^)]*\)$/, '')];
    return !(values && values.includes(value));
  });
  const parts = [];
  if (unconfirmed.length) parts.push(`set up for ${unconfirmed.map(([name, value]) => `${name} ${value}`).join(', ')}`);
  if (build.runsWithUnread) parts.push(`setup not all read: ${build.runsWithUnread}`);
  return parts.join('; ');
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
 * `opening` is the Route's opening line, which an outcome line needs to
 * say the setup beside what ran, where the two do not agree.
 * @param {JournalEntry} entry
 * @param {number} routeNumber
 * @param {{ brief?: boolean, opening?: Extract<JournalEntry, { kind: 'route' }> }} [options]
 * @returns {string | undefined}
 */
export function renderEntry(entry, routeNumber, { brief = false, opening } = {}) {
  const route = routeLabel(routeNumber);
  switch (entry.kind) {
    case 'route':
      return (
        `${route}  seed ${entry.routeSeed}, from Journey seed ${entry.journeySeed}, ` +
        // The setup is said on the outcome line instead, beside what ran.
        `Trip of ${entry.tripLength} hops, ${entry.build ? `on ${buildText(entry.build, { setup: false })}` : buildText(undefined)}` +
        // Left off a journal from before platforms were recorded, rather than
        // adding to every line of one a fact the build already says is missing.
        (entry.platform ? `; under ${platformText(entry.platform)}` : '')
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
        checkedText(entry.checks, opening),
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
        checkedText(entry.checks, opening),
        knownText(entry.checks),
        failedText(entry.checks, step, brief),
      ].join('');
    }
    case 'note':
      return `${route}  note before hop ${entry.hop}: ${entry.note}`;
    case 'outcome': {
      const reason = entry.reason && brief && entry.outcome === 'failed' ? firstSentence(entry.reason) : entry.reason;
      const ran = [ranWithText(entry), setupText(opening?.build, entry)].filter(Boolean).join('; ');
      return `${route}  ${entry.outcome} after ${entry.hops} hops${ran ? ` (${ran})` : ''}${reason ? `: ${reason}` : ''}`;
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
  /** @type {Extract<JournalEntry, { kind: 'route' }> | undefined} */
  let opening;
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
    if (entry.kind === 'route') {
      routeNumber = entry.routeNumber;
      opening = entry;
    }
    if (entry.kind === 'outcome') finished = true;
    const line = renderEntry(entry, routeNumber, opening ? { opening } : {});
    if (line) out.push(line);
  }
  if (!finished) {
    // Nothing says what ran, so the setup is all there is.
    const setup = setupText(opening?.build, undefined);
    out.push(`${routeLabel(routeNumber)}  no outcome recorded: the Route did not finish${setup ? `; ${setup}` : ''}`);
  }
  return out;
}

/**
 * One step of a Route as a page draws it: a Fix step or a Trip hop, with the
 * same words its printed line uses, kept apart so each can be laid out.
 * @typedef {{
 *   kind: 'fix' | 'hop',
 *   number: number,
 *   action: string,
 *   target: string,
 *   value?: string,
 *   effect: string,
 *   error?: string,
 *   abandoned?: string,
 *   caught: string[],
 *   recovered?: string,
 *   checked?: number,
 *   failed: { check: string, observation: string, findings: { id: string, arrived?: string }[] }[],
 *   known: { id: string, standing: string }[],
 * }} RouteStep
 */

/**
 * A whole journal file's text, as data for a page to lay out, from the
 * journal alone: the same reading `renderJournal` prints, with each part of a
 * line kept apart. A pool is left out, as it is from the printed lines. A
 * line that cannot be read is named where it sits, and a journal with no
 * outcome line is a Route that did not finish.
 * @param {string} text
 * @returns {{
 *   opening: { routeNumber: number, routeSeed: string, journeySeed: string, tripLength: number, fix?: string, build: string, platform: string } | null,
 *   steps: (RouteStep | { kind: 'note', before: number, text: string })[],
 *   outcome: { outcome: string, hops: number, reason?: string, ranWith: string } | null,
 *   setup: string,
 *   unreadable: string[],
 * }}
 */
export function journalSteps(text) {
  const lines = text.split('\n');
  /** @type {ReturnType<typeof journalSteps>} */
  const out = { opening: null, steps: [], outcome: null, setup: '', unreadable: [] };
  /** @type {JournaledBuild | undefined} */
  let build;
  /** @type {Extract<JournalEntry, { kind: 'outcome' }> | undefined} */
  let ending;
  /** @type {Extract<JournalEntry, { kind: 'route' }> | undefined} */
  let opening;
  /** @param {readonly { check: string, result?: string }[] | undefined} checks */
  const checked = (checks) => {
    const count = checkedOf(checks, opening);
    return count ? { checked: count } : {};
  };
  for (const [index, raw] of lines.entries()) {
    if (raw.trim() === '') continue;
    /** @type {JournalEntry} */
    let entry;
    try {
      entry = currentEntry(JSON.parse(raw));
    } catch {
      const last = lines.slice(index + 1).every((rest) => rest.trim() === '');
      out.unreadable.push(last ? 'the journal ends partway through a line, where the Route stopped' : `line ${index + 1} of the journal cannot be read`);
      continue;
    }
    if (entry.kind === 'route') {
      opening = entry;
      build = entry.build;
      out.opening = {
        routeNumber: entry.routeNumber,
        routeSeed: entry.routeSeed,
        journeySeed: entry.journeySeed,
        tripLength: entry.tripLength,
        ...(entry.fix?.name ? { fix: entry.fix.name } : {}),
        build: buildText(entry.build, { setup: false }),
        // Said as missing in a journal from before it was recorded, as the
        // build is, rather than left out.
        platform: platformText(entry.platform),
      };
    } else if (entry.kind === 'fix-step') {
      const step = { name: `Fix step ${entry.step}`, startedAt: Date.parse(entry.startedAt) };
      out.steps.push({
        kind: 'fix',
        number: entry.step,
        action: entry.stepKind ?? '',
        target: entry.label,
        effect: entry.error ? '' : effectText(entry.effect),
        ...(entry.error ? { error: entry.error } : {}),
        caught: caughtParts(entry.caught, step),
        ...recoveredOf(entry.checks),
        ...checked(entry.checks),
        failed: failedOf(entry.checks, step),
        known: knownOf(entry.checks),
      });
    } else if (entry.kind === 'trip-hop') {
      const step = { name: `hop ${entry.hop}`, startedAt: Date.parse(entry.startedAt) };
      out.steps.push({
        kind: 'hop',
        number: entry.hop,
        action: entry.action,
        target: targetText(entry.target),
        ...(entry.action === 'type' || entry.action === 'fill' ? { value: valueText(entry.value) } : {}),
        effect: effectText(entry.effect),
        ...(entry.abandoned ? { abandoned: `${entry.abandoned}${underText(entry.interceptedBy)}` } : {}),
        caught: caughtParts(entry.caught, step),
        ...recoveredOf(entry.checks),
        ...checked(entry.checks),
        failed: failedOf(entry.checks, step),
        known: knownOf(entry.checks),
      });
    } else if (entry.kind === 'note') {
      out.steps.push({ kind: 'note', before: entry.hop, text: entry.note });
    } else if (entry.kind === 'outcome') {
      ending = entry;
      out.outcome = {
        outcome: entry.outcome,
        hops: entry.hops,
        ...(entry.reason ? { reason: entry.reason } : {}),
        ranWith: ranWithText(entry),
      };
    }
  }
  // The setup, said only where what ran does not bear it out.
  out.setup = setupText(build, ending);
  return out;
}

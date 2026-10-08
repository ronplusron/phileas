// Known findings: bugs already found, so a Route travels past them instead of
// ending there. docs/PLAN.md has the design, under "Before the rest of the
// trial: known findings", and every decision in it was made with a proposal.
//
// Asked for on 2026-09-27 as high priority, because the only way past a known
// bug was a hand-written narrowing in the adapter, one per bug: "constantly
// updating the adapter manually whenever a bug is discovered is untenable."
//
// Plain JavaScript for the renderer's reason: the `phileas` command loads it
// directly, and Node will not erase types from a file inside node_modules. Its
// types are comments the compiler checks, and it imports only Node itself.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * One known finding, as the file holds it.
 * @typedef {{
 *   id: string,
 *   check: string,
 *   signature: string,
 *   issue?: string,
 *   falseAlarm?: string,
 *   added: string,
 *   source: 'command' | 'journey',
 * }} KnownFinding
 */

/**
 * The known findings a Route ran with. `version` names the file's contents, so
 * a journal can say which list a Route saw, and is `none` when there is no file.
 * @typedef {{ version: string, entries: KnownFinding[] }} KnownFindings
 */

/**
 * What a Route found, as its journal records it on a Hop.
 * @typedef {{ id: string, signature: string, known: boolean, issue?: string, falseAlarm?: string }} FindingRecord
 */

/**
 * What changes from one run of the same bug to the next, taken out of an
 * observation. Each was seen in the trial's journals on 2026-09-27, and a rule
 * is added here only for something measured to vary.
 * @type {readonly [RegExp, string][]}
 */
const VARYING = [
  // A Route's own profile, under the system temp folder: inside its run's
  // folder, `phileas-<name>-<random>/<random>`, and before 2026-09-28 directly
  // in the temp folder, which signatures already filed still carry. Both
  // become the same `<profile>`, so a finding filed before keeps matching.
  [
    /(?:\/private)?\/var\/folders\/[^\s:]*?\/phileas-[a-z0-9-]*?-[A-Za-z0-9]{6}(?:\/[A-Za-z0-9]{6})?(?=[/\s:]|$)/g,
    '<profile>',
  ],
  // A log named by its full path: only its file name identifies it.
  [/^[^\s:]*\/([^/\s:]+\.log): /, '$1: '],
  // Timestamps, as logs and ISO dates write them.
  [/\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\s*/g, ''],
  // A source file's line, and column where one is given, as a log names where
  // it was written from: the line moves between releases while the file and
  // the function mostly do not. Measured on RStudio on 2026-10-08, where
  // `SessionProjects.cpp:1206` in 2026.09.1 was `:1216` in 2026.10.0, and a
  // filed bug, its issue 14985, came back as a new finding for it. Only a
  // name ending in a source file's extension, so a host and port is kept.
  [
    /\b([\w.-]+\.(?:c|cc|cpp|cxx|h|hh|hpp|m|mm|rs|go|java|kt|swift|cs|py|rb|R|r|js|mjs|cjs|ts|mts|cts|jsx|tsx)):\d+(?::\d+)?\b/g,
    '$1:<line>',
  ],
  // Process ids, as Node prints them in a warning.
  [/\(node:\d+\)/g, '(node:N)'],
  // Which Hop it happened on, and how long anything took.
  [/\bhop \d+'s\b/g, "hop N's"],
  [/\b\d+ ?ms\b/g, 'N ms'],
  // Ids an application makes fresh, which every one met so far has looked
  // like: a UUID, or a run of eight or more hexadecimal digits standing alone.
  // RStudio's terminal handle "3968F855" and its Client-ID, Positron's R
  // session "r-058df68c", its runtime "003663c3...", a notebook session and a
  // channel, all seen on 2026-09-28 and 2026-09-29. Each gave the same bug a new
  // signature per Route. A meaningful value of that shape, such as an error
  // code, is merged by this too; an adapter keeps one where it matters with a
  // pattern of its own, since those run first.
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>'],
  [/(?<![0-9A-Za-z])[0-9A-Fa-f]{8,}(?![0-9A-Za-z])/g, '<id>'],
];

/**
 * The signature of one violation: the check, and what it saw, with what
 * changes from run to run taken out.
 *
 * Only the first line of the violation and, where it carries a stack, the
 * first frame without its position, since line and column change between
 * releases of the same application while the frame's name mostly does not.
 * A message whose wording changes is a new finding, on purpose.
 *
 * **The name of whoever ran it becomes `<user>`.** A signature is written into
 * `known-findings.json`, which a consumer commits, and an application that
 * logs its user's name would otherwise put it there: RStudio's session log
 * names itself `rsession-<name>` on every line, seen 2026-09-28. It also keeps
 * a finding filed on one machine matching on another.
 *
 * An adapter's own patterns for what varies in its application's messages,
 * `varyingInSignatures`, apply before the engine's, so an adapter's choice
 * for a value stands where the engine's would also match it.
 * @param {string} check
 * @param {string} violation
 * @param {string | undefined} [user] whose name to take out; the running user's by default
 * @param {readonly (readonly [RegExp, string])[]} [varying] the adapter's own patterns
 * @returns {string}
 */
export function signatureOf(check, violation, user = runningUser(), varying = []) {
  const [first = '', ...rest] = violation.split('\n');
  const frame = rest.map((line) => line.trim()).find((line) => line.startsWith('at '));
  let text = first.trim();
  for (const [pattern, replacement] of [...varying, ...VARYING]) text = text.replace(pattern, replacement);
  const where = frame?.replace(/\s*\(?(?:file:\/\/)?[^()]*?([^/()]+?)(?::\d+)+\)?$/, ' ($1)');
  return withoutUser(`${check}: ${text.trim()}${where ? ` ${where}` : ''}`, user);
}

/**
 * Refuses an adapter's signature patterns that would not take out every
 * occurrence. Without the `g` flag a pattern replaces only the first, so a
 * message naming the same id twice would keep the second, and the finding
 * would still never match: refused by name rather than half-working.
 * @param {readonly (readonly [RegExp, string])[]} varying
 * @returns {void}
 */
export function refuseUnfitVarying(varying) {
  for (const entry of varying) {
    const [pattern, replacement] = entry;
    if (!(pattern instanceof RegExp) || typeof replacement !== 'string') {
      throw new TypeError('Each of varyingInSignatures is a pattern and the text to put in its place.');
    }
    if (!pattern.global) {
      throw new RangeError(
        `varyingInSignatures has ${pattern} without the g flag, which would take out only its first ` +
          `occurrence. Write it as ${pattern}g.`
      );
    }
  }
}

/**
 * The name of the user running this process, or undefined where it cannot be
 * read, in which case nothing is taken out and the caller's text stands.
 * @returns {string | undefined}
 */
function runningUser() {
  try {
    return os.userInfo().username || undefined;
  } catch {
    return process.env.USER || undefined;
  }
}

/**
 * A text with every whole-word appearance of a user's name made `<user>`.
 * Whole words only, where a letter, digit or underscore on either side keeps
 * it: `rsession-ann.log` loses the name, `annotate` does not.
 * @param {string} text
 * @param {string | undefined} user
 * @returns {string}
 */
function withoutUser(text, user) {
  if (!user) return text;
  const name = user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`, 'g'), '<user>');
}

/**
 * A short name for a signature, stable across runs, for a person to type.
 * @param {string} signature
 * @returns {string}
 */
export function findingId(signature) {
  return createHash('sha256').update(signature).digest('hex').slice(0, 8);
}

/**
 * The known findings in a file, or none where there is no file.
 *
 * A file that cannot be read as a list of findings is refused by name, since
 * reading it as empty would end every Route at a bug somebody marked as known.
 * @param {string} file
 * @returns {KnownFindings}
 */
export function readKnownFindings(file) {
  if (!fs.existsSync(file)) return { version: 'none', entries: [] };
  const text = fs.readFileSync(file, 'utf8');
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`The known findings in ${file} are not valid JSON: ${/** @type {Error} */ (error).message}`);
  }
  if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry?.signature === 'string')) {
    throw new Error(`The known findings in ${file} are not a list of findings with signatures.`);
  }
  // Every field, since the file is for people and gets edited by hand. The id
  // and check are derived from the signature, so one edited alone would make
  // the id a Route prints differ from the id `phileas known add` matches.
  parsed.forEach((entry, index) => {
    const problem =
      typeof entry.id !== 'string'
        ? 'has no id'
        : entry.id !== findingId(entry.signature)
          ? `has the id ${entry.id}, but its signature's id is ${findingId(entry.signature)}; was the signature edited?`
          : typeof entry.check !== 'string' || !entry.signature.startsWith(`${entry.check}: `)
            ? 'has a check that does not match its signature'
            : typeof entry.added !== 'string'
              ? 'has no date it was added'
              : entry.source !== 'journey' && entry.source !== 'command'
                ? 'has a source that is neither journey nor command'
                : entry.issue !== undefined && typeof entry.issue !== 'string'
                  ? 'has an issue that is not text'
                  : entry.falseAlarm !== undefined && (typeof entry.falseAlarm !== 'string' || !entry.falseAlarm.trim())
                    ? 'has a false alarm with no reason'
                    : entry.issue !== undefined && entry.falseAlarm !== undefined
                      ? 'is both filed as a bug and marked a false alarm, and cannot be both'
                      : undefined;
    if (problem) throw new Error(`Known finding ${index + 1} in ${file} ${problem}: ${entry.signature}`);
  });
  return {
    version: createHash('sha256').update(text).digest('hex').slice(0, 12),
    entries: /** @type {KnownFinding[]} */ (parsed),
  };
}

/**
 * @param {string} file
 * @param {readonly KnownFinding[]} entries
 */
function writeKnownFindings(file, entries) {
  const sorted = [...entries].sort((a, b) => a.signature.localeCompare(b.signature));
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
}

/**
 * Mark a finding as filed, by its id or the start of it.
 *
 * A finding reaches the file by itself when a Journey that found it ends, so
 * marking one filed is setting its issue. An id that matches nothing, or more
 * than one, is refused with what is there.
 * @param {string} file
 * @param {string} id
 * @param {string} issue
 * @returns {KnownFinding}
 */
export function markFiled(file, id, issue) {
  const { entries, match } = findOne(file, id);
  // The source stays where the finding came from; filing it adds an issue and
  // changes nothing about how it was found. Filing a false alarm says it was
  // a bug after all, so its reason goes.
  const { falseAlarm: _dropped, ...rest } = match;
  /** @type {KnownFinding} */
  const filed = { ...rest, issue };
  writeKnownFindings(file, entries.map((entry) => (entry === match ? filed : entry)));
  return filed;
}

/**
 * How an entry stands, for a person reading a list of them.
 * @param {KnownFinding} entry
 * @returns {string}
 */
function standing(entry) {
  return entry.issue ?? (entry.falseAlarm !== undefined ? 'false alarm' : 'unfiled');
}

/**
 * The one entry an id, or the start of one, names, with every entry. Refuses
 * an id that matches nothing, or more than one, listing what is there.
 * @param {string} file
 * @param {string} id
 * @returns {{ entries: KnownFinding[], match: KnownFinding }}
 */
function findOne(file, id) {
  const { entries } = readKnownFindings(file);
  const matches = entries.filter((entry) => entry.id.startsWith(id));
  if (matches.length !== 1) {
    const listed = entries.map((entry) => `  ${entry.id}  ${standing(entry)}  ${entry.signature}`).join('\n');
    throw new Error(
      `${matches.length ? `${matches.length} findings start with` : 'No finding has'} the id ${id} in ${file}.` +
        (listed ? `\n\nThe findings there:\n${listed}` : ' The file holds none yet.')
    );
  }
  return { entries, match: /** @type {KnownFinding} */ (matches[0]) };
}

/**
 * Mark a finding a false alarm, with the reason, by its id or the start of it.
 *
 * Asked for on 2026-09-29. A false alarm stays in the file, so a Route keeps
 * carrying past it and a Journey's end never adds it back, which a removed
 * entry would be; a Journey's summary counts it apart from bugs. A filed
 * finding is refused: a bug with an issue is not a false alarm, and one whose
 * issue turned out not to be a bug is removed, then dismissed when next seen.
 * @param {string} file
 * @param {string} id
 * @param {string} reason
 * @returns {KnownFinding}
 */
export function dismissFinding(file, id, reason) {
  if (!reason.trim()) throw new Error('A false alarm needs a reason, saying why it is not a bug.');
  const { entries, match } = findOne(file, id);
  if (match.issue) {
    throw new Error(
      `${match.id} is filed as ${match.issue}, and a filed bug is not a false alarm. If that issue ` +
        `turned out not to be a bug, remove the finding, and dismiss it when it is seen again.`
    );
  }
  /** @type {KnownFinding} */
  const dismissed = { ...match, falseAlarm: reason.trim() };
  writeKnownFindings(file, entries.map((entry) => (entry === match ? dismissed : entry)));
  return dismissed;
}

/**
 * Take a finding out of the file, by its id or the start of it, so the next
 * time it is seen it is reported as new.
 *
 * For an entry that should stop matching rather than keep matching: a bug the
 * application fixed, so its return reads as a regression; a finding the
 * engine itself caused, now fixed; an entry left by a deliberate test; one
 * whose signature can no longer match since its form changed.
 * @param {string} file
 * @param {string} id
 * @returns {KnownFinding}
 */
export function removeFinding(file, id) {
  const { entries, match } = findOne(file, id);
  writeKnownFindings(file, entries.filter((entry) => entry !== match));
  return match;
}

/**
 * What a Journey found, read from its journals.
 *
 * Journals rather than anything held in memory, since Routes run in separate
 * worker processes and a Route that died left only its journal.
 * @param {string} runFolder
 * @returns {Map<string, { finding: FindingRecord, check: string, sightings: number }>}
 */
export function findingsInRun(runFolder) {
  /** @type {Map<string, { finding: FindingRecord, check: string, sightings: number }>} */
  const found = new Map();
  // **Refused rather than read as nothing.** Read as nothing, a wrong journals
  // folder or a run that wrote no journal reported every known finding as "not
  // seen this Journey, possibly fixed": an invitation to close a real issue.
  //
  // **Both causes named, the likelier first.** The folder is made by a Route's
  // first journal line, so it is also missing when every Route failed before
  // writing one, as when the staleness guard refused the app. Asking only
  // about journalsRoot sent a reader to a setting that was correct, measured
  // on 2026-10-01, while the real reason sat among the Routes' failures.
  if (!fs.existsSync(runFolder)) {
    throw new Error(
      `No Route wrote a journal at ${runFolder}, so what the Journey found cannot be read. ` +
        `Most often every Route failed before its first Hop, as when the staleness guard or the launch ` +
        `refused, and the Routes' failures say why. Otherwise journalsRoot is not where the spec writes.`
    );
  }
  const journals = fs.readdirSync(runFolder).filter((file) => file.endsWith('.jsonl'));
  if (journals.length === 0) {
    throw new Error(`${runFolder} holds no journals, so what the Journey found cannot be read.`);
  }
  for (const name of journals) {
    const lines = fs.readFileSync(path.join(runFolder, name), 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      /** @type {{ checks?: { check: string, findings?: FindingRecord[] }[] }} */
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        // The last line of a Route that died mid-write is expected, and
        // readJournal takes it the same way. A broken line with more after it
        // is damage, and dropping it would drop its findings unseen.
        if (lines.slice(index + 1).some((rest) => rest.trim())) {
          throw new Error(`Line ${index + 1} of ${path.join(runFolder, name)} is not valid JSON, and lines follow it.`);
        }
        return;
      }
      for (const check of entry.checks ?? []) {
        for (const finding of check.findings ?? []) {
          const seen = found.get(finding.signature);
          if (seen) seen.sightings += 1;
          else found.set(finding.signature, { finding, check: check.check, sightings: 1 });
        }
      }
    });
  }
  return found;
}

/**
 * A stored signature brought to the rules in force now. A signature keeps the
 * text the rules act on, so applying today's rules to it gives what an
 * observation of the same finding gives today; the rules leave text they
 * already changed alone.
 * @param {KnownFinding} entry
 * @param {readonly (readonly [RegExp, string])[]} [varying]
 * @returns {string}
 */
export function currentSignature(entry, varying = []) {
  const prefix = `${entry.check}: `;
  const text = entry.signature.startsWith(prefix) ? entry.signature.slice(prefix.length) : entry.signature;
  return signatureOf(entry.check, text, undefined, varying);
}

/**
 * Every entry brought to the rules in force now, and entries that now share
 * a signature merged into one: the issue or false alarm kept, the earliest
 * date. Entries whose states clash, two different issues or a filed bug and
 * a false alarm, are left as they are and named, since only a person can
 * say which is right.
 *
 * Asked for on 2026-09-29: a rule changed, in the engine or an adapter, left
 * every entry written before it unable to match, silently.
 * @param {readonly KnownFinding[]} entries
 * @param {readonly (readonly [RegExp, string])[]} [varying]
 * @returns {{ entries: KnownFinding[], resigned: { from: string, to: string }[], merged: { into: string, from: string[] }[], clashes: string[][] }}
 */
export function resignKnownFindings(entries, varying = []) {
  /** @type {Map<string, KnownFinding[]>} */
  const groups = new Map();
  for (const entry of entries) {
    const signature = currentSignature(entry, varying);
    groups.set(signature, [...(groups.get(signature) ?? []), entry]);
  }
  /** @type {KnownFinding[]} */
  const result = [];
  /** @type {{ from: string, to: string }[]} */
  const resigned = [];
  /** @type {{ into: string, from: string[] }[]} */
  const merged = [];
  /** @type {string[][]} */
  const clashes = [];
  for (const [signature, group] of groups) {
    const issues = [...new Set(group.flatMap((entry) => (entry.issue ? [entry.issue] : [])))];
    const alarms = group.flatMap((entry) => (entry.falseAlarm !== undefined ? [entry.falseAlarm] : []));
    if (group.length > 1 && (issues.length > 1 || (issues.length && alarms.length))) {
      clashes.push(group.map((entry) => entry.id));
      result.push(...group);
      continue;
    }
    const [first] = /** @type {[KnownFinding]} */ ([...group].sort((a, b) => a.added.localeCompare(b.added)));
    const id = findingId(signature);
    /** @type {KnownFinding} */
    const entry = {
      id,
      check: first.check,
      signature,
      added: first.added,
      source: first.source,
      ...(issues[0] ? { issue: issues[0] } : {}),
      ...(!issues.length && alarms.length ? { falseAlarm: /** @type {string} */ (alarms[0]) } : {}),
    };
    result.push(entry);
    if (group.length > 1) merged.push({ into: id, from: group.map((each) => each.id) });
    else if (first.signature !== signature) resigned.push({ from: first.id, to: id });
  }
  return { entries: result, resigned, merged, clashes };
}

/**
 * What a Journey's end did to the known findings.
 * @typedef {{
 *   added: { id: string, signature: string, sightings: number }[],
 *   known: { id: string, signature: string, issue?: string, falseAlarm?: string, sightings: number }[],
 *   notSeen: KnownFinding[],
 *   resigned?: { from: string, to: string }[],
 *   merged?: { into: string, from: string[] }[],
 *   clashes?: string[][],
 * }} JourneyFindings
 */

/**
 * Add what a Journey found that the file does not hold, as known but unfiled,
 * and say what was seen and what was not.
 *
 * Written only here, once the Journey has ended, so every Route of a Journey
 * read the same list: a Route that carried on past a bug only because an
 * earlier Route found it would end differently replayed alone.
 * @param {string} runFolder
 * @param {string} file
 * @param {string} [today]
 * @param {readonly (readonly [RegExp, string])[]} [varying] the adapter's signature patterns
 * @returns {JourneyFindings}
 */
export function recordJourneyFindings(runFolder, file, today = new Date().toISOString().slice(0, 10), varying = []) {
  const brought = resignKnownFindings(readKnownFindings(file).entries, varying);
  const { entries } = brought;
  const bySignature = new Map(entries.map((entry) => [entry.signature, entry]));
  const found = findingsInRun(runFolder);

  /** @type {JourneyFindings} */
  const result = { added: [], known: [], notSeen: [], resigned: brought.resigned, merged: brought.merged, clashes: brought.clashes };
  /** @type {KnownFinding[]} */
  const additions = [];
  for (const [signature, { finding, check, sightings }] of found) {
    const entry = bySignature.get(signature);
    if (entry) {
      result.known.push({
        id: entry.id,
        signature,
        sightings,
        ...(entry.issue ? { issue: entry.issue } : {}),
        ...(entry.falseAlarm !== undefined ? { falseAlarm: entry.falseAlarm } : {}),
      });
    } else {
      additions.push({ id: finding.id, check, signature, added: today, source: 'journey' });
      result.added.push({ id: finding.id, signature, sightings });
    }
  }
  result.notSeen = entries.filter((entry) => !found.has(entry.signature));
  if (additions.length || brought.resigned.length || brought.merged.length) writeKnownFindings(file, [...entries, ...additions]);
  return result;
}

/** Where `phileas known` looks when given no file, from the folder a consumer works in. */
export const DEFAULT_KNOWN_FINDINGS = path.join('phileas', 'known-findings.json');

/**
 * The file argument a `phileas known` command needs to reach `file`: none when
 * it is the default, so the line printed is the one a person would type.
 * @param {string} file
 * @returns {string}
 */
function listFileArgument(file) {
  if (path.normalize(file) === DEFAULT_KNOWN_FINDINGS) return '';
  return /\s/.test(file) ? ` "${file}"` : ` ${file}`;
}

/**
 * The journals beside a known findings file, where `phileas known list`
 * reads when each was last met: a `.phileas-journals` folder beside it, or
 * the folder it is in when that is one, as the demos keep theirs.
 * @param {string} file
 * @returns {string | undefined}
 */
export function journalsBeside(file) {
  const folder = path.dirname(file);
  if (path.basename(folder) === '.phileas-journals') return folder;
  const beside = path.join(folder, '.phileas-journals');
  return fs.existsSync(beside) ? beside : undefined;
}

/**
 * When each finding was last met, by signature, from every run kept under a
 * journals folder: the run's name, which is when it started. A finding in a
 * journal written under older signature rules is matched by the rules in
 * force too. A run whose journals cannot be read is counted, not dropped.
 * @param {string} journalsRoot
 * @returns {{ lastMet: Map<string, string>, runs: number, unreadable: number }}
 */
export function lastMetIn(journalsRoot) {
  /** @type {Map<string, string>} */
  const lastMet = new Map();
  let runs = 0;
  let unreadable = 0;
  /** @param {string} folder */
  const folders = (folder) =>
    fs
      .readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(folder, entry.name));
  for (const seed of folders(journalsRoot)) {
    for (const run of folders(seed)) {
      if (!fs.readdirSync(run).some((name) => name.endsWith('.jsonl'))) continue;
      runs += 1;
      /** @type {ReturnType<typeof findingsInRun>} */
      let found;
      try {
        found = findingsInRun(run);
      } catch {
        unreadable += 1;
        continue;
      }
      const name = path.basename(run);
      for (const [signature, { check }] of found) {
        const now = currentSignature({ id: '', check, signature, added: '', source: 'journey' });
        for (const each of new Set([signature, now])) {
          const was = lastMet.get(each);
          if (was === undefined || name > was) lastMet.set(each, name);
        }
      }
    }
  }
  return { lastMet, runs, unreadable };
}

/**
 * A run's name as the day it started: `2026-10-02T17-33-21-755Z` is 2026-10-02.
 * @param {string} run
 * @returns {string}
 */
function runDay(run) {
  return /^\d{4}-\d{2}-\d{2}/.exec(run)?.[0] ?? run;
}

/**
 * Every known finding, as `phileas known list` prints it: unfiled first, then
 * filed, then false alarms, each with when it was last met in the journals
 * kept here, most recent first. Asked for on 2026-10-02 with the run's end
 * listing only what it met, so that the whole list is one command away.
 * @param {string} file
 * @param {string | undefined} journalsRoot
 * @returns {string[]}
 */
export function listKnownFindings(file, journalsRoot) {
  const { entries } = readKnownFindings(file);
  const met = journalsRoot ? lastMetIn(journalsRoot) : undefined;
  /** @param {KnownFinding} entry */
  const when = (entry) => met?.lastMet.get(entry.signature);
  /** @param {KnownFinding} entry */
  const rank = (entry) => (entry.issue ? 1 : entry.falseAlarm !== undefined ? 2 : 0);
  const sorted = [...entries].sort(
    (a, b) => rank(a) - rank(b) || (when(b) ?? '').localeCompare(when(a) ?? '') || a.id.localeCompare(b.id)
  );
  const counts = [0, 1, 2].map((r) => entries.filter((entry) => rank(entry) === r).length);
  /** @type {string[]} */
  const lines = [
    `Known findings in ${file}: ${entries.length}, ${counts[0]} unfiled, ${counts[1]} filed, ${counts[2]} false alarm(s)`,
  ];
  const width = Math.max(0, ...entries.map((entry) => standing(entry).length));
  for (const entry of sorted) {
    const last = when(entry);
    const lastText = met ? (last ? `last met ${runDay(last)}` : 'not met in these journals') : '';
    lines.push(
      `  ${entry.id}  ${standing(entry).padEnd(width)}  ${lastText ? `${lastText.padEnd(25)}  ` : ''}${entry.signature}`
    );
  }
  lines.push(
    met
      ? `Last met is read from ${met.runs} run(s) kept in ${journalsRoot}` +
          (met.unreadable ? `, ${met.unreadable} of which could not be read.` : '.')
      : `No journals beside ${file}, so when each was last met is not known.`
  );
  return lines;
}

/**
 * A Journey's findings as a person reads them, for the end of a run.
 * @param {JourneyFindings} findings
 * @param {string} file
 * @returns {string[]}
 */
export function renderJourneyFindings(findings, file) {
  /** @type {string[]} */
  const lines = [`Known findings, in ${file}:`];
  const unfiled = findings.known.filter((finding) => !finding.issue && finding.falseAlarm === undefined);
  for (const finding of findings.known.filter((known) => known.issue)) {
    lines.push(`  seen ${finding.sightings} time(s), issue ${finding.issue}: ${finding.id}  ${finding.signature}`);
  }
  for (const finding of findings.known.filter((known) => known.falseAlarm !== undefined)) {
    lines.push(`  false alarm, seen ${finding.sightings} time(s) (${finding.falseAlarm}): ${finding.id}  ${finding.signature}`);
  }
  for (const finding of [...findings.added, ...unfiled]) {
    lines.push(`  UNFILED, seen ${finding.sightings} time(s): ${finding.id}  ${finding.signature}`);
  }
  // Counted rather than listed, asked for on 2026-10-02 as too verbose: with
  // dozens on file, a short run printed a line for each it did not meet and
  // buried the ones it did. The list says when each was last met, which is
  // how an entry for a bug since fixed comes to light now.
  if (findings.notSeen.length) {
    lines.push(
      `  ${findings.notSeen.length} other known finding(s) not met this Journey; to list every one: ` +
        `phileas known list${listFileArgument(file)}`
    );
  }
  if (findings.added.length) {
    lines.push(
      `  ${findings.added.length} new finding(s) added as known but unfiled. They no longer end a Route from the next Journey on.`
    );
  }
  if (findings.added.length || unfiled.length) {
    lines.push('  To file one: phileas known add <id> --issue <issue>');
    lines.push('  To mark one a false alarm: phileas known dismiss <id> --reason <why>');
  }
  for (const { from, to } of findings.resigned ?? []) {
    lines.push(`  re-signed under the rules in force: ${from} is now ${to}`);
  }
  for (const { into, from } of findings.merged ?? []) {
    lines.push(`  merged, now one finding under the rules in force: ${from.join(', ')} into ${into}`);
  }
  for (const ids of findings.clashes ?? []) {
    lines.push(`  NOT MERGED, since their states clash; decide which is right: ${ids.join(', ')}`);
  }
  if (lines.length === 1) lines.push('  none found, and none held.');
  return lines;
}

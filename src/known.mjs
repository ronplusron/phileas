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
import path from 'node:path';

/**
 * One known finding, as the file holds it.
 * @typedef {{
 *   id: string,
 *   check: string,
 *   signature: string,
 *   issue?: string,
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
 * @typedef {{ id: string, signature: string, known: boolean, issue?: string }} FindingRecord
 */

/**
 * What changes from one run of the same bug to the next, taken out of an
 * observation. Each was seen in the trial's journals on 2026-09-27, and a rule
 * is added here only for something measured to vary.
 * @type {readonly [RegExp, string][]}
 */
const VARYING = [
  // A Route's own profile, under the system temp folder.
  [/(?:\/private)?\/var\/folders\/[^\s:]*?\/phileas-[a-z0-9-]*?-[A-Za-z0-9]{6}(?=[/\s:]|$)/g, '<profile>'],
  // A log named by its full path: only its file name identifies it.
  [/^[^\s:]*\/([^/\s:]+\.log): /, '$1: '],
  // Timestamps, as logs and ISO dates write them.
  [/\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\s*/g, ''],
  // Process ids, as Node prints them in a warning.
  [/\(node:\d+\)/g, '(node:N)'],
  // Which Hop it happened on, and how long anything took.
  [/\bhop \d+'s\b/g, "hop N's"],
  [/\b\d+ ?ms\b/g, 'N ms'],
];

/**
 * The signature of one violation: the check, and what it saw, with what
 * changes from run to run taken out.
 *
 * Only the first line of the violation and, where it carries a stack, the
 * first frame without its position, since line and column change between
 * releases of the same application while the frame's name mostly does not.
 * A message whose wording changes is a new finding, on purpose.
 * @param {string} check
 * @param {string} violation
 * @returns {string}
 */
export function signatureOf(check, violation) {
  const [first = '', ...rest] = violation.split('\n');
  const frame = rest.map((line) => line.trim()).find((line) => line.startsWith('at '));
  let text = first.trim();
  for (const [pattern, replacement] of VARYING) text = text.replace(pattern, replacement);
  const where = frame?.replace(/\s*\(?(?:file:\/\/)?[^()]*?([^/()]+?)(?::\d+)+\)?$/, ' ($1)');
  return `${check}: ${text.trim()}${where ? ` ${where}` : ''}`;
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
  const { entries } = readKnownFindings(file);
  const matches = entries.filter((entry) => entry.id.startsWith(id));
  if (matches.length !== 1) {
    const listed = entries.map((entry) => `  ${entry.id}  ${entry.issue ?? 'unfiled'}  ${entry.signature}`).join('\n');
    throw new Error(
      `${matches.length ? `${matches.length} findings start with` : 'No finding has'} the id ${id} in ${file}.` +
        (listed ? `\n\nThe findings there:\n${listed}` : ' The file holds none yet.')
    );
  }
  const [match] = /** @type {[KnownFinding]} */ (matches);
  // The source stays where the finding came from; filing it adds an issue and
  // changes nothing about how it was found.
  /** @type {KnownFinding} */
  const filed = { ...match, issue };
  writeKnownFindings(file, entries.map((entry) => (entry === match ? filed : entry)));
  return filed;
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
  if (!fs.existsSync(runFolder)) {
    throw new Error(`The run's journals are not at ${runFolder}, so what the Journey found cannot be read. Is journalsRoot the one the spec writes to?`);
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
 * What a Journey's end did to the known findings.
 * @typedef {{
 *   added: { id: string, signature: string, sightings: number }[],
 *   known: { id: string, signature: string, issue?: string, sightings: number }[],
 *   notSeen: KnownFinding[],
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
 * @returns {JourneyFindings}
 */
export function recordJourneyFindings(runFolder, file, today = new Date().toISOString().slice(0, 10)) {
  const { entries } = readKnownFindings(file);
  const bySignature = new Map(entries.map((entry) => [entry.signature, entry]));
  const found = findingsInRun(runFolder);

  /** @type {JourneyFindings} */
  const result = { added: [], known: [], notSeen: [] };
  /** @type {KnownFinding[]} */
  const additions = [];
  for (const [signature, { finding, check, sightings }] of found) {
    const entry = bySignature.get(signature);
    if (entry) {
      result.known.push({ id: entry.id, signature, sightings, ...(entry.issue ? { issue: entry.issue } : {}) });
    } else {
      additions.push({ id: finding.id, check, signature, added: today, source: 'journey' });
      result.added.push({ id: finding.id, signature, sightings });
    }
  }
  result.notSeen = entries.filter((entry) => !found.has(entry.signature));
  if (additions.length) writeKnownFindings(file, [...entries, ...additions]);
  return result;
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
  const unfiled = findings.known.filter((finding) => !finding.issue);
  for (const finding of findings.known.filter((known) => known.issue)) {
    lines.push(`  seen ${finding.sightings} time(s), issue ${finding.issue}: ${finding.id}  ${finding.signature}`);
  }
  for (const finding of [...findings.added, ...unfiled]) {
    lines.push(`  UNFILED, seen ${finding.sightings} time(s): ${finding.id}  ${finding.signature}`);
  }
  for (const finding of findings.notSeen) {
    lines.push(
      `  not seen this Journey, possibly fixed or not reached: ${finding.id}  ${finding.issue ?? 'unfiled'}  ${finding.signature}`
    );
  }
  if (findings.added.length) {
    lines.push(
      `  ${findings.added.length} new finding(s) added as known but unfiled. They no longer end a Route from the next Journey on.`
    );
  }
  if (findings.added.length || unfiled.length) {
    lines.push('  To file one: phileas known add <id> --issue <issue>');
  }
  if (lines.length === 1) lines.push('  none found, and none held.');
  return lines;
}

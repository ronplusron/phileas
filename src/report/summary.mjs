// A run, as data: what the reporter prints for it, as one object.
//
// Asked for on 2026-10-12, with the page, the assistant's skills and
// `phileas triage`, which all need a run's results and were otherwise left to
// parse the reporter's printed lines. docs/PLAN.md has it under "After the run:
// an assistant, a page, and a schedule".
//
// Read through the reporter's own `readEnding` and `replayVerdict`, so a Route
// is said to have failed, stranded or reproduced here exactly when the reporter
// says so. A second reading of a journal would drift from the first, and the
// two would disagree about a run without either being wrong on its own terms.
//
// Plain JavaScript for the renderer's reason, so `phileas` loads it from
// anywhere.

import fs from 'node:fs';
import path from 'node:path';
import { currentSignature, findingId, readKnownFindings } from '../known.mjs';
import { readEnding, replayVerdict } from './reporter.mjs';
import { buildText, platformText, ranWithText, setupText, stepWhere } from './render.mjs';

/** @typedef {import('../journal').JournalEntry} JournalEntry */
/** @typedef {import('../build').JournaledBuild} JournaledBuild */
/** @typedef {import('../platform').JournaledPlatform} JournaledPlatform */

/** A Route's journal, as `journalPath` names it in journal.ts. */
const JOURNAL_NAME = /^route-\d+-.*\.jsonl$/;

/**
 * How a finding stands in the known findings now, which can differ from what
 * its journal says: a finding new when the run was made may have been filed
 * or dismissed since. `not on file` where the file does not hold it, and
 * `no file` where there is no file to ask.
 * @typedef {{ standing: 'unfiled' | 'filed' | 'false alarm' | 'not on file' | 'no file', issue?: string, falseAlarm?: string }} StandingNow
 */

/**
 * One finding a failed check recorded: `known` as the journal says it was
 * when the run was made, and `now` as the known findings say today.
 * @typedef {{ id: string, signature: string, known: boolean, issue?: string, falseAlarm?: string, now: StandingNow }} SummaryFinding
 */

/**
 * One Route of a run.
 * @typedef {{
 *   routeNumber: number,
 *   journal: string,
 *   outcome: 'passed' | 'failed' | 'stranded' | 'unfinished',
 *   hops: number,
 *   tripLength?: number,
 *   reason?: string,
 *   failedAt?: string,
 *   failedChecks: { check: string, observation: string, findings: SummaryFinding[] }[],
 *   newFindings: string[],
 *   replays?: { journal: string, verdict: string },
 *   replayedBy: { journal: string, verdict: string }[],
 *   build?: JournaledBuild,
 *   buildText: string,
 *   platform?: JournaledPlatform,
 *   platformText: string,
 *   ranWith?: Readonly<Record<string, readonly string[]>> | 'none',
 *   ranWithUnread?: string,
 *   ranWithText: string,
 *   setupText: string,
 * }} SummaryRoute
 */

/**
 * A run of a Journey, from its journals alone.
 * @typedef {{
 *   folder: string,
 *   seed: string,
 *   run: string,
 *   routes: SummaryRoute[],
 *   counts: { passed: number, failed: number, stranded: number, unfinished: number },
 *   knownFindings: string | null,
 *   newFindings: { id: string, signature: string, check: string, routes: number[], now: StandingNow }[],
 *   builds: { text: string, routes: number[] }[],
 * }} RunSummary
 */

/**
 * The Route journals in a folder, in Route order.
 * @param {string} folder
 * @returns {string[]}
 */
export function journalsInFolder(folder) {
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) return [];
  return fs
    .readdirSync(folder)
    .filter((name) => JOURNAL_NAME.test(name))
    .sort()
    .map((name) => path.join(folder, name));
}

/**
 * The known findings file for a run, where the consumers here keep it: beside
 * the journals folder, as `phileas/known-findings.json`, or inside it, as the
 * demos do. Undefined where there is neither.
 * @param {string} runFolder
 * @returns {string | undefined}
 */
export function knownFileFor(runFolder) {
  const journalsRoot = path.dirname(path.dirname(path.resolve(runFolder)));
  return [path.join(path.dirname(journalsRoot), 'known-findings.json'), path.join(journalsRoot, 'known-findings.json')].find((file) =>
    fs.existsSync(file)
  );
}

/**
 * How each finding stands now, from a known findings file, matched by id and
 * then by its signature under the rules in force, so one re-signed since is
 * still found. Every finding is `no file` where there is none.
 * @param {string | undefined} knownFile
 * @returns {(finding: { id: string, signature: string }, check: string) => StandingNow}
 */
export function standingFrom(knownFile) {
  if (!knownFile || !fs.existsSync(knownFile)) return () => ({ standing: 'no file' });
  const { entries } = readKnownFindings(knownFile);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return (finding, check) => {
    const entry =
      byId.get(finding.id) ??
      byId.get(findingId(currentSignature({ id: finding.id, check, signature: finding.signature, added: '', source: 'journey' })));
    if (!entry) return { standing: 'not on file' };
    if (entry.issue) return { standing: 'filed', issue: entry.issue };
    if (entry.falseAlarm !== undefined) return { standing: 'false alarm', falseAlarm: entry.falseAlarm };
    return { standing: 'unfiled' };
  };
}

/**
 * One Route, read from its journal. Replays of it are filled in by
 * `summarizeRun`, which can see the runs beside this one.
 * @param {string} journal
 * @param {ReturnType<typeof standingFrom>} [standing] how a finding stands now
 * @returns {SummaryRoute}
 */
export function summarizeRoute(journal, standing = standingFrom(knownFileFor(path.dirname(journal)))) {
  const ending = readEnding(journal);
  const routeNumber = ending.opening?.routeNumber ?? Number(/^route-(\d+)-/.exec(path.basename(journal))?.[1] ?? 0);
  const outcome = ending.outcome?.outcome ?? 'unfinished';
  const last = ending.last;
  const failed = (last?.checks ?? []).filter((check) => check.result === 'failed');
  /** @type {SummaryRoute['failedChecks']} */
  const failedChecks = failed.map((check) => ({
    check: check.check,
    observation: check.observation ?? '',
    findings: (check.findings ?? []).map((finding) => ({
      id: finding.id,
      signature: finding.signature,
      known: finding.known,
      ...(finding.issue ? { issue: finding.issue } : {}),
      ...(finding.falseAlarm !== undefined ? { falseAlarm: finding.falseAlarm } : {}),
      now: standing(finding, check.check),
    })),
  }));
  const newFindings = [
    ...new Set(failedChecks.flatMap((check) => check.findings.filter((finding) => !finding.known).map((finding) => finding.id))),
  ];
  const failedAt = failed.length && last ? stepWhere(last) : undefined;
  const verdict = replayVerdict(ending);
  return {
    routeNumber,
    journal,
    outcome,
    hops: ending.hops,
    ...(ending.opening?.tripLength !== undefined ? { tripLength: ending.opening.tripLength } : {}),
    ...(ending.outcome?.reason ? { reason: ending.outcome.reason } : {}),
    ...(failedAt ? { failedAt } : {}),
    failedChecks,
    newFindings,
    ...(verdict && ending.opening?.replays ? { replays: { journal: ending.opening.replays.journal, verdict } } : {}),
    replayedBy: [],
    // Which build the Route ran against, from its opening line, and what the
    // application was seen to run with, from its outcome line, each also as
    // the renderer prints it. A journal from before either was recorded says
    // so in the text, and a Route that did not finish has no outcome to say
    // what ran.
    ...(ending.opening?.build ? { build: ending.opening.build } : {}),
    // Without the setup, which `setupText` says only where what ran does
    // not bear it out, so the setup is never read as what ran.
    buildText: buildText(ending.opening?.build, { setup: false }),
    // Which operating system and architecture, from the same line.
    ...(ending.opening?.platform ? { platform: ending.opening.platform } : {}),
    platformText: platformText(ending.opening?.platform),
    ...(ending.outcome?.ranWith ? { ranWith: ending.outcome.ranWith } : {}),
    ...(ending.outcome?.ranWithUnread ? { ranWithUnread: ending.outcome.ranWithUnread } : {}),
    ranWithText: ending.outcome
      ? ranWithText(ending.outcome) || 'what it ran with not recorded'
      : 'what it ran with not recorded: the Route did not finish',
    setupText: setupText(ending.opening?.build, ending.outcome),
  };
}

/**
 * A run, from the journals in its folder, with every replay of one of its
 * Routes found among the runs beside it. A replay runs with the recorded
 * Journey's seed, so it lands in the same seed's folder; it is matched by the
 * journal's file name, which carries the Route's number and seed, so a run
 * whose folder was copied elsewhere still finds its replays there.
 *
 * Each finding also says how it stands now, from the known findings file
 * beside the journals unless another is named, since one new when the run was
 * made may have been filed or dismissed since.
 * @param {string} folder
 * @param {{ knownFile?: string }} [options]
 * @returns {RunSummary}
 */
export function summarizeRun(folder, { knownFile = knownFileFor(folder) } = {}) {
  const journals = journalsInFolder(folder);
  if (!journals.length) throw new Error(`${folder} holds no journals`);
  const standing = standingFrom(knownFile);
  const routes = journals.map((journal) => summarizeRoute(journal, standing));

  const byName = new Map(routes.map((route) => [path.basename(route.journal), route]));
  const seedFolder = path.dirname(folder);
  for (const sibling of fs.readdirSync(seedFolder, { withFileTypes: true })) {
    const other = path.join(seedFolder, sibling.name);
    if (!sibling.isDirectory() || path.resolve(other) === path.resolve(folder)) continue;
    for (const journal of journalsInFolder(other)) {
      const replay = summarizeRoute(journal, standing);
      const original = replay.replays && byName.get(path.basename(replay.replays.journal));
      if (original && replay.replays) original.replayedBy.push({ journal, verdict: replay.replays.verdict });
    }
  }
  for (const route of routes) route.replayedBy.sort((a, b) => a.journal.localeCompare(b.journal));

  /** @type {Map<string, RunSummary['newFindings'][number]>} */
  const found = new Map();
  for (const route of routes) {
    for (const check of route.failedChecks) {
      for (const finding of check.findings.filter((each) => !each.known)) {
        const seen = found.get(finding.id);
        if (seen) {
          if (!seen.routes.includes(route.routeNumber)) seen.routes.push(route.routeNumber);
        } else found.set(finding.id, { id: finding.id, signature: finding.signature, check: check.check, routes: [route.routeNumber], now: finding.now });
      }
    }
  }

  // Each build the run's Routes ran against, with which Routes: one where the
  // run was steady, more where the application changed under it.
  /** @type {Map<string, number[]>} */
  const builds = new Map();
  for (const route of routes) builds.set(route.buildText, [...(builds.get(route.buildText) ?? []), route.routeNumber]);

  const count = (/** @type {SummaryRoute['outcome']} */ kind) => routes.filter((route) => route.outcome === kind).length;
  return {
    folder,
    seed: path.basename(seedFolder),
    run: path.basename(folder),
    routes,
    counts: { passed: count('passed'), failed: count('failed'), stranded: count('stranded'), unfinished: count('unfinished') },
    knownFindings: knownFile ?? null,
    newFindings: [...found.values()],
    builds: [...builds].map(([text, numbers]) => ({ text, routes: numbers })),
  };
}

/**
 * Every run kept under a journals folder, newest first: its seed, its name
 * and its folder. A run is named for when it started, in UTC, so the names
 * sort in the order the runs happened.
 * @param {string} journalsRoot
 * @returns {{ seed: string, run: string, folder: string, routes: number }[]}
 */
export function listRuns(journalsRoot) {
  if (!fs.existsSync(journalsRoot)) return [];
  /** @param {string} folder */
  const folders = (folder) =>
    fs
      .readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(folder, entry.name));
  return folders(journalsRoot)
    .flatMap((seed) =>
      folders(seed).map((run) => ({
        seed: path.basename(seed),
        run: path.basename(run),
        folder: run,
        routes: journalsInFolder(run).length,
      }))
    )
    .filter((run) => run.routes > 0)
    .sort((a, b) => b.run.localeCompare(a.run) || a.seed.localeCompare(b.seed));
}

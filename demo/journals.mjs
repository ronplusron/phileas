// Reading a Route's journal back for a demo's replay check, shared by every
// demo's guided run and watcher so none of them can disagree on what
// "retraced" means. Not part of any application; no packager reaches it.

import fs from 'node:fs';
import path from 'node:path';

/** Every line of one Route's journal, parsed. `route` counts from 1. */
export function entriesOf(folder, route) {
  const file = fs.readdirSync(folder).find((f) => f.startsWith(`route-${String(route).padStart(3, '0')}-`));
  if (!file) throw new Error(`No journal for Route ${route} in ${folder}.`);
  return fs
    .readFileSync(path.join(folder, file), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/**
 * How one Route of a run met its plant, read from its journal rather than from
 * what was printed: a check that failed on a Trip hop, with the check's name
 * and the finding's id; a check that failed inside the Fix, which would mean a
 * Fix walked into a plant; a Route that stranded; or none of these.
 */
export function metIn(folder, route = 1) {
  const entries = entriesOf(folder, route);
  const failedOn = (kind) =>
    entries.find((e) => e.kind === kind && (e.checks ?? []).some((c) => c.result === 'failed'));
  const inFix = failedOn('fix-hop');
  if (inFix) return { where: 'fix', hop: inFix.hop };
  const trip = failedOn('trip-hop');
  if (trip) {
    const failed = trip.checks.filter((c) => c.result === 'failed');
    return {
      where: 'trip',
      hop: trip.hop,
      checks: failed.map((c) => c.check),
      ids: failed.flatMap((c) => (c.findings ?? []).filter((f) => !f.known).map((f) => f.id)),
    };
  }
  const outcome = entries.findLast((e) => e.kind === 'outcome');
  const hops = entries.filter((e) => e.kind === 'trip-hop').length;
  return outcome?.outcome === 'stranded' ? { where: 'stranded', hop: hops } : { where: 'none', outcome: outcome?.outcome ?? 'did not finish' };
}

/** What a replay must reproduce: each Trip hop's target, action, value and draws. `route` counts from 1. */
export function hopsOf(folder, route) {
  return entriesOf(folder, route)
    .filter((entry) => entry.kind === 'trip-hop')
    .map((e) => JSON.stringify([e.target, e.action, e.value, e.shareDraw, e.draw]));
}

/**
 * How every check fared over a whole run, Fix and Trip hops together: for each
 * check, in the order the journal lists them, how many Hops it passed, failed
 * and did not run on, and why it did not run.
 */
export function checkTally(folder) {
  const tally = new Map();
  for (const file of fs.readdirSync(folder).filter((f) => f.endsWith('.jsonl'))) {
    const route = Number(file.match(/^route-(\d+)-/)?.[1]);
    for (const entry of entriesOf(folder, route)) {
      if (entry.kind !== 'trip-hop' && entry.kind !== 'fix-hop') continue;
      for (const { check, result, observation } of entry.checks ?? []) {
        const t = tally.get(check) ?? { check, passed: 0, failed: 0, notRun: 0, reasons: new Set() };
        if (result === 'passed') t.passed++;
        else if (result === 'failed') t.failed++;
        else {
          t.notRun++;
          if (observation) t.reasons.add(observation);
        }
        tally.set(check, t);
      }
    }
  }
  return [...tally.values()];
}

/**
 * The lines a Journey's end prints about known findings, from
 * `renderJourneyFindings` in src/known.mjs: a heading and the lines under it,
 * named by how each begins, since Playwright's own closing lines are indented
 * the same way.
 */
export function journeyEndLines(lines) {
  const start = lines.findIndex((line) => /^Known findings, in /.test(line));
  if (start < 0) return [];
  const under = /^ {2}(seen |UNFILED, |not seen this Journey|none found|\d+ new finding|To file one)/;
  let end = start + 1;
  while (end < lines.length && under.test(lines[end])) end++;
  return lines.slice(start, end);
}

/** A run's printed lines with its known findings lines taken out, for a demo section about something else. */
export function withoutJourneyEnd(lines) {
  const end = journeyEndLines(lines);
  if (!end.length) return lines;
  const start = lines.indexOf(end[0]);
  return [...lines.slice(0, start), ...lines.slice(start + end.length)];
}

/** Whether two runs made the same Hops, and at least one. Two empty runs agree on nothing. */
export function sameHops(a, b) {
  return a.length > 0 && a.length === b.length && a.every((hop, i) => hop === b[i]);
}

/** One line saying whether a Route retraced, and where it first did not. */
export function retraceVerdict(a, b, route = 1) {
  if (a.length === 0) return `Route ${route} made no Trip hops, so there is nothing to retrace.`;
  if (sameHops(a, b)) return `Route ${route} retraced all ${a.length} hops exactly.`;
  const at = a.findIndex((hop, i) => hop !== b[i]);
  // A replay that ran on past the first one's end differs where the first stopped.
  const where = at === -1 ? Math.min(a.length, b.length) + 1 : at + 1;
  return `Route ${route} did not retrace: the runs first differ at hop ${where}.`;
}

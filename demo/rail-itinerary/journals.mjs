// Reading a Route's journal back for the demo's replay check, shared by the
// guided demo and the watcher so the two cannot disagree on what "retraced"
// means. Not part of the application; the packager leaves it out.

import fs from 'node:fs';
import path from 'node:path';

/** What a replay must reproduce: each Trip hop's target, action, value and draws. `route` counts from 1. */
export function hopsOf(folder, route) {
  const file = fs.readdirSync(folder).find((f) => f.startsWith(`route-${String(route).padStart(3, '0')}-`));
  if (!file) throw new Error(`No journal for Route ${route} in ${folder}.`);
  return fs
    .readFileSync(path.join(folder, file), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.kind === 'trip-hop')
    .map((e) => JSON.stringify([e.target, e.action, e.value, e.shareDraw, e.draw]));
}

/** Whether two runs made the same Hops, and at least one. Two empty runs agree on nothing. */
export function sameHops(a, b) {
  return a.length > 0 && a.length === b.length && a.every((hop, i) => hop === b[i]);
}

/** One line saying whether Route 1 retraced, and where it first did not. */
export function retraceVerdict(a, b) {
  if (a.length === 0) return 'Route 1 made no Trip hops, so there is nothing to retrace.';
  if (sameHops(a, b)) return `Route 1 retraced all ${a.length} hops exactly.`;
  const at = a.findIndex((hop, i) => hop !== b[i]);
  // A replay that ran on past the first one's end differs where the first stopped.
  const where = at === -1 ? Math.min(a.length, b.length) + 1 : at + 1;
  return `Route 1 did not retrace: the runs first differ at hop ${where}.`;
}

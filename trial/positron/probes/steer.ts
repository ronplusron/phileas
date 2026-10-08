import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createTest, deriveRouteStreams, journalFolder, requireRun, requireSeed, runRoute, type Candidate, type Chooser, type Fix } from '@drugstoresushi/phileas';
import { positron } from '../phileas/adapter';
import { knownFindings } from '../phileas/paths';
import { probeJournals } from './paths';

/**
 * What the step-6 triage probes share, written on 2026-10-07: a chooser that
 * steers to a list of targets in order, refusing one not on offer rather than
 * acting on something else, and a test per case that runs one Route through
 * the engine's own checks and prints the finding ids its Hops recorded. A
 * known finding lets a Route carry on, so the ids are read from the journal
 * rather than from whether the test passed.
 */
export type Want = (candidate: Candidate) => boolean;

export const menu = (pathText: string): Want => (c) => c.source === 'menu' && c.menuPath.join(' > ') === pathText;
export const control = (role: string, name: string): Want => (c) => c.source === 'page' && c.role === role && c.name === name;
export const key = (name: string): Want => (c) => c.source === 'key' && c.name === name;

function steps(wants: readonly Want[]): Chooser {
  let taken = 0;
  return {
    choose(candidates) {
      const want = wants[taken];
      taken += 1;
      const target = want && candidates.find(want);
      if (!target) throw new Error(`step ${taken}'s target is not on offer`);
      return { target };
    },
  };
}

export interface ProbeCase {
  readonly label: string;
  readonly fix?: Fix;
  readonly wants: readonly Want[];
}

const test = createTest(positron);

/**
 * One test per case. A case's Route number comes from its file, its title and
 * its repeat, so two probe files run together never share one: counting from
 * 1 in each file did, on 2026-10-07, and the second Route given a number was
 * refused its journal and printed the first one's findings as its own.
 */
export function probeCases(cases: readonly ProbeCase[]): void {
  cases.forEach(({ label, fix, wants }) =>
    test(label, async ({ page, app, userDataDir }, testInfo) => {
      const journeySeed = requireSeed();
      const identity = `${testInfo.file}\n${testInfo.title}\n${testInfo.repeatEachIndex}`;
      const routeNumber = parseInt(createHash('sha256').update(identity).digest('hex').slice(0, 6), 16) + 1;
      await runRoute({
        page, app, cfg: positron, streams: deriveRouteStreams(journeySeed, routeNumber), journeySeed, routeNumber,
        tripLength: wants.length, ...(fix ? { fix } : {}), chooser: steps(wants), journalsRoot: probeJournals, userDataDir, knownFindings,
      }).catch((error) => console.log(`probe ${routeNumber}: ended on ${(error as Error).message.split('\n')[0]}`));
      const folder = journalFolder(probeJournals, journeySeed, requireRun());
      const file = fs.readdirSync(folder).find((name) => name.startsWith(`route-${String(routeNumber).padStart(3, '0')}-`));
      const ids = fs
        .readFileSync(path.join(folder, file!), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .filter((entry) => entry.kind === 'trip-hop')
        .flatMap((hop) => (hop.checks ?? []).flatMap((check: { findings?: { id: string }[] }) => (check.findings ?? []).map((f) => `hop ${hop.hop}: ${f.id}`)));
      console.log(`probe ${routeNumber}, ${label}: ${ids.join(', ') || 'no findings'}`);
    })
  );
}

import fs from 'node:fs';
import path from 'node:path';
import { createTest, deriveRouteStreams, journalFolder, requireRun, requireSeed, runRoute, type Chooser } from '@drugstoresushi/phileas';
import { positron } from '../phileas/adapter';
import { session } from '../phileas/fixes/session';
import { knownFindings } from '../phileas/paths';
import { probeJournals } from './paths';

/**
 * Whether R running and then Go > Go to References sets off findings 4db2abb1
 * and 52aa5839, "unknown service 'editorProgressService'", met at hop 1 of
 * route 67 of step 6's session Journey, 365dbfb533b9, on 2026-10-06. Both are
 * known and unfiled by then, so the Route carries past them; the probe reads
 * the Hop's line for them.
 */
const test = createTest(positron);

const goToReferences: Chooser = {
  choose(candidates) {
    const target = candidates.find((c) => c.source === 'menu' && c.menuPath.join(' > ') === 'Go > Go to References');
    if (!target) throw new Error('Go > Go to References is not on offer');
    return { target };
  },
};

// With R running, as the Route had it, and with nothing running, to see
// whether R is needed at all.
for (const [label, fix] of [['R running', session], ['nothing running', undefined]] as const)
test(`${label}, then Go > Go to References`, async ({ page, app, userDataDir }, testInfo) => {
  const journeySeed = requireSeed();
  const routeNumber = testInfo.repeatEachIndex * 2 + (fix ? 1 : 2);
  await runRoute({
    page, app, cfg: positron, streams: deriveRouteStreams(journeySeed, routeNumber), journeySeed, routeNumber,
    tripLength: 1, ...(fix ? { fix } : {}), chooser: goToReferences, journalsRoot: probeJournals, userDataDir, knownFindings,
  }).catch((error) => console.log(`probe ${routeNumber}: ended on ${(error as Error).message.split('\n')[0]}`));
  const folder = journalFolder(probeJournals, journeySeed, requireRun());
  const file = fs.readdirSync(folder).find((name) => name.startsWith(`route-${String(routeNumber).padStart(3, '0')}-`));
  const ids = fs
    .readFileSync(path.join(folder, file!), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.kind === 'trip-hop')
    .flatMap((hop) => (hop.checks ?? []).flatMap((check: { findings?: { id: string }[] }) => (check.findings ?? []).map((f) => f.id)));
  console.log(`probe ${routeNumber}, ${label}: ${ids.join(', ') || 'no findings'}`);
});

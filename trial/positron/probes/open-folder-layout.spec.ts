import fs from 'node:fs';
import path from 'node:path';
import { createTest, deriveRouteStreams, requireRun, requireSeed, runRoute, journalFolder, type Chooser } from '@drugstoresushi/phileas';
import { positron } from '../phileas/adapter';
import { knownFindings } from '../phileas/paths';
import { probeJournals } from './paths';

/**
 * Whether three steps alone set off finding ab9b70f3, a TypeError in
 * ViewWelcomeController.layout with "Splitview: Failed to layout view", met by
 * step 6's no-Fix Journey on 2026-10-06: the Testing view opened, File >
 * Open Folder..., then Enter, which accepts the in-page dialog, opens the
 * home folder and reloads the window. Open Folder and Enter alone did not, in
 * 3 runs; the Route had opened the Testing view just before, and the error is
 * in the code laying out a view's welcome text. The finding is known and unfiled by then, so the Route carries past
 * it; the probe reads the Hop's line for it instead.
 */
const test = createTest(positron);

const twoSteps: Chooser & { taken: number } = {
  taken: 0,
  choose(candidates) {
    this.taken += 1;
    const target =
      this.taken === 1
        ? candidates.find((c) => c.source === 'page' && c.role === 'tab' && c.name === 'Testing')
        : this.taken === 2
          ? candidates.find((c) => c.source === 'menu' && c.menuPath.join(' > ') === 'File > Open Folder...')
          : candidates.find((c) => c.source === 'key' && c.name === 'Enter');
    if (!target) throw new Error(`step ${this.taken}'s target is not on offer`);
    return { target };
  },
};

test('the Testing view, File > Open Folder..., then Enter', async ({ page, app, userDataDir }, testInfo) => {
  const journeySeed = requireSeed();
  const routeNumber = testInfo.repeatEachIndex + 1;
  twoSteps.taken = 0;
  await runRoute({
    page, app, cfg: positron, streams: deriveRouteStreams(journeySeed, routeNumber), journeySeed, routeNumber,
    tripLength: 3, chooser: twoSteps, journalsRoot: probeJournals, userDataDir, knownFindings,
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
  console.log(`probe ${routeNumber}: ${ids.join(', ') || 'no findings'}`);
});

import fs from 'node:fs';
import path from 'node:path';
import { createTest, deriveRouteStreams, journalFolder, requireRun, requireSeed, runRoute, type Candidate, type Chooser } from '@drugstoresushi/phileas';
import { positron } from '../phileas/adapter';
import { notebook } from '../phileas/fixes/notebook';
import { knownFindings } from '../phileas/paths';
import { probeJournals } from './paths';

/**
 * Whether saving a workspace with no folder open sets off finding c19fec08 and
 * its console twins db8599cb and 8a3ccd98, a TypeError reading 'uri' as
 * positron-r activates, met by route 91 of step 6's notebook Journey,
 * a1725d030547, on 2026-10-06: File > Save Workspace As... at hop 15, OK at
 * hop 17, the window reloading into the workspace, and the error 1.7 s into
 * hop 18. Read in the installed positron-r, its activation reads
 * `workspace.workspaceFolders[0].uri` once the list is defined, and a
 * workspace saved with no folder has an empty one.
 *
 * Three Escapes follow the OK so the checks run a few more times after the
 * reload: the Route met the error 2.2 s after its OK, a Hop later, and a
 * replay of it that stopped right after the OK, at a tab no longer on offer,
 * saw only #44. The controls: the same steps after the
 * notebook Fix, as the Route had them; and the same steps with a folder open
 * first, by Open Folder... and Enter, which should leave the list with a
 * folder in it and set nothing off. The findings are known and unfiled by
 * then, so the Route carries past them; the probe reads the Hops' lines.
 */
const test = createTest(positron);

type Want = (c: Candidate) => boolean;
const menu = (pathText: string): Want => (c) => c.source === 'menu' && c.menuPath.join(' > ') === pathText;
const button = (name: string): Want => (c) => c.source === 'page' && c.role === 'button' && c.name === name;
const key = (name: string): Want => (c) => c.source === 'key' && c.name === name;

const SAVE = [menu('File > Save Workspace As...'), button('OK'), key('Escape'), key('Escape'), key('Escape')];
const OPEN_FOLDER = [menu('File > Open Folder...'), key('Enter')];

function steps(wants: Want[]): Chooser {
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

const cases = [
  { label: 'no Fix, Save Workspace As..., OK', fix: undefined, wants: SAVE },
  { label: 'the notebook Fix, Save Workspace As..., OK', fix: notebook, wants: SAVE },
  { label: 'a folder open, Save Workspace As..., OK', fix: undefined, wants: [...OPEN_FOLDER, ...SAVE] },
] as const;

cases.forEach(({ label, fix, wants }, index) =>
  test(label, async ({ page, app, userDataDir }, testInfo) => {
    const journeySeed = requireSeed();
    const routeNumber = testInfo.repeatEachIndex * cases.length + index + 1;
    await runRoute({
      page, app, cfg: positron, streams: deriveRouteStreams(journeySeed, routeNumber), journeySeed, routeNumber,
      tripLength: wants.length, ...(fix ? { fix } : {}), chooser: steps([...wants]), journalsRoot: probeJournals, userDataDir, knownFindings,
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

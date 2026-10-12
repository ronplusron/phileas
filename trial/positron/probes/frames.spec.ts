import {
  createExclusionTally,
  createTest,
  deriveRouteStreams,
  requireSeed,
  runRoute,
  survey,
  surveyLines,
  type Chooser,
  type Fix,
} from '@drugstoresushi/phileas';
import { positron } from '../phileas/adapter';
import { session } from '../phileas/fixes/session';
import { knownFindings } from '../phileas/paths';
import { probeJournals } from './paths';

/**
 * What Positron's webviews offer now that frames are read, and whether a
 * webview's frame keeps its label from one launch to the next, which a
 * replay depends on. Written on 2026-10-09, as decided when frames were
 * first read (docs/PLAN.md).
 *
 * The session Fix starts R, the probe's own step opens Help on `mean`, a
 * single Trip hop presses Escape so the checks run once over the open Help,
 * and then the probe surveys and prints every line naming a frame, and
 * every frame of the page with its element's label attributes. Run twice,
 * the two launches' labels can be compared.
 */
const test = createTest(positron);

const help: Fix = async (context) => {
  await session(context);
  const { page, step } = context;
  await step({
    kind: 'code',
    label: 'open Help on mean',
    action: async () => {
      await page.getByRole('tabpanel').getByRole('textbox').visible().last().focus();
      await page.keyboard.type('?mean');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(5_000);
    },
  });
};

const escape: Chooser = {
  choose: (candidates) => {
    const target = candidates.find((candidate) => candidate.source === 'key' && candidate.name === 'Escape');
    if (!target) throw new Error('Escape is not on offer');
    return { target };
  },
};

for (const launch of [1, 2]) {
  test(`Help's webview, launch ${launch}`, async ({ page, app, userDataDir }) => {
    const journeySeed = requireSeed();
    try {
      await runRoute({
        page,
        app,
        cfg: positron,
        streams: deriveRouteStreams(journeySeed, launch),
        journeySeed,
        routeNumber: launch,
        tripLength: 1,
        fix: help,
        chooser: escape,
        journalsRoot: probeJournals,
        userDataDir,
        knownFindings,
      });
      console.log(`frames probe ${launch}: no check failed`);
    } catch (error) {
      console.log(`frames probe ${launch}: the Route ended on ${(error as Error).name}: ${(error as Error).message.split('\n').slice(0, 4).join(' | ')}`);
    }
    for (const frame of page.frames()) {
      const element = await frame.frameElement().catch(() => null);
      const attributes = element
        ? await element
            .evaluate((node) => Object.fromEntries(['title', 'name', 'id', 'class', 'sandbox'].map((key) => [key, (node as Element).getAttribute(key)])))
            .catch((error: Error) => ({ unreadable: error.message.split('\n')[0] }))
        : 'the page';
      console.log(`frames probe ${launch}: frame ${frame.url().slice(0, 90)} ${JSON.stringify(attributes)}`);
    }
    const found = await survey({ page, app, exclusions: positron.exclusions, hopIndex: 0, tally: createExclusionTally(positron.exclusions) });
    const framed = surveyLines(found).filter((line) => line.includes('frame "'));
    console.log(`frames probe ${launch}: ${framed.length} survey lines name a frame`);
    for (const line of framed) console.log(`frames probe ${launch}:   ${line}`);
  });
}

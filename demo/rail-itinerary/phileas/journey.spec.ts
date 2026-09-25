import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createTest,
  expect,
  deriveRouteStreams,
  requireSeed,
  routeIndices,
  runRoute,
} from '@drugstoresushi/phileas';
import { demo, openAlps } from './journeys/demo';
import { railItinerary } from './adapter';

/** One test per Route, and nothing else. */
const test = createTest(railItinerary);
const here = path.dirname(fileURLToPath(import.meta.url));

for (const routeIndex of routeIndices(demo)) {
  test(`route ${routeIndex}`, async ({ page, app }, testInfo) => {
    const journeySeed = requireSeed();
    const streams = deriveRouteStreams(journeySeed, routeIndex);
    testInfo.annotations.push({ type: 'route-seed', description: streams.routeSeed });

    const outcome = await runRoute({
      page,
      app,
      cfg: railItinerary,
      streams,
      journeySeed,
      routeIndex,
      tripLength: demo.tripLength,
      fix: openAlps,
      journalsRoot: path.join(here, '.phileas-journals'),
    });

    expect(
      outcome.kind,
      outcome.kind === 'stranded' ? `stranded: ${outcome.reason}` : undefined
    ).toBe('passed');
  });
}

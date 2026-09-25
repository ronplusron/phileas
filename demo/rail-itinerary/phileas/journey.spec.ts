import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createTest,
  expect,
  deriveRouteStreams,
  requireSeed,
  routeNumbers,
  runRoute,
} from '@drugstoresushi/phileas';
import { journey, fix } from './journeys';
import { railItinerary } from './adapter';

/** One test per Route, and nothing else. */
const test = createTest(railItinerary);
const here = path.dirname(fileURLToPath(import.meta.url));

for (const routeNumber of routeNumbers(journey)) {
  test(`route ${routeNumber}`, async ({ page, app }, testInfo) => {
    const journeySeed = requireSeed();
    const streams = deriveRouteStreams(journeySeed, routeNumber);
    testInfo.annotations.push({ type: 'route-seed', description: streams.routeSeed });

    const outcome = await runRoute({
      page,
      app,
      cfg: railItinerary,
      streams,
      journeySeed,
      routeNumber,
      tripLength: journey.tripLength,
      fix,
      journalsRoot: path.join(here, '.phileas-journals'),
    });

    expect(
      outcome.kind,
      outcome.kind === 'stranded' ? `stranded: ${outcome.reason}` : undefined
    ).toBe('passed');
  });
}

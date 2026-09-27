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
import { positron } from './adapter';

/** One test per Route, and nothing else. */
const test = createTest(positron);
const here = path.dirname(fileURLToPath(import.meta.url));

for (const routeNumber of routeNumbers(journey)) {
  test(`route ${routeNumber}`, async ({ page, app, userDataDir }, testInfo) => {
    const journeySeed = requireSeed();
    const streams = deriveRouteStreams(journeySeed, routeNumber);
    testInfo.annotations.push({ type: 'route-seed', description: streams.routeSeed });

    const outcome = await runRoute({
      page,
      app,
      cfg: positron,
      streams,
      journeySeed,
      routeNumber,
      tripLength: journey.tripLength,
      fix,
      journalsRoot: path.join(here, '.phileas-journals'),
      // The adapter names its log from the Route's profile folder.
      userDataDir,
      // Bugs already found, which a Route records and carries on past.
      knownFindings: path.join(here, 'known-findings.json'),
    });

    // Only a survey was asked for, so nothing was traveled and there is no
    // verdict to reach. Skipped rather than passed, so a Journey run with
    // PHILEAS_SURVEY left set cannot read green.
    if (outcome.kind === 'surveyed') {
      test.skip(true, 'Only a survey was asked for (PHILEAS_SURVEY=1), so nothing was traveled.');
      return;
    }

    expect(
      outcome.kind,
      outcome.kind === 'stranded' ? `stranded: ${outcome.reason}` : undefined
    ).toBe('passed');
  });
}

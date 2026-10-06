import {
  createTest,
  expect,
  deriveRouteStreams,
  fixFor,
  requireSeed,
  routeNumbers,
  runRoute,
} from '@drugstoresushi/phileas';
import { journey } from './journeys';
import { fixes } from './fixes';
import { rstudio } from './adapter';
import { journalsRoot, knownFindings } from './paths';

const fix = fixFor(journey, fixes);

/** One test per Route, and nothing else. */
const test = createTest(rstudio);

for (const routeNumber of routeNumbers(journey)) {
  test(`route ${routeNumber}`, async ({ page, app, userDataDir }, testInfo) => {
    const journeySeed = requireSeed();
    const streams = deriveRouteStreams(journeySeed, routeNumber);
    // The Journey seed first, since that is what `phileas run --seed` takes to
    // replay this Route (R7); the Route's own seed is derived from it.
    testInfo.annotations.push(
      { type: 'journey-seed', description: journeySeed },
      { type: 'route-seed', description: streams.routeSeed }
    );

    const outcome = await runRoute({
      page,
      app,
      cfg: rstudio,
      streams,
      journeySeed,
      routeNumber,
      tripLength: journey.tripLength,
      fix,
      journalsRoot,
      userDataDir,
      // Bugs already found, which a Route records and carries on past.
      knownFindings,
      // Up from the engine's 3 s: on 2026-10-01 the r-markdown Fix's menu item
      // did not appear within 3 s on one Route of two.
      hopTimeoutMs: 5_000,
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

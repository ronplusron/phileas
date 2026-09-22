import { test, expect } from '@playwright/test';
import { deriveRouteStreams, requireSeed, routeIndices } from '@drugstoresushi/phileas';
import { exploration } from './journeys/exploration';

/**
 * The for-loop that registers one test per Route.
 *
 * This is the whole of what `CLAUDE.md` allows here. Playwright collects tests
 * before running them, so the Routes have to be registered up front, and that
 * is the only reason anything resembling a planner exists. It derives seeds and
 * registers tests. Anything else appearing in this file, in particular anything
 * deciding what a Route explores, is the planner growing back.
 *
 * The seed is read inside each test body, never at this file's top level: the
 * top level runs once per worker and would hand each worker a different seed.
 * Only the Route count is needed out here.
 *
 * **Nothing travels yet.** Each Route currently derives its own seeds and
 * reports them. That is phase 3's boundary and it is bookkeeping: these tests
 * show the Routes are registered and independently reproducible, and they show
 * nothing whatever about the application. Phase 4 puts the traversal inside
 * this same body.
 */
for (const routeIndex of routeIndices(exploration)) {
  test(`route ${routeIndex}`, async ({}, testInfo) => {
    const journeySeed = requireSeed();
    const streams = deriveRouteStreams(journeySeed, routeIndex);

    // Annotated rather than only logged, so that the seed travels with the
    // test's own result and a failure names what would retrace it.
    testInfo.annotations.push(
      { type: 'journey-seed', description: journeySeed },
      { type: 'route-seed', description: streams.routeSeed }
    );

    // The Route's own budget, stated where phase 4 will spend it.
    expect(exploration.hopsPerRoute).toBeGreaterThan(0);

    // Deriving twice from the same terms gives the same streams. Weak on its
    // own, and deliberately so: the real assertions about independence and the
    // stream split are unit tests in the engine's own suite, where they do not
    // need an application. What this adds is that the seed actually reached
    // this worker, which is the failure the unit tests cannot see.
    expect(deriveRouteStreams(journeySeed, routeIndex).routeSeed).toBe(streams.routeSeed);
  });
}

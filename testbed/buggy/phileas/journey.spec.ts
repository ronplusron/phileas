import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { deriveRouteStreams, requireSeed, routeIndices } from '@drugstoresushi/phileas';
import { exploration } from './journeys/exploration';
import { seedRecordPath } from './global-setup';

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

    // The assertion this file exists to make: the seed this Route is using is
    // the one global setup settled for the run.
    //
    // Checked against the file rather than against the environment variable,
    // because requireSeed reads that variable and the two would agree however
    // wrong they were. The file was written once, before any worker started.
    //
    // Two earlier assertions stood here and neither could fail: one restated a
    // condition defineJourney enforces at construction, and the other compared
    // a pure function to itself. Measured rather than argued -- replacing
    // requireSeed's return with a freshly generated seed left every Route green
    // and every Route reporting a seed that retraced nothing.
    // fileURLToPath, not .pathname: the latter stays percent-encoded and breaks
    // on any repository path containing a space.
    const here = path.dirname(fileURLToPath(import.meta.url));
    expect(journeySeed).toBe(fs.readFileSync(seedRecordPath(here), 'utf8'));

    // And this Route's seed is its own. A derivation that ignored the index
    // would give every Route the same stream while every Route still passed.
    const others = routeIndices(exploration)
      .filter((index) => index !== routeIndex)
      .map((index) => deriveRouteStreams(journeySeed, index).routeSeed);
    expect(others).not.toContain(streams.routeSeed);
  });
}

import fs from 'node:fs';
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
import { exploration } from './journeys/exploration';
import { buggy } from './adapter';
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
 */
const test = createTest(buggy);

// fileURLToPath, not .pathname: the latter stays percent-encoded and breaks on
// any repository path containing a space.
const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Where this run's journals are written, one directory per Journey seed.
 *
 * Under the seed rather than under a timestamp, so that the journals for a seed
 * named in a report are found by looking for that seed. A re-run of the same
 * seed rewrites them, which is what makes two runs comparable at all: the
 * comparison is done by copying the first set aside rather than by
 * accumulating, and a directory that only grows is one nobody reads.
 */
const journalDir = (journeySeed: string): string =>
  path.join(here, '.phileas-journals', journeySeed);

for (const routeIndex of routeIndices(exploration)) {
  test(`route ${routeIndex}`, async ({ page, app }, testInfo) => {
    const journeySeed = requireSeed();
    const streams = deriveRouteStreams(journeySeed, routeIndex);

    // Annotated rather than only logged, so that the seed travels with the
    // test's own result and a failure names what would retrace it.
    testInfo.annotations.push(
      { type: 'journey-seed', description: journeySeed },
      { type: 'route-seed', description: streams.routeSeed }
    );

    // The seed this Route is using is the one global setup settled for the run.
    //
    // Checked against the file rather than against the environment variable,
    // because requireSeed reads that variable and the two would agree however
    // wrong they were. The file was written once, before any worker started.
    //
    // Measured rather than argued: replacing requireSeed's return with a
    // freshly generated seed left every Route green and every Route reporting a
    // seed that retraced nothing.
    expect(journeySeed).toBe(fs.readFileSync(seedRecordPath(here), 'utf8'));

    const outcome = await runRoute({
      page,
      app,
      cfg: buggy,
      streams,
      journeySeed,
      routeIndex,
      hopsPerRoute: exploration.hopsPerRoute,
      journalDir: journalDir(journeySeed),
    });

    testInfo.annotations.push({
      type: 'outcome',
      description: `${outcome.kind} after ${outcome.hops} hop(s)`,
    });

    // **Completing the Journey is itself an assertion.** If the survey returns
    // nothing actionable at hop 23 the Route cannot finish its budget, and no
    // invariant catches that, because the page is structurally fine. A Route
    // that fails for not finishing is how dead ends, inescapable modals and
    // traps get caught without a check written for any of them.
    //
    // Stranded is its own outcome and is never folded into passed or failed.
    // Until phase 7's report exists there is nowhere separate to send it, so it
    // lands in the annotation above and in the journal, and the message below
    // carries the reason rather than asserting a defect the engine has not
    // found.
    expect(
      outcome.kind,
      `Route ${routeIndex} ended ${outcome.kind} after ${outcome.hops} of ` +
        `${exploration.hopsPerRoute} hops` +
        (outcome.kind === 'stranded' ? `: ${outcome.reason}` : '') +
        `. Route seed ${streams.routeSeed}; journal in ${journalDir(journeySeed)}.`
    ).toBe('passed');
  });
}

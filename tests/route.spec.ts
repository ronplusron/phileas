import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import { buggy } from '../testbed/buggy/phileas/adapter/index';
import {
  createExclusionTally,
  createTest,
  deriveRouteStreams,
  neverMatched,
  readJournal,
  runRoute,
  seededValues,
  settle,
  survey,
  takesTypedValue,
  NondeterministicExclusion,
  PageUnreachable,
  FixFailure,
  type AppUnderTest,
  type Candidate,
  type JournaledCandidate,
  type TripHopEntry,
} from '../src/index';

/**
 * Survey and the Route, against the real application.
 *
 * These run real Routes rather than simulating them, because the thing worth
 * checking is what the accessibility tree actually offers and what an exclusion
 * actually keeps out of the draw. A survey tested against a fabricated tree
 * would agree with whatever the fabrication assumed.
 *
 * None of this is evidence that the engine finds bugs. Nothing is planted in
 * `buggy` yet, so a green run here is consistent with an engine that checks
 * nothing at all. That stays true until phase 8.
 */

const test = createTest(buggy);

function scratch(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phileas-route-test-'));
}

const NO_EXCLUSIONS: AppUnderTest['exclusions'] = {};

test('survey finds the application controls by role, with no enumeration of them', async ({
  page,
  app,
}) => {
  const found = await survey({
    page,
    app,
    exclusions: NO_EXCLUSIONS,
    hopIndex: 0,
    tally: createExclusionTally(NO_EXCLUSIONS),
  });

  // The names are asserted because they are what a journal records and what a
  // replay reaches for. The roles are asserted because discovery is by role,
  // and an application that stopped exposing them would strand every Route
  // while nothing here looked wrong.
  expect(found.candidates.map((candidate) => `${candidate.role} "${candidate.name}"`)).toEqual([
    'button "Inventory"',
    'button "Summary"',
    'searchbox "Search items"',
    'button "Clear search"',
  ]);
});

test('survey offers nothing that is hidden', async ({ page, app }) => {
  const options = {
    page,
    app,
    exclusions: NO_EXCLUSIONS,
    hopIndex: 0,
    tally: createExclusionTally(NO_EXCLUSIONS),
  };

  // The outbound link lives on the Summary view, which starts hidden. This is
  // not tidiness: a dismissed widget can stay in the DOM and still take input,
  // and in one real application a keypress aimed at a closed picker landed in a
  // console and was executed as code. For a Route choosing its own moves that
  // is an arbitrary command run against the application under test.
  const before = await survey(options);
  expect(before.candidates.map((candidate) => candidate.name)).not.toContain(
    'Read about the journey'
  );

  await page.getByRole('button', { name: 'Summary', exact: true }).click();
  const after = await survey(options);
  expect(after.candidates.map((candidate) => candidate.name)).toContain(
    'Read about the journey'
  );
});

test('an exclusion by name keeps a candidate out of the draw, and is counted', async ({
  page,
  app,
}) => {
  await page.getByRole('button', { name: 'Summary', exact: true }).click();

  const exclusions = { names: ['Read about the journey'] };
  const tally = createExclusionTally(exclusions);
  const found = await survey({ page, app, exclusions, hopIndex: 0, tally });

  expect(found.candidates.map((candidate) => candidate.name)).not.toContain(
    'Read about the journey'
  );
  expect(found.excluded.map((entry) => entry.rule)).toContain(
    'names: Read about the journey'
  );

  // An entry that matched is not reported as stale. The counter's whole purpose
  // is telling a live rail from one whose control was renamed out from under
  // it, so it has to be right in both directions.
  expect(neverMatched(tally)).toEqual([]);
});

test('an exclusion that matched nothing is reported as such', async ({ page, app }) => {
  const exclusions = { names: ['A control that no longer exists'] };
  const tally = createExclusionTally(exclusions);
  await survey({ page, app, exclusions, hopIndex: 0, tally });

  // An exclusion list is pure input otherwise, so the engine has nowhere else
  // to say this. An entry that never matched is almost certainly stale: the
  // control it named was renamed or removed, and the rail it was meant to be
  // has quietly stopped existing.
  expect(neverMatched(tally)).toEqual(['names: A control that no longer exists']);
});

test('a nondeterministic exclusion predicate is caught rather than obeyed', async ({
  page,
  app,
}) => {
  let calls = 0;
  const exclusions = {
    // Flips on every call. The interface requires determinism and nothing
    // checked it, and the failure is silent by construction: the exclusion list
    // is an input to the seeded draw, so a predicate answering differently on a
    // replay sends every later hop somewhere else while the run still reports a
    // seed that retraces nothing.
    exclude: (_candidate: Candidate) => {
      calls += 1;
      return calls % 2 === 0;
    },
  };

  await expect(
    survey({ page, app, exclusions, hopIndex: 0, tally: createExclusionTally(exclusions) })
  ).rejects.toThrow(NondeterministicExclusion);
});

test('a deterministic predicate is not accused of being one', async ({ page, app }) => {
  // The positive control for the test above. A determinism check that fired on
  // an honest predicate would be switched off within a day, and then the check
  // that matters would be gone with it.
  const exclusions = { exclude: (candidate: Candidate) => candidate.name === 'Clear search' };
  const found = await survey({
    page,
    app,
    exclusions,
    hopIndex: 0,
    tally: createExclusionTally(exclusions),
  });

  expect(found.candidates.map((candidate) => candidate.name)).not.toContain('Clear search');
  expect(found.excluded.map((entry) => entry.rule)).toEqual(['exclude()']);
});

test('menu candidates are withheld, with a reason, when no window has focus', async ({
  page,
  app,
}) => {
  const found = await survey({
    page,
    app,
    exclusions: NO_EXCLUSIONS,
    hopIndex: 0,
    tally: createExclusionTally(NO_EXCLUSIONS),
  });

  // Measured on 2026-09-22: with windows hidden, getFocusedWindow() returns
  // null, focus() on a hidden window does not change that, and replacing
  // getFocusedWindow in the main process does not help either, because Electron
  // resolves the focused window for a menu click natively. So the menu source
  // is genuinely unavailable under an ordinary run, and the point of this test
  // is that it SAYS so: a source that quietly offered nothing would be
  // indistinguishable from an application with no menu.
  expect(found.menuSource.offered).toBe(false);
  if (!found.menuSource.offered) {
    expect(found.menuSource.reason).toMatch(/no application window holds focus/i);
    expect(found.menuSource.reason).toMatch(/PHILEAS_SHOW/);
  }
  expect(found.candidates.every((candidate) => candidate.source === 'page')).toBe(true);
});

test('a Route completes its Trip and journals every hop', async ({ page, app }) => {
  const dir = scratch();
  const streams = deriveRouteStreams('test-seed', 0);

  const outcome = await runRoute({
    page,
    app,
    cfg: buggy,
    streams,
    journeySeed: 'test-seed',
    routeIndex: 0,
    tripLength: 6,
    journalDir: dir,
  });

  expect(outcome).toEqual({ kind: 'passed', hops: 6 });

  const entries = readJournal(
    path.join(dir, `route-000-${streams.routeSeed}.jsonl`)
  );
  const pools = new Map<string, readonly JournaledCandidate[]>();
  const hops: TripHopEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === 'pool') pools.set(entry.id, entry.candidates);
    if (entry.kind === 'trip-hop') hops.push(entry);
  }
  expect(hops).toHaveLength(6);

  // R10: position, the target, and what else could have been chosen. The last
  // of those is what R14 later rests on, since comparing it against what is
  // available now is the only way to say whether a seed stopped reproducing
  // because the application changed or because the outcome did.
  for (const [index, entry] of hops.entries()) {
    // Counted from 1, because "stranded at hop 12" is read by a person.
    expect(entry.hop).toBe(index + 1);

    const pool = pools.get(entry.pool);
    expect(pool, `hop ${entry.hop} names pool ${entry.pool}, which is not in the file`).toBeDefined();
    expect(pool).toContainEqual(entry.target);
    expect(['click', 'fill', 'menu-click']).toContain(entry.action);
  }
});

test('every target is the pool entry its draw points at, from the file alone', async ({
  page,
  app,
}) => {
  // The consistency check that needs no replay. The seeded chooser always links
  // three recorded things by one rule, target = pool[floor(draw / 2^32 x size)],
  // so a journal can be checked against itself with nothing launched. A line
  // that breaks the rule means the engine acted on something other than what
  // its draw picked, or recorded the wrong pool or target.
  const dir = scratch();
  const streams = deriveRouteStreams('consistency-seed', 0);
  await runRoute({
    page,
    app,
    cfg: buggy,
    streams,
    journeySeed: 'consistency-seed',
    routeIndex: 0,
    tripLength: 12,
    journalDir: dir,
  });

  const pools = new Map<string, readonly JournaledCandidate[]>();
  let checked = 0;
  for (const entry of readJournal(path.join(dir, `route-000-${streams.routeSeed}.jsonl`))) {
    if (entry.kind === 'pool') pools.set(entry.id, entry.candidates);
    if (entry.kind !== 'trip-hop') continue;

    expect(entry.draw, `hop ${entry.hop} has no draw, and the seeded chooser always draws`).toBeDefined();
    const pool = pools.get(entry.pool) ?? [];
    const position = Math.floor(((entry.draw ?? 0) / 4_294_967_296) * pool.length);
    expect(pool[position], `hop ${entry.hop}`).toEqual(entry.target);
    checked += 1;
  }

  // A loop over an empty journal passes every assertion inside it. This is the
  // line that makes the zero-failure result above mean something.
  expect(checked).toBe(12);
});

test('one seed retraces one Route, hop for hop', async ({ page, app }) => {
  const targets = async (): Promise<string[]> => {
    const dir = scratch();
    const streams = deriveRouteStreams('replay-seed', 2);
    await runRoute({
      page,
      app,
      cfg: buggy,
      streams,
      journeySeed: 'replay-seed',
      routeIndex: 2,
      tripLength: 8,
      journalDir: dir,
    });
    return readJournal(path.join(dir, `route-002-${streams.routeSeed}.jsonl`))
      .filter((entry) => entry.kind === 'trip-hop')
      .map((entry) =>
        // The draw is compared as well as the target. A broken sequence can land
        // on the same target by chance, and only the draw tells the two apart.
        entry.kind === 'trip-hop'
          ? `${entry.target.name}/${entry.value ?? ''}/${String(entry.draw)}`
          : ''
      );
  };

  const first = await targets();

  // Back to where the Route started, because R8 is about an unchanged
  // application: a seed is only meaningful against the state it was recorded
  // from, and leaving the search box full would be testing something else.
  await page.getByRole('button', { name: 'Inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();

  const second = await targets();

  expect(second).toEqual(first);
  expect(first.length).toBe(8);
});

test('a Route with nowhere to go is stranded, not failed, and names the hop', async ({
  page,
  app,
}) => {
  // Every control taken away, which is what a dead end, an inescapable dialog
  // and a trap all look like from the Route's side.
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('button, input, a')) element.remove();
  });

  const dir = scratch();
  const outcome = await runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams('stranded-seed', 0),
    journeySeed: 'stranded-seed',
    routeIndex: 0,
    tripLength: 10,
    journalDir: dir,
  });

  // Stranded is the third outcome and is never folded into either of the other
  // two. It is not a failure, because nothing has been shown to be wrong;
  // calling it one would assert a defect the engine has not found. It is not a
  // pass either, because the Route did not do what was asked of it.
  expect(outcome.kind).toBe('stranded');
  expect(outcome.hops).toBe(0);

  // R5 asks it to name the hop it ran out at, which is what separates "this
  // application has a dead end at hop 3" from "this Route found nothing to do".
  // The journal is where that lands, and an outcome line saying only
  // "stranded" would leave a reader nothing to act on.
  const entries = readJournal(
    path.join(dir, `route-000-${deriveRouteStreams('stranded-seed', 0).routeSeed}.jsonl`)
  );
  const closing = entries.find((entry) => entry.kind === 'outcome');
  expect(closing).toMatchObject({ outcome: 'stranded', hops: 0 });
  expect(closing?.kind === 'outcome' ? closing.reason : '').toMatch(/no candidate was available/i);
});

test('a failure in the Fix is a distinct finding from a failed Route', async ({ page, app }) => {
  const dir = scratch();

  // R11: ten Routes failing on one broken precondition is one problem, not ten.
  // The Fix is fixed, so a failure in it says nothing about the route that was
  // about to be traveled, and if the two reported through one channel a single
  // broken setup step would bury whatever else the Journey found.
  const failing = runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams('fix-seed', 0),
    journeySeed: 'fix-seed',
    routeIndex: 0,
    tripLength: 5,
    journalDir: dir,
    fix: async ({ step }) => {
      await step('open the summary', async () => {
        await page.getByRole('button', { name: 'Summary', exact: true }).click();
      });
      await step('reach a control that is not there', async () => {
        await page.getByRole('button', { name: 'Nonexistent' }).click({ timeout: 500 });
      });
    },
  });

  await expect(failing).rejects.toThrow(FixFailure);
  await expect(failing).rejects.toThrow(/reach a control that is not there/);

  // Both steps are in the record as Fix hops, numbered from 1: the one that
  // succeeded, so a reader can see how far the known start got, and the one
  // that failed, with its error on its own line. R11 wants a broken Fix told
  // apart from a failed Route, which means saying which step broke rather than
  // leaving it as a sentence inside the outcome's reason.
  const entries = readJournal(
    path.join(dir, `route-000-${deriveRouteStreams('fix-seed', 0).routeSeed}.jsonl`)
  );
  const fixHops = entries.filter((entry) => entry.kind === 'fix-hop');
  expect(fixHops.map((entry) => (entry.kind === 'fix-hop' ? entry.hop : 0))).toEqual([1, 2]);
  expect(fixHops[0]).toMatchObject({ name: 'open the summary' });
  expect(fixHops[0]).not.toHaveProperty('error');
  expect(fixHops[1]).toMatchObject({ name: 'reach a control that is not there' });
  expect(fixHops[1]?.kind === 'fix-hop' ? fixHops[1].error : undefined).toBeTruthy();

  // And the Route never reached its Trip.
  expect(entries.some((entry) => entry.kind === 'trip-hop')).toBe(false);
});

test('a value is drawn on every hop, including hops that never type it', async ({
  page,
  app,
}) => {
  // A value drawn only for a text box would make every later draw depend on
  // what the survey happened to offer, and two runs of one seed would diverge
  // at the first hop that chose a button where the other chose a field.
  //
  // An earlier version of this test compared one generator against itself and
  // could not fail: it would have passed against exactly the conditional draw
  // it was written to rule out. What makes this one able to fail is the
  // chooser, which never picks a control that takes typing, so every generate()
  // recorded below is a draw the engine made for a hop that discarded it.
  const typedInto: string[] = [];
  const generatedFor: string[] = [];

  await runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams('unconditional-draw', 0),
    journeySeed: 'unconditional-draw',
    routeIndex: 0,
    tripLength: 5,
    journalDir: scratch(),
    chooser: {
      choose: (candidates) => {
        const button = candidates.find((candidate) => candidate.role === 'button');
        if (!button) throw new Error('this test needs a button on every hop');
        return { target: button };
      },
    },
    values: {
      generate: (candidate, rng) => {
        generatedFor.push(candidate.role);
        const value = seededValues.generate(candidate, rng);
        if (takesTypedValue(candidate)) typedInto.push(value);
        return value;
      },
    },
  });

  expect(generatedFor).toEqual(['button', 'button', 'button', 'button', 'button']);
  expect(typedInto).toEqual([]);
});

test('a prevented navigation ends the Route once, rather than timing out every hop', async ({
  page,
  app,
}) => {
  // The measured case, driven for real rather than simulated. Clicking the
  // outbound link schedules a navigation that the main process cancels in
  // will-navigate, so from the renderer's side the click never resolves. The
  // exclusion list is what should keep a Route off it; this is the case where a
  // list missed one, which is exactly the case nobody tests for.
  await page.getByRole('button', { name: 'Summary', exact: true }).click();

  const dir = scratch();
  const outcome = runRoute({
    page,
    app,
    // No exclusions, so the link is reachable. The adapter's own list names it.
    cfg: { ...buggy, exclusions: {} },
    streams: deriveRouteStreams('abandon-seed', 0),
    journeySeed: 'abandon-seed',
    routeIndex: 0,
    tripLength: 3,
    journalDir: dir,
    hopTimeoutMs: 700,
    chooser: {
      choose: (candidates) => {
        const link = candidates.find((candidate) => candidate.role === 'link');
        if (!link) throw new Error('this test needs the outbound link to be reachable');
        return { target: link };
      },
    },
  });

  // Measured, and it decides the shape of this test: the prevented navigation
  // never resolves, so every locator call after the click stays blocked. The
  // Route cannot continue, and the requirement is that it says so once rather
  // than spending the rest of its Trip on hops that each time out.
  await expect(outcome).rejects.toThrow(PageUnreachable);
  await expect(outcome).rejects.toThrow(/stopped answering after hop 1\b/);
  await expect(outcome).rejects.toThrow(/exclusion list/);

  const entries = readJournal(
    path.join(dir, `route-000-${deriveRouteStreams('abandon-seed', 0).routeSeed}.jsonl`)
  );

  // The hop that did it is still in the record, marked abandoned. Dropping it
  // would leave a journal whose last entry is an ordinary hop, with nothing to
  // say why the Route stopped.
  const hops = entries.filter((entry) => entry.kind === 'trip-hop');
  expect(hops).toHaveLength(1);
  expect(hops[0]?.kind === 'trip-hop' ? hops[0].abandoned : undefined).toBeTruthy();
  expect(hops[0]?.kind === 'trip-hop' ? hops[0].target.name : '').toBe('Read about the journey');

  // And the outcome line says failed rather than leaving the journal open, so a
  // reader can tell a Route that ended from one nobody saw stop.
  const closing = entries.find((entry) => entry.kind === 'outcome');
  expect(closing).toMatchObject({ outcome: 'failed' });

  // The engine's own evidence that nothing actually opened a browser. The page
  // is alive and answering, which is what makes this a blocked locator rather
  // than an application that left.
  expect(await page.evaluate(() => document.title)).toBe('Buggy');
});

test('settle reports what it cost, and says when a page never stopped moving', async ({
  page,
}) => {
  const quiet = await settle(page, 2_000);
  expect(quiet.settled).toBe(true);

  // A page that keeps changing is a finding for the checks to make, not a
  // reason to abandon the Hop, so the wait is bounded and returns unsettled
  // rather than throwing. Measured against the testbed on 2026-09-22: a settled
  // page costs a median of 17ms per hop.
  await page.evaluate(() => {
    const churn = document.createElement('div');
    document.body.append(churn);
    setInterval(() => {
      const button = document.createElement('button');
      button.textContent = `Churn ${Math.random()}`;
      churn.replaceChildren(button);
    }, 10);
  });

  const noisy = await settle(page, 600);
  expect(noisy.settled).toBe(false);

  // Near its budget, not exactly at it. The last snapshot inside the wait is
  // bounded by whatever is left, so settle can return a few milliseconds under:
  // measured at 598 against a 600 budget, which failed an earlier assertion
  // that demanded the budget exactly. What matters is that it returned on its
  // own terms rather than hanging on Playwright's default, which is thirty
  // seconds and is what an unbounded snapshot would have cost.
  expect(noisy.ms).toBeGreaterThan(400);
  expect(noisy.ms).toBeLessThan(2_000);
});

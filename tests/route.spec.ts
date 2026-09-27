import fs from 'node:fs';
import path from 'node:path';
import { expect, type ElectronApplication, type Page } from '@playwright/test';
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
  DEFAULT_SETTLE_QUIET_MS,
  RUN_VARIABLE,
  journalFolder,
  DEFAULT_KEY_SHARE,
  DEFAULT_MENU_SHARE,
  sharesFor,
  sideOfShareDraw,
  sideCandidates,
  printedShortcut,
  survey,
  showWindows,
  clickMenuItem,
  takesTypedValue,
  NondeterministicExclusion,
  PageUnreachable,
  FixFailure,
  type AppUnderTest,
  type Candidate,
  type Chooser,
  type JournaledCandidate,
  type TripHopEntry,
} from '../src/index';
import { scratch as makeScratch, removeScratch } from './scratch';

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
test.afterEach(removeScratch);

function scratch(): string {
  return makeScratch('phileas-route-test-');
}

// A Route reads its run's name the way it does in a Journey, from what global
// setup settled. These tests have no global setup, so the name is set here.
const TEST_RUN = 'test-run';
process.env[RUN_VARIABLE] = TEST_RUN;

/** The one run folder a test's scratch root holds, under its single seed. */
function inRun(root: string): string {
  const seeds = fs.readdirSync(root);
  expect(seeds, `expected one seed folder under ${root}`).toHaveLength(1);
  return journalFolder(root, seeds[0] ?? '', TEST_RUN);
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
    'combobox "Category"',
    'option "All categories"',
    'option "Luggage"',
    'option "Instruments"',
    'option "Clothing"',
    // The menu bar, in menu order, offered in every window mode. The adapter
    // excludes nothing here, and still Quit and the Edit entries are absent:
    // they are standard entries, which the engine skips by default. The three
    // below are buggy's own.
    'menuitem "About Buggy"',
    'menuitem "Show Inventory"',
    'menuitem "Show Summary"',
    // The common keys, always offered after everything else, in this order.
    'key "Enter"',
    'key "Escape"',
    'key "Tab"',
    'key "ArrowUp"',
    'key "ArrowDown"',
    'key "ArrowLeft"',
    'key "ArrowRight"',
  ]);
});

test('two controls sharing a name are counted from 1, and the second is the one reached', async ({
  page,
  app,
}) => {
  // Planted rather than built into buggy, which has no two controls sharing a
  // name, and whose baseline this would otherwise move.
  await page.evaluate(() => {
    for (const which of ['first', 'second']) {
      const button = document.createElement('button');
      button.textContent = 'Twin';
      button.addEventListener('click', () => document.body.setAttribute('data-twin-clicked', which));
      document.body.append(button);
    }
  });
  const found = await survey({
    page,
    app,
    exclusions: NO_EXCLUSIONS,
    hopIndex: 0,
    tally: createExclusionTally(NO_EXCLUSIONS),
  });
  const twins = found.candidates.filter((candidate) => candidate.source === 'page' && candidate.name === 'Twin');
  expect(twins.map((twin) => (twin.source === 'page' ? twin.nth : undefined))).toEqual([1, 2]);

  // The number a person reads must reach the control it names: an off-by-one
  // between counting from 1 and Playwright's count from 0 would click the
  // first twin here, or nothing.
  const second = twins[1];
  if (second?.source !== 'page') throw new Error('expected a second twin on the page');
  await second.locator.click();
  await expect(page.locator('body')).toHaveAttribute('data-twin-clicked', 'second');
});

test('standard menu entries are skipped unless their role is allowed back, and a stale role is reported', async ({
  page,
  app,
}) => {
  const exclusions: AppUnderTest['exclusions'] = { allowStandardMenuRoles: ['selectall', 'selectal'] };
  const tally = createExclusionTally(exclusions);
  const found = await survey({ page, app, exclusions, hopIndex: 0, tally });

  const offered = found.candidates.filter((c) => c.source === 'menu').map((c) => c.name);
  // Select All came back; the other standard entries stayed out.
  expect(offered).toEqual(['About Buggy', 'Select All', 'Show Inventory', 'Show Summary']);
  expect(found.excluded.map((entry) => entry.rule)).toEqual([
    'standard menu entry: quit',
    'standard menu entry: cut',
    'standard menu entry: copy',
    'standard menu entry: paste',
  ]);
  // The misspelled role matched nothing, and says so rather than failing open.
  expect(neverMatched(tally)).toEqual(['allowStandardMenuRoles: selectal']);
});

test('a menu path excludes an entry the application wrote itself', async ({ page, app }) => {
  const exclusions: AppUnderTest['exclusions'] = { menuPaths: [['View', 'Show Summary']] };
  const tally = createExclusionTally(exclusions);
  const found = await survey({ page, app, exclusions, hopIndex: 0, tally });
  expect(found.candidates.map((c) => c.name)).not.toContain('Show Summary');
  expect(found.excluded.map((entry) => entry.rule)).toContain('menuPaths: View > Show Summary');
  expect(neverMatched(tally)).toEqual([]);
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
  // The standard menu entries are skipped by their own rule and say nothing
  // about the predicate.
  expect(
    found.excluded.map((entry) => entry.rule).filter((rule) => !rule.startsWith('standard menu entry'))
  ).toEqual(['exclude()']);
});

test('menu candidates are offered whether or not a window has focus', async ({ page, app }) => {
  const focused = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow() !== null);
  // The condition that used to withhold them, confirmed rather than assumed.
  // Under a shown mode a window may hold focus, and the offer must not care.
  if (!showWindows()) expect(focused).toBe(false);

  const found = await survey({
    page,
    app,
    exclusions: NO_EXCLUSIONS,
    hopIndex: 0,
    tally: createExclusionTally(NO_EXCLUSIONS),
  });

  // Withholding them made what a Route could draw depend on whatever else on
  // the machine held focus, and a replay went a different way on 2026-09-24
  // because of it.
  expect(found.menuSource.offered).toBe(true);
  expect(found.candidates.filter((c) => c.source === 'menu').map((c) => c.name)).toEqual(
    expect.arrayContaining(['Show Inventory', 'Show Summary'])
  );
});

test('a menu hop hands its handler the Route window, as a click on the menu would', async ({
  page,
  app,
}) => {
  // A handler with no fallback, which buggy's own do not have: handed no window,
  // it records none. The ordinary shape `(item, win) => win.webContents.send()`
  // would do nothing at all there, and a bare `item.click()` hands it no window
  // whether or not one holds focus, measured on 2026-09-24.
  await app.evaluate(({ Menu, MenuItem }) => {
    const view = Menu.getApplicationMenu()?.items.find((item) => item.label === 'View');
    const record = globalThis as { menuProbe?: number | null };
    view?.submenu?.append(
      new MenuItem({ label: 'Probe', click: (_item, win) => (record.menuProbe = win?.id ?? null) })
    );
  });

  await clickMenuItem(app, ['View', 'Probe'], page);

  const received = await app.evaluate(() => (globalThis as { menuProbe?: number | null }).menuProbe);
  const routeWindow = await app.browserWindow(page);
  const expected = await routeWindow.evaluate((win) => (win as { id: number }).id);
  await routeWindow.dispose();
  expect(received).toBe(expected);
});

test('a Route completes its Trip and journals every hop', async ({ page, app }) => {
  const dir = scratch();
  const streams = deriveRouteStreams('test-seed', 1);

  const outcome = await runRoute({
    page,
    app,
    cfg: buggy,
    streams,
    journeySeed: 'test-seed',
    routeNumber: 1,
    tripLength: 6,
    journalsRoot: dir,
  });

  expect(outcome).toEqual({ kind: 'passed', hops: 6 });

  const entries = readJournal(
    path.join(inRun(dir), `route-001-${streams.routeSeed}.jsonl`)
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
    expect(['click', 'type', 'press', 'select', 'focus', 'menu-click']).toContain(entry.action);
  }
});

test('every target is the pool entry its draw points at, from the file alone', async ({
  page,
  app,
}) => {
  // The consistency check that needs no replay. The seeded chooser links the
  // recorded things by one rule: the share draw picks a side, the common keys
  // below an eighth of 2^32, the menu below a quarter and the page otherwise,
  // with an empty side falling back to the page, and the target is
  // side[floor(draw / 2^32 x size)] in pool order. So a journal can be checked
  // against itself with nothing launched. A line that breaks the rule means the
  // engine acted on something other than what its draws picked.
  const dir = scratch();
  const streams = deriveRouteStreams('consistency-seed', 1);
  await runRoute({
    page,
    app,
    cfg: buggy,
    streams,
    journeySeed: 'consistency-seed',
    routeNumber: 1,
    tripLength: 12,
    journalsRoot: dir,
  });

  const pools = new Map<string, readonly JournaledCandidate[]>();
  let checked = 0;
  let keyShare = NaN;
  let menuShare = NaN;
  for (const entry of readJournal(path.join(inRun(dir), `route-001-${streams.routeSeed}.jsonl`))) {
    // The shares come from the file too, which is what makes this "from the
    // file alone": a reader with only the journal can check it.
    if (entry.kind === 'route') {
      keyShare = entry.keyShare ?? NaN;
      menuShare = entry.menuShare ?? NaN;
      // Skipping the standard menu entries is an input to the draw as well, so
      // the journal says which roles were allowed back: none, by default.
      expect(entry.allowStandardMenuRoles).toEqual([]);
    }
    if (entry.kind === 'pool') pools.set(entry.id, entry.candidates);
    if (entry.kind !== 'trip-hop') continue;

    expect(entry.draw, `hop ${entry.hop} has no draw, and the seeded chooser always draws`).toBeDefined();
    expect(entry.shareDraw, `hop ${entry.hop} has no share draw`).toBeDefined();
    // Written out here from the journal's own description of the share draw,
    // rather than calling the chooser's helpers, which would check the chooser
    // against itself.
    const pool = pools.get(entry.pool) ?? [];
    const isKey = (c: JournaledCandidate) => c.source === 'key' && c.role === 'key';
    const keys = pool.filter(isKey);
    const menu = pool.filter((c) => c.source === 'menu');
    const page = pool.filter((c) => c.source !== 'menu' && !isKey(c));
    const fraction = (entry.shareDraw ?? 0) / 4_294_967_296;
    const chosen =
      fraction < keyShare ? keys : fraction < keyShare + menuShare ? menu : page;
    const side = [chosen, page, keys, menu].find((candidates) => candidates.length) ?? [];
    const position = Math.floor(((entry.draw ?? 0) / 4_294_967_296) * side.length);
    expect(side[position], `hop ${entry.hop}`).toEqual(entry.target);
    checked += 1;
  }

  // A loop over an empty journal passes every assertion inside it. This is the
  // line that makes the zero-failure result above mean something.
  expect(checked).toBe(12);
  expect([keyShare, menuShare]).toEqual([DEFAULT_KEY_SHARE, DEFAULT_MENU_SHARE]);
});

test("a Route draws with the adapter's shares, and journals them", async ({ page, app }) => {
  const sidesDrawn = async (cfg: AppUnderTest) => {
    const dir = scratch();
    const streams = deriveRouteStreams('shares-seed', 1);
    await runRoute({
      page,
      app,
      cfg,
      streams,
      journeySeed: 'shares-seed',
      routeNumber: 1,
      tripLength: 20,
      journalsRoot: dir,
    });
    const entries = readJournal(path.join(inRun(dir), `route-001-${streams.routeSeed}.jsonl`));
    const opening = entries.find((entry) => entry.kind === 'route');
    const hops = entries.filter((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
    return {
      shares: opening?.kind === 'route' ? [opening.keyShare, opening.menuShare] : [],
      offPage: hops.filter(
        (hop) => hop.target.source === 'menu' || (hop.target.source === 'key' && hop.target.role === 'key')
      ).length,
    };
  };

  const none = await sidesDrawn({ ...buggy, keyShare: 0, menuShare: 0 });
  expect(none.shares).toEqual([0, 0]);
  expect(none.offPage).toBe(0);

  // The positive control: the same seed with the default shares does reach the
  // keys or the menu, so the zero above is the shares and not a quiet Route.
  await page.reload();
  await buggy.waitForReady(page);
  const defaults = await sidesDrawn(buggy);
  expect(defaults.shares).toEqual([DEFAULT_KEY_SHARE, DEFAULT_MENU_SHARE]);
  expect(defaults.offPage).toBeGreaterThan(0);
});

test('one seed retraces one Route, hop for hop', async ({ page, app }) => {
  const targets = async (): Promise<string[]> => {
    const dir = scratch();
    const streams = deriveRouteStreams('replay-seed', 3);
    await runRoute({
      page,
      app,
      cfg: buggy,
      streams,
      journeySeed: 'replay-seed',
      routeNumber: 3,
      tripLength: 8,
      journalsRoot: dir,
    });
    return readJournal(path.join(inRun(dir), `route-003-${streams.routeSeed}.jsonl`))
      .filter((entry) => entry.kind === 'trip-hop')
      .map((entry) =>
        // The draw is compared as well as the target. A broken sequence can land
        // on the same target by chance, and only the draw tells the two apart.
        entry.kind === 'trip-hop'
          ? `${entry.target.name}/${entry.value ?? ''}/${String(entry.shareDraw)}/${String(entry.draw)}`
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

test('a longer Trip from the same seed retraces a shorter one, then carries on', async ({ page, app }) => {
  // The Trip length decides where a Route stops and nothing else: every Hop
  // takes the same draws whatever the length, so the moves along the way are
  // the same. That is what lets a longer run replay a shorter one's Hops.
  const targets = async (tripLength: number): Promise<string[]> => {
    const dir = scratch();
    const streams = deriveRouteStreams('longer-seed', 1);
    await runRoute({
      page,
      app,
      cfg: buggy,
      streams,
      journeySeed: 'longer-seed',
      routeNumber: 1,
      tripLength,
      journalsRoot: dir,
    });
    return readJournal(path.join(inRun(dir), `route-001-${streams.routeSeed}.jsonl`))
      .filter((entry) => entry.kind === 'trip-hop')
      .map((entry) =>
        entry.kind === 'trip-hop'
          ? `${entry.target.name}/${entry.value ?? ''}/${String(entry.shareDraw)}/${String(entry.draw)}`
          : ''
      );
  };

  const short = await targets(4);

  // Back to where the Route started, as in the test above.
  await page.getByRole('button', { name: 'Inventory', exact: true }).click();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();

  const long = await targets(8);

  expect(short.length).toBe(4);
  expect(long.length).toBe(8);
  expect(long.slice(0, 4)).toEqual(short);
  // The four Hops after the shorter Trip ended are more of the Route, not a
  // repeat of its start, or the prefix above would match for the wrong reason.
  expect(long.slice(4)).not.toEqual(short);
});

test('a Route with nowhere to go is stranded, not failed, and names the hop', async ({
  page,
  app,
}) => {
  // Every control taken away, which is what a dead end, an inescapable dialog
  // and a trap all look like from the Route's side.
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('button, input, select, a')) element.remove();
  });

  const dir = scratch();
  const outcome = await runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams('stranded-seed', 1),
    journeySeed: 'stranded-seed',
    routeNumber: 1,
    tripLength: 10,
    journalsRoot: dir,
  });

  // Stranded is the third outcome and is never folded into either of the other
  // two. It is not a failure, because nothing has been shown to be wrong;
  // calling it one would assert a defect the engine has not found. It is not a
  // pass either, because the Route did not do what was asked of it.
  expect(outcome).toMatchObject({ kind: 'stranded', hops: 0 });

  // R5 asks it to name the hop it ran out at, which is what separates "this
  // application has a dead end at hop 3" from "this Route found nothing to do".
  // The journal is where that lands, and an outcome line saying only
  // "stranded" would leave a reader nothing to act on.
  const entries = readJournal(
    path.join(inRun(dir), `route-001-${deriveRouteStreams('stranded-seed', 1).routeSeed}.jsonl`)
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
    streams: deriveRouteStreams('fix-seed', 1),
    journeySeed: 'fix-seed',
    routeNumber: 1,
    tripLength: 5,
    journalsRoot: dir,
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
    path.join(inRun(dir), `route-001-${deriveRouteStreams('fix-seed', 1).routeSeed}.jsonl`)
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

test('every hop records what it did to the screen, Fix and Trip alike (R31)', async ({
  page,
  app,
}) => {
  const dir = scratch();
  const streams = deriveRouteStreams('effect-seed', 1);

  await runRoute({
    page,
    app,
    cfg: buggy,
    streams,
    journeySeed: 'effect-seed',
    routeNumber: 1,
    tripLength: 5,
    journalsRoot: dir,
    fix: async ({ step }) => {
      await step('open the summary', async () => {
        await page.getByRole('button', { name: 'Summary', exact: true }).click();
      });
      await step('do nothing', async () => {});
    },
  });

  const entries = readJournal(path.join(inRun(dir), `route-001-${streams.routeSeed}.jsonl`));
  const [opened, idle] = entries.filter((entry) => entry.kind === 'fix-hop');

  // Opening the summary brings its heading onto the screen. Read from the real
  // application rather than a fabricated tree, so this fails if the headings
  // the survey reads stop being the ones a person sees.
  expect(opened?.kind === 'fix-hop' ? opened.effect : undefined).toMatchObject({
    readable: true,
    changed: true,
    appeared: expect.arrayContaining(['Total weight']),
  });

  // The positive control for "changed": a step that does nothing reads as
  // unchanged. Without it, a comparison that always said "changed" would pass
  // the assertion above.
  expect(idle?.kind === 'fix-hop' ? idle.effect : undefined).toMatchObject({
    readable: true,
    changed: false,
  });

  const tripHops = entries.filter((entry) => entry.kind === 'trip-hop');
  expect(tripHops.length).toBe(5);
  for (const hop of tripHops) {
    expect(hop.kind === 'trip-hop' ? hop.effect.readable : undefined).toBe(true);
  }
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
    streams: deriveRouteStreams('unconditional-draw', 1),
    journeySeed: 'unconditional-draw',
    routeNumber: 1,
    tripLength: 5,
    journalsRoot: scratch(),
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

test('an option in a native dropdown is chosen through the dropdown, and takes effect', async ({
  page,
  app,
}) => {
  // Playwright cannot click an <option>. Before `select` existed, every Hop that
  // drew one timed out and was abandoned, and no dropdown's value could change:
  // measured on trickster-tales, where all 14 abandoned Hops of a Journey were
  // options in its two Compare pickers. The chooser here always draws the
  // Luggage option, so every Hop exercises exactly that case.
  const dir = scratch();
  const streams = deriveRouteStreams('select-seed', 1);

  await runRoute({
    page,
    app,
    cfg: buggy,
    streams,
    journeySeed: 'select-seed',
    routeNumber: 1,
    tripLength: 2,
    journalsRoot: dir,
    hopTimeoutMs: 1_000,
    chooser: {
      choose: (candidates) => {
        const luggage = candidates.find(
          (candidate) => candidate.role === 'option' && candidate.name === 'Luggage'
        );
        if (!luggage) throw new Error('this test needs the Luggage option to be offered');
        return { target: luggage };
      },
    },
  });

  const hops = readJournal(path.join(inRun(dir), `route-001-${streams.routeSeed}.jsonl`)).filter(
    (entry) => entry.kind === 'trip-hop'
  );
  expect(hops).toHaveLength(2);
  for (const entry of hops) {
    expect(entry).toMatchObject({ action: 'select', target: { role: 'option', name: 'Luggage' } });
    expect(entry.kind === 'trip-hop' ? entry.abandoned : 'wrong kind').toBeUndefined();
  }

  // The choice reached the application, not only the dropdown: buggy listens
  // for the change event and filters the list to its three luggage items.
  await expect(page.locator('#category')).toHaveValue('luggage');
  await expect(page.locator('#count')).toHaveText('3 items');
});

test('a native dropdown itself is focused, not clicked open', async ({ page, app }) => {
  // Clicking a native <select> opens the operating system's popup list, which
  // the engine cannot see or use and which holds the application open: a close
  // took 0.7 to 10.4 seconds after one, against about 40ms otherwise. Focusing
  // reaches it the way tabbing to it would. The chooser always draws the
  // dropdown, so every Hop exercises exactly that case.
  const dir = scratch();
  const streams = deriveRouteStreams('focus-seed', 1);

  await runRoute({
    page,
    app,
    cfg: buggy,
    streams,
    journeySeed: 'focus-seed',
    routeNumber: 1,
    tripLength: 2,
    journalsRoot: dir,
    chooser: {
      choose: (candidates) => {
        const dropdown = candidates.find((candidate) => candidate.role === 'combobox');
        if (!dropdown) throw new Error('this test needs the Category dropdown to be offered');
        return { target: dropdown };
      },
    },
  });

  const hops = readJournal(path.join(inRun(dir), `route-001-${streams.routeSeed}.jsonl`)).filter(
    (entry) => entry.kind === 'trip-hop'
  );
  expect(hops.map((entry) => (entry.kind === 'trip-hop' ? entry.action : ''))).toEqual([
    'focus',
    'focus',
  ]);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('category');
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
    streams: deriveRouteStreams('abandon-seed', 1),
    journeySeed: 'abandon-seed',
    routeNumber: 1,
    tripLength: 3,
    journalsRoot: dir,
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
  await expect(outcome).rejects.toThrow(/could not be surveyed after hop 1\b[\s\S]*exclusion list/);
  await expect(outcome).rejects.toThrow(/exclusion list/);

  const entries = readJournal(
    path.join(inRun(dir), `route-001-${deriveRouteStreams('abandon-seed', 1).routeSeed}.jsonl`)
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

test('a page that changes every 200ms is not settled, though two reads agree', async ({
  page,
}) => {
  // The defect this closes, reproduced on the testbed. Measured on RStudio and
  // Positron on 2026-09-24: a console printing a line every 200 ms read as
  // settled every time, because two reads a frame apart fall between changes.
  await page.evaluate(() => {
    const ticker = document.createElement('div');
    document.body.append(ticker);
    let n = 0;
    setInterval(() => {
      const button = document.createElement('button');
      button.textContent = `Tick ${n++}`;
      ticker.replaceChildren(button);
    }, 200);
  });

  // The positive control: with no window, which is the old rule of two reads
  // agreeing, the same page does read as settled. Without this, a settle that
  // could never return settled would pass the assertion below.
  const oldRule = await settle(page, 2_000, 0);
  expect(oldRule.settled).toBe(true);

  const withWindow = await settle(page, 2_000);
  expect(withWindow.settled).toBe(false);
});

test('a quiet page settles after the window, not before', async ({ page }) => {
  const quiet = await settle(page, 2_000);
  expect(quiet.settled).toBe(true);
  expect(quiet.ms).toBeGreaterThanOrEqual(DEFAULT_SETTLE_QUIET_MS);
  expect(quiet.ms).toBeLessThan(DEFAULT_SETTLE_QUIET_MS + 500);
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

test('the keys and the menu each get an eighth of the share draw by default', () => {
  const shares = sharesFor({});
  expect(shares).toEqual({ keyShare: 1 / 8, menuShare: 1 / 8 });
  const eighth = 4_294_967_296 / 8;
  // The boundaries, from both sides, so a share that drifted by one would show.
  expect(sideOfShareDraw(0, shares)).toBe('keys');
  expect(sideOfShareDraw(eighth - 1, shares)).toBe('keys');
  expect(sideOfShareDraw(eighth, shares)).toBe('menu');
  expect(sideOfShareDraw(2 * eighth - 1, shares)).toBe('menu');
  expect(sideOfShareDraw(2 * eighth, shares)).toBe('page');
  expect(sideOfShareDraw(4_294_967_295, shares)).toBe('page');
});

test('an adapter can set its own shares, and one that cannot be drawn with is refused', () => {
  const quarter = 4_294_967_296 / 4;
  const shares = sharesFor({ keyShare: 0, menuShare: 1 / 4 });
  expect(sideOfShareDraw(0, shares)).toBe('menu');
  expect(sideOfShareDraw(quarter - 1, shares)).toBe('menu');
  expect(sideOfShareDraw(quarter, shares)).toBe('page');

  expect(() => sharesFor({ keyShare: 1 })).toThrow(/keyShare is 1/);
  expect(() => sharesFor({ menuShare: -0.1 })).toThrow(/menuShare is -0.1/);
  expect(() => sharesFor({ keyShare: Number.NaN })).toThrow(/keyShare is NaN/);
  expect(() => sharesFor({ keyShare: 0.5, menuShare: 0.5 })).toThrow(/leaves the page no share/);
});

test('a chosen side with nothing on it falls back to the page', () => {
  const page = { source: 'page', role: 'button', name: 'Summary' };
  const shortcut = { source: 'key', role: 'shortcut', name: '⌘S' };
  const key = { source: 'key', role: 'key', name: 'Enter' };
  const menu = { source: 'menu', role: 'menuitem', name: 'Show Summary' };

  // Printed shortcuts are drawn with the page, since each belongs to a control.
  expect(sideCandidates([page, shortcut, key, menu], 'page')).toEqual([page, shortcut]);
  expect(sideCandidates([page, shortcut, key, menu], 'keys')).toEqual([key]);
  expect(sideCandidates([page, shortcut, key, menu], 'menu')).toEqual([menu]);
  // An application with no menu, or one whose menu is all excluded.
  expect(sideCandidates([page, key], 'menu')).toEqual([page]);
  // Only reachable by a chooser handed a pool directly: a Route strands first.
  expect(sideCandidates([menu], 'keys')).toEqual([menu]);
});

test('a shortcut printed in a name is read as the key it names', () => {
  expect(printedShortcut('Save current document (⌘S)')).toEqual({ label: '⌘S', key: 'Meta+s' });
  expect(printedShortcut('Save all open documents (⌥⌘S)')).toEqual({
    label: '⌥⌘S',
    key: 'Alt+Meta+s',
  });
  expect(printedShortcut('Explorer (⇧⌘E)')?.key).toBe('Shift+Meta+e');
  expect(printedShortcut('Terminal (⌃`)')?.key).toBe('Control+`');
  // Parentheses with no modifier are ordinary text, not a shortcut.
  expect(printedShortcut('Extensions (2 require restart)')).toBeUndefined();
  expect(printedShortcut('Clear search')).toBeUndefined();
});

test('a shortcut is excluded whenever its control is', async ({ page, app }) => {
  await page.evaluate(() => {
    const quit = document.createElement('button');
    quit.textContent = 'Quit the probe (⌘Q)';
    document.body.append(quit);
  });

  const shortcuts = async (exclusions: AppUnderTest['exclusions']) =>
    (
      await survey({ page, app, exclusions, hopIndex: 0, tally: createExclusionTally(exclusions) })
    ).candidates
      .filter((c) => c.source === 'key' && c.role === 'shortcut')
      .map((c) => c.name);

  // The positive control: with nothing excluded, the shortcut is offered.
  expect(await shortcuts({})).toEqual(['⌘Q']);
  // Excluding the control by name takes its key with it, so the rail that
  // names Quit cannot be walked past on the keyboard.
  expect(await shortcuts({ names: ['Quit the probe (⌘Q)'] })).toEqual([]);
});

test('the common keys are withheld while an excluded control has focus', async ({
  page,
  app,
}) => {
  // Enter on a focused outbound link follows it, so a Tab that landed on an
  // excluded control would otherwise hand the next Enter a way past the rail.
  await page.getByRole('button', { name: 'Summary', exact: true }).click();
  const exclusions = { names: ['Read about the journey'] };
  const keys = async () =>
    (
      await survey({ page, app, exclusions, hopIndex: 0, tally: createExclusionTally(exclusions) })
    ).candidates.filter((c) => c.source === 'key' && c.role === 'key').length;

  // The positive control: with focus elsewhere, all seven are offered.
  await page.getByRole('button', { name: 'Summary', exact: true }).focus();
  expect(await keys()).toBe(7);

  await page.getByRole('link', { name: 'Read about the journey' }).focus();
  expect(await keys()).toBe(0);
});

test('typing arrives as one keystroke per character', async ({ page, app }) => {
  // The reason `type` replaced `fill`: a key handler sees nothing from a fill.
  await page.evaluate(() => {
    const w = window as unknown as { typed: number };
    w.typed = 0;
    document.querySelector('#search')?.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key.length === 1) w.typed += 1;
    });
  });

  // typing-seed-3 since 2026-09-26: skipping the standard menu entries changed
  // what every seed draws, and typing-seed no longer typed in thirty Hops,
  // which the positive control below caught. A seed is chosen to reach the
  // search box; docs/OUTSTANDING.md records that choosing one is fragile.
  const dir = scratch();
  const streams = deriveRouteStreams('typing-seed-3', 1);
  await runRoute({
    page,
    app,
    cfg: buggy,
    streams,
    journeySeed: 'typing-seed-3',
    routeNumber: 1,
    tripLength: 30,
    journalsRoot: dir,
  });

  const typed = readJournal(path.join(inRun(dir), `route-001-${streams.routeSeed}.jsonl`)).filter(
    (entry): entry is TripHopEntry =>
      entry.kind === 'trip-hop' && entry.action === 'type' && entry.target.name === 'Search items'
  );
  const characters = typed.reduce((sum, entry) => sum + (entry.value ?? '').length, 0);

  // Without this, a Route that never typed anything would pass trivially.
  expect(characters).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as { typed: number }).typed)).toBe(characters);
});

test('the engine lays journals out under the root as seed, then run', async ({ page, app }) => {
  // Only the root is the consumer's. Phase 7's report and replay find journals
  // by this layout, so it is asserted from the outside, by path.
  const root = scratch();
  const streams = deriveRouteStreams('layout-seed', 4);
  await runRoute({
    page,
    app,
    cfg: buggy,
    streams,
    journeySeed: 'layout-seed',
    routeNumber: 4,
    tripLength: 1,
    journalsRoot: root,
  });

  const expected = path.join(root, 'layout-seed', TEST_RUN, `route-004-${streams.routeSeed}.jsonl`);
  expect(fs.existsSync(expected)).toBe(true);
  // Nothing else anywhere under the root: one seed folder, one run folder, one file.
  expect(fs.readdirSync(root)).toEqual(['layout-seed']);
  expect(fs.readdirSync(path.join(root, 'layout-seed'))).toEqual([TEST_RUN]);
});

test('while a modal dialog is open, only the dialog is surveyed', async ({ page, app }) => {
  // Measured on the demo's ticket dialog: the body's snapshot still held the
  // controls behind a real modal, none of which could be clicked.
  await page.evaluate(() => {
    const behind = document.createElement('button');
    behind.textContent = 'Cancel';
    document.body.append(behind);
    const dialog = document.createElement('dialog');
    dialog.id = 'probe-dialog';
    dialog.innerHTML = '<button>Keep going</button><button>Cancel</button>';
    document.body.append(dialog);
  });
  const offered = async () =>
    (
      await survey({ page, app, exclusions: {}, hopIndex: 0, tally: createExclusionTally({}) })
    ).candidates
      .filter((c) => c.source === 'page')
      .map((c) => c.name);

  // The positive control: with the dialog closed, the page's controls are offered.
  expect(await offered()).toContain('Summary');

  await page.evaluate(() => (document.getElementById('probe-dialog') as HTMLDialogElement).showModal());
  expect(await offered()).toEqual(['Keep going', 'Cancel']);

  // The dialog's Cancel, not the one behind it, is what a Hop would act on.
  const found = await survey({ page, app, exclusions: {}, hopIndex: 0, tally: createExclusionTally({}) });
  const cancel = found.candidates.find((c) => c.source === 'page' && c.name === 'Cancel');
  expect(
    cancel?.source === 'page'
      ? await cancel.locator.evaluate((el) => el.closest('dialog')?.id ?? 'outside')
      : undefined
  ).toBe('probe-dialog');
});

test('a modal dialog with no way out strands the Route', async ({ page, app }) => {
  // The planted defect phase 5 needs: before the survey honored modals, the
  // controls behind this dialog kept every Route going.
  await page.evaluate(() => {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = '<p>There is no way out of this dialog.</p>';
    document.body.append(dialog);
    dialog.addEventListener('cancel', (event) => event.preventDefault());
    dialog.showModal();
  });
  const outcome = await runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams('trap-seed', 1),
    journeySeed: 'trap-seed',
    routeNumber: 1,
    tripLength: 5,
    journalsRoot: scratch(),
  });
  expect(outcome).toMatchObject({ kind: 'stranded', hops: 0 });
});

test('a survey that fails for any reason but time names that reason, and blames no link', () => {
  // Only a timeout earns the explanation about prevented navigations. A
  // predicate throwing, or an application gone, used to read as an outbound
  // link the exclusion list had missed, with the real error thrown away.
  const broken = new PageUnreachable(2, 'button "Go"', new TypeError('exclude is not a function'));
  expect(broken.message).toContain('exclude is not a function');
  expect(broken.message).not.toContain('exclusion list');
  expect(broken.cause).toBeInstanceOf(TypeError);

  const timeout = new Error('locator.ariaSnapshotJSON: Timeout 700ms exceeded.');
  timeout.name = 'TimeoutError';
  expect(new PageUnreachable(2, 'button "Go"', timeout).message).toContain('exclusion list');
});

/** Always the first page button, so every Hop is a click the overlay below can swallow. */
const firstButton: Chooser = {
  choose: (candidates) => {
    const target = candidates.find((candidate) => candidate.source === 'page' && candidate.role === 'button');
    if (!target) throw new Error('no page button on offer');
    return { target };
  },
};

/** Run three Hops of clicks, with or without an overlay over the whole page. */
async function clicksUnder(page: Page, app: ElectronApplication, overlaid: boolean) {
  if (overlaid) {
    // Transparent and on top of everything: the tree still offers every
    // button, and every click lands on this instead and times out.
    await page.evaluate(() => {
      const cover = document.createElement('div');
      cover.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:transparent';
      document.body.append(cover);
    });
  }
  return runRoute({
    page,
    app,
    cfg: buggy,
    streams: deriveRouteStreams('overlay', 1),
    journeySeed: 'overlay',
    routeNumber: 1,
    tripLength: 3,
    journalsRoot: scratch(),
    chooser: firstButton,
    hopTimeoutMs: 500,
    settleTimeoutMs: 1_000,
  });
}

test('a Route whose every Hop was abandoned strands, rather than passing', async ({ page, app }) => {
  const outcome = await clicksUnder(page, app, true);
  expect(outcome).toMatchObject({ kind: 'stranded', hops: 3 });
  expect(outcome.kind === 'stranded' && outcome.reason).toMatch(/Every one of the 3 Hops was abandoned/);
});

test('the same clicks with nothing over them pass, which is the control', async ({ page, app }) => {
  expect(await clicksUnder(page, app, false)).toMatchObject({ kind: 'passed', hops: 3 });
});

test('a chooser that returns something the survey did not offer is refused', async ({ page, app }) => {
  // The seam is for choosers still to be written; a Hop journaled against a
  // pool that does not hold its target would break R10 without a word.
  const outside: Chooser = {
    choose: (candidates) => {
      const first = candidates[0];
      if (!first) throw new Error('nothing on offer');
      return { target: { ...first } };
    },
  };
  await expect(
    runRoute({
      page,
      app,
      cfg: buggy,
      streams: deriveRouteStreams('outside', 1),
      journeySeed: 'outside',
      routeNumber: 1,
      tripLength: 1,
      journalsRoot: scratch(),
      chooser: outside,
    })
  ).rejects.toThrow(/not among the candidates it was given/);
});

/** Run a short Route and hand back how it ended. */
async function strandRoute(page: Page, app: ElectronApplication, cfg: AppUnderTest, chooser?: Chooser) {
  return runRoute({
    page,
    app,
    cfg,
    streams: deriveRouteStreams('strand-reasons', 1),
    journeySeed: 'strand-reasons',
    routeNumber: 1,
    tripLength: 5,
    journalsRoot: scratch(),
    hopTimeoutMs: 500,
    ...(chooser ? { chooser } : {}),
  });
}

test('a Route stranded partway names the Hop it ran out at, not only Hop 0', async ({ page, app }) => {
  // The first Hop takes every control away before acting, so the Route runs
  // out at the survey that follows it. R5 is about naming that Hop.
  let first = true;
  const clearing: Chooser = {
    choose: async (candidates) => {
      const target = candidates.find((candidate) => candidate.source === 'page');
      if (!target) throw new Error('nothing on the page');
      if (first) {
        first = false;
        await page.evaluate(() => {
          for (const element of document.querySelectorAll('button, input, select, a')) element.remove();
        });
      }
      return { target };
    },
  };
  const outcome = await strandRoute(page, app, buggy, clearing);
  expect(outcome).toMatchObject({ kind: 'stranded', hops: 1 });
  expect(outcome.kind === 'stranded' && outcome.reason).toMatch(/nothing on the page with a hoppable role/);
});

test('stranded because every control was excluded says so', async ({ page, app }) => {
  const excludesThePage: AppUnderTest = { ...buggy, exclusions: { ...buggy.exclusions, exclude: (candidate) => candidate.source === 'page' } };
  const outcome = await strandRoute(page, app, excludesThePage);
  expect(outcome).toMatchObject({ kind: 'stranded', hops: 0 });
  expect(outcome.kind === 'stranded' && outcome.reason).toMatch(/were found and every one was excluded/);
});

test('stranded because every control was unnamed says so, and what they were', async ({ page, app }) => {
  await page.evaluate(() => {
    document.body.innerHTML = '<button></button><button></button>';
  });
  const outcome = await strandRoute(page, app, buggy);
  expect(outcome).toMatchObject({ kind: 'stranded', hops: 0 });
  expect(outcome.kind === 'stranded' && outcome.reason).toMatch(/2 element\(s\) carried a hoppable role and no accessible name.*button, button/);
});

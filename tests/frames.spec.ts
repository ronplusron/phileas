import fs from 'node:fs';
import path from 'node:path';
import { expect, type ElectronApplication, type Page } from '@playwright/test';
import { buggy } from '../proving-ground/buggy/phileas/adapter/index';
import {
  createExclusionTally,
  createTest,
  deriveRouteStreams,
  journaled,
  journalFolder,
  outOfSightCounts,
  readJournal,
  runRoute,
  runTempFolder,
  sameTarget,
  survey,
  surveyLines,
  RUN_VARIABLE,
  type Chooser,
  type FixStepEntry,
  type TripHopEntry,
} from '../src/index';

/**
 * Reading inside frames, against the real application with frames put into
 * its page. `buggy` has none of its own, so its pools and every pinned seed
 * stay as they were; each test here lays down the frames it needs.
 *
 * Measured first on RStudio on 2026-10-09, whose data viewer and Help are
 * each a frame the survey did not read; docs/PLAN.md has the measurement and
 * the decisions.
 */

const test = createTest(buggy);

const TEST_RUN = 'frames-test-run';
process.env[RUN_VARIABLE] = TEST_RUN;

const surveyed = (page: Page, app: ElectronApplication) =>
  survey({ page, app, exclusions: {}, hopIndex: 0, tally: createExclusionTally({}) });

/**
 * A frame titled "Luggage tags" at the end of the page, holding a button that
 * adds a heading, a link inside the application, a link out of it, and a
 * frame of its own, "Tag preview", whose button adds a heading there.
 *
 * Placed in the window by default, each one below the last, since only what
 * shows is offered (R32): at the end of `buggy`'s page, in a window 608
 * pixels tall, it would fall mostly out of sight.
 */
async function luggageTags(page: Page, style?: string): Promise<void> {
  await page.evaluate((frameStyle) => {
    const frame = document.createElement('iframe');
    frame.title = 'Luggage tags';
    const before = document.querySelectorAll('iframe[title="Luggage tags"]').length;
    frame.style.cssText = frameStyle ?? `position: absolute; left: 460px; top: ${180 + 215 * before}px; width: 400px; height: 200px;`;
    frame.srcdoc =
      '<h2>Tags</h2>' +
      `<button onclick="document.body.insertAdjacentHTML('beforeend', '<h2>Tag printed</h2>')">Print tag</button>` +
      '<a href="#help">Tag help</a> ' +
      '<a href="https://example.com/tags">Tag maker</a>' +
      '<iframe title="Tag preview" style="width: 200px; height: 60px;" ' +
      `srcdoc="<button onclick=&quot;document.body.insertAdjacentHTML('beforeend', '<h3>Flipped</h3>')&quot;>Flip tag</button>"></iframe>`;
    document.body.append(frame);
  }, style);
  await page
    .locator('iframe[title="Luggage tags"]')
    .last()
    .contentFrame()
    .locator('iframe[title="Tag preview"]')
    .contentFrame()
    .getByRole('button', { name: 'Flip tag' })
    .waitFor({ timeout: 5_000 });
}

const PRINT = 'frame "Luggage tags" > button "Print tag"';
const FLIP = 'frame "Luggage tags" > frame "Tag preview" > button "Flip tag"';

test('a control in a frame is offered at the frame\'s place, named after the frame, and a nested frame by both', async ({ page, app }) => {
  // The control: with no frame in the page, no candidate names one.
  const before = await surveyed(page, app);
  expect(before.candidates.some((candidate) => candidate.source === 'page' && candidate.frame !== undefined)).toBe(false);

  await luggageTags(page);
  const found = await surveyed(page, app);
  const lines = surveyLines(found);
  expect(lines).toEqual(expect.arrayContaining([PRINT, 'frame "Luggage tags" > link "Tag help"', FLIP]));
  // In document order: the frame is at the end of the page, its own frame at
  // the end of it.
  expect(lines.indexOf('button "Summary"')).toBeLessThan(lines.indexOf(PRINT));
  expect(lines.indexOf(PRINT)).toBeLessThan(lines.indexOf(FLIP));

  const flip = found.candidates.find((candidate) => candidate.name === 'Flip tag');
  expect(flip && journaled(flip)).toEqual({
    source: 'page',
    role: 'button',
    name: 'Flip tag',
    nth: 1,
    frame: [
      { label: 'Luggage tags', nth: 1 },
      { label: 'Tag preview', nth: 1 },
    ],
  });
  // The tree a Hop's effect and the checks read holds what the frames hold.
  expect(JSON.stringify(found.tree)).toContain('Flip tag');
  expect(found.unreadFrames).toEqual([]);
});

test('a link in a frame that leaves the application is excluded, and one that stays is not', async ({ page, app }) => {
  await luggageTags(page);
  const found = await surveyed(page, app);
  expect(found.excluded).toContainEqual({
    candidate: { source: 'page', role: 'link', name: 'Tag maker', frame: [{ label: 'Luggage tags', nth: 1 }] },
    rule: 'link off the application: https://example.com',
  });
  // The control: a link inside the application, in the same frame, is offered.
  expect(found.candidates.some((candidate) => candidate.name === 'Tag help')).toBe(true);
  expect(surveyLines(found)).toContain('frame "Luggage tags" > link "Tag maker"   (excluded: link off the application: https://example.com)');
});

test("a frame's label keeps no id made fresh each launch", async ({ page, app }) => {
  // Positron's webviews: no title, and a name that is a new UUID each launch.
  await page.evaluate(() => {
    for (const name of ['feaf3c1d-181b-4e83-a33f-dd0b9c98b461', 'tags']) {
      const frame = document.createElement('iframe');
      frame.name = name;
      frame.style.cssText = 'width: 200px; height: 60px;';
      frame.srcdoc = `<button>Tag ${name.length}</button>`;
      document.body.append(frame);
    }
  });
  await page.locator('iframe[name="tags"]').contentFrame().getByRole('button', { name: 'Tag 4' }).waitFor({ timeout: 5_000 });
  const lines = surveyLines(await surveyed(page, app));
  expect(lines).toContain('frame "<id>" > button "Tag 36"');
  // The control: a name that is not an id is kept as it is.
  expect(lines).toContain('frame "tags" > button "Tag 4"');
});

test('two frames sharing a title are told apart by position', async ({ page, app }) => {
  await luggageTags(page);
  await luggageTags(page);
  const found = await surveyed(page, app);
  const prints = found.candidates.filter((candidate) => candidate.name === 'Print tag').map((candidate) => journaled(candidate).frame);
  expect(prints).toEqual([[{ label: 'Luggage tags', nth: 1 }], [{ label: 'Luggage tags', nth: 2 }]]);
  // Printed so a Fix step can name either: the first as before, the second with its position.
  expect(surveyLines(found)).toEqual(expect.arrayContaining([PRINT, 'frame "Luggage tags" #2 > button "Print tag"']));
  // Each counted within its own frame, not across the page.
  expect(found.candidates.filter((candidate) => candidate.name === 'Print tag').map((candidate) => candidate.source === 'page' && candidate.nth)).toEqual([1, 1]);
});

test('a frame covered in the page covers what it holds, and one inside a container with no area hides it', async ({ page, app }) => {
  // In plain view, since a control in a frame scrolled out of sight is kept,
  // as one in the page is: the click scrolls it into view first.
  await luggageTags(page, 'position: fixed; top: 10px; left: 10px; width: 400px; height: 200px; z-index: 50;');
  // The control: uncovered, nothing in the frame is covered. The frame itself
  // lies over some of the page's own controls, which are.
  const open = await surveyed(page, app);
  expect(open.covered.filter((entry) => entry.candidate.source === 'page' && entry.candidate.frame)).toEqual([]);
  expect(open.covered.map((entry) => entry.by)).toContain('<iframe>');

  await page.evaluate(() => {
    const frame = document.querySelector('iframe[title="Luggage tags"]') as HTMLElement;
    const rect = frame.getBoundingClientRect();
    const cover = document.createElement('div');
    cover.id = 'probe-cover';
    cover.textContent = 'In the way';
    cover.style.cssText = `position: fixed; left: ${rect.x}px; top: ${rect.y}px; width: ${rect.width}px; height: ${rect.height}px; background: white; z-index: 99;`;
    document.body.append(cover);
  });
  const covered = await surveyed(page, app);
  const names = covered.covered.map((entry) => entry.candidate.name);
  expect(names).toEqual(expect.arrayContaining(['Print tag', 'Tag help', 'Flip tag']));
  for (const entry of covered.covered) expect(entry.by).toMatch(/^<div id="probe-cover"/);
  expect(covered.candidates.some((candidate) => candidate.name === 'Print tag')).toBe(false);
  // The page's own controls are still offered.
  expect(covered.candidates.some((candidate) => candidate.name === 'Summary')).toBe(true);

  await page.evaluate(() => {
    document.getElementById('probe-cover')?.remove();
    const pane = document.createElement('div');
    pane.id = 'probe-pane';
    pane.style.cssText = 'position: fixed; top: 10px; right: 10px; width: 0; height: 200px; overflow: hidden;';
    const frame = document.querySelector('iframe[title="Luggage tags"]') as HTMLElement;
    frame.style.cssText = 'width: 400px; height: 200px;';
    pane.append(frame);
    document.body.append(pane);
  });
  // Moving a frame loads it again.
  await page
    .locator('iframe[title="Luggage tags"]')
    .contentFrame()
    .getByRole('button', { name: 'Print tag' })
    .waitFor({ state: 'attached', timeout: 5_000 });
  const hidden = await surveyed(page, app);
  expect(hidden.candidates.some((candidate) => candidate.name === 'Print tag')).toBe(false);
  expect(hidden.hidden.map((entry) => entry.candidate.name)).toEqual(expect.arrayContaining(['Print tag', 'Tag help']));
  for (const entry of hidden.hidden) expect(entry.by).toMatch(/^<div id="probe-pane"/);
});

test('a frame out of sight keeps what it holds out of sight, by what keeps the frame there', async ({ page, app }) => {
  // Far below the window.
  await luggageTags(page, 'position: absolute; top: 5000px; left: 10px; width: 400px; height: 200px;');
  const below = await surveyed(page, app);
  expect(below.candidates.some((candidate) => candidate.name === 'Print tag')).toBe(false);
  expect(below.covered.some((entry) => entry.candidate.name === 'Print tag')).toBe(false);
  expect(outOfSightCounts(below.outOfSight)).toEqual(
    expect.arrayContaining([
      { frame: [{ label: 'Luggage tags', nth: 1 }], by: 'the window', count: 2 },
      { frame: [{ label: 'Luggage tags', nth: 1 }, { label: 'Tag preview', nth: 1 }], by: 'the window', count: 1 },
    ])
  );

  // Inside a pane scrolled away from it, though the pane itself shows.
  await page.evaluate(() => {
    const pane = document.createElement('div');
    pane.id = 'probe-scroller';
    pane.style.cssText = 'position: fixed; top: 300px; left: 10px; width: 420px; height: 40px; overflow: auto;';
    const frame = document.querySelector('iframe[title="Luggage tags"]') as HTMLElement;
    frame.style.cssText = 'display: block; margin-top: 80px; width: 400px; height: 200px;';
    pane.append(frame);
    document.body.append(pane);
  });
  // Moving a frame loads it again.
  await page.locator('iframe[title="Luggage tags"]').contentFrame().getByRole('button', { name: 'Print tag' }).waitFor({ state: 'attached', timeout: 5_000 });
  const scrolled = await surveyed(page, app);
  expect(scrolled.candidates.some((candidate) => candidate.name === 'Print tag')).toBe(false);
  expect(scrolled.outOfSight.find((entry) => entry.candidate.name === 'Print tag')?.by).toBe('<div id="probe-scroller">');

  // The control: the pane tall enough to show the frame offers it again.
  await page.evaluate(() => {
    document.getElementById('probe-scroller')!.style.height = '300px';
  });
  const shown = await surveyed(page, app);
  expect(shown.candidates.some((candidate) => candidate.name === 'Print tag')).toBe(true);
});

test('a control covered inside its frame is covered, by what is on top there', async ({ page, app }) => {
  await luggageTags(page);
  await page.frameLocator('iframe[title="Luggage tags"]').locator('body').evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((element) => element.textContent === 'Print tag') as HTMLElement;
    const rect = button.getBoundingClientRect();
    const cover = document.createElement('div');
    cover.id = 'tag-cover';
    cover.textContent = 'Sticker';
    cover.style.cssText = `position: fixed; left: ${rect.x - 2}px; top: ${rect.y - 2}px; width: ${rect.width + 4}px; height: ${rect.height + 4}px; background: white;`;
    document.body.append(cover);
  });
  const found = await surveyed(page, app);
  expect(found.covered.map((entry) => entry.candidate.name)).toEqual(['Print tag']);
  expect(found.covered[0]?.by).toMatch(/^<div id="tag-cover">Sticker/);
  // The rest of the frame is still offered.
  expect(found.candidates.some((candidate) => candidate.name === 'Tag help')).toBe(true);
});

test('a frame with no area adds nothing', async ({ page, app }) => {
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.title = 'Ghost';
    frame.style.cssText = 'width: 0; height: 0; border: 0;';
    frame.srcdoc = '<button>Ghost tag</button>';
    document.body.append(frame);
  });
  await page.frameLocator('iframe[title="Ghost"]').getByRole('button', { name: 'Ghost tag' }).waitFor({ state: 'attached', timeout: 5_000 });
  const found = await surveyed(page, app);
  const all = [...found.candidates, ...found.covered.map((entry) => entry.candidate), ...found.hidden.map((entry) => entry.candidate)];
  expect(all.some((candidate) => candidate.name === 'Ghost tag')).toBe(false);
  expect(found.unreadFrames).toEqual([]);
});

/** Always the control named `name`. */
const always = (name: string): Chooser => ({
  choose: (candidates) => {
    const target = candidates.find((candidate) => candidate.name === name);
    if (!target) throw new Error(`${name} is not on offer`);
    return { target };
  },
});

test('a Fix step and a Trip hop act inside frames, and each journals the frame and what it changed there', async ({ page, app }) => {
  await luggageTags(page);
  const root = fs.mkdtempSync(path.join(runTempFolder(), 'frames-test-'));
  const streams = deriveRouteStreams('frames-seed', 1);
  try {
    const outcome = await runRoute({
      page,
      app,
      cfg: buggy,
      streams,
      journeySeed: 'frames-seed',
      routeNumber: 1,
      tripLength: 1,
      journalsRoot: root,
      fix: ({ step }) => step({ kind: 'act', target: PRINT }),
      chooser: always('Flip tag'),
    });
    expect(outcome.kind).toBe('passed');
    const entries = readJournal(path.join(journalFolder(root, 'frames-seed', TEST_RUN), `route-001-${streams.routeSeed}.jsonl`));
    const fixStep = entries.find((entry): entry is FixStepEntry => entry.kind === 'fix-step');
    expect(fixStep?.target).toEqual({ source: 'page', role: 'button', name: 'Print tag', nth: 1, frame: [{ label: 'Luggage tags', nth: 1 }] });
    expect(fixStep?.effect).toMatchObject({ readable: true, changed: true, appeared: ['Tag printed'] });
    const hop = entries.find((entry): entry is TripHopEntry => entry.kind === 'trip-hop');
    expect(hop?.target.frame).toEqual([
      { label: 'Luggage tags', nth: 1 },
      { label: 'Tag preview', nth: 1 },
    ]);
    expect(hop?.effect).toMatchObject({ readable: true, changed: true, appeared: ['Flipped'] });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a replay matches a target in a frame only with its frame', async ({ page, app }) => {
  await luggageTags(page);
  const found = await surveyed(page, app);
  const print = found.candidates.find((candidate) => candidate.name === 'Print tag');
  expect(print).toBeDefined();
  if (!print) return;
  const recorded = journaled(print);
  expect(sameTarget(journaled(print), recorded)).toBe(true);
  // The same role, name and position with no frame is another control.
  const { frame: _frame, ...unframed } = recorded;
  expect(sameTarget(journaled(print), unframed)).toBe(false);
});

test('a frame sandboxed without scripts is recorded as unread, and one allowing them is read', async ({ page, app }) => {
  // The engine's reads inside a frame run script, which such a frame refuses
  // and logs as a console error; checks.spec.ts holds that nothing is logged.
  await page.evaluate(() => {
    for (const [title, sandbox] of [['Sealed', ''], ['Open', 'allow-scripts']] as const) {
      const frame = document.createElement('iframe');
      frame.title = title;
      frame.setAttribute('sandbox', sandbox);
      frame.style.cssText = 'width: 200px; height: 60px;';
      frame.srcdoc = `<button>${title} tag</button>`;
      document.body.append(frame);
    }
  });
  await page.locator('iframe[title="Open"]').contentFrame().getByRole('button', { name: 'Open tag' }).waitFor({ timeout: 5_000 });
  const found = await surveyed(page, app);
  expect(found.unreadFrames).toEqual([{ path: [{ label: 'Sealed', nth: 1 }], reason: expect.stringMatching(/^sandboxed without allow-scripts/) }]);
  expect(found.candidates.some((candidate) => candidate.name === 'Sealed tag')).toBe(false);
  // The control: the frame that allows scripts is read.
  expect(found.candidates.some((candidate) => candidate.name === 'Open tag')).toBe(true);
  expect(surveyLines(found)).toContainEqual(expect.stringMatching(/^frame "Sealed"   \(not read: sandboxed without allow-scripts/));
});

test('two frames drawn at one box are paired with their nodes in document order', async ({ page, app }) => {
  // The snapshot tells a frame's node by nothing but its box. "Under" is made
  // second and placed first, so the order frames were made in and the order
  // of the document disagree.
  await page.evaluate(() => {
    const make = (title: string) => {
      const frame = document.createElement('iframe');
      frame.title = title;
      frame.style.cssText = 'position: fixed; top: 10px; left: 10px; width: 200px; height: 60px;';
      frame.srcdoc = `<button>${title} tag</button>`;
      return frame;
    };
    const over = make('Over');
    document.body.append(over);
    document.body.insertBefore(make('Under'), over);
  });
  for (const title of ['Under', 'Over']) {
    await page.locator(`iframe[title="${title}"]`).contentFrame().getByRole('button', { name: `${title} tag` }).waitFor({ timeout: 5_000 });
  }
  const found = await surveyed(page, app);
  // Each frame's controls come from that frame, whichever node it is paired with.
  const named = [...found.candidates, ...found.covered.map((entry) => entry.candidate)]
    .filter((candidate) => candidate.source === 'page' && candidate.frame)
    .map((candidate) => `${journaled(candidate).frame?.[0]?.label} ${candidate.name}`)
    .sort();
  expect(named).toEqual(['Over Over tag', 'Under Under tag']);
  // And they sit in document order: Playwright lists frames in the order they
  // were made, which put "Over" first until the pairing followed the document.
  const tree = JSON.stringify(found.tree);
  expect(tree.indexOf('Under tag')).toBeGreaterThan(-1);
  expect(tree.indexOf('Under tag')).toBeLessThan(tree.indexOf('Over tag'));
});

test('a frame of thousands of links is surveyed in seconds, each link still judged, and only those in view offered', async ({ page, app }) => {
  // Measured on RStudio on 2026-10-12: Help showing "Writing R Extensions"
  // holds 7,581 links in a frame, and a survey that found each control's
  // element again, one control at a time, took about 45 minutes there.
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.title = 'Manual';
    // In the window, so what it keeps out of sight is its own view's doing.
    frame.style.cssText = 'position: absolute; left: 460px; top: 180px; width: 400px; height: 200px;';
    frame.srcdoc = Array.from({ length: 3000 }, (_unused, index) =>
      index % 10 === 0 ? `<a href="https://example.com/${index}">Away ${index}</a><br>` : `<a href="#s${index}">Section ${index}</a><br>`
    ).join('');
    document.body.append(frame);
  });
  await page.locator('iframe[title="Manual"]').contentFrame().getByRole('link', { name: 'Section 2999' }).waitFor({ state: 'attached', timeout: 10_000 });
  const started = Date.now();
  const found = await survey({ page, app, exclusions: {}, hopIndex: 0, tally: createExclusionTally({}), timeoutMs: 3_000 });
  expect(Date.now() - started).toBeLessThan(30_000);
  // Every link that leaves is excluded, and only those, so no address read
  // was given up on and read as leaving.
  const away = found.excluded.filter((entry) => entry.rule.startsWith('link off the application'));
  expect(away).toHaveLength(300);
  expect(away.every((entry) => entry.candidate.name.startsWith('Away '))).toBe(true);
  // R32: each link is offered or out of sight, and only those in the
  // frame's view are offered, counted by that view and never named.
  const offered = found.candidates.filter((candidate) => candidate.name.startsWith('Section '));
  const unseen = found.outOfSight.filter((entry) => entry.candidate.name.startsWith('Section '));
  expect(offered.length + unseen.length).toBe(2700);
  expect(offered.length).toBeGreaterThan(0);
  expect(offered.length).toBeLessThan(30);
  expect(outOfSightCounts(found.outOfSight)).toContainEqual({ frame: [{ label: 'Manual', nth: 1 }], by: 'the view of frame "Manual"', count: unseen.length });
  // Printed as they are offered, each by name, and the rest not at all.
  expect(surveyLines(found).filter((line) => line.includes('"Section '))).toHaveLength(offered.length);
});

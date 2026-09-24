import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { buggy } from '../testbed/buggy/phileas/adapter/index';
import { launchApp, closeApp, makeUserDataDir, menuLabels, clickMenuItem } from '../src/index';
import type { AppUnderTest } from '../src/index';

/**
 * What `buggy` correctly does, recorded while it is still correct.
 *
 * **This is the measurement everything later rests on, and it has to exist
 * before any defect is planted.** Phases 5, 6 and 8 plant defects into this
 * application and assert that a Journey finds each one. Without a record of the
 * unbroken behavior, a failing Route cannot be attributed to a planted defect
 * rather than an accidental one, and "every planted defect is found" stops
 * being a claim anyone can check. That sentence is the first success measure in
 * `docs/PRODUCT_REQUIREMENTS.md` section 10, and this is its baseline.
 *
 * **These are not tests of the engine.** Nothing here travels, seeds or
 * checks. They assert that the application under test behaves as
 * its authors intended, which is the one thing the engine cannot tell you and
 * must not be asked to.
 *
 * The expected values are computed from `data/items.json` where the application
 * derives them from the same file, and written as literals where a literal is
 * what a reader needs in order to see the value is right. Deriving everything
 * would make this agree with whatever the file says, including after somebody
 * edits the file by mistake.
 */

// fileURLToPath rather than reading .pathname, which stays percent-encoded: a
// repository under a directory with a space in its name becomes Present%20
// Folders and every read fails. It passed in a worktree whose path had no
// spaces and failed the moment it reached the real checkout.
const dataFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'testbed',
  'buggy',
  'data',
  'items.json'
);

type Item = { name: string; category: string; grams: number };
const items: Item[] = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

async function withReadyPage(cfg: AppUnderTest, body: (page: Page) => Promise<void>) {
  const dir = await makeUserDataDir(cfg);
  const launched = await launchApp(cfg, dir);
  try {
    const page = await launched.app.firstWindow();
    await cfg.waitForReady(page);
    await body(page);
  } finally {
    await closeApp(cfg, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

test('the data file is the twelve items this baseline was written against', () => {
  // The literal is the control. Everything below derives its expectations from
  // this file, so a change to the file would otherwise move every assertion
  // along with it and the whole baseline would keep passing against an
  // application nobody meant to change.
  expect(items).toHaveLength(12);
  expect(items.reduce((sum, item) => sum + item.grams, 0)).toBe(14_575);

  const byCategory = items.reduce<Record<string, number>>((counts, item) => {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
    return counts;
  }, {});
  expect(byCategory).toEqual({ luggage: 3, instruments: 4, clothing: 5 });
});

test('it renders every item, and says how many', async () => {
  await withReadyPage(buggy, async (page) => {
    await expect(page.locator('#items li')).toHaveCount(items.length);
    await expect(page.locator('#count')).toHaveText(`${items.length} items`);
  });
});

test('the count says "1 item" at the singular boundary', async () => {
  await withReadyPage(buggy, async (page) => {
    // A count that reads "1 items" is the kind of defect this engine is meant
    // to find, so the unbroken behavior at the boundary is worth pinning. The
    // search term is chosen to match exactly one item, asserted rather than
    // assumed.
    const unique = items.filter((item) => item.name.toLowerCase().includes('carpet'));
    expect(unique, 'the search term no longer matches exactly one item').toHaveLength(1);

    await page.locator('#search').fill('carpet');
    await expect(page.locator('#items li')).toHaveCount(1);
    await expect(page.locator('#count')).toHaveText('1 item');
  });
});

test('clearing the search restores the full list', async () => {
  await withReadyPage(buggy, async (page) => {
    await page.locator('#search').fill('carpet');
    await expect(page.locator('#items li')).toHaveCount(1);

    await page.locator('#clear').click();

    await expect(page.locator('#items li')).toHaveCount(items.length);
    await expect(page.locator('#search')).toHaveValue('');
  });
});

test('the category dropdown offers exactly the categories in the data', async () => {
  await withReadyPage(buggy, async (page) => {
    // Written out in the page rather than built from the data, so this is the
    // check that the two still agree. A category added to the data and not to
    // the dropdown would leave items no choice can reach.
    const offered = await page.locator('#category option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter((value) => value !== '')
    );
    expect([...offered].sort()).toEqual([...new Set(items.map((item) => item.category))].sort());
  });
});

test('choosing a category filters the list, and combines with the search', async () => {
  await withReadyPage(buggy, async (page) => {
    await page.locator('#category').selectOption('instruments');
    await expect(page.locator('#items li')).toHaveCount(
      items.filter((item) => item.category === 'instruments').length
    );

    // Both filters at once: the barometer is the only instrument with "bar".
    await page.locator('#search').fill('bar');
    await expect(page.locator('#items li')).toHaveCount(1);
    await expect(page.locator('#count')).toHaveText('1 item');

    // Back to all categories keeps the search.
    await page.locator('#category').selectOption('');
    await expect(page.locator('#items li')).toHaveCount(
      items.filter((item) => item.name.toLowerCase().includes('bar')).length
    );
  });
});

test('the total is every item, and does not follow the search', async () => {
  await withReadyPage(buggy, async (page) => {
    await page.locator('#view-summary').click();
    await expect(page.locator('#total')).toHaveText('14575 g');

    // Pinned as observed rather than as decided: the total sums the whole
    // inventory and ignores the filter. That is defensible for a figure headed
    // "Total weight", and nobody has ruled on it. Recording it here means a
    // later change is a visible decision rather than a silent one.
    await page.locator('#view-inventory').click();
    await page.locator('#search').fill('carpet');
    await page.locator('#view-summary').click();
    await expect(page.locator('#total')).toHaveText('14575 g');
  });
});

test('switching views moves both buttons, not just one', async () => {
  await withReadyPage(buggy, async (page) => {
    await expect(page.locator('#view-inventory')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#view-summary')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('#view-summary').click();

    // Both, deliberately. A view switch that sets the new button and forgets
    // the old one leaves two controls claiming to be pressed, which is exactly
    // the kind of thing a Route would walk past.
    await expect(page.locator('#view-inventory')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#view-summary')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#inventory')).toBeHidden();
    await expect(page.locator('#summary')).toBeVisible();
  });
});

test('the native menu has the shape the adapter and phase 4 expect', async () => {
  const dir = await makeUserDataDir(buggy);
  const launched = await launchApp(buggy, dir);
  try {
    await buggy.waitForReady(await launched.app.firstWindow());

    // menu.ts's first coverage. Until now nothing called it, while the README
    // claimed the engine can reach the native menu and main.cjs built one
    // specifically so it could be reached.
    expect(await menuLabels(launched.app, [])).toEqual(['Buggy', 'Edit', 'View']);
    expect(await menuLabels(launched.app, ['Buggy'])).toContain('Quit Buggy');
    expect(await menuLabels(launched.app, ['View'])).toEqual([
      'Show Inventory',
      'Show Summary',
    ]);
  } finally {
    await closeApp(buggy, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('every menu path the adapter excludes still names a real menu item', async () => {
  // The check docs/PLAN.md asks for and docs/DEFECTS.md says is missing: a
  // hand-written exclusion list goes stale silently the day upstream renames
  // something, and a rail that names nothing guards nothing. This does not
  // derive the list from source, which is the fuller answer, but it does fail
  // when an entry stops matching.
  const dir = await makeUserDataDir(buggy);
  const launched = await launchApp(buggy, dir);
  try {
    await buggy.waitForReady(await launched.app.firstWindow());

    const paths = buggy.exclusions.menuPaths ?? [];
    expect(paths.length, 'no menu paths are excluded, so this asserts nothing').toBeGreaterThan(0);

    for (const menuPath of paths) {
      const parent = menuPath.slice(0, -1);
      const leaf = menuPath[menuPath.length - 1];
      expect(await menuLabels(launched.app, parent), `${menuPath.join(' > ')} is stale`).toContain(
        leaf
      );
    }
  } finally {
    await closeApp(buggy, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('every clipboard entry in the menu is excluded', async () => {
  // Read from the running application rather than from the list, so an entry
  // added to the Edit menu later, such as Paste and Match Style, fails here
  // instead of being reached by a shown run.
  const dir = await makeUserDataDir(buggy);
  const launched = await launchApp(buggy, dir);
  try {
    await buggy.waitForReady(await launched.app.firstWindow());

    const clipboard = (await menuLabels(launched.app, ['Edit'])).filter((label) =>
      /^(Cut|Copy|Paste)\b/.test(label)
    );
    expect(clipboard.length, 'no clipboard entries found, so this asserts nothing').toBeGreaterThan(0);

    const excluded = (buggy.exclusions.menuPaths ?? []).map((p) => p.join(' > '));
    for (const label of clipboard) {
      expect(excluded, `Edit > ${label} is reachable by a shown run`).toContain(`Edit > ${label}`);
    }
  } finally {
    await closeApp(buggy, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('the menu can drive the application, not merely be read', async () => {
  const dir = await makeUserDataDir(buggy);
  const launched = await launchApp(buggy, dir);
  try {
    const page = await launched.app.firstWindow();
    await buggy.waitForReady(page);

    // clickMenuItem's first coverage, and the positive control for the test
    // above: reading a label proves the menu exists, and this proves the wiring
    // behind it works. A menu that renders and does nothing would pass one and
    // fail the other.
    await clickMenuItem(launched.app, ['View', 'Show Summary'], page);

    await expect(page.locator('#summary')).toBeVisible();
    await expect(page.locator('#view-summary')).toHaveAttribute('aria-pressed', 'true');
  } finally {
    await closeApp(buggy, launched).catch(() => {});
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

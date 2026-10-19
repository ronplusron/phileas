import type { AppCheck } from '@drugstoresushi/phileas';

/**
 * Two places on screen stating one fact, which is where a check of an
 * application's own should come from: the heading counts the list beneath
 * it. Nothing here was read from buggy's code, and the miscount plant is what
 * shows it fires.
 */
export const countMatchesList: AppCheck = {
  name: 'count-matches-list',
  why: 'The heading above the item list states how many items the list shows.',
  async run({ page }) {
    const heading = page.getByRole('heading', { name: /^\d+ items?$/ });
    const list = page.getByRole('list', { name: 'Items' });
    // Only the inventory shows the two; on another view there is
    // nothing to disagree.
    if (!(await heading.isVisible()) || !(await list.isVisible())) return [];
    const said = Number((await heading.textContent())?.match(/^\d+/)?.[0]);
    const rows = await list.getByRole('listitem').count();
    return said === rows ? [] : [`the heading says ${said} items and the list shows ${rows}`];
  },
};

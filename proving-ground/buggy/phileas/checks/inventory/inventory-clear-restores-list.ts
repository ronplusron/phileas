import type { AppRelation } from '@drugstoresushi/phileas';

/**
 * Searching and then clearing the search shows the list the empty search
 * showed: buggy agreeing with itself over two moments (R20), and the relation
 * phase 6 named for this application, "a clear that does not clear". Nothing
 * here was read from buggy's code, and the stuck-search plant is what shows it
 * fires: its Clear search empties the box and leaves the list filtered, while
 * the count still agrees with the list, so no check of one moment sees it.
 *
 * A Hop that types into an empty search starts it. The Detour clears the
 * search, the list is compared with the one before the Hop, and the way back
 * types the Hop's value again, so the next Hop draws from the screen the
 * seed's own Hop made.
 */
export const inventoryClearRestoresList: AppRelation = {
  name: 'inventory-clear-restores-list',
  why: 'Clearing a search shows the list the empty search showed.',
  when: /^searchbox "Search items"$/,

  // Only from an empty search: from one already typed, the list before the
  // Hop is a filtered one, and a clear rightly shows more.
  async appliesWhen({ page, hop }) {
    const box = page.getByRole('searchbox', { name: 'Search items' });
    return hop.action === 'type' && (await box.isVisible()) && (await box.inputValue()) === '';
  },

  read: ({ page }) => page.getByRole('list', { name: 'Items' }).getByRole('listitem').allInnerTexts(),

  steps: () => [{ target: 'button "Clear search"' }],

  expect(before, after) {
    const [was, is] = [before as readonly string[], after as readonly string[]];
    return JSON.stringify(was) === JSON.stringify(is)
      ? []
      : [`clearing the search shows ${is.length} items, where the empty search before it showed ${was.length}`];
  },

  back: (hop) => [{ target: 'searchbox "Search items"', value: hop.value ?? '' }],
};

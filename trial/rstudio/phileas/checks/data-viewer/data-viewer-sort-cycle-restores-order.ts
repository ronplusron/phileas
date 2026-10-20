import type { AppRelation, RelationContext } from '@drugstoresushi/phileas';
import { shownViewer } from './viewer';

/**
 * Sorting a column ascending, then descending, then removing the sort brings
 * back the rows in the order they had before: the data viewer agreeing with
 * itself over time (R20). The rule was read from the title of one of
 * RStudio's own e2e tests, that sort headers cycle through ascending,
 * descending and unsorted, and stated in this project's words; nothing of the
 * test is copied.
 *
 * **Measured on RStudio 2026.11.0-daily+78, not taken from its code,** by
 * `trial/rstudio/probes/viewer-sort-order.spec.ts` on 2026-10-19: the summary
 * sidebar's sort button for a column reads "Sort column x ascending", then
 * "Sort column x descending", then "Remove sort on column x", and the third
 * click restored the original order every time it was tried. The buttons are
 * in the viewer's frame, named as `frame "Data Browser" > button "Sort column
 * mpg ascending"`, with a position after the label where two viewers share it.
 *
 * A Hop that clicks a column's "ascending" button on a frame no column of
 * which is sorted starts it, with the grid at its top, so the rows in view
 * before are the frame's first rows. The Detour clicks the same column's
 * button twice more, to descending and then to no sort, and the row names in
 * view are compared with those before. The way back sorts it ascending again,
 * as the Hop left it.
 */
const WHEN = /^(frame "Data Browser"(?: #\d+)?) > button "Sort column (.+) ascending"$/;

/** The row names wholly in the grid's view, top to bottom, and whether any column is sorted. */
async function rowsInView({ page }: RelationContext): Promise<{ sorted: boolean; top: number; names: string[] } | undefined> {
  const shown = await shownViewer(page);
  if (!shown) return undefined;
  return shown.frame.evaluate(() => {
    const viewport = document.getElementById('gridViewport');
    const view = viewport?.getBoundingClientRect();
    const headers = [...document.querySelectorAll<HTMLElement>('th[role="columnheader"]')];
    const headerBottom = Math.max(0, ...headers.map((header) => header.getBoundingClientRect().bottom));
    const top = Math.max(view?.top ?? 0, headerBottom);
    const bottom = view?.bottom ?? Infinity;
    const names = [...document.querySelectorAll<HTMLElement>('#pinnedTable tr[aria-rowindex]')]
      .filter((row) => {
        const box = row.getBoundingClientRect();
        return box.height > 0 && box.top >= top - 1 && box.bottom <= bottom + 1;
      })
      .sort((a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')))
      .map((row) => row.innerText.trim());
    const sorted = headers.some((header) => ['ascending', 'descending'].includes(header.getAttribute('aria-sort') ?? ''));
    return { sorted, top: viewport?.scrollTop ?? 0, names };
  });
}

export const dataViewerSortCycleRestoresOrder: AppRelation = {
  name: 'data-viewer-sort-cycle-restores-order',
  why:
    "A column sorted ascending, then descending, then unsorted from the data viewer's sidebar shows the " +
    'rows in the order they had before it was sorted. Measured on RStudio 2026.11.0-daily+78 on 2026-10-19.',
  when: WHEN,

  // From an unsorted frame at its top only: from a sorted one, "before" is
  // another column's order, and scrolled, the rows in view need not come back
  // to the same place.
  async appliesWhen(context) {
    const rows = await rowsInView(context);
    return rows !== undefined && !rows.sorted && rows.top === 0 && rows.names.length > 0;
  },

  read: async (context) => (await rowsInView(context))?.names ?? null,

  steps: ({ match: [, frame, column] }) => [
    { target: `${frame} > button "Sort column ${column} descending"` },
    { target: `${frame} > button "Remove sort on column ${column}"` },
  ],

  expect(before, after) {
    if (JSON.stringify(before) === JSON.stringify(after)) return [];
    const [was, is] = [(before ?? []) as readonly string[], (after ?? []) as readonly string[]];
    return [
      `the rows in view after ascending, descending and no sort begin ${JSON.stringify(is.slice(0, 5))}, ` +
        `where before the sort they began ${JSON.stringify(was.slice(0, 5))}`,
    ];
  },

  back: ({ match: [, frame, column] }) => [{ target: `${frame} > button "Sort column ${column} ascending"` }],
};

import type { AppCheck } from '@drugstoresushi/phileas';
import type { Frame } from '@playwright/test';
import { shownViewer } from './viewer';

/**
 * A column the data viewer marks as sorted shows its values in order, in the
 * rows wholly in view. One fact the screen states, the header's sort, held
 * against what it draws (R18). The rule was read from the title of one of
 * RStudio's own e2e tests, that sort headers cycle through ascending,
 * descending and unsorted, and stated in this project's words; nothing of
 * the test is copied.
 *
 * **Measured on RStudio 2026.11.0-daily+78, not taken from its code,** by
 * `trial/rstudio/probes/viewer-sort-order.spec.ts` on 2026-10-19, over a
 * frame of 300 rows read whole by scrolling:
 * - A header is a `th[role=columnheader]` naming its column in a span, with
 *   `aria-sort` none, ascending or descending. The sort buttons are in the
 *   summary sidebar, and its third click, "Remove sort on column x",
 *   restores the order the frame had.
 * - The header's `title` gives the column's kind: "column 1: double with
 *   range -50 - 50", "column 2: character", "column 3: integer with 3
 *   levels" for a factor, "column 4: logical", and for a Date "column 5:
 *   double" with a line "range: 2026-01-01 to 2026-07-19".
 * - Numbers are in numeric order, Dates in the order of their ISO text,
 *   logicals FALSE before TRUE, and text in the order JavaScript's
 *   `localeCompare(..., 'en')` gives: 10, 9, Äpfel, apple, apple2, banana,
 *   Banana, cherry, éclair, Zebra. Neither code points nor numeric
 *   collation agreed.
 * - **A factor is sorted by its levels,** low, mid, high, which the page does
 *   not state, so a sorted factor is left alone: the check does not apply.
 * - **NA comes last whichever way,** for numbers and logicals; a cell reading
 *   "NA" is taken as missing, so a text column holding the string "NA" would
 *   read as a misplaced missing value. Not measured: how the viewer draws
 *   the string "NA" against a missing value.
 * - Row names sit in `#pinnedTable` and the data in `#rsGridData`, each row
 *   of both carrying `aria-rowindex`, so a pinned column's cells are looked
 *   for in both. A cell is matched to its header by position.
 *
 * It applies when the Source pane shows a data viewer with a column sorted
 * that is not a factor and whose header shows at least in part, and reads
 * the live page when the checks run.
 */
type Kind = 'number' | 'date' | 'logical' | 'text';

type Sorted = { column: string; direction: 'ascending' | 'descending'; title: string; values: string[] };

/** What a sorted column's title says of how its values compare, or that they are left alone. */
function kindOf(title: string): Kind | 'factor' | undefined {
  if (/ with \d+ levels?\b/.test(title)) return 'factor';
  if (/^column \d+: (double|integer)\b/.test(title)) return /\brange: \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/.test(title) ? 'date' : 'number';
  if (/^column \d+: logical\b/.test(title)) return 'logical';
  if (/^column \d+: character\b/.test(title)) return 'text';
  return undefined;
}

const MISSING = 'NA';

const COMPARE: Record<Kind, (a: string, b: string) => number> = {
  number: (a, b) => Number(a.replace(/,/g, '')) - Number(b.replace(/,/g, '')),
  date: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
  logical: (a, b) => Number(a === 'TRUE') - Number(b === 'TRUE'),
  text: (a, b) => a.localeCompare(b, 'en'),
};

/** Each sorted column whose header shows at least in part, with its values in the rows wholly in view, top to bottom. */
async function sortedColumns(frame: Frame): Promise<Sorted[]> {
  return frame.evaluate(() => {
    const view = document.getElementById('gridViewport')?.getBoundingClientRect();
    const headers = [...document.querySelectorAll<HTMLElement>('th[role="columnheader"]')];
    const headerBottom = Math.max(0, ...headers.map((header) => header.getBoundingClientRect().bottom));
    const top = Math.max(view?.top ?? 0, headerBottom);
    const bottom = view?.bottom ?? Infinity;
    const rows = new Map<string, HTMLElement[]>();
    for (const row of document.querySelectorAll<HTMLElement>('#pinnedTable tr[aria-rowindex], #rsGridData tr[aria-rowindex]')) {
      const box = row.getBoundingClientRect();
      if (box.height === 0 || box.top < top - 1 || box.bottom > bottom + 1) continue;
      const index = row.getAttribute('aria-rowindex') ?? '';
      rows.set(index, [...(rows.get(index) ?? []), row]);
    }
    const ordered = [...rows.entries()].sort(([a], [b]) => Number(a) - Number(b));
    return headers.flatMap((header) => {
      const direction = header.getAttribute('aria-sort');
      if (direction !== 'ascending' && direction !== 'descending') return [];
      const box = header.getBoundingClientRect();
      if (box.width === 0 || (view && (box.right <= view.left || box.left >= view.right))) return [];
      const middle = (box.left + box.right) / 2;
      const values = ordered.flatMap(([, parts]) => {
        const cell = parts
          .flatMap((part) => [...part.querySelectorAll<HTMLElement>('[role="gridcell"]')])
          .find((candidate) => {
            const at = candidate.getBoundingClientRect();
            return at.left <= middle && middle <= at.right;
          });
        return cell ? [cell.innerText.trim()] : [];
      });
      const column = [...header.querySelectorAll('span')].map((span) => (span.textContent ?? '').trim()).find(Boolean) ?? '';
      return [{ column, direction, title: header.getAttribute('title') ?? '', values }];
    });
  });
}

/** What is out of order among values drawn top to bottom, or nothing. */
function outOfOrder(values: string[], kind: Kind, direction: Sorted['direction']): string | undefined {
  const firstMissing = values.indexOf(MISSING);
  if (firstMissing >= 0) {
    const after = values.slice(firstMissing).findIndex((value) => value !== MISSING);
    if (after >= 0) return `"${values[firstMissing + after]}" is drawn after NA, where NA comes last whichever way`;
  }
  const present = values.filter((value) => value !== MISSING);
  for (let i = 1; i < present.length; i++) {
    const step = COMPARE[kind](present[i - 1] as string, present[i] as string);
    if (direction === 'ascending' ? step > 0 : step < 0) return `"${present[i - 1]}" is drawn above "${present[i]}"`;
  }
  return undefined;
}

export const dataViewerSortedColumnInOrder: AppCheck = {
  name: 'data-viewer-sorted-column-in-order',
  why:
    'A column the data viewer marks as sorted shows its values in that order in the rows in view, ' +
    'missing values last, compared as its header says it holds them. Measured on RStudio ' +
    '2026.11.0-daily+78 on 2026-10-19.',

  async appliesWhen({ page }) {
    const shown = await shownViewer(page);
    if (!shown) return false;
    const sorted = await sortedColumns(shown.frame).catch(() => []);
    return sorted.some((column) => kindOf(column.title) !== 'factor');
  },

  async run({ page }) {
    const shown = await shownViewer(page);
    if (!shown) return { notRun: 'the data viewer went away before it could be read' };
    const sorted = (await sortedColumns(shown.frame)).filter((column) => kindOf(column.title) !== 'factor');
    if (sorted.length === 0) return { notRun: `the data viewer for ${shown.object} no longer shows a sorted column` };
    const wrong: string[] = [];
    for (const column of sorted) {
      const kind = kindOf(column.title);
      if (kind === undefined || kind === 'factor') return { notRun: `column ${column.column}'s header says "${column.title}", which is not a kind this check compares` };
      if (kind === 'number' && column.values.some((value) => value !== MISSING && Number.isNaN(Number(value.replace(/,/g, ''))))) {
        return { notRun: `column ${column.column} is said to hold numbers and draws a value that does not read as one` };
      }
      const why = outOfOrder(column.values, kind, column.direction);
      if (why) wrong.push(`the data viewer for ${shown.object} marks column ${column.column} sorted ${column.direction}, and ${why}`);
    }
    return wrong;
  },
};

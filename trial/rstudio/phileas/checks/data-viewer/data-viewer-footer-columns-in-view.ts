import type { AppCheck } from '@drugstoresushi/phileas';
import type { Frame } from '@playwright/test';
import { shownViewer } from './viewer';

/**
 * Past ~200 columns, the data viewer's footer adds "columns X to Y of N",
 * and those name the columns in the grid's view: every column wholly in view
 * is among X to Y, and every column from X to Y is at least partly in view,
 * or pinned, or one of those the footer says are hidden. Two places on screen stating one fact (R18), the columns half of
 * what `data-viewer-footer-rows-in-view` checks for rows. Under ~200 columns
 * the footer says "N total columns" instead, and this does not apply.
 *
 * **Measured on RStudio 2026.11.0-daily+78, not taken from its code,** by
 * `trial/rstudio/probes/viewer-footer-columns.spec.ts` on 2026-10-22, on
 * `wide`, 1,000 rows by 450 columns, hidden and shown, and pinning and
 * hiding by `data-viewer-columns-check.spec.ts`, both ways:
 * - **A column's place in the whole frame is in its header's `title`,** as
 *   "column 301: integer with range ...". Its `data-col-idx` counts within
 *   the ~200 columns the page fetches, 100 for that one, and the sidebar's
 *   column list builds only a dozen buttons at a time, so neither gives it.
 * - **The footer named exactly the columns at least partly in view** at
 *   every reading, after the engine's settle wait. This check asserts the
 *   weaker rule above, as the rows check does, so it holds whatever the
 *   footer's rounding at either edge.
 * - **A pinned column is drawn in `#pinnedTable`,** left of the grid's
 *   viewport, and the footer does not count it: with column 3 pinned and the
 *   grid at its start the footer said 1 to 5, the viewport drawing 1, 2, 4
 *   and 5. So a pinned column's place is never one the footer has to show.
 * - **A hidden column keeps its place in the footer's range,** and is not
 *   drawn: with column 2 hidden the footer said "columns 1 to 6 of 450 (1
 *   hidden)". Which place is hidden is not on the page in view, so as many
 *   places as the footer says are hidden may be neither in view nor pinned.
 *   That lets one wrong place through for each hidden column, chosen on
 *   2026-10-22 over setting the check aside whenever a column is hidden,
 *   which a Route does often.
 * - **The footer lags a sideways scroll** until the grid has drawn the new
 *   columns, about 200 ms, and the headers in view lag with it; the settle
 *   wait outlasted it at every reading.
 *
 * It applies when the Source pane shows a data viewer whose footer counts
 * columns and that draws at least one unpinned column wholly in view, and
 * reads the live page when the checks run.
 */
const FOOTER = /columns ([\d,]+) to ([\d,]+) of ([\d,]+)/;
const PLACE = /^column (\d+):/;
const HIDDEN = /\(([\d,]+) hidden\)/;

const count = (text: string) => Number(text.replace(/,/g, ''));

/**
 * The footer's text; the places of the unpinned columns wholly and partly in
 * the grid's view, lowest first; the places of the pinned columns; and how
 * many headers in view carry no place in their title.
 */
async function footerAndColumns(frame: Frame): Promise<{ footer?: string; whole: number[]; partly: number[]; pinned: number[]; unplaced: number }> {
  return frame.evaluate((placePattern) => {
    const place = new RegExp(placePattern);
    const footer = [...document.querySelectorAll<HTMLElement>('*')].find((element) =>
      [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim().startsWith('Showing '))
    );
    const view = document.getElementById('gridViewport')?.getBoundingClientRect();
    const left = view?.left ?? 0;
    const right = view?.right ?? Infinity;
    const whole: number[] = [];
    const partly: number[] = [];
    const pinned: number[] = [];
    let unplaced = 0;
    for (const header of document.querySelectorAll<HTMLElement>('th[role="columnheader"]')) {
      const box = header.getBoundingClientRect();
      const at = place.exec(header.getAttribute('title') ?? '');
      if (header.closest('#pinnedTable')) {
        if (at) pinned.push(Number(at[1]));
        continue;
      }
      if (box.width === 0 || box.right <= left + 1 || box.left >= right - 1) continue;
      if (!at) {
        unplaced += 1;
        continue;
      }
      partly.push(Number(at[1]));
      if (box.left >= left - 1 && box.right <= right + 1) whole.push(Number(at[1]));
    }
    const ascending = (a: number, b: number) => a - b;
    return { footer: footer?.innerText.trim(), whole: whole.sort(ascending), partly: partly.sort(ascending), pinned: pinned.sort(ascending), unplaced };
  }, PLACE.source);
}

/** Places as a person reads a list of them: runs written as ranges. */
function listed(places: readonly number[]): string {
  const runs: string[] = [];
  for (let i = 0; i < places.length; ) {
    let j = i;
    while (j + 1 < places.length && places[j + 1] === (places[j] as number) + 1) j += 1;
    runs.push(i === j ? `${places[i]}` : `${places[i]} to ${places[j]}`);
    i = j + 1;
  }
  return runs.join(', ');
}

export const dataViewerFooterColumnsInView: AppCheck = {
  name: 'data-viewer-footer-columns-in-view',
  why:
    "Past ~200 columns, the data viewer's footer, \"columns X to Y\", names every column wholly in the grid's view, " +
    "and only columns at least partly in it, pinned, or as many as it says are hidden, by each header's place in the frame. " +
    'Measured on RStudio 2026.11.0-daily+78 on 2026-10-22.',

  async appliesWhen({ page }) {
    const shown = await shownViewer(page);
    if (!shown) return false;
    const read = await footerAndColumns(shown.frame).catch(() => ({ footer: undefined, whole: [] }));
    return read.footer !== undefined && FOOTER.test(read.footer) && read.whole.length > 0;
  },

  async run({ page }) {
    const shown = await shownViewer(page);
    if (!shown) return { notRun: 'the data viewer went away before it could be read' };
    const { footer, whole, partly, pinned, unplaced } = await footerAndColumns(shown.frame);
    const match = footer === undefined ? null : FOOTER.exec(footer);
    if (!match?.[1] || !match[2]) return { notRun: `the data viewer's footer for ${shown.object} reads "${footer ?? ''}", which is not a range of columns this check knows` };
    if (unplaced > 0) return { notRun: `the data viewer for ${shown.object} draws ${unplaced} column ${unplaced === 1 ? 'header' : 'headers'} in view with no place in ${unplaced === 1 ? 'its' : 'their'} title` };
    if (whole.length === 0) return { notRun: `the data viewer for ${shown.object} no longer draws an unpinned column wholly in view` };
    const [said, saidTo] = [count(match[1]), count(match[2])];
    const leftOut = whole.filter((place) => place < said || place > saidTo);
    const accounted = new Set([...partly, ...pinned]);
    const unseen = Array.from({ length: Math.max(0, saidTo - said + 1) }, (_, i) => said + i).filter((place) => !accounted.has(place));
    const hidden = count(HIDDEN.exec(footer ?? '')?.[1] ?? '0');
    const wrong = [
      ...(leftOut.length ? [`leaves out ${leftOut.length === 1 ? 'column' : 'columns'} ${listed(leftOut)}, wholly in view`] : []),
      ...(unseen.length > hidden
        ? [`names ${unseen.length === 1 ? 'column' : 'columns'} ${listed(unseen)}, neither in view nor pinned${hidden ? `, where it says ${hidden} ${hidden === 1 ? 'is' : 'are'} hidden` : ''}`]
        : []),
    ];
    return wrong.length ? [`the data viewer's footer for ${shown.object} says columns ${said} to ${saidTo}, and ${wrong.join(', and ')}: "${footer}"`] : [];
  },
};

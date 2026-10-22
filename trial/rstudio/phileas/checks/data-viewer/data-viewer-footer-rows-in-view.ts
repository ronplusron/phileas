import type { AppCheck } from '@drugstoresushi/phileas';
import type { Frame } from '@playwright/test';
import { shownViewer } from './viewer';

/**
 * The data viewer's footer, "Showing X to Y of N entries", names the rows in
 * the grid's view: every row wholly in view is among X to Y, and every row
 * from X to Y is at least partly in view. Two places on screen stating one
 * fact (R18). The columns half of the footer, "columns X to Y of N" past
 * ~200 columns, is `data-viewer-footer-columns-in-view`.
 *
 * **Measured on RStudio 2026.11.0-daily+78, not taken from its code,** by
 * `trial/rstudio/probes/viewer-footer-range.spec.ts` on 2026-10-19 and
 * `viewer-footer-rule.spec.ts` on 2026-10-21, on `paged`, 1,000 rows by 120
 * columns:
 * - **The footer names a fixed number of rows from a rounded top,** not the
 *   rows wholly in view, which is what this check first assumed: X is the
 *   first row more than half in view, and Y is X plus as many rows as the
 *   view holds, less one, whatever shows at the bottom. So a row partly in
 *   view at either edge may or may not be named. Measured at tenths of a row
 *   in a shown window: row 201 at 0.61 shown was named and at 0.48 was not,
 *   and Y stayed X + 14 while the bottom row went from 0.48 shown to whole.
 *   This check asserts what holds whatever the rounding, rather than
 *   restating it.
 * - **A position, not a row name:** sorted by `id` descending, the first row
 *   in view is named 1000 and the footer still says 1. A row's position is
 *   its `aria-rowindex` less one, the header row being the first.
 * - It held searched, "Showing 1 to 16 of 99 entries (filtered from 1,000
 *   total entries)", and at the bottom of that, 84 to 99, and with a column
 *   hidden, where the footer adds "(1 hidden)".
 * - The footer changed at once with each scroll.
 * - The header row sits inside the grid's viewport, so the view for rows
 *   starts below it.
 * - **It fired on a layout the engine's hidden window mode produced** until
 *   2026-10-21: a hidden window that had shown for a moment drew rows 37 px
 *   tall while the footer counted them as 23, so it named rows not in view
 *   at all. The engine was fixed the same day (docs/HISTORY.md, 2026-10-21).
 *
 * It applies when the Source pane shows a data viewer whose footer counts
 * rows and that draws at least one row wholly in view, and reads the live
 * page when the checks run.
 */
const FOOTER = /^Showing ([\d,]+) to ([\d,]+) of ([\d,]+) entries/;

const count = (text: string) => Number(text.replace(/,/g, ''));

/** The footer's text, and the positions of the rows wholly and partly in the grid's view, lowest first. */
async function footerAndRows(frame: Frame): Promise<{ footer?: string; whole: number[]; partly: number[] }> {
  return frame.evaluate(() => {
    const footer = [...document.querySelectorAll<HTMLElement>('*')].find((element) =>
      [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim().startsWith('Showing '))
    );
    const view = document.getElementById('gridViewport')?.getBoundingClientRect();
    const headerBottom = Math.max(0, ...[...document.querySelectorAll('th[role="columnheader"]')].map((header) => header.getBoundingClientRect().bottom));
    const top = Math.max(view?.top ?? 0, headerBottom);
    const bottom = view?.bottom ?? Infinity;
    const whole: number[] = [];
    const partly: number[] = [];
    for (const row of document.querySelectorAll<HTMLElement>('#rsGridData tr[aria-rowindex]')) {
      const box = row.getBoundingClientRect();
      if (box.height === 0 || box.bottom <= top + 1 || box.top >= bottom - 1) continue;
      const position = Number(row.getAttribute('aria-rowindex')) - 1;
      partly.push(position);
      if (box.top >= top - 1 && box.bottom <= bottom + 1) whole.push(position);
    }
    return { footer: footer?.innerText.trim(), whole: whole.sort((a, b) => a - b), partly: partly.sort((a, b) => a - b) };
  });
}

/** Positions as a person reads a list of them: runs written as ranges. */
function listed(positions: readonly number[]): string {
  const runs: string[] = [];
  for (let i = 0; i < positions.length; ) {
    let j = i;
    while (j + 1 < positions.length && positions[j + 1] === (positions[j] as number) + 1) j += 1;
    runs.push(i === j ? `${positions[i]}` : `${positions[i]} to ${positions[j]}`);
    i = j + 1;
  }
  return runs.join(', ');
}

export const dataViewerFooterRowsInView: AppCheck = {
  name: 'data-viewer-footer-rows-in-view',
  why:
    "The data viewer's footer, \"Showing X to Y\", names every row wholly in the grid's view, and only " +
    'rows at least partly in it, by position. Measured on RStudio 2026.11.0-daily+78 on 2026-10-19 and 2026-10-21.',

  async appliesWhen({ page }) {
    const shown = await shownViewer(page);
    if (!shown) return false;
    const read = await footerAndRows(shown.frame).catch(() => ({ footer: undefined, whole: [] }));
    return read.footer !== undefined && FOOTER.test(read.footer) && read.whole.length > 0;
  },

  async run({ page }) {
    const shown = await shownViewer(page);
    if (!shown) return { notRun: 'the data viewer went away before it could be read' };
    const { footer, whole, partly } = await footerAndRows(shown.frame);
    const match = footer === undefined ? null : FOOTER.exec(footer);
    if (!match?.[1] || !match[2]) return { notRun: `the data viewer's footer for ${shown.object} reads "${footer ?? ''}", which is not a range this check knows` };
    if (whole.length === 0) return { notRun: `the data viewer for ${shown.object} no longer draws a row wholly in view` };
    const [said, saidTo] = [count(match[1]), count(match[2])];
    const leftOut = whole.filter((position) => position < said || position > saidTo);
    const inView = new Set(partly);
    const unseen = Array.from({ length: Math.max(0, saidTo - said + 1) }, (_, i) => said + i).filter((position) => !inView.has(position));
    const wrong = [
      ...(leftOut.length ? [`leaves out ${leftOut.length === 1 ? 'row' : 'rows'} ${listed(leftOut)}, wholly in view`] : []),
      ...(unseen.length ? [`names ${unseen.length === 1 ? 'row' : 'rows'} ${listed(unseen)}, not in view at all`] : []),
    ];
    return wrong.length ? [`the data viewer's footer for ${shown.object} says rows ${said} to ${saidTo}, and ${wrong.join(', and ')}: "${footer}"`] : [];
  },
};

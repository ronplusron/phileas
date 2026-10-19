import type { AppCheck } from '@drugstoresushi/phileas';
import type { Frame } from '@playwright/test';
import { shownViewer } from './viewer';

/**
 * The data viewer's footer, "Showing X to Y of N entries", names the rows
 * wholly in the grid's view: X is the first one's position and Y the last
 * one's. Two places on screen stating one fact (R18). The columns half of the
 * footer, "columns X to Y of N" past ~200 columns, is not checked: the page's
 * own column positions count within the ~200 columns it fetches, not across
 * the frame, and nothing measured yet gives a header's place in the whole.
 *
 * **Measured on RStudio 2026.11.0-daily+78, not taken from its code,** by
 * `trial/rstudio/probes/viewer-footer-range.spec.ts` on 2026-10-19, on
 * `paged`, 1,000 rows by 120 columns:
 * - X and Y were the positions of the first and last rows wholly in view as
 *   opened, scrolled a quarter, half way and to the bottom, and half a row
 *   off: a row only partly in view is not counted.
 * - **A position, not a row name:** sorted by `id` descending, the first row
 *   in view is named 1000 and the footer still says 1. A row's position is
 *   its `aria-rowindex` less one, the header row being the first.
 * - It held searched, "Showing 1 to 16 of 99 entries (filtered from 1,000
 *   total entries)", and at the bottom of that, 84 to 99, and with a column
 *   hidden, where the footer adds "(1 hidden)".
 * - The footer changed at once with each scroll, read at once, after 500 ms
 *   and after 2.5 s.
 * - The header row sits inside the grid's viewport, so the view for rows
 *   starts below it.
 *
 * It applies when the Source pane shows a data viewer whose footer counts
 * rows and that draws at least one row wholly in view, and reads the live
 * page when the checks run.
 */
const FOOTER = /^Showing ([\d,]+) to ([\d,]+) of ([\d,]+) entries/;

const count = (text: string) => Number(text.replace(/,/g, ''));

/** The footer's text, and the positions of the rows wholly in the grid's view, lowest first. */
async function footerAndRows(frame: Frame): Promise<{ footer?: string; positions: number[] }> {
  return frame.evaluate(() => {
    const footer = [...document.querySelectorAll<HTMLElement>('*')].find((element) =>
      [...element.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? '').trim().startsWith('Showing '))
    );
    const view = document.getElementById('gridViewport')?.getBoundingClientRect();
    const headerBottom = Math.max(0, ...[...document.querySelectorAll('th[role="columnheader"]')].map((header) => header.getBoundingClientRect().bottom));
    const top = Math.max(view?.top ?? 0, headerBottom);
    const bottom = view?.bottom ?? Infinity;
    const positions = [...document.querySelectorAll<HTMLElement>('#rsGridData tr[aria-rowindex]')]
      .filter((row) => {
        const box = row.getBoundingClientRect();
        return box.height > 0 && box.top >= top - 1 && box.bottom <= bottom + 1;
      })
      .map((row) => Number(row.getAttribute('aria-rowindex')) - 1)
      .sort((a, b) => a - b);
    return { footer: footer?.innerText.trim(), positions };
  });
}

export const dataViewerFooterRowsInView: AppCheck = {
  name: 'data-viewer-footer-rows-in-view',
  why:
    "The data viewer's footer, \"Showing X to Y\", names the first and last rows wholly in the grid's " +
    'view, by position. Measured on RStudio 2026.11.0-daily+78 on 2026-10-19.',

  async appliesWhen({ page }) {
    const shown = await shownViewer(page);
    if (!shown) return false;
    const read = await footerAndRows(shown.frame).catch(() => ({ footer: undefined, positions: [] }));
    return read.footer !== undefined && FOOTER.test(read.footer) && read.positions.length > 0;
  },

  async run({ page }) {
    const shown = await shownViewer(page);
    if (!shown) return { notRun: 'the data viewer went away before it could be read' };
    const { footer, positions } = await footerAndRows(shown.frame);
    const match = footer === undefined ? null : FOOTER.exec(footer);
    if (!match?.[1] || !match[2]) return { notRun: `the data viewer's footer for ${shown.object} reads "${footer ?? ''}", which is not a range this check knows` };
    const first = positions[0];
    const last = positions.at(-1);
    if (first === undefined || last === undefined) return { notRun: `the data viewer for ${shown.object} no longer draws a row wholly in view` };
    const [said, saidTo] = [count(match[1]), count(match[2])];
    if (said === first && saidTo === last) return [];
    return [`the data viewer's footer for ${shown.object} says rows ${said} to ${saidTo}, and rows ${first} to ${last} are wholly in view: "${footer}"`];
  },
};

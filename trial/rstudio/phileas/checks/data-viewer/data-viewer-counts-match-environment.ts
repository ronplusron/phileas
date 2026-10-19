import type { AppCheck } from '@drugstoresushi/phileas';
import type { Page } from '@playwright/test';
import { viewedObject, viewerFrame } from './viewer';

/**
 * The data viewer counts the same rows and columns for an object as the
 * Environment pane does. Two places on screen stating one fact (R18), from
 * docs/OUTSTANDING.md 2.30's first candidate.
 *
 * **Measured on RStudio, not taken from its code,** by
 * `trial/rstudio/probes/intent-candidates.spec.ts` on 2026.10.0 and
 * `viewer-paging.spec.ts` on 2026.11.0-daily+78:
 * - The Environment pane's row for a frame reads "1000 obs. of 120
 *   variables"; the viewer's footer, in its own frame whose address names the
 *   object (`obj=paged`), reads "Showing 1 to 16 of 1,000 entries, 120 total
 *   columns", with thousands written with a comma.
 * - A search makes it "Showing 1 to 7 of 7 entries (filtered from 32 total
 *   entries)", so the total is what compares.
 * - The footer kept its count as the grid scrolled down and sideways.
 * - **Past 200 columns the footer counts the columns in view instead,**
 *   "Showing 1 to 16 of 1,000 entries, columns 1 to 5 of 450", measured on
 *   2026-10-19 at 450 columns; the viewer's address carries
 *   `max_display_columns=200`. The total is the number after "of". Read only
 *   in the first form, a frame that wide was recorded as not run.
 *
 * It applies when the Source pane shows a data viewer, named "<object> Data
 * Browser", for an object the Environment pane lists while it shows: `mtcars`
 * viewed alone has no row there, and History selected hides the pane. It
 * reads the live page when the checks run.
 */
const ENVIRONMENT_COUNT = /^([\d,]+) obs\. of (\d+) variables?$/;
const FOOTER =
  /of ([\d,]+) entries(?: \(filtered from ([\d,]+) total entries\))?, (?:([\d,]+) total columns|columns [\d,]+ to [\d,]+ of ([\d,]+))/;

const count = (text: string) => Number(text.replace(/,/g, ''));

/** The Environment pane's rows and columns for an object, if it lists one while it shows. */
async function environmentCount(page: Page, object: string): Promise<{ rows: number; columns: number } | undefined> {
  const rows = await page
    .getByRole('tabpanel', { name: 'Environment' })
    .getByRole('row')
    .evaluateAll((all) => all.map((row) => [...row.querySelectorAll('[role="gridcell"], [role="cell"], td')].map((cell) => (cell.textContent ?? '').trim())));
  for (const cells of rows) {
    if (!cells.includes(object)) continue;
    for (const cell of cells) {
      const match = ENVIRONMENT_COUNT.exec(cell);
      if (match?.[1] && match[2]) return { rows: count(match[1]), columns: count(match[2]) };
    }
  }
  return undefined;
}

export const dataViewerCountsMatchEnvironment: AppCheck = {
  name: 'data-viewer-counts-match-environment',
  why:
    "The data viewer's footer counts the same rows, before any filter, and columns as the Environment pane " +
    'states for the object it shows. Measured on RStudio 2026.10.0 and 2026.11.0-daily+78.',

  async appliesWhen({ page }) {
    const object = await viewedObject(page);
    if (!object || !viewerFrame(page, object)) return false;
    return (await environmentCount(page, object)) !== undefined;
  },

  async run({ page }) {
    const object = await viewedObject(page);
    const frame = object ? viewerFrame(page, object) : undefined;
    const listed = object ? await environmentCount(page, object) : undefined;
    if (!object || !frame || !listed) return { notRun: 'the data viewer or its Environment row went away before it could be read' };
    const footer = await frame.getByText(/^Showing /).first().innerText({ timeout: 2_000 }).catch(() => undefined);
    if (footer === undefined) return { notRun: `the data viewer for ${object} shows no footer to read` };
    const match = FOOTER.exec(footer);
    const total = match?.[3] ?? match?.[4];
    if (!match?.[1] || !total) return { notRun: `the data viewer's footer for ${object} reads "${footer}", which is not a count this check knows` };
    const rows = count(match[2] ?? match[1]);
    const columns = count(total);
    const wrong: string[] = [];
    if (rows !== listed.rows) wrong.push(`${rows} rows against the Environment pane's ${listed.rows}`);
    if (columns !== listed.columns) wrong.push(`${columns} columns against the Environment pane's ${listed.columns}`);
    return wrong.length ? [`the data viewer for ${object} counts ${wrong.join(', and ')}: "${footer}"`] : [];
  },
};

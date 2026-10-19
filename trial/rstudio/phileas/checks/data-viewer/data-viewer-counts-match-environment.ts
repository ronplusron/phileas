import type { AppCheck } from '@drugstoresushi/phileas';
import type { Frame, Page } from '@playwright/test';

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
 *
 * It applies when the Source pane shows a data viewer, named "<object> Data
 * Browser", for an object the Environment pane lists while it shows: `mtcars`
 * viewed alone has no row there, and History selected hides the pane. It
 * reads the live page when the checks run.
 */
const ENVIRONMENT_COUNT = /^([\d,]+) obs\. of (\d+) variables?$/;
const FOOTER = /of ([\d,]+) entries(?: \(filtered from ([\d,]+) total entries\))?, ([\d,]+) total columns/;

const count = (text: string) => Number(text.replace(/,/g, ''));

/** The object the Source pane's data viewer shows, if one is showing. */
async function viewedObject(page: Page): Promise<string | undefined> {
  const panel = page.getByRole('region', { name: 'Source' }).getByRole('tabpanel', { name: / Data Browser$/ });
  if ((await panel.count()) === 0) return undefined;
  const name = await panel.first().getAttribute('aria-label');
  return name?.replace(/ Data Browser$/, '') || undefined;
}

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

function viewerFrame(page: Page, object: string): Frame | undefined {
  return page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes(`obj=${encodeURIComponent(object)}&`));
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
    if (!match?.[1] || !match[3]) return { notRun: `the data viewer's footer for ${object} reads "${footer}", which is not a count this check knows` };
    const rows = count(match[2] ?? match[1]);
    const columns = count(match[3]);
    const wrong: string[] = [];
    if (rows !== listed.rows) wrong.push(`${rows} rows against the Environment pane's ${listed.rows}`);
    if (columns !== listed.columns) wrong.push(`${columns} columns against the Environment pane's ${listed.columns}`);
    return wrong.length ? [`the data viewer for ${object} counts ${wrong.join(', and ')}: "${footer}"`] : [];
  },
};

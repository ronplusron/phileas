import type { Frame, Page } from '@playwright/test';

/**
 * Finding the data viewer the Source pane shows, for the checks in this
 * folder. Measured on RStudio 2026.10.0 and 2026.11.0-daily+78: the Source
 * pane's tab panel for a viewer is named "<object> Data Browser", and the
 * viewer draws in a frame of its own whose address names the object, as
 * `gridviewer.html?...&obj=paged&...`.
 */

/** The object the Source pane's data viewer shows, if one is showing. */
export async function viewedObject(page: Page): Promise<string | undefined> {
  const panel = page.getByRole('region', { name: 'Source' }).getByRole('tabpanel', { name: / Data Browser$/ });
  if ((await panel.count()) === 0) return undefined;
  const name = await panel.first().getAttribute('aria-label');
  return name?.replace(/ Data Browser$/, '') || undefined;
}

/** The viewer's frame for an object. */
export function viewerFrame(page: Page, object: string): Frame | undefined {
  return page.frames().find((frame) => frame.url().includes('gridviewer.html') && frame.url().includes(`obj=${encodeURIComponent(object)}&`));
}

/** The frame of the data viewer the Source pane shows, with its object, if one is showing. */
export async function shownViewer(page: Page): Promise<{ object: string; frame: Frame } | undefined> {
  const object = await viewedObject(page);
  const frame = object ? viewerFrame(page, object) : undefined;
  return object && frame ? { object, frame } : undefined;
}

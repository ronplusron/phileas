import type { ElectronApplication } from '@playwright/test';

/**
 * Click a native menu item by walking the application menu by label.
 *
 * Playwright cannot press a native accelerator, so this is the closest thing to
 * a real user's action available. It is deliberately not "send the IPC message
 * the menu would have sent": that would skip the menu wiring entirely and keep
 * passing if the menu were deleted, which is exactly the regression worth
 * catching.
 *
 * Labels are walked rather than looked up by id because the menu items do not
 * set ids.
 */
export async function clickMenuItem(app: ElectronApplication, labels: string[]): Promise<void> {
  // An empty path used to walk nothing, click nothing, and report success. No
  // caller passes one today, and phase 4 builds these paths from Candidate's
  // optional menuPath, where nothing in the type prevents it. A hop journaled
  // as executed that did nothing corrupts the journal and the seeded replay
  // together.
  if (labels.length === 0) {
    throw new Error('clickMenuItem needs at least one label, and was given none.');
  }

  const found = await app.evaluate(({ Menu }, labels) => {
    let items = Menu.getApplicationMenu()?.items ?? [];
    let item: Electron.MenuItem | undefined;
    for (const label of labels) {
      item = items.find((candidate) => candidate.label === label);
      if (!item) return false;
      items = item.submenu?.items ?? [];
    }
    item?.click();
    return true;
  }, labels);

  if (!found) {
    throw new Error(`No menu item at ${labels.join(' > ')}`);
  }
}

/** The labels directly under a submenu, for asserting a menu's shape. */
export function menuLabels(app: ElectronApplication, labels: string[]): Promise<string[]> {
  return app.evaluate(({ Menu }, labels) => {
    let items = Menu.getApplicationMenu()?.items ?? [];
    for (const label of labels) {
      const item = items.find((candidate) => candidate.label === label);
      if (!item) return [];
      items = item.submenu?.items ?? [];
    }
    return items.map((item) => item.label);
  }, labels);
}

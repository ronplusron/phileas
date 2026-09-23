import type { ElectronApplication } from '@playwright/test';

/**
 * Click a native menu item by walking the application menu by label.
 *
 * Playwright cannot press a native accelerator, so this is the closest thing to
 * a real user's action available. It is deliberately not "send the IPC message
 * the menu would have sent": that would skip the menu wiring entirely, and a
 * hop is meant to do what a person would do rather than to arrange the result
 * a person would have got.
 *
 * Why the engine reaches the menu at all: menu items live in the main process
 * and never appear in a page's accessibility tree, so survey by role alone
 * would never see them -- and an exclusion list naming Quit is meaningless
 * unless a Route can reach Quit. docs/PLAN.md has the rest.
 *
 * Labels are walked rather than looked up by id because ids are optional in an
 * Electron menu template and many applications omit them.
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

/**
 * One clickable entry in the application menu, with the path that reaches it.
 *
 * Leaves only. A submenu is a way to more entries rather than something to hop
 * to, and separators are not entries at all.
 */
export interface MenuEntry {
  /** The label path from the menu root, which is what clickMenuItem walks. */
  readonly path: readonly string[];
  readonly label: string;
  readonly enabled: boolean;
}

/**
 * Every clickable entry in the application menu, in menu order.
 *
 * Order comes from the menu template, so it is the same on every read of an
 * unchanged menu. R8 rests on that: a candidate list that reordered between two
 * runs of one seed would send the draw somewhere else from the first menu hop
 * onward.
 *
 * Hidden and separator items are dropped. Disabled ones are kept and marked, so
 * that a caller can tell "there is no such entry" from "the entry is there and
 * cannot be used", which are different findings.
 */
export function menuEntries(app: ElectronApplication): Promise<MenuEntry[]> {
  return app.evaluate(({ Menu }) => {
    const entries: { path: string[]; label: string; enabled: boolean }[] = [];

    const walk = (items: Electron.MenuItem[], prefix: string[]): void => {
      for (const item of items) {
        if (item.type === 'separator' || !item.visible) continue;
        const path = [...prefix, item.label];
        const submenu = item.submenu?.items ?? [];
        if (submenu.length) walk(submenu, path);
        else entries.push({ path, label: item.label, enabled: item.enabled });
      }
    };

    walk(Menu.getApplicationMenu()?.items ?? [], []);
    return entries;
  });
}

/**
 * Whether any of the application's windows currently holds focus.
 *
 * This is not idle curiosity, it is the one thing that decides whether a menu
 * hop means anything. Electron hands a menu item's click handler the FOCUSED
 * window, and the ordinary handler shape is `(item, win) => win.webContents
 * .send(...)`. With no focused window, `win` is undefined and the handler does
 * nothing at all, while `clickMenuItem` walks to the item, clicks it, and
 * returns success. A hop journaled as executed that did nothing corrupts the
 * journal and the seeded replay together, against an application that is not
 * broken.
 *
 * **The engine causes the condition itself**, by keeping windows off the screen
 * so a Journey can run unattended. Measured on 2026-09-22 against the testbed:
 * with windows hidden, `getFocusedWindow()` returns null; calling `focus()` on a
 * hidden window does not change that; and replacing `getFocusedWindow` in the
 * main process does not help either, because Electron resolves the focused
 * window for a menu click natively rather than through that binding. The
 * positive control was the testbed's own View menu, whose handler falls back to
 * the first window: it toggled the view under exactly the same conditions, so
 * the menu walk is sound and the focus is what is missing.
 *
 * So there is no repair available to the engine, and detection is the answer.
 * survey() declines to offer menu candidates when this is false, and says so.
 */
export function hasFocusedWindow(app: ElectronApplication): Promise<boolean> {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow() !== null);
}

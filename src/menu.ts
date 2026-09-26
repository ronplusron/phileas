import type { ElectronApplication, Page } from '@playwright/test';

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
 *
 * **The handler is handed the Route's own window, explicitly.** A real click
 * on the menu bar gets the focused window from Electron natively, but calling
 * `item.click()` from code with no arguments hands the handler no window at
 * all -- measured on 2026-09-24 with a handler that recorded what it received,
 * and true with the application hidden and equally with it shown, frontmost and
 * focused. The ordinary handler shape is `(item, win) => win.webContents
 * .send(...)`, so a bare click did nothing while this returned success. Passing
 * the window through `click(event, focusedWindow, focusedWebContents)`, the
 * signature Electron documents, gives the handler what a person's click would
 * have given it, in every window mode, whatever else on the machine holds
 * focus.
 *
 * One case this cannot reach: a handler that ignores its arguments and asks
 * `BrowserWindow.getFocusedWindow()` itself gets nothing while the windows are
 * hidden, because a hidden window cannot hold focus. That is a hop doing
 * nothing, and phase 5's check that a hop changed something is what sees it.
 */
export async function clickMenuItem(
  app: ElectronApplication,
  labels: string[],
  page: Page
): Promise<void> {
  // An empty path used to walk nothing, click nothing, and report success. No
  // caller passes one today, and phase 4 builds these paths from Candidate's
  // optional menuPath, where nothing in the type prevents it. A hop journaled
  // as executed that did nothing corrupts the journal and the seeded replay
  // together.
  if (labels.length === 0) {
    throw new Error('clickMenuItem needs at least one label, and was given none.');
  }

  const win = await app.browserWindow(page);
  try {
    const found = await app.evaluate(
      ({ Menu }, { labels, win }) => {
        let items = Menu.getApplicationMenu()?.items ?? [];
        let item: Electron.MenuItem | undefined;
        for (const label of labels) {
          item = items.find((candidate) => candidate.label === label);
          if (!item) return false;
          items = item.submenu?.items ?? [];
        }
        // The event is what a mouse click on the menu produces: no modifier
        // held, and not reached through an accelerator.
        const event = {
          triggeredByAccelerator: false,
          shiftKey: false,
          ctrlKey: false,
          altKey: false,
          metaKey: false,
        };
        const window = win as unknown as Electron.BrowserWindow;
        item?.click(event, window, window.webContents);
        return true;
      },
      { labels, win }
    );

    if (!found) {
      throw new Error(`No menu item at ${labels.join(' > ')}`);
    }
  } finally {
    await win.dispose();
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
  /**
   * The Electron role the entry was built from, such as `quit` or `zoomin`,
   * or absent for an entry the application's own authors wrote. See
   * `Exclusions.allowStandardMenuRoles` for why that difference matters.
   */
  readonly electronRole?: string;
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
    const entries: { path: string[]; label: string; enabled: boolean; electronRole?: string }[] = [];

    const walk = (items: Electron.MenuItem[], prefix: string[]): void => {
      for (const item of items) {
        if (item.type === 'separator' || !item.visible) continue;
        const path = [...prefix, item.label];
        const submenu = item.submenu?.items ?? [];
        if (submenu.length) walk(submenu, path);
        else
          entries.push({
            path,
            label: item.label,
            enabled: item.enabled,
            ...(item.role ? { electronRole: item.role.toLowerCase() } : {}),
          });
      }
    };

    walk(Menu.getApplicationMenu()?.items ?? [], []);
    return entries;
  });
}

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
 * nothing, which the journal records as no change and no check fails on.
 */
export async function clickMenuItem(
  app: ElectronApplication,
  labels: string[],
  page: Page
): Promise<void> {
  // An empty path used to walk nothing, click nothing, and report success.
  // The type requires a menu candidate to have a path but not a non-empty one,
  // and a hop journaled as executed that did nothing corrupts the journal and
  // the seeded replay together.
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
    // A handle that cannot be released, because the application has gone,
    // must not replace the error that says what happened to the click.
    await win.dispose().catch(() => undefined);
  }
}

/**
 * Treat the Route's window as the focused one, in every window mode, so an
 * application that builds its menu from focus offers the same menu on every
 * launch.
 *
 * A hidden window cannot take focus, and a shown one has it only when nothing
 * else on the machine does. Positron enables most of its menu only while its
 * window is focused: measured on 2026-10-03, 18 of 226 entries were enabled
 * without focus and 195 with it, and which a Route got depended on the
 * machine, so one seed drew from 6 menu entries on one run and 157 on
 * another. So the engine answers for the window, as it answers for outbound
 * links and native dialogs: `getFocusedWindow` returns it while it lasts,
 * `isFocused` says yes, and it is sent the `focus` events a real focus would
 * send. Nothing gives it real focus, so the window stays where the window
 * mode put it. Decided on 2026-10-03 as part A of the menu bar's proposal,
 * after reviewing Positron's whole menu against its exclusions and drawing
 * the menu a level at a time, and for every application, since RStudio's and
 * Bobolink Editor's menus were measured not to depend on focus.
 *
 * What it does not reach: a `blur` the operating system sends a shown window
 * when the person switches away, which an application may answer by
 * narrowing its menu again until the window has real focus.
 */
export async function claimFocus(app: ElectronApplication, page: Page): Promise<void> {
  const win = await app.browserWindow(page);
  try {
    await app.evaluate(
      ({ BrowserWindow }, handle) => {
        const window = handle as unknown as Electron.BrowserWindow;
        BrowserWindow.getFocusedWindow = () => (window.isDestroyed() ? null : window);
        window.isFocused = () => !window.isDestroyed();
        // Electron passes a window's focus on to the app as
        // browser-window-focus by itself, so one emit sends both.
        window.emit('focus');
      },
      win
    );
  } finally {
    await win.dispose().catch(() => undefined);
  }
}

/**
 * The labels directly under a submenu, for asserting a menu's shape.
 *
 * Refuses a path that does not exist rather than answering with no labels,
 * which is the same false success an empty path once gave `clickMenuItem`: an
 * assertion that Quit is absent would pass on a mistyped path.
 */
export async function menuLabels(app: ElectronApplication, labels: string[]): Promise<string[]> {
  const found = await app.evaluate(({ Menu }, labels) => {
    let items = Menu.getApplicationMenu()?.items ?? [];
    for (const label of labels) {
      const item = items.find((candidate) => candidate.label === label);
      if (!item) return null;
      items = item.submenu?.items ?? [];
    }
    return items.map((item) => item.label);
  }, labels);
  if (found === null) throw new Error(`No menu at ${labels.join(' > ')}`);
  return found;
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

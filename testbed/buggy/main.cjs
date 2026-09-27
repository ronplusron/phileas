// The main process of the testbed application.
//
// This application exists to be traveled through. Its surface is chosen
// against the five ways a defect gets found in docs/PRODUCT_REQUIREMENTS.md,
// because each one is where a defect gets planted in a later phase: named
// controls to hop to, a count above a list, a search box with a clear, a
// native dropdown filtering by category, two views to navigate between, a menu holding Quit, an outbound link, and a
// total derived from a data file that ships with the application.
//
// Nothing is broken unless a flag says so. Launched plainly, this is the
// unbroken version its own baseline tests record; the planted defects below are
// each switched on by a --buggy-plant flag.
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Read once at startup, and hand the renderer a copy. The file is also what a
// specified oracle reads to compute the expected total independently, so the
// two must come from the same file and share no logic beyond reading it.
const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'items.json'), 'utf8'));

const shownAtCreation = process.argv.includes('--buggy-shown-at-creation');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 640,
    // Shown at creation under --buggy-shown-at-creation, the way Positron
    // creates its main window, which never calls show() and so is not reached
    // by replacing it. Hidden until ready otherwise, the usual pattern.
    show: shownAtCreation,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!shownAtCreation) win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Both ways out of the window, closed the same way. Leaving only the first
  // open lets an external site load over the top of the interface, with no
  // back button and no way out short of quitting.
  const openExternally = (url) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  };

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });

  // Electron does not emit will-navigate for in-page navigation -- an anchor
  // link or a hash change -- so there is nothing here to let through. A guard
  // for that case was removed in review: it could never fire, and had it fired
  // it would have swallowed the navigation silently.
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    openExternally(url);
  });

  return win;
}

// Planted defects, each switched on by its own flag: --buggy-plant=<name>, which
// may be given more than once. Off by default, so buggy stays the unbroken
// baseline its own tests record and no recorded seed moves. Each exists to make
// one of the engine's checks fire, since a check that cannot be made to fire
// does not ship. The renderer asks for the list and adds one button per plant.
const PLANTS = [
  'renderer-throw',
  'main-throw',
  'console-error',
  'renderer-hang',
  'main-hang',
  'endless-hang',
  'blank',
  'dialog',
  'log-error',
  'renderer-crash',
  'main-exit',
];
const plants = process.argv
  .filter((arg) => arg.startsWith('--buggy-plant='))
  .map((arg) => arg.slice('--buggy-plant='.length));
for (const plant of plants) {
  if (!PLANTS.includes(plant)) throw new Error(`--buggy-plant=${plant} is not a planted defect: ${PLANTS.join(', ')}`);
}

// How long a planted hang lasts. Long enough to outlast a test's shortened
// waits, and finite, so a test that sets it off can still close the application.
const HANG_MS = 6000;

ipcMain.handle('plants:list', () => plants);

ipcMain.handle('plant:main-throw', () => {
  // Thrown outside the handler, so nothing catches it: an uncaught exception
  // in the main process, which the renderer never sees.
  setTimeout(() => {
    throw new Error('the trunk strap snapped in the main process');
  }, 0);
});

ipcMain.handle('plant:main-hang', () => {
  const until = Date.now() + HANG_MS;
  while (Date.now() < until) {
    // Busy on purpose: the main process answers nothing until this ends.
  }
});

// Never ends. Busy in the main process, so Electron's own handling of a stop
// signal, which needs the event loop, never runs either: measured on Positron
// on 2026-09-26, where a blocked main process ignored an ordinary stop signal.
// This is what a teardown has to survive.
ipcMain.handle('plant:endless-hang', () => {
  for (;;) {
    // Busy on purpose, forever.
  }
});

// The renderer dies, the way a renderer out of memory or hitting a native
// fault does. Nothing throws and nothing hangs: the page is simply gone.
ipcMain.handle('plant:renderer-crash', (event) => {
  setTimeout(() => event.sender.forcefullyCrashRenderer(), 0);
});

// The application quits on its own, mid-Trip, with no dialog and no error.
ipcMain.handle('plant:main-exit', () => {
  setTimeout(() => app.exit(3), 0);
});

ipcMain.handle('plant:log-error', () => {
  // The log's location comes from the environment, so a test names the same
  // file in its adapter's logPaths.
  const log = process.env.BUGGY_LOG;
  if (log) fs.appendFileSync(log, `${new Date().toISOString()} ERROR the logbook page is torn\n`);
});

// A deliberate fault-injection switch. It exists so that a test can drive a
// real boot failure through the application's own path, rather than writing the
// failure marker in by hand and proving only that string comparison works.
const failItems = process.argv.includes('--buggy-fail-items');

ipcMain.handle('items:all', async () => {
  if (failItems) {
    // The delay is the point, not padding. A failure that lands before anything
    // looks is caught even by an adapter that samples the marker once, so a test
    // built on an instant failure passes against a broken adapter and proves
    // nothing -- measured, not assumed. Real boot failures arrive after a wait,
    // and this reproduces that ordering.
    await new Promise((resolve) => setTimeout(resolve, 750));
    throw new Error('the trunk could not be opened');
  }
  return items;
});

/**
 * Send a view change to a window, falling back when none is focused.
 *
 * Electron hands a menu click the FOCUSED window, and an automated run has no
 * focused window: the application is not frontmost, and this engine keeps its
 * windows off the screen on purpose. The original handler was
 * `win?.webContents.send(...)`, so under automation the optional chain turned
 * every menu click into nothing at all. The menu rendered, the click succeeded,
 * and the application did not move.
 *
 * Falling back to the first window is what a real application should do here
 * too, and it is why this is a fix rather than a test accommodation. The
 * engine now hands a menu click the Route's own window, so under automation
 * the fallback is no longer reached; it serves a person, and any handler
 * reached some other way.
 */
function showViewIn(win, view) {
  const target = win ?? BrowserWindow.getAllWindows()[0];
  target?.webContents.send('view:show', view);
}

function buildMenu() {
  // Quit lives here on purpose, so the engine's skip of standard menu entries
  // has something to skip, and so a Route can reach the menu at all.
  const template = [
    {
      label: 'Buggy',
      submenu: [
        { label: 'About Buggy', click: () => {} },
        { type: 'separator' },
        { label: 'Quit Buggy', role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Show Inventory', click: (_item, win) => showViewIn(win, 'inventory') },
        { label: 'Show Summary', click: (_item, win) => showViewIn(win, 'summary') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// An application that finds, a second into its startup work, that it cannot
// go on, says why on standard error the way an application reports one, and
// never opens a window. After a second rather than at once: Playwright's
// launch returns only once Electron is ready, and the engine hears nothing
// printed before that.
const noWindow = process.argv.includes('--buggy-no-window');

app.whenReady().then(() => {
  if (noWindow) {
    setTimeout(() => process.stderr.write('Buggy cannot start: the luggage room is locked\n'), 1000);
    return;
  }
  buildMenu();
  // Later under --buggy-shown-at-creation, as Positron creates its window only
  // after its own startup work: after the engine has already hidden whatever
  // windows existed at launch, which is how its window escaped.
  if (shownAtCreation) setTimeout(createWindow, 1000);
  else createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

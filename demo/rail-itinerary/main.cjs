// The main process of Rail Itinerary, a demo application for showing Phileas
// at work. docs/DEMO_PLAN_TRAIN.md is its plan.
//
// It uses none of Phileas's own terms -- Journey, Route, Trip, Hop, Fix, Map --
// so that a person watching the demo never confuses the engine's words with
// the application's. It plans itineraries made of legs.
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', name), 'utf8'));
const data = {
  stations: read('stations.json'),
  timetable: read('timetable.json'),
  fares: read('fares.json'),
  itineraries: read('itineraries.json'),
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    show: false,
    title: 'Rail Itinerary',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Links to the outside world open in the person's browser, never in the
  // application's window.
  const openExternally = (url) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    openExternally(url);
  });
  return win;
}

// Planted bugs, each switched on by its own flag, --plant=<name>, which may be
// given more than once. Off by default, so the application shown working is
// the same build as the one shown broken, and any one bug can be shown alone.
// A name that names nothing is refused, so a misspelt one never runs the
// application unbroken while seeming to run it broken. The adapter refuses it
// first, in words a run prints; this is for a launch by hand. It exits rather
// than throwing, since an uncaught error this early raises a native error box.
const { PLANTS } = require('./plants.cjs');
const plants = process.argv.filter((arg) => arg.startsWith('--plant=')).map((arg) => arg.slice('--plant='.length));
for (const plant of plants) {
  if (!PLANTS.includes(plant)) {
    process.stderr.write(`--plant=${plant} names no planted bug. The plants are ${PLANTS.join(', ')}.\n`);
    process.exit(2);
  }
}

ipcMain.handle('data:all', () => data);
ipcMain.handle('plants', () => plants);

// A menu click reaches the focused window, and a watched run may have none
// focused for a moment; the first window is the sensible fallback.
function showScreenIn(win, screen) {
  (win ?? BrowserWindow.getAllWindows()[0])?.webContents.send('screen:show', screen);
}

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Rail Itinerary',
        submenu: [{ label: 'Quit Rail Itinerary', role: 'quit' }],
      },
      {
        label: 'Edit',
        submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }],
      },
      {
        label: 'View',
        submenu: [
          { label: 'Show Itineraries', click: (_i, win) => showScreenIn(win, 'itineraries') },
          { label: 'Show Timetable', click: (_i, win) => showScreenIn(win, 'timetable') },
        ],
      },
    ])
  );
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

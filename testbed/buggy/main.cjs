// The main process of the testbed application.
//
// This application exists to be traveled through. Its surface is chosen
// against the five ways a defect gets found in docs/PRODUCT_REQUIREMENTS.md,
// because each one is where a defect gets planted in a later phase: named
// controls to hop to, a count above a list, a search box with a clear, two
// views to navigate between, a menu holding Quit, an outbound link, and a
// total derived from a data file that ships with the application.
//
// Nothing here is deliberately broken yet. Phase 2 is the unbroken version.
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Read once at startup, and hand the renderer a copy. The file is also what a
// specified oracle reads to compute the expected total independently, so the
// two must come from the same file and share no logic beyond reading it.
const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'items.json'), 'utf8'));

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 640,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());
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

  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return; // in-page anchor
    event.preventDefault();
    openExternally(url);
  });

  return win;
}

ipcMain.handle('items:all', () => items);

function buildMenu() {
  // Quit lives here on purpose: the exclusion list exists for exactly this,
  // and an exclusion naming a menu item is meaningless unless the traversal
  // can reach the menu.
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
        { label: 'Show Inventory', click: (_item, win) => win?.webContents.send('view:show', 'inventory') },
        { label: 'Show Summary', click: (_item, win) => win?.webContents.send('view:show', 'summary') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

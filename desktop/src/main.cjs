const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { startStaticServer } = require('./static-server.cjs');
const { localDevelopmentOrigin, isAppUrl, isExternalUrl, canGrantPermission, canOpenWindowFrom } = require('./policy.cjs');

if (process.env.SCENEARIX_DESKTOP_PROFILE) app.setPath('userData', path.resolve(process.env.SCENEARIX_DESKTOP_PROFILE));
app.setAppUserModelId('app.scenearix.desktop');

let mainWindow; let tray; let quitting = false; let appOrigin; let staticServer;
const stateFile = path.join(app.getPath('userData'), 'window.json');
const offlineFile = path.join(__dirname, 'offline.html');
const controlsCss = fs.readFileSync(path.join(__dirname, 'window-controls.css'), 'utf8');

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
}
function sendWindowState() {
  if (!mainWindow?.isDestroyed()) mainWindow.webContents.send('scenearix:window-state', { maximized: mainWindow.isMaximized(), fullscreen: mainWindow.isFullScreen() });
}
function loadApp() { void mainWindow.loadURL(appOrigin).catch(() => mainWindow.loadFile(offlineFile)); }
function openExternal(url) { if (isExternalUrl(url)) void shell.openExternal(url); }

function createWindow() {
  let state = {};
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* First launch. */ }
  mainWindow = new BrowserWindow({
    title: 'SceneariX', frame: false, fullscreenable: true, show: false,
    width: Number.isFinite(state.width) ? Math.min(2560, Math.max(900, state.width)) : 1440,
    height: Number.isFinite(state.height) ? Math.min(1600, Math.max(650, state.height)) : 900,
    minWidth: 900, minHeight: 650, backgroundColor: '#08090b',
    icon: path.join(__dirname, '../assets/icon.ico'), autoHideMenuBar: true,
    webPreferences: { partition: 'persist:scenearix', preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false, backgroundThrottling: true }
  });
  if (state.maximized) mainWindow.maximize();
  const contents = mainWindow.webContents;
  contents.on('dom-ready', () => {
    const url = contents.getURL();
    if (isAppUrl(url, appOrigin) || url === pathToFileURL(offlineFile).href) void contents.insertCSS(controlsCss);
    sendWindowState();
  });
  contents.setWindowOpenHandler(({ url, referrer }) => {
    const openedByApp = canOpenWindowFrom(referrer?.url, appOrigin);
    if (openedByApp && isAppUrl(url, appOrigin)) void mainWindow.loadURL(url);
    else if (openedByApp) openExternal(url);
    return { action: 'deny' };
  });
  // Never let embedded content navigate the top-level app or launch that
  // destination externally. Legitimate app links use the guarded new-window
  // path above, where their SceneariX referrer can be verified.
  contents.on('will-navigate', (event, url) => { if (!isAppUrl(url, appOrigin)) event.preventDefault(); });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => { if (isMainFrame && code !== -3 && isAppUrl(url, appOrigin)) void mainWindow.loadFile(offlineFile); });
  contents.on('render-process-gone', () => void mainWindow.loadFile(offlineFile));
  for (const event of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) mainWindow.on(event, sendWindowState);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (event) => {
    const bounds = mainWindow.getNormalBounds();
    try { fs.writeFileSync(stateFile, JSON.stringify({ width: bounds.width, height: bounds.height, maximized: mainWindow.isMaximized() })); } catch { /* Non-critical preference. */ }
    if (!quitting && tray && !tray.isDestroyed()) { event.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  loadApp();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showWindow);
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => { if (staticServer) staticServer.close(); if (tray && !tray.isDestroyed()) tray.destroy(); });
  app.whenReady().then(async () => {
    const developmentOrigin = !app.isPackaged && localDevelopmentOrigin(process.env.SCENEARIX_DESKTOP_URL);
    if (developmentOrigin) appOrigin = developmentOrigin;
    else {
      const webRoot = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.resolve(__dirname, '../../build');
      if (!fs.existsSync(path.join(webRoot, 'index.html'))) throw new Error('The React production build is missing. Run npm run build first.');
      ({ server: staticServer, origin: appOrigin } = await startStaticServer(webRoot));
    }
    const browserSession = session.fromPartition('persist:scenearix');
    browserSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(canGrantPermission(permission, details.requestingUrl || contents.getURL(), appOrigin)));
    browserSession.setPermissionCheckHandler((_contents, permission, origin) => canGrantPermission(permission, origin, appOrigin));
    browserSession.on('will-download', (_event, item) => item.setSaveDialogOptions({ title: 'Save from SceneariX' }));
    ipcMain.on('scenearix:window-control', (event, action) => {
      if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame) return;
      const trusted = isAppUrl(event.senderFrame.url, appOrigin) || event.senderFrame.url === pathToFileURL(offlineFile).href;
      if (!trusted) return;
      if (action === 'minimize') mainWindow.minimize();
      if (action === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
      if (action === 'close') mainWindow.close();
      if (action === 'state') sendWindowState();
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'SceneariX', submenu: [{ label: 'Home', accelerator: 'Alt+Home', click: loadApp }, { type: 'separator' }, { role: 'quit' }] },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }, ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : [])] },
      { label: 'Help', submenu: [{ label: 'About SceneariX', click: () => dialog.showMessageBox(mainWindow, { type: 'info', title: 'SceneariX', message: `SceneariX Desktop ${app.getVersion()}`, detail: 'Movies, shows, ratings, and your watchlist in one app.' }) }] }
    ]));
    tray = new Tray(path.join(__dirname, '../assets/icon.ico'));
    tray.setToolTip('SceneariX — running in the background');
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open SceneariX', click: showWindow }, { type: 'separator' }, { label: 'Quit SceneariX', click: () => app.quit() }]));
    tray.on('click', showWindow);
    createWindow();
    app.on('activate', showWindow);
  }).catch((error) => { dialog.showErrorBox('SceneariX could not start', error.message); app.quit(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin' && quitting) app.quit(); });
}

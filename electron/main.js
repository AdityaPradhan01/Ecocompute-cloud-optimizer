// A real desktop widget — frameless, transparent, always-on-top, docked to
// a screen edge. This is the thing a browser window.open() popup can never
// be: no title bar, no close/minimize/maximize chrome, no taskbar entry.
// It loads the exact same /widget route the web app already serves (see
// frontend/src/pages/Widget.jsx) — same UI, same live data, same auth —
// just inside a native window instead of a browser tab. Nothing in the
// React app needs to know it's running here; this file does all the work.
const { app, BrowserWindow, Tray, Menu, screen, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Hand-rolled instead of a dependency (electron-store v10 is ESM-only and
// won't require() from this CommonJS file) — all that's actually needed is
// persisting two numbers across restarts.
const POSITION_FILE = path.join(app.getPath('userData'), 'widget-position.json');
const store = {
  get: () => { try { return JSON.parse(fs.readFileSync(POSITION_FILE, 'utf8')); } catch { return null; } },
  set: (pos) => { try { fs.writeFileSync(POSITION_FILE, JSON.stringify(pos)); } catch (err) { console.error('Could not save widget position:', err.message); } },
  clear: () => { try { fs.unlinkSync(POSITION_FILE); } catch { /* nothing to clear */ } }
};

// Where the widget route actually lives. Defaults to the local dev server;
// point this at a deployed frontend URL (e.g. https://acme-frontend.onrender.com/widget)
// to run the widget against a real customer instance instead of localhost.
// `?shell=electron` tells Widget.jsx to render a transparent backdrop
// instead of the gray one it uses as a browser-popup fallback — without
// it, the card would sit inside an opaque rectangle and the whole point
// of a transparent native window would be lost.
const WIDGET_BASE_URL = process.env.WIDGET_URL || 'http://localhost:3000/widget';
const WIDGET_URL = `${WIDGET_BASE_URL}${WIDGET_BASE_URL.includes('?') ? '&' : '?'}shell=electron`;
const ALLOWED_ORIGIN = new URL(WIDGET_BASE_URL).origin;

// A bit larger than the card itself (~312px wide) so its box-shadow has
// room to render instead of being clipped at the window's own edge.
const WINDOW_WIDTH = 344;
const WINDOW_HEIGHT = 512; // measured against real content height (card + its own padding) via a live CDP check — not guessed
const EDGE_MARGIN = 16;

let win = null;
let tray = null;

function defaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - WINDOW_WIDTH - EDGE_MARGIN),
    y: Math.round(workArea.y + (workArea.height - WINDOW_HEIGHT) / 2)
  };
}

function createWindow() {
  const saved = store.get();
  const pos = saved || defaultPosition();

  win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: pos.x,
    y: pos.y,
    frame: false,          // the whole point — no native title bar / min / max / close chrome
    transparent: true,     // lets the rounded card's own corners + shadow show the real desktop around it, not a white rectangle
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,     // real widgets don't get a taskbar button
    hasShadow: false,      // the card draws its own box-shadow; a second OS-level window shadow would double up
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // the loaded page cannot reach this process's require()/Node APIs — only what preload.js explicitly bridges (currently nothing)
      sandbox: true,          // Electron's own sandbox on top of contextIsolation — the renderer can't touch the filesystem even if the preload boundary were somehow bypassed
      nodeIntegration: false, // explicit, not just relying on the (correct) modern default
      webSecurity: true,      // same-origin policy stays enforced; never disable this to work around a CORS error
      allowRunningInsecureContent: false
    }
  });

  win.setAlwaysOnTop(true, 'floating');
  win.loadURL(WIDGET_URL);

  // The window is draggable (so it can be repositioned despite having no
  // title bar) via -webkit-app-region: drag, applied here rather than in
  // the React app — Widget.jsx stays unaware of whether it's running in a
  // browser tab or this native shell. Buttons/links get no-drag so clicks
  // still work.
  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS(`
      html, body { background: transparent !important; }
      body > div { -webkit-app-region: drag; }
      button, a { -webkit-app-region: no-drag; }
    `);
  });

  win.on('moved', () => {
    const [x, y] = win.getPosition();
    store.set({ x, y });
  });

  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide(); // closing just hides it — only the tray menu actually quits
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray-icon.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('EcoCompute Widget');

  const menu = Menu.buildFromTemplate([
    { label: 'Show widget', click: () => { win.show(); win.focus(); } },
    { label: 'Hide widget', click: () => win.hide() },
    { label: 'Reset position', click: () => { const p = defaultPosition(); win.setPosition(p.x, p.y); store.clear(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => { win.isVisible() ? win.hide() : (win.show(), win.focus()); });
}

// Electron's own security checklist: a renderer should never be able to
// navigate itself (or open a new window) to an origin other than the one
// it's meant to show — otherwise a malicious ad/redirect/compromised CDN
// on the loaded page could walk this native, elevated-trust window
// somewhere else entirely. There's exactly one legitimate origin here.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (navEvent, url) => {
    if (new URL(url).origin !== ALLOWED_ORIGIN) navEvent.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    // The only place this fires today is the widget's "Open full
    // dashboard" link (target="_blank") — hand it to the user's real
    // browser instead of spawning another Electron window for it.
    try {
      if (new URL(url).origin === ALLOWED_ORIGIN) shell.openExternal(url);
    } catch { /* malformed url — just drop it */ }
    return { action: 'deny' };
  });
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', (e) => e.preventDefault()); // lives in the tray — never quits on its own

const { app, BrowserWindow, shell, ipcMain, clipboard } = require('electron');
const path = require('path');
const https = require('https');
const { autoUpdater } = require('electron-updater');

const BACKEND_URL = 'https://dependable-art-production.up.railway.app/log';
const API_KEY     = 'ryn-secret-2026';

/* Otomatik güncelleme ayarları */
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

/* Persistent userData path */
app.setPath('userData', path.join(app.getPath('appData'), 'RynSentinel'));

function postToBackend(data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const url  = new URL(BACKEND_URL);
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key':     API_KEY,
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({ success: false }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

ipcMain.handle('log-to-sheets', async (event, data) => {
  try { return await postToBackend(data); }
  catch (err) { console.error('Backend error:', err.message); return { success: false, error: err.message }; }
});

ipcMain.handle('copy-text', (event, text) => {
  try {
    clipboard.writeText(text);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-discord', (event, channelUrl) => {
  try {
    shell.openExternal(channelUrl);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('reset-clipboard-watcher', () => {
  lastClip = '';
  return { success: true };
});

/* ── CLIPBOARD WATCHER ── */
let lastClip = '';

function isProofUrl(text) {
  return /^https?:\/\/(prnt\.sc|prntscr\.com|gyazo\.com|medal\.tv|streamable\.com|imgur\.com)/i.test(text.trim());
}
function isCmdText(text) {
  return /^\/(temp)?(ban|mute)\s+\S+/i.test(text.trim());
}

function startClipboardWatcher(win) {
  setInterval(() => {
    try {
      const text = clipboard.readText().trim();
      if (!text || text === lastClip) return;
      lastClip = text;
      if (!win || win.isDestroyed()) return;
      /* Bizim output formatımızı tanı — algılama VE lastClip'i sıfırla */
      if (text.includes('> **') && (text.includes('RYN-') || text.includes('YETKILI') || text.includes('SEBEP'))) {
        setTimeout(() => { lastClip = ''; }, 100);
        return;
      }
      if (isProofUrl(text)) win.webContents.send('clipboard-proof', text);
      else if (isCmdText(text)) win.webContents.send('clipboard-cmd', text);
    } catch(e) {}
  }, 400);
}

/* ── WINDOW ── */
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Ryn Sentinel',
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      partition: 'persist:ryn-sentinel',
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  mainWindow.loadFile('ban-kanit-hazirlayici.html');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('discord://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('discord://')) { event.preventDefault(); shell.openExternal(url); }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    startClipboardWatcher(mainWindow);
    setTimeout(() => { try { autoUpdater.checkForUpdatesAndNotify(); } catch(e) {} }, 3000);
  });

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.executeJavaScript(`showToast('Yeni güncelleme bulundu! İndiriliyor...', '🔄');`).catch(()=>{});
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.executeJavaScript(`showToast('Güncelleme hazır! Uygulama kapanınca kurulacak.', '✅');`).catch(()=>{});
  });

  autoUpdater.on('error', (err) => { console.log('Güncelleme hatası:', err.message); });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });

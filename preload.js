const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  logToSheets: (data) => ipcRenderer.invoke('log-to-sheets', data),
  onClipboardProof: (cb) => ipcRenderer.on('clipboard-proof', (_e, url) => cb(url)),
  onClipboardCmd:   (cb) => ipcRenderer.on('clipboard-cmd',   (_e, cmd) => cb(cmd)),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),
  openDiscord: (url) => ipcRenderer.invoke('open-discord', url),
  installUpdate: () => ipcRenderer.invoke('install-update'),
});

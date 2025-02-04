// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    connectSpotify: () => ipcRenderer.invoke('auth:spotify'),
    getAuthStatus: () => ipcRenderer.invoke('auth:status')
  }
);
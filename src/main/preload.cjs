// src/main/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  connectSpotify: () => ipcRenderer.invoke("auth:spotify"),
  connectAppleMusic: () => ipcRenderer.invoke("auth:appleMusic"),
  getAuthStatus: () => ipcRenderer.invoke("auth:status"),
});

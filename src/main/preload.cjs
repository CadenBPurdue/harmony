// src/main/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  connectSpotify: () => {
    console.log("Calling connectSpotify from preload");
    return ipcRenderer.invoke("auth:spotify");
  },
  getAuthStatus: () => {
    console.log("Calling getAuthStatus from preload");
    return ipcRenderer.invoke("auth:status");
  },
});

console.log("APIs exposed");

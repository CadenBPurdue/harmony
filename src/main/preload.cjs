// src/main/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload script starting...");

// Add a test API that doesn't rely on IPC
contextBridge.exposeInMainWorld("testAPI", {
  ping: () => "pong",
});

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

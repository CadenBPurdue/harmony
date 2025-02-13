// src/main/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  connectSpotify: () => {
    console.log("Calling connectSpotify from preload");
    return ipcRenderer.invoke("auth:spotify");
  },
  connectAppleMusic: () => {
    console.log("Calling connectAppleMusic from preload");
    return ipcRenderer.invoke("auth:appleMusic");
  },
  getAuthStatus: () => {
    console.log("Calling getAuthStatus from preload");
    return ipcRenderer.invoke("auth:status");
  },
  sendAuthResult: (result) => {
    console.log("Sending auth result from preload");
    return ipcRenderer.invoke("auth:result", result);
  },
});

console.log("APIs exposed");

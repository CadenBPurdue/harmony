// src/main/preload.js
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  connectSpotify: () => ipcRenderer.invoke("auth:spotify"),
  getAuthStatus: () => ipcRenderer.invoke("auth:status"),
});

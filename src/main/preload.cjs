const { contextBridge, ipcRenderer, shell } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Spotify authentication
  connectSpotify: () => {
    console.log("Calling connectSpotify from preload");
    return ipcRenderer.invoke("auth:spotify");
  },

  // Apple Music authentication
  connectAppleMusic: () => {
    console.log("Calling connectAppleMusic from preload");
    return ipcRenderer.invoke("auth:appleMusic");
  },

  // Check authentication status
  getAuthStatus: () => {
    console.log("Calling getAuthStatus from preload");
    return ipcRenderer.invoke("auth:status");
  },

  // Send authentication result
  sendAuthResult: (result) => {
    console.log("Sending auth result from preload", result);
    return ipcRenderer.invoke("auth:result", result);
  },

  // Open external links in the default browser
  openExternal: (url) => {
    console.log("Opening external URL:", url);
    shell.openExternal(url);
  },

  // Google authentication via IPC
  signInWithGoogle: () => {
    console.log("Calling signInWithGoogle from preload");
    return ipcRenderer.invoke("auth:google");
  },
});

console.log("Preload script loaded and APIs exposed.");

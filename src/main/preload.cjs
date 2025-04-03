// src/main/preload.cjs
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

  // Firebase authentication
  connectFirebase: () => {
    console.log("Calling connectFirebase from preload");
    return ipcRenderer.invoke("auth:firebase");
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

  getSpotifyLibrary: () => {
    console.log("Calling getSpotifyLibrary from preload");
    return ipcRenderer.invoke("library:spotify");
  },

  getAppleMusicLibrary: (skipDetailsLoading) => {
    console.log("Calling getAppleMusicLibrary from preload");
    return ipcRenderer.invoke("library:appleMusic", skipDetailsLoading);
  },

  // Get Apple Music status
  getAppleMusicStatus: () => {
    console.log("Calling getAppleMusicStatus from preload");
    return ipcRenderer.invoke("getAppleMusicStatus");
  },

  onPlaylistLoaded: (callback) => {
    ipcRenderer.on("playlist-loaded", (event, playlistInfo) => {
      callback(playlistInfo);
    });
  },

  // Get a specific Apple Music playlist with full details
  getAppleMusicPlaylist: (playlistId) => {
    console.log("Calling getAppleMusicPlaylist from preload");
    return ipcRenderer.invoke("getAppleMusicPlaylist", playlistId);
  },

  transferToSpotify: (playlist) => {
    console.log("Calling transferToSpotify from preload");
    return ipcRenderer.invoke("transfer:spotify", playlist);
  },

  transferToAppleMusic: (playlist) => {
    console.log("Calling transferToAppleMusic from preload");
    return ipcRenderer.invoke("transfer:appleMusic", playlist);
  },

  transferPlaylistToFirebase: (playlist) => {
    console.log("Calling transferPlaylistToFirebase from preload");
    return ipcRenderer.invoke("firebase:writePlaylist", playlist);
  },

  getPlaylistsFromFirebase: () => {
    console.log("Calling getPlaylistFromFirebase from preload");
    return ipcRenderer.invoke("firebase:getPlaylist");
  },

  getPlaylistFromFirebase: (id) => {
    console.log("Calling getPlaylistFromFirebase from preload");
    return ipcRenderer.invoke("firebase:getPlaylist", id);
  },

  getUserInfoFromFirebase: (userId) => {
    console.log("Calling getUserInfoFromFirebase from preload");
    return ipcRenderer.invoke("firebase:getUserInfo", userId);
  },

  getUsersFromFirebase: () => {
    console.log("Calling getUsersFromFirebase from preload");
    return ipcRenderer.invoke("firebase:getUsers");
  },

  setSpotifyConnected: () => {
    console.log("Calling updateConnectedServices from preload");
    return ipcRenderer.invoke("firebase:setSpotifyConnected");
  },

  setAppleMusicConnected: () => {
    console.log("Calling updateConnectedServices from preload");
    return ipcRenderer.invoke("firebase:setAppleMusicConnected");
  },

  // Open external links in the default browser
  openExternal: (url) => {
    console.log("Opening external URL:", url);
    shell.openExternal(url);
  },

  setWindowMode: (isLoginPage) => {
    return ipcRenderer.invoke("window:setAppMode", isLoginPage);
  },
  onResizingStart: (callback) => {
    ipcRenderer.on("window:resizing-start", callback);
  },

  onResizingComplete: (callback) => {
    ipcRenderer.on("window:resizing-complete", callback);
  },
});

console.log("Preload script loaded and APIs exposed.");

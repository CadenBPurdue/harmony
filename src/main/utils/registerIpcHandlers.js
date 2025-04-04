// src/main/utils/registerIpcHandlers.js
import { ipcMain, shell } from "electron";
import { AppleMusicApi } from "./apple_music.js";
import {
  initiateSpotifyAuth,
  initiateAppleMusicAuth,
  getAuthStatus,
} from "./auth_manager.js";
import { configManager } from "./config.js";
import { authenticateWithFirebase } from "./firebase.js";
import {
  writePlaylistToFirestore,
  getPlaylistsFromFirestore,
  getSharedPlaylistsFromFirestore,
  getPlaylistFromFirestore,
} from "./firebaseHelper.js";
import { SpotifyApi } from "./spotify.js";

// Create instances that persist across calls
const appleMusicApi = new AppleMusicApi();
const spotifyApi = new SpotifyApi();

export function registerIpcHandlers() {
  ipcMain.on("open-external", (event, url) => {
    console.log("Opening external URL in main process:", url);
    shell.openExternal(url);
  });

  ipcMain.handle("auth:spotify", async () => {
    return await initiateSpotifyAuth();
  });

  ipcMain.handle("auth:status", () => {
    return getAuthStatus();
  });

  ipcMain.handle("firebase:writePlaylist", async (event, playlist) => {
    return await writePlaylistToFirestore(playlist);
  });

  ipcMain.handle("firebase:getPlaylist", async (event, playlistId) => {
    return await getPlaylistFromFirestore(playlistId);
  });

  ipcMain.handle("firebase:getPlaylists", async () => {
    return await getPlaylistsFromFirestore();
  });

  ipcMain.handle("config:setSpotifyCredentials", async (event, credentials) => {
    try {
      configManager.setCredentials("spotify", credentials);
      return { success: true };
    } catch (error) {
      console.error("Failed to save credentials:", error);
      throw error;
    }
  });

  ipcMain.handle("config:hasSpotifyCredentials", () => {
    return configManager.hasCredentials("spotify");
  });

  ipcMain.handle("config:clearSpotifyCredentials", () => {
    try {
      configManager.setCredentials("spotify", null);
      return { success: true };
    } catch (error) {
      console.error("Failed to clear credentials:", error);
      throw error;
    }
  });

  ipcMain.handle("auth:appleMusic", async () => {
    return await initiateAppleMusicAuth();
  });

  ipcMain.handle(
    "config:setAppleMusicCredentials",
    async (event, credentials) => {
      try {
        configManager.setCredentials("appleMusic", credentials);
        return { success: true };
      } catch (error) {
        console.error("Failed to save credentials:", error);
        throw error;
      }
    },
  );

  ipcMain.handle("config:hasAppleMusicCredentials", () => {
    return configManager.hasCredentials("appleMusic");
  });

  ipcMain.handle("config:clearAppleMusicCredentials", () => {
    try {
      configManager.setCredentials("appleMusic", null);
      return { success: true };
    } catch (error) {
      console.error("Failed to clear credentials:", error);
      throw error;
    }
  });

  ipcMain.handle("auth:firebase", async () => {
    try {
      await authenticateWithFirebase();
      return { success: true };
    } catch (error) {
      if (error.message === "Authentication window was closed by the user.") {
        console.warn("User cancelled Firebase authentication.");
        return { cancelled: true };
      }
      console.error("Firebase auth failed:", error);
      throw error;
    }
  });

  ipcMain.handle("library:spotify", async () => {
    await spotifyApi.initialize();
    return spotifyApi.getPlaylistLibrary();
  });

  ipcMain.handle("library:appleMusic", async (skipDetailsLoading = false) => {
    await appleMusicApi.initialize();
    return appleMusicApi.getPlaylistLibrary(skipDetailsLoading);
  });

  // Add a handler to get Apple Music loading status
  ipcMain.handle("getAppleMusicStatus", async () => {
    return appleMusicApi.getPlaylistLoadingStatus();
  });

  // Add a handler to get a specific Apple Music playlist
  ipcMain.handle("getAppleMusicPlaylist", async (event, playlistId) => {
    await appleMusicApi.initialize();
    return appleMusicApi.getPlaylist(playlistId);
  });

  ipcMain.handle("transfer:spotify", async (event, playlist) => {
    try {
      await spotifyApi.initialize();
      console.log(`Transferring "${playlist.name}" to Spotify`);
      const playlistId = await spotifyApi.createEmptyPlaylist(
        playlist.name,
        playlist.description,
      );
      await spotifyApi.populatePlaylist(playlistId, playlist);
      return { success: true };
    } catch (error) {
      console.error("Failed to transfer playlist:", error);
      throw error;
    }
  });

  ipcMain.handle("transfer:appleMusic", async (event, playlist) => {
    await appleMusicApi.initialize();
    console.log(`Transferring "${playlist.name}" to Apple Music`);
    const playlistId = await appleMusicApi.createEmptyPlaylist(
      playlist.name,
      playlist.description,
    );
    await appleMusicApi.populatePlaylist(playlistId, playlist);
    return { success: true };
  });
}

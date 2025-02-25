// src/main/utils/registerIpcHandlers.js
import { ipcMain, shell } from "electron";
import {
  initiateSpotifyAuth,
  initiateAppleMusicAuth,
  getAuthStatus,
} from "./auth_manager.js";
import { configManager } from "./config.js";
import { authenticateWithFirebase } from "./firebase.js";
import { writePlaylistToFirestore, getPlaylistsFromFirestore, getPlaylistFromFirestore } from "./firebaseHelper.js";

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
    // Fetch all playlists from Firestore
    await getPlaylistsFromFirestore().then((playlists) => {
      console.log("Fetched playlists:", playlists);
      playlists.forEach(async (playlistId) => {
        const playlist = await getPlaylistFromFirestore(playlistId);
        console.log("Fetched playlist:", playlist);
      });
    });

    return await writePlaylistToFirestore(playlist);
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
}

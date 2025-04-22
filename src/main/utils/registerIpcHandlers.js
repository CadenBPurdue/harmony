// src/main/utils/registerIpcHandlers.js
import { ipcMain, shell } from "electron";
import { send } from "vite";
import { AppleMusicApi } from "./apple_music.js";
import {
  initiateSpotifyAuth,
  initiateAppleMusicAuth,
  getAuthStatus,
} from "./auth_manager.js";
import { configManager } from "./config.js";
import {
  authenticateWithFirebase,
  updateConnectedSerives,
  updateFriendsList,
} from "./firebase.js";
import {
  writePlaylistToFirestore,
  getPlaylistsFromFirestore,
  getSharedPlaylistsFromFirestore,
  getPlaylistFromFirestore,
  getUsersFromFirestore,
  getUserFromFirestore,
  sendFriendRequest,
  getCurrentUserFromFirestore,
  acceptFriendRequest,
  denyFriendRequest,
  manageFriendRequests,
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

  ipcMain.handle("firebase:getUserInfo", async (event, userId) => {
    console.log("Fetching user info for ID:", userId);
    return await getUserFromFirestore(userId);
  });

  ipcMain.handle("firebase:getUsers", async () => {
    return await getUsersFromFirestore();
  });

  ipcMain.handle("firebase:getCurrentUser", async () => {
    return await getCurrentUserFromFirestore();
  });

  ipcMain.handle("firebase:setSpotifyConnected", async () => {
    return await updateConnectedSerives("spotify");
  });

  ipcMain.handle("firebase:setAppleMusicConnected", async () => {
    return await updateConnectedSerives("appleMusic");
  });

  ipcMain.handle("firebase:addFriend", async (event, friendId) => {
    return await updateFriendsList(friendId, false);
  });

  ipcMain.handle("firebase:removeFriend", async (event, friendId) => {
    return await updateFriendsList(friendId, true);
  });

  ipcMain.handle("firebase:acceptFriendRequest", async (event, requesterId) => {
    return await acceptFriendRequest(requesterId);
  });

  ipcMain.handle("firebase:denyFriendRequest", async (event, requesterId) => {
    return await denyFriendRequest(requesterId);
  });

  ipcMain.handle("firebase:getFriends", async () => {
    const user = await getCurrentUserFromFirestore();
    if (!user) {
      console.error("[Firebase] User is not authenticated");
      return [];
    }
    if (
      !user.friends ||
      !Array.isArray(user.friends) ||
      user.friends.length === 0
    ) {
      console.warn("[Firebase] No friends found for user");
      return [];
    }

    console.log("User friends:", user.friends);

    try {
      const friendsInfo = await Promise.all(
        user.friends.map(async (friendId) => {
          console.log("Fetching friend ID:", friendId);
          try {
            const friendData = await getUserFromFirestore(friendId);
            if (friendData) {
              console.log("Friend data fetched:", friendData);
              return friendData;
            } else {
              console.warn("No data found for friend ID:", friendId);
              return null;
            }
          } catch (error) {
            console.error(
              "Error fetching friend data for ID",
              friendId,
              ":",
              error,
            );
            return null;
          }
        }),
      );

      // Filter out any null values (failed fetches)
      const validFriendsInfo = friendsInfo.filter((friend) => friend !== null);
      return validFriendsInfo;
    } catch (error) {
      console.error("Error fetching friends data:", error);
      return [];
    }
  });

  ipcMain.handle("firebase:sendFriendRequest", async (event, friendId) => {
    return await sendFriendRequest(friendId);
  });

  ipcMain.handle("firebase:manageFriendRequests", async () => {
    return await manageFriendRequests();
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

  ipcMain.handle("debug:message", (event, message) => {
    console.log(message);
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

  ipcMain.handle("getSpotifyStatus", async () => {
    return spotifyApi.getPlaylistLoadingStatus();
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

      // First create the empty playlist
      const playlistId = await spotifyApi.createEmptyPlaylist(
        playlist.name,
        playlist.description,
      );

      // Then populate it
      const result = await spotifyApi.populatePlaylist(playlistId, playlist);

      // Return complete result to the renderer
      return {
        success: true,
        playlistId: playlistId,
        tracksAdded: result.tracksAdded || 0,
        totalTracks: result.totalTracks || 0,
        failedCount: result.failedCount || 0,
        failedSongs: result.failedSongs || [],
      };
    } catch (error) {
      console.error("Failed to transfer playlist:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle("transfer:appleMusic", async (event, playlist) => {
    await appleMusicApi.initialize();
    console.log(`Transferring "${playlist.name}" to Apple Music`);
    try {
      const playlistId = await appleMusicApi.createEmptyPlaylist(
        playlist.name,
        playlist.description,
      );
      const result = await appleMusicApi.populatePlaylist(playlistId, playlist);

      // Make sure we're passing ALL information back to the renderer
      return {
        success: true,
        playlistId: playlistId,
        tracksAdded: result.tracksAdded,
        totalTracks: result.totalTracks,
        failedCount: result.failedCount,
        failedSongs: result.failedSongs,
      };
    } catch (error) {
      console.error("Failed to transfer to Apple Music:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  });
}

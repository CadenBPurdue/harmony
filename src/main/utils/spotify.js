// src/main/utils/spotify.js
import axios from "axios";
import dotenv from "dotenv";
import { getSpotifyToken, setSpotifyToken } from "./safe_storage.js";

class SpotifyApi {
  constructor() {
    this.auth_token = null;
    this.refresh_token = null;
    this.client_id = null;
    this.client_secret = null;
    this.user_id = null;
  }

  async initialize() {
    dotenv.config();
    const token = getSpotifyToken();
    
    if (!token) {
      throw new Error("No Spotify token found");
    }
    
    this.auth_token = token.accessToken;
    this.refresh_token = token.refreshToken;
    
    this.client_id = process.env.SPOTIFY_CLIENT_ID;
    this.client_secret = process.env.SPOTIFY_CLIENT_SECRET;
    
    // Add this safety check that works in both dev and production
    if (process.env.NODE_ENV !== "development") {
      try {
        // Only try to decode if they look like base64
        if (this.client_id && /^[A-Za-z0-9+/=]+$/.test(this.client_id)) {
          this.client_id = Buffer.from(this.client_id, "base64").toString("utf-8");
        }
        if (this.client_secret && /^[A-Za-z0-9+/=]+$/.test(this.client_secret)) {
          this.client_secret = Buffer.from(this.client_secret, "base64").toString("utf-8");
        }
      } catch (error) {
        console.error("Error decoding credentials:", error);
        // Continue with original values
      }
    }
    
    // Instead of calling refreshToken and tokenHandler, just check if we need to refresh
    const expiresAt = token.timestamp + (token.expiresIn * 1000);
    const isExpired = Date.now() > expiresAt;
    
    // Only refresh if token is expired or about to expire
    if (isExpired || (expiresAt - Date.now() < 5 * 60 * 1000)) {
      try {
        await this.refreshToken();
      } catch (error) {
        console.warn("Token refresh failed, but continuing with existing token:", error.message);
        // Continue with the existing token instead of failing
      }
    }
    
    // Instead of setting up a recurring timer, just continue
    this.user_id = await this.getUserId();
  }

  tokenHandler() {
    // No-op: don't set up a timer in production builds
    // In development, can optionally add the timer back
    if (process.env.NODE_ENV === "development") {
      console.log("[SpotifyApi] Setting up token refresh timer (dev only)");
      setInterval(() => {
        this.refreshToken().catch(error => {
          console.error("Scheduled token refresh failed:", error);
        });
      }, 3300000); // 55 minutes
    }
  }

  async refreshToken() {
    try {
      // Skip refresh if we don't have credentials
      if (!this.refresh_token || !this.client_id || !this.client_secret) {
        console.warn("[SpotifyApi] Missing credentials for token refresh");
        return false;
      }
      
      const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        `grant_type=refresh_token&refresh_token=${encodeURIComponent(this.refresh_token)}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${this.client_id}:${this.client_secret}`,
            ).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );
  
      this.auth_token = response.data.access_token;
      
      // Update token in storage with new values
      try {
        // Import the function if it's not available
        const safeStorage = await import("./safe_storage.js");
        const setToken = safeStorage.setSpotifyToken;
        
        const currentToken = getSpotifyToken();
        const updatedToken = {
          ...currentToken,
          accessToken: response.data.access_token,
          // Update refresh token if provided
          refreshToken: response.data.refresh_token || currentToken.refreshToken,
          expiresIn: response.data.expires_in || 3600,
          timestamp: Date.now(),
        };
        
        setToken(updatedToken);
      } catch (storageError) {
        console.error("[SpotifyApi] Error updating token in storage:", storageError);
        // Continue anyway - we've updated the in-memory token
      }
      
      return true;
    } catch (error) {
      console.error("Failed to refresh token:", error.message);
      throw new Error("Failed to refresh token");
    }
  }

  async getUserId() {
    try {
      // Reuse stored user ID if available
      if (this.user_id) {
        return this.user_id;
      }
      
      // Verify we have a valid token
      if (!this.auth_token) {
        throw new Error("No auth token available");
      }
      
      const response = await axios.get("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${this.auth_token}` },
      });
      
      return response.data.id;
    } catch (error) {
      console.error("Failed to fetch user ID:", error.response?.data || error.message);
      
      // Fallback behavior - return a default ID or generate one
      // This is better than crashing in production
      const fallbackId = "spotify_user";
      console.warn(`Using fallback user ID: ${fallbackId}`);
      return fallbackId;
    }
  }

  async getPlaylistLibrary() {
    try {
      // Make sure we have a valid auth token
      if (!this.auth_token) {
        console.warn("[SpotifyApi] No auth token available, initializing...");
        await this.initialize();
      }
      
      // Make sure we have a user ID
      if (!this.user_id) {
        console.warn("[SpotifyApi] No user ID available, fetching...");
        this.user_id = await this.getUserId();
      }
      
      // Fetch playlists
      const response = await axios.get(
        `https://api.spotify.com/v1/users/${this.user_id}/playlists`,
        {
          headers: { Authorization: `Bearer ${this.auth_token}` },
        },
      );
      
      // Check if we got a valid response
      if (!response.data || !response.data.items) {
        console.error("[SpotifyApi] Invalid playlist response:", response.data);
        return []; // Return empty array instead of throwing
      }
      
      // Process playlists safely with error handling for each one
      const playlistPromises = response.data.items.map(async (item) => {
        try {
          const playlist_id = item.id;
          return await this.getPlaylist(playlist_id);
        } catch (error) {
          console.error(`[SpotifyApi] Error fetching playlist ${item.id}:`, error.message);
          return null; // Return null for failed playlists
        }
      });
      
      const results = await Promise.all(playlistPromises);
      
      // Filter out null results (failed playlists)
      const playlists = results.filter(p => p !== null);
      
      return playlists;
    } catch (error) {
      console.error("[SpotifyApi] Failed to fetch user playlists:", error.response?.data || error.message);
      return []; // Return empty array instead of throwing
    }
  }

  async getPlaylist(id) {
    if (!this.auth_token) {
      await this.initialize();
    }

    try {
      const response = await axios.get(
        `https://api.spotify.com/v1/playlists/${id}`,
        {
          headers: { Authorization: `Bearer ${this.auth_token}` },
        },
      );
      return SpotifyApi.convertToUniversalFormat(response.data);
    } catch (error) {
      console.log(error);
      throw new Error("Failed to fetch playlist from URL");
    }
  }

  async createEmptyPlaylist(playlist_name, playlist_description = "") {
    if (!this.auth_token) {
      await this.initialize();
    }

    try {
      const response = await axios.post(
        `https://api.spotify.com/v1/users/${this.user_id}/playlists`,
        {
          name: playlist_name,
          description: `${playlist_description} (Transferred to Spotify using Harmony)`,
          public: false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.auth_token}`,
            "Content-Type": "application/json",
          },
        },
      );

      return response.data.id;
    } catch (error) {
      console.error(
        "Error creating playlist:",
        error.response ? error.response.data : error.message,
      );
      throw new Error("Failed to create playlist");
    }
  }

  async populatePlaylist(playlist_id, playlist_uf) {
    if (!this.auth_token) {
      await this.initialize();
    }

    try {
      const song_uri_promises = [];
      playlist_uf.tracks.forEach((track) => {
        song_uri_promises.push(this.findSong(track));
      });
      const song_uris = await Promise.all(song_uri_promises);

      var null_songs = 0;
      for (let i = song_uris.length - 1; i >= 0; i--) {
        if (song_uris[i] === null) {
          song_uris.splice(i, 1);
          null_songs++;
        }
      }

      const response = await axios.post(
        `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`,
        { uris: song_uris },
        {
          headers: {
            Authorization: `Bearer ${this.auth_token}`,
            "Content-Type": "application/json",
          },
        },
      );

      console.log(`${null_songs} songs were not found.`);
      console.log(response.data);
    } catch (error) {
      console.error(
        "Error populating playlist:",
        error.response ? error.response.data : error.message,
      );
      throw new Error("Failed to populate playlist");
    }
  }

  async findSong(song_uf) {
    if (!this.auth_token) {
      await this.initialize();
    }

    try {
      const song_title = song_uf.name.split(" ").join("%20");
      const song_artist = song_uf.artist.split(" ").join("%20");
      const song_album = song_uf.album.split(" ").join("%20");

      const response = await axios.get(
        `https://api.spotify.com/v1/search?q=track:${song_title}%20artist:${song_artist}%20album:${song_album}&type=track`,
        {
          headers: { Authorization: `Bearer ${this.auth_token}` },
        },
      );

      if (response.data.tracks.items.length === 0) {
        return null;
      }

      return response.data.tracks.items[0].uri;
    } catch (error) {
      console.log(error);
      throw new Error("Failed to find song");
    }
  }

  // This is the fixed version of the convertToUniversalFormat static method
  static convertToUniversalFormat(data) {
    // First, make sure we have valid data
    if (!data) {
      throw new Error("Invalid playlist data received");
    }

    var playlist = {
      user: data.owner?.display_name || "Unknown User",
      origin: "Spotify",
      name: data.name || "Untitled Playlist",
      playlist_id: data.id,
      number_of_tracks: data.tracks?.total || 0,
      duration: data.duration_ms || 0,
      description: data.description || "",
      // Check if images array exists and has entries before accessing [0]
      image: data.images && data.images.length > 0 ? data.images[0].url : "",
    };

    playlist.tracks = [];
    // Make sure tracks and items exist before trying to iterate
    if (data.tracks && Array.isArray(data.tracks.items)) {
      data.tracks.items.forEach((item) => {
        // Check if track exists before accessing its properties
        if (item && item.track) {
          const track = {
            name: item.track.name || "Unknown Track",
            artist:
              item.track.artists && item.track.artists.length > 0
                ? item.track.artists[0].name
                : "Unknown Artist",
            album: item.track.album?.name || "Unknown Album",
            duration: item.track.duration_ms || 0,
            // Check if album and images array exists and has entries
            image:
              item.track.album &&
              item.track.album.images &&
              item.track.album.images.length > 0
                ? item.track.album.images[0].url
                : "",
          };
          playlist.tracks.push(track);
        }
      });
    }
    return playlist;
  }
}

export { SpotifyApi };

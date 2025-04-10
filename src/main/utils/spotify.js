// src/main/utils/spotify.js
import axios from "axios";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import {
  normalizeTrackTitle,
  normalizeArtistName,
  calculateSimilarity,
  scoreSongMatch,
  findBestMatch
} from "./match_scoring.js";
import { getSpotifyToken } from "./safe_storage.js";
// Import match_scoring utilities

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
          this.client_id = Buffer.from(this.client_id, "base64").toString(
            "utf-8",
          );
        }
        if (
          this.client_secret &&
          /^[A-Za-z0-9+/=]+$/.test(this.client_secret)
        ) {
          this.client_secret = Buffer.from(
            this.client_secret,
            "base64",
          ).toString("utf-8");
        }
      } catch (error) {
        console.error("Error decoding credentials:", error);
        // Continue with original values
      }
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const expiresAt = token.timestamp + token.expiresIn * 1000;
    const isExpired = Date.now() > expiresAt - 5 * 60 * 1000; // Consider it expired if less than 5 mins left

    if (isExpired) {
      console.log(
        "[SpotifyApi] Token expired or about to expire, refreshing...",
      );
      try {
        await this.refreshToken();
      } catch (error) {
        console.warn(
          "Token refresh failed, but continuing with existing token:",
          error.message,
        );
      }
    }

    this.user_id = await this.getUserId();
  }

  tokenHandler() {
    // No-op: don't set up a timer in production builds
    // In development, can optionally add the timer back
    if (process.env.NODE_ENV === "development") {
      console.log("[SpotifyApi] Setting up token refresh timer (dev only)");
      setInterval(() => {
        this.refreshToken().catch((error) => {
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
          refreshToken:
            response.data.refresh_token || currentToken.refreshToken,
          expiresIn: response.data.expires_in || 3600,
          timestamp: Date.now(),
        };

        setToken(updatedToken);
      } catch (storageError) {
        console.error(
          "[SpotifyApi] Error updating token in storage:",
          storageError,
        );
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
      console.error(
        "Failed to fetch user ID:",
        error.response?.data || error.message,
      );

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
          console.error(
            `[SpotifyApi] Error fetching playlist ${item.id}:`,
            error.message,
          );
          return null; // Return null for failed playlists
        }
      });

      const results = await Promise.all(playlistPromises);

      // Filter out null results (failed playlists)
      const playlists = results.filter((p) => p !== null);

      return playlists;
    } catch (error) {
      console.error(
        "[SpotifyApi] Failed to fetch user playlists:",
        error.response?.data || error.message,
      );
      return []; // Return empty array instead of throwing
    }
  }

  async getPlaylist(id) {
    if (!this.auth_token) {
      await this.initialize();
    }

    try {
      // Get the initial playlist data
      const response = await axios.get(
        `https://api.spotify.com/v1/playlists/${id}`,
        {
          headers: { Authorization: `Bearer ${this.auth_token}` },
        },
      );

      // Store the initial tracks
      let allTracks = response.data.tracks.items || [];
      let nextUrl = response.data.tracks.next;

      // Fetch additional tracks if there are more
      while (nextUrl) {
        console.log(`[SpotifyApi] Fetching more tracks from: ${nextUrl}`);

        const nextResponse = await axios.get(nextUrl, {
          headers: { Authorization: `Bearer ${this.auth_token}` },
        });

        // Add the new tracks to our collection
        if (nextResponse.data.items && nextResponse.data.items.length > 0) {
          allTracks = [...allTracks, ...nextResponse.data.items];
        }

        // Update the next URL for pagination
        nextUrl = nextResponse.data.next;

        // Add a small delay to avoid rate limiting
        if (nextUrl) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      console.log(
        `[SpotifyApi] Retrieved a total of ${allTracks.length} tracks for playlist ${id}`,
      );

      // Create a modified response with all tracks
      const fullResponse = {
        ...response.data,
        tracks: {
          ...response.data.tracks,
          items: allTracks,
          total: allTracks.length,
        },
      };

      return SpotifyApi.convertToUniversalFormat(fullResponse);
    } catch (error) {
      console.error(
        `[SpotifyApi] Error fetching playlist ${id}:`,
        error.response?.data || error.message,
      );
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
      console.log(
        `[SpotifyApi] Starting population of playlist: ${playlist_id}`,
      );

      // Normalize tracks to ensure we have an array
      let tracksToProcess = [];
      if (Array.isArray(playlist_uf.tracks)) {
        tracksToProcess = playlist_uf.tracks;
      } else if (playlist_uf.tracks && typeof playlist_uf.tracks === "object") {
        // Convert object to array if needed
        tracksToProcess = Object.values(playlist_uf.tracks);
      }

      const totalTracks = tracksToProcess.length;
      console.log(`[SpotifyApi] Processing ${totalTracks} tracks`);

      // Track both successful and failed songs
      const song_uris = [];
      const failedSongs = [];
      
      // Helper function to delay execution
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      // Helper function to retry a function with exponential backoff
      const retryWithBackoff = async (
        fn,
        maxRetries = 3,
        initialDelay = 2000,
      ) => {
        let retries = 0;
        while (true) {
          try {
            return await fn();
          } catch (error) {
            retries++;
            if (retries > maxRetries || error.response?.status !== 429) {
              throw error; // Either too many retries or not a rate limit error
            }

            // Get retry-after header or use exponential backoff
            const retryAfter = error.response.headers["retry-after"]
              ? parseInt(error.response.headers["retry-after"]) * 1000
              : initialDelay * Math.pow(2, retries);

            console.log(
              `[SpotifyApi] Rate limited. Retrying after ${retryAfter}ms (retry ${retries}/${maxRetries})`,
            );
            await delay(retryAfter);
          }
        }
      };

      // Process songs in batches to avoid rate limiting
      const BATCH_SIZE = 3; // Process only 3 songs at a time
      const DELAY_MS = 1200; // Wait 1.2 seconds between batches
      
      for (let i = 0; i < tracksToProcess.length; i += BATCH_SIZE) {
        const batchTracks = tracksToProcess.slice(i, i + BATCH_SIZE);
        console.log(
          `[SpotifyApi] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tracksToProcess.length / BATCH_SIZE)}`,
        );

        // Process each track in the batch
        const batchPromises = batchTracks.map(async (track) => {
          try {
            // Use enhanced findSong method with match_scoring
            const result = await retryWithBackoff(
              () => this.findSong(track), 
              3,  // max retries
              2000 // initial delay
            );
            
            if (result && result.uri) {
              song_uris.push(result.uri);
              console.log(`[SpotifyApi] Found match for: ${track.name} by ${track.artist} (Score: ${result.score.toFixed(2)})`);
            } else {
              failedSongs.push({...track, reason: result?.reason || "No match found"});
              console.log(`[SpotifyApi] No match found for: ${track.name} by ${track.artist}`);
            }
          } catch (error) {
            console.error(`[SpotifyApi] Error finding song: ${track.name}`, error.message);
            failedSongs.push({...track, reason: `Error: ${error.message}`});
          }
        });

        // Wait for all tracks in this batch to be processed
        await Promise.all(batchPromises);

        // Add delay before processing the next batch (except for the last batch)
        if (i + BATCH_SIZE < tracksToProcess.length) {
          console.log(
            `[SpotifyApi] Waiting ${DELAY_MS}ms before next batch...`,
          );
          await delay(DELAY_MS);
        }
      }

      const null_songs = failedSongs.length;
      console.log(`[SpotifyApi] Found ${song_uris.length} valid songs`);
      console.log(`[SpotifyApi] Failed to find ${null_songs} songs`);

      // Only make API call if we have songs to add
      let apiResponse = null;

      if (song_uris.length > 0) {
        // Add tracks to playlist in batches of 100 (Spotify API limit)
        const SPOTIFY_BATCH_SIZE = 100;

        for (let i = 0; i < song_uris.length; i += SPOTIFY_BATCH_SIZE) {
          const uriBatch = song_uris.slice(i, i + SPOTIFY_BATCH_SIZE);
          console.log(
            `[SpotifyApi] Adding batch of ${uriBatch.length} tracks to playlist`,
          );

          // Use retry logic for the API call
          apiResponse = await retryWithBackoff(async () => {
            return await axios.post(
              `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`,
              { uris: uriBatch },
              {
                headers: {
                  Authorization: `Bearer ${this.auth_token}`,
                  "Content-Type": "application/json",
                },
              },
            );
          });

          console.log(`[SpotifyApi] Successfully added batch to playlist`);

          // Add delay between batches to avoid rate limiting
          if (i + SPOTIFY_BATCH_SIZE < song_uris.length) {
            console.log(`[SpotifyApi] Waiting before adding next batch...`);
            await delay(1000);
          }
        }

        console.log(
          `[SpotifyApi] Successfully added all ${song_uris.length} tracks to playlist`,
        );
      } else {
        console.log(`[SpotifyApi] No tracks to add to playlist`);
      }

      // Return detailed result with proper error tracking
      return {
        success: true,
        response: apiResponse ? apiResponse.data : null,
        tracksAdded: song_uris.length,
        totalTracks: totalTracks,
        failedCount: null_songs,
        failedSongs: failedSongs,
        null_songs: null_songs, // Keep for backward compatibility
      };
    } catch (error) {
      console.error(
        "[SpotifyApi] Error populating playlist:",
        error.response ? error.response.data : error.message,
      );
      throw new Error(
        "Failed to populate playlist: " + (error.message || "Unknown error"),
      );
    }
  }

  // Updated findSong method that uses match_scoring.js
  async findSong(song_uf) {
    if (!this.auth_token) {
      await this.initialize();
    }

    try {
      // Normalize the search query
      const normalizedTitle = normalizeTrackTitle(song_uf.name);
      const normalizedArtist = normalizeArtistName(song_uf.artist);
      
      // Build the search query - try different strategies
      // Strategy 1: Use Spotify's field-specific search (most accurate)
      const encodeSafeComponent = (str) => {
        if (!str) return "";
        return encodeURIComponent(str.trim())
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29")
          .replace(/\'/g, "%27");
      };
      
      const fieldSearchQuery = `track:${encodeSafeComponent(normalizedTitle)} artist:${encodeSafeComponent(normalizedArtist)}`;
      
      // Strategy 2: Plain text search (sometimes catches things field search misses)
      const plainSearchQuery = `${encodeSafeComponent(normalizedTitle)} ${encodeSafeComponent(normalizedArtist)}`;
      
      // First try field search
      console.log(`[SpotifyApi] Searching for "${normalizedTitle}" by "${normalizedArtist}"`);
      let response = await axios.get(
        `https://api.spotify.com/v1/search?q=${fieldSearchQuery}&type=track&limit=5`,
        {
          headers: { Authorization: `Bearer ${this.auth_token}` },
        },
      );
      
      let tracks = response.data?.tracks?.items || [];
      
      // If no results, try plan text search
      if (tracks.length === 0) {
        console.log(`[SpotifyApi] No results with field search, trying plain text search`);
        response = await axios.get(
          `https://api.spotify.com/v1/search?q=${plainSearchQuery}&type=track&limit=10`,
          {
            headers: { Authorization: `Bearer ${this.auth_token}` },
          }
        );
        tracks = response.data?.tracks?.items || [];
      }
      
      if (tracks.length === 0) {
        return { 
          uri: null,
          score: 0,
          reason: "No matches found in Spotify catalog" 
        };
      }
      
      // Convert Spotify tracks to format for scoring
      const candidates = tracks.map(track => ({
        name: track.name,
        artist: track.artists[0].name,
        album: track.album.name,
        duration: track.duration_ms,
        uri: track.uri,
        id: track.id,
        popularity: track.popularity
      }));
      
      // Score each candidate
      const scoredCandidates = candidates.map(candidate => {
        const result = scoreSongMatch(
          candidate, 
          song_uf,
          {
            nameWeight: 0.45,
            artistWeight: 0.4,
            durationWeight: 0.05,
            albumWeight: 0.1
          }
        );
        
        return {
          ...result,
          uri: candidate.uri,
          id: candidate.id,
          popularity: candidate.popularity
        };
      });
      
      // Sort by score
      scoredCandidates.sort((a, b) => b.score - a.score);
      
      // Find the best match with a score above threshold
      const bestMatch = scoredCandidates[0];
      
      if (bestMatch && bestMatch.score >= 0.6) {
        return {
          uri: bestMatch.uri,
          id: bestMatch.id,
          score: bestMatch.score,
          matchDetails: bestMatch.details
        };
      }
      
      // If we have a high popularity match with decent score, use it
      const popularMatch = scoredCandidates.find(c => c.popularity > 60 && c.score > 0.5);
      if (popularMatch) {
        return {
          uri: popularMatch.uri,
          id: popularMatch.id,
          score: popularMatch.score,
          matchDetails: popularMatch.details
        };
      }
      
      // No good matches
      return { 
        uri: null, 
        score: bestMatch ? bestMatch.score : 0,
        reason: bestMatch ? `Best match score (${bestMatch.score.toFixed(2)}) below threshold` : "No matches found"
      };
    } catch (error) {
      // If error is rate limiting (429), let caller handle it for retry
      if (error.response && error.response.status === 429) {
        throw error;
      }

      console.error("Failed to find song:", error.message);
      return { uri: null, score: 0, reason: `Search error: ${error.message}` };
    }
  }

  // This is the fixed version of the convertToUniversalFormat static method
  static convertToUniversalFormat(data) {
    // First, make sure we have valid data
    if (!data) {
      throw new Error("Invalid playlist data received");
    }

    var playlist = {
      id: data.id,
      user: data.owner?.display_name || "Unknown User",
      origin: "Spotify",
      name: data.name,
      numberOfTracks: data.tracks.total,
      duration: 0,
      description: data.description,
      image: data.images[0].url,
    };

    var totalDuration = 0;
    playlist.tracks = [];
    // Make sure tracks and items exist before trying to iterate
    if (data.tracks && Array.isArray(data.tracks.items)) {
      data.tracks.items.forEach((item) => {
        // Check if track exists before accessing its properties
        if (item && item.track) {
          totalDuration += item.track.duration_ms;
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

    playlist.duration = totalDuration;
    playlist.sharedWith = [];
    return playlist;
  }
}

export { SpotifyApi };
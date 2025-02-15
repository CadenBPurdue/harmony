// src/main/utils/apple_music.js
import axios from "axios";
import { getAppleMusicToken } from "./safe_storage.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processBatch(items, batchSize, delayMs, processItem) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processItem));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await delay(delayMs);
    }
  }
  return results;
}

class AppleMusicApi {
  constructor() {
    this.developerToken = null;
    this.userToken = null;
    this.storefront = "us";
    this.api = null;
  }

  async initialize() {
    const tokens = await getAppleMusicToken();
    if (!tokens || !tokens.token || !tokens.userToken) {
      throw new Error("Apple Music tokens not found");
    }

    this.developerToken = tokens.token;
    this.userToken = tokens.userToken;

    this.api = axios.create({
      baseURL: "https://api.music.apple.com",
      headers: {
        "Authorization": `Bearer ${this.developerToken}`,
        "Music-User-Token": this.userToken,
        "Content-Type": "application/json",
      },
    });
  }

  async getPlaylistLibrary() {
    if (!this.api) {
      await this.initialize();
    }

    try {
      console.log("[AppleMusicApi] Fetching playlist library...");
      const response = await this.api.get("/v1/me/library/playlists");
      const playlists = response.data.data;

      console.log(
        `[AppleMusicApi] Found ${playlists.length} playlists. Processing in batches...`,
      );

      // Process playlists in batches of 2 with a 1-second delay between batches
      const processedPlaylists = await processBatch(
        playlists,
        2, // Batch size
        1000, // 1 second delay between batches
        async (playlist) => {
          try {
            console.log(
              `[AppleMusicApi] Fetching tracks for playlist: ${playlist.attributes?.name}`,
            );
            const tracksResponse = await this.api.get(
              `/v1/me/library/playlists/${playlist.id}/tracks`,
            );

            const tracks = {};
            tracksResponse.data.data.forEach((track) => {
              tracks[track.id] = {
                name: track.attributes?.name || "",
                artist: track.attributes?.artistName || "",
                album: track.attributes?.albumName || "",
                duration: track.attributes?.durationInMillis || 0,
                image:
                  track.attributes?.artwork?.url?.replace(
                    "{w}x{h}",
                    "300x300",
                  ) || "",
              };
            });

            const totalDuration = Object.values(tracks).reduce(
              (sum, track) => sum + (track.duration || 0),
              0,
            );

            return {
              user: this.userToken,
              origin: "apple music",
              name: playlist.attributes?.name || "",
              playlist_id: playlist.id,
              number_of_tracks: Object.keys(tracks).length,
              duration: totalDuration,
              description: playlist.attributes?.description?.standard || "",
              image:
                playlist.attributes?.artwork?.url?.replace(
                  "{w}x{h}",
                  "300x300",
                ) || "",
              tracks: tracks,
            };
          } catch (error) {
            console.error(
              `[AppleMusicApi] Error processing playlist ${playlist.id}:`,
              error.message,
            );
            return null;
          }
        },
      );

      // Filter out any null results from failed playlist processing
      return processedPlaylists.filter((playlist) => playlist !== null);
    } catch (error) {
      console.error(
        "[AppleMusicApi] Failed to get playlist library:",
        error.response?.data || error,
      );
      throw error;
    }
  }

  async getPlaylist(input) {
    if (!this.api) {
      await this.initialize();
    }

    try {
      console.log("[AppleMusicApi] Getting playlist details for:", input);

      // Extract playlist ID from input
      let playlistId = input;

      if (input.includes("music.apple.com")) {
        const urlParts = input.split("/");
        playlistId = urlParts[urlParts.length - 1];
        console.log("[AppleMusicApi] Extracted ID from URL:", playlistId);
      }

      if (input.startsWith("apple:playlist:")) {
        playlistId = input.split(":")[2];
        console.log("[AppleMusicApi] Extracted ID from URI:", playlistId);
      }

      console.log("[AppleMusicApi] Fetching playlist metadata...");
      const playlistResponse = await this.api.get(
        `/v1/me/library/playlists/${playlistId}`,
      );
      const playlist = playlistResponse.data.data[0];

      console.log("[AppleMusicApi] Fetching playlist tracks...");
      const tracksResponse = await this.api.get(
        `/v1/me/library/playlists/${playlistId}/tracks`,
      );

      const tracks = {};
      tracksResponse.data.data.forEach((track) => {
        tracks[track.id] = {
          name: track.attributes?.name || "",
          artist: track.attributes?.artistName || "",
          album: track.attributes?.albumName || "",
          duration: track.attributes?.durationInMillis || 0,
          image:
            track.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") || "",
        };
      });

      const totalDuration = Object.values(tracks).reduce(
        (sum, track) => sum + (track.duration || 0),
        0,
      );

      const response = {
        user: this.userToken,
        origin: "apple music",
        name: playlist.attributes?.name || "",
        playlist_id: playlist.id,
        number_of_tracks: Object.keys(tracks).length,
        duration: totalDuration,
        description: playlist.attributes?.description?.standard || "",
        image:
          playlist.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") ||
          "",
        tracks: tracks,
      };

      return response;
    } catch (error) {
      console.error(
        "[AppleMusicApi] Failed to get playlist:",
        error.response?.data || error,
      );
      throw error;
    }
  }

  async FindSong(query, limit = 25) {
    if (!this.api) {
      await this.initialize();
    }

    try {
      const response = await this.api.get(`/v1/catalog/${this.storefront}/search`, {
        params: {
          term: query,
          types: 'songs',
          limit: limit
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to find song:', error);
      throw error;
    }
  }

  async CreatePlaylist(name, description = '') {
    if (!this.api) {
      await this.initialize();
    }

    try {
      const response = await this.api.post('/v1/me/library/playlists', {
        attributes: {
          name,
          description
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create playlist:', error);
      throw error;
    }
  }

  async PopulatePlaylist(id, tracks) {
    if (!this.api) {
      await this.initialize();
    }

    try {
      const response = await this.api.post(`/v1/me/library/playlists/${id}/tracks`, {
        data: tracks.map(track => ({
          id: track.id,
          type: 'songs'
        }))
      });
      return response.data;
    } catch (error) {
      console.error('Failed to populate playlist:', error);
      throw error;
    }
  }
}

const appleMusicApi = new AppleMusicApi();
export { appleMusicApi };

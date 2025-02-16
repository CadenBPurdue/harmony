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
      baseURL: "https://api.music.apple.com",
      headers: {
        Authorization: `Bearer ${this.developerToken}`,
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

      const tracks = {};

      try {
        console.log("[AppleMusicApi] Fetching playlist tracks...");
        const tracksResponse = await this.api.get(
          `/v1/me/library/playlists/${playlistId}/tracks`,
        );

        if (tracksResponse.data && tracksResponse.data.data) {
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
        }
      } catch (error) {
        if (error.response?.status !== 404) {
          throw error;
        }
        console.log("[AppleMusicApi] No tracks found (empty playlist)");
      }

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

  calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;

    let matchCount = 0;
    const words1 = s1.split(" ");
    const words2 = s2.split(" ");

    for (const word1 of words1) {
      if (
        words2.some((word2) => word2.includes(word1) || word1.includes(word2))
      ) {
        matchCount++;
      }
    }

    return matchCount / Math.max(words1.length, words2.length);
  }

  async findSong(songUF) {
    if (!this.api) {
      await this.initialize();
    }

    try {
      console.log(
        "[AppleMusicApi] Searching for song:",
        JSON.stringify(songUF, null, 2),
      );

      if (!songUF.name || !songUF.artist) {
        throw new Error("Song name and artist are required");
      }

      const searchQuery = `${songUF.name} ${songUF.artist}`;
      console.log("[AppleMusicApi] Search query:", searchQuery);

      const response = await this.api.get(
        `/v1/catalog/${this.storefront}/search`,
        {
          params: {
            term: searchQuery,
            types: "songs",
            limit: 5,
          },
        },
      );

      if (!response.data.results.songs) {
        console.log("[AppleMusicApi] No songs found");
        return null;
      }

      const songs = response.data.results.songs.data;
      console.log(`[AppleMusicApi] Found ${songs.length} potential matches`);

      const scoredResults = songs.map((song) => {
        const nameExactMatch =
          song.attributes.name.toLowerCase() === songUF.name.toLowerCase()
            ? 1
            : 0;
        const artistExactMatch =
          song.attributes.artistName.toLowerCase() ===
          songUF.artist.toLowerCase()
            ? 1
            : 0;

        const nameScore = this.calculateSimilarity(
          song.attributes.name,
          songUF.name,
        );
        const artistScore = this.calculateSimilarity(
          song.attributes.artistName,
          songUF.artist,
        );
        const albumScore = songUF.album
          ? this.calculateSimilarity(song.attributes.albumName, songUF.album)
          : 1;

        const totalScore =
          nameExactMatch * 0.2 +
          nameScore * 0.2 +
          (artistExactMatch * 0.2 + artistScore * 0.2) +
          albumScore * 0.2;

        let durationMatch = 1;
        if (songUF.duration && song.attributes.durationInMillis) {
          const durationDiff = Math.abs(
            song.attributes.durationInMillis - songUF.duration,
          );
          const durationDiffPercent = durationDiff / songUF.duration;
          if (durationDiffPercent > 0.1) {
            durationMatch = 0.5;
          }
        }

        const finalScore = totalScore * durationMatch;

        return {
          id: song.id,
          score: finalScore,
          attributes: song.attributes,
          matches: {
            nameExact: nameExactMatch === 1,
            artistExact: artistExactMatch === 1,
            namePartial: nameScore,
            artistPartial: artistScore,
            albumMatch: albumScore,
            durationMatch,
          },
        };
      });

      scoredResults.sort((a, b) => b.score - a.score);

      scoredResults.forEach((result) => {
        console.log("[AppleMusicApi] Match details:");
        console.log("Final Score:", result.score.toFixed(3));
        console.log("Name:", result.attributes.name);
        console.log("Artist:", result.attributes.artistName);
        console.log("Album:", result.attributes.albumName);
        console.log(
          "Match Breakdown:",
          JSON.stringify(result.matches, null, 2),
        );
      });

      const bestMatch = scoredResults[0];
      const matchThresholds = {
        minimumScore: 0.7,
        nameThreshold: 0.6,
        artistThreshold: 0.6,
      };

      if (
        bestMatch.score >= matchThresholds.minimumScore &&
        (bestMatch.matches.nameExact ||
          bestMatch.matches.namePartial >= matchThresholds.nameThreshold) &&
        (bestMatch.matches.artistExact ||
          bestMatch.matches.artistPartial >= matchThresholds.artistThreshold)
      ) {
        console.log("[AppleMusicApi] Match found!");
        console.log("ID:", bestMatch.id);
        console.log("Name:", bestMatch.attributes.name);
        console.log("Artist:", bestMatch.attributes.artistName);
        console.log("Score:", bestMatch.score.toFixed(3));
        return bestMatch.id;
      }

      console.log(
        "[AppleMusicApi] No suitable match found - scores below thresholds",
      );
      console.log("Required:", JSON.stringify(matchThresholds, null, 2));
      console.log(
        "Best match scores:",
        JSON.stringify(bestMatch.matches, null, 2),
      );
      return null;
    } catch (error) {
      console.error(
        "[AppleMusicApi] Error in findSong:",
        error.response?.data || error,
      );
      throw error;
    }
  }

  async createEmptyPlaylist(unifiedFormat) {
    if (!this.api) {
      await this.initialize();
    }

    try {
      if (!this.userToken) {
        throw new Error("User must be authenticated");
      }

      if (!unifiedFormat || !unifiedFormat.name) {
        throw new Error("Invalid unified format: missing name");
      }

      console.log(
        `[createEmptyPlaylist] Creating playlist with name: ${unifiedFormat.name}`,
      );
      const requestPayload = {
        attributes: {
          name: unifiedFormat.name,
          description: unifiedFormat.description || "",
        },
        relationships: {
          tracks: {
            data: [],
          },
        },
      };

      console.log(
        "[createEmptyPlaylist] Request payload:",
        JSON.stringify(requestPayload, null, 2),
      );

      const response = await this.api.post(
        "/v1/me/library/playlists",
        requestPayload,
      );

      if (!response.data || !response.data.data || !response.data.data[0]) {
        throw new Error("Invalid response format from Apple Music API");
      }

      const playlistId = response.data.data[0].id;
      console.log(
        `[createEmptyPlaylist] Successfully created playlist with ID: ${playlistId}`,
      );

      // Add a delay to allow for API propagation
      await new Promise((resolve) => setTimeout(resolve, 5000));

      return playlistId;
    } catch (error) {
      console.error(
        "[createEmptyPlaylist] Error:",
        error.response?.data || error,
      );
      throw error;
    }
  }

  async populatePlaylist(playlistId, unifiedFormat) {
    if (!this.api) {
      await this.initialize();
    }

    console.log(
      `[PopulatePlaylist] Starting population of playlist: ${playlistId}`,
    );
    console.log(
      `[PopulatePlaylist] Number of tracks to process: ${Object.keys(unifiedFormat.tracks).length}`,
    );

    try {
      // Convert UF tracks to catalog IDs
      const trackEntries = Object.entries(unifiedFormat.tracks);

      // Process tracks in batches of 5 with 1 second delay between batches
      const processedTracks = await processBatch(
        trackEntries,
        5,
        1000,
        async ([trackInfo]) => {
          try {
            const catalogId = await this.findSong(trackInfo);
            if (catalogId) {
              return {
                id: catalogId,
                type: "songs",
              };
            }
            console.log(
              `[PopulatePlaylist] No match found for: ${trackInfo.name} by ${trackInfo.artist}`,
            );
            return null;
          } catch (error) {
            console.error(
              `[PopulatePlaylist] Error finding song: ${trackInfo.name}`,
              error,
            );
            return null;
          }
        },
      );

      // Filter out null results and prepare the tracks array
      const validTracks = processedTracks.filter((track) => track !== null);
      console.log(
        `[PopulatePlaylist] Found ${validTracks.length} matching tracks in Apple Music catalog`,
      );

      if (validTracks.length === 0) {
        throw new Error("No matching tracks found in Apple Music catalog");
      }

      // Add tracks to playlist in batches of 25
      for (let i = 0; i < validTracks.length; i += 25) {
        const batch = validTracks.slice(
          i,
          Math.min(i + 25, validTracks.length),
        );
        console.log(
          `[PopulatePlaylist] Adding batch of ${batch.length} tracks (${i + 1}-${i + batch.length})`,
        );

        await this.api.post(
          `/v1/me/library/playlists/${playlistId}/tracks`,
          batch,
        );

        // Add delay between batches
        if (i + 25 < validTracks.length) {
          await delay(1000);
        }
      }

      console.log(
        `[PopulatePlaylist] Successfully added ${validTracks.length} tracks to playlist`,
      );
      return {
        success: true,
        tracksAdded: validTracks.length,
        totalTracks: trackEntries.length,
      };
    } catch (error) {
      console.error("[PopulatePlaylist] Error:", error.response?.data || error);
      throw error;
    }
  }
}

const appleMusicApi = new AppleMusicApi();
export { appleMusicApi };

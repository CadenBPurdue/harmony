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
    this.isLoadingDetails = false;

    // Loaded playlists storage
    this.loadedPlaylists = new Map();

    // Progress tracking
    this.loadingProgress = {
      total: 0,
      loaded: 0,
      isComplete: false,
    };
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
        Authorization: `Bearer ${this.developerToken}`,
        "Music-User-Token": this.userToken,
        "Content-Type": "application/json",
      },
    });
  }

  async getPlaylistLibrary(skipDetailsLoading = false) {
    if (!this.api) {
      await this.initialize();
    }

    try {
      console.log("[AppleMusicApi] Fetching playlist library...");
      const response = await this.api.get("/v1/me/library/playlists", {
        params: {
          limit: 100,
        },
      });
      const playlists = response.data.data;

      console.log(`[AppleMusicApi] Found ${playlists.length} playlists`);

      // Set up loading progress tracking
      this.loadingProgress = {
        total: playlists.length,
        loaded: 0,
        isComplete: false,
      };

      // Create playlist objects
      const playlistObjects = playlists.map((playlist) => {
        const playlistId = playlist.id;

        // Check if we've already loaded this playlist
        if (this.loadedPlaylists.has(playlistId)) {
          const loadedData = this.loadedPlaylists.get(playlistId);
          this.loadingProgress.loaded += 1;

          return {
            origin: "Apple Music",
            name: playlist.attributes?.name || "",
            playlist_id: playlistId,
            number_of_tracks: loadedData.trackCount || 0,
            duration: loadedData.duration || 0,
            description: playlist.attributes?.description?.standard || "",
            image:
              playlist.attributes?.artwork?.url?.replace(
                "{w}x{h}",
                "300x300",
              ) || "",
            // Convert tracks from object to array
            tracks: loadedData.tracks ? Object.values(loadedData.tracks) : [],
            isLoading: false,
            loadError: false,
            // Properties from main version
            id: playlistId,
            numberOfTracks: loadedData.trackCount || 0,
            sharedWith: [],
          };
        }

        // Return basic info for unloaded playlists
        return {
          id: playlistId,
          name: playlist.attributes?.name || "",
          user: "", // info has to match firebase schema
          origin: "Apple Music",
          numberOfTracks: 0,
          duration: 0,
          description: playlist.attributes?.description?.standard || "",
          image:
            playlist.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") ||
            "",
          tracks: [], // Make sure this is an empty array
          isLoading: true,
          loadError: false,
          // Properties from main version
          id: playlistId,
          numberOfTracks: 0,
          sharedWith: [],
        };
      });

      // Update completion status
      if (this.loadingProgress.loaded === this.loadingProgress.total) {
        this.loadingProgress.isComplete = true;
      }

      // Start background loading if not explicitly skipped
      if (!this.isLoadingDetails) {
        console.log(
          "[AppleMusicApi] Starting immediate background load process",
        );
        this.loadPlaylistDetailsInBackground(playlists);
      }

      return playlistObjects;
    } catch (error) {
      console.error(
        "[AppleMusicApi] Failed to get playlist library:",
        error.response?.data || error,
      );
      throw error;
    }
  }

  // Helper function to fetch all tracks from a playlist with pagination
  async getAllPlaylistTracks(playlistId, limit = 100) {
    let allTracks = [];
    let nextUrl = `/v1/me/library/playlists/${playlistId}/tracks?limit=${limit}`;

    while (nextUrl) {
      try {
        const response = nextUrl.startsWith("http")
          ? await axios.get(nextUrl, {
              headers: {
                Authorization: `Bearer ${this.developerToken}`,
                "Music-User-Token": this.userToken,
                "Content-Type": "application/json",
              },
            })
          : await this.api.get(nextUrl);

        if (response.data && response.data.data) {
          allTracks = [...allTracks, ...response.data.data];
        }

        // Check if there's a next page
        nextUrl = null;
        if (response.data.next) {
          nextUrl = response.data.next;
          console.log(
            `[AppleMusicApi] Loading next page of tracks: ${nextUrl}`,
          );
          // Add a small delay between pagination requests
          await delay(500);
        }
      } catch (error) {
        // If we get an error, log it and break the loop
        console.error(
          `[AppleMusicApi] Error fetching tracks: ${error.message}`,
        );
        break;
      }
    }

    return allTracks;
  }

  async loadPlaylistDetailsInBackground(playlists) {
    if (this.isLoadingDetails) {
      console.log("[AppleMusicApi] Background loading already in progress");
      return;
    }

    this.isLoadingDetails = true;
    console.log(
      `[AppleMusicApi] Starting background loading for ${playlists.length} playlists`,
    );

    try {
      // Filter out already loaded playlists
      const playlistsToLoad = playlists.filter(
        (p) => !this.loadedPlaylists.has(p.id),
      );
      console.log(
        `[AppleMusicApi] Need to load ${playlistsToLoad.length} playlists`,
      );

      if (playlistsToLoad.length === 0) {
        console.log("[AppleMusicApi] No playlists to load, all complete");
        this.loadingProgress.isComplete = true;
        this.isLoadingDetails = false;
        return;
      }

      // Process playlists in small batches
      let processedCount = 0;

      for (let i = 0; i < playlistsToLoad.length; i += 2) {
        const batch = playlistsToLoad.slice(i, i + 2);
        console.log(
          `[AppleMusicApi] Processing batch ${i / 2 + 1}: ${batch.map((p) => p.attributes?.name).join(", ")}`,
        );

        await Promise.all(
          batch.map(async (playlist) => {
            try {
              const playlistId = playlist.id;
              console.log(
                `[AppleMusicApi] Loading tracks for playlist: ${playlist.attributes?.name} (${playlistId})`,
              );

              // Check if this playlist exists
              try {
                // Try to get playlist metadata first to verify it exists
                await this.api.get(`/v1/me/library/playlists/${playlistId}`);
              } catch (error) {
                if (error.response && error.response.status === 404) {
                  console.log(
                    `[AppleMusicApi] Playlist ${playlist.attributes?.name} (${playlistId}) not found or inaccessible, marking as loaded with empty tracks`,
                  );

                  // Store an empty playlist to prevent future loading attempts
                  this.loadedPlaylists.set(playlistId, {
                    tracks: {},
                    trackCount: 0,
                    duration: 0,
                    notFound: true,
                  });

                  // Update progress
                  this.loadingProgress.loaded += 1;
                  processedCount += 1;

                  return; // Skip loading tracks
                }
                // For other errors, continue trying to load tracks
              }

              // Get all tracks with pagination
              const allTracks = await this.getAllPlaylistTracks(playlistId);

              // Process tracks
              const tracks = {};
              let totalDuration = 0;

              if (allTracks.length > 0) {
                console.log(
                  `[AppleMusicApi] Found ${allTracks.length} tracks in playlist ${playlist.attributes?.name}`,
                );

                allTracks.forEach((track) => {
                  const trackDuration = track.attributes?.durationInMillis || 0;
                  tracks[track.id] = {
                    name: track.attributes?.name || "",
                    artist: track.attributes?.artistName || "",
                    album: track.attributes?.albumName || "",
                    duration: trackDuration,
                    image:
                      track.attributes?.artwork?.url?.replace(
                        "{w}x{h}",
                        "300x300",
                      ) || "",
                  };
                  totalDuration += trackDuration;
                });
              } else {
                console.log(
                  `[AppleMusicApi] No tracks found in playlist ${playlist.attributes?.name}`,
                );
              }

              // Store loaded playlist data
              this.loadedPlaylists.set(playlistId, {
                tracks: tracks,
                trackCount: Object.keys(tracks).length,
                duration: totalDuration,
                isLoaded: true,
              });

              // Update progress
              this.loadingProgress.loaded += 1;
              processedCount += 1;

              console.log(
                `[AppleMusicApi] Successfully loaded playlist "${playlist.attributes?.name}" with ${Object.keys(tracks).length} tracks (Progress: ${this.loadingProgress.loaded}/${this.loadingProgress.total})`,
              );

              // Emit event for anyone listening for playlist loaded events
              if (global.playlistLoadedCallback) {
                global.playlistLoadedCallback({
                  id: playlistId,
                  origin: "Apple Music",
                  isLoaded: true,
                  trackCount: Object.keys(tracks).length,
                });
              }
            } catch (error) {
              console.error(
                `[AppleMusicApi] Error loading playlist ${playlist.id}:`,
                error.message,
              );

              // Store error state to prevent future loading attempts
              this.loadedPlaylists.set(playlist.id, {
                tracks: {},
                trackCount: 0,
                duration: 0,
                error: true,
                errorMessage: error.message,
              });

              // Mark as loaded anyway to update progress
              this.loadingProgress.loaded += 1;
              processedCount += 1;
            }
          }),
        );

        // Add delay between batches to avoid rate limiting
        if (i + 2 < playlistsToLoad.length) {
          console.log(
            `[AppleMusicApi] Waiting before processing next batch...`,
          );
          await delay(1000);
        }
      }

      console.log(
        `[AppleMusicApi] Background loading completed. Processed ${processedCount} playlists.`,
      );
      this.loadingProgress.isComplete =
        this.loadingProgress.loaded >= this.loadingProgress.total;
    } catch (error) {
      console.error(
        "[AppleMusicApi] Error in background loading process:",
        error,
      );
    } finally {
      this.isLoadingDetails = false;
    }
  }

  async getPlaylist(input) {
    if (!this.api) {
      await this.initialize();
    }

    try {
      console.log(`[AppleMusicApi] Getting playlist: ${input}`);

      // Extract playlist ID from input if it's a URL or URI (from main version)
      let playlistId = input;
      if (typeof input === "string") {
        if (input.includes("music.apple.com")) {
          const urlParts = input.split("/");
          playlistId = urlParts[urlParts.length - 1];
          console.log("[AppleMusicApi] Extracted ID from URL:", playlistId);
        } else if (input.startsWith("apple:playlist:")) {
          playlistId = input.split(":")[2];
          console.log("[AppleMusicApi] Extracted ID from URI:", playlistId);
        }
      }

      // Check if we already know this playlist doesn't exist or had an error
      if (this.loadedPlaylists.has(playlistId)) {
        const loadedData = this.loadedPlaylists.get(playlistId);

        if (loadedData.notFound) {
          console.log(
            `[AppleMusicApi] Playlist ${playlistId} was previously not found`,
          );
          throw new Error("Playlist not found");
        }

        if (loadedData.error) {
          console.log(
            `[AppleMusicApi] Playlist ${playlistId} previously had an error: ${loadedData.errorMessage}`,
          );
          if (loadedData.errorMessage.includes("404")) {
            throw new Error("Playlist not found");
          }
        }
      }

      // Get playlist metadata
      let playlistResponse;
      try {
        playlistResponse = await this.api.get(
          `/v1/me/library/playlists/${playlistId}`,
        );
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log(`[AppleMusicApi] Playlist ${playlistId} not found`);

          // Store in loaded playlists to avoid future attempts
          this.loadedPlaylists.set(playlistId, {
            tracks: {},
            trackCount: 0,
            duration: 0,
            notFound: true,
          });

          throw new Error("Playlist not found");
        }
        throw error;
      }

      const playlist = playlistResponse.data.data[0];

      // Check if we have already loaded tracks for this playlist
      if (this.loadedPlaylists.has(playlistId)) {
        const loadedData = this.loadedPlaylists.get(playlistId);
        console.log(
          `[AppleMusicApi] Using pre-loaded tracks for playlist: ${playlist.attributes?.name}`,
        );

        return {
          user: "", // info has to match firebase schema
          origin: "Apple Music",
          name: playlist.attributes?.name || "",
          id: playlistId,
          // Use loadedData instead of undefined tracks/totalDuration variables
          numberOfTracks: loadedData.trackCount, // Changed from Object.keys(tracks).length
          duration: loadedData.duration, // Changed from totalDuration
          description: playlist.attributes?.description?.standard || "",
          image:
            playlist.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") ||
            "",
          tracks: Object.values(loadedData.tracks), // Changed from Object.values(tracks)
          isLoading: false,
          loadError: false,
          numberOfTracks: loadedData.trackCount, // Changed from Object.keys(tracks).length
          sharedWith: [],
        };
      }

      // Get tracks if not already loaded
      console.log(
        `[AppleMusicApi] Loading tracks for playlist: ${playlist.attributes?.name}`,
      );

      // Get all tracks with pagination
      let allTracks;
      try {
        allTracks = await this.getAllPlaylistTracks(playlistId);
      } catch (error) {
        console.error(`[AppleMusicApi] Error loading tracks: ${error.message}`);
        allTracks = [];
      }

      // Process tracks
      const tracks = {};
      let totalDuration = 0;

      if (allTracks.length > 0) {
        console.log(`[AppleMusicApi] Found ${allTracks.length} tracks`);

        allTracks.forEach((track) => {
          const trackDuration = track.attributes?.durationInMillis || 0;
          tracks[track.id] = {
            name: track.attributes?.name || "",
            artist: track.attributes?.artistName || "",
            album: track.attributes?.albumName || "",
            duration: trackDuration,
            image:
              track.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") ||
              "",
          };
          totalDuration += trackDuration;
        });
      } else {
        console.log(
          `[AppleMusicApi] No tracks found in playlist ${playlist.attributes?.name}`,
        );
      }

      // Store for future use
      this.loadedPlaylists.set(playlistId, {
        tracks: tracks,
        trackCount: Object.keys(tracks).length,
        duration: totalDuration,
      });

      // Update progress if this was one of our tracked playlists
      if (!this.loadingProgress.isComplete) {
        this.loadingProgress.loaded += 1;
        if (this.loadingProgress.loaded >= this.loadingProgress.total) {
          this.loadingProgress.isComplete = true;
        }
      }

      return {
        origin: "Apple Music",
        name: playlist.attributes?.name || "",
        playlist_id: playlistId,
        number_of_tracks: Object.keys(tracks).length,
        duration: totalDuration,
        description: playlist.attributes?.description?.standard || "",
        image:
          playlist.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") ||
          "",
        tracks: tracks,
        isLoading: false,
        loadError: false,
        // Properties from main version
        id: playlistId,
        numberOfTracks: Object.keys(tracks).length,
        sharedWith: [],
      };
    } catch (error) {
      console.error(`[AppleMusicApi] Error getting playlist ${input}:`, error);

      return {
        origin: "Apple Music",
        name: "Error Loading Playlist",
        playlist_id: typeof input === "string" ? input : "unknown",
        number_of_tracks: 0,
        duration: 0,
        description: `Error: ${error.message}`,
        image: "",
        tracks: [], // <- Make sure this is an empty array, not an object
        isLoading: false,
        loadError: true,
        // Properties from main version
        id: typeof input === "string" ? input : "unknown",
        numberOfTracks: 0,
        sharedWith: [],
      };
    }
  }

  getPlaylistLoadingStatus() {
    return {
      total: this.loadingProgress.total,
      loaded: this.loadingProgress.loaded,
      isComplete: this.loadingProgress.isComplete,
      isLoading: this.isLoadingDetails,
    };
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
      if (!songUF.name || !songUF.artist) {
        throw new Error("Song name and artist are required");
      }

      const searchQuery = `${songUF.name} ${songUF.artist}`;

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
        return null;
      }

      const songs = response.data.results.songs.data;

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
        return bestMatch.id;
      }

      return null;
    } catch (error) {
      console.error(
        "[AppleMusicApi] Error in findSong:",
        error.response?.data || error,
      );
      throw error;
    }
  }

  async createEmptyPlaylist(playlistName, playlistDescription = "") {
    if (!this.api) {
      await this.initialize();
    }

    try {
      if (!this.userToken) {
        throw new Error("User must be authenticated");
      }

      if (!playlistName) {
        throw new Error("Invalid unified format: missing name");
      }

      const requestPayload = {
        attributes: {
          name: playlistName,
          description: playlistDescription || "",
        },
        relationships: {
          tracks: {
            data: [],
          },
        },
      };

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

    // Handle both object format and array format for tracks
    let trackEntries;
    if (Array.isArray(unifiedFormat.tracks)) {
      trackEntries = unifiedFormat.tracks.map((track) => ["track_id", track]);
      console.log(
        `[PopulatePlaylist] Number of tracks to process: ${trackEntries.length}`,
      );
    } else {
      trackEntries = Object.entries(unifiedFormat.tracks);
      console.log(
        `[PopulatePlaylist] Number of tracks to process: ${trackEntries.length}`,
      );
    }

    try {
      // Process tracks in batches of 5 with 1 second delay between batches
      const processedTracks = await processBatch(
        trackEntries,
        5,
        1000,
        async ([_, trackInfo]) => {
          try {
            console.log(
              `[PopulatePlaylist] Processing track: ${trackInfo.name} by ${trackInfo.artist}`,
            );
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

        await this.api.post(`/v1/me/library/playlists/${playlistId}/tracks`, {
          data: batch,
        });

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

export { AppleMusicApi };

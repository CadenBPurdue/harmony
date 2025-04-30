// src/main/utils/apple_music.js
import axios from "axios";
import { getPlaylistFromFirestore } from "./firebaseHelper.js";
import {
  normalizeTrackTitle,
  normalizeArtistName,
  areEquivalentTitles,
  scoreSongMatch,
  findExactMatch,
  findBestMatch,
} from "./match_scoring.js";
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
            user: "",
            playlist_id: playlistId,
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
            collabWith: [],
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
          collabWith: [],
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

  async getFreshPlaylistLibrary() {
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
  
      // Create array to hold completed playlist objects
      const playlistObjects = [];
  
      // Process each playlist one by one to get tracks
      for (const playlist of playlists) {
        const playlistId = playlist.id;
        
        try {
          // Fetch the tracks for this playlist
          console.log(`[AppleMusicApi] Fetching tracks for playlist: ${playlist.attributes?.name || playlistId}`);
          const tracksResponse = await this.api.get(`/v1/me/library/playlists/${playlistId}/tracks`, {
            params: {
              limit: 100,
            },
          });
          
          const tracks = tracksResponse.data.data || [];
          const tracksObj = {};
          let totalDuration = 0;
          
          // Process each track
          tracks.forEach(track => {
            const trackId = track.id;
            const milliseconds = track.attributes?.durationInMillis || 0;
            totalDuration += milliseconds;
            
            tracksObj[trackId] = {
              name: track.attributes?.name || "",
              artist: track.attributes?.artistName || "",
              album: track.attributes?.albumName || "",
              duration: milliseconds,
              image: track.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") || "",
            };
          });
          
          // Add the playlist with its tracks to the result array
          playlistObjects.push({
            origin: "Apple Music",
            name: playlist.attributes?.name || "",
            user: "",
            playlist_id: playlistId,
            duration: totalDuration,
            description: playlist.attributes?.description?.standard || "",
            image: playlist.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") || "",
            tracks: tracksObj,
            isLoading: false,
            loadError: false,
            // Properties from main version
            id: playlistId,
            numberOfTracks: tracks.length,
            sharedWith: [],
            collabWith: [],
          });
          
        } catch (trackError) {
          console.error(
            `[AppleMusicApi] Failed to get tracks for playlist ${playlistId}:`,
            trackError.response?.data || trackError
          );
          
          // Add the playlist with error status
          playlistObjects.push({
            origin: "Apple Music",
            name: playlist.attributes?.name || "",
            user: "",
            playlist_id: playlistId,
            duration: 0,
            description: playlist.attributes?.description?.standard || "",
            image: playlist.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") || "",
            tracks: {},
            isLoading: false,
            loadError: true,
            // Properties from main version
            id: playlistId,
            numberOfTracks: 0,
            sharedWith: [],
            collabWith: [],
          });
        }
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
          // console.log(
          //   `[AppleMusicApi] Loading next page of tracks: ${nextUrl}`,
          // );
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
    // console.log(
    //   `[AppleMusicApi] Starting background loading for ${playlists.length} playlists`,
    // );

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
        // console.log(
        //   `[AppleMusicApi] Processing batch ${i / 2 + 1}: ${batch.map((p) => p.attributes?.name).join(", ")}`,
        // );

        await Promise.all(
          batch.map(async (playlist) => {
            try {
              const playlistId = playlist.id;
              // console.log(
              //   `[AppleMusicApi] Loading tracks for playlist: ${playlist.attributes?.name} (${playlistId})`,
              // );

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
                // console.log(
                //   `[AppleMusicApi] Found ${allTracks.length} tracks in playlist ${playlist.attributes?.name}`,
                // );

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

              const playlistForFirebase = {
                id: playlistId,
                user: "",
                origin: "Apple Music",
                name: playlist.attributes?.name || "",
                numberOfTracks: Object.keys(tracks).length,
                duration: totalDuration,
                description: playlist.attributes?.description?.standard || "",
                image:
                  playlist.attributes?.artwork?.url?.replace(
                    "{w}x{h}",
                    "300x300",
                  ) || "",
                tracks: Object.values(tracks), // Convert tracks object to array
                sharedWith: [],
                collabWith: [],
              };

              if (
                global.electronAPI &&
                global.electronAPI.writePlaylistToFirestore
              ) {
                try {
                  const playlist = await getPlaylistFromFirestore(
                    playlistForFirebase.id,
                  );
                  if (playlist) {
                    playlistForFirebase.collabWith = playlist.collabWith;
                  }
                } catch {
                  console.log(
                    "[AppleMusicApi] Playlist not found in Firestore",
                  );
                }
                global.electronAPI
                  .writePlaylistToFirestore(playlistForFirebase)
                  .catch((err) =>
                    console.error(
                      `[AppleMusicApi] Error writing playlist ${playlistId} to Firebase:`,
                      err,
                    ),
                  );
              }

              // Update progress
              this.loadingProgress.loaded += 1;
              processedCount += 1;

              // console.log(
              //   `[AppleMusicApi] Successfully loaded playlist "${playlist.attributes?.name}" with ${Object.keys(tracks).length} tracks (Progress: ${this.loadingProgress.loaded}/${this.loadingProgress.total})`,
              // );

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
          // console.log(
          //   `[AppleMusicApi] Waiting before processing next batch...`,
          // );
          await delay(1000);
        }
      }
      // console.log(
      //   `[AppleMusicApi] Background loading completed. Processed ${processedCount} playlists.`,
      // );
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
      console.log(`[AppleMusicApi] Getting playlist: ${input}`); // Extract playlist ID from input if it's a URL or URI (from main version)

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
      } // Check if we already know this playlist doesn't exist or had an error

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
      } // Get playlist metadata

      let playlistResponse;
      try {
        playlistResponse = await this.api.get(
          `/v1/me/library/playlists/${playlistId}`,
        );
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log(`[AppleMusicApi] Playlist ${playlistId} not found`); // Store in loaded playlists to avoid future attempts

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

      const playlist = playlistResponse.data.data[0]; // Check if we have already loaded tracks for this playlist

      if (this.loadedPlaylists.has(playlistId)) {
        const loadedData = this.loadedPlaylists.get(playlistId);
        console.log(
          `[AppleMusicApi] Using pre-loaded tracks for playlist: ${playlist.attributes?.name}`,
        ); // Convert tracks to array if it's an object

        let tracksArray = [];
        if (loadedData.tracks) {
          // Ensure we have an array of tracks
          tracksArray = Object.values(loadedData.tracks);
        }

        return {
          user: "", // info has to match firebase schema
          origin: "Apple Music",
          name: playlist.attributes?.name || "",
          id: playlistId,
          numberOfTracks: loadedData.trackCount,
          duration: loadedData.duration,
          description: playlist.attributes?.description?.standard || "",
          image:
            playlist.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") ||
            "",
          tracks: tracksArray, // Always return as array
          isLoading: false,
          loadError: false,
          sharedWith: [],
          collabWith: [],
        };
      } // Get tracks if not already loaded

      console.log(
        `[AppleMusicApi] Loading tracks for playlist: ${playlist.attributes?.name}`,
      ); // Get all tracks with pagination

      let allTracks;
      try {
        allTracks = await this.getAllPlaylistTracks(playlistId);
      } catch (error) {
        console.error(`[AppleMusicApi] Error loading tracks: ${error.message}`);
        allTracks = [];
      } // Process tracks into an object first for internal storage

      const tracksObject = {};
      let totalDuration = 0;

      if (allTracks.length > 0) {
        console.log(`[AppleMusicApi] Found ${allTracks.length} tracks`);

        allTracks.forEach((track) => {
          const trackDuration = track.attributes?.durationInMillis || 0;
          tracksObject[track.id] = {
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
      } // Convert to array for return value

      const tracksArray = Object.values(tracksObject); // Store for future use (store both object and array)

      this.loadedPlaylists.set(playlistId, {
        tracks: tracksObject,
        tracksArray: tracksArray,
        trackCount: tracksArray.length,
        duration: totalDuration,
      }); // Update progress if this was one of our tracked playlists

      if (!this.loadingProgress.isComplete) {
        this.loadingProgress.loaded += 1;
        if (this.loadingProgress.loaded >= this.loadingProgress.total) {
          this.loadingProgress.isComplete = true;
        }
      }

      return {
        origin: "Apple Music",
        name: playlist.attributes?.name || "",
        user: "",
        playlist_id: playlistId,
        duration: totalDuration,
        description: playlist.attributes?.description?.standard || "",
        image:
          playlist.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") ||
          "",
        tracks: tracksArray, // Return as array
        isLoading: false,
        loadError: false, // Properties from main version
        id: playlistId,
        numberOfTracks: tracksArray.length,
        sharedWith: [],
        collabWith: [],
      };
    } catch (error) {
      console.error(`[AppleMusicApi] Error getting playlist ${input}:`, error);

      return {
        origin: "Apple Music",
        name: "Error Loading Playlist",
        user: "",
        playlist_id: typeof input === "string" ? input : "unknown",
        duration: 0,
        description: `Error: ${error.message}`,
        image: "",
        tracks: [], // Always return an empty array, not an object
        isLoading: false,
        loadError: true, // Properties from main version
        id: typeof input === "string" ? input : "unknown",
        numberOfTracks: 0,
        sharedWith: [],
        collabWith: [],
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

  async addSongsToPlaylist(playlistId, songs) {
    if (!this.api) {
      await this.initialize();
    }

    console.log(`[AppleMusicApi] Adding songs to playlist: ${playlistId}`);

    try {
      // Find song IDs
      const songIds = [];

      for (const song of songs) {
        const songId = await this.findSong(song);
        if (songId) {
          songIds.push({
            id: songId,
            type: "songs",
          });
        }
      }

      // Add songs to playlist
      if (songIds.length > 0) {
        await this.api.post(`/v1/me/library/playlists/${playlistId}/tracks`, {
          data: songIds,
        });
      }

      return {
        success: true,
        tracksAdded: songIds.length,
        totalTracks: songs.length,
      };
    } catch (error) {
      console.error("[AppleMusicApi] Error adding songs:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async findSong(songUF) {
    if (!this.api) {
      await this.initialize();
    }

    try {
      if (!songUF.name || !songUF.artist) {
        console.log("[AppleMusicApi] MATCH FAILED: Missing name or artist");
        return null;
      }

      // Normalize inputs
      const normalizedTitle = normalizeTrackTitle(songUF.name);
      const normalizedArtist = normalizeArtistName(songUF.artist);

      // Define search strategies
      const searchStrategies = [
        // Strategy 1: Standard search with normalized name and artist
        {
          name: "Standard search",
          query: `${normalizedTitle} ${normalizedArtist}`,
          limit: 15,
        },
        // Strategy 2: Artist search with title filtering
        {
          name: "Artist search",
          query: normalizedArtist,
          limit: 25,
          titleFilter: normalizedTitle,
        },
      ];

      let allCandidates = [];

      // Try each search strategy
      for (const strategy of searchStrategies) {
        try {
          const response = await this.api.get(
            `/v1/catalog/${this.storefront}/search`,
            {
              params: {
                term: strategy.query,
                types: "songs",
                limit: strategy.limit || 10,
              },
            },
          );

          if (
            !response.data.results.songs ||
            response.data.results.songs.data.length === 0
          ) {
            continue; // Try the next strategy
          }

          let songs = response.data.results.songs.data;

          // Apply artist filter - STRICT MATCHING
          // Only accept songs by the same artist or featuring the artist
          const artistFilter = normalizedArtist.toLowerCase();
          songs = songs.filter((song) => {
            const songArtist = song.attributes.artistName.toLowerCase();
            // Check if artists match or if the song artist contains the search artist
            return (
              songArtist === artistFilter ||
              songArtist.includes(artistFilter) ||
              artistFilter.includes(songArtist)
            );
          });

          if (songs.length === 0) continue; // Try the next strategy if no matches

          // Apply title filter if specified
          if (strategy.titleFilter) {
            const titleFilter = strategy.titleFilter.toLowerCase();
            songs = songs.filter((song) => {
              const songTitle = normalizeTrackTitle(
                song.attributes.name,
              ).toLowerCase();
              // More lenient title matching but still needs to be recognizable
              return (
                songTitle.includes(titleFilter) ||
                titleFilter.includes(songTitle) ||
                areEquivalentTitles(song.attributes.name, songUF.name)
              );
            });

            if (songs.length === 0) continue;
          }

          // Score each candidate
          const scoredResults = songs.map((song) => {
            const result = scoreSongMatch(
              {
                name: song.attributes.name,
                artist: song.attributes.artistName,
                album: song.attributes.albumName,
                duration: song.attributes.durationInMillis,
                id: song.id,
              },
              {
                name: songUF.name,
                artist: songUF.artist,
                album: songUF.album,
                duration: songUF.duration,
              },
            );

            // Store the song ID in the result
            result.id = song.id;

            return result;
          });
          // Add to all candidates
          allCandidates = [...allCandidates, ...scoredResults];

          // Only match if we have EXACT artist match
          const exactArtistMatches = scoredResults.filter(
            (result) => result.details.isOriginalArtist,
          );

          if (exactArtistMatches.length > 0) {
            // If we have any matches by the correct artist, sort by score
            exactArtistMatches.sort((a, b) => b.score - a.score);

            // Just take the top match if it's good enough
            const bestExactMatch = exactArtistMatches[0];

            if (bestExactMatch.score >= 0.75) {
              console.log(
                `[AppleMusicApi] Found match with correct artist: "${bestExactMatch.details.name}" by "${bestExactMatch.details.artist}" (Score: ${bestExactMatch.score.toFixed(2)})`,
              );
              return bestExactMatch.id;
            }
          }
        } catch (error) {
          console.error(
            `[AppleMusicApi] Error with ${strategy.name}:`,
            error.message,
          );
          continue; // Try the next strategy
        }
      }

      // If we reach here, no direct artist match was found
      if (allCandidates.length > 0) {
        // Final check: exact artist and title match with any score
        const exactMatches = allCandidates.filter(
          (result) =>
            result.details.isOriginalArtist &&
            areEquivalentTitles(result.details.name, songUF.name),
        );

        if (exactMatches.length > 0) {
          exactMatches.sort((a, b) => b.score - a.score);
          return exactMatches[0].id;
        }
      }

      // If we get here, all strategies failed - log the failure
      console.log(
        "\n========== MATCH FAILED: NO EXACT ARTIST MATCH ==========",
      );
      console.log(`Original: "${songUF.name}" by "${songUF.artist}"`);
      if (songUF.album) console.log(`Album: "${songUF.album}"`);
      console.log(`Normalized title: "${normalizedTitle}"`);
      console.log(`Normalized artist: "${normalizedArtist}"`);

      // Log the top candidates
      console.log("\nTop candidates that were rejected (wrong artist):");
      allCandidates
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .forEach((result, idx) => {
          console.log(
            `[${idx + 1}] "${result.details.name}" by "${result.details.artist}"`,
          );
          console.log(
            `    Normalized name: "${result.details.normalizedName}"`,
          );
          console.log(`    Score: ${result.score.toFixed(3)}`);
          console.log(
            `    Original Artist: ${result.details.isOriginalArtist ? "Yes" : "No"}`,
          );
        });

      console.log("=======================================================\n");
      return null;
    } catch (error) {
      console.error("\n========== MATCH ERROR ==========");
      console.log(`Failed to match: "${songUF.name}" by "${songUF.artist}"`);
      console.error("Error:", error.message || error);
      console.log("=================================\n");
      return null;
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
    let totalTracks = 0;

    if (Array.isArray(unifiedFormat.tracks)) {
      trackEntries = unifiedFormat.tracks.map((track) => ["track_id", track]);
      totalTracks = unifiedFormat.tracks.length;
      console.log(
        `[PopulatePlaylist] Number of tracks to process: ${trackEntries.length}`,
      );
    } else {
      trackEntries = Object.entries(unifiedFormat.tracks);
      totalTracks = trackEntries.length;
      console.log(
        `[PopulatePlaylist] Number of tracks to process: ${trackEntries.length}`,
      );
    }

    try {
      // Track both successful and failed songs
      const successfulTracks = [];
      const failedTracks = [];

      // Process tracks in batches of 5 with 1 second delay between batches
      for (let i = 0; i < trackEntries.length; i += 5) {
        const batch = trackEntries.slice(
          i,
          Math.min(i + 5, trackEntries.length),
        );
        console.log(`[PopulatePlaylist] Processing batch ${i / 5 + 1}`);

        await Promise.all(
          batch.map(async ([_, trackInfo]) => {
            try {
              const catalogId = await this.findSong(trackInfo);
              if (catalogId) {
                // Found the song in catalog
                successfulTracks.push({
                  id: catalogId,
                  type: "songs",
                });
                console.log(
                  `[PopulatePlaylist] Found match for: ${trackInfo.name}`,
                );
              } else {
                // No match found
                failedTracks.push(trackInfo);
                console.log(
                  `[PopulatePlaylist] No match found for: ${trackInfo.name}`,
                );
              }
            } catch (error) {
              // Error during search
              failedTracks.push(trackInfo);
              console.error(
                `[PopulatePlaylist] Error finding song: ${trackInfo.name}`,
                error,
              );
            }
          }),
        );

        // Add delay between batches
        if (i + 5 < trackEntries.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(
        `[PopulatePlaylist] Found ${successfulTracks.length} matching tracks`,
      );
      console.log(
        `[PopulatePlaylist] Failed to find ${failedTracks.length} tracks`,
      );

      // Now add the successful tracks to the playlist
      if (successfulTracks.length === 0) {
        console.log("[PopulatePlaylist] No matching tracks found in catalog");
        // Return result even when no matches found
        return {
          tracksAdded: 0,
          totalTracks: totalTracks,
          failedCount: failedTracks.length,
          failedSongs: failedTracks,
        };
      }

      // Add tracks to playlist in batches of 25
      for (let i = 0; i < successfulTracks.length; i += 25) {
        const batch = successfulTracks.slice(
          i,
          Math.min(i + 25, successfulTracks.length),
        );
        console.log(
          `[PopulatePlaylist] Adding batch of ${batch.length} tracks (${i + 1}-${i + batch.length})`,
        );

        await this.api.post(`/v1/me/library/playlists/${playlistId}/tracks`, {
          data: batch,
        });

        // Add delay between batches
        if (i + 25 < successfulTracks.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(
        `[PopulatePlaylist] Successfully added ${successfulTracks.length} tracks to playlist`,
      );
      return {
        tracksAdded: successfulTracks.length,
        totalTracks: totalTracks,
        failedCount: failedTracks.length,
        failedSongs: failedTracks,
      };
    } catch (error) {
      console.error("[PopulatePlaylist] Error:", error.response?.data || error);
      throw error;
    }
  }
}

export { AppleMusicApi };

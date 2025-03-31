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
        Authorization: `Bearer ${this.developerToken}`,
        "Music-User-Token": this.userToken,
        "Content-Type": "application/json",
      },
    });
  }

  async fetchAllPages(url, limit = 100) {
    if (!this.api) {
      await this.initialize();
    }
  
    let allData = [];
    let nextUrl = url;
    let hasMore = true;
    let pageCount = 0;
    
    // Add limit to initial URL if not already part of it
    if (!nextUrl.includes('limit=')) {
      const separator = nextUrl.includes('?') ? '&' : '?';
      nextUrl = `${nextUrl}${separator}limit=${limit}`;
    }
    
    console.log(`[AppleMusicApi] Starting paginated request from: ${nextUrl}`);
    
    while (hasMore) {
      try {
        pageCount++;
        console.log(`[AppleMusicApi] Fetching page ${pageCount}: ${nextUrl}`);
        const response = await this.api.get(nextUrl);
        
        if (!response.data || !response.data.data) {
          console.warn('[AppleMusicApi] Received invalid response data structure:', response.data);
          break;
        }
        
        const pageItems = response.data.data;
        console.log(`[AppleMusicApi] Retrieved ${pageItems.length} items on page ${pageCount}`);
        
        // Add the current page of data
        allData = [...allData, ...pageItems];
        
        // Check if there's a next page
        if (response.data.next) {
          nextUrl = response.data.next;
          console.log(`[AppleMusicApi] Next page URL found: ${nextUrl}`);
        } else {
          hasMore = false;
          console.log(`[AppleMusicApi] No more pages available, pagination complete`);
        }
        
        // Add delay between pages to avoid rate limiting
        if (hasMore) {
          console.log(`[AppleMusicApi] Adding delay before next page request`);
          await delay(500);
        }
      } catch (error) {
        const statusCode = error.response?.status;
        const errorData = error.response?.data?.errors?.[0];
        
        if (statusCode === 500 && errorData?.title === 'Upstream Service Error') {
          console.error(`[AppleMusicApi] Authentication error from upstream service (code: ${errorData.code}): ${errorData.detail}`);
          console.error('[AppleMusicApi] This may be caused by an expired token or service disruption. Will retry after delay.');
          
          // Add slightly longer delay and try one more time
          await delay(2000);
          
          try {
            console.log(`[AppleMusicApi] Retrying page ${pageCount} after authentication error`);
            const retryResponse = await this.api.get(nextUrl);
            
            if (retryResponse.data && retryResponse.data.data) {
              const pageItems = retryResponse.data.data;
              console.log(`[AppleMusicApi] Retry successful! Retrieved ${pageItems.length} items`);
              allData = [...allData, ...pageItems];
              
              if (retryResponse.data.next) {
                nextUrl = retryResponse.data.next;
              } else {
                hasMore = false;
              }
              
              continue;
            }
          } catch (retryError) {
            console.error('[AppleMusicApi] Retry failed, ending pagination:', retryError.message);
          }
        } else if (statusCode === 404 && errorData?.title === 'No related resources') {
          console.log(`[AppleMusicApi] No related resources found (code: ${errorData.code}): ${errorData.detail}`);
          console.log('[AppleMusicApi] This is normal for empty playlists or when reaching the end of a collection');
          // This is not an error, just the end of resources
          hasMore = false;
        } else {
          console.error(`[AppleMusicApi] Error fetching page ${pageCount}:`, 
            errorData 
              ? `${errorData.title} (${errorData.status}): ${errorData.detail}`
              : error.message
          );
          console.error('[AppleMusicApi] Full error details:', error.response?.data || error);
        }
        
        // Stop pagination after any error besides empty resources
        hasMore = false;
      }
    }
    
    console.log(`[AppleMusicApi] Pagination complete - fetched ${allData.length} total items in ${pageCount} pages`);
    return allData;
  }

  async getPlaylistLibrary() {
    if (!this.api) {
      await this.initialize();
    }
  
    try {
      console.log("[AppleMusicApi] Fetching playlist library...");
      
      // Fetch all playlists using pagination
      console.log("[AppleMusicApi] Requesting all playlists from /v1/me/library/playlists");
      const playlists = await this.fetchAllPages("/v1/me/library/playlists", 100);
      
      if (!playlists || playlists.length === 0) {
        console.warn("[AppleMusicApi] No playlists found in user library");
        return []; // Return empty array instead of throwing
      }
      
      console.log(
        `[AppleMusicApi] Found ${playlists.length} playlists. Processing in batches...`,
      );
  
      // PERFORMANCE FIX: Increase batch size to 5 and reduce delay to 500ms
      // This provides a better balance between speed and rate limiting
      const processedPlaylists = await processBatch(
        playlists,
        5, // Batch size
        500, // Delay in ms
        async (playlist) => {
          try {
            const playlistName = playlist.attributes?.name || "Unknown Playlist";
            const playlistId = playlist.id || "Unknown ID";
            
            console.log(
              `[AppleMusicApi] Processing playlist: "${playlistName}" (ID: ${playlistId})`,
            );
            
            // Add basic playlist info first without tracks for immediate display
            const basicPlaylistInfo = {
              user: this.userToken,
              origin: "apple music",
              name: playlistName,
              playlist_id: playlistId,
              number_of_tracks: 0, // Will be updated when tracks are loaded
              duration: 0, // Will be updated when tracks are loaded
              description: playlist.attributes?.description?.standard || "",
              image:
                playlist.attributes?.artwork?.url?.replace(
                  "{w}x{h}",
                  "300x300",
                ) || "",
              tracks: {}, // Empty tracks object to be populated later
              isLoading: true, // Flag to indicate tracks are still loading
            };
            
            // Fetch all tracks using pagination
            const tracksUrl = `/v1/me/library/playlists/${playlistId}/tracks`;
            console.log(`[AppleMusicApi] Requesting all tracks for playlist "${playlistName}"`);
            
            let allTracks = [];
            try {
              allTracks = await this.fetchAllPages(tracksUrl, 100);
              console.log(`[AppleMusicApi] Successfully fetched ${allTracks.length} tracks for "${playlistName}"`);
            } catch (tracksError) {
              if (tracksError.response?.status === 404) {
                console.log(`[AppleMusicApi] No tracks found for playlist "${playlistName}" - likely empty playlist`);
              } else {
                console.error(`[AppleMusicApi] Error fetching tracks for "${playlistName}":`, 
                  tracksError.response?.data?.errors?.[0]?.detail || tracksError.message);
                // Continue with empty tracks rather than failing the entire playlist
              }
            }
            
            const tracks = {};
            allTracks.forEach((track, idx) => {
              if (!track || !track.id) {
                console.warn(`[AppleMusicApi] Invalid track data at index ${idx} for playlist "${playlistName}"`);
                return;
              }
              
              tracks[track.id] = {
                name: track.attributes?.name || "Unknown Track",
                artist: track.attributes?.artistName || "Unknown Artist",
                album: track.attributes?.albumName || "Unknown Album",
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
            
            const trackCount = Object.keys(tracks).length;
            console.log(`[AppleMusicApi] Processed ${trackCount} tracks (${totalDuration}ms) for "${playlistName}"`);
  
            // Return complete playlist with tracks
            return {
              user: this.userToken,
              origin: "apple music",
              name: playlistName,
              playlist_id: playlistId,
              number_of_tracks: trackCount,
              duration: totalDuration,
              description: playlist.attributes?.description?.standard || "",
              image:
                playlist.attributes?.artwork?.url?.replace(
                  "{w}x{h}",
                  "300x300",
                ) || "",
              tracks: tracks,
              isLoading: false, // Tracks are now loaded
            };
          } catch (error) {
            const playlistName = playlist.attributes?.name || "Unknown Playlist";
            const playlistId = playlist.id || "Unknown ID";
            
            console.error(
              `[AppleMusicApi] Failed to process playlist "${playlistName}" (ID: ${playlistId}):`,
              error.message,
            );
            
            // Return a partial playlist with error status instead of null
            // This way the UI can show an error state rather than nothing
            return {
              user: this.userToken,
              origin: "apple music",
              name: playlistName,
              playlist_id: playlistId,
              number_of_tracks: 0,
              duration: 0,
              description: playlist.attributes?.description?.standard || "",
              image:
                playlist.attributes?.artwork?.url?.replace(
                  "{w}x{h}",
                  "300x300",
                ) || "",
              tracks: {},
              isLoading: false,
              hasError: true,
              errorMessage: `Failed to load tracks: ${error.message}`,
            };
          }
        },
      );
  
      // Count successful vs error playlists
      const successCount = processedPlaylists.filter(p => !p.hasError).length;
      const errorCount = processedPlaylists.filter(p => p.hasError).length;
      
      console.log(`[AppleMusicApi] Playlist processing complete:`);
      console.log(`  - Total playlists: ${processedPlaylists.length}`);
      console.log(`  - Successfully loaded: ${successCount}`);
      console.log(`  - Failed to load: ${errorCount}`);
  
      // Return all playlists - UI can handle the error states
      return processedPlaylists;
    } catch (error) {
      const errorDetails = error.response?.data?.errors?.[0];
      
      if (errorDetails) {
        console.error(
          `[AppleMusicApi] Failed to get playlist library: ${errorDetails.title} (${errorDetails.status}): ${errorDetails.detail}`
        );
      } else {
        console.error(
          "[AppleMusicApi] Failed to get playlist library:",
          error.message,
        );
      }
      
      // Return empty array with a special system error entry that UI can display
      return [{
        user: this.userToken,
        origin: "apple music",
        name: "Error Loading Library",
        playlist_id: "error",
        number_of_tracks: 0,
        duration: 0,
        description: "Failed to load Apple Music library",
        image: "",
        tracks: {},
        isLoading: false,
        hasError: true,
        isSystemError: true,
        errorMessage: errorDetails 
          ? `${errorDetails.title}: ${errorDetails.detail}`
          : error.message,
      }];
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
  
      console.log(`[AppleMusicApi] Fetching playlist metadata for ID: ${playlistId}`);
      let playlist;
      try {
        const playlistResponse = await this.api.get(
          `/v1/me/library/playlists/${playlistId}`,
        );
        
        if (!playlistResponse.data || !playlistResponse.data.data || !playlistResponse.data.data[0]) {
          console.error("[AppleMusicApi] Invalid playlist metadata response format");
          throw new Error("Invalid playlist metadata response from Apple Music API");
        }
        
        playlist = playlistResponse.data.data[0];
        console.log(`[AppleMusicApi] Successfully retrieved metadata for playlist "${playlist.attributes?.name}"`);
      } catch (metadataError) {
        const errorDetails = metadataError.response?.data?.errors?.[0];
        if (errorDetails) {
          console.error(
            `[AppleMusicApi] Failed to fetch playlist metadata: ${errorDetails.title} (${errorDetails.status}): ${errorDetails.detail}`
          );
          
          if (errorDetails.status === '404') {
            throw new Error(`Playlist not found: ${errorDetails.detail}`);
          }
        }
        throw metadataError; // Re-throw to be handled by caller
      }
  
      const tracks = {};
  
      try {
        console.log(`[AppleMusicApi] Fetching tracks for playlist "${playlist.attributes?.name}" (ID: ${playlistId})`);
        // Fetch all tracks using pagination
        const tracksUrl = `/v1/me/library/playlists/${playlistId}/tracks`;
        const allTracks = await this.fetchAllPages(tracksUrl, 100);
        
        console.log(`[AppleMusicApi] Found ${allTracks.length} tracks for playlist "${playlist.attributes?.name}"`);
        
        if (allTracks.length === 0) {
          console.log(`[AppleMusicApi] No tracks returned for playlist "${playlist.attributes?.name}" - this may be an empty playlist`);
        }
        
        allTracks.forEach((track, idx) => {
          if (!track || !track.id) {
            console.warn(`[AppleMusicApi] Invalid track data at index ${idx}`);
            return;
          }
          
          tracks[track.id] = {
            name: track.attributes?.name || "Unknown Track",
            artist: track.attributes?.artistName || "Unknown Artist",
            album: track.attributes?.albumName || "Unknown Album",
            duration: track.attributes?.durationInMillis || 0,
            image:
              track.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") ||
              "",
          };
        });
      } catch (tracksError) {
        const errorDetails = tracksError.response?.data?.errors?.[0];
        
        if (errorDetails && errorDetails.status === '404' && errorDetails.title === 'No related resources') {
          console.log(`[AppleMusicApi] No tracks found for playlist "${playlist.attributes?.name}" - likely an empty playlist`);
          // This is normal for empty playlists, so we continue with empty tracks
        } else if (errorDetails) {
          console.error(
            `[AppleMusicApi] Error fetching tracks: ${errorDetails.title} (${errorDetails.status}): ${errorDetails.detail}`
          );
          
          // For authentication errors, we might want to suggest re-authentication
          if (errorDetails.status === '500' && errorDetails.title === 'Upstream Service Error') {
            console.error('[AppleMusicApi] Authentication error - user may need to re-authenticate with Apple Music');
          }
          
          throw new Error(`Failed to load tracks: ${errorDetails.detail}`);
        } else {
          console.error("[AppleMusicApi] Error fetching tracks:", tracksError.message);
          throw tracksError;
        }
      }
  
      const trackCount = Object.keys(tracks).length;
      const totalDuration = Object.values(tracks).reduce(
        (sum, track) => sum + (track.duration || 0),
        0,
      );
      
      console.log(`[AppleMusicApi] Successfully processed ${trackCount} tracks (${totalDuration}ms) for playlist "${playlist.attributes?.name}"`);
  
      const response = {
        user: this.userToken,
        origin: "apple music",
        name: playlist.attributes?.name || "Unknown Playlist",
        playlist_id: playlist.id,
        number_of_tracks: trackCount,
        duration: totalDuration,
        description: playlist.attributes?.description?.standard || "",
        image:
          playlist.attributes?.artwork?.url?.replace("{w}x{h}", "300x300") ||
          "",
        tracks: tracks,
      };
  
      return response;
    } catch (error) {
      const errorDetails = error.response?.data?.errors?.[0];
      
      if (errorDetails) {
        console.error(
          `[AppleMusicApi] Failed to get playlist: ${errorDetails.title} (${errorDetails.status}): ${errorDetails.detail}`
        );
        
        // Provide a more user-friendly error message based on the error type
        if (errorDetails.status === '404') {
          throw new Error(`Playlist not found. The playlist ID "${input}" may be invalid or inaccessible.`);
        } else if (errorDetails.status === '500' && errorDetails.title === 'Upstream Service Error') {
          throw new Error(`Authentication error: ${errorDetails.detail}. You may need to reconnect your Apple Music account.`);
        } else {
          throw new Error(`${errorDetails.title}: ${errorDetails.detail}`);
        }
      } else {
        console.error(
          "[AppleMusicApi] Failed to get playlist:",
          error.message,
        );
        throw error;
      }
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

      // PERFORMANCE FIX: Increase batch size to 10 with a small delay
      // Process tracks in larger batches to speed up processing
      const processedTracks = await processBatch(
        trackEntries,
        10, // Increased from 5 to 10
        500, // Keep at 500ms for stability
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

      // PERFORMANCE FIX: Add tracks in larger batches
      // Add tracks to playlist in batches of 50 instead of 25
      for (let i = 0; i < validTracks.length; i += 50) {
        const batch = validTracks.slice(
          i,
          Math.min(i + 50, validTracks.length),
        );
        console.log(
          `[PopulatePlaylist] Adding batch of ${batch.length} tracks (${i + 1}-${i + batch.length})`,
        );

        await this.api.post(`/v1/me/library/playlists/${playlistId}/tracks`, {
          data: batch,
        });

        // Add delay between batches
        if (i + 50 < validTracks.length) {
          await delay(500); // Reduced from 1000ms to 500ms
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
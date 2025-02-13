// src/main/utils/apple_music.js
import axios from "axios";
import { getAppleMusicToken } from "./safe_storage.js";

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
      baseURL: 'https://api.music.apple.com',
      headers: {
        'Authorization': `Bearer ${this.developerToken}`,
        'Music-User-Token': this.userToken,
        'Content-Type': 'application/json'
      }
    });
  }

  async GetPlaylistLibrary() {
    if (!this.api) {
      await this.initialize();
    }

    try {
      const response = await this.api.get('/v1/me/library/playlists');
      return response.data;
    } catch (error) {
      console.error('Failed to get playlist library:', error);
      throw error;
    }
  }

  async GetPlaylist(id) {
    if (!this.api) {
      await this.initialize();
    }

    try {
      const response = await this.api.get(`/v1/me/library/playlists/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get playlist:', error);
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
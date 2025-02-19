// src/main/utils/spotify.js
import axios from "axios";
import dotenv from "dotenv";
// import { getSpotifyToken } from "./safe_storage";

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
    this.auth_token = process.env.SPOTIFY_AUTH_TOKEN; // change this to use safe storage
    this.refresh_token = process.env.SPOTIFY_REFRESH_TOKEN; // change this to use safe storage
    this.client_id = process.env.SPOTIFY_CLIENT_ID; // change this to use safe storage
    this.client_secret = process.env.SPOTIFY_CLIENT_SECRET; // change this to use safe storage
    await this.refreshToken();
    this.tokenHandler(); // token will refresh every 55 minutes
    this.user_id = await this.getUserId();
  }

  tokenHandler() {
    setInterval(() => {
      this.refreshToken();
    }, 3300000);
  }

  async refreshToken() {
    try {
      console.log(this.auth_token);
      const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        `grant_type=refresh_token&refresh_token=${this.refresh_token}`,
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
      console.log("\n\n" + this.auth_token);
      this.refresh_token = response.data.refresh_token;
    } catch (error) {
      console.log(error);
      throw new Error("Failed to refresh token");
    }
  }

  async getUserId() {
    if (!this.auth_token) {
      await this.initialize();
    }

    try {
      const response = await axios.get("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${this.auth_token}` },
      });
      return response.data.id;
    } catch (error) {
      console.log(error);
      throw new Error("Failed to fetch user ID");
    }
  }

  async getPlaylistLibrary() {
    if (!this.auth_token) {
      await this.initialize();
    }

    try {
      const response = await axios.get(
        `https://api.spotify.com/v1/users/${this.user_id}/playlists`,
        {
          headers: { Authorization: `Bearer ${this.auth_token}` },
        },
      );

      const playlist_promises = response.data.items.map(async (item) => {
        const playlist_id = item.id;
        const playlist_uf = await this.getPlaylist(playlist_id);
        return playlist_uf;
      });
      const playlists = await Promise.all(playlist_promises);

      return playlists;
    } catch (error) {
      console.log(error);
      throw new Error("Failed to fetch user playlists");
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

  static async convertToUniversalFormat(data) {
    var playlist = {
      user: data.owner.display_name,
      origin: "Spotify",
      name: data.name,
      number_of_tracks: data.tracks.total,
      duration: data.duration_ms,
      description: data.description,
      image: data.images[0].url,
    };

    playlist.tracks = [];
    data.tracks.items.forEach((item) => {
      const track = {
        name: item.track.name,
        artist: item.track.artists[0].name,
        album: item.track.album.name,
        duration: item.track.duration_ms,
        image: item.track.album.images[0].url,
      };
      playlist.tracks.push(track);
    });
    return playlist;
  }
}

const spotify = new SpotifyApi();
spotify.initialize();

export { SpotifyApi };

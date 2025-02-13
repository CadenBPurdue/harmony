import axios from "axios";

class SpotifyApi {
  constructor() {
    this.token = null;
    this.user = null;
  }

  async initialize(username, code, redirect_uri) {
    this.token = await SpotifyApi.getToken(code, redirect_uri);
    if (!this.token) {
      throw new Error("Failed to get token");
    }
    this.user = username;
  }

  static async getToken(code, redirect_uri) {
    if (!process.env.CLIENT_SECRET) {
      throw new Error("Must set CLIENT_SECRET environment variable");
    }

    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirect_uri);
    params.append("client_id", "3852c03c669e46dd93e28ee6d4bd15c4");
    params.append("client_secret", process.env.CLIENT_SECRET);

    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    return response.data.access_token;
  }

  async getUser() {
    if (!this.token) {
      await this.initialize();
    }

    try {
      const response = await axios.get(
        `https://api.spotify.com/v1/users/${this.user}`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
        },
      );
      return response.data;
    } catch (error) {
      console.log(error);
      throw new Error("Failed to fetch user data");
    }
  }

  async getUserPlaylists() {
    if (!this.token) {
      await this.initialize();
    }

    try {
      const response = await axios.get(
        `https://api.spotify.com/v1/users/${this.user}/playlists`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
        },
      );
      return response.data;
    } catch (error) {
      console.log(error);
      throw new Error("Failed to fetch user playlists");
    }
  }

  async getPlaylistFromUrl(url) {
    if (!this.token) {
      await this.initialize();
    }

    if (url.search("playlist") == -1) {
      throw new Error("Invalid playlist URL");
    }

    const collection_id = url.split("playlist/")[1];

    try {
      const response = await axios.get(
        `https://api.spotify.com/v1/playlists/${collection_id}`,
        {
          headers: { Authorization: `Bearer ${this.token}` },
        },
      );
      return response.data;
    } catch (error) {
      console.log(error);
      throw new Error("Failed to fetch playlist from URL");
    }
  }

  async createEmptyPlaylist(playlist_name) {
    if (!this.token) {
      await this.initialize();
    }

    console.log("Token:", this.token);

    try {
      const response = await axios.post(
        `https://api.spotify.com/v1/users/${this.user}/playlists`,
        {
          name: playlist_name,
          description: `Playlist transferred to Spotify using Harmony`,
          public: false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        },
      );

      // Return the playlist ID from the response
      return response.data.id;
    } catch (error) {
      console.error(
        "Error creating playlist:",
        error.response ? error.response.data : error.message,
      );
      throw new Error("Failed to create playlist");
    }
  }

  async convertToUniversalFormat(data) {
    var playlist = {
      name: data.name,
      spotify_url: data.external_urls.spotify,
      apple_music_url: null,
      number_of_tracks: data.tracks.total,
    };

    playlist.tracks = [];
    data.tracks.items.forEach((item) => {
      const track = {
        name: item.track.name,
        artist: item.track.artists[0].name,
        album: item.track.album.name,
        disc_number: item.track.disc_number,
        track_number: item.track.track_number,
        duration: item.track.duration_ms,
        spotify_url: item.track.external_urls.spotify,
      };
      playlist.tracks.push(track);
    });
    return playlist;
  }
}

export { SpotifyApi };

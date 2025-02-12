import axios from "axios";

class SpotifyApi {
  constructor() {
    this.token = null;
    this.user = null;
  }

  async initialize(username) {
    this.token = await SpotifyApi.getToken();
    if (!this.token) {
      throw new Error("Failed to get token");
    }
    this.user = username;
  }

  static async getToken() {
    if (!process.env.CLIENT_SECRET) {
      throw new Error("Must set CLIENT_SECRET environment variable");
    }

    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", "3852c03c669e46dd93e28ee6d4bd15c4");
    params.append("client_secret", process.env.CLIENT_SECRET);

    try {
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
    } catch (error) {
      console.log(error);
      throw new Error("Failed to get token");
    }
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

    var playlist_id = null;

    axios.post("https://api.spotify.com/v1/users/{user_id}/playlists", {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: {
        name: playlist_name,
        description: `Playlist transferred from Apple Music using Harmony`,
        public: false,
      },
    });

    return playlist_id;
  }

  async convertToUniversalFormat(response) {
    var playlist = {
      name: response.data.name,
      spotify_url: response.data.external_urls.spotify,
      apple_music_url: null,
      number_of_tracks: response.data.tracks.total,
    };

    playlist.tracks = [];
    response.data.tracks.items.forEach((item) => {
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

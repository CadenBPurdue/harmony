import axios from "axios";

class SpotifyApi {
  constructor() {
    this.token = null;
    this.user = null;
    this.playlist = null;
  }

  async initialize() {
    this.token = await SpotifyApi.getToken();
    if (!this.token) {
      throw new Error("Failed to get token");
    }

    this.user = process.env.SPOTIFY_USERNAME;
    this.playlist = process.env.PLAYLIST_URL;
  }

  static async getToken() {
    if (!process.env.CLIENT_SECRET) {
      throw new Error("Must set CLIENT_SECRET environment variable");
    }

    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
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

    axios
      .get(`https://api.spotify.com/v1/users/${this.user}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      .then(
        (response) => {
          console.log(response.data);
        },
        (error) => {
          console.log(error);
        },
      );
  }

  async getUserPlaylists() {
    if (!this.token) {
      await this.initialize();
    }

    axios
      .get(`https://api.spotify.com/v1/users/${this.user}/playlists`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      .then(
        (response) => {
          console.log(response.data);
        },
        (error) => {
          console.log(error);
        },
      );
  }

  async getPlaylistFromUrl() {
    if (!this.token) {
      await this.initialize();
    }

    if (url.search("playlist") == -1) {
      throw new Error("Invalid playlist URL");
    }

    const collection_id = this.playlist.split("playlist/")[1];

    // TODO: get playlist id from user input (or other source)
    axios
      .get(`https://api.spotify.com/v1/playlists/${collection_id}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
      .then(
        (response) => {
          console.log(response.data);
        },
        (error) => {
          console.log(error);
        },
      );
  }
}

const spotify = new SpotifyApi();
spotify.initialize();

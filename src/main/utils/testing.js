import dotenv from "dotenv";
import { SpotifyApi } from "./spotify.js";

class SpotifyUnitTest {
  async _test_env() {
    dotenv.config();
    const client_id = process.env.SPOTIFY_CLIENT_ID;
    this.assert(client_id !== undefined, "Client ID should not be null");
  }

  async _test_getToken() {
    const spotify = await this.setup();
    this.assert(spotify.auth_token !== null, "Token should not be null");
    console.log("_test_getToken passed");
  }

  async _test_getUserPlaylists() {
    const spotify = await this.setup();
    const playlists = await spotify.getPlaylistLibrary();
    this.assert(playlists !== null, "Playlists should not be null");
    console.log("_test_getUserPlaylists passed");
  }

  async _test_getPlaylistFromUrl() {
    const spotify = await this.setup();

    const valid_url_1 =
      "https://open.spotify.com/playlist/7dNySe6is1ETaEBmDD5TPp";
    const playlist1 = await spotify.getPlaylist(valid_url_1);
    this.assert(playlist1 !== null, "Playlist 1 should not be null");

    const valid_url_2 =
      "https://open.spotify.com/playlist/5yal4glZg3isyuhkLenHeT";
    const playlist2 = await spotify.getPlaylist(valid_url_2);
    this.assert(playlist2 !== null, "Playlist 2 should not be null");

    const invalid_url = "https://open.spotify.com/track/5yal4glZg3isyuhkLenHeT";
    try {
      await spotify.getPlaylist(invalid_url);
      this.assert(false, "Failed to catch error for invalid URL");
    } catch (error) {
      this.assert(
        error.message === "Invalid playlist URL",
        "Error message should match",
      );
    }
    console.log("_test_getPlaylistFromUrl passed");
  }

  async _test_createEmptyPlaylist() {
    const spotify = new SpotifyApi();
    const playlist_name = "Playlist Unit Test";
    const playlist = await spotify.createEmptyPlaylist(playlist_name);
    this.assert(playlist !== null, "Playlist should not be null");
    console.log("_test_createEmptyPlaylist passed");
  }

  async setup() {
    const spotify = new SpotifyApi();
    await spotify.initialize();
    return spotify;
  }

  assert(condition, message = "Assertion failed") {
    if (!condition) {
      throw new Error(message);
    }
  }

  async main() {
    try {
      // this._test_env();
      // const spotify = new SpotifyApi();
      // await spotify.initialize();
      // await this._test_getAccessToken();
      // await this._test_getPlaylistLibrary();
      // await this._test_getPlaylist();
      await this._test_createEmptyPlaylist("test");
      console.log("All tests passed!");
    } catch (error) {
      console.error("Test failed:", error.message);
    }
  }
}

const test = new SpotifyUnitTest();
test.main();

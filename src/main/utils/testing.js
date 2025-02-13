import { SpotifyApi } from "./spotify.js";

class SpotifyUnitTest {
  async _test_getToken() {
    const spotify = await this.setup();
    this.assert(spotify.token !== null, "Token should not be null");
    console.log("_test_getToken passed");
  }

  async _test_getUserInfo() {
    const spotify = await this.setup();
    const userInfo = await spotify.getUserInfo();
    this.assert(userInfo !== null, "User info should not be null");
    console.log("_test_getUserInfo passed");
  }

  async _test_getUserPlaylists() {
    const spotify = await this.setup();
    const playlists = await spotify.getUserPlaylists();
    this.assert(playlists !== null, "Playlists should not be null");
    console.log("_test_getUserPlaylists passed");
  }

  async _test_getPlaylistFromUrl() {
    const spotify = await this.setup();

    const valid_url_1 =
      "https://open.spotify.com/playlist/7dNySe6is1ETaEBmDD5TPp";
    const playlist1 = await spotify.getPlaylistFromUrl(valid_url_1);
    this.assert(playlist1 !== null, "Playlist 1 should not be null");

    const valid_url_2 =
      "https://open.spotify.com/playlist/5yal4glZg3isyuhkLenHeT";
    const playlist2 = await spotify.getPlaylistFromUrl(valid_url_2);
    this.assert(playlist2 !== null, "Playlist 2 should not be null");

    const invalid_url = "https://open.spotify.com/track/5yal4glZg3isyuhkLenHeT";
    try {
      await spotify.getPlaylistFromUrl(invalid_url);
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
    const spotify = await this.setup();
    const playlist_name = "Playlist Unit Test";
    const playlist = await spotify.createEmptyPlaylist(playlist_name);
    this.assert(playlist !== null, "Playlist should not be null");
    console.log("_test_createEmptyPlaylist passed");
  }

  async setup() {
    const spotify = new SpotifyApi();
    await spotify.initialize(process.env.SPOTIFY_USERNAME);
    return spotify;
  }

  assert(condition, message = "Assertion failed") {
    if (!condition) {
      throw new Error(message);
    }
  }

  async main() {
    try {
      const spotify = new SpotifyApi();
      await spotify.initialize();
      // await this._test_getToken();
      await this._test_getUserInfo();
      //   await this._test_getUserPlaylists();
      //   await this._test_getPlaylistFromUrl();
      await this._test_createEmptyPlaylist();
      console.log("All tests passed!");
    } catch (error) {
      console.error("Test failed:", error.message);
    }
  }
}

const test = new SpotifyUnitTest();
test.main();

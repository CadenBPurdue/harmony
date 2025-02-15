import { SpotifyApi } from "./spotify.js";

class SpotifyUnitTest {
  async _test_getPlaylistLibrary() {
    const spotify = new SpotifyApi();
    await spotify.initialize();
    const playlists = await spotify.getPlaylistLibrary();
    this.assert(playlists !== null, "Playlists should not be null");
    console.log("_test_getUserPlaylists passed");
  }

  async _test_getPlaylistFromUrl() {
    const spotify = new SpotifyApi();
    await spotify.initialize();

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

  async apple_to_spotify() {
    const spotify = new SpotifyApi();
    await spotify.initialize();

    const appleMusic = new AppleMusicApi();
    await appleMusic.initialize();

    // fetching apple music playlist
    const apple_playlist_id = "";
    const apple_playlist = await appleMusic.getPlaylist(apple_playlist_id);

    // making the empty playlist
    const playlist_id = await spotify.createEmptyPlaylist("Andrew's Playlist");

    // transferring playlist
    await spotify.populatePlaylist(playlist_id, apple_playlist);
  }

  assert(condition, message = "Assertion failed") {
    if (!condition) {
      throw new Error(message);
    }
  }

  async main() {
    try {
      await this.apple_to_spotify();
    } catch (error) {
      console.error("Test failed:", error.message);
    }
  }
}

const test = new SpotifyUnitTest();
test.main();

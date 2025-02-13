import { SpotifyApi } from "./spotify.js";

class TransferManager {
  constructor() {
    this.spotify = new SpotifyApi();
    // this.apple_music = new AppleMusicApi();
  }

  async transferPlaylist() {
    var username = process.env.SPOTIFY_USERNAME;
    var url = process.env.PLAYLIST_URL;

    await this.spotify.initialize(username);

    try {
      const playlist_obj = await this.spotify.getPlaylistFromUrl(url);
      const playlist_json =
        await this.spotify.convertToUniversalFormat(playlist_obj);
      console.log(playlist_json);
    } catch (error) {
      console.log(error);
      throw new Error("Failed to get playlist from URL");
    }
  }
}

const transferManager = new TransferManager();
await transferManager.transferPlaylist();

import { SpotifyApi } from "./spotify.js";

function _testgetToken() {
  const spotify = new SpotifyApi();
  spotify.initialize();
  assert(spotify.token !== null);
}

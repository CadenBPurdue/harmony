// src/main/utils/constants.js
import { getCredentials } from "./credentials.js";

export const getAuthConstants = () => {
  const credentials = getCredentials();

  const redirectUri = "http://localhost:8888/callback";

  return {
    SPOTIFY: {
      CLIENT_ID: credentials.spotifyClientId,
      CLIENT_SECRET: credentials.spotifyClientSecret,
      REDIRECT_URI: redirectUri,
      SCOPES: [
        "user-read-private",
        "user-read-email",
        "playlist-read-private",
        "playlist-modify-public",
        "playlist-modify-private",
      ],
    },
  };
};

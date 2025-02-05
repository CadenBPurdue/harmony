// src/main/utils/constants.js
const { credentialsManager } = require('./credentials');

const getAuthConstants = () => {
  const credentials = credentialsManager.getCredentials();
  
  const redirectUri = 'http://localhost:8888/callback';

  return {
    SPOTIFY: {
      CLIENT_ID: credentials.spotifyClientId,
      CLIENT_SECRET: credentials.spotifyClientSecret,
      REDIRECT_URI: redirectUri,
      SCOPES: [
        'user-read-private',
        'user-read-email',
        'playlist-read-private',
        'playlist-modify-public',
        'playlist-modify-private'
      ]
    }
  };
};

module.exports = { getAuthConstants };
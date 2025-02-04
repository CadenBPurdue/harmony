// src/main/utils/constants.js
const { credentialsManager } = require('./credentials');

const getAuthConstants = () => {
  const credentials = credentialsManager.getCredentials();
  
  // Use the appropriate redirect URI based on environment
  const redirectUri = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5173/callback'
    : 'http://localhost:3000/callback';

  return {
    SPOTIFY: {
      CLIENT_ID: credentials.spotifyClientId,
      REDIRECT_URI: redirectUri,
      SCOPES: ['user-read-private', 'playlist-read-private', 'playlist-modify-public']
    },
    APPLE_MUSIC: {
      KEY_ID: credentials.appleKeyId,
      TEAM_ID: credentials.appleTeamId,
      REDIRECT_URI: redirectUri
    }
  };
};

module.exports = { getAuthConstants };
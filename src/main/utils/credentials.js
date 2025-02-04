// src/main/utils/credentials.js
const { safeStorage } = require('electron');

class CredentialsManager {
  constructor() {
    // Initialize with your app's credentials
    const credentials = {
      spotifyClientId: '3852c03c669e46dd93e28ee6d4bd15c4',
      appleKeyId: 'your_apple_key_id',
      appleTeamId: 'your_apple_team_id'
    };

    // Encrypt credentials
    this.credentials = {
      spotifyClientId: safeStorage.encryptString(credentials.spotifyClientId),
      appleKeyId: safeStorage.encryptString(credentials.appleKeyId),
      appleTeamId: safeStorage.encryptString(credentials.appleTeamId)
    };
  }

  getCredentials() {
    return {
      spotifyClientId: safeStorage.decryptString(this.credentials.spotifyClientId),
      appleKeyId: safeStorage.decryptString(this.credentials.appleKeyId),
      appleTeamId: safeStorage.decryptString(this.credentials.appleTeamId)
    };
  }
}

const credentialsManager = new CredentialsManager();
module.exports = { credentialsManager };
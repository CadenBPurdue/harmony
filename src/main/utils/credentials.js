// src/main/utils/credentials.js
import { safeStorage } from "electron";

class Credentials {
  constructor() {
    const credentials = {
      spotifyClientId: "3852c03c669e46dd93e28ee6d4bd15c4",
      spotifyClientSecret: "key",
      appleKeyId: "your_apple_key_id",
      appleTeamId: "your_apple_team_id",
    };

    // Encrypt the credentials
    if (safeStorage.isEncryptionAvailable()) {
      this.credentials = {
        spotifyClientId: safeStorage.encryptString(credentials.spotifyClientId),
        spotifyClientSecret: safeStorage.encryptString(
          credentials.spotifyClientSecret,
        ),
        appleKeyId: safeStorage.encryptString(credentials.appleKeyId),
        appleTeamId: safeStorage.encryptString(credentials.appleTeamId),
      };
    } else {
      this.credentials = credentials;
    }
  }

  getCredentials() {
    if (safeStorage.isEncryptionAvailable()) {
      return {
        spotifyClientId: safeStorage.decryptString(
          this.credentials.spotifyClientId,
        ),
        spotifyClientSecret: safeStorage.decryptString(
          this.credentials.spotifyClientSecret,
        ),
        appleKeyId: safeStorage.decryptString(this.credentials.appleKeyId),
        appleTeamId: safeStorage.decryptString(this.credentials.appleTeamId),
      };
    }
    return this.credentials;
  }
}

export default Credentials;

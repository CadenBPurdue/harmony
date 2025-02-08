// src/main/utils/credentials.js
import { safeStorage } from "electron";

const defaultCredentials = {
  spotifyClientId: "3852c03c669e46dd93e28ee6d4bd15c4",
  spotifyClientSecret: "key",
  appleKeyId: "your_apple_key_id",
  appleTeamId: "your_apple_team_id",
};

let encryptedCredentials = null;

function loadCredentials() {
  if (safeStorage.isEncryptionAvailable()) {
    encryptedCredentials = {
      spotifyClientId: safeStorage.encryptString(
        defaultCredentials.spotifyClientId,
      ),
      spotifyClientSecret: safeStorage.encryptString(
        defaultCredentials.spotifyClientSecret,
      ),
      appleKeyId: safeStorage.encryptString(defaultCredentials.appleKeyId),
      appleTeamId: safeStorage.encryptString(defaultCredentials.appleTeamId),
    };
  } else {
    encryptedCredentials = { ...defaultCredentials };
  }
}

export function getCredentials() {
  if (!encryptedCredentials) {
    loadCredentials();
  }
  if (safeStorage.isEncryptionAvailable()) {
    return {
      spotifyClientId: safeStorage.decryptString(
        encryptedCredentials.spotifyClientId,
      ),
      spotifyClientSecret: safeStorage.decryptString(
        encryptedCredentials.spotifyClientSecret,
      ),
      appleKeyId: safeStorage.decryptString(encryptedCredentials.appleKeyId),
      appleTeamId: safeStorage.decryptString(encryptedCredentials.appleTeamId),
    };
  }
  return encryptedCredentials;
}

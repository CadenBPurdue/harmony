// src/main/utils/safe_storage.js
import fs from "fs";
import path from "path";
import { safeStorage } from "electron";
import { app } from "electron";

// Storage paths
const storagePath = path.join(app.getPath("userData"), "secure");
const spotifyPath = path.join(storagePath, "spotify.enc");
const appleMusicPath = path.join(storagePath, "applemusic.enc");
const googlePath = path.join(storagePath, "google.enc");

console.log("[SafeStorage] Storage paths:", {
  storagePath,
  spotifyPath,
  appleMusicPath,
  googlePath,
});

// Create storage directory if it doesn't exist
if (!fs.existsSync(storagePath)) {
  console.log("[SafeStorage] Creating storage directory");
  fs.mkdirSync(storagePath, { recursive: true });
}

const isDevelopment = process.env.NODE_ENV === "development";
console.log(
  "[SafeStorage] Running in",
  isDevelopment ? "development" : "production",
  "mode",
);

// In development, we'll use JSON files instead of encrypted storage
function saveEncrypted(data, filePath) {
  console.log("[SafeStorage] Attempting to save data to:", filePath);
  console.log("[SafeStorage] Data to save:", data);

  try {
    if (isDevelopment) {
      // In development, store as JSON
      const devPath = `${filePath}.json`;
      console.log(
        "[SafeStorage] Development mode: storing as JSON at:",
        devPath,
      );
      fs.writeFileSync(devPath, JSON.stringify(data, null, 2));
      console.log("[SafeStorage] Successfully saved data to JSON file");
      return true;
    }

    // In production, use encryption
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("System encryption not available");
    }

    console.log("[SafeStorage] Encrypting and saving to disk");
    const encryptedData = safeStorage.encryptString(JSON.stringify(data));
    fs.writeFileSync(filePath, encryptedData);
    console.log("[SafeStorage] Successfully saved encrypted data");
    return true;
  } catch (error) {
    console.error("[SafeStorage] Error saving data:", error);
    return false;
  }
}

function loadEncrypted(filePath) {
  console.log("[SafeStorage] Attempting to load data from:", filePath);

  try {
    if (isDevelopment) {
      // In development, load from JSON
      const devPath = `${filePath}.json`;
      console.log(
        "[SafeStorage] Development mode: loading from JSON file:",
        devPath,
      );
      if (!fs.existsSync(devPath)) {
        console.log("[SafeStorage] No development JSON file exists");
        return null;
      }

      const data = JSON.parse(fs.readFileSync(devPath, "utf8"));
      console.log("[SafeStorage] Successfully loaded data from JSON:", data);
      return data;
    }

    // In production, load encrypted data
    if (!fs.existsSync(filePath)) {
      console.log("[SafeStorage] No file exists at path:", filePath);
      return null;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("System encryption not available");
    }

    console.log("[SafeStorage] Loading and decrypting file");
    const encryptedData = fs.readFileSync(filePath);
    const decryptedString = safeStorage.decryptString(encryptedData);
    const data = JSON.parse(decryptedString);
    console.log("[SafeStorage] Successfully loaded data:", data);
    return data;
  } catch (error) {
    console.error("[SafeStorage] Error loading data:", error);
    return null;
  }
}

export function setSpotifyToken(token) {
  console.log("[SafeStorage] Setting Spotify token:", token);
  return saveEncrypted(token, spotifyPath);
}

export function getSpotifyToken() {
  console.log("[SafeStorage] Getting Spotify token");
  const token = loadEncrypted(spotifyPath);
  console.log("[SafeStorage] Retrieved Spotify token:", token);
  return token;
}

export function clearSpotifyToken() {
  console.log("[SafeStorage] Clearing Spotify token");
  const filePath = spotifyPath;
  const devPath = `${filePath}.json`;

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  if (fs.existsSync(devPath)) {
    fs.unlinkSync(devPath);
  }
}

export function setAppleMusicToken(token) {
  console.log("[SafeStorage] Setting Apple Music token:", token);
  return saveEncrypted(token, appleMusicPath);
}

export function getAppleMusicToken() {
  console.log("[SafeStorage] Getting Apple Music token");
  const token = loadEncrypted(appleMusicPath);
  console.log("[SafeStorage] Retrieved Apple Music token:", token);
  return token;
}

export function clearAppleMusicToken() {
  console.log("[SafeStorage] Clearing Apple Music token");
  const filePath = appleMusicPath;
  const devPath = `${filePath}.json`;

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  if (fs.existsSync(devPath)) {
    fs.unlinkSync(devPath);
  }
}

export function setGoogleToken(token) {
  console.log("[SafeStorage] Setting Google token:", token);
  return saveEncrypted(token, path.join(storagePath, "google.enc"));
}

export function getGoogleToken() {
  console.log("[SafeStorage] Getting Google token");
  const token = loadEncrypted(path.join(storagePath, "google.enc"));
  console.log("[SafeStorage] Retrieved Google token:", token);
  return token;
}

export function clearGoogleToken() {
  console.log("[SafeStorage] Clearing Google token");
  const filePath = path.join(storagePath, "google.enc");
  const devPath = `${filePath}.json`;

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  if (fs.existsSync(devPath)) {
    fs.unlinkSync(devPath);
  }
}

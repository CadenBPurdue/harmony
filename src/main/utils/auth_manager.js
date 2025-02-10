import dotenv from "dotenv";
import { BrowserWindow } from "electron";
import fetch from "node-fetch";

dotenv.config();

let spotifyToken = null;
let authWindow = null;

function validateCredentials(clientId, clientSecret) {
  return clientId?.length === 32 && clientSecret?.length === 32;
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}

function closeAuthWindow() {
  if (authWindow) {
    authWindow.close();
    authWindow = null;
  }
}

async function exchangeCodeForToken(code) {
  console.log("Exchanging code for token...");
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = "http://localhost:8888/callback";

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok)
      throw new Error(
        `Token exchange failed: ${response.status} ${response.statusText}`,
      );

    const data = await response.json();
    spotifyToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      timestamp: Date.now(),
    };

    console.log("Token exchange successful");
  } catch (error) {
    console.error("Token exchange error:", error);
    throw error;
  }
}

function handleNavigation(url, expectedState, resolve, reject) {
  if (!url.startsWith("http://localhost:8888/callback")) return;
  const urlObj = new URL(url);
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const error = urlObj.searchParams.get("error");

  if (error) return reject(new Error(`Authentication error: ${error}`));
  if (state !== expectedState)
    return reject(new Error("State mismatch in callback"));
  if (!code) return reject(new Error("No authorization code received"));

  exchangeCodeForToken(code)
    .then(() => resolve({ success: true }))
    .catch(reject)
    .finally(closeAuthWindow);
}

function createAuthWindow(authUrl, state, resolve, reject) {
  if (authWindow) {
    authWindow.focus();
    return;
  }

  authWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  authWindow.webContents.on("will-navigate", (event, url) =>
    handleNavigation(url, state, resolve, reject),
  );
  authWindow.webContents.on("will-redirect", (event, url) =>
    handleNavigation(url, state, resolve, reject),
  );
  authWindow.on("closed", () => {
    authWindow = null;
    if (!spotifyToken) reject(new Error("Authentication window was closed"));
  });
  authWindow.loadURL(authUrl.toString());
}

function initiateSpotifyAuth() {
  console.log("Initiating Spotify auth...");
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!validateCredentials(clientId, clientSecret))
    throw new Error("Invalid Spotify credentials");

  const redirectUri = "http://localhost:8888/callback";
  const scope =
    "user-read-private user-read-email playlist-read-private playlist-modify-public";
  const state = generateState();
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("scope", scope);
  authUrl.searchParams.append("show_dialog", "true");
  authUrl.searchParams.append("state", state);

  return new Promise((resolve, reject) =>
    createAuthWindow(authUrl, state, resolve, reject),
  );
}

function getAuthStatus() {
  return {
    isSpotifyAuthenticated: !!spotifyToken?.accessToken,
    tokenExpiresIn: spotifyToken
      ? Math.floor(
          (spotifyToken.timestamp +
            spotifyToken.expiresIn * 1000 -
            Date.now()) /
            1000,
        )
      : null,
  };
}

export { initiateSpotifyAuth, getAuthStatus };

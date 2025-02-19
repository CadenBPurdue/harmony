// src/main/utils/auth_manager.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { BrowserWindow } from "electron";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import {
  getSpotifyToken,
  setSpotifyToken,
  getAppleMusicToken,
  setAppleMusicToken,
  getGoogleToken,
  setGoogleToken,
  clearGoogleToken,
} from "./safe_storage.js";

const isDev = process.env.NODE_ENV === "development";

const envPath = isDev
  ? ".env" // In development, .env is at your project root
  : path.join(process.resourcesPath, ".env"); // In production, .env is in the resources folder

dotenv.config({ path: envPath });

function base64decode(base64) {
  if (process.env.NODE_ENV === "development") {
    return base64;
  }

  return Buffer.from(base64, "base64").toString("utf-8");
}

console.log("[AuthManager] Initializing tokens...");
let spotifyToken = null;
let appleMusicToken = null;
let googleToken = null;

try {
  spotifyToken = getSpotifyToken();
  console.log("[AuthManager] Loaded Spotify token:", spotifyToken);
} catch (error) {
  console.error("[AuthManager] Error loading Spotify token:", error);
}

try {
  appleMusicToken = getAppleMusicToken();
  console.log("[AuthManager] Loaded Apple Music token:", appleMusicToken);
} catch (error) {
  console.error("[AuthManager] Error loading Apple Music token:", error);
}

try {
  googleToken = getGoogleToken();
  console.log("[AuthManager] Loaded Google token:", googleToken);
} catch (error) {
  console.error("[AuthManager] Error loading Google token:", error);
  clearGoogleToken();
  googleToken = null;
}

let spotifyAuthWindow = null;
let appleMusicAuthWindow = null;
let googleAuthWindow = null;

// Helper Functions
function validateCredentials(clientId, clientSecret) {
  return clientId?.length === 32 && clientSecret?.length === 32;
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}

// Spotify Auth Functions
function closeSpotifyAuthWindow() {
  if (spotifyAuthWindow) {
    spotifyAuthWindow.close();
    spotifyAuthWindow = null;
  }
}

async function exchangeSpotifyCodeForToken(code) {
  const clientId = base64decode(process.env.SPOTIFY_CLIENT_ID);
  const clientSecret = base64decode(process.env.SPOTIFY_CLIENT_SECRET);
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

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    spotifyToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      timestamp: Date.now(),
    };
    setSpotifyToken(spotifyToken);
  } catch (error) {
    console.error("Spotify Token exchange error:", error);
    throw error;
  }
}

function handleSpotifyNavigation(url, expectedState, resolve, reject) {
  if (!url.startsWith("http://localhost:8888/callback")) {
    return;
  }

  const urlObj = new URL(url);
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const error = urlObj.searchParams.get("error");

  if (error) {
    reject(new Error(`Authentication error: ${error}`));
    closeSpotifyAuthWindow();
    return;
  }
  if (state !== expectedState) {
    reject(new Error("State mismatch in callback"));
    closeSpotifyAuthWindow();
    return;
  }
  if (!code) {
    reject(new Error("No authorization code received"));
    closeSpotifyAuthWindow();
    return;
  }

  exchangeSpotifyCodeForToken(code)
    .then(() => {
      resolve({ success: true });
    })
    .catch(reject)
    .finally(() => {
      closeSpotifyAuthWindow();
    });
}

function createSpotifyAuthWindow(authUrl, state, resolve, reject) {
  if (spotifyAuthWindow) {
    spotifyAuthWindow.focus();
    return;
  }

  spotifyAuthWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // CSP headers to include Spotify's CDN domains
  spotifyAuthWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self' https://*.spotify.com https://*.scdn.co https://www.google.com https://www.gstatic.com;",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.spotify.com https://*.scdn.co https://www.google.com https://www.gstatic.com;",
            "style-src 'self' 'unsafe-inline' https://*.spotify.com https://*.scdn.co https://*.apple.com https://fonts.googleapis.com https://www.gstatic.com https://accounts.google.com;",
            "img-src 'self' https://*.spotify.com https://*.scdn.co https://www.google.com https://www.gstatic.com data:;",
            "font-src 'self' data: https://*.scdn.co https://*.apple.com https://fonts.gstatic.com https://accounts.google.com;",
            "connect-src 'self' https://*.spotify.com https://*.scdn.co https://*.ingest.sentry.io https://api.spotify.com https://www.google.com https://*.apple.com https://api.music.apple.com https://*.googleapis.com https://*.firebaseapp.com https://accounts.google.com;",
            "media-src 'self' https://*.spotify.com https://*.scdn.co;",
            "frame-src 'self' https://*.spotify.com https://*.scdn.co https://www.google.com https://recaptcha.google.com;",
          ].join(" "),
        },
      });
    },
  );

  // Certificate handling
  spotifyAuthWindow.webContents.session.setCertificateVerifyProc(
    (request, callback) => {
      callback(0);
    },
  );

  spotifyAuthWindow.webContents.on("will-navigate", (event, url) => {
    handleSpotifyNavigation(url, state, resolve, reject);
  });

  spotifyAuthWindow.on("closed", () => {
    spotifyAuthWindow = null;
    if (!spotifyToken) {
      reject(new Error("Authentication window was closed"));
    }
  });

  spotifyAuthWindow
    .loadURL(authUrl.toString(), {
      extraHeaders: "Origin: https://accounts.spotify.com\n",
    })
    .catch((error) => {
      reject(error);
    });
}

function initiateSpotifyAuth() {
  const clientId = base64decode(process.env.SPOTIFY_CLIENT_ID);
  const clientSecret = base64decode(process.env.SPOTIFY_CLIENT_SECRET);

  if (!validateCredentials(clientId, clientSecret)) {
    throw new Error("Invalid Spotify credentials");
  }

  const redirectUri = "http://localhost:8888/callback";
  const scope =
    "user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private";
  const state = generateState();

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("scope", scope);
  authUrl.searchParams.append("show_dialog", "true");
  authUrl.searchParams.append("state", state);

  return new Promise((resolve, reject) => {
    try {
      createSpotifyAuthWindow(authUrl, state, resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Apple Music Auth Functions
function generateAppleMusicToken() {
  try {
    const teamId = base64decode(process.env.APPLE_TEAM_ID);
    const keyId = base64decode(process.env.APPLE_KEY_ID);
    const privateKey = base64decode(process.env.APPLE_PRIVATE_KEY);

    if (!teamId || !keyId || !privateKey) {
      throw new Error("Missing required environment variables");
    }

    const token = jwt.sign({}, privateKey, {
      algorithm: "ES256",
      expiresIn: "180d",
      issuer: teamId,
      header: {
        alg: "ES256",
        kid: keyId,
      },
    });

    return token;
  } catch (error) {
    console.error("Error in generateAppleMusicToken:", error);
    throw error;
  }
}

async function initiateAppleMusicAuth() {
  let isAuthenticating = false; // Flag to prevent multiple authentications

  try {
    const devToken = generateAppleMusicToken();

    return new Promise((resolve, reject) => {
      if (appleMusicAuthWindow) {
        appleMusicAuthWindow.focus();
        return;
      }

      appleMusicAuthWindow = new BrowserWindow({
        width: 800,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
          webviewTag: false,
          sandbox: true,
          experimentalFeatures: true,
          enableRemoteModule: false,
        },
        show: true,
        backgroundColor: "#ffffff",
      });

      // Permission handling for iframes
      appleMusicAuthWindow.webContents.session.setPermissionRequestHandler(
        (webContents, permission, callback) => {
          callback(true);
        },
      );

      // Handle potential certificate errors
      appleMusicAuthWindow.webContents.session.setCertificateVerifyProc(
        (request, callback) => {
          callback(0);
        },
      );

      // CSP headers
      appleMusicAuthWindow.webContents.session.webRequest.onHeadersReceived(
        (details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              "Content-Security-Policy": [
                "default-src 'self' https://*.apple.com https://appleid.apple.com https://*.cdn-apple.com https://idmsa.apple.com;",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.apple.com https://appleid.apple.com https://*.cdn-apple.com https://idmsa.apple.com;",
                "connect-src 'self' https://*.apple.com https://appleid.apple.com https://*.cdn-apple.com https://idmsa.apple.com wss://*.apple.com;",
                "style-src 'self' 'unsafe-inline' https://*.apple.com https://appleid.apple.com https://*.cdn-apple.com https://idmsa.apple.com;",
                "img-src 'self' data: https://*.apple.com https://*.cdn-apple.com https://appleid.apple.com https://idmsa.apple.com;",
                "frame-src 'self' https://*.apple.com https://appleid.apple.com https://*.cdn-apple.com https://idmsa.apple.com;",
                "form-action 'self' https://*.apple.com https://appleid.apple.com https://idmsa.apple.com;",
                "child-src 'self' https://*.apple.com https://appleid.apple.com https://idmsa.apple.com blob:;",
                "worker-src 'self' blob:;",
              ].join(" "),
            },
          });
        },
      );

      async function checkForAppleMusicSuccess(url) {
        if (isAuthenticating || !appleMusicAuthWindow) return;

        if (
          url.includes("music.apple.com/new") ||
          url.includes("music.apple.com/us/browse") ||
          url.includes("music.apple.com/library") ||
          url.includes("music.apple.com/listen-now")
        ) {
          isAuthenticating = true;

          try {
            // Get cookies before closing the window
            const cookies =
              await appleMusicAuthWindow.webContents.session.cookies.get({
                domain: ".apple.com",
              });

            // Find the music user token cookie
            const musicUserTokenCookie = cookies.find(
              (cookie) =>
                cookie.name === "media-user-token" ||
                cookie.name === "music-user-token",
            );

            if (!musicUserTokenCookie) {
              throw new Error("Music user token cookie not found");
            }

            appleMusicToken = {
              token: devToken,
              userToken: musicUserTokenCookie.value,
              timestamp: Date.now(),
              expiresIn: 180 * 24 * 60 * 60, // 180 days
            };

            await setAppleMusicToken(appleMusicToken);

            // Store the success state
            const success = { success: true };

            // Close the window
            if (appleMusicAuthWindow) {
              appleMusicAuthWindow.destroy();
              appleMusicAuthWindow = null;
            }

            // Resolve with the success state
            resolve(success);
          } catch (error) {
            console.error("Error during authentication:", error);
            if (appleMusicAuthWindow) {
              appleMusicAuthWindow.destroy();
              appleMusicAuthWindow = null;
            }
            reject(error);
          }
        }
      }

      // Window event handlers
      appleMusicAuthWindow.on("closed", () => {
        if (appleMusicAuthWindow) {
          appleMusicAuthWindow = null;
        }
        if (!appleMusicToken?.userToken && !isAuthenticating) {
          reject(new Error("Authentication window was closed"));
        }
      });

      // Navigation event handlers
      appleMusicAuthWindow.webContents.on("did-navigate", (event, url) => {
        checkForAppleMusicSuccess(url);
      });

      appleMusicAuthWindow.webContents.on(
        "did-navigate-in-page",
        (event, url) => {
          checkForAppleMusicSuccess(url);
        },
      );

      appleMusicAuthWindow.webContents.on("will-redirect", (event, url) => {
        checkForAppleMusicSuccess(url);
      });

      // Frame loading listener
      appleMusicAuthWindow.webContents.on("did-frame-finish-load", () => {
        if (appleMusicAuthWindow) {
          const currentURL = appleMusicAuthWindow.webContents.getURL();
          checkForAppleMusicSuccess(currentURL);
        }
      });

      // Error handling
      appleMusicAuthWindow.webContents.on(
        "did-fail-load",
        (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
          console.error("Failed to load:", {
            errorCode,
            errorDescription,
            validatedURL,
            isMainFrame,
          });
        },
      );

      // Load the Apple Music URL
      const musicKitUrl = new URL("https://music.apple.com/us/login");
      musicKitUrl.searchParams.append("app", "music");
      musicKitUrl.searchParams.append("musickit", "true");
      musicKitUrl.searchParams.append("developer_token", devToken);

      appleMusicAuthWindow.loadURL(musicKitUrl.toString(), {
        extraHeaders: `MusicKit-Developer-Token: ${devToken}\nOrigin: https://music.apple.com`,
      });
    });
  } catch (error) {
    console.error("Apple Music auth error:", error);
    throw error;
  }
}

// Google Auth Functions
function closeGoogleAuthWindow() {
  if (googleAuthWindow) {
    googleAuthWindow.close();
    googleAuthWindow = null;
  }
}

async function exchangeGoogleCodeForToken(code) {
  const clientId = base64decode(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = base64decode(process.env.GOOGLE_CLIENT_SECRET);
  const redirectUri = base64decode(process.env.GOOGLE_REDIRECT_URI);

  const tokenUrl = "https://oauth2.googleapis.com/token";

  const params = new URLSearchParams();
  params.append("code", code);
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("redirect_uri", redirectUri);
  params.append("grant_type", "authorization_code");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  const tokens = await response.json();

  // Store tokens in safe storage
  googleToken = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    expiresIn: tokens.expires_in,
    timestamp: Date.now(),
  };

  await setGoogleToken(googleToken);
  return tokens;
}

function handleGoogleNavigation(url, expectedState, resolve, reject) {
  const redirectUri = base64decode(process.env.GOOGLE_REDIRECT_URI);
  if (!url.startsWith(redirectUri)) {
    return;
  }

  const urlObj = new URL(url);
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const error = urlObj.searchParams.get("error");

  if (error) {
    reject(new Error(`Authentication error: ${error}`));
    closeGoogleAuthWindow();
    return;
  }
  if (state !== expectedState) {
    reject(new Error("State mismatch in callback"));
    closeGoogleAuthWindow();
    return;
  }
  if (!code) {
    reject(new Error("No authorization code received"));
    closeGoogleAuthWindow();
    return;
  }

  exchangeGoogleCodeForToken(code)
    .then((tokens) => {
      resolve(tokens);
    })
    .catch(reject)
    .finally(() => {
      closeGoogleAuthWindow();
    });
}

function createGoogleAuthWindow(authUrl, state, resolve, reject) {
  if (googleAuthWindow) {
    googleAuthWindow.focus();
    return;
  }

  googleAuthWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // CSP headers
  googleAuthWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self' https://*.google.com https://accounts.google.com;",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://accounts.google.com;",
            "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://accounts.google.com https://ssl.gstatic.com;",
            "style-src 'self' 'unsafe-inline' https://*.google.com https://accounts.google.com;",
            "style-src-elem 'self' 'unsafe-inline' https://*.google.com https://accounts.google.com https://*.gstatic.com;",
            "img-src 'self' data: https://*.google.com https://accounts.google.com https://lh3.googleusercontent.com https://ssl.gstatic.com;",
            "font-src 'self' data: https://*.google.com https://accounts.google.com https://fonts.gstatic.com;",
            "connect-src 'self' https://*.google.com https://accounts.google.com;",
            "frame-src 'self' https://*.google.com https://accounts.google.com;",
          ].join(" "),
        },
      });
    },
  );

  googleAuthWindow.loadURL(authUrl.toString()).catch((err) => {
    reject(err);
  });

  // Listen for navigation events that may indicate our callback URL.
  googleAuthWindow.webContents.on("will-redirect", (event, url) => {
    handleGoogleNavigation(url, state, resolve, reject);
  });
  googleAuthWindow.webContents.on("did-navigate", (event, url) => {
    handleGoogleNavigation(url, state, resolve, reject);
  });

  googleAuthWindow.on("closed", () => {
    googleAuthWindow = null;
    // Reject with a cancellation error and a flag (or custom message) indicating user cancellation
    reject(new Error("Authentication window was closed by the user."));
  });
}

async function initiateGoogleAuth() {
  return new Promise((resolve, reject) => {
    // Check if we have a valid token
    if (googleToken && googleToken.timestamp) {
      const expirationTime =
        googleToken.timestamp + googleToken.expiresIn * 1000;
      if (Date.now() < expirationTime) {
        return resolve(googleToken);
      }
    }

    const clientId = base64decode(process.env.GOOGLE_CLIENT_ID);
    const clientSecret = base64decode(process.env.GOOGLE_CLIENT_SECRET);
    const redirectUri = base64decode(process.env.GOOGLE_REDIRECT_URI);

    const scope = "openid email profile";
    const state = generateState();

    // Build the Google OAuth URL.
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", scope);
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("prompt", "consent");

    createGoogleAuthWindow(authUrl, state, resolve, reject);
  });
}

function clearAuthData() {
  clearGoogleToken();
  googleToken = null;
}

function getAuthStatus() {
  return {
    isSpotifyAuthenticated: !!spotifyToken?.accessToken,
    isAppleMusicAuthenticated: !!appleMusicToken?.userToken,
    isGoogleAuthenticated: !!googleToken?.accessToken,
    spotifyExpiresIn: spotifyToken
      ? Math.floor(
          (spotifyToken.timestamp +
            spotifyToken.expiresIn * 1000 -
            Date.now()) /
            1000,
        )
      : null,
    appleMusicExpiresIn: appleMusicToken
      ? Math.floor(
          (appleMusicToken.timestamp +
            appleMusicToken.expiresIn * 1000 -
            Date.now()) /
            1000,
        )
      : null,
    googleExpiresIn: googleToken
      ? Math.floor(
          (googleToken.timestamp + googleToken.expiresIn * 1000 - Date.now()) /
            1000,
        )
      : null,
  };
}

export {
  initiateSpotifyAuth,
  initiateAppleMusicAuth,
  initiateGoogleAuth,
  getAuthStatus,
  clearAuthData,
};

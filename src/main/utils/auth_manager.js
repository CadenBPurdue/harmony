// src/main/utils/auth_manager.js
import fs from "fs";
import dotenv from "dotenv";
import { BrowserWindow } from "electron";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import {
  getSpotifyToken,
  setSpotifyToken,
  getAppleMusicToken,
  setAppleMusicToken,
} from "./safe_storage.js";

dotenv.config();

console.log("[AuthManager] Initializing tokens...");
let spotifyToken = null;
let appleMusicToken = null;

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

let spotifyAuthWindow = null;
let appleMusicAuthWindow = null;

// Spotify-specific functions
function validateCredentials(clientId, clientSecret) {
  return clientId?.length === 32 && clientSecret?.length === 32;
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}

function closeSpotifyAuthWindow() {
  console.log("[Spotify] Attempting to close auth window");
  if (spotifyAuthWindow) {
    console.log("[Spotify] Auth window exists, closing...");
    spotifyAuthWindow.close();
    spotifyAuthWindow = null;
    console.log("[Spotify] Auth window closed and reference cleared");
  } else {
    console.log("[Spotify] No auth window to close");
  }
}

function closeAppleMusicAuthWindow() {
  console.log("[Apple Music] Attempting to close auth window");
  if (appleMusicAuthWindow) {
    console.log("[Apple Music] Auth window exists, closing...");
    appleMusicAuthWindow.close();
    appleMusicAuthWindow = null;
    console.log("[Apple Music] Auth window closed and reference cleared");
  } else {
    console.log("[Apple Music] No auth window to close");
  }
}

async function exchangeCodeForToken(code) {
  console.log("[Spotify] Starting token exchange...");
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = "http://localhost:8888/callback";

  try {
    console.log("[Spotify] Making token exchange request...");
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
      console.error(
        "[Spotify] Token exchange failed:",
        response.status,
        response.statusText,
      );
      throw new Error(
        `Token exchange failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log("[Spotify] Token exchange response received");

    spotifyToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      timestamp: Date.now(),
    };
    console.log("[AuthManager] Setting new Spotify token:", spotifyToken);
    setSpotifyToken(spotifyToken);

    console.log("[Spotify] Token exchange successful");
  } catch (error) {
    console.error("[Spotify] Token exchange error:", error);
    throw error;
  }
}

function handleSpotifyNavigation(url, expectedState, resolve, reject) {
  console.log("[Spotify] Handling navigation to:", url);

  if (!url.startsWith("http://localhost:8888/callback")) {
    console.log("[Spotify] Not a callback URL, ignoring");
    return;
  }

  const urlObj = new URL(url);
  const code = urlObj.searchParams.get("code");
  const state = urlObj.searchParams.get("state");
  const error = urlObj.searchParams.get("error");

  console.log("[Spotify] Callback parameters:", { code: !!code, state, error });

  if (error) {
    console.error("[Spotify] Auth error in callback:", error);
    return reject(new Error(`Authentication error: ${error}`));
  }
  if (state !== expectedState) {
    console.error("[Spotify] State mismatch:", {
      expected: expectedState,
      received: state,
    });
    return reject(new Error("State mismatch in callback"));
  }
  if (!code) {
    console.error("[Spotify] No authorization code received");
    return reject(new Error("No authorization code received"));
  }

  console.log("[Spotify] Valid callback received, exchanging code for token");
  exchangeCodeForToken(code)
    .then(() => {
      console.log("[Spotify] Authentication completed successfully");
      resolve({ success: true });
    })
    .catch(reject)
    .finally(() => {
      console.log("[Spotify] Cleaning up after auth completion");
      closeSpotifyAuthWindow();
    });
}

function createSpotifyAuthWindow(authUrl, state, resolve, reject) {
  console.log("[Spotify] Creating auth window...");
  console.log("[Spotify] Auth URL:", authUrl.toString());

  if (spotifyAuthWindow) {
    console.log("[Spotify] Auth window already exists, focusing");
    spotifyAuthWindow.focus();
    return;
  }

  console.log("[Spotify] Creating new BrowserWindow");
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
            "style-src 'self' 'unsafe-inline' https://*.spotify.com https://*.scdn.co;",
            "img-src 'self' https://*.spotify.com https://*.scdn.co https://www.google.com https://www.gstatic.com data:;",
            "font-src 'self' https://*.spotify.com https://*.scdn.co https://encore.scdn.co data:;",
            "connect-src 'self' https://*.spotify.com https://*.scdn.co https://www.google.com;",
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

  console.log("[Spotify] Setting up event listeners");

  spotifyAuthWindow.webContents.on("did-start-loading", () => {
    console.log("[Spotify] Window started loading");
  });

  spotifyAuthWindow.webContents.on("did-finish-load", () => {
    console.log("[Spotify] Window finished loading");
    console.log(
      "[Spotify] Current URL:",
      spotifyAuthWindow.webContents.getURL(),
    );
  });

  spotifyAuthWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error("[Spotify] Failed to load:", {
        errorCode,
        errorDescription,
        validatedURL,
        isMainFrame,
      });
    },
  );

  spotifyAuthWindow.webContents.on("will-navigate", (event, url) => {
    console.log("[Spotify] Will navigate:", url);
    handleSpotifyNavigation(url, state, resolve, reject);
  });

  spotifyAuthWindow.webContents.on("will-redirect", (event, url) => {
    console.log("[Spotify] Will redirect:", url);
    handleSpotifyNavigation(url, state, resolve, reject);
  });

  spotifyAuthWindow.webContents.on(
    "console-message",
    (event, level, message) => {
      console.log("[Spotify Window Console]", message);
    },
  );

  spotifyAuthWindow.on("closed", () => {
    console.log("[Spotify] Window closed");
    spotifyAuthWindow = null;
    if (!spotifyToken) {
      console.log("[Spotify] No token present, rejecting");
      reject(new Error("Authentication window was closed"));
    }
  });

  console.log("[Spotify] Loading auth URL");
  spotifyAuthWindow
    .loadURL(authUrl.toString(), {
      extraHeaders: "Origin: https://accounts.spotify.com\n",
    })
    .catch((error) => {
      console.error("[Spotify] Error loading auth URL:", error);
      reject(error);
    });
}

// Apple Music specific functions
function generateAppleMusicToken() {
  console.log("Starting generateAppleMusicToken...");
  try {
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const privateKeyPath = process.env.APPLE_PRIVATE_KEY;

    if (!teamId || !keyId || !privateKeyPath) {
      throw new Error("Missing required environment variables");
    }

    const privateKey = fs.readFileSync(privateKeyPath, "utf8");
    console.log("Private key read successfully");

    const token = jwt.sign({}, privateKey, {
      algorithm: "ES256",
      expiresIn: "180d",
      issuer: teamId,
      header: {
        alg: "ES256",
        kid: keyId,
      },
    });
    console.log("JWT token generated successfully");

    return token;
  } catch (error) {
    console.error("Error in generateAppleMusicToken:", error);
    throw error;
  }
}

async function initiateAppleMusicAuth() {
  console.log("Starting initiateAppleMusicAuth...");
  let isAuthenticating = false; // Flag to prevent multiple authentications

  try {
    console.log("Generating developer token...");
    const devToken = generateAppleMusicToken();
    console.log("Developer token generated successfully");

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

      // Helper function to check for success
      function checkForSuccess(url) {
        if (isAuthenticating) return; // Skip if already authenticating

        console.log("Checking URL for success:", url);
        // Check for various success URLs
        if (
          url.includes("music.apple.com/new") ||
          url.includes("music.apple.com/us/browse") ||
          url.includes("music.apple.com/library") ||
          url.includes("music.apple.com/listen-now")
        ) {
          console.log("Success URL detected:", url);

          // Set flag to prevent multiple authentications
          isAuthenticating = true;

          // Give a small delay to ensure everything is settled
          setTimeout(() => {
            console.log("Setting Apple Music token...");
            appleMusicToken = {
              token: devToken,
              userToken: "authenticated",
              timestamp: Date.now(),
              expiresIn: 180 * 24 * 60 * 60,
            };
            console.log(
              "[AuthManager] Setting new Apple Music token:",
              appleMusicToken,
            );
            setAppleMusicToken(appleMusicToken);

            console.log("Closing auth window...");
            closeAppleMusicAuthWindow();

            console.log("Resolving auth promise...");
            resolve({ success: true });
          }, 500);
        }
      }

      // Single navigation listener for success check
      appleMusicAuthWindow.webContents.on("did-navigate", (event, url) => {
        console.log("Navigation occurred:", url);
        checkForSuccess(url);
      });

      appleMusicAuthWindow.webContents.on(
        "did-navigate-in-page",
        (event, url) => {
          console.log("In-page navigation occurred:", url);
          checkForSuccess(url);
        },
      );

      appleMusicAuthWindow.webContents.on("will-redirect", (event, url) => {
        console.log("Redirect detected:", url);
        checkForSuccess(url);
      });

      // Frame loading listener
      appleMusicAuthWindow.webContents.on("did-frame-finish-load", () => {
        console.log("Frame finished loading");
        const currentURL = appleMusicAuthWindow.webContents.getURL();
        console.log("Current URL after frame load:", currentURL);
        checkForSuccess(currentURL);
      });

      // Error handling for failed navigation
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

      appleMusicAuthWindow.on("closed", () => {
        console.log("Auth window closed event triggered");
        appleMusicAuthWindow = null;
        if (!appleMusicToken?.userToken && !isAuthenticating) {
          console.log("No user token found, rejecting with error");
          reject(new Error("Authentication window was closed"));
        } else {
          console.log("User token exists, window closed normally");
        }
      });

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

function initiateSpotifyAuth() {
  console.log("[Spotify] Initiating auth...");
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  console.log("[Spotify] Validating credentials");
  if (!validateCredentials(clientId, clientSecret)) {
    console.error("[Spotify] Invalid credentials");
    throw new Error("Invalid Spotify credentials");
  }

  const redirectUri = "http://localhost:8888/callback";
  const scope =
    "user-read-private user-read-email playlist-read-private playlist-modify-public";
  const state = generateState();

  console.log("[Spotify] Building auth URL");
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("scope", scope);
  authUrl.searchParams.append("show_dialog", "true");
  authUrl.searchParams.append("state", state);

  console.log("[Spotify] Starting auth process with URL:", authUrl.toString());
  return new Promise((resolve, reject) => {
    try {
      createSpotifyAuthWindow(authUrl, state, resolve, reject);
    } catch (error) {
      console.error("[Spotify] Error creating auth window:", error);
      reject(error);
    }
  });
}

function getAuthStatus() {
  console.log("[AuthManager] Checking auth status");
  console.log("[AuthManager] Current Spotify token:", spotifyToken);
  console.log("[AuthManager] Current Apple Music token:", appleMusicToken);

  return {
    isSpotifyAuthenticated: !!spotifyToken?.accessToken,
    isAppleMusicAuthenticated: !!appleMusicToken?.userToken,
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
  };
}

export { initiateSpotifyAuth, initiateAppleMusicAuth, getAuthStatus };

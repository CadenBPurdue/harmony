// src/main/utils/google_auth_manager.js
import dotenv from "dotenv";
import { BrowserWindow } from "electron";
import fetch from "node-fetch";
import { setGoogleToken, getGoogleToken } from "./safe_storage.js";
dotenv.config();

let googleAuthWindow = null;
let googleToken = null;

function generateState() {
  // Use a secure random generator in production
  return Math.random().toString(36).substring(2, 15);
}

// Initialize token
try {
  googleToken = getGoogleToken();
  console.log("[GoogleAuth] Loaded token:", googleToken);
} catch (error) {
  console.error("[GoogleAuth] Error loading token:", error);
}

function closeGoogleAuthWindow() {
  if (googleAuthWindow) {
    googleAuthWindow.close();
    googleAuthWindow = null;
  }
}

function handleGoogleNavigation(url, expectedState, resolve, reject) {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI; // e.g., "myapp://auth"
  if (!url.startsWith(redirectUri)) {
    // Not our callback URL—ignore
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

  // Exchange the authorization code for tokens.
  exchangeCodeForTokens(code)
    .then((tokens) => {
      resolve(tokens);
    })
    .catch(reject)
    .finally(() => {
      closeGoogleAuthWindow();
    });
}

async function exchangeCodeForTokens(code) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
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

  googleAuthWindow.loadURL(authUrl.toString()).catch((err) => reject(err));

  // Listen for navigation events that may indicate our callback URL.
  googleAuthWindow.webContents.on("will-redirect", (event, url) => {
    handleGoogleNavigation(url, state, resolve, reject);
  });
  googleAuthWindow.webContents.on("did-navigate", (event, url) => {
    handleGoogleNavigation(url, state, resolve, reject);
  });

  googleAuthWindow.on("closed", () => {
    googleAuthWindow = null;
    reject(new Error("Authentication window was closed"));
  });
}

export function initiateGoogleAuth() {
  return new Promise((resolve, reject) => {
    // Check if we have a valid token
    if (googleToken && googleToken.timestamp) {
      const expirationTime = googleToken.timestamp + (googleToken.expiresIn * 1000);
      if (Date.now() < expirationTime) {
        return resolve(googleToken);
      }
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI; // e.g., "myapp://auth"
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

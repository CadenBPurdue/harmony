// src/main/utils/auth_manager.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { BrowserWindow } from "electron";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

dotenv.config();

class AuthManager {
  constructor() {
    this.spotifyToken = null;
    this.appleMusicToken = null;
    this.authWindow = null;
    this.appleDeveloperToken = null;
    console.log("AuthManager initialized");
  }

  async initiateSpotifyAuth() {
    console.log("Initiating Spotify auth...");

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing Spotify credentials in environment variables");
    }

    if (this.authWindow) {
      console.log("Auth window already exists, focusing...");
      this.authWindow.focus();
      return;
    }

    const redirectUri = "http://localhost:8888/callback";
    const scope =
      "user-read-private user-read-email playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private";
    const state = Math.random().toString(36).substring(2, 15);

    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("scope", scope);
    authUrl.searchParams.append("show_dialog", "true");
    authUrl.searchParams.append("state", state);

    console.log("Auth URL generated:", authUrl.toString());

    return new Promise((resolve, reject) => {
      try {
        console.log("Creating auth window...");
        this.authWindow = new BrowserWindow({
          width: 800,
          height: 600,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        // Log all navigation events
        this.authWindow.webContents.on("did-start-loading", () => {
          console.log("Started loading:", this.authWindow.webContents.getURL());
        });

        this.authWindow.webContents.on("did-finish-load", () => {
          console.log(
            "Finished loading:",
            this.authWindow.webContents.getURL(),
          );
        });

        this.authWindow.webContents.on(
          "did-fail-load",
          (event, errorCode, errorDescription) => {
            console.error("Failed to load:", {
              errorCode,
              errorDescription,
              url: this.authWindow.webContents.getURL(),
            });
          },
        );

        // Handle navigation events
        this.authWindow.webContents.on("will-navigate", (event, url) => {
          console.log("Will navigate to:", url);
          this.handleNavigation(url, state, resolve, reject);
        });

        this.authWindow.webContents.on("will-redirect", (event, url) => {
          console.log("Will redirect to:", url);
          this.handleNavigation(url, state, resolve, reject);
        });

        // New: Handle page title updates
        this.authWindow.webContents.on("page-title-updated", (event, title) => {
          console.log("Page title updated:", title);
        });

        // New: Log any console messages from the auth window
        this.authWindow.webContents.on(
          "console-message",
          (event, level, message) => {
            console.log("Auth window console:", message);
          },
        );

        this.authWindow.on("closed", () => {
          console.log("Auth window closed");
          this.authWindow = null;
          if (!this.spotifyToken) {
            reject(new Error("Authentication window was closed"));
          }
        });

        console.log("Loading auth URL:", authUrl.toString());
        this.authWindow.loadURL(authUrl.toString());
      } catch (error) {
        console.error("Error in auth window creation:", error);
        reject(error);
        this.closeAuthWindow();
      }
    });
  }

  async initiateAppleMusicAuth() {
    console.log("Initiating Apple Music auth...");

    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const privateKey = process.env.APPLE_PRIVATE_KEY;

    if (!teamId || !keyId || !privateKey) {
      throw new Error(
        "Missing Apple Music credentials in environment variables",
      );
    }

    // Generate developer token if not exists
    if (!this.appleDeveloperToken) {
      this.appleDeveloperToken = this.generateAppleDeveloperToken(
        teamId,
        keyId,
        privateKey,
      );
    }

    if (this.authWindow) {
      console.log("Auth window already exists, focusing...");
      this.authWindow.focus();
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.authWindow = new BrowserWindow({
          width: 800,
          height: 600,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });

        // Inject MusicKit.js and initialize
        const musicKitScript = `
          <script src="https://js-cdn.music.apple.com/musickit/v1/musickit.js"></script>
          <script>
            document.addEventListener('musickitloaded', async () => {
              try {
                const music = await MusicKit.configure({
                  developerToken: '${this.appleDeveloperToken}',
                  app: {
                    name: 'Harmony',
                    build: '1.0.0'
                  }
                });
                
                const instance = await window.MusicKit.getInstance();
                await instance.authorize();
                
                const userToken = await instance.musicUserToken;
                window.location.href = 'harmony://callback?token=' + encodeURIComponent(userToken);
              } catch (error) {
                window.location.href = 'harmony://callback?error=' + encodeURIComponent(error.message);
              }
            });
          </script>
        `;

        this.authWindow.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(musicKitScript)}`,
        );

        // Handle navigation events for Apple Music
        this.authWindow.webContents.on("will-navigate", (event, url) => {
          this.handleAppleMusicCallback(url, resolve, reject);
        });

        this.authWindow.on("closed", () => {
          this.authWindow = null;
          if (!this.appleMusicToken) {
            reject(new Error("Authentication window was closed"));
          }
        });
      } catch (error) {
        console.error("Error in Apple Music auth window creation:", error);
        reject(error);
        this.closeAuthWindow();
      }
    });
  }

  generateAppleDeveloperToken(teamId, keyId, privateKey) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: teamId,
      exp: now + 180 * 24 * 60 * 60, // 180 days
      iat: now,
    };

    return jwt.sign(payload, privateKey, {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: keyId,
      },
    });
  }

  handleAppleMusicCallback(url, resolve, reject) {
    if (url.startsWith("harmony://callback")) {
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get("token");
      const error = urlObj.searchParams.get("error");

      if (error) {
        reject(new Error(`Apple Music authentication error: ${error}`));
      } else if (token) {
        this.appleMusicToken = {
          userToken: token,
          developerToken: this.appleDeveloperToken,
          timestamp: Date.now(),
        };
        resolve({ success: true });
      }

      this.closeAuthWindow();
    }
  }

  handleNavigation(url, expectedState, resolve, reject) {
    console.log("Handling navigation to:", url);

    try {
      if (url.startsWith("http://localhost:8888/callback")) {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get("code");
        const error = urlObj.searchParams.get("error");
        const state = urlObj.searchParams.get("state");

        console.log("Callback parameters:", {
          hasCode: !!code,
          error: error || "none",
          stateMatch: state === expectedState,
        });

        if (error) {
          throw new Error(`Authentication error: ${error}`);
        }

        if (state !== expectedState) {
          throw new Error("State mismatch in callback");
        }

        if (code) {
          this.exchangeCodeForToken(code)
            .then(() => {
              resolve({ success: true });
              this.closeAuthWindow();
            })
            .catch((err) => {
              console.error("Token exchange failed:", err);
              reject(err);
              this.closeAuthWindow();
            });
        }
      }
    } catch (error) {
      console.error("Navigation handling error:", error);
      reject(error);
      this.closeAuthWindow();
    }
  }

  validateCredentials(clientId, clientSecret) {
    if (!clientId || !clientSecret) {
      console.error("Missing credentials:", {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
      });
      return false;
    }

    // Basic format validation
    const isValidClientId = clientId.length === 32;
    const isValidClientSecret = clientSecret.length === 32;

    console.log("Credential validation:", {
      clientIdLength: clientId.length,
      clientSecretLength: clientSecret.length,
      isValidClientId,
      isValidClientSecret,
    });

    return isValidClientId && isValidClientSecret;
  }

  generateState() {
    return Math.random().toString(36).substring(2, 15);
  }

  createAuthWindow(authUrl, state, resolve, reject) {
    console.log("Creating auth window...");

    this.authWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      show: false,
    });

    // Log navigation events
    this.authWindow.webContents.on("will-navigate", (event, url) => {
      console.log("Navigation detected:", url);
      if (url.startsWith("http://localhost:8888/callback")) {
        event.preventDefault();
        this.handleCallback(url, state, resolve, reject);
      }
    });

    this.authWindow.webContents.on("will-redirect", (event, url) => {
      console.log("Redirect detected:", url);
      if (url.startsWith("http://localhost:8888/callback")) {
        event.preventDefault();
        this.handleCallback(url, state, resolve, reject);
      }
    });

    // Add error handling for page loads
    this.authWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription) => {
        console.error("Page load failed:", {
          errorCode,
          errorDescription,
          url: this.authWindow.webContents.getURL(),
        });
      },
    );

    this.authWindow.webContents.on("did-finish-load", () => {
      console.log("Page loaded:", this.authWindow.webContents.getURL());
      this.authWindow.show();
    });

    this.authWindow.on("closed", () => {
      console.log("Auth window closed");
      this.authWindow = null;
      if (!this.spotifyToken) {
        reject(new Error("Authentication window was closed"));
      }
    });

    console.log("Loading auth URL:", authUrl.toString());
    this.authWindow.loadURL(authUrl.toString());
  }

  async handleCallback(url, originalState, resolve, reject) {
    console.log("Processing callback URL...");
    try {
      const urlObj = new URL(url);
      const params = Object.fromEntries(urlObj.searchParams);

      console.log("Callback parameters:", {
        ...params,
        code: params.code ? `${params.code.substring(0, 6)}...` : undefined,
      });

      if (params.error) {
        throw new Error(`Spotify auth error: ${params.error}`);
      }

      if (params.state !== originalState) {
        throw new Error("State mismatch in callback");
      }

      if (!params.code) {
        throw new Error("No authorization code received");
      }

      await this.exchangeCodeForToken(params.code);
      resolve({ success: true });
    } catch (error) {
      console.error("Callback handling failed:", error);
      reject(error);
    } finally {
      this.closeAuthWindow();
    }
  }

  async exchangeCodeForToken(code) {
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

      const responseText = await response.text();
      console.log("Token exchange response:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        body: responseText.substring(0, 100) + "...", // Log first 100 chars of response
      });

      if (!response.ok) {
        throw new Error(
          `Token exchange failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = JSON.parse(responseText);
      this.spotifyToken = {
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

  getAuthStatus() {
    return {
      isSpotifyAuthenticated: !!this.spotifyToken?.accessToken,
      isAppleMusicAuthenticated: !!this.appleMusicToken?.userToken,
      spotifyTokenExpiresIn: this.spotifyToken
        ? Math.floor(
            (this.spotifyToken.timestamp +
              this.spotifyToken.expiresIn * 1000 -
              Date.now()) /
              1000,
          )
        : null,
      hasAppleMusicDeveloperToken: !!this.appleDeveloperToken,
    };
  }

  closeAuthWindow() {
    if (this.authWindow) {
      this.authWindow.close();
      this.authWindow = null;
    }
  }
}

const authManager = new AuthManager();
export { authManager };

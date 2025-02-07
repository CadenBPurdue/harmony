// src/main/utils/auth_manager.js
import http from "http";
import { URL } from "url";
import { BrowserWindow, session } from "electron";
import { getAuthConstants } from "./constants";

class AuthManager {
  constructor() {
    this.authWindow = null;
    this.isSpotifyAuthenticated = false;
    this.spotifyAuthData = null;
    this.server = null;
    this.serverPort = 8888;
  }

  createCallbackServer(resolve, reject) {
    return new Promise((serverResolve) => {
      this.server = http.createServer((req, res) => {
        (async () => {
          try {
            const urlParams = new URL(
              req.url,
              `http://localhost:${this.serverPort}`,
            );
            const code = urlParams.searchParams.get("code");
            const error = urlParams.searchParams.get("error");

            if (error) {
              console.error("Spotify auth error:", error);
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(
                "<h1>Authentication failed!</h1><p>You can close this window.</p>",
              );
              reject(new Error(`Spotify authentication error: ${error}`));
              return;
            }

            if (code && urlParams.pathname === "/callback") {
              console.log("Received Spotify auth code");
              this.isSpotifyAuthenticated = true;
              this.spotifyAuthData = { code };

              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(
                "<h1>Authentication successful!</h1><p>You can close this window.</p>",
              );

              if (this.authWindow) {
                this.authWindow.close();
              }

              // Clean up the server
              this.server.close(() => {
                console.log("Callback server closed");
              });

              resolve({ success: true, code });
            }
          } catch (error) {
            console.error("Server error:", error);
            res.writeHead(500, { "Content-Type": "text/html" });
            res.end("<h1>Server error occurred!</h1><p>Please try again.</p>");
            reject(error);
          }
        })();
      });

      this.server.listen(this.serverPort, "localhost", () => {
        console.log(`Callback server listening on port ${this.serverPort}`);
        serverResolve();
      });

      this.server.on("error", (error) => {
        console.error("Server error:", error);
        reject(error);
      });
    });
  }

  async initiateSpotifyAuth() {
    try {
      const { SPOTIFY } = getAuthConstants();
      const redirectUri = SPOTIFY.REDIRECT_URI;

      return new Promise((resolve, reject) => {
        this.createCallbackServer(resolve, reject);

        const partition = `persist:spotify-auth-${Date.now()}`;
        const authSession = session.fromPartition(partition);

        authSession.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              "Access-Control-Allow-Origin": ["*"],
            },
          });
        });

        const authUrl = new URL("https://accounts.spotify.com/authorize");
        const params = new URLSearchParams({
          client_id: SPOTIFY.CLIENT_ID,
          response_type: "code",
          redirect_uri: redirectUri,
          scope: SPOTIFY.SCOPES.join(" "),
          show_dialog: "true",
        });
        authUrl.search = params.toString();

        console.log("=== Spotify Auth Debug Info ===");
        console.log("Client ID:", SPOTIFY.CLIENT_ID);
        console.log("Redirect URI:", redirectUri);
        console.log("Full Auth URL:", authUrl.toString());
        console.log("============================");

        this.authWindow = new BrowserWindow({
          width: 600,
          height: 800,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            session: authSession,
            webSecurity: true,
          },
        });

        this.authWindow.webContents.on("did-navigate", (event, url) => {
          console.log("Auth window navigated to:", url);
        });

        this.authWindow.webContents.on(
          "did-fail-load",
          (event, errorCode, errorDescription) => {
            console.error("Page failed to load:", errorCode, errorDescription);
          },
        );

        this.authWindow.loadURL(authUrl.toString());

        this.authWindow.on("closed", () => {
          if (!this.isSpotifyAuthenticated) {
            reject(new Error("Auth window was closed before completion"));
          }
        });
      });
    } catch (error) {
      console.error("Spotify auth error:", error);
      if (this.server) {
        this.server.close();
      }
      this.isSpotifyAuthenticated = false;
      this.spotifyAuthData = null;
      throw error;
    }
  }

  getAuthStatus() {
    return {
      isSpotifyAuthenticated: this.isSpotifyAuthenticated,
      spotifyAuthData: this.spotifyAuthData,
    };
  }
}

const authManager = new AuthManager();
export default authManager;

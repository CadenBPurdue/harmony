// src/main/main.js
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { app, BrowserWindow, ipcMain, protocol, session } from "electron";
import {
  initiateSpotifyAuth,
  initiateAppleMusicAuth,
  getAuthStatus,
} from "./utils/auth_manager.js";
import { configManager } from "./utils/config.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function createWindow() {
  // Set CSP headers for main window
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' https://accounts.spotify.com https://*.scdn.co https://*.apple.com https://js-cdn.music.apple.com;",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.spotify.com https://*.scdn.co https://www.google.com https://www.gstatic.com https://*.apple.com https://js-cdn.music.apple.com;",
          "style-src 'self' 'unsafe-inline' https://*.spotify.com https://*.scdn.co https://*.apple.com;",
          "font-src 'self' data: https://*.scdn.co https://*.apple.com;",
          "img-src 'self' https://*.spotify.com https://*.scdn.co https://www.google.com https://www.gstatic.com data: https://*.apple.com;",
          "connect-src 'self' https://*.spotify.com https://*.scdn.co https://*.ingest.sentry.io https://api.spotify.com https://www.google.com https://*.apple.com https://api.music.apple.com;",
          "frame-src 'self' https://accounts.spotify.com https://www.google.com https://recaptcha.google.com https://*.apple.com;",
          "media-src 'self' https://*.scdn.co https://*.apple.com;",
        ].join(" "),
      },
    });
  });

  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      webSecurity: true,
    },
  });

  // IPC Handlers
  ipcMain.handle("auth:spotify", async () => {
    return await initiateSpotifyAuth();
  });

  ipcMain.handle("auth:status", () => {
    return getAuthStatus();
  });

  ipcMain.handle("config:setSpotifyCredentials", async (event, credentials) => {
    try {
      configManager.setCredentials("spotify", credentials);
      return { success: true };
    } catch (error) {
      console.error("Failed to save credentials:", error);
      throw error;
    }
  });

  ipcMain.handle("config:hasSpotifyCredentials", () => {
    return configManager.hasCredentials("spotify");
  });

  ipcMain.handle("config:clearSpotifyCredentials", () => {
    try {
      configManager.setCredentials("spotify", null);
      return { success: true };
    } catch (error) {
      console.error("Failed to clear credentials:", error);
      throw error;
    }
  });

  ipcMain.handle("auth:appleMusic", async () => {
    return await initiateAppleMusicAuth();
  });

  ipcMain.handle(
    "config:setAppleMusicCredentials",
    async (event, credentials) => {
      try {
        configManager.setCredentials("appleMusic", credentials);
        return { success: true };
      } catch (error) {
        console.error("Failed to save credentials:", error);
        throw error;
      }
    },
  );

  ipcMain.handle("config:hasAppleMusicCredentials", () => {
    return configManager.hasCredentials("appleMusic");
  });

  ipcMain.handle("config:clearAppleMusicCredentials", () => {
    try {
      configManager.setCredentials("appleMusic", null);
      return { success: true };
    } catch (error) {
      console.error("Failed to clear credentials:", error);
      throw error;
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Window loaded");
  });

  mainWindow.webContents.on("console-message", (event, level, message) => {
    console.log("Renderer Console:", message);
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  // Register protocol
  if (!app.isDefaultProtocolClient("harmony")) {
    const success = app.setAsDefaultProtocolClient("harmony");
    console.log("Registered harmony:// protocol:", success);
  }

  protocol.handle("harmony", (request) => {
    console.log("Harmony protocol request:", request.url);
    return new Response("", { status: 200 });
  });

  mainWindow = createWindow();
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  console.log("Received URL on macOS:", url);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});

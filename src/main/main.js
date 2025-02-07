// src/main/main.js
import path from "path";
import { app, BrowserWindow, ipcMain, protocol, session } from "electron";
import { authManager } from "./utils/auth_manager.js";

// Declare mainWindow in the outer scope
let mainWindow;

function createWindow() {
  // Set CSP headers for main window
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' 'unsafe-inline'; connect-src 'self' https://accounts.spotify.com",
        ],
      },
    });
  });

  // Assign to the outer mainWindow variable
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: true,
    },
  });

  ipcMain.handle("auth:spotify", async () => {
    try {
      console.log("Initiating Spotify auth...");
      const result = await authManager.initiateSpotifyAuth();
      console.log("Spotify auth result:", result);
      return result;
    } catch (error) {
      console.error("Spotify auth error:", error);
      throw error;
    }
  });

  ipcMain.handle("auth:status", () => {
    return authManager.getAuthStatus();
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
    app.setAsDefaultProtocolClient("harmony");
  }

  protocol.handle("harmony", (request) => {
    const url = request.url;
    console.log("Protocol handler received URL:", url);
  });

  createWindow();
});

// Handle the protocol on macOS
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

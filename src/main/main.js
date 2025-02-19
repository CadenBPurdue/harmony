// src/main/main.js
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { app, BrowserWindow, protocol, session } from "electron";
import { registerIpcHandlers } from "./utils/registerIpcHandlers.js";

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
          "default-src 'self' https://accounts.spotify.com https://*.scdn.co https://*.apple.com https://js-cdn.music.apple.com https://apis.google.com https://*.firebaseapp.com https://*.googleapis.com;",
          "script-src 'self' 'unsafe-inline' https://*.spotify.com https://*.scdn.co https://www.google.com https://www.gstatic.com https://*.apple.com https://js-cdn.music.apple.com https://apis.google.com https://*.firebaseapp.com https://*.googleapis.com;",
          "style-src 'self' 'unsafe-inline' https://*.spotify.com https://*.scdn.co https://*.apple.com https://fonts.googleapis.com https://www.gstatic.com https://accounts.google.com;",
          "font-src 'self' data: https://*.scdn.co https://*.apple.com https://fonts.gstatic.com;",
          "img-src 'self' https://*.spotify.com https://*.scdn.co https://www.google.com https://www.gstatic.com data: https://*.apple.com https://ssl.gstatic.com https://lh3.googleusercontent.com;",
          "connect-src 'self' https://*.spotify.com https://*.scdn.co https://*.ingest.sentry.io https://api.spotify.com https://www.google.com https://*.apple.com https://api.music.apple.com https://*.googleapis.com https://*.firebaseapp.com ws://localhost:5173 http://localhost:5173;",
          "frame-src 'self' https://accounts.spotify.com https://www.google.com https://recaptcha.google.com https://*.apple.com https://harmony-oss.firebaseapp.com https://accounts.google.com;",
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

  // Register IPC handlers
  registerIpcHandlers();

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

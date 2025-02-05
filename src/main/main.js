// src/main/main.js
const { app, BrowserWindow, ipcMain, protocol, session } = require('electron');
const path = require('path');
const { authManager } = require('./utils/auth_manager');

function createWindow() {
  // Set CSP headers for main window
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline'; connect-src 'self' https://accounts.spotify.com"]
      }
    });
  });

  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    }
  });

  ipcMain.handle('auth:spotify', async () => {
    try {
      console.log('Initiating Spotify auth...');
      const result = await authManager.initiateSpotifyAuth();
      console.log('Spotify auth result:', result);
      return result;
    } catch (error) {
      console.error('Spotify auth error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:status', () => {
    return authManager.getAuthStatus();
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  return mainWindow;
}

let mainWindow = null;

app.whenReady().then(() => {
  // Register protocol
  if (!app.isDefaultProtocolClient('harmony')) {
    app.setAsDefaultProtocolClient('harmony');
  }

  protocol.registerHttpProtocol('harmony', (request, callback) => {
    const url = request.url;
    console.log('Protocol handler received URL:', url);
  });

  mainWindow = createWindow();
});

// Handle the protocol on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('Received URL on macOS:', url);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});